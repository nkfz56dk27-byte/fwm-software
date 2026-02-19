import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import { analyzeSource, getSourceLabel } from "./utils/sourceAnalyzer";
import { XMLParser } from "fast-xml-parser";
import { inserisciNotificaPush } from "./pushNotificationService";

// Funzione MIGLIORATA per decodificare TUTTE le entità HTML
function decodeHtmlEntities(str) {
  if (!str) return '';
  
  // Primo passaggio: decodifica entità numeriche (&#8217; &#124; ecc.)
  let decoded = str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  
  // Secondo passaggio: decodifica entità hex (&#x2019; ecc.)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Terzo passaggio: decodifica entità named (&amp; &lt; &gt; ecc.)
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&hellip;': '…',
    '&euro;': '€',
    '&pound;': '£',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™'
  };
  
  Object.keys(entities).forEach(entity => {
    decoded = decoded.replace(new RegExp(entity, 'g'), entities[entity]);
  });
  
  return decoded;
}

function PannelloFonti({ onClose }) {
  function parseRelativeDate(text, now = new Date()) {
    if (!text) return null;
    const match = text.match(/(\d+)\s+(minuto|minuti|ora|ore|giorno|giorni|settimana|settimane|mese|mesi|anno|anni|hour|hours|minute|minutes|day|days|week|weeks|month|months|year|years)[a-z]*\s+(fa|ago)/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const date = new Date(now);
    switch (unit) {
      case 'minuto': case 'minuti': case 'minute': case 'minutes':
        date.setMinutes(date.getMinutes() - value); break;
      case 'ora': case 'ore': case 'hour': case 'hours':
        date.setHours(date.getHours() - value); break;
      case 'giorno': case 'giorni': case 'day': case 'days':
        date.setDate(date.getDate() - value); break;
      case 'settimana': case 'settimane': case 'week': case 'weeks':
        date.setDate(date.getDate() - value * 7); break;
      case 'mese': case 'mesi': case 'month': case 'months':
        date.setMonth(date.getMonth() - value); break;
      case 'anno': case 'anni': case 'year': case 'years':
        date.setFullYear(date.getFullYear() - value); break;
    }
    return date;
  }

  const BBC_FEED_URL = 'https://feeds.bbci.co.uk/sport/formula1/rss.xml';

  function trovaArticoloDuplicato(articolo, tuttiArticoli) {
    const parole = `${articolo.title} ${articolo.description} ${articolo.content || ''}`.toLowerCase().split(/\W+/).filter(w => w.length >= 5);
    for (const altro of tuttiArticoli) {
      if (altro.id === articolo.id || altro.feedSource === articolo.feedSource) continue;
      const testoAltro = `${altro.title} ${altro.description} ${altro.content || ''}`.toLowerCase();
      let count = 0;
      for (const parola of parole) {
        if (testoAltro.includes(parola)) count++;
      }
      if (count >= 10) {
        return altro.feedSource || 'altra fonte';
      }
    }
    return null;
  }

  async function caricaPrenotazioni(user) {
    const uname = user || username;
    if (!uname) return;
    if (prenotazioniFetchInFlightRef.current) return;
    prenotazioniFetchInFlightRef.current = true;
    try {
      const { data, error } = await supabase
        .from('prenotazioni_articoli')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Errore caricamento prenotazioni:', error);
        return;
      }

      setPrenotazioni(data || []);
    } catch (error) {
      console.error('❌ Errore caricamento prenotazioni:', error);
    } finally {
      prenotazioniFetchInFlightRef.current = false;
    }
  }

  useEffect(() => {
    const currentUsername = sessionStorage.getItem('username') || '';
    if (currentUsername) {
      caricaArticoliDalDatabase();
      caricaPrenotazioni(currentUsername);
    }
  }, []);

  async function getTuttiArticoli() {
    if (tuttiArticoliCacheRef.current) return tuttiArticoliCacheRef.current;
    if (tuttiArticoliFetchPromiseRef.current) return tuttiArticoliFetchPromiseRef.current;

    tuttiArticoliFetchPromiseRef.current = (async () => {
      const res = await supabase
        .from('rss_articles')
        .select('*')
        .order('pub_date', { ascending: false });

      if (res.error) {
        throw res.error;
      }

      const data = res.data || [];
      tuttiArticoliCacheRef.current = data;
      return data;
    })().finally(() => {
      tuttiArticoliFetchPromiseRef.current = null;
    });

    return tuttiArticoliFetchPromiseRef.current;
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function analizzaArticolo(articolo) {
    let tuttiArticoli = [];
    try {
      tuttiArticoli = await getTuttiArticoli();
    } catch (err) {
      if (err?.name === 'AbortError') {
        return {
          tipo: 'ripresa',
          fonte: null,
          analysis: { isOriginal: false, isFirstToReport: false, reason: 'AbortError' }
        };
      }
      return {
        tipo: 'ripresa',
        fonte: null,
        analysis: { isOriginal: false, isFirstToReport: false, reason: 'Errore caricamento' }
      };
    }
    const analysis = analyzeSource(articolo, articolo.feedSource, tuttiArticoli);
    return {
      tipo: analysis.isOriginal ? 'esclusiva' : 'ripresa',
      fonte: analysis.attributedSources.length > 0 ? analysis.attributedSources.join(', ') : null,
      analysis: analysis
    };
  }

  function getOrigineArticolo(articolo) {
    if (!analisiArticoli[articolo.id]) {
      analizzaArticolo(articolo).then(result => {
        setAnalisiArticoli(prev => ({
          ...prev,
          [articolo.id]: result
        }));
      });
      return {
        tipo: 'ripresa',
        fonte: null,
        analysis: { isOriginal: false, isFirstToReport: false, reason: 'Calcolando...' }
      };
    }
    return analisiArticoli[articolo.id];
  }

  const [feeds, setFeeds] = useState([]);
  const [articoli, setArticoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [username, setUsername] = useState('');
  const [analisiArticoli, setAnalisiArticoli] = useState({});
  const [isLoadingArticoli, setIsLoadingArticoli] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showFiltriModal, setShowFiltriModal] = useState(false);
  const [isClosingFiltri, setIsClosingFiltri] = useState(false);
  const [filtroStato, setFiltroStato] = useState('tutti');
  const [filtroFonte, setFiltroFonte] = useState('tutte');
  const [filtroSoloMiei, setFiltroSoloMiei] = useState(false);
  const [filtriTab, setFiltriTab] = useState('keyword');
  const [keywordFilters, setKeywordFilters] = useState([]);
  const [feedFilters, setFeedFilters] = useState([]);
  const [nuovaKeyword, setNuovaKeyword] = useState('');
  const [isSavingFiltri, setIsSavingFiltri] = useState(false);
  const [isLoadingFiltri, setIsLoadingFiltri] = useState(false);
  const [userCategorieIds, setUserCategorieIds] = useState([]);
  const [formulaECategoryId, setFormulaECategoryId] = useState(null);
  const [activeTab, setActiveTab] = useState('f1');
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const debugLogsRef = useRef([]);
  const realtimeReloadTimeout = useRef(null);
  const isSyncingFeedsRef = useRef(false);
  const hasStartedInitialSyncRef = useRef(false);
  const articoliFetchInFlightRef = useRef(false);
  const lastArticoliFetchRef = useRef(0);
  const pendingArticoliReloadRef = useRef(false);
  const articoliReloadTimeoutRef = useRef(null);
  const prenotazioniFetchInFlightRef = useRef(false);
  const tuttiArticoliCacheRef = useRef(null);
  const tuttiArticoliFetchPromiseRef = useRef(null);

  const searchLower = search.toLowerCase();
  const { articoliIndicizzati, articoliPerTab } = useMemo(() => {
    const normalizzaLink = (link) => {
      if (!link) return '';
      try {
        const url = new URL(link);
        const params = new URLSearchParams(url.search);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(p => params.delete(p));
        url.search = params.toString();
        url.hash = '';
        return url.toString();
      } catch {
        return link.trim();
      }
    };

    const visti = new Set();
    const deduplicati = [];
    for (const articolo of articoli) {
      const guid = (articolo.guid || '').trim().toLowerCase();
      const link = normalizzaLink(articolo.link || '').toLowerCase();
      const titolo = (articolo.title || '').trim().toLowerCase();
      const pubDate = articolo.pub_date || articolo.pubDate || articolo.published_at || '';
      const dayKey = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';
      const sourceKey = (articolo.feedSource || articolo.rss_feeds?.url || '').toLowerCase();
      const titleDateKey = titolo && dayKey ? `${titolo}::${dayKey}` : '';
      const titleSourceKey = titolo && sourceKey ? `${titolo}::${sourceKey}` : '';
      const key = guid || link || titleDateKey || titleSourceKey || titolo || String(articolo.id || '');
      if (visti.has(key)) continue;
      visti.add(key);
      deduplicati.push(articolo);
    }

    const indicizzati = deduplicati.map(articolo => {
      const testo = `${articolo.feedSource || ''} ${articolo.title || ''} ${articolo.description || ''}`.toLowerCase();
      const cardTarget = articolo.rss_feeds?.card_target || articolo.card_target || '';
      const isF1FromCard = cardTarget === 'f1';
      const isFEFromCard = cardTarget === 'fe';
      const isOtherFromCard = cardTarget === 'other';
      const isF1FromText = testo.includes('formula 1') || testo.includes('formula1') || testo.includes(' f1') || testo.includes('f1 ');
      const isFEFromText = testo.includes('formula e') || testo.includes('formula-e') || testo.includes('formulae') || testo.includes(' fe ');
      const isF1Auto = !cardTarget && isF1FromText && !isFEFromText;
      const isFEAuto = !cardTarget && isFEFromText;
      const isOtherAuto = !cardTarget && !isF1FromText && !isFEFromText;
      return {
        ...articolo,
        __searchText: testo,
        __cardTarget: cardTarget,
        __isF1: isF1FromCard || isF1Auto,
        __isFE: isFEFromCard || isFEAuto,
        __isOther: isOtherFromCard || isOtherAuto
      };
    });
    const perTab = {
      all: indicizzati,
      f1: indicizzati.filter(a => a.__isF1),
      fe: indicizzati.filter(a => a.__isFE),
      other: indicizzati.filter(a => a.__isOther)
    };
    return { articoliIndicizzati: indicizzati, articoliPerTab: perTab };
  }, [articoli]);

  const articoliFiltrati = useMemo(() => {
    const listaBase = activeTab === 'f1'
      ? articoliPerTab.f1
      : activeTab === 'fe'
        ? articoliPerTab.fe
        : activeTab === 'other'
          ? articoliPerTab.other
          : articoliPerTab.all;

    if (!searchLower) {
      const vistiTitoli = new Set();
      return listaBase.filter(articolo => {
        const titoloNorm = (articolo.title || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[^\p{L}\p{N} ]/gu, '')
          .trim();
        if (!titoloNorm) return true;
        if (vistiTitoli.has(titoloNorm)) return false;
        vistiTitoli.add(titoloNorm);
        return true;
      });
    }
    const vistiTitoli = new Set();
    return listaBase.filter(articolo => articolo.__searchText.includes(searchLower)).filter(articolo => {
      const titoloNorm = (articolo.title || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N} ]/gu, '')
        .trim();
      if (!titoloNorm) return true;
      if (vistiTitoli.has(titoloNorm)) return false;
      vistiTitoli.add(titoloNorm);
      return true;
    });
  }, [articoliIndicizzati, articoliPerTab, searchLower, activeTab]);

  const prenotazioniMap = useMemo(() => {
    const map = new Map();
    for (const p of prenotazioni) {
      map.set(p.articolo_id, p);
    }
    return map;
  }, [prenotazioni]);

  const fontiDisponibili = useMemo(() => {
    const set = new Set();
    for (const articolo of articoliIndicizzati) {
      if (articolo.feedSource) set.add(articolo.feedSource);
    }
    return Array.from(set).sort();
  }, [articoliIndicizzati]);

  const keywordFiltersLower = useMemo(() => keywordFilters.map(k => k.toLowerCase()), [keywordFilters]);
  const feedFiltersSet = useMemo(() => new Set(feedFilters.map(id => String(id))), [feedFilters]);
  const hasFormulaEAccess = useMemo(() => (
    !formulaECategoryId || userCategorieIds.includes(formulaECategoryId)
  ), [formulaECategoryId, userCategorieIds]);

  function normalizeLogoUrl(url) {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (trimmed.includes('/storage/v1/object/public/')) return trimmed;
      if (trimmed.includes('/storage/v1/object/')) {
        return trimmed.replace('/storage/v1/object/', '/storage/v1/object/public/');
      }
      return trimmed;
    }

    if (trimmed.startsWith('/')) return trimmed;
    if (trimmed.startsWith('feed-logos/')) {
      const path = trimmed.replace('feed-logos/', '');
      const { data } = supabase.storage.from('feed-logos').getPublicUrl(path);
      return data?.publicUrl || null;
    }

    return `/${trimmed}`;
  }

  function getLocalLogoFallback(src) {
    if (!src) return null;
    try {
      const url = new URL(src, window.location.origin);
      const path = url.pathname || '';
      if (!path.includes('feed-logos')) return null;
      const base = path.split('/').pop();
      if (!base || !base.includes('.')) return null;
      return `/${base}`;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!hasFormulaEAccess && activeTab === 'fe') {
      setActiveTab('f1');
    }
  }, [hasFormulaEAccess, activeTab]);

  async function caricaFiltriNotifiche(currentUsername) {
    if (!currentUsername) return;
    setIsLoadingFiltri(true);
    try {
      const { data, error } = await supabase
        .from('rss_notification_filters')
        .select('filter_type,value')
        .eq('username', currentUsername);

      if (error) {
        return;
      }

      const keywords = [];
      const feedIds = [];
      for (const row of data || []) {
        if (row.filter_type === 'keyword' && row.value) {
          keywords.push(row.value);
        }
        if (row.filter_type === 'feed' && row.value) {
          feedIds.push(String(row.value));
        }
      }

      const keywordSet = new Set();
      const normalizedKeywords = [];
      for (const k of keywords) {
        const trimmed = k.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (keywordSet.has(lower)) continue;
        keywordSet.add(lower);
        normalizedKeywords.push(trimmed);
      }

      setKeywordFilters(normalizedKeywords);
      setFeedFilters(Array.from(new Set(feedIds)));
    } finally {
      setIsLoadingFiltri(false);
    }
  }

  async function salvaFiltriNotifiche() {
    if (!username) return;
    setIsSavingFiltri(true);
    try {
      await supabase
        .from('rss_notification_filters')
        .delete()
        .eq('username', username);

      const keywordRows = keywordFilters
        .map(k => k.trim())
        .filter(Boolean)
        .map(k => ({ username, filter_type: 'keyword', value: k }));

      const feedRows = feedFilters
        .filter(id => id !== null && id !== undefined)
        .map(id => ({ username, filter_type: 'feed', value: String(id) }));

      const rows = [...keywordRows, ...feedRows];
      if (rows.length > 0) {
        await supabase.from('rss_notification_filters').insert(rows);
      }
    } finally {
      setIsSavingFiltri(false);
    }
  }

  function aggiungiKeyword(valore) {
    const raw = (valore || '').trim();
    if (!raw) return;
    const items = raw.split(',').map(s => s.trim()).filter(Boolean);
    setKeywordFilters(prev => {
      const lowerSet = new Set(prev.map(k => k.toLowerCase()));
      const merged = [...prev];
      for (const item of items) {
        const lower = item.toLowerCase();
        if (lowerSet.has(lower)) continue;
        lowerSet.add(lower);
        merged.push(item);
      }
      return merged;
    });
    setNuovaKeyword('');
  }

  function rimuoviKeyword(keyword) {
    setKeywordFilters(prev => prev.filter(k => k !== keyword));
  }

  function toggleFeedFilter(feedId) {
    const normalized = String(feedId);
    setFeedFilters(prev => (
      prev.includes(normalized) ? prev.filter(id => id !== normalized) : [...prev, normalized]
    ));
  }

  // Funzione per aggiungere log in MEMORIA (non database)
  async function aggiungiDebugLog(logData) {
    const logCompleto = {
      ...logData,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    // Aggiungi al ref (max 100 log)
    debugLogsRef.current = [logCompleto, ...debugLogsRef.current].slice(0, 100);
    
    // Log anche in console per debug desktop
    console.log('📝 DEBUG LOG:', logCompleto);
    
    // 💾 SALVA SU DATABASE per tracciabilità permanente
    try {
      // Normalizza il risultato (accetta sia boolean che string)
      let risultatoNormalizzato = logData.risultato;
      if (typeof logData.risultato === 'boolean') {
        risultatoNormalizzato = logData.risultato ? 'INVIATA' : 'NON_INVIATA';
      }
      
      await supabase.from('rss_notification_logs').insert({
        titolo_raw: logData.titolo_raw,
        titolo_decodificato: logData.titolo_decodificato,
        feed_url: logData.feed_url,
        feed_name: logData.feed_name,
        feed_is_selected: logData.feed_is_selected,
        keywords_attive: logData.keywords_attive,
        feed_selezionati: logData.feed_selezionati,
        caso: logData.caso,
        risultato: risultatoNormalizzato,
        motivo: logData.motivo,
        keyword_match: logData.keyword_match,
        username: logData.username,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('❌ Errore salvataggio log su database:', err);
      // Non blocchiamo l'esecuzione se il salvataggio fallisce
    }
  }

  async function caricaDebugLogs() {
    // Carica log dalla MEMORIA (non dal database)
    setDebugLogs([...debugLogsRef.current]);
    setShowDebugLogs(true);
  }

  // ✅ FUNZIONE TEST - Testa filtri sugli articoli ATTUALI
  async function testaFiltriSuArticoliAttuali() {
    if (!username) {
      alert('Nessun utente loggato');
      return;
    }

    // Carica i filtri dell'utente corrente
    try {
      const { data: filtriData, error: filtriError } = await supabase
        .from('rss_notification_filters')
        .select('filter_type, value')
        .eq('username', username);

      if (filtriError) {
        console.error('Errore caricamento filtri:', filtriError);
        alert('Errore caricamento filtri');
        return;
      }

      const filtriUtente = { keywords: [], feeds: [] };
      
      for (const filtro of filtriData || []) {
        if (filtro.filter_type === 'keyword' && filtro.value) {
          const keywordPulita = filtro.value.trim().toLowerCase();
          if (keywordPulita) {
            filtriUtente.keywords.push(keywordPulita);
          }
        } else if (filtro.filter_type === 'feed' && filtro.value) {
          filtriUtente.feeds.push(String(filtro.value));
        }
      }

      if (filtriUtente.keywords.length === 0 && filtriUtente.feeds.length === 0) {
        alert('Nessun filtro impostato! Aggiungi keyword o feed prima di testare.');
        return;
      }

      // Prendi gli ultimi 20 articoli
      const articoliDaTestare = articoliFiltrati.slice(0, 20);

      if (articoliDaTestare.length === 0) {
        alert('Nessun articolo da testare!');
        return;
      }

      // Testa ogni articolo
      for (const articolo of articoliDaTestare) {
        const titoloRaw = (articolo.title || '').trim();
        const titoloDecodificato = decodeHtmlEntities(titoloRaw);
        const titoloLower = titoloDecodificato.toLowerCase();

        const hasKeywords = filtriUtente.keywords.length > 0;
        const hasFeeds = filtriUtente.feeds.length > 0;
        const feedIsSelected = filtriUtente.feeds.includes(String(articolo.feed_id));

        let shouldNotify = false;
        let motivo = '';
        let keywordMatch = null;
        let debugInfo = {
          titolo_raw: titoloRaw,
          titolo_decodificato: titoloDecodificato,
          titolo_lowercase: titoloLower,
          feed_url: articolo.feedSource || 'N/A',
          feed_name: articolo.feedSource || 'N/A',
          feed_id: String(articolo.feed_id || 'N/A'),
          feed_is_selected: feedIsSelected,
          keywords_attive: filtriUtente.keywords,
          feed_selezionati: filtriUtente.feeds,
          username: username,
          test_keyword_dettaglio: []
        };

        // CASO 1: SOLO KEYWORD
        if (hasKeywords && !hasFeeds) {
          debugInfo.caso = 'SOLO_KEYWORD';
          
          for (const keyword of filtriUtente.keywords) {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regexTest = new RegExp(`\\b${escaped}\\b`, 'i');
            const match = regexTest.test(titoloLower);
            const includesTest = titoloLower.includes(keyword);
            
            debugInfo.test_keyword_dettaglio.push({
              keyword: keyword,
              regex_pattern: `\\b${escaped}\\b`,
              regex_match: match,
              includes_match: includesTest,
              titolo_contiene: titoloLower.indexOf(keyword) !== -1 ? `Trovato a posizione ${titoloLower.indexOf(keyword)}` : 'Non trovato'
            });
            
            if (match) {
              shouldNotify = true;
              motivo = `Keyword "${keyword}" trovata (regex match)`;
              keywordMatch = keyword;
              break;
            }
          }
          
          if (!shouldNotify) {
            motivo = `Nessuna keyword trovata. Keywords cercate: ${filtriUtente.keywords.join(', ')}`;
          }
        }
        
        // CASO 2: SOLO FEED
        else if (!hasKeywords && hasFeeds) {
          debugInfo.caso = 'SOLO_FEED';
          
          if (feedIsSelected) {
            shouldNotify = true;
            motivo = 'Feed selezionato';
          } else {
            motivo = 'Feed non selezionato';
          }
        }
        
        // CASO 3: KEYWORD + FEED
        else if (hasKeywords && hasFeeds) {
          debugInfo.caso = 'KEYWORD_E_FEED';
          
          if (feedIsSelected) {
            shouldNotify = true;
            motivo = 'Feed selezionato (keyword ignorate)';
          } else {
            for (const keyword of filtriUtente.keywords) {
              const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regexTest = new RegExp(`\\b${escaped}\\b`, 'i');
              const match = regexTest.test(titoloLower);
              const includesTest = titoloLower.includes(keyword);
              
              debugInfo.test_keyword_dettaglio.push({
                keyword: keyword,
                regex_pattern: `\\b${escaped}\\b`,
                regex_match: match,
                includes_match: includesTest,
                titolo_contiene: titoloLower.indexOf(keyword) !== -1 ? `Trovato a posizione ${titoloLower.indexOf(keyword)}` : 'Non trovato'
              });
              
              if (match) {
                shouldNotify = true;
                motivo = `Keyword "${keyword}" in feed non selezionato (regex match)`;
                keywordMatch = keyword;
                break;
              }
            }
            
            if (!shouldNotify) {
              motivo = `Feed non selezionato e nessuna keyword trovata. Keywords: ${filtriUtente.keywords.join(', ')}`;
            }
          }
        }

        // Salva log in memoria
        aggiungiDebugLog({
          ...debugInfo,
          risultato: shouldNotify ? 'NOTIFICA_INVIATA' : 'NESSUNA_NOTIFICA',
          motivo: motivo,
          keyword_match: keywordMatch
        });
      }

      alert(`✅ Test completato! Testati ${articoliDaTestare.length} articoli. Apri Debug Log per vedere i risultati.`);
      
    } catch (err) {
      console.error('Errore test filtri:', err);
      alert('Errore durante il test: ' + err.message);
    }
  }

  // ✅ FUNZIONE CORRETTA - CONTROLLA TUTTI GLI UTENTI
  async function inviaNotificheFiltrate(nuoviArticoli, feed) {
    if (nuoviArticoli.length === 0) return;
    
    let host = 'RSS';
    try {
      host = feed?.url ? new URL(feed.url).hostname : 'RSS';
    } catch {
      host = 'RSS';
    }

    // 1️⃣ CARICA TUTTI I FILTRI DI TUTTI GLI UTENTI
    try {
      const { data: tuttiFiltri, error: filtriError } = await supabase
        .from('rss_notification_filters')
        .select('username, filter_type, value');
      
      if (filtriError) {
        console.error('❌ Errore caricamento filtri utenti:', filtriError);
        return;
      }
      
      if (!tuttiFiltri || tuttiFiltri.length === 0) {
        console.log('⏭️ Nessun filtro attivo da nessun utente');
        return;
      }
      
      // 2️⃣ RAGGRUPPA FILTRI PER UTENTE
      const filtriPerUtente = {};
      for (const filtro of tuttiFiltri) {
        if (!filtriPerUtente[filtro.username]) {
          filtriPerUtente[filtro.username] = { keywords: [], feeds: [] };
        }
        
        if (filtro.filter_type === 'keyword' && filtro.value) {
          // Pulisci keyword: trim + lowercase
          const keywordPulita = filtro.value.trim().toLowerCase();
          if (keywordPulita) {
            filtriPerUtente[filtro.username].keywords.push(keywordPulita);
          }
        } else if (filtro.filter_type === 'feed' && filtro.value) {
          filtriPerUtente[filtro.username].feeds.push(String(filtro.value));
        }
      }
      
      console.log('👥 Utenti con filtri attivi:', Object.keys(filtriPerUtente).length);
      
      // 3️⃣ PER OGNI ARTICOLO
      for (const articolo of nuoviArticoli) {
        const guid = (articolo.guid || '').trim().toLowerCase();
        if (!guid) continue;
        
        const titoloRaw = (articolo.title || '').trim() || 'Nuovo articolo RSS';
        const titoloDecodificato = decodeHtmlEntities(titoloRaw);
        const titoloLower = titoloDecodificato.toLowerCase();
        
        // 4️⃣ PER OGNI UTENTE
        for (const [utenteUsername, filtrUtente] of Object.entries(filtriPerUtente)) {
          
          const hasKeywords = filtrUtente.keywords.length > 0;
          const hasFeeds = filtrUtente.feeds.length > 0;
          
          if (!hasKeywords && !hasFeeds) continue; // Utente senza filtri
          
          const feedIsSelected = filtrUtente.feeds.includes(String(feed?.id));
          
          // 🔍 DEBUG: Log dettagliato del matching del feed
          console.log('🔍 FEED MATCHING DEBUG:', {
            articolo_guid: guid,
            feed_id_articolo: feed?.id,
            feed_id_articolo_string: String(feed?.id),
            feed_id_articolo_type: typeof feed?.id,
            feed_selezionati_utente: filtrUtente.feeds,
            feed_selezionati_types: filtrUtente.feeds.map(f => typeof f),
            includes_result: feedIsSelected,
            username: utenteUsername
          });
          
          let shouldNotify = false;
          let motivo = '';
          let keywordMatch = null;
          let debugInfo = {
            titolo_raw: titoloRaw,
            titolo_decodificato: titoloDecodificato,
            titolo_lowercase: titoloLower,
            feed_url: feed?.url || 'N/A',
            feed_name: feed?.name || 'N/A',
            feed_id: String(feed?.id || 'N/A'),
            feed_id_type: typeof feed?.id,
            feed_is_selected: feedIsSelected,
            keywords_attive: filtrUtente.keywords,
            feed_selezionati: filtrUtente.feeds,
            username: utenteUsername,
            test_keyword_dettaglio: [],
            debug_feed_comparison: {
              feed_articolo: String(feed?.id),
              feeds_utente: filtrUtente.feeds,
              match_esatto: filtrUtente.feeds.map(f => ({
                saved: f,
                current: String(feed?.id),
                equal: f === String(feed?.id)
              }))
            }
          };
          
          // 5️⃣ LOGICA FILTRI (identica a prima ma per QUESTO utente)
          
          // CASO 1: SOLO KEYWORD
          if (hasKeywords && !hasFeeds) {
            debugInfo.caso = 'SOLO_KEYWORD';
            
            for (const keyword of filtrUtente.keywords) {
              const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              
              // Test MOLTO dettagliato
              const regexTest = new RegExp(`\\b${escaped}\\b`, 'i');
              const match = regexTest.test(titoloLower);
              
              // Test alternativo senza word boundary
              const includesTest = titoloLower.includes(keyword);
              
              debugInfo.test_keyword_dettaglio.push({
                keyword: keyword,
                regex_pattern: `\\b${escaped}\\b`,
                regex_match: match,
                includes_match: includesTest,
                titolo_contiene: titoloLower.indexOf(keyword) !== -1 ? `Trovato a posizione ${titoloLower.indexOf(keyword)}` : 'Non trovato'
              });
              
              if (match) {
                shouldNotify = true;
                motivo = `Keyword "${keyword}" trovata (regex match)`;
                keywordMatch = keyword;
                break;
              }
            }
            
            if (!shouldNotify) {
              motivo = `Nessuna keyword trovata. Keywords cercate: ${filtrUtente.keywords.join(', ')}`;
            }
          }
          
          // CASO 2: SOLO FEED
          else if (!hasKeywords && hasFeeds) {
            debugInfo.caso = 'SOLO_FEED';
            
            if (feedIsSelected) {
              shouldNotify = true;
              motivo = 'Feed selezionato';
            } else {
              motivo = 'Feed non selezionato';
            }
          }
          
          // CASO 3: KEYWORD + FEED
          else if (hasKeywords && hasFeeds) {
            debugInfo.caso = 'KEYWORD_E_FEED';
            
            if (feedIsSelected) {
              shouldNotify = true;
              motivo = 'Feed selezionato (keyword ignorate)';
            } else {
              // Feed NON selezionato → controlla keyword
              for (const keyword of filtrUtente.keywords) {
                const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regexTest = new RegExp(`\\b${escaped}\\b`, 'i');
                const match = regexTest.test(titoloLower);
                
                // Test alternativo
                const includesTest = titoloLower.includes(keyword);
                
                debugInfo.test_keyword_dettaglio.push({
                  keyword: keyword,
                  regex_pattern: `\\b${escaped}\\b`,
                  regex_match: match,
                  includes_match: includesTest,
                  titolo_contiene: titoloLower.indexOf(keyword) !== -1 ? `Trovato a posizione ${titoloLower.indexOf(keyword)}` : 'Non trovato'
                });
                
                if (match) {
                  shouldNotify = true;
                  motivo = `Keyword "${keyword}" in feed non selezionato (regex match)`;
                  keywordMatch = keyword;
                  break;
                }
              }
              
              if (!shouldNotify) {
                motivo = `Feed non selezionato e nessuna keyword trovata. Keywords: ${filtrUtente.keywords.join(', ')}`;
              }
            }
          }
          
          if (!shouldNotify) continue;
          
          // 🛡️ FAIL-SAFE: Ri-verifica che dovremmo davvero notificare
          if (hasKeywords && !hasFeeds) {
            // Caso SOLO_KEYWORD: DEVE avere keyword match
            if (!keywordMatch) {
              console.error('⚠️ FAIL-SAFE TRIGGERED: shouldNotify=true ma nessuna keyword match!', {
                username: utenteUsername,
                titolo: titoloDecodificato,
                keywords: filtrUtente.keywords,
                caso: debugInfo.caso
              });
              continue; // ← BLOCCA l'invio!
            }
          }
          
          // 6️⃣ CONTROLLA DUPLICATI PER QUESTO UTENTE
          try {
            // Controlla se abbiamo già loggato questa notifica per questo utente
            const { data: notificaEsistente, error: errDup } = await supabase
              .from('rss_notification_logs')
              .select('id')
              .eq('username', utenteUsername)
              .eq('titolo_decodificato', titoloDecodificato)
              .eq('risultato', 'INVIATA')
              .limit(1);

            if (errDup) {
              console.error('❌ Errore controllo duplicati:', errDup);
              // Non blocchiamo l'esecuzione, continua comunque
            } else if (notificaEsistente && notificaEsistente.length > 0) {
              console.log(`⏭️ Notifica già inviata: ${titoloDecodificato} → ${utenteUsername}`);
              continue;
            }
          } catch (err) {
            console.error('❌ Errore controllo duplicati:', err);
            // Non blocchiamo l'esecuzione
          }
          
          // 7️⃣ SALVA LOG PRIMA DELL'INVIO (per evitare race condition)
          await aggiungiDebugLog({
            ...debugInfo,
            risultato: 'INVIATA',
            motivo: motivo,
            keyword_match: keywordMatch
          });
          
          // 8️⃣ MANDA NOTIFICA A QUESTO SPECIFICO UTENTE
          try {
            await inserisciNotificaPush({
              title: titoloDecodificato,
              body: `Fonte: ${host}`,
              notification_type: 'rss_filter',
              target_all: false,
              target_users: [utenteUsername],
              data: {
                link: articolo.link || null,
                feed_id: feed?.id || null,
                guid: guid
              }
            });
            
            console.log(`✅ Notifica inviata a ${utenteUsername}: ${titoloDecodificato} (${motivo})`);
            
          } catch (err) {
            console.error(`❌ Errore invio notifica a ${utenteUsername}:`, err);
          }
        }
      }
      
    } catch (err) {
      console.error('❌ Errore generale inviaNotificheFiltrate:', err);
    }
  }

  useEffect(() => {
    if (showFiltriModal && username) {
      caricaFiltriNotifiche(username);
    }
  }, [showFiltriModal, username]);

  useEffect(() => {
    let isMounted = true;
    const savedUsername = sessionStorage.getItem('username');
    if (hasStartedInitialSyncRef.current) {
      return;
    }
    hasStartedInitialSyncRef.current = true;

    if (savedUsername) {
      setUsername(savedUsername);
      caricaFeedEDArticoli(savedUsername);
    }

    if (window.__PANNELLO_FONTI_POLLING_ACTIVE) {
      console.log('⏩ Polling già attivo, skip');
    } else {
      window.__PANNELLO_FONTI_POLLING_ACTIVE = true;
      window.__PANNELLO_FONTI_POLLING_INTERVAL = null;
      if (savedUsername) {
        window.__PANNELLO_FONTI_POLLING_INTERVAL = setInterval(() => {
          if (!isLoadingArticoli) {
            controllaNuoviArticoli();
          }
        }, 3 * 60 * 1000);
      }
    }

    const channel = supabase
      .channel('rss_articles_updates')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'rss_articles' 
        }, 
        (payload) => {
          if (isSyncingFeedsRef.current) return;
          if (realtimeReloadTimeout.current) return;
          realtimeReloadTimeout.current = setTimeout(() => {
            realtimeReloadTimeout.current = null;
            if (!isLoadingArticoli) {
              caricaArticoliDalDatabase();
            }
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (window.__PANNELLO_FONTI_POLLING_INTERVAL) {
        clearInterval(window.__PANNELLO_FONTI_POLLING_INTERVAL);
        window.__PANNELLO_FONTI_POLLING_INTERVAL = null;
        window.__PANNELLO_FONTI_POLLING_ACTIVE = false;
      }
      if (realtimeReloadTimeout.current) {
        clearTimeout(realtimeReloadTimeout.current);
        realtimeReloadTimeout.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, []);

  async function caricaArticoliDalDatabase() {
    if (articoliFetchInFlightRef.current || isLoadingArticoli) {
      pendingArticoliReloadRef.current = true;
      return;
    }

    const now = Date.now();
    const minIntervalMs = 8000;
    const timeSinceLast = now - lastArticoliFetchRef.current;

    if (timeSinceLast < minIntervalMs) {
      if (!articoliReloadTimeoutRef.current) {
        const waitMs = minIntervalMs - timeSinceLast;
        articoliReloadTimeoutRef.current = setTimeout(() => {
          articoliReloadTimeoutRef.current = null;
          caricaArticoliDalDatabase();
        }, waitMs);
      }
      return;
    }

    articoliFetchInFlightRef.current = true;
    setIsLoadingArticoli(true);
    try {
      const treGiorniFa = new Date();
      treGiorniFa.setDate(treGiorniFa.getDate() - 3);
      
      let articoliQuery = supabase
        .from('rss_articles')
        .select(`
          *,
          rss_feeds!inner(url, categoria_id, logo_url, card_target)
        `)
        .gte('pub_date', treGiorniFa.toISOString())
        .order('pub_date', { ascending: false })
        .limit(1000);
      
      if (userCategorieIds.length > 0) {
        articoliQuery = articoliQuery.or(
          `categoria_id.is.null,categoria_id.in.(${userCategorieIds.join(',')})`,
          { foreignTable: 'rss_feeds' }
        );
      } else if (formulaECategoryId) {
        articoliQuery = articoliQuery.neq('rss_feeds.categoria_id', formulaECategoryId);
      }
      
      const { data, error } = await articoliQuery;
      
      if (!error && data) {
        const articoliConMeta = data.map(articolo => ({
          ...articolo,
          feedSource: articolo.rss_feeds?.url ? new URL(articolo.rss_feeds.url).hostname : 'RSS',
          feedLogo: normalizeLogoUrl(articolo.rss_feeds?.logo_url) || null,
          contentSnippet: articolo.description ? articolo.description.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : ''
        }));
        setArticoli(articoliConMeta);
        lastArticoliFetchRef.current = Date.now();
      } else {
        console.error('❌ Errore caricamento articoli:', error);
      }
    } catch (error) {
      const isAbort = error?.name === 'AbortError' || String(error?.message || '').includes('AbortError');
      if (isAbort) {
        if (!articoliReloadTimeoutRef.current) {
          articoliReloadTimeoutRef.current = setTimeout(() => {
            articoliReloadTimeoutRef.current = null;
            caricaArticoliDalDatabase();
          }, 1500);
        }
      } else {
        console.error('❌ Errore caricamento articoli:', error);
      }
    } finally {
      articoliFetchInFlightRef.current = false;
      setIsLoadingArticoli(false);
      if (pendingArticoliReloadRef.current) {
        pendingArticoliReloadRef.current = false;
        if (!articoliReloadTimeoutRef.current) {
          articoliReloadTimeoutRef.current = setTimeout(() => {
            articoliReloadTimeoutRef.current = null;
            caricaArticoliDalDatabase();
          }, minIntervalMs);
        }
      }
    }
  }

  function parseRSSItem(item, feedId) {
    try {
      const pubDateText = item.querySelector('pubDate')?.textContent || '';
      let pubDate = pubDateText ? new Date(pubDateText).toISOString() : null;
      const title = item.querySelector('title')?.textContent || '';
      if (!title) return null;

      if (!pubDate) {
        let relativeText = '';
        relativeText = item.querySelector('description')?.textContent || '';
        const relMatch = relativeText.match(/(\d+\s+(minuto|minuti|ora|ore|giorno|giorni|settimana|settimane|mese|mesi|anno|anni|hour|hours|minute|minutes|day|days|week|weeks|month|months|year|years)[a-z]*\s+(fa|ago))/i);
        if (relMatch) {
          const now = new Date();
          const relDate = parseRelativeDate(relMatch[0], now);
          if (relDate) {
            pubDate = relDate.toISOString();
          } else {
            pubDate = now.toISOString();
          }
        } else {
          pubDate = new Date().toISOString();
        }
      }

      return {
        title: decodeHtmlEntities(title.replace(/<[^>]*>/g, '').trim()),
        link: item.querySelector('link')?.textContent || '',
        description: decodeHtmlEntities(
          item.querySelector('description')?.textContent || 
          item.querySelector('content\\:encoded')?.textContent || 
          item.querySelector('summary')?.textContent || 
          ''
        ),
        pub_date: pubDate,
        guid: item.querySelector('guid')?.textContent || '',
        author: item.querySelector('author')?.textContent || '',
        feedId: feedId
      };
    } catch (error) {
      return null;
    }
  }

  async function parseRSS(xmlText) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) throw new Error('XML parsing error');
      const items = [];
      const rssItems = xmlDoc.querySelectorAll('item');
      if (rssItems.length > 0) {
        rssItems.forEach(item => {
          try {
            const pubDateText = item.querySelector('pubDate')?.textContent || '';
            const pubDate = pubDateText ? new Date(pubDateText).toISOString() : new Date().toISOString();
            const title = item.querySelector('title')?.textContent || '';
            if (!title) return;
            items.push({
              title: decodeHtmlEntities(title.replace(/<[^>]*>/g, '').trim()),
              link: item.querySelector('link')?.textContent || '',
              description: decodeHtmlEntities(item.querySelector('description')?.textContent || ''),
              pub_date: pubDate,
              guid: item.querySelector('guid')?.textContent || '',
              author: item.querySelector('author')?.textContent || ''
            });
          } catch (itemError) {
            console.error('❌ Errore parsing item:', itemError);
          }
        });
      } else {
        const atomEntries = xmlDoc.querySelectorAll('entry');
        if (atomEntries.length > 0) {
          atomEntries.forEach(entry => {
            try {
              const pubDateText = entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent || '';
              const pubDate = pubDateText ? new Date(pubDateText).toISOString() : new Date().toISOString();
              const title = entry.querySelector('title')?.textContent || '';
              if (!title) return;
              items.push({
                title: decodeHtmlEntities(title.replace(/<[^>]*>/g, '').trim()),
                link: entry.querySelector('link')?.getAttribute('href') || '',
                description: decodeHtmlEntities(entry.querySelector('summary')?.textContent || entry.querySelector('content')?.textContent || ''),
                pubDate: pubDate,
                guid: entry.querySelector('id')?.textContent || '',
                author: entry.querySelector('author name')?.textContent || ''
              });
            } catch (entryError) {
              console.error('❌ Errore parsing entry:', entryError);
            }
          });
        }
      }
      if (items.length > 0) return items;
      throw new Error('No items found with DOMParser');
    } catch (err) {
      try {
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(xmlText);
        let items = [];
        if (parsed.rss && parsed.rss.channel) {
          const channel = parsed.rss.channel;
          const rawItems = Array.isArray(channel.item) ? channel.item : [channel.item];
          items = rawItems.filter(Boolean).map(item => ({
            title: decodeHtmlEntities(item.title || ''),
            link: item.link || '',
            description: decodeHtmlEntities(item.description || ''),
            pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            guid: item.guid || '',
            author: item.author || ''
          })).filter(i => i.title);
        } else if (parsed.feed && parsed.feed.entry) {
          const entries = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
          items = entries.filter(Boolean).map(entry => ({
            title: decodeHtmlEntities(entry.title || ''),
            link: (entry.link && entry.link['@_href']) || '',
            description: decodeHtmlEntities(entry.summary || entry.content || ''),
            pubDate: entry.published ? new Date(entry.published).toISOString() : (entry.updated ? new Date(entry.updated).toISOString() : new Date().toISOString()),
            guid: entry.id || '',
            author: (entry.author && entry.author.name) || ''
          })).filter(i => i.title);
        }
        return items;
      } catch (fallbackErr) {
        throw new Error('XML parsing error (DOMParser e fast-xml-parser falliti): ' + fallbackErr.message);
      }
    }
  }

  async function controllaNuoviArticoli() {
    try {
      if (isSyncingFeedsRef.current || loadingFeeds) return;
      setLoadingFeeds(true);
      
      let feedsQuery = supabase.from("rss_feeds").select("*");
      
      if (userCategorieIds.length > 0) {
        feedsQuery = feedsQuery.or(`categoria_id.is.null,categoria_id.in.(${userCategorieIds.join(',')})`);
      } else if (formulaECategoryId) {
        feedsQuery = feedsQuery.neq('categoria_id', formulaECategoryId);
      }
      
      const { data: feedsData, error: feedsError } = await feedsQuery;
      if (feedsError) {
        console.error('❌ Errore caricamento feed:', feedsError);
        return;
      }
      
      if (feedsData && feedsData.length > 0) {
        await estraiArticoliDaFeeds(feedsData);
      }
      
      let articoliQuery = supabase
        .from('rss_articles')
        .select(`
          *,
          rss_feeds!inner(url, categoria_id, logo_url, card_target)
        `)
        .order('pub_date', { ascending: false })
        .limit(1000);
      
      if (userCategorieIds.length > 0) {
        articoliQuery = articoliQuery.or(
          `categoria_id.is.null,categoria_id.in.(${userCategorieIds.join(',')})`,
          { foreignTable: 'rss_feeds' }
        );
      } else if (formulaECategoryId) {
        articoliQuery = articoliQuery.neq('rss_feeds.categoria_id', formulaECategoryId);
      }
      
      const { data, error } = await articoliQuery;
      
      if (!error && data) {
        const articoliConMeta = data.map(articolo => ({
          ...articolo,
          feedSource: articolo.rss_feeds?.url ? new URL(articolo.rss_feeds.url).hostname : 'RSS',
          feedLogo: normalizeLogoUrl(articolo.rss_feeds?.logo_url) || null,
          contentSnippet: articolo.description ? articolo.description.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : ''
        }));
        setArticoli(articoliConMeta);
      }
    } catch (error) {
      console.error('❌ Errore controllaNuoviArticoli:', error);
    } finally {
      setLoadingFeeds(false);
    }
  }

  async function caricaFeedEDArticoli(username) {
    setLoading(true);
    
    const { data: gruppiUtente } = await supabase
      .from('gruppi_redattori')
      .select('categoria_id')
      .eq('username', username);
    
    const categorieIds = gruppiUtente && gruppiUtente.length > 0 
      ? gruppiUtente.map(g => g.categoria_id).filter(Boolean) 
      : [];
    
    setUserCategorieIds(categorieIds);

    try {
      const { data: feCategorie } = await supabase
        .from('categorie_weekend')
        .select('id,nome')
        .ilike('nome', '%formula e%')
        .limit(1);
      if (feCategorie && feCategorie.length > 0) {
        setFormulaECategoryId(feCategorie[0].id);
      }
    } catch (error) {
      // nessuna azione
    }
    
    let feedsQuery = supabase.from("rss_feeds").select("*");
    
    if (categorieIds.length > 0) {
      feedsQuery = feedsQuery.or(`categoria_id.is.null,categoria_id.in.(${categorieIds.join(',')})`);
    } else if (formulaECategoryId) {
      feedsQuery = feedsQuery.neq('categoria_id', formulaECategoryId);
    }
    
    const { data: feedsData, error: feedsError } = await feedsQuery;
    
    if (feedsError) {
      console.error('❌ Errore caricamento feed:', feedsError);
      setLoading(false);
      return;
    }
    
    setFeeds(feedsData || []);
    
    await caricaArticoliDalDatabase();
    setLoading(false);
  }

  async function estraiArticoliDaFeeds(feeds) {
    if (isSyncingFeedsRef.current) return;
    isSyncingFeedsRef.current = true;
    setLoadingFeeds(true);

    try {
      for (const feed of feeds) {
        try {
          const isBBC = feed.url === BBC_FEED_URL;
          let response = null;
          let xmlText = '';
          let articoliDelFeed = [];
          let proxyUsato = 'interno';
          const feedUrl = `/api/rss-proxy?url=${encodeURIComponent(feed.url)}`;

          try {
            response = await fetch(feedUrl);
          } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
              console.warn(`[FETCH] AbortError su feed interno: ${feed.url}`);
              continue;
            } else {
              console.error(`[FETCH] Errore fetch interno:`, fetchErr);
            }
          }
          
          if (!response || !response.ok) {
            proxyUsato = 'rss2json';
            const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
            try {
              response = await fetch(rss2jsonUrl);
            } catch (fallbackErr) {
              if (fallbackErr.name === 'AbortError') {
                console.warn(`[FETCH] AbortError su rss2json: ${feed.url}`);
                continue;
              } else {
                console.error(`[FETCH] Errore fetch rss2json:`, fallbackErr);
              }
            }
          }
          
          if (!response || !response.ok) {
            proxyUsato = 'feed2json';
            const feed2jsonUrl = `https://feed2json.org/v1/feed.json?url=${encodeURIComponent(feed.url)}`;
            try {
              response = await fetch(feed2jsonUrl);
            } catch (fallbackErr2) {
              if (fallbackErr2.name === 'AbortError') {
                console.warn(`[FETCH] AbortError su feed2json: ${feed.url}`);
                continue;
              } else {
                console.error(`[FETCH] Errore fetch feed2json:`, fallbackErr2);
              }
            }
          }
          
          if (!response || !response.ok) {
            const errMsg = `[FETCH] Tutti i proxy falliti per feed ${feed.url}`;
            console.error(errMsg);
            if (isBBC) alert(`Feed BBC non raggiungibile da nessun proxy pubblico. Prova da un'altra rete o segnala al supporto.`);
            continue;
          }
          
          try {
            if (proxyUsato !== 'interno') {
              const json = await response.json();
              if (!json.items || !Array.isArray(json.items)) throw new Error('Proxy pubblico: items non trovati');
              xmlText = '';
              articoliDelFeed = json.items.map(item => ({
                title: item.title || '',
                link: item.link || '',
                description: item.description || '',
                pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : (item.date_published ? new Date(item.date_published).toISOString() : new Date().toISOString()),
                guid: item.guid || item.id || '',
                author: item.author || (item.authors && item.authors[0]?.name) || '',
                _proxy: proxyUsato
              })).filter(i => i.title);
            } else {
              xmlText = await response.text();
              articoliDelFeed = (await parseRSS(xmlText)).map(a => ({ ...a, _proxy: 'interno' }));
            }
          } catch (textErr) {
            console.error('❌ Errore parsing:', textErr);
            if (isBBC) alert(`Errore nel parsing/lettura risposta per feed BBC: ${textErr.message}`);
            continue;
          }
          
          if (articoliDelFeed.length === 0) {
            console.warn(`[FETCH] Nessun articolo trovato nel feed ${feed.url}`);
            if (isBBC) alert(`Feed BBC: nessun articolo trovato`);
          }
          
          const batchSize = 20;
          for (let i = 0; i < articoliDelFeed.length; i += batchSize) {
            const batch = articoliDelFeed.slice(i, i + batchSize);
            await salvaArticoliBatch(batch, feed);
            await new Promise(resolve => setTimeout(resolve, 120));
          }
        } catch (error) {
          if (feed.url === BBC_FEED_URL) {
            console.error('❌ Errore feed BBC:', error);
          } else {
            console.error('❌ Errore feed:', error);
          }
        }
      }
      
      await puliziaArticoliVecchi();
      await caricaArticoliDalDatabase();
    } finally {
      setLoadingFeeds(false);
      isSyncingFeedsRef.current = false;
    }
  }

  async function salvaArticoliBatch(articoliBatch, feed) {
    try {
      const treGiorniFa = new Date();
      treGiorniFa.setDate(treGiorniFa.getDate() - 3);

      const payload = articoliBatch.map(articolo => {
        const pubDate = articolo.pub_date || articolo.pubDate || new Date().toISOString();
        
        const titoloDecodificato = decodeHtmlEntities(articolo.title || '');
        const descrizioneDecodificata = decodeHtmlEntities(articolo.description || '');
        const contentDecodificato = decodeHtmlEntities(articolo.content || '');
        
        return {
          feed_id: feed.id,
          title: titoloDecodificato,
          link: articolo.link,
          description: descrizioneDecodificata,
          content: contentDecodificato,
          pub_date: pubDate,
          guid: articolo.guid || articolo.link,
          author: articolo.author || null
        };
      }).filter(a => new Date(a.pub_date) > treGiorniFa);

      if (payload.length === 0) return;

      let nuoviArticoli = [];
      try {
        const guids = payload.map(p => p.guid);
        const { data: existing, error: existingError } = await supabase
          .from('rss_articles')
          .select('guid')
          .eq('feed_id', feed.id)
          .in('guid', guids);

        if (!existingError) {
          const existingSet = new Set((existing || []).map(row => row.guid));
          nuoviArticoli = payload.filter(p => !existingSet.has(p.guid));
        }
      } catch (error) {
        nuoviArticoli = [];
      }

      const { error } = await supabase
        .from('rss_articles')
        .upsert(payload, { onConflict: 'guid,feed_id' });

      if (error) {
        console.error('❌ Errore upsert batch:', error);
      } else if (nuoviArticoli.length > 0) {
        await inviaNotificheFiltrate(nuoviArticoli, feed);
      }
    } catch (error) {
      console.error('❌ Errore batch salvataggio articoli:', error);
    }
  }

  async function puliziaArticoliVecchi() {
    try {
      const dieciGiorniFa = new Date();
      dieciGiorniFa.setDate(dieciGiorniFa.getDate() - 10);
      
      const { error } = await supabase
        .from('rss_articles')
        .delete()
        .lt('pub_date', dieciGiorniFa.toISOString());
      
      if (error) {
        console.error('Errore pulizia articoli vecchi:', error);
      }
    } catch (error) {
      console.error('Errore durante pulizia:', error);
    }
  }

  async function prenotaArticolo(articolo) {
    if (isActionLoading) return;
    setIsActionLoading(true);
    let attempt = 0;
    while (attempt < 2) {
      try {
        const { error } = await supabase
          .from('prenotazioni_articoli')
          .insert({
            articolo_id: articolo.id,
            username: username,
            stato: 'prenotato'
          });
        if (error && typeof error === 'object' && Object.keys(error).length > 0) {
          const isAbort = String(error.message || '').includes('AbortError');
          if (isAbort && attempt < 1) {
            attempt += 1;
            await sleep(1200);
            continue;
          }
          let msg = error.message || error.details || error.code || '';
          if (!msg) {
            try { msg = JSON.stringify(error); } catch { msg = String(error); }
          }
          console.error('❌ Errore prenotazione:', error);
          alert("Errore durante la prenotazione dell'articolo: " + msg);
        } else {
          await caricaPrenotazioni(username);
          await caricaArticoliDalDatabase();
        }
        break;
      } catch (error) {
        const isAbort = error?.name === 'AbortError' || String(error?.message || '').includes('AbortError');
        if (isAbort && attempt < 1) {
          attempt += 1;
          await sleep(1200);
          continue;
        }
        if (isAbort) {
          console.error('❌ Prenotazione annullata dall\'utente o timeout (AbortError)');
          alert('Prenotazione annullata: richiesta interrotta o timeout.');
        } else {
          let msg = error.message || error.details || error.code || '';
          if (!msg) {
            try { msg = JSON.stringify(error); } catch { msg = String(error); }
          }
          console.error('❌ Errore prenotazione CATCH:', error);
          alert("Errore durante la prenotazione dell'articolo: " + msg);
        }
        break;
      }
    }
    setIsActionLoading(false);
  }

  async function pubblicaArticolo(prenotazione) {
    if (isActionLoading) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase
        .from('prenotazioni_articoli')
        .update({ stato: 'pubblicato' })
        .eq('id', prenotazione.id);
      if (!error) {
        await caricaPrenotazioni(username);
        await caricaArticoliDalDatabase();
      } else {
        console.error('❌ Errore pubblicazione:', error);
        alert("Errore durante la pubblicazione dell'articolo: " + (error.message || JSON.stringify(error)));
      }
    } catch (error) {
      console.error('❌ Errore pubblicazione:', error);
      alert("Errore durante la pubblicazione dell'articolo: " + (error.message || error));
    } finally {
      setIsActionLoading(false);
    }
  }

  async function annullaPrenotazione(prenotazione) {
    if (isActionLoading) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase
        .from('prenotazioni_articoli')
        .delete()
        .eq('id', prenotazione.id);
      if (error) {
        console.error('Errore annullamento prenotazione:', error);
        alert("Errore durante l'annullamento della prenotazione: " + (error.message || JSON.stringify(error)));
      } else {
        await caricaPrenotazioni(username);
        await caricaArticoliDalDatabase();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ Annullamento prenotazione interrotto (AbortError)');
        alert('Annullamento prenotazione annullato: richiesta interrotta o timeout.');
      } else {
        console.error('Errore annullamento prenotazione:', error);
        alert("Errore durante l'annullamento della prenotazione: " + (error.message || error));
      }
    } finally {
      setIsActionLoading(false);
    }
  }

  function getStatoArticolo(articoloId) {
    const prenotazione = prenotazioni.find(p => p.articolo_id === articoloId);
    if (!prenotazione) return 'vuoto';
    return prenotazione.stato;
  }

  function getStatoColore(stato) {
    switch (stato) {
      case 'vuoto': return '#ccc';
      case 'prenotato': return '#ffc107';
      case 'pubblicato': return '#28a745';
      case 'annullato': return '#dc3545';
      default: return '#ccc';
    }
  }

  function formatDate(dateString) {
    if (!dateString || dateString === null || dateString === undefined) {
      return "Data non disponibile";
    }
    if (dateString === "") {
      return "Data non disponibile";
    }
    
    try {
      let date;
      if (dateString instanceof Date) {
        date = dateString;
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return "Data non valida";
      }
      
      const formatted = date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return formatted;
      
    } catch (error) {
      console.error('❌ Errore formattazione data:', error, 'Data originale:', dateString);
      return "Data non valida";
    }
  }

  return (
    <div style={{ 
      background: '#f5f5f5', 
      minHeight: '100vh', 
      width: '100vw', 
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @media (max-width: 700px) {
            .pf-header-right {
              width: 100%;
              justify-content: flex-start;
              flex-wrap: wrap;
            }
            .pf-tabs {
              flex-wrap: wrap;
              width: 100%;
            }
            .pf-tab-btn {
              flex: 1 1 0;
              min-width: 0;
              text-align: center;
              justify-content: center;
            }
            .pf-feed-count {
              width: 100%;
            }
            .pf-update-btn {
              width: 100%;
            }
          }
        `}
      </style>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '15px 20px',
        background: 'white',
        borderBottom: '1px solid #ddd',
        gap: '18px',
        flexWrap: 'wrap',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer' }}>←</button>
          <h1 style={{ fontSize: '22px', color: '#333', fontWeight: 700, whiteSpace: 'nowrap' }}>Pannello Prenotazioni Articoli</h1>
        </div>
        <div className="pf-header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="pf-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {[
              { id: 'f1', label: 'Formula 1' },
              ...(hasFormulaEAccess ? [{ id: 'fe', label: 'Formula E' }] : []),
              { id: 'other', label: 'Altre Formule' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="pf-tab-btn"
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: activeTab === tab.id ? '1px solid #007AFF' : '1px solid #ccc',
                  background: activeTab === tab.id ? '#E6F0FF' : '#fff',
                  color: '#333',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="pf-feed-count" style={{ fontSize: '16px', color: '#333', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {feeds.length === 0 ? 'Nessun feed RSS configurato' : `${feeds.length} feed RSS configurati`}
          </span>
          <button 
            className="pf-update-btn"
            onClick={() => controllaNuoviArticoli()} 
            disabled={loading || loadingFeeds}
            style={{ 
              padding: '8px 16px', 
              background: '#007AFF', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: loading || loadingFeeds ? 'not-allowed' : 'pointer',
              opacity: loading || loadingFeeds ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            {loadingFeeds ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #fff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Aggiornamento...
              </>
            ) : (
              <>
                <span>🔄</span>
                Aggiorna feed
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra ricerca */}
      <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            placeholder="Cerca per parola chiave o testata..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => {
              setFiltriTab('keyword');
              setShowFiltriModal(true);
            }}
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              background: '#f7f7f7',
              fontSize: '14px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <img
              src="/logo_filtro.png"
              alt="Filtri"
              style={{
                width: '18px',
                height: '18px',
                display: 'block',
                filter: 'drop-shadow(0 0 0.4px rgba(0,0,0,0.6))'
              }}
            />
          </button>
          {/* Tasti sempre visibili, layout mobile responsive */}
          {/* Bottoni Test Filtri e Debug Log rimossi */}
              {/* CSS responsive: su mobile i tasti sono uno sotto l'altro, su desktop inline */}
              <style>{`
                .test-debug-btns-responsive {
                  display: flex;
                  gap: 0;
                  margin-top: 10px;
                }
                @media (max-width: 700px) {
                  .test-debug-btns-responsive {
                    flex-direction: column;
                    align-items: stretch;
                  }
                  .test-debug-btns-responsive .test-filtri-btn {
                    margin-right: 0;
                    margin-bottom: 8px;
                    width: 100%;
                  }
                  .test-debug-btns-responsive .debug-log-btn {
                    width: 100%;
                  }
                }
              `}</style>
        </div>
      </div>

      {/* Modal filtri */}
      {showFiltriModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#fff',
              borderRadius: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              overflow: 'hidden'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 16px',
              borderBottom: '1px solid #eee',
              position: 'relative'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 700, textAlign: 'center' }}>Filtri notifiche</div>
              <button
                onClick={() => {
                  setShowFiltriModal(false);
                  setIsClosingFiltri(true);
                  setTimeout(() => setIsClosingFiltri(false), 120);
                }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setFiltriTab('keyword')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: filtriTab === 'keyword' ? '1px solid #007AFF' : '1px solid #ccc',
                  background: filtriTab === 'keyword' ? '#E6F0FF' : '#fff',
                  color: '#333',
                  fontSize: '13px',
                  fontWeight: filtriTab === 'keyword' ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                KEYWORD
              </button>
              <button
                onClick={() => setFiltriTab('feed')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: filtriTab === 'feed' ? '1px solid #007AFF' : '1px solid #ccc',
                  background: filtriTab === 'feed' ? '#E6F0FF' : '#fff',
                  color: '#333',
                  fontSize: '13px',
                  fontWeight: filtriTab === 'feed' ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                FEED
              </button>
            </div>
            <div style={{ padding: '16px', color: '#444', fontSize: '14px' }}>
              {filtriTab === 'keyword' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    Ricevi notifiche quando un articolo contiene una delle parole chiave.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={nuovaKeyword}
                      onChange={(e) => setNuovaKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          aggiungiKeyword(nuovaKeyword);
                        }
                      }}
                      placeholder="Aggiungi keyword..."
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                    <button
                      onClick={() => aggiungiKeyword(nuovaKeyword)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #007AFF',
                        background: '#007AFF',
                        color: '#fff',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Aggiungi
                    </button>
                  </div>
                  {keywordFilters.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#888' }}>
                      Nessuna keyword impostata.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {keywordFilters.map((k) => (
                        <span key={k} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          background: '#F2F4F7',
                          borderRadius: '999px',
                          fontSize: '12px'
                        }}>
                          {k}
                          <button
                            onClick={() => rimuoviKeyword(k)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontSize: '14px',
                              lineHeight: 1
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    Seleziona i feed da monitorare per ricevere notifiche.
                  </div>
                  {feeds.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#888' }}>
                      Nessun feed disponibile.
                    </div>
                  ) : (
                    <div style={{
                      maxHeight: '320px',
                      overflowY: 'auto',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      padding: '12px'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: '12px'
                      }}>
                        {feeds.filter(feed => !!feed.logo_url).map(feed => {
                          let label = feed.name || '';
                          if (!label) {
                            try {
                              label = new URL(feed.url).hostname;
                            } catch {
                              label = feed.url || 'RSS';
                            }
                          }
                          const checked = feedFilters.includes(feed.id);
                          return (
                            <button
                              key={feed.id}
                              onClick={() => toggleFeedFilter(feed.id)}
                              type="button"
                              style={{
                                border: checked ? '2px solid #007AFF' : '1px solid #e6e6e6',
                                background: '#fff',
                                borderRadius: '10px',
                                padding: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                minHeight: '120px'
                              }}
                              aria-pressed={checked}
                              title={label}
                            >
                              <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '8px',
                                background: '#f6f6f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                              }}>
                                <img
                                  src={normalizeLogoUrl(feed.logo_url)}
                                  alt={label}
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    const localFallback = getLocalLogoFallback(img.src);
                                    if (!img.dataset.fallbackTried && localFallback && img.src !== localFallback) {
                                      img.dataset.fallbackTried = 'local';
                                      img.src = localFallback;
                                      return;
                                    }
                                    img.onerror = null;
                                    img.src = '/logo_filtro.png';
                                  }}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain'
                                  }}
                                />
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#555',
                                textAlign: 'center',
                                lineHeight: 1.2
                              }}>
                                {label}
                              </div>
                              <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '999px',
                                border: checked ? '4px solid #007AFF' : '1px solid #bbb',
                                background: checked ? '#007AFF' : 'transparent'
                              }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <div style={{ fontSize: '12px', color: '#777' }}>
                {isLoadingFiltri
                  ? 'Caricamento filtri...'
                  : `${keywordFilters.length + feedFilters.length} filtri attivi`}
              </div>
              <button
                onClick={salvaFiltriNotifiche}
                disabled={isSavingFiltri || isLoadingFiltri}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #007AFF',
                  background: isSavingFiltri ? '#9CC1FF' : '#007AFF',
                  color: '#fff',
                  fontSize: '13px',
                  cursor: isSavingFiltri ? 'default' : 'pointer'
                }}
              >
                {isSavingFiltri ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Debug Log */}
      {showDebugLogs && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              background: '#fff',
              borderRadius: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 16px',
              borderBottom: '1px solid #eee',
              position: 'relative'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 700, textAlign: 'center' }}>
                🔍 Debug Log Notifiche RSS (ultimi 100)
              </div>
              <button
                onClick={() => setShowDebugLogs(false)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {debugLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Nessun log trovato. I log vengono creati quando arrivano nuovi articoli RSS.
                  <br/><br/>
                  <strong>Prova a cliccare "🔄 Aggiorna feed" e poi riapri il Debug Log!</strong>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {debugLogs.map((log, index) => (
                    <div
                      key={log.id || index}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: log.risultato === 'NOTIFICA_INVIATA' ? '2px solid #28a745' : 
                               log.risultato === 'DUPLICATO' ? '2px solid #ffc107' : '1px solid #ddd',
                        background: log.risultato === 'NOTIFICA_INVIATA' ? '#d4edda' : 
                                   log.risultato === 'DUPLICATO' ? '#fff3cd' : '#f9f9f9'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: log.risultato === 'NOTIFICA_INVIATA' ? '#155724' : 
                                log.risultato === 'DUPLICATO' ? '#856404' : '#666',
                          fontSize: '14px'
                        }}>
                          {log.risultato === 'NOTIFICA_INVIATA' ? '✅ NOTIFICA INVIATA' : 
                           log.risultato === 'DUPLICATO' ? '⚠️ DUPLICATO' : '❌ NESSUNA NOTIFICA'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#888' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          }) : 'N/A'}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '13px', marginBottom: '8px', wordBreak: 'break-word' }}>
                        <strong>Titolo:</strong> {log.titolo_decodificato || log.titolo_raw}
                      </div>
                      
                      <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                        <strong>Feed:</strong> {log.feed_name || log.feed_url}
                      </div>
                      
                      <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                        <strong>Caso:</strong> {log.caso || 'N/A'}
                      </div>
                      
                      <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>
                        <strong>Motivo:</strong> {log.motivo}
                      </div>
                      
                      {log.keyword_match && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#155724',
                          background: '#c3e6cb',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          marginBottom: '8px',
                          display: 'inline-block'
                        }}>
                          🎯 Keyword match: <strong>{log.keyword_match}</strong>
                        </div>
                      )}
                      
                      {log.test_keyword_dettaglio && log.test_keyword_dettaglio.length > 0 && (
                        <details style={{ marginTop: '8px', fontSize: '11px', background: '#fff', padding: '8px', borderRadius: '4px' }}>
                          <summary style={{ cursor: 'pointer', color: '#007AFF', fontWeight: 'bold' }}>
                            🔬 Test Keyword Dettagliato ({log.test_keyword_dettaglio.length} keyword testate)
                          </summary>
                          <div style={{ marginTop: '8px' }}>
                            {log.test_keyword_dettaglio.map((test, idx) => (
                              <div key={idx} style={{
                                padding: '6px',
                                background: test.regex_match ? '#d4edda' : '#f8d7da',
                                border: test.regex_match ? '1px solid #28a745' : '1px solid #dc3545',
                                borderRadius: '4px',
                                marginBottom: '6px'
                              }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                  Keyword: "{test.keyword}"
                                </div>
                                <div>Regex: {test.regex_pattern}</div>
                                <div>Regex Match: {test.regex_match ? '✅ SÌ' : '❌ NO'}</div>
                                <div>Includes Match: {test.includes_match ? '✅ SÌ' : '❌ NO'}</div>
                                <div>{test.titolo_contiene}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      
                      <details style={{ marginTop: '8px', fontSize: '11px' }}>
                        <summary style={{ cursor: 'pointer', color: '#007AFF' }}>
                          📋 Mostra dettagli completi
                        </summary>
                        <div style={{ marginTop: '8px', background: '#fff', padding: '8px', borderRadius: '4px' }}>
                          <div><strong>Titolo RAW:</strong> {log.titolo_raw}</div>
                          <div><strong>Titolo Decodificato:</strong> {log.titolo_decodificato}</div>
                          <div><strong>Titolo Lowercase:</strong> {log.titolo_lowercase}</div>
                          <div><strong>Keywords attive:</strong> {JSON.stringify(log.keywords_attive)}</div>
                          <div><strong>Feed selezionati:</strong> {JSON.stringify(log.feed_selezionati)}</div>
                          <div><strong>Feed is selected:</strong> {String(log.feed_is_selected)}</div>
                          <div><strong>Username:</strong> {log.username}</div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #eee',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowDebugLogs(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #007AFF',
                  background: '#007AFF',
                  color: '#fff',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista articoli */}
      <div style={{ 
        flex: 1, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {feeds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', marginBottom: '10px' }}>Nessun feed RSS configurato</h3>
            <p style={{ color: '#999' }}>Vai in Gestione → Gestisci RSS per aggiungere i feed</p>
          </div>
        ) : articoli.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', marginBottom: '10px' }}>Nessun articolo trovato</h3>
            <p style={{ color: '#999' }}>I feed RSS non contengono articoli o c'è stato un errore nel parsing</p>
          </div>
        ) : (showFiltriModal || isClosingFiltri) ? (
          <div style={{ flex: 1 }} />
        ) : (
          <div style={{ 
            overflowY: 'auto', 
            padding: '0 20px',
            height: '100%'
          }}>
            {articoliFiltrati
              .map((articolo, index) => {
                const origine = getOrigineArticolo(articolo);
                const stato = getStatoArticolo(articolo.id);
                const coloreStato = getStatoColore(stato);
                const prenotazioneCorrente = prenotazioniMap.get(articolo.id);

                return (
                <div key={index} style={{ 
                  background: stato === 'vuoto' ? '#fff' : 
                           stato === 'prenotato' ? '#fff3cd' : 
                           stato === 'pubblicato' ? '#d4edda' : '#f8d7da',
                  padding: '15px', 
                  borderRadius: '8px', 
                  marginBottom: '10px',
                  border: stato === 'vuoto' ? '1px solid #eee' : 
                           stato === 'prenotato' ? '2px solid #ffc107' : 
                           stato === 'pubblicato' ? '2px solid #28a745' : '2px solid #dc3545',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a 
                      href={articolo.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#007AFF', textDecoration: 'none', marginLeft: '3px' }}
                    >
                      {decodeHtmlEntities(articolo.title) || 'Senza titolo'}
                    </a>
                    {articolo._proxy && articolo._proxy !== 'interno' && (
                      <span style={{
                        background: articolo._proxy === 'rss2json' ? '#007AFF' : '#28a745',
                        color: '#fff',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        verticalAlign: 'middle'
                      }}>
                        PROXY {articolo._proxy.toUpperCase()}
                      </span>
                    )}
                  </h4>
                  <p style={{ margin: '8px 0', color: '#333', fontSize: '14px', lineHeight: '1.5' }}>
                    {articolo.contentSnippet ? decodeHtmlEntities(articolo.contentSnippet) : 'Nessuna descrizione'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#333', fontWeight: '700' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Fonte: {articolo.feedSource || 'RSS'} - {formatDate(articolo.pub_date)}</span>
                      {articolo.feedLogo && (
                        <img 
                          src={articolo.feedLogo} 
                          alt="Logo" 
                          onError={(e) => {
                            const img = e.currentTarget;
                            const localFallback = getLocalLogoFallback(img.src);
                            if (!img.dataset.fallbackTried && localFallback && img.src !== localFallback) {
                              img.dataset.fallbackTried = 'local';
                              img.src = localFallback;
                              return;
                            }
                            img.onerror = null;
                            img.src = '/logo_filtro.png';
                          }}
                          style={{ 
                            width: '40px', 
                            height: '40px', 
                            objectFit: 'contain',
                            borderRadius: '6px'
                          }} 
                        />
                      )}
                    </div>
                  </div>
                  {prenotazioneCorrente && (
                    <div style={{ fontSize: '14px', color: '#333', marginTop: '8px', fontWeight: 'bold' }}>
                      Prenotato da: {prenotazioneCorrente.username}
                    </div>
                  )}
                  <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                    {stato === 'vuoto' && (
                      <button 
                        onClick={() => prenotaArticolo(articolo)}
                        disabled={isActionLoading}
                        style={{
                          padding: '6px 12px',
                          background: '#ffc107',
                          color: '#000',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isActionLoading ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          opacity: isActionLoading ? 0.6 : 1
                        }}
                      >
                        PRENOTA
                      </button>
                    )}
                    {stato === 'prenotato' && prenotazioneCorrente?.username === username && (
                      <>
                        <button 
                          onClick={() => pubblicaArticolo(prenotazioneCorrente)}
                          disabled={isActionLoading}
                          style={{
                            padding: '6px 12px',
                            background: '#28a745',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isActionLoading ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            opacity: isActionLoading ? 0.6 : 1
                          }}
                        >
                          PUBBLICA
                        </button>
                        <button 
                          onClick={() => annullaPrenotazione(prenotazioneCorrente)}
                          disabled={isActionLoading}
                          style={{
                            padding: '6px 12px',
                            background: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isActionLoading ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            opacity: isActionLoading ? 0.6 : 1
                          }}
                        >
                          ANNULLA
                        </button>
                      </>
                    )}
                    {stato === 'pubblicato' && (
                      <span style={{ 
                        padding: '6px 12px',
                        background: '#28a745',
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        pointerEvents: 'none',
                        opacity: 1
                      }}>
                        PUBBLICATO
                      </span>
                    )}
                    {stato === 'annullato' && (
                      <span style={{ 
                        padding: '6px 12px',
                        background: '#dc3545',
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        pointerEvents: 'none',
                        opacity: 1
                      }}>
                        ANNULLATO
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PannelloFonti;
// Funzione per decodificare entità HTML (es: &#124; &amp; ecc.)
function decodeHtmlEntities(str) {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}
import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import { analyzeSource, getSourceLabel } from "./utils/sourceAnalyzer";
import { XMLParser } from "fast-xml-parser";
import { inserisciNotificaPush } from "./pushNotificationService";

function PannelloFonti({ onClose }) {
  // Funzione per calcolare la data/orario assoluti da stringhe tipo "6 ore fa"
  function parseRelativeDate(text, now = new Date()) {
    if (!text) return null;
    // Supporta sia italiano che inglese ("6 ore fa" o "6 hours ago")
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
        // Costante globale per il feed BBC F1
        const BBC_FEED_URL = 'https://feeds.bbci.co.uk/sport/formula1/rss.xml';
      // Funzione per confrontare il testo con altri articoli
      function trovaArticoloDuplicato(articolo, tuttiArticoli) {
        // Prendi solo parole significative (minimo 5 caratteri)
        const parole = `${articolo.title} ${articolo.description} ${articolo.content || ''}`.toLowerCase().split(/\W+/).filter(w => w.length >= 5);
        // Confronta con altri articoli
        for (const altro of tuttiArticoli) {
          if (altro.id === articolo.id || altro.feedSource === articolo.feedSource) continue; // Salta se stesso o stessa fonte
          const testoAltro = `${altro.title} ${altro.description} ${altro.content || ''}`.toLowerCase();
          // Conta quante parole significative sono presenti anche nell'altro articolo
          let count = 0;
          for (const parola of parole) {
            if (testoAltro.includes(parola)) count++;
          }
          // Se almeno 10 parole significative coincidono, considera duplicato
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
  // Carica i feed all'avvio - SOLO UNA VOLTA
  useEffect(() => {
    
    const currentUsername = sessionStorage.getItem('username') || '';
    if (currentUsername) {
      // NON chiamare controllaNuoviArticoli() qui - troppo lento!
      // Carica solo articoli esistenti dal database
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

  // Funzione migliorata per analizzare se l'articolo è esclusiva o ripreso (usa sourceAnalyzer)
    async function analizzaArticolo(articolo) {
      
      
      // Carica TUTTI gli articoli RSS dal database per avere dati completi
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
      // Analizza la fonte dell'articolo usando TUTTI gli articoli dal database
      const analysis = analyzeSource(articolo, articolo.feedSource, tuttiArticoli);
      // ...log analisi articolo rimosso...
      return {
        tipo: analysis.isOriginal ? 'esclusiva' : 'ripresa',
        fonte: analysis.attributedSources.length > 0 ? analysis.attributedSources.join(', ') : null,
        analysis: analysis
      };
    }

    // Funzione per ottenere l'analisi (con cache)
    function getOrigineArticolo(articolo) {
      // Se non abbiamo l'analisi in cache, restituisci un placeholder
      if (!analisiArticoli[articolo.id]) {
        // Calcola l'analisi in background
        analizzaArticolo(articolo).then(result => {
          setAnalisiArticoli(prev => ({
            ...prev,
            [articolo.id]: result
          }));
        });
  // PATCH: rimosso caricaArticoliDalDatabase();
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
  const [analisiArticoli, setAnalisiArticoli] = useState({}); // Cache per le analisi
  const [isLoadingArticoli, setIsLoadingArticoli] = useState(false); // Evita chiamate concorrenti
  const [isActionLoading, setIsActionLoading] = useState(false); // Blocca azioni utente durante operazioni
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
  const [userCategorieIds, setUserCategorieIds] = useState([]); // IDs delle categorie dell'utente
  const [formulaECategoryId, setFormulaECategoryId] = useState(null);
  const [activeTab, setActiveTab] = useState('f1');
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

  function articoloMatchaFiltri(articolo, feed) {
    if (keywordFiltersLower.length === 0 && feedFiltersSet.size === 0) return false;
    const feedMatch = feedFiltersSet.has(String(feed?.id));
    if (feedMatch) return true;
    if (keywordFiltersLower.length === 0) return false;
    const titolo = (articolo.title || '').toLowerCase();
    return keywordFiltersLower.some(k => titolo.includes(k));
  }

  async function inviaNotificheFiltrate(nuoviArticoli, feed) {
    if (!username) return;
    if (keywordFiltersLower.length === 0 && feedFiltersSet.size === 0) return;

    let host = 'RSS';
    try {
      host = feed?.url ? new URL(feed.url).hostname : 'RSS';
    } catch {
      host = 'RSS';
    }

    // Deduplica notifiche: una sola notifica per utente/articolo anche se matcha più filtri
    const notificheInviate = new Set();

    for (const articolo of nuoviArticoli) {
      if (!articoloMatchaFiltri(articolo, feed)) continue;
      // Chiave deduplica: guid + username
      const guid = articolo.guid || articolo.id || articolo.link || '';
      const dedupKey = `${guid}::${username}`;
      if (notificheInviate.has(dedupKey)) continue;
      notificheInviate.add(dedupKey);
      const titolo = (articolo.title || '').trim() || 'Nuovo articolo RSS';
      await inserisciNotificaPush({
        title: titolo,
        body: `Fonte: ${host}`,
        notification_type: 'rss_filter',
        target_all: false,
        target_users: [username],
        data: {
          link: articolo.link || null,
          feed_id: feed?.id || null,
          guid: guid
        }
      });
  }

  useEffect(() => {
    if (showFiltriModal && username) {
      caricaFiltriNotifiche(username);
    }
  }, [showFiltriModal, username]);

  useEffect(() => {
    // Recupera username dalla sessione
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

    // --- PATCH: Polling globale anti-duplicazione ---
    // Usa una variabile globale per evitare timer multipli anche con hot reload
    if (window.__PANNELLO_FONTI_POLLING_ACTIVE) {
      
    } else {
      window.__PANNELLO_FONTI_POLLING_ACTIVE = true;
      window.__PANNELLO_FONTI_POLLING_INTERVAL = null;
      if (savedUsername) {
        window.__PANNELLO_FONTI_POLLING_INTERVAL = setInterval(() => {
          if (!isLoadingArticoli) {
            controllaNuoviArticoli();
          }
        }, 3 * 60 * 1000); // 3 minuti in millisecondi
      }
    }

    // Realtime listener per aggiornamenti immediati
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

    // Cleanup del timer e listener quando il componente viene smontato
    return () => {
      isMounted = false;
      // Solo se esiste il polling globale, lo cancello e resetto il flag
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

  // Funzione aggiornata: carica articoli dalla buffer, sposta solo i nuovi nella tabella definitiva
  async function caricaArticoliDalDatabase() {
        // Dopo aver spostato i nuovi articoli, pianifica la pulizia della buffer tra 2 minuti
        setTimeout(async () => {
          try {
            await supabase.from('rss_articles_buffer').delete().neq('id', ''); // Elimina tutto
            
          } catch (err) {
            
          }
        }, 2 * 60 * 1000); // 2 minuti
    try {
      // FILTRA PER ULTIMI 3 GIORNI
      const treGiorniFa = new Date();
      treGiorniFa.setDate(treGiorniFa.getDate() - 3);
      
      // 1. Prendi tutti gli articoli dalla buffer
      // Filtra anche per categoria: mostra solo articoli dai feed con categoria_id NULL o nelle categorie dell'utente
      let bufferQuery = supabase
        .from('rss_articles_buffer')
        .select(`*, rss_feeds!inner(url, categoria_id, logo_url, card_target)`)
        .gte('pub_date', treGiorniFa.toISOString())
        .order('pub_date', { ascending: false })
        .limit(1000);
      
      // Applica filtro categoria sui feed
      // Se l'utente non ha categorie, mostra tutte le categorie
      if (userCategorieIds.length > 0) {
        bufferQuery = bufferQuery.or(
          `categoria_id.is.null,categoria_id.in.(${userCategorieIds.join(',')})`,
          { foreignTable: 'rss_feeds' }
        );
      } else if (formulaECategoryId) {
        bufferQuery = bufferQuery.neq('rss_feeds.categoria_id', formulaECategoryId);
      }
      
      const { data: bufferData, error: bufferError } = await bufferQuery;
      
      if (bufferError) {
        
        return;
      }
      if (!bufferData || bufferData.length === 0) {
        setArticoli([]);
        return;
      }
      // 2. Per ogni articolo in buffer, controlla se esiste già nella tabella definitiva
      const nuoviArticoli = [];
      for (const articolo of bufferData) {
        const { data: esiste, error: errCheck } = await supabase
          .from('rss_articles')
          .select('id')
          .eq('guid', articolo.guid)
          .eq('feed_id', articolo.feed_id)
          .maybeSingle();
        if (errCheck) {
          
          continue;
        }
        if (!esiste) {
          // Non esiste: va mostrato e spostato nella tabella definitiva
          nuoviArticoli.push(articolo);
          // Inserisci nella tabella definitiva
          await supabase.from('rss_articles').insert({
            feed_id: articolo.feed_id,
            title: articolo.title,
            link: articolo.link,
            description: articolo.description,
            content: articolo.content,
            pub_date: articolo.pub_date,
            guid: articolo.guid,
            author: articolo.author
          });
        }
        // In ogni caso, rimuovi dalla buffer
        await supabase.from('rss_articles_buffer').delete().eq('id', articolo.id);
      }
      // 3. Mostra solo i nuovi articoli
      const articoliConMeta = nuoviArticoli.map(articolo => ({
        ...articolo,
        feedSource: articolo.rss_feeds?.url ? new URL(articolo.rss_feeds.url).hostname : 'RSS',
        feedLogo: articolo.rss_feeds?.logo_url || null,
        contentSnippet: articolo.description ? articolo.description.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : ''
      }));
      setArticoli(articoliConMeta);
    } catch (error) {
      
    }
  }

  // Parser per singolo item RSS
  function parseRSSItem(item, feedId) {
    try {
      const pubDateText = item.querySelector('pubDate')?.textContent || '';
      let pubDate = pubDateText ? new Date(pubDateText).toISOString() : null;
      const title = item.querySelector('title')?.textContent || '';
      if (!title) return null; // Salta articoli senza titolo

      // Se non c'è pubDate, prova a ricavare la data relativa da formula1.com
      if (!pubDate) {
        // Cerca testo tipo "6 ore fa" in description o altrove
        let relativeText = '';
        // Prova in description
        relativeText = item.querySelector('description')?.textContent || '';
        // Se non c'è, prova in content:encoded o altrove (aggiungi qui se serve)
        // Cerca pattern "6 ore fa" o "6 hours ago"
        const relMatch = relativeText.match(/(\d+\s+(minuto|minuti|ora|ore|giorno|giorni|settimana|settimane|mese|mesi|anno|anni|hour|hours|minute|minutes|day|days|week|weeks|month|months|year|years)[a-z]*\s+(fa|ago))/i);
        if (relMatch) {
          const now = new Date();
          const relDate = parseRelativeDate(relMatch[0], now);
          if (relDate) {
            pubDate = relDate.toISOString();
          } else {
            // Pattern trovato ma non parsabile, fallback a ora attuale
            pubDate = now.toISOString();
          }
        } else {
          // Nessun pattern trovato, fallback a ora attuale
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

  // Parser RSS con fallback: prima DOMParser, poi fast-xml-parser se fallisce
  async function parseRSS(xmlText) {
    // Primo tentativo: DOMParser (browser)
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
              
            }
          });
        }
      }
      if (items.length > 0) return items;
      // Se non trova nulla, passa al fallback
      throw new Error('No items found with DOMParser');
    } catch (err) {
      // Fallback: fast-xml-parser (più tollerante)
      try {
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(xmlText);
        let items = [];
        // RSS 2.0
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
          // Atom
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

  // Funzione per caricare articoli dal database (fuori da parseRSS)
  async function caricaArticoliDalDatabase() {
    if (isLoadingArticoli) return;
    setIsLoadingArticoli(true);
    try {
      
      // FILTRA PER ULTIMI 3 GIORNI
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
      
      // Applica filtro categoria
      // Se l'utente non ha categorie, mostra tutte le categorie
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
      } else {
        
      }
    } catch (error) {
      
    } finally {
      setIsLoadingArticoli(false);
    }
  }

  async function controllaNuoviArticoli() {
    try {
      if (isSyncingFeedsRef.current || loadingFeeds) return;
      setLoadingFeeds(true);
      
      // Prima scarica nuovi articoli dai feed
      // Filtra i feed per categoria
      let feedsQuery = supabase.from("rss_feeds").select("*");
      
      if (userCategorieIds.length > 0) {
        feedsQuery = feedsQuery.or(`categoria_id.is.null,categoria_id.in.(${userCategorieIds.join(',')})`);
      } else if (formulaECategoryId) {
        feedsQuery = feedsQuery.neq('categoria_id', formulaECategoryId);
      }
      
      const { data: feedsData, error: feedsError } = await feedsQuery;
      if (feedsError) {
        
        return;
      }
      
      // ...log polling feed rimosso...
      
      if (feedsData && feedsData.length > 0) {
        await estraiArticoliDaFeeds(feedsData);
      } else {
        
      }
      
      // Poi carica tutti gli articoli dal database (inclusi quelli nuovi)
      // MOSTRA TUTTI - senza filtro 3 giorni per vedere tutti i feed
      let articoliQuery = supabase
        .from('rss_articles')
        .select(`
          *,
          rss_feeds!inner(url, categoria_id, logo_url, card_target)
        `)
        .order('pub_date', { ascending: false })
        .limit(1000); // Aumentato limite per vedere più articoli
      
      // Applica filtro categoria
      // Se l'utente non ha categorie, mostra tutte le categorie
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
        // ...log polling articoli rimosso...
        const articoliConMeta = data.map(articolo => ({
          ...articolo,
          feedSource: articolo.rss_feeds?.url ? new URL(articolo.rss_feeds.url).hostname : 'RSS',
          feedLogo: normalizeLogoUrl(articolo.rss_feeds?.logo_url) || null,
          contentSnippet: articolo.description ? articolo.description.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : ''
        }));
        setArticoli(articoliConMeta);
      } else {
        
      }
    } catch (error) {
      
    } finally {
      setLoadingFeeds(false);
      
    }
  }

  async function caricaFeedEDArticoli(username) {
    setLoading(true);
    
    // 1. Carica le categorie dell'utente
    const { data: gruppiUtente } = await supabase
      .from('gruppi_redattori')
      .select('categoria_id')
      .eq('username', username);
    
    const categorieIds = gruppiUtente && gruppiUtente.length > 0 
      ? gruppiUtente.map(g => g.categoria_id).filter(Boolean) 
      : [];
    
    console.log('🔍 [caricaFeedEDArticoli] Username:', username, 'Categorie:', categorieIds);
    
    setUserCategorieIds(categorieIds);

    // 1b. Recupera categoria Formula E (per restrizioni visibilità)
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
      // nessuna azione: fallback senza restrizione
    }
    
    // 2. Carica i feed RSS dal database
    // Filtra: se l'utente ha categorie, mostra solo feed con categoria_id NULL o matching
    // Se non ha categorie, mostra tutte le categorie
    let feedsQuery = supabase.from("rss_feeds").select("*");
    
    if (categorieIds.length > 0) {
      // Utente ha categorie: mostra feed con categoria_id NULL o nelle sue categorie
      feedsQuery = feedsQuery.or(`categoria_id.is.null,categoria_id.in.(${categorieIds.join(',')})`);
    } else if (formulaECategoryId) {
      // Utente senza categorie: mostra tutte le categorie tranne Formula E
      feedsQuery = feedsQuery.neq('categoria_id', formulaECategoryId);
    }
    
    const { data: feedsData, error: feedsError } = await feedsQuery;
    
    console.log('🔍 [caricaFeedEDArticoli] Feed caricati:', feedsData?.length, 'Errore:', feedsError);
    
    if (feedsError) {
      
      setLoading(false);
      return;
    }
    
    setFeeds(feedsData || []);
    
    // Carica articoli dal database
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
          // Se fallisce o response non ok, prova rss2json
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
          // Se ancora fallisce, prova feed2json.org
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
          // Se ancora fallisce, mostra errore e salta
          if (!response || !response.ok) {
            const errMsg = `[FETCH] Tutti i proxy falliti per feed ${feed.url}`;
            console.error(errMsg);
            if (isBBC) alert(`Feed BBC non raggiungibile da nessun proxy pubblico. Prova da un'altra rete o segnala al supporto.`);
            continue;
          }
          // Parsing risposta
          try {
            if (proxyUsato !== 'interno') {
              // Se stai usando un proxy pubblico, estrai gli articoli dal JSON
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
            
            if (isBBC) alert(`Errore nel parsing/lettura risposta per feed BBC: ${textErr.message}`);
            continue;
          }
          if (articoliDelFeed.length === 0) {
            const warnMsg = `[FETCH] Nessun articolo trovato nel feed ${feed.url}`;
            
            if (isBBC) alert(`Feed BBC: nessun articolo trovato`);
          }
          // Batch upsert articoli per non saturare risorse
          const batchSize = 20;
          for (let i = 0; i < articoliDelFeed.length; i += batchSize) {
            const batch = articoliDelFeed.slice(i, i + batchSize);
            await salvaArticoliBatch(batch, feed);
            await new Promise(resolve => setTimeout(resolve, 120));
          }
          // NIENTE popup: badge visivo sugli articoli (vedi rendering)
        } catch (error) {
          if (feed.url === BBC_FEED_URL) {
            
          } else {
            
          }
        }
      }
      // Pulizia articoli vecchi (più di 10 giorni)
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
        return {
          feed_id: feed.id,
          title: articolo.title,
          link: articolo.link,
          description: articolo.description,
          content: articolo.content,
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

  async function salvaArticolo(articolo) {
    try {
      // ...log salvataggio articolo rimosso...
      
      // Controlla se l'articolo esiste già
      const { data: esistente, error: checkError } = await supabase
        .from('rss_articles')
        .select('id')
        .eq('guid', articolo.guid || articolo.link)
        .eq('feed_id', articolo.feedId)
        .maybeSingle();

      if (checkError) {
        
        return;
      }

      // ...log articolo esistente rimosso...

      if (esistente) {
        // Aggiorna solo se l'articolo è più recente di 3 giorni
        const treGiorniFa = new Date();
        treGiorniFa.setDate(treGiorniFa.getDate() - 3);
        
        if (new Date(articolo.pub_date) > treGiorniFa) {
          // ...log aggiornamento articolo rimosso...
          const { error: updateError } = await supabase
            .from('rss_articles')
            .update({
              title: articolo.title,
              description: articolo.description,
              content: articolo.content,
              pub_date: articolo.pub_date, // Già in formato ISO dal parser
              updated_at: new Date().toISOString()
            })
            .eq('id', esistente.id);
          
          if (updateError) {
            console.error('❌ Errore aggiornamento:', updateError);
          } else {
            // ...log articolo aggiornato rimosso...
          }
        } else {
          // ...log articolo troppo vecchio rimosso...
        }
      } else {
        // Inserisce nuovo articolo con upsert per gestire duplicati
        // ...log inserimento nuovo articolo rimosso...
        const { error: insertError } = await supabase
          .from('rss_articles')
          .upsert({
            feed_id: articolo.feedId,
            title: articolo.title,
            link: articolo.link,
            description: articolo.description,
            content: articolo.content,
            pub_date: articolo.pub_date, // Già in formato ISO dal parser
            guid: articolo.guid || articolo.link,
            author: articolo.author
          }, {
            onConflict: 'guid,feed_id' // Gestisce conflitti su guid+feed_id
          });
        
        if (insertError) {
          console.error('❌ Errore inserimento:', insertError);
        } else {
          // ...log articolo inserito/aggiornato rimosso...
        }
      }
    } catch (error) {
      console.error('❌ Errore generico salvataggio articolo:', error);
    }
  }

  async function puliziaArticoliVecchi() {
    try {
      // Cancella articoli più vecchi di 10 giorni
      const dieciGiorniFa = new Date();
      dieciGiorniFa.setDate(dieciGiorniFa.getDate() - 10);
      
      const { error } = await supabase
        .from('rss_articles')
        .delete()
        .lt('pub_date', dieciGiorniFa.toISOString());
      
      if (error) {
        console.error('Errore pulizia articoli vecchi:', error);
      } else {
        // ...log pulizia completata rimosso...
      }
    } catch (error) {
      console.error('Errore durante pulizia:', error);
    }
  }

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
      // FILTRA PER ULTIMI 3 GIORNI
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
      
      // Applica filtro categoria
      // Se l'utente non ha categorie, mostra tutte le categorie
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
          console.error('❌ Prenotazione annullata dall’utente o timeout (AbortError)');
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
    // ...log chiamata formatDate rimosso...
    
    if (!dateString || dateString === null || dateString === undefined) {
      // ...log data null rimosso...
      return "Data non disponibile";
    }
    if (dateString === "") {
      // ...log data stringa vuota rimosso...
      return "Data non disponibile";
    }
    
    try {
      // Se è già un oggetto Date, usalo direttamente
      let date;
      if (dateString instanceof Date) {
        date = dateString;
      } else {
        date = new Date(dateString);
      }
      
      // ...log oggetto data creato rimosso...
      
      // Controlla se la data è valida
      if (isNaN(date.getTime())) {
        // ...log data non valida rimosso...
        return "Data non valida";
      }
      
      const formatted = date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // ...log data formattata rimosso...
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
      {/* Header: titolo, back, feed info */}
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

      {/* Barra di ricerca */}
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
        </div>
      </div>

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

      {/* Articoli a tutta pagina */}
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
                // ...log rendering articolo rimosso...
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
                    {/* Badge proxy pubblico se presente */}
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
                    {/* I bottoni sono sempre visibili, solo disabilitati durante azioni */}
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

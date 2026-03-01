
import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import { DateTime } from 'luxon';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: true
});

// Funzione per decodificare entità HTML
function decodeHtmlEntities(str) {
  if (!str) return '';
  
  // Decodifica entità numeriche
  let decoded = str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Decodifica entità named
  const entities = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—',
    '&lsquo;': '\u2018', '&rsquo;': '\u2019',
    '&ldquo;': '\u201C', '&rdquo;': '\u201D',
    '&hellip;': '…', '&euro;': '€', '&pound;': '£',
    '&copy;': '©', '&reg;': '®', '&trade;': '™'
  };
  
  Object.keys(entities).forEach(entity => {
    decoded = decoded.replace(new RegExp(entity, 'g'), entities[entity]);
  });
  
  return decoded;
}

// Funzione per salvare log su database
async function aggiungiDebugLog(logData) {
  try {
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
  }
}

function normalizeText(value) {
  return (value || '').toLowerCase();
}

function normalizeItemValue(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value['#text'] || value.__cdata || value.cdata || '';
  }
  return '';
}

function buildGuid(item) {
  const guid = normalizeItemValue(item.guid);
  if (guid) return guid;
  const link = normalizeItemValue(item.link);
  if (link) return link;
  const title = normalizeItemValue(item.title);
  const pubDate = normalizeItemValue(item.pubDate) || normalizeItemValue(item.published) || '';
  return `${title}|${pubDate}`.trim();
}

function parseItems(feedXml) {
  const data = parser.parse(feedXml);
  const channel = data?.rss?.channel || data?.feed || {};
  const items = channel?.item || channel?.entry || [];
  return Array.isArray(items) ? items : [items].filter(Boolean);
}


function getPubDate(item) {
  const pubDateRaw = normalizeItemValue(item.pubDate) ||
    normalizeItemValue(item.published) ||
    normalizeItemValue(item.updated) || '';
  if (!pubDateRaw) return null;
  // Parsing con luxon, forzando Europe/Rome
  let dt = DateTime.fromISO(pubDateRaw, { zone: 'utc' });
  if (!dt.isValid) {
    dt = DateTime.fromRFC2822(pubDateRaw, { zone: 'utc' });
  }
  if (!dt.isValid) {
    dt = DateTime.fromJSDate(new Date(pubDateRaw), { zone: 'utc' });
  }
  if (!dt.isValid) return null;
  // Converto in Europe/Rome
  return dt.setZone('Europe/Rome');
}

export default async function handler(req, res) {
  const start = Date.now();
  try {

    // Usa luxon per ora locale Europe/Rome
    const now = DateTime.now().setZone('Europe/Rome');
    const twoHoursAgo = now.minus({ hours: 2 });
    console.log(`[RSS CRON] Avvio. Ora: ${now.toISO()} - Filtro articoli dopo: ${twoHoursAgo.toISO()}`);

    const { data: feeds, error: feedsError } = await supabase
      .from('rss_feeds')
      .select('id, url')
      .order('created_at', { ascending: false });

    if (feedsError) throw feedsError;
    if (!feeds || feeds.length === 0) {
      return res.status(200).json({ success: true, sent: 0, durationMs: Date.now() - start });
    }

    const articles = [];
    for (const feed of feeds) {
      if (!feed.url) continue;
      try {
        console.log(`[RSS CRON] Fetch feed: ${feed.url}`);
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (RSS Cron)'
          }
        });
        if (!response.ok) {
          console.log(`[RSS CRON] Feed non ok: ${feed.url} - Status: ${response.status}`);
          continue;
        }
        const xml = await response.text();
        const items = parseItems(xml).slice(0, 30);
        console.log(`[RSS CRON] Feed ${feed.url} - Articoli trovati: ${items.length}`);
        let countNuovi = 0, countFiltrati = 0, countUpsertOk = 0, countUpsertErr = 0;
        for (const item of items) {
          const pubDate = getPubDate(item);
          let pubDateToUse = pubDate;
          if (!pubDate) {
            pubDateToUse = now;
            console.warn(`[RSS CRON] Articolo guid=${item.guid || item.link || 'NO_GUID'} senza pub_date: uso data corrente (${now.toISO()})`);
          }
          // Filtro: solo articoli pubblicati nelle ultime 2 ore (Europe/Rome)
          if (pubDateToUse && pubDateToUse < twoHoursAgo) {
            countFiltrati++;
            continue;
          }
          const guid = buildGuid(item);
          if (!guid) {
            console.log('[RSS CRON] Articolo senza guid, saltato');
            continue;
          }
          const articleObj = {
            feed_id: feed.id,
            guid,
            title: normalizeItemValue(item.title) || 'Nuovo articolo RSS',
            description: normalizeItemValue(item.description) || normalizeItemValue(item.summary) || '',
            content: normalizeItemValue(item['content:encoded']) || normalizeItemValue(item.content) || '',
            link: normalizeItemValue(item.link) || null,
            pub_date: pubDateToUse.toUTC().toISO(),
            created_at: pubDateToUse.toUTC().toISO()
          };
          articles.push(articleObj);
          countNuovi++;
          // Inserisci l'articolo in rss_articles se non esiste già
          try {
            const upsertRes = await supabase
              .from('rss_articles')
              .upsert([articleObj], { onConflict: ['guid'] });
            if (upsertRes.error) {
              countUpsertErr++;
              console.error(`[RSS CRON] Errore upsert guid=${guid}:`, upsertRes.error);
            } else {
              countUpsertOk++;
            }
          } catch (err) {
            countUpsertErr++;
            console.error(`[RSS CRON] Errore upsert guid=${guid} (catch):`, err);
          }
        }
        console.log(`[RSS CRON] Feed ${feed.url} - Nuovi: ${countNuovi}, Filtrati: ${countFiltrati}, Upsert OK: ${countUpsertOk}, Upsert ERR: ${countUpsertErr}`);
      } catch (err) {
        console.error(`[RSS CRON] Errore fetch/parsing feed: ${feed.url}`, err);
        continue;
      }
    }

    if (!articles || articles.length === 0) {
      return res.status(200).json({ success: true, sent: 0, durationMs: Date.now() - start });
    }

    const { data: filters, error: filtersError } = await supabase
      .from('rss_notification_filters')
      .select('username, filter_type, value');

    if (filtersError) throw filtersError;
    if (!filters || filters.length === 0) {
      return res.status(200).json({ success: true, sent: 0, durationMs: Date.now() - start });
    }

    const filtersByUser = new Map();
    for (const row of filters) {
      if (!filtersByUser.has(row.username)) {
        filtersByUser.set(row.username, { keywords: [], feedIds: new Set() });
      }
      const entry = filtersByUser.get(row.username);
      if (row.filter_type === 'keyword') {
        const keyword = (row.value || '').trim();
        if (keyword) entry.keywords.push(keyword.toLowerCase());
      }
      if (row.filter_type === 'feed') {
        const feedId = String(row.value);
        if (feedId) entry.feedIds.add(feedId);
      }
    }

    let sent = 0;
    let skipped = 0;
    
    for (const [username, userFilters] of filtersByUser.entries()) {
      if (userFilters.keywords.length === 0 && userFilters.feedIds.size === 0) continue;

      for (const article of articles) {
        const guid = article.guid || article.link || String(article.id);
        if (!guid) continue;

        // Decodifica titolo
        const titoloRaw = (article.title || '').trim() || 'Nuovo articolo RSS';
        const titoloDecodificato = decodeHtmlEntities(titoloRaw);
        const titoloLower = titoloDecodificato.toLowerCase();

        const hasKeywords = userFilters.keywords.length > 0;
        const hasFeeds = userFilters.feedIds.size > 0;
        const feedIsSelected = userFilters.feedIds.has(String(article.feed_id));

        let shouldNotify = false;
        let motivo = '';
        let keywordMatch = null;
        let debugInfo = {
          titolo_raw: titoloRaw,
          titolo_decodificato: titoloDecodificato,
          feed_url: article.link || 'N/A',
          feed_name: String(article.feed_id),
          feed_is_selected: feedIsSelected,
          keywords_attive: userFilters.keywords,
          feed_selezionati: Array.from(userFilters.feedIds),
          username: username
        };

        // CASO 1: SOLO KEYWORD
        if (hasKeywords && !hasFeeds) {
          debugInfo.caso = 'SOLO_KEYWORD';
          
          for (const keyword of userFilters.keywords) {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regexTest = new RegExp(`\\b${escaped}\\b`, 'i');
            const match = regexTest.test(titoloLower);
            
            if (match) {
              shouldNotify = true;
              motivo = `Keyword "${keyword}" trovata (regex match)`;
              keywordMatch = keyword;
              break;
            }
          }
          
          if (!shouldNotify) {
            motivo = `Nessuna keyword trovata. Keywords cercate: ${userFilters.keywords.join(', ')}`;
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
            for (const keyword of userFilters.keywords) {
              const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regexTest = new RegExp(`\\b${escaped}\\b`, 'i');
              const match = regexTest.test(titoloLower);
              
              if (match) {
                shouldNotify = true;
                motivo = `Keyword "${keyword}" in feed non selezionato (regex match)`;
                keywordMatch = keyword;
                break;
              }
            }
            
            if (!shouldNotify) {
              motivo = `Feed non selezionato e nessuna keyword trovata. Keywords: ${userFilters.keywords.join(', ')}`;
            }
          }
        }

        if (!shouldNotify) continue;

        // FAIL-SAFE: Re-verifica keyword
        if (hasKeywords && !hasFeeds) {
          if (!keywordMatch) {
            console.error('⚠️ FAIL-SAFE TRIGGERED: shouldNotify=true ma nessuna keyword match!');
            continue;
          }
        }

        // CONTROLLO DUPLICATI in rss_notification_logs
        try {
          const { data: notificaEsistente, error: errDup } = await supabase
            .from('rss_notification_logs')
            .select('id')
            .eq('username', username)
            .eq('titolo_decodificato', titoloDecodificato)
            .eq('risultato', 'INVIATA')
            .limit(1);

          if (errDup) {
            console.error('❌ Errore controllo duplicati:', errDup);
          } else if (notificaEsistente && notificaEsistente.length > 0) {
            console.log(`⏭️ Notifica già inviata: ${titoloDecodificato} → ${username}`);
            skipped++;
            continue;
          }
        } catch (err) {
          console.error('❌ Errore controllo duplicati:', err);
        }

        // SALVA LOG PRIMA DELL'INVIO (meccanismo anti-race condition)
        await aggiungiDebugLog({
          ...debugInfo,
          risultato: 'INVIATA',
          motivo: motivo,
          keyword_match: keywordMatch
        });

        // INSERT in rss_notifications_sent
        const { error: sentError } = await supabase
          .from('rss_notifications_sent')
          .insert({ username, article_guid: guid, status: 'pending' });

        if (sentError) {
          console.error('❌ Errore insert rss_notifications_sent:', sentError);
          continue;
        }
        sent++;
      }
    }

    if (sent > 0) {
      try {
        const pushUrl = `${req.headers.host?.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/send-rss-push`;
        console.log(`📤 Chiamo send-rss-push: ${pushUrl} (${sent} notifiche)`);
        
        fetch(pushUrl, { method: 'POST' }).catch(err => {
          console.error('❌ Errore chiamata send-rss-push:', err);
        });
      } catch (err) {
        console.error('❌ Errore fetch send-rss-push:', err);
      }
    }

    // --- INIZIO LOGICA MONITORAGGIO LINK WEB ---
    let sentMonitored = 0;
    let skippedMonitored = 0;

    try {
      const { data: monitoredLinks, error: monitoredError } = await supabase
        .from('monitored_urls')
        .select('id, user_id, url, last_hash');

      if (monitoredError) throw monitoredError;

      if (monitoredLinks && monitoredLinks.length > 0) {
        for (const link of monitoredLinks) {
          try {
            if (!link.url) continue;

            const response = await fetch(link.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Monitoraggio Link Web)' }
            });

            if (!response.ok) continue;

            const html = await response.text();
            const hash = createHash('sha256').update(html).digest('hex');

            // Prima inizializzazione hash: nessuna notifica
            if (!link.last_hash) {
              await supabase.from('monitored_urls').update({ last_hash: hash }).eq('id', link.id);
              continue;
            }

            // Nessuna modifica
            if (hash === link.last_hash) {
              continue;
            }

            // Salva nuovo hash
            await supabase.from('monitored_urls').update({ last_hash: hash }).eq('id', link.id);

            // Destinatari da subscriptions (schema nuovo/legacy)
            let recipientUserIds = [];

            const subsActive = await supabase
              .from('monitored_urls_subscriptions')
              .select('user_id')
              .eq('url_id', link.id)
              .eq('active', true);

            if (!subsActive.error && Array.isArray(subsActive.data)) {
              recipientUserIds = subsActive.data.map(s => s.user_id).filter(Boolean);
            } else {
              const subsAny = await supabase
                .from('monitored_urls_subscriptions')
                .select('user_id')
                .eq('url_id', link.id);

              if (!subsAny.error && Array.isArray(subsAny.data)) {
                recipientUserIds = subsAny.data.map(s => s.user_id).filter(Boolean);
              }
            }

            // Fallback: notifica al proprietario del link
            if (recipientUserIds.length === 0 && link.user_id) {
              recipientUserIds = [link.user_id];
            }

            recipientUserIds = [...new Set(recipientUserIds)];

            for (const recipientUserId of recipientUserIds) {
              const { data: pendingExisting, error: pendingError } = await supabase
                .from('push_notifications_monitored_urls')
                .select('id')
                .eq('user_id', recipientUserId)
                .eq('url_id', link.id)
                .eq('status', 'pending')
                .limit(1);

              if (pendingError) continue;
              if (pendingExisting && pendingExisting.length > 0) {
                skippedMonitored++;
                continue;
              }

              const { error: insertError } = await supabase
                .from('push_notifications_monitored_urls')
                .insert({
                  user_id: recipientUserId,
                  url_id: link.id,
                  status: 'pending',
                  title: 'Novità sul link monitorato',
                  body: `Il link ${link.url} ha subito modifiche.`
                });

              if (!insertError) sentMonitored++;
            }
          } catch (err) {
            console.error('❌ Errore controllo singolo link monitorato:', link?.url, err);
          }
        }
      }
    } catch (err) {
      console.error('❌ Errore monitoraggio link web:', err);
    }

    if (sentMonitored > 0) {
      try {
        const host = req.headers.host || process.env.VERCEL_URL;
        const proto = req.headers['x-forwarded-proto'] || (host && host.startsWith('localhost') ? 'http' : 'https');

        if (host) {
          const pushUrlMonitored = `${proto}://${host}/api/send-push-monitored-urls`;
          console.log(`📤 Chiamo send-push-monitored-urls: ${pushUrlMonitored} (${sentMonitored} notifiche)`);

          fetch(pushUrlMonitored, { method: 'POST' }).catch(err => {
            console.error('❌ Errore chiamata send-push-monitored-urls:', err);
          });
        }
      } catch (err) {
        console.error('❌ Errore fetch send-push-monitored-urls:', err);
      }
    }
    // --- FINE LOGICA MONITORAGGIO LINK WEB ---

    res.status(200).json({ 
      success: true, 
      sent, 
      skipped,
      sent_rss: sent,
      skipped_rss: skipped,
      sent_monitored: sentMonitored,
      skipped_monitored: skippedMonitored,
      durationMs: Date.now() - start 
    });
  } catch (err) {
    console.error('❌ Errore rss-notification-cron:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
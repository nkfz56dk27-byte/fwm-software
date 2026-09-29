import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import { DateTime } from 'luxon';
import { createHash } from 'crypto';
import { waitUntil } from '@vercel/functions';

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

// Parametri di rete: nessun feed viene scartato, ogni feed viene riprovato più volte
const FEED_CONCURRENCY = 10;      // feed scaricati in parallelo
const FEED_TIMEOUT_MS = 25000;    // timeout per singolo tentativo (molto largo)
const FEED_TENTATIVI = 3;         // tentativi per feed
const LINK_TIMEOUT_MS = 20000;    // timeout per singolo tentativo sui link monitorati
const LINK_TENTATIVI = 2;
const DB_CONCURRENCY = 8;         // query Supabase in parallelo per le notifiche

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Scarica un URL e ne legge il testo. Il timeout copre SIA gli header SIA il body
// (con il fetch nativo, un body che si blocca a metà non verrebbe interrotto).
// Se fallisce o risponde con un errore temporaneo, riprova: nessun feed viene
// abbandonato al primo problema.
async function fetchTextWithRetry(url, options = {}, { tentativi = 3, timeoutMs = 25000 } = {}) {
  let ultimoErrore;
  for (let i = 1; i <= tentativi; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (response.ok) {
        return await response.text();
      }
      ultimoErrore = new Error(`HTTP ${response.status}`);
      // Errori 4xx (tranne 408/429) non si risolvono riprovando
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        throw ultimoErrore;
      }
    } catch (err) {
      ultimoErrore = err.name === 'AbortError' ? new Error(`timeout dopo ${timeoutMs}ms`) : err;
      if (ultimoErrore.message.startsWith('HTTP 4') && !ultimoErrore.message.includes('408') && !ultimoErrore.message.includes('429')) {
        throw ultimoErrore;
      }
    } finally {
      clearTimeout(timer);
    }
    console.warn(`[RSS CRON] ${url} - tentativo ${i}/${tentativi} fallito: ${ultimoErrore?.message}`);
    if (i < tentativi) await sleep(1500 * i);
  }
  throw ultimoErrore || new Error('fetch fallito');
}

// Esegue fn su ogni elemento di items con al massimo `limit` esecuzioni in parallelo
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
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

async function chiamaPush(url) {
  try {
    console.log(`📤 Chiamo ${url}`);
    await fetch(url, { method: 'POST' });
  } catch (err) {
    console.error(`❌ Errore chiamata ${url}:`, err);
  }
}

// ---------------------------------------------------------------------------
// PARTE 1: feed RSS
// ---------------------------------------------------------------------------
async function elaboraFeedRss(baseUrl) {
  const start = Date.now();

  // Usa luxon per ora locale Europe/Rome
  const now = DateTime.now().setZone('Europe/Rome');
  const twoHoursAgo = now.minus({ hours: 2 });
  console.log(`[RSS CRON] Avvio. Ora: ${now.toISO()} - Filtro articoli dopo: ${twoHoursAgo.toISO()}`);

  const { data: feeds, error: feedsError } = await supabase
    .from('rss_feeds')
    .select('id, url')
    .order('created_at', { ascending: false });

  if (feedsError) throw feedsError;
  if (!feeds || feeds.length === 0) return { sent: 0, skipped: 0 };

  const articles = [];
  await mapWithConcurrency(feeds, FEED_CONCURRENCY, async (feed) => {
    if (!feed.url) return;
    try {
      console.log(`[RSS CRON] Fetch feed: ${feed.url}`);
      const xml = await fetchTextWithRetry(
        feed.url,
        { headers: { 'User-Agent': 'Mozilla/5.0 (RSS Cron)' } },
        { tentativi: FEED_TENTATIVI, timeoutMs: FEED_TIMEOUT_MS }
      );
      const items = parseItems(xml).slice(0, 30);
      console.log(`[RSS CRON] Feed ${feed.url} - Articoli trovati: ${items.length}`);

      let countFiltrati = 0;
      const daSalvare = new Map(); // guid -> oggetto (evita duplicati nello stesso upsert)

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
        daSalvare.set(guid, articleObj);
      }

      // UN solo upsert per feed invece di uno per articolo
      let upsertEsito = 'nessun articolo da salvare';
      if (daSalvare.size > 0) {
        const { error: upsertError } = await supabase
          .from('rss_articles')
          .upsert(Array.from(daSalvare.values()), { onConflict: 'guid' });
        if (upsertError) {
          upsertEsito = 'ERRORE';
          console.error(`[RSS CRON] Errore upsert feed ${feed.url}:`, upsertError);
        } else {
          upsertEsito = `OK (${daSalvare.size})`;
        }
      }
      console.log(`[RSS CRON] Feed ${feed.url} - Nuovi: ${daSalvare.size}, Filtrati: ${countFiltrati}, Upsert: ${upsertEsito}`);
    } catch (err) {
      // Solo dopo tutti i tentativi: verrà comunque riprovato dal run successivo
      console.error(`[RSS CRON] Errore fetch/parsing feed (dopo ${FEED_TENTATIVI} tentativi): ${feed.url}`, err);
    }
  });

  if (articles.length === 0) return { sent: 0, skipped: 0 };

  const { data: filters, error: filtersError } = await supabase
    .from('rss_notification_filters')
    .select('username, filter_type, value');

  if (filtersError) throw filtersError;
  if (!filters || filters.length === 0) return { sent: 0, skipped: 0 };

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

  // FASE 1 (sincrona, nessuna query): decide chi va notificato per quale articolo
  const candidati = [];
  const chiaviReclamate = new Set(); // username + titolo: evita doppioni nello stesso run

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

      // Stesso utente + stesso titolo già visto in questo run (es. stesso articolo su due feed)
      const chiave = `${username}\u0000${titoloDecodificato}`;
      if (chiaviReclamate.has(chiave)) {
        console.log(`⏭️ Notifica già inviata: ${titoloDecodificato} → ${username}`);
        skipped++;
        continue;
      }
      chiaviReclamate.add(chiave);

      candidati.push({ username, guid, titoloDecodificato, debugInfo, motivo, keywordMatch });
    }
  }

  console.log(`[RSS CRON] Candidati da verificare: ${candidati.length}`);

  // FASE 2: controllo duplicati + salvataggio, con query Supabase IN PARALLELO
  // (prima erano una dopo l'altra: è la causa principale dei ~38 secondi)
  await mapWithConcurrency(candidati, DB_CONCURRENCY, async (c) => {
    // CONTROLLO DUPLICATI in rss_notification_logs
    try {
      const { data: notificaEsistente, error: errDup } = await supabase
        .from('rss_notification_logs')
        .select('id')
        .eq('username', c.username)
        .eq('titolo_decodificato', c.titoloDecodificato)
        .eq('risultato', 'INVIATA')
        .limit(1);

      if (errDup) {
        console.error('❌ Errore controllo duplicati:', errDup);
      } else if (notificaEsistente && notificaEsistente.length > 0) {
        console.log(`⏭️ Notifica già inviata: ${c.titoloDecodificato} → ${c.username}`);
        skipped++;
        return;
      }
    } catch (err) {
      console.error('❌ Errore controllo duplicati:', err);
    }

    // SALVA LOG PRIMA DELL'INVIO (meccanismo anti-race condition)
    await aggiungiDebugLog({
      ...c.debugInfo,
      risultato: 'INVIATA',
      motivo: c.motivo,
      keyword_match: c.keywordMatch
    });

    // INSERT in rss_notifications_sent
    const { error: sentError } = await supabase
      .from('rss_notifications_sent')
      .insert({ username: c.username, article_guid: c.guid, status: 'pending' });

    if (sentError) {
      console.error('❌ Errore insert rss_notifications_sent:', sentError);
      return;
    }
    sent++;
  });

  if (sent > 0) {
    await chiamaPush(`${baseUrl}/api/send-rss-push`);
    console.log(`📤 send-rss-push chiamato (${sent} notifiche)`);
  }

  console.log(`[RSS CRON] Fine parte RSS in ${Date.now() - start}ms - inviate: ${sent}, saltate: ${skipped}`);
  return { sent, skipped };
}

// ---------------------------------------------------------------------------
// PARTE 2: monitoraggio link web
// (separata, così gira SEMPRE: prima veniva saltata se non c'erano articoli
// recenti o filtri, per via dei return anticipati della parte RSS)
// ---------------------------------------------------------------------------
async function elaboraLinkMonitorati(baseUrl) {
  const start = Date.now();
  let sentMonitored = 0;
  let skippedMonitored = 0;
  let monitoredLinksCount = 0;
  const monitoredUrlsStatus = [];

  try {
    const { data: monitoredLinks, error: monitoredError } = await supabase
      .from('monitored_urls')
      .select('id, user_id, url, last_hash, username');

    monitoredLinksCount = monitoredLinks?.length || 0;
    console.log('[MONITORED URLS] Query result - error:', monitoredError, 'count:', monitoredLinksCount);

    if (monitoredError) throw monitoredError;

    if (monitoredLinks && monitoredLinks.length > 0) {
      await mapWithConcurrency(monitoredLinks, FEED_CONCURRENCY, async (link) => {
        try {
          if (!link.url) {
            monitoredUrlsStatus.push({ url: 'N/A', status: 'skipped_no_url' });
            return;
          }

          let html;
          try {
            html = await fetchTextWithRetry(link.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.com/',
                'Cache-Control': 'max-age=0'
              }
            }, { tentativi: LINK_TENTATIVI, timeoutMs: LINK_TIMEOUT_MS });
          } catch (fetchErr) {
            monitoredUrlsStatus.push({ url: link.url, status: `fetch_failed: ${fetchErr.message}` });
            return;
          }

          const hash = createHash('sha256').update(html).digest('hex');

          // Prima inizializzazione hash: nessuna notifica
          if (!link.last_hash) {
            monitoredUrlsStatus.push({ url: link.url, status: 'initial_hash_set' });
            await supabase.from('monitored_urls').update({ last_hash: hash }).eq('id', link.id);
            return;
          }

          // Nessuna modifica
          if (hash === link.last_hash) {
            monitoredUrlsStatus.push({ url: link.url, status: 'no_change' });
            return;
          }
          monitoredUrlsStatus.push({ url: link.url, status: 'change_detected' });

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

            // Usa l'username dalla tabella monitored_urls (salvato quando l'utente aggiunge il link)
            const recipientUsername = link.username || null;

            const { error: insertError } = await supabase
              .from('push_notifications_monitored_urls')
              .insert({
                user_id: recipientUserId,
                url_id: link.id,
                username: recipientUsername,
                status: 'pending',
                title: 'Novità sul link monitorato',
                body: `Il link ${link.url} ha subito modifiche.`
              });

            if (!insertError) sentMonitored++;
          }
        } catch (err) {
          monitoredUrlsStatus.push({ url: link?.url || 'UNKNOWN', status: `error: ${err.message}` });
          console.error('❌ Errore controllo singolo link monitorato:', link?.url, err);
        }
      });
    }
  } catch (err) {
    console.error('❌ Errore monitoraggio link web:', err);
  }

  if (sentMonitored > 0) {
    await chiamaPush(`${baseUrl}/api/send-push-monitored-urls`);
    console.log(`📤 send-push-monitored-urls chiamato (${sentMonitored} notifiche)`);
  }

  console.log(
    `[MONITORED URLS] Fine in ${Date.now() - start}ms - link: ${monitoredLinksCount}, ` +
    `notifiche: ${sentMonitored}, saltate: ${skippedMonitored}, stati: ${JSON.stringify(monitoredUrlsStatus)}`
  );
  return { sentMonitored, skippedMonitored };
}

// ---------------------------------------------------------------------------
// Orchestrazione in background
// ---------------------------------------------------------------------------
async function eseguiCron(baseUrl) {
  const start = Date.now();
  try {
    const [rss, link] = await Promise.allSettled([
      elaboraFeedRss(baseUrl),
      elaboraLinkMonitorati(baseUrl)
    ]);
    if (rss.status === 'rejected') console.error('❌ Errore parte RSS:', rss.reason);
    if (link.status === 'rejected') console.error('❌ Errore parte link monitorati:', link.reason);
    console.log(`[CRON] Completato in ${Date.now() - start}ms`);
  } catch (err) {
    console.error('❌ Errore rss-notification-cron:', err);
  }
}

export default async function handler(req, res) {
  const host = req.headers.host || process.env.VERCEL_URL;
  const proto = req.headers['x-forwarded-proto'] || (host && host.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  // Risponde subito a cron-job.org (limite ~30s) e continua il lavoro in background
  // finché Vercel lo permette (fino a 5 minuti).
  waitUntil(eseguiCron(baseUrl));

  return res.status(200).json({ success: true, started: true });
}

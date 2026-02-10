import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';

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
  const date = pubDateRaw ? new Date(pubDateRaw) : null;
  if (date && !Number.isNaN(date.getTime())) return date;
  return null;
}

export default async function handler(req, res) {
  const start = Date.now();
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    console.log(`[RSS CRON] Avvio. Ora: ${now.toISOString()} - Filtro articoli dopo: ${twoHoursAgo}`);

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
            console.warn(`[RSS CRON] Articolo guid=${item.guid || item.link || 'NO_GUID'} senza pub_date: uso data corrente (${now.toISOString()})`);
          }
          if (pubDateToUse && pubDateToUse.toISOString() < twoHoursAgo) {
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
            pub_date: pubDateToUse.toISOString(),
            created_at: pubDateToUse.toISOString()
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

        const feedMatch = userFilters.feedIds.has(String(article.feed_id));
        let keywordMatch = false;
        if (userFilters.keywords.length > 0) {
          const text = normalizeText(`${article.title || ''} ${article.description || ''} ${article.content || ''}`);
          keywordMatch = userFilters.keywords.some(k => text.includes(k));
        }
        if (!feedMatch && !keywordMatch) continue;

        // 🔧 FIX: Aggiungo controllo duplicati PRIMA dell'insert usando .maybeSingle()
        const { data: existing } = await supabase
          .from('rss_notifications_sent')
          .select('id')
          .eq('username', username)
          .eq('article_guid', guid)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

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

    res.status(200).json({ 
      success: true, 
      sent, 
      skipped,
      durationMs: Date.now() - start 
    });
  } catch (err) {
    console.error('❌ Errore rss-notification-cron:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

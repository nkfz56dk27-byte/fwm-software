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
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

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
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (RSS Cron)'
          }
        });
        if (!response.ok) continue;
        const xml = await response.text();
        const items = parseItems(xml).slice(0, 30);
        for (const item of items) {
          const pubDate = getPubDate(item);
          if (pubDate && pubDate.toISOString() < fiveMinutesAgo) continue;
          const guid = buildGuid(item);
          if (!guid) continue;
          articles.push({
            feed_id: feed.id,
            guid,
            title: normalizeItemValue(item.title) || 'Nuovo articolo RSS',
            description: normalizeItemValue(item.description) || normalizeItemValue(item.summary) || '',
            content: normalizeItemValue(item['content:encoded']) || normalizeItemValue(item.content) || '',
            link: normalizeItemValue(item.link) || null,
            created_at: pubDate ? pubDate.toISOString() : now.toISOString()
          });
        }
      } catch {
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
    for (const [username, userFilters] of filtersByUser.entries()) {
      if (userFilters.keywords.length === 0 && userFilters.feedIds.size === 0) continue;

      for (const article of articles) {
        const guid = article.guid || article.link || String(article.id);
        if (!guid) continue;

        const feedMatch = userFilters.feedIds.has(String(article.feed_id));
        let keywordMatch = false;
        if (!feedMatch && userFilters.keywords.length > 0) {
          const text = normalizeText(`${article.title || ''} ${article.description || ''} ${article.content || ''}`);
          keywordMatch = userFilters.keywords.some(k => text.includes(k));
        }

        if (!feedMatch && !keywordMatch) continue;

        const { error: sentError } = await supabase
          .from('rss_notifications_sent')
          .insert({ username, article_guid: guid });

        if (sentError) {
          continue;
        }

        const { error: notifError } = await supabase
          .from('push_notifications')
          .insert({
            title: article.title || 'Nuovo articolo RSS',
            body: 'Nuovo articolo dai tuoi filtri',
            notification_type: 'rss_filter',
            target_all: false,
            target_users: [username],
            data: {
              link: article.link || null,
              feed_id: article.feed_id,
              guid
            },
            status: 'pending',
            created_at: new Date().toISOString()
          });

        if (!notifError) {
          sent++;
        }
      }
    }

    // Dopo aver inserito le notifiche, chiamale per invio
if (sent > 0) {
  try {
    const pushUrl = `${req.headers.host.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/send-push-notifications`;
    console.log(`📤 Chiamo send-push-notifications: ${pushUrl}`);
    
    fetch(pushUrl, { method: 'POST' }).catch(err => {
      console.error('❌ Errore chiamata send-push:', err);
    });
  } catch (err) {
    console.error('❌ Errore fetch send-push:', err);
  }
}

    res.status(200).json({ success: true, sent, durationMs: Date.now() - start });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

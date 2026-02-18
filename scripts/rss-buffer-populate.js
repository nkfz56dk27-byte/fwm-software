// Script backend per popolare rss_articles_buffer automaticamente
// Esegui questo script con cron-job.org o come endpoint serverless

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchFeeds() {
  const { data: feeds, error } = await supabase
    .from('rss_feeds')
    .select('id, url');
  if (error) throw error;
  return feeds || [];
}

function parseRSSItems(xml) {
  // Minimal parser: estrai <item>...</item> blocchi
  const items = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const matches = xml.match(itemRegex) || [];
  for (const block of matches) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
    const description = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    const guid = block.match(/<guid>([\s\S]*?)<\/guid>/)?.[1] || link;
    items.push({ title, link, description, pubDate, guid });
  }
  return items;
}

async function insertBufferArticles(feedId, items) {
  if (!items.length) return;
  const articles = items.map(item => ({
    feed_id: feedId,
    title: item.title,
    link: item.link,
    description: item.description,
    pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    guid: item.guid,
    created_at: new Date().toISOString()
  }));
  const { error } = await supabase.from('rss_articles_buffer').upsert(articles, { onConflict: ['guid', 'feed_id'] });
  if (error) console.error('Errore inserimento buffer:', error);
}

async function main() {
  const feeds = await fetchFeeds();
  for (const feed of feeds) {
    if (!feed.url) continue;
    try {
      const response = await fetch(feed.url);
      const xml = await response.text();
      const items = parseRSSItems(xml);
      await insertBufferArticles(feed.id, items);
    } catch (err) {
      console.error('Errore fetch/parsing feed:', feed.url, err);
    }
  }
  console.log('Popolamento rss_articles_buffer completato.');
}

main();

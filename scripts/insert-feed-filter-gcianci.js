// Script per inserire filtro feed corretto per gcianci
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const username = 'gcianci';
const feedId = '41ef9510-af38-4a4b-bd34-82265e512357';

async function insertFeedFilter() {
  const { error } = await supabase.from('rss_notification_filters').insert({
    username,
    filter_type: 'feed',
    value: feedId
  });
  if (error && error.code !== '23505') {
    console.error('Errore inserimento filtro:', error);
  } else {
    console.log('Filtro feed inserito o già presente!');
  }
}

insertFeedFilter();

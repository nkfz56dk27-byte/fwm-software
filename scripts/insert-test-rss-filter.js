// Script per inserire un filtro RSS di test per l'utente
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const username = 'giuseppecianci'; // Cambia se serve
const feedId = '3a5daa08-b266-489a-963e-796d8ad26338'; // Usa un feed_id valido

async function insertTestFilter() {
  const { error } = await supabase.from('rss_notification_filters').insert({
    username,
    filter_type: 'feed',
    value: feedId
  });
  if (error) {
    console.error('Errore inserimento filtro:', error);
  } else {
    console.log('Filtro RSS di test inserito!');
  }
}

insertTestFilter();

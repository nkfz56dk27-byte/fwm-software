// Script di polling Supabase per Node.js
// Legge gli ultimi articoli da rss_articles ogni 3 minuti e li stampa a console
// Adatta la logica per integrarla dove ti serve (cache, API, ecc.)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'INSERISCI_LA_TUA_SUPABASE_URL'; // <-- Modifica qui
const supabaseAnonKey = 'INSERISCI_LA_TUA_ANON_KEY'; // <-- Modifica qui
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchArticoli() {
  const { data, error } = await supabase
    .from('rss_articles')
    .select('*')
    .order('pubDate', { ascending: false }) // Cambia con il campo data corretto
    .limit(20);

  if (error) {
    console.error('Errore nel recupero articoli:', error);
    return;
  }
  console.log('Articoli aggiornati:', data);
  // Qui puoi aggiornare la UI, una cache, inviare ai client, ecc.
}

// Primo caricamento
fetchArticoli();

// Polling ogni 3 minuti
setInterval(fetchArticoli, 180000);

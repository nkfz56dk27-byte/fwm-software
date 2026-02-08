// Vercel/Serverless API route for RSS proxy
export default async function handler(req, res) {
    // CORS: consenti tutte le origini
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
  // Estrai il parametro url in modo robusto
  let feedUrl = null;
  try {
    // Prova a usare la classe URL standard
    const fullUrl = new URL(req.url, `http://${req.headers.host}`);
    feedUrl = fullUrl.searchParams.get('url');
  } catch (e) {
    // fallback legacy
    feedUrl = req.query && req.query.url;
  }
  if (!feedUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Referer': 'https://www.google.com/',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    const data = await response.text();
    if (!response.ok) {
      console.error('[RSS-PROXY] Errore HTTP', response.status, 'per', feedUrl);
      res.status(response.status).json({ error: 'Errore HTTP dal feed', status: response.status, url: feedUrl });
      return;
    }
    if (!data.trim().startsWith('<?xml') && !data.trim().startsWith('<rss') && !data.trim().startsWith('<feed')) {
      console.warn('[RSS-PROXY] ATTENZIONE: risposta non XML per', feedUrl, '\nPrimi 300 caratteri:', data.slice(0, 300));
      res.status(502).json({ error: 'La risposta non è XML valido', url: feedUrl, preview: data.slice(0, 300) });
      return;
    }
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(data);
  } catch (err) {
    console.error('[RSS-PROXY] Errore fetch:', err);
    res.status(500).json({ error: 'Failed to fetch RSS', details: err.message });
  }
}
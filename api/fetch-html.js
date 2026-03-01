// Vercel/Serverless API route to fetch HTML from a URL
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let targetUrl = null;
  try {
    const fullUrl = new URL(req.url, `http://${req.headers.host}`);
    targetUrl = fullUrl.searchParams.get('url');
  } catch (e) {
    targetUrl = req.query && req.query.url;
  }

  if (!targetUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.error('[FETCH-HTML] Errore HTTP', response.status, 'per', targetUrl);
      res.status(response.status).json({ 
        error: 'Errore HTTP dal sito', 
        status: response.status, 
        url: targetUrl 
      });
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || (!contentType.includes('text/html') && !contentType.includes('application/xhtml'))) {
      console.warn('[FETCH-HTML] Content-Type non HTML:', contentType, 'per', targetUrl);
    }

    const html = await response.text();
    
    // Limita la dimensione del risposta
    const maxSize = 50000; // 50KB max
    const truncatedHtml = html.substring(0, maxSize);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ 
      html: truncatedHtml,
      originalSize: html.length,
      truncated: html.length > maxSize,
      fetched_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[FETCH-HTML] Errore fetch:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch URL', 
      details: err.message 
    });
  }
}

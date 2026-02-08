// Script Node.js per testare fetch RSS feed BBC direttamente dal server locale
import fetch from 'node-fetch';

const url = 'https://www.f1technical.net/rss/news.xml';

(async () => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Referer': 'https://www.google.com/',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    const data = await response.text();
    console.log('Status:', response.status);
    console.log('Primi 500 caratteri:', data.slice(0, 500));
  } catch (err) {
    console.error('Errore fetch:', err);
  }
})();

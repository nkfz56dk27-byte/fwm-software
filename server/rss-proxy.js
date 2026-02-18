
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/api/rss-proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });
  try {
    const response = await fetch(url);
    const data = await response.text();
    res.set('Content-Type', 'application/xml');
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch RSS', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  // ...log avvio proxy rimosso...
});

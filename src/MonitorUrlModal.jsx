import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function MonitorUrlModal({ userId, onClose }) {
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUrls();
    // eslint-disable-next-line
  }, []);

  async function fetchUrls() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('monitored_urls')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) setError('Errore caricamento link');
    else setUrls(data || []);
    setLoading(false);
  }

  async function addUrl(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!url.trim()) return setError('Inserisci un link valido');
    const { error } = await supabase
      .from('monitored_urls')
      .insert({ user_id: userId, url });
    if (error) setError('Errore salvataggio link');
    else {
      setSuccess('Link aggiunto!');
      setUrl('');
      fetchUrls();
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', padding: 40, minWidth: 420, minHeight: 300, position: 'relative', maxWidth: '90vw' }}>
        <button style={{ position: 'absolute', top: 18, right: 18, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 32, color: '#e74c3c', fontWeight: 'bold', lineHeight: 1 }} onClick={onClose} title="Chiudi">×</button>
        <h2 style={{ marginTop: 0, marginBottom: 28, fontSize: 28, textAlign: 'center', letterSpacing: 0.2 }}>Monitoraggio Link Web</h2>
        <form onSubmit={addUrl} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://sito.com" style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          <button type="submit" style={{ background: '#007AFF', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold' }}>Aggiungi</button>
        </form>
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {loading ? 'Caricamento...' : (
            urls.length === 0 ? <div>Nessun link monitorato</div> :
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              {urls.map(u => (
                <li key={u.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 15 }}>
                  <a href={u.url} target="_blank" rel="noopener noreferrer">{u.url}</a>
                  <div style={{ fontSize: 12, color: '#888' }}>Ultimo check: {u.last_checked ? new Date(u.last_checked).toLocaleString() : 'Mai'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

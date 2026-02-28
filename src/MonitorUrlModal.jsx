import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function MonitorUrlModal({ userId, onClose }) {
  const CARD_OPTIONS = [
    { id: '', label: 'Auto (titolo)' },
    { id: 'f1', label: 'Formula 1' },
    { id: 'fe', label: 'Formula E' },
    { id: 'other', label: 'Altre Formule' }
  ];

  const [cardTarget, setCardTarget] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [categoriaId, setCategoriaId] = useState('');
  const [categorie, setCategorie] = useState([]);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUrls();
    fetchCategorie();
    // eslint-disable-next-line
  }, []);

  async function fetchCategorie() {
    const { data, error } = await supabase
      .from('categorie_weekend')
      .select('id, nome, emoji')
      .order('nome', { ascending: true });
    if (!error && Array.isArray(data)) setCategorie(data);
  }

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
    if (!categoriaId) return setError('Seleziona una categoria');

    let finalLogoUrl = logoUrl;
    if (logoFile) {
      const fileName = `logo_${Date.now()}_${logoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('feed-logos')
        .upload(fileName, logoFile, { cacheControl: '3600', upsert: false });
      if (uploadError) return setError('Errore upload logo');
      const { publicUrl } = supabase.storage.from('feed-logos').getPublicUrl(fileName).data;
      finalLogoUrl = publicUrl;
    }

    const { error } = await supabase
      .from('monitored_urls')
      .insert({ user_id: userId, url, logo_url: finalLogoUrl, categoria_id: categoriaId, card_target: cardTarget });

    if (error) setError('Errore salvataggio link');
    else {
      setSuccess('Link aggiunto!');
      setUrl('');
      setLogoUrl('');
      setLogoFile(null);
      setCategoriaId('');
      setCardTarget('');
      fetchUrls();
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0] && files[0].type.startsWith('image/')) {
      setLogoFile(files[0]);
      setLogoUrl('');
    }
  }

  async function handleRemove(id) {
    setError('');
    const { error } = await supabase.from('monitored_urls').delete().eq('id', id);
    if (error) setError('Errore rimozione');
    else fetchUrls();
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', padding: 40, minWidth: 420, minHeight: 300, position: 'relative', maxWidth: '90vw' }}>
        <button
          style={{ position: 'absolute', top: 18, right: 18, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 32, color: '#e74c3c', fontWeight: 'bold', lineHeight: 1 }}
          onClick={onClose}
          title="Chiudi"
        >
          ×
        </button>

        <h2 style={{ marginTop: 0, marginBottom: 28, fontSize: 28, textAlign: 'center', letterSpacing: 0.2 }}>Monitoraggio Link Web</h2>

        <form onSubmit={addUrl} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <label style={{ fontWeight: 'bold', marginBottom: 2 }}>Link da monitorare</label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://sito.com"
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', marginBottom: 8 }}
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: isDragging ? '2px dashed #34C759' : '2px dashed #ddd',
              backgroundColor: isDragging ? '#e8f5e9' : '#fafafa',
              textAlign: 'center',
              marginBottom: '8px'
            }}
          >
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
              Trascina logo qui oppure
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="URL logo..."
                style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
              />
              <label style={{ padding: '4px 8px', background: '#34C759', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                Scegli file
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => { setLogoFile(e.target.files[0]); setLogoUrl(''); }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {logoFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#34C759', fontWeight: '600', marginBottom: '8px' }}>
              <span>✓ {logoFile.name}</span>
              <button
                type="button"
                onClick={() => setLogoFile(null)}
                style={{ background: 'none', color: '#FF3B30', border: 'none', padding: 0, cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <select
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid #ddd', fontSize: 14, flex: 1 }}
              required
            >
              <option value="">Tutte le categorie</option>
              {categorie.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.emoji ? cat.emoji + ' ' : ''}{cat.nome}</option>
              ))}
            </select>
            <select
              value={cardTarget}
              onChange={e => setCardTarget(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid #ddd', fontSize: 14, flex: 1 }}
            >
              {CARD_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <button type="submit" style={{ background: '#007AFF', color: 'white', border: 'none', borderRadius: 6, padding: '10px 0', fontWeight: 'bold', fontSize: 16, minWidth: 110 }}>
              Aggiungi
            </button>
          </div>
        </form>

        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}

        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {loading ? 'Caricamento...' : urls.length === 0 ? (
            <div>Nessun link monitorato</div>
          ) : (
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              {urls.map(u => {
                const categoria = categorie.find(c => c.id === u.categoria_id);
                const cardLabel = CARD_OPTIONS.find(opt => opt.id === u.card_target)?.label || 'Auto (titolo)';
                return (
                  <li key={u.id} style={{ marginBottom: 12, background: '#f7f7f7', borderRadius: 8, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'relative' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 2 }}>{u.url}</div>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
                      {categoria ? (categoria.emoji ? categoria.emoji + ' ' : '') + categoria.nome : 'Tutte le categorie'}
                    </div>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>Card: {cardLabel}</div>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
                      {u.logo_url ? <span>Logo impostato</span> : <span style={{ color: '#e74c3c' }}>Nessun logo</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(u.id)}
                      style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 'bold', position: 'absolute', right: 12, top: 12 }}
                    >
                      Rimuovi
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

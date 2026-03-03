import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function MonitorUrlModal({ userId, onClose }) {
  const CARD_OPTIONS = [
    { id: '', label: 'Auto (titolo)' },
    { id: 'f1', label: 'Formula 1' },
    { id: 'fe', label: 'Formula E' },
    { id: 'other', label: 'Altre Formule' }
  ];

  console.log('[MonitorUrlModal] MOUNT - userId ricevuto:', userId);

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
  const [resolvedUserId, setResolvedUserId] = useState('');

  useEffect(() => {
    fetchCategorie();
    initializeUserAndData();
    // eslint-disable-next-line
  }, [userId]);

  useEffect(() => {
    // Quando resolvedUserId cambia, ricarica gli URL
    if (resolvedUserId) {
      fetchUrls(resolvedUserId);
    }
  }, [resolvedUserId]);

  function isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  function parseStoredUserId(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id && isUuid(parsed.id)) return parsed.id;
    } catch {
      // potrebbe essere un UUID salvato come stringa semplice
    }
    return isUuid(raw) ? raw : null;
  }

  async function initializeUserAndData() {
    console.log('[MonitorUrlModal] initializeUserAndData START - userId prop:', userId);
    let effectiveUserId = null;

    // PRIORITY 1: Try supabase.auth.getUser() first (same as PannelloFonti)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && isUuid(user.id)) {
        effectiveUserId = user.id;
        console.log('[MonitorUrlModal] userId da auth.getUser():', effectiveUserId);
      }
    } catch (err) {
      console.log('[MonitorUrlModal] Errore auth.getUser():', err.message);
    }

    // PRIORITY 2: Use passed prop if valid UUID
    if (!effectiveUserId && userId && isUuid(userId)) {
      effectiveUserId = userId;
      console.log('[MonitorUrlModal] userId dal prop:', effectiveUserId);
    }

    // PRIORITY 3: Try sessionStorage
    if (!effectiveUserId) {
      try {
        effectiveUserId = parseStoredUserId(sessionStorage.getItem('user'));
        if (effectiveUserId) {
          console.log('[MonitorUrlModal] userId da sessionStorage:', effectiveUserId);
        }
      } catch (err) {
        console.log('[MonitorUrlModal] Errore lettura sessionStorage:', err.message);
      }
    }

    // PRIORITY 4: Try localStorage (mobile / sessione persistente)
    if (!effectiveUserId) {
      try {
        effectiveUserId = parseStoredUserId(localStorage.getItem('user'));
        if (effectiveUserId) {
          console.log('[MonitorUrlModal] userId da localStorage:', effectiveUserId);
        }
      } catch (err) {
        console.log('[MonitorUrlModal] Errore lettura localStorage:', err.message);
      }
    }

    if (!effectiveUserId) {
      console.error('[MonitorUrlModal] Impossibile risolvere userId - nessuna fonte valida disponibile');
      setResolvedUserId('');
      setUrls([]);
      setError('Utente non valido per monitoraggio link');
      return;
    }

    console.log('[MonitorUrlModal] userId risolto con successo:', effectiveUserId);
    setResolvedUserId(effectiveUserId);
  }

  async function fetchCategorie() {
    const { data, error } = await supabase
      .from('categorie_weekend')
      .select('*')
      .order('nome', { ascending: true });
    if (!error && Array.isArray(data)) {
      setCategorie(data);
    } else {
      setCategorie([]);
      console.error('Errore caricamento categorie_weekend:', error);
    }
  }

  async function fetchUrls(targetUserId = resolvedUserId) {
    console.log('[MonitorUrlModal] fetchUrls called with targetUserId:', targetUserId, 'resolvedUserId:', resolvedUserId);
    if (!targetUserId || !isUuid(targetUserId)) {
      console.log('[MonitorUrlModal] fetchUrls - ID non valido, setting urls to []');
      setUrls([]);
      return;
    }
    setLoading(true);
    setError('');
    console.log('[MonitorUrlModal] Eseguendo query con user_id:', targetUserId);
    const { data, error } = await supabase
      .from('monitored_urls')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[MonitorUrlModal] Errore caricamento link:', error);
      setError('Errore caricamento link');
    } else {
      console.log('[MonitorUrlModal] Risultato query - error:', error, 'data length:', data?.length, 'data:', data);
      const urlsWithNormalizedLogos = (data || []).map(item => ({
        ...item,
        logo_url: normalizeLogoUrl(item.logo_url)
      }));
      console.log('[MonitorUrlModal] Link caricati:', urlsWithNormalizedLogos);
      setUrls(urlsWithNormalizedLogos);
      
      // Aggiorna retroattivamente gli URL senza last_result
      updateMissingHtmlAsync(urlsWithNormalizedLogos);
    }
    setLoading(false);
  }

  async function updateMissingHtmlAsync(urlsList) {
    const urlsWithoutHtml = urlsList.filter(u => !u.last_result?.html);
    if (urlsWithoutHtml.length === 0) return;
    
    console.log(`[MonitorUrlModal] Aggiornamento retroattivo di ${urlsWithoutHtml.length} URL senza HTML`);
    
    for (const urlItem of urlsWithoutHtml) {
      try {
        const response = await fetch(`/api/fetch-html?url=${encodeURIComponent(urlItem.url)}`);
        if (response.ok) {
          let data;
          try {
            data = await response.json();
          } catch (jsonErr) {
            console.warn(`[MonitorUrlModal] Errore parsing JSON per ${urlItem.url}:`, jsonErr.message);
            // Se il JSON non è valido, salva un errore e continua
            const { error } = await supabase
              .from('monitored_urls')
              .update({ 
                last_result: { error: 'Invalid JSON response', details: jsonErr.message }, 
                last_checked: new Date().toISOString() 
              })
              .eq('id', urlItem.id);
            if (!error) {
              console.log(`[MonitorUrlModal] Errore registrato per ${urlItem.url}`);
            }
            continue;
          }
          
          const { error } = await supabase
            .from('monitored_urls')
            .update({ last_result: data, last_checked: new Date().toISOString() })
            .eq('id', urlItem.id);
          
          if (!error) {
            console.log(`[MonitorUrlModal] HTML aggiornato per ${urlItem.url}`);
            // Ricarica la lista
            await new Promise(r => setTimeout(r, 500));
          } else {
            console.warn(`[MonitorUrlModal] Errore aggiornamento ${urlItem.url}:`, error);
          }
        }
      } catch (err) {
        console.warn(`[MonitorUrlModal] Errore fetch per ${urlItem.url}:`, err);
      }
    }
  }

  async function uploadLogoFile(file) {
    if (!file) return null;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Il file selezionato non è un\'immagine valida.');
      return null;
    }

    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const filePath = `${fileName}`;
      const fileBody = file;
      const contentType = 'image/png';

      const { data: signedData, error: signedError } = await supabase.storage
        .from('feed-logos')
        .createSignedUploadUrl(filePath, { upsert: false });

      if (signedError) throw signedError;

      const buffer = await fileBody.arrayBuffer();
      const { error: signedUploadError } = await supabase.storage
        .from('feed-logos')
        .uploadToSignedUrl(filePath, signedData.token, buffer, {
          contentType,
          cacheControl: '3600'
        });

      if (signedUploadError) throw signedUploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('feed-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Errore upload logo:', error);
      alert('Errore durante l\'upload del logo');
      return null;
    }
  }

  function normalizeLogoUrl(url) {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (trimmed.includes('/storage/v1/object/public/')) return trimmed;
      if (trimmed.includes('/storage/v1/object/')) {
        return trimmed.replace('/storage/v1/object/', '/storage/v1/object/public/');
      }
      return trimmed;
    }

    if (trimmed.startsWith('/')) return trimmed;
    if (trimmed.startsWith('feed-logos/')) {
      const path = trimmed.replace('feed-logos/', '');
      const { data } = supabase.storage.from('feed-logos').getPublicUrl(path);
      return data?.publicUrl || null;
    }

    return `/${trimmed}`;
  }

  async function addUrl(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!url.trim()) return setError('Inserisci un link valido');
    if (!isUuid(resolvedUserId)) return setError('Utente non valido per salvataggio link');

    let logoUrlToSave = normalizeLogoUrl(logoUrl.trim()) || null;
    
    // Se c'è un file da caricare, fai upload
    if (logoFile) {
      logoUrlToSave = await uploadLogoFile(logoFile);
    }
    logoUrlToSave = normalizeLogoUrl(logoUrlToSave);

    // Fetcha il contenuto HTML della pagina
    let lastResult = null;
    try {
      const response = await fetch(`/api/fetch-html?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        lastResult = {
          html: data.html,
          fetched_at: data.fetched_at,
          originalSize: data.originalSize,
          truncated: data.truncated
        };
        console.log('[MonitorUrlModal] HTML fetchato:', { url, size: data.originalSize, truncated: data.truncated });
      } else {
        console.warn('[MonitorUrlModal] Errore fetch HTML:', response.status);
      }
    } catch (err) {
      console.warn('[MonitorUrlModal] Errore fetch contenuto:', err);
    }

    const insertData = {
      user_id: resolvedUserId,
      url,
      logo_url: logoUrlToSave,
      categoria_id: categoriaId || null,
      card_target: cardTarget || null,
      last_checked: new Date().toISOString(),
      last_result: lastResult
    };

    const { data: insertedUrl, error } = await supabase
      .from('monitored_urls')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[ERROR] Salvataggio link fallito:', JSON.stringify(error, null, 2));
      setError(`Errore salvataggio link: ${error.message}`);
    } else {
      // Crea automaticamente la subscription per ricevere notifiche
      const { error: subError } = await supabase
        .from('monitored_urls_subscriptions')
        .insert({
          url_id: insertedUrl.id,
          user_id: resolvedUserId,
          active: true
        });

      if (subError) {
        console.warn('[MonitorUrlModal] Errore creazione subscription:', subError);
      } else {
        console.log('[MonitorUrlModal] Subscription creata per', url);
      }

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
          <style>{`
            @media (max-width: 600px) {
              .monitor-url-controls {
                flex-direction: column !important;
                gap: 10px !important;
                align-items: stretch !important;
              }
              .monitor-url-controls select,
              .monitor-url-controls button {
                min-width: 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
                font-size: 16px !important;
                padding: 12px !important;
              }
            }
          `}</style>
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

          <div className="monitor-url-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <select
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid #ddd', fontSize: 14, flex: 1 }}
            >
              <option value="">Tutte le categorie</option>
              {categorie.length === 0 && (
                <option value="" disabled>Nessuna categoria disponibile</option>
              )}
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
                  <li key={u.id} style={{ marginBottom: 12, background: '#f7f7f7', borderRadius: 8, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 2 }}>{u.url}</div>
                      <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
                        {categoria ? (categoria.emoji ? categoria.emoji + ' ' : '') + categoria.nome : 'Tutte le categorie'}
                      </div>
                      <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>Card: {cardLabel}</div>
                      {u.logo_url && (
                        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <img
                            src={u.logo_url}
                            alt="Logo link"
                            onLoad={() => {
                              console.log('[MonitorUrlModal] Logo caricato:', u.logo_url);
                            }}
                            onError={(e) => {
                              console.error('[MonitorUrlModal] Errore caricamento logo:', u.logo_url);
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/logo_filtro.png';
                            }}
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "4px",
                              objectFit: "contain",
                              background: "#f6f6f6",
                              border: "1px solid #eee"
                            }}
                          />
                          <span style={{ fontSize: "12px", color: "#666" }}>
                            Logo impostato
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(u.id)}
                      style={{
                        background: "#FF3B30",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        cursor: "pointer",
                        flexShrink: 0,
                        fontSize: "12px"
                      }}
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

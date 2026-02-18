import React, { useState, useEffect } from "react";
import heic2any from "heic2any";
import { supabase } from "./supabaseClient";

function GestioneRSSModal({ onClose }) {
  const [feeds, setFeeds] = useState([]);
  const [newFeed, setNewFeed] = useState("");
  const [newLogo, setNewLogo] = useState("");
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categorie, setCategorie] = useState([]);
  const [categoriaSelezionata, setCategoriaSelezionata] = useState("");
  const [cardSelezionata, setCardSelezionata] = useState("");
  const [feedInEdit, setFeedInEdit] = useState(null);
  const [categoriaFeedEdit, setCategoriaFeedEdit] = useState("");
  const [cardFeedEdit, setCardFeedEdit] = useState("");
  const [logoFeedEdit, setLogoFeedEdit] = useState("");
  const [logoFileEdit, setLogoFileEdit] = useState(null);
  const [isDraggingEdit, setIsDraggingEdit] = useState(false);

  const CARD_OPTIONS = [
    { id: '', label: 'Auto (titolo)' },
    { id: 'f1', label: 'Formula 1' },
    { id: 'fe', label: 'Formula E' },
    { id: 'other', label: 'Altre Formule' }
  ];

  useEffect(() => {
    caricaFeeds();
    caricaCategorie();
  }, []);

  async function caricaCategorie() {
    const { data, error } = await supabase
      .from("categorie_weekend")
      .select("*")
      .order("nome", { ascending: true });
    if (!error && data) setCategorie(data);
  }

  async function caricaFeeds() {
    setLoading(true);
    const { data, error } = await supabase
      .from("rss_feeds")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      const feedsConCategorie = await Promise.all(
        data.map(async (feed) => {
          if (feed.categoria_id) {
            const { data: cat } = await supabase
              .from("categorie_weekend")
              .select("id, nome, emoji")
              .eq("id", feed.categoria_id)
              .single();
            return { ...feed, categoria_info: cat };
          }
          return { ...feed, categoria_info: null };
        })
      );
      setFeeds(feedsConCategorie);
    }
    setLoading(false);
  }

  async function uploadLogoFile(file) {
    if (!file) return null;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Il file selezionato non è un’immagine valida.');
      return null;
    }

    let pngBlob = null;
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      /\.heic$/i.test(file.name) ||
      /\.heif$/i.test(file.name);

    const toPngBlob = async (blob) => {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = objectUrl;
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image decode failed'));
        });
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return await new Promise((resolve) => {
          canvas.toBlob((out) => resolve(out), 'image/png', 0.92);
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    try {
      if (isHeic) {
        const converted = await heic2any({ blob: file, toType: 'image/png' });
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
        pngBlob = await toPngBlob(convertedBlob);
      } else {
        try {
          pngBlob = await toPngBlob(file);
        } catch (decodeError) {
          const converted = await heic2any({ blob: file, toType: 'image/png' });
          const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
          pngBlob = await toPngBlob(convertedBlob);
        }
      }
    } catch (error) {
      console.error('Conversione immagine fallita:', error);
      alert('Il file selezionato non è supportato. Converti in PNG o JPG e riprova.');
      return null;
    }

    if (!pngBlob) {
      alert('Impossibile convertire il logo in PNG. Riprova con un altro file.');
      return null;
    }
    
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const filePath = `${fileName}`;
      const fileBody = pngBlob;
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

  async function aggiungiFeed() {
    if (!newFeed.trim()) return;
    
    setUploadingLogo(true);
    let logoUrl = normalizeLogoUrl(newLogo.trim()) || null;
    
    // Se c'è un file da caricare, fai upload
    if (newLogoFile) {
      logoUrl = await uploadLogoFile(newLogoFile);
    }
    logoUrl = normalizeLogoUrl(logoUrl);
    
    const { error } = await supabase.from("rss_feeds").insert([
      { 
        url: newFeed,
        categoria_id: categoriaSelezionata || null,
        card_target: cardSelezionata || null,
        logo_url: logoUrl
      }
    ]);
    
    if (!error) {
      setNewFeed("");
      setNewLogo("");
      setNewLogoFile(null);
      setCategoriaSelezionata("");
      setCardSelezionata("");
      caricaFeeds();
    }
    
    setUploadingLogo(false);
  }

  async function rimuoviFeed(id) {
    const { error } = await supabase.from("rss_feeds").delete().eq("id", id);
    if (!error) caricaFeeds();
  }

  async function salvaCategoria(feedId) {
    setUploadingLogo(true);
    
    let logoUrl = normalizeLogoUrl(logoFeedEdit.trim()) || null;
    
    // Se c'è un file da caricare, fai upload
    if (logoFileEdit) {
      logoUrl = await uploadLogoFile(logoFileEdit);
    }
    logoUrl = normalizeLogoUrl(logoUrl);
    
    const { error } = await supabase
      .from("rss_feeds")
      .update({ 
        categoria_id: categoriaFeedEdit || null,
        card_target: cardFeedEdit || null,
        logo_url: logoUrl
      })
      .eq("id", feedId);
      
    if (!error) {
      setFeedInEdit(null);
      setCategoriaFeedEdit("");
      setCardFeedEdit("");
      setLogoFeedEdit("");
      setLogoFileEdit(null);
      caricaFeeds();
    }
    
    setUploadingLogo(false);
  }

  function iniziaEdit(feed) {
    setFeedInEdit(feed.id);
    setCategoriaFeedEdit(feed.categoria_id || "");
    setCardFeedEdit(feed.card_target || "");
    setLogoFeedEdit(feed.logo_url || "");
    setLogoFileEdit(null);
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
      setNewLogoFile(files[0]);
      setNewLogo("");
    }
  }

  function handleDragOverEdit(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEdit(true);
  }

  function handleDragLeaveEdit(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEdit(false);
  }

  function handleDropEdit(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEdit(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0] && files[0].type.startsWith('image/')) {
      setLogoFileEdit(files[0]);
      setLogoFeedEdit("");
    }
  }

  return (
    <div className="grss-overlay" style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: "rgba(0, 0, 0, 0.5)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      zIndex: 1000 
    }}>
      <div className="grss-modal" style={{ 
        backgroundColor: "#fff", 
        borderRadius: "12px", 
        padding: "20px", 
        width: "90%", 
        maxWidth: "500px", 
        maxHeight: "80vh", 
        display: "flex", 
        flexDirection: "column",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
      }}>
        <style>{`
          @media (max-width: 768px) {
            .grss-overlay {
              align-items: flex-start;
            }
            .grss-modal {
              width: 100%;
              max-width: 100%;
              height: 100dvh;
              max-height: 100dvh;
              border-radius: 0;
              padding: 12px;
            }
            .grss-controls {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .grss-grid {
              grid-template-columns: 1fr !important;
            }
            .grss-btn {
              width: 100%;
            }
            .grss-list {
              padding-bottom: 12px;
            }
          }
        `}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>Gestione Feed RSS</h2>
          <button 
            onClick={onClose}
            style={{ 
              background: "none", 
              border: "none", 
              fontSize: "24px", 
              cursor: "pointer",
              padding: 0,
              color: "#666"
            }}
          >
            ✕
          </button>
        </div>

        <div className="grss-controls" style={{ marginBottom: "15px" }}>
          <input 
            type="text"
            value={newFeed}
            onChange={e => setNewFeed(e.target.value)}
            placeholder="URL del feed RSS..."
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ddd",
              fontSize: "14px",
              boxSizing: "border-box",
              marginBottom: "8px"
            }}
          />
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ 
              padding: "8px", 
              borderRadius: "6px", 
              border: isDragging ? "2px dashed #34C759" : "2px dashed #ddd",
              backgroundColor: isDragging ? "#e8f5e9" : "#fafafa",
              textAlign: "center",
              marginBottom: "8px"
            }}
          >
            <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>
              Carica logo qui oppure
            </div>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <input 
                type="text" 
                value={newLogo} 
                onChange={e => setNewLogo(e.target.value)} 
                placeholder="URL logo..." 
                style={{ 
                  flex: 1, 
                  padding: "4px", 
                  borderRadius: "4px", 
                  border: "1px solid #ddd", 
                  fontSize: "12px" 
                }} 
              />
              <label style={{ 
                padding: "4px 8px", 
                background: "#34C759", 
                color: "#fff", 
                borderRadius: "4px", 
                cursor: "pointer",
                fontSize: "12px",
                whiteSpace: "nowrap"
              }}>
                Scegli file
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => {
                    setNewLogoFile(e.target.files[0]);
                    setNewLogo("");
                  }}
                  style={{ display: "none" }} 
                />
              </label>
            </div>
          </div>
          {newLogoFile && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#34C759", fontWeight: "600", marginBottom: "8px" }}>
              <span>✓ {newLogoFile.name}</span>
              <button 
                onClick={() => setNewLogoFile(null)}
                style={{ 
                  background: "none", 
                  color: "#FF3B30", 
                  border: "none", 
                  padding: 0, 
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>
          )}
          <div className="grss-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <select 
              value={categoriaSelezionata} 
              onChange={e => setCategoriaSelezionata(e.target.value)}
              style={{ 
                padding: "10px", 
                borderRadius: "6px", 
                border: "1px solid #ddd",
                fontSize: "14px"
              }}
            >
              <option value="">Tutte le categorie</option>
              {categorie.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji} {cat.nome}
                </option>
              ))}
            </select>
            <select
              value={cardSelezionata}
              onChange={e => setCardSelezionata(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
                fontSize: "14px"
              }}
            >
              {CARD_OPTIONS.map(card => (
                <option key={card.id || 'auto'} value={card.id}>
                  {card.label}
                </option>
              ))}
            </select>
            <button 
              onClick={aggiungiFeed} 
              disabled={uploadingLogo}
              className="grss-btn"
              style={{ 
                background: "#007AFF", 
                color: "#fff", 
                padding: "10px 16px", 
                border: "none", 
                borderRadius: "6px", 
                cursor: uploadingLogo ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600",
                opacity: uploadingLogo ? 0.6 : 1
              }}
            >
              {uploadingLogo ? "Caricamento..." : "Aggiungi"}
            </button>
          </div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "6px", lineHeight: 1.3 }}>
            <strong>Categorie</strong>: limita la visibilità ai soli utenti di quella categoria (vuoto = visibile a tutti).
            <br />
            <strong>Card</strong>: decide in quale tab mostrare il feed (Auto = usa il titolo per assegnare il tab).
          </div>
        </div>

        <div className="grss-list" style={{ flex: 1, overflow: "auto" }}>
          {loading ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
              Caricamento...
            </div>
          ) : feeds.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
              Nessun feed RSS inserito.
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: "0", margin: "0" }}>
              {feeds.map(feed => (
                <li 
                  key={feed.id} 
                  style={{ 
                    display: "flex", 
                    alignItems: "flex-start", 
                    justifyContent: "space-between", 
                    marginBottom: "8px", 
                    padding: "8px", 
                    background: "#f9f9f9", 
                    borderRadius: "6px",
                    gap: "8px"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      wordBreak: "break-all", 
                      marginBottom: "4px", 
                      fontSize: "13px",
                      lineHeight: "1.4"
                    }}>
                      {feed.url}
                    </div>
                    {feedInEdit === feed.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                        <select 
                          value={categoriaFeedEdit} 
                          onChange={e => setCategoriaFeedEdit(e.target.value)}
                          style={{ 
                            flex: 1,
                            padding: "4px", 
                            borderRadius: "4px", 
                            border: "1px solid #ddd",
                            fontSize: "12px"
                          }}
                        >
                          <option value="">Tutte le categorie</option>
                          {categorie.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.emoji} {cat.nome}
                            </option>
                          ))}
                        </select>
                        <select
                          value={cardFeedEdit}
                          onChange={e => setCardFeedEdit(e.target.value)}
                          style={{
                            flex: 1,
                            padding: "4px",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                            fontSize: "12px"
                          }}
                        >
                          {CARD_OPTIONS.map(card => (
                            <option key={card.id || 'auto'} value={card.id}>
                              {card.label}
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: "11px", color: "#666", lineHeight: 1.3 }}>
                          <strong>Categorie</strong>: chi può vedere il feed. <strong>Card</strong>: dove appare nel pannello.
                        </div>
                        <div 
                          onDragOver={handleDragOverEdit}
                          onDragLeave={handleDragLeaveEdit}
                          onDrop={handleDropEdit}
                          style={{ 
                            padding: "8px", 
                            borderRadius: "6px", 
                            border: isDraggingEdit ? "2px dashed #34C759" : "2px dashed #ddd",
                            backgroundColor: isDraggingEdit ? "#e8f5e9" : "#fafafa",
                            textAlign: "center"
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>
                            Trascina logo qui
                          </div>
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <input 
                              type="text" 
                              value={logoFeedEdit} 
                              onChange={e => setLogoFeedEdit(e.target.value)} 
                              placeholder="URL logo..." 
                              style={{ 
                                flex: 1, 
                                padding: "4px", 
                                borderRadius: "4px", 
                                border: "1px solid #ddd", 
                                fontSize: "12px" 
                              }} 
                            />
                            <label style={{ 
                              padding: "4px 8px", 
                              background: "#34C759", 
                              color: "#fff", 
                              borderRadius: "4px", 
                              cursor: "pointer",
                              fontSize: "12px",
                              whiteSpace: "nowrap"
                            }}>
                              File
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={e => {
                                  setLogoFileEdit(e.target.files[0]);
                                  setLogoFeedEdit("");
                                }}
                                style={{ display: "none" }} 
                              />
                            </label>
                          </div>
                        </div>
                        {logoFileEdit && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#34C759", fontWeight: "600" }}>
                            <span>✓ {logoFileEdit.name}</span>
                            <button 
                              onClick={() => setLogoFileEdit(null)}
                              style={{ 
                                background: "none", 
                                color: "#FF3B30", 
                                border: "none", 
                                padding: 0, 
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "bold",
                                lineHeight: 1
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button 
                            onClick={() => salvaCategoria(feed.id)}
                            disabled={uploadingLogo}
                            style={{ 
                              flex: 1,
                              padding: "6px 12px", 
                              background: "#34C759", 
                              color: "#fff", 
                              border: "none", 
                              borderRadius: "4px", 
                              cursor: uploadingLogo ? "not-allowed" : "pointer",
                              fontSize: "12px",
                              fontWeight: "600",
                              opacity: uploadingLogo ? 0.6 : 1
                            }}
                          >
                            {uploadingLogo ? "Salvando..." : "✓ Salva"}
                          </button>
                          <button 
                            onClick={() => {
                              setFeedInEdit(null);
                              setLogoFileEdit(null);
                            }}
                            style={{ 
                              flex: 1,
                              padding: "6px 12px", 
                              background: "#999", 
                              color: "#fff", 
                              border: "none", 
                              borderRadius: "4px", 
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "600"
                            }}
                          >
                            ✕ Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {feed.categoria_info && (
                          <div 
                            style={{ 
                              fontSize: "12px", 
                              color: "#666", 
                              marginTop: "4px", 
                              cursor: "pointer" 
                            }}
                            onClick={() => iniziaEdit(feed)}
                          >
                            {feed.categoria_info.emoji} {feed.categoria_info.nome}
                          </div>
                        )}
                        {!feed.categoria_info && (
                          <div 
                            style={{ 
                              fontSize: "12px", 
                              color: "#999", 
                              marginTop: "4px", 
                              fontStyle: "italic", 
                              cursor: "pointer" 
                            }}
                            onClick={() => iniziaEdit(feed)}
                          >
                            Tutte le categorie (click per modificare)
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: "12px",
                            color: feed.card_target ? "#666" : "#999",
                            marginTop: "4px",
                            fontStyle: feed.card_target ? "normal" : "italic",
                            cursor: "pointer"
                          }}
                          onClick={() => iniziaEdit(feed)}
                        >
                          Card: {CARD_OPTIONS.find(card => card.id === (feed.card_target || ''))?.label || 'Auto (titolo)'}
                        </div>
                        {feed.logo_url && (
                          <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <img
                              src={normalizeLogoUrl(feed.logo_url)}
                              alt="Logo feed"
                              onError={(e) => {
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
                      </>
                    )}
                  </div>
                  <button 
                    onClick={() => rimuoviFeed(feed.id)} 
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
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default GestioneRSSModal;

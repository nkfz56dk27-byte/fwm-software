import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function GestioneCategorie({ onClose }) {
  const [categorie, setCategorie] = useState([]);
  const [redattori, setRedattori] = useState([]);
  const [gruppi, setGruppi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNuovaCategoria, setShowNuovaCategoria] = useState(false);
  const [editCategoria, setEditCategoria] = useState(null);

  useEffect(() => {
    document.title = 'FWM - Gestione Categorie';
  }, []);

  useEffect(() => {
    caricaDati();
  }, []);

  async function caricaDati() {
    setLoading(true);
    
    const [categorieRes, redattoriRes, gruppiRes] = await Promise.all([
      supabase.from('categorie_weekend').select('*').order('nome'),
      supabase.from('utenti').select('*').in('ruolo', ['redattore', 'admin']).order('nome_completo'),
      supabase.from('gruppi_redattori').select('*')
    ]);

    if (categorieRes.data) setCategorie(categorieRes.data);
    if (redattoriRes.data) setRedattori(redattoriRes.data);
    if (gruppiRes.data) setGruppi(gruppiRes.data);
    
    setLoading(false);
  }

  async function eliminaCategoria(id) {
    if (!confirm('Sei sicuro di voler eliminare questa categoria?')) return;
    
    await supabase.from('categorie_weekend').delete().eq('id', id);
    caricaDati();
  }

  async function toggleRedattore(categoriaId, username) {
    const esistente = gruppi.find(g => g.categoria_id === categoriaId && g.username === username);
    if (esistente) {
      await supabase.from('gruppi_redattori').delete().eq('id', esistente.id);
    } else {
      await supabase.from('gruppi_redattori').insert({
        categoria_id: categoriaId,
        username: username
      });
    }
    caricaDati();
  }

  return (
    <div style={{ height: '100vh', background: 'linear-gradient(180deg, #eef0f4 0%, #e4e6ec 100%)' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="gestione-header" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
          <div className="gestione-navbar">
            <button className="btn-back" onClick={onClose}>
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              Indietro
            </button>
            <h1 className="gestione-title">Categorie e Gruppi</h1>
          </div>
          <div className="gestione-actions">
            <button className="btn-nuovo btn-nuovo-primary" onClick={() => setShowNuovaCategoria(true)} style={{ flex: 1 }}>
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
              Nuova categoria
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {categorie.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>Nessuna categoria configurata</div>
                <div style={{ fontSize: '14px' }}>Clicca "+ Nuova Categoria" per iniziare</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {categorie.map(categoria => {
                  const redattoriCategoria = gruppi.filter(g => g.categoria_id === categoria.id);
                  return (
                    <div key={categoria.id} style={{ background: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: `6px solid ${categoria.colore}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '5px' }}>{categoria.nome}</div>
                          <div style={{ fontSize: '13px', color: '#666' }}>{redattoriCategoria.length} redattori assegnati</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setEditCategoria(categoria)} style={{ padding: '8px 15px', background: 'rgba(0,122,255,0.12)', color: '#007AFF', border: 'none', borderRadius: '100px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Modifica</button>
                          <button onClick={() => eliminaCategoria(categoria.id)} style={{ width: '34px', height: '34px', background: 'rgba(255,59,48,0.12)', color: '#FF3B30', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>Redattori assegnati:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {redattori.map(redattore => {
                          const isAssegnato = redattoriCategoria.some(g => g.username === redattore.username);
                          return (
                            <label key={redattore.username} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: isAssegnato ? 'rgba(52,199,89,0.12)' : 'rgba(120,120,128,0.08)', border: 'none', borderRadius: '100px', cursor: 'pointer', fontSize: '14px', color: isAssegnato ? '#248A3D' : '#666', fontWeight: isAssegnato ? '600' : 'normal', transition: 'all 0.2s ease' }}>
                              <input
                                type="checkbox"
                                checked={isAssegnato}
                                onChange={() => toggleRedattore(categoria.id, redattore.username)}
                                style={{ marginRight: '10px', accentColor: '#34C759' }}
                              />
                              {redattore.nome_completo}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {showNuovaCategoria && (
          <ModalCategoria onClose={() => setShowNuovaCategoria(false)} onSave={() => { setShowNuovaCategoria(false); caricaDati(); }} />
        )}
        {editCategoria && (
          <ModalCategoria categoria={editCategoria} onClose={() => setEditCategoria(null)} onSave={() => { setEditCategoria(null); caricaDati(); }} />
        )}
      </div>
    </div>
  );
}

function ModalCategoria({ categoria, onClose, onSave }) {
  const [nome, setNome] = useState(categoria?.nome || '');
  const [colore, setColore] = useState(categoria?.colore || '#FF3B30');
  const [salvando, setSalvando] = useState(false);

  const COLORI_PREDEFINITI = [
    { nome: 'Rosso', valore: '#FF3B30' },
    { nome: 'Arancione', valore: '#FF9500' },
    { nome: 'Giallo', valore: '#FFCC00' },
    { nome: 'Verde', valore: '#34C759' },
    { nome: 'Blu', valore: '#007AFF' },
    { nome: 'Indigo', valore: '#5856D6' },
    { nome: 'Viola', valore: '#AF52DE' },
    { nome: 'Rosa', valore: '#FF2D55' }
  ];

  async function salva() {
    if (!nome.trim()) {
      alert('Inserisci un nome per la categoria');
      return;
    }

    setSalvando(true);

    if (categoria) {
      // Modifica
      await supabase
        .from('categorie_weekend')
        .update({ nome: nome.trim(), colore })
        .eq('id', categoria.id);
    } else {
      // Nuova
      await supabase
        .from('categorie_weekend')
        .insert({ nome: nome.trim(), colore });
    }

    setSalvando(false);
    onSave();
  }

  return (
    <div className="modal-container">
      <div className="modal-card" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 20 }}>
            {categoria ? 'Modifica categoria' : 'Nuova categoria'}
          </h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form">
          <div className="form-group">
            <label className="form-label">Nome categoria</label>
            <input 
              type="text" 
              value={nome} 
              onChange={e => setNome(e.target.value)} 
              placeholder="es: Formula 1, MotoGP, Indycar"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Colore bordo</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {COLORI_PREDEFINITI.map(c => (
                <button
                  key={c.valore}
                  onClick={() => setColore(c.valore)}
                  style={{
                    padding: '12px',
                    background: c.valore,
                    border: colore === c.valore ? '3px solid #000' : '3px solid transparent',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>
              Annulla
            </button>
            <button
              className="btn-save"
              onClick={salva}
              disabled={salvando || !nome.trim()}
              style={{ opacity: (salvando || !nome.trim()) ? 0.5 : 1, cursor: (salvando || !nome.trim()) ? 'not-allowed' : 'pointer' }}
            >
              {salvando ? 'Salvataggio...' : (categoria ? 'Salva' : 'Crea')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

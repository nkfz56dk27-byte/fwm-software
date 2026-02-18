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
    <div style={{ height: '100vh', background: '#f5f5f7' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Categorie e Gruppi</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Gestione categorie weekend e assegnazione redattori</div>
          </div>
          <button onClick={() => setShowNuovaCategoria(true)} style={{ padding: '8px 16px', background: '#34C759', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>+ Nuova Categoria</button>
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
                    <div key={categoria.id} style={{ background: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderLeft: `6px solid ${categoria.colore}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '5px' }}>{categoria.nome}</div>
                          <div style={{ fontSize: '13px', color: '#666' }}>{redattoriCategoria.length} redattori assegnati</div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => setEditCategoria(categoria)} style={{ padding: '8px 15px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Modifica</button>
                          <button onClick={() => eliminaCategoria(categoria.id)} style={{ padding: '8px 15px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>Redattori assegnati:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {redattori.map(redattore => {
                          const isAssegnato = redattoriCategoria.some(g => g.username === redattore.username);
                          return (
                            <label key={redattore.username} style={{ display: 'flex', alignItems: 'center', padding: '10px', background: isAssegnato ? '#eaffea' : '#f5f5f7', border: isAssegnato ? '2px solid #34C759' : '2px solid #eee', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', color: isAssegnato ? '#34C759' : '#666', fontWeight: isAssegnato ? '600' : 'normal', transition: 'all 0.2s ease' }}>
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
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 10000 
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '15px', 
        width: '500px', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '20px 30px', 
          borderBottom: '1px solid #e0e0e0' 
        }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {categoria ? 'Modifica Categoria' : 'Nuova Categoria'}
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer', 
              color: '#666' 
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '30px' }}>
          <div style={{ marginBottom: '25px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Nome Categoria</div>
            <input 
              type="text" 
              value={nome} 
              onChange={e => setNome(e.target.value)} 
              placeholder="es: Formula 1, MotoGP, Indycar"
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '1px solid #ddd', 
                fontSize: '15px' 
              }} 
            />
          </div>

          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Colore Bordo</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {COLORI_PREDEFINITI.map(c => (
                <button
                  key={c.valore}
                  onClick={() => setColore(c.valore)}
                  style={{
                    padding: '12px',
                    background: c.valore,
                    border: colore === c.valore ? '3px solid #000' : '3px solid transparent',
                    borderRadius: '8px',
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
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'flex-end', 
          padding: '20px 30px', 
          borderTop: '1px solid #e0e0e0' 
        }}>
          <button 
            onClick={onClose} 
            style={{ 
              padding: '10px 20px', 
              background: '#f0f0f0', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer' 
            }}
          >
            Annulla
          </button>
          <button 
            onClick={salva} 
            disabled={salvando || !nome.trim()}
            style={{ 
              padding: '10px 20px', 
              background: (salvando || !nome.trim()) ? '#ccc' : '#34C759', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: (salvando || !nome.trim()) ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            {salvando ? 'Salvataggio...' : (categoria ? 'Salva' : 'Crea')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import alertSvg from './assets/alert.svg'

const GIORNI = ['giovedi', 'venerdi', 'sabato', 'domenica']

const CATEGORIE = [
  { id: 'live', nome: '🏁 Live Coverage' },
  { id: 'analisi', nome: '📊 Analisi' },
  { id: 'sintesi', nome: '📝 Sintesi' },
  { id: 'dichiarazioni', nome: '💬 Dichiarazioni' },
  { id: 'news', nome: '📰 News' },
  { id: 'social', nome: '🎙️ Social & Paddock' },
  { id: 'tecnico', nome: '⚖️ FIA & Tecnico' },
  { id: 'opinioni', nome: '✍️ Opinioni' }
]

// Funzioni helper per grassetto
function renderTextWithBold(text, ranges) {
  if (!ranges || ranges.length === 0) {
    return <span>{text}</span>
  }

  const parts = []
  let lastIndex = 0

  ranges.sort((a, b) => a.start - b.start).forEach(range => {
    if (range.start > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, range.start)}</span>)
    }
    parts.push(<strong key={`bold-${range.start}`}>{text.substring(range.start, range.end)}</strong>)
    lastIndex = range.end
  })

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>)
  }

  return <>{parts}</>
}

function getWordsFromText(text) {
  const words = []
  let currentWord = ''
  
  for (let char of text) {
    if (/[a-zA-Z0-9àèéìòùÀÈÉÌÒÙ]/.test(char)) {
      currentWord += char
    } else {
      if (currentWord) {
        words.push(currentWord)
        currentWord = ''
      }
    }
  }
  
  if (currentWord) words.push(currentWord)
  return [...new Set(words)]
}

export default function GestioneTemplateArticoli({ onClose }) {
  const [templates, setTemplates] = useState([])
  const [categorie, setCategorie] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNuovo, setShowNuovo] = useState(false)
  const [templateEdit, setTemplateEdit] = useState(null)

  useEffect(() => {
    caricaDati()
  }, [])

  async function caricaDati() {
    setLoading(true)
    
    // Carica template
    const { data: templatesArr, error: templatesError } = await supabase
      .from('template_articoli')
      .select('*, categoria:categorie_weekend(id, nome, colore)')
      .order('created_at', { ascending: false })
    // Carica categorie
    const { data: categorieArr, error: categorieError } = await supabase
      .from('categorie_weekend')
      .select('*')
      .order('created_at', { ascending: true })
    setTemplates(Array.isArray(templatesArr) && !templatesError ? templatesArr : [])
    setCategorie(Array.isArray(categorieArr) && !categorieError ? categorieArr : [])
    setLoading(false)
  }

  async function eliminaTemplate(id) {
    if (!confirm('Sei sicuro di voler eliminare questo template?')) return
    
    const { error } = await supabase
      .from('template_articoli')
      .delete()
      .eq('id', id)
    
    if (!error) caricaDati()
  }

  // Rileva mobile
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stato per la search bar di ogni template (key: template.id)
  const [searchByTemplate, setSearchByTemplate] = useState({});

  function handleSearchChange(templateId, value) {
    setSearchByTemplate(prev => ({ ...prev, [templateId]: value }));
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, #eef0f4 0%, #e4e6ec 100%)', zIndex: 1000 }}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="gestione-header" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)' }}>
          <div className="gestione-navbar">
            <button className="btn-back" onClick={onClose}>
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              Indietro
            </button>
            <h1 className="gestione-title">Template articoli</h1>
          </div>
          <div className="gestione-actions">
            <button className="btn-nuovo btn-nuovo-primary" onClick={() => setShowNuovo(true)} style={{ flex: 1 }}>
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
              Nuovo template
            </button>
          </div>
        </div>

        {/* Contenuto */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px', color: '#666' }}>Caricamento...</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>📋</div>
              <div style={{ fontSize: '20px', color: '#666' }}>Nessun template creato</div>
              <button onClick={() => setShowNuovo(true)} style={{ marginTop: '20px', padding: '12px 24px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '100px', cursor: 'pointer', fontWeight: 'bold' }}>Crea il primo template</button>
            </div>
          ) : (
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {templates.map(template => {
                const search = searchByTemplate[template.id]?.toLowerCase() || '';
                const filteredArticoli = search
                  ? template.articoli.filter(art =>
                      art.titolo.toLowerCase().includes(search) ||
                      (art.testo && art.testo.toLowerCase().includes(search))
                    )
                  : template.articoli;
                return (
                  <div key={template.id} style={{ background: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: template.categoria ? `6px solid ${template.categoria.colore}` : '6px solid #8E8E93' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                      <div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{template.nome}</div>
                        <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                          {template.categoria ? (
                            <span style={{ color: template.categoria.colore, fontWeight: 'bold' }}>• {template.categoria.nome}</span>
                          ) : (
                            <span>• Generico</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setTemplateEdit(template)} style={{ padding: '8px 15px', background: 'rgba(0,122,255,0.12)', color: '#007AFF', border: 'none', borderRadius: '100px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Modifica</button>
                        <button onClick={() => eliminaTemplate(template.id)} style={{ padding: '8px 15px', background: 'rgba(255,59,48,0.12)', color: '#FF3B30', border: 'none', borderRadius: '100px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Elimina</button>
                      </div>
                    </div>
                    {/* Search bar per articoli */}
                    <input
                      type="text"
                      placeholder="Cerca tra gli articoli..."
                      value={searchByTemplate[template.id] || ''}
                      onChange={e => handleSearchChange(template.id, e.target.value)}
                      style={{ width: '100%', marginBottom: 12, padding: 10, borderRadius: 12, border: '1px solid rgba(120,120,128,0.25)', background: 'rgba(120,120,128,0.06)', fontSize: 15 }}
                    />
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                      {filteredArticoli.length} articoli
                    </div>
                    {/* Preview articoli filtrati */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredArticoli.length === 0 && (
                        <div style={{ color: '#999', fontStyle: 'italic', padding: '10px' }}>Nessun articolo trovato</div>
                      )}
                      {filteredArticoli.slice(0, 5).map((art, idx) => (
                        <div key={idx} style={{ padding: '10px 14px', background: 'rgba(120,120,128,0.06)', borderRadius: '12px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            {renderTextWithBold(art.titolo, art.range_grassetto || [])}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            {CATEGORIE.find(c => c.id === art.categoria)?.nome || art.categoria} • {art.giorno}
                          </div>
                        </div>
                      ))}
                      {filteredArticoli.length > 5 && (
                        <div style={{ padding: '10px', background: 'rgba(120,120,128,0.1)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                          +{filteredArticoli.length - 5} altri articoli
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modali */}
      {showNuovo && <TemplateModal categorie={categorie} onClose={() => setShowNuovo(false)} onSave={() => { setShowNuovo(false); caricaDati(); }} />}
      {templateEdit && <TemplateModal template={templateEdit} categorie={categorie} onClose={() => setTemplateEdit(null)} onSave={() => { setTemplateEdit(null); caricaDati(); }} />}
    </div>
  )
}

function TemplateModal({ template, categorie, onClose, onSave }) {
    // Search bar per filtrare articoli nella modale
    const [search, setSearch] = useState('');
  const [nome, setNome] = useState(template?.nome || '')
  const [categoriaId, setCategoriaId] = useState(template?.categoria_id || null)
  const [articoli, setArticoli] = useState(template?.articoli || [])
  const [showAggiungi, setShowAggiungi] = useState(false)
  const [editIndex, setEditIndex] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function rimuoviArticolo(index) {
    setArticoli(articoli.filter((_, i) => i !== index))
  }

  function modificaArticolo(index) {
    setEditIndex(index)
    setShowAggiungi(true)
  }

  async function copiaTemplate() {
    if (!confirm('Vuoi creare una copia di questo template?')) return
    
    setSalvando(true)
    
    const data = {
      nome: nome + ' (copia)',
      categoria_id: categoriaId,
      articoli: articoli
    }
    
    const { error } = await supabase
      .from('template_articoli')
      .insert(data)
    
    setSalvando(false)
    
    if (error) {
      console.error('Errore copia:', error)
      alert('Errore nella copia del template')
    } else {
      alert('✅ Template copiato con successo!')
      onSave()
    }
  }

  async function salva() {
    if (!nome || articoli.length === 0) {
      alert('Inserisci nome e almeno un articolo')
      return
    }

    setSalvando(true)

    const data = {
      nome,
      categoria_id: categoriaId,
      articoli: articoli
    }

    let error
    if (template) {
      // Modifica
      ({ error } = await supabase
        .from('template_articoli')
        .update(data)
        .eq('id', template.id))
    } else {
      // Nuovo
      ({ error } = await supabase
        .from('template_articoli')
        .insert(data))
    }

    setSalvando(false)

    if (error) {
      console.error('Errore salvataggio:', error)
      alert('Errore nel salvataggio')
    } else {
      onSave()
    }
  }

  return (
    <div className="modal-container">
      <div className="modal-card" style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h2>{template ? 'Modifica template' : 'Nuovo template'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* Nome */}
            <div className="form-group">
              <label className="form-label">Nome template</label>
              <input
                type="text"
                placeholder="es: Formula E - Venerdì e Sabato"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Categoria */}
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select
                value={categoriaId || ''}
                onChange={e => setCategoriaId(e.target.value || null)}
                className="form-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="">Nessuna categoria (generico)</option>
                {categorie.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ height: '1px', background: 'rgba(60,60,67,0.15)' }}></div>

            {/* Articoli */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>📄 Articoli ({articoli.length})</div>
                <button onClick={() => { setEditIndex(null); setShowAggiungi(true) }} style={{ padding: '8px 16px', background: 'rgba(52,199,89,0.14)', color: '#248A3D', border: 'none', borderRadius: '100px', cursor: 'pointer', fontWeight: 'bold' }}>+ Aggiungi articolo</button>
              </div>

              {/* Lista articoli ordinata per giorno e categoria */}
              {/* Search bar per articoli nella modale */}
              <input
                type="text"
                placeholder="Cerca tra gli articoli..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input"
                style={{ marginBottom: 12 }}
              />
              {articoli.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {articoli
                    .filter(art =>
                      !search ||
                      art.titolo.toLowerCase().includes(search.toLowerCase()) ||
                      (art.testo && art.testo.toLowerCase().includes(search.toLowerCase()))
                    )
                    .slice()
                    .sort((a, b) => {
                      const giorni = ['giovedi', 'venerdi', 'sabato', 'domenica']
                      const giornoA = giorni.indexOf(a.giorno)
                      const giornoB = giorni.indexOf(b.giorno)
                      if (giornoA !== giornoB) return giornoA - giornoB
                      return a.categoria.localeCompare(b.categoria)
                    })
                    .map((art, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: art.critico ? 'rgba(255,59,48,0.08)' : 'rgba(120,120,128,0.06)', borderRadius: '14px', border: art.critico ? '1px solid rgba(255,59,48,0.3)' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            {renderTextWithBold(art.titolo, art.range_grassetto || [])}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {CATEGORIE.find(c => c.id === art.categoria)?.nome || art.categoria} • {art.giorno}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              const newArticoli = [...articoli]
                              newArticoli[articoli.indexOf(art)] = { ...art, critico: !art.critico }
                              setArticoli(newArticoli)
                            }}
                            style={{
                              padding: '6px 10px',
                              background: art.critico ? '#FF3B30' : 'rgba(120,120,128,0.12)',
                              border: 'none',
                              borderRadius: '50%',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px'
                            }}
                            title={art.critico ? 'Rimuovi da critici' : 'Aggiungi a critici'}
                          >
                            <img src={alertSvg} alt="⚠️" style={{ width: '18px', height: '18px', filter: art.critico ? 'brightness(0) invert(1)' : 'none' }} />
                          </button>
                          <button onClick={() => modificaArticolo(articoli.indexOf(art))} style={{ padding: '6px 12px', background: 'rgba(0,122,255,0.12)', color: '#007AFF', border: 'none', borderRadius: '100px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Modifica</button>
                          <button onClick={() => rimuoviArticolo(articoli.indexOf(art))} style={{ width: '30px', height: '30px', background: 'rgba(255,59,48,0.12)', color: '#FF3B30', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between', padding: '20px 25px' }}>
          <div>
            {template && (
              <button onClick={copiaTemplate} disabled={salvando} style={{ padding: '10px 20px', background: 'rgba(175,82,222,0.14)', color: '#8944AB', border: 'none', borderRadius: '100px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: salvando ? 0.5 : 1 }}>
                Copia template
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-cancel" onClick={onClose}>Annulla</button>
            <button className="btn-save" onClick={salva} disabled={salvando} style={{ opacity: salvando ? 0.5 : 1 }}>
              {salvando ? 'Salvataggio...' : template ? 'Salva modifiche' : 'Crea template'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Aggiungi/Modifica Articolo */}
      {showAggiungi && (
        <ArticoloModal
          articolo={editIndex !== null ? articoli[editIndex] : null}
          onClose={() => { setShowAggiungi(false); setEditIndex(null) }}
          onSave={(articolo) => {
            if (editIndex !== null) {
              const newArticoli = [...articoli]
              newArticoli[editIndex] = articolo
              setArticoli(newArticoli)
            } else {
              setArticoli([...articoli, articolo])
            }
            setShowAggiungi(false)
            setEditIndex(null)
          }}
        />
      )}
    </div>
  )
}

function ArticoloModal({ articolo, onClose, onSave }) {
  const [titolo, setTitolo] = useState(articolo?.titolo || '')
  const [categoria, setCategoria] = useState(articolo?.categoria || 'live')
  const [giorno, setGiorno] = useState(articolo?.giorno || 'venerdi')
  const [rangeGrassetto, setRangeGrassetto] = useState(articolo?.range_grassetto || [])

  function salva() {
    if (!titolo) {
      alert('Inserisci il titolo')
      return
    }
    onSave({ titolo, categoria, giorno, range_grassetto: rangeGrassetto })
  }

  return (
    <div className="modal-container" style={{ zIndex: 20000 }}>
      <div className="modal-card" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 18 }}>{articolo ? 'Modifica articolo' : 'Nuovo articolo'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Editor Titolo con Grassetto */}
            <RichTextEditor text={titolo} rangeGrassetto={rangeGrassetto} onChange={setTitolo} onRangesChange={setRangeGrassetto} />

            {/* Categoria */}
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="form-input"
                style={{ cursor: 'pointer' }}
              >
                {CATEGORIE.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Giorno */}
            <div className="form-group">
              <label className="form-label">Giorno</label>
              <select
                value={giorno}
                onChange={e => setGiorno(e.target.value)}
                className="form-input"
                style={{ cursor: 'pointer' }}
              >
                {GIORNI.map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ padding: '20px 25px' }}>
          <button className="btn-cancel" onClick={onClose}>Annulla</button>
          <button className="btn-save" onClick={salva}>
            {articolo ? 'Salva' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RichTextEditor({ text, rangeGrassetto, onChange, onRangesChange }) {
  const words = getWordsFromText(text)

  function toggleWord(word) {
    let newRanges = [...rangeGrassetto]
    let index = 0
    
    while ((index = text.indexOf(word, index)) !== -1) {
      const start = index
      const end = index + word.length
      const existingIndex = newRanges.findIndex(r => r.start === start && r.end === end)
      
      if (existingIndex !== -1) {
        newRanges.splice(existingIndex, 1)
      } else {
        newRanges.push({ start, end })
      }
      
      index = end
    }
    
    newRanges.sort((a, b) => a.start - b.start)
    onRangesChange(newRanges)
  }

  function isWordBold(word) {
    const index = text.indexOf(word)
    if (index === -1) return false
    return rangeGrassetto.some(r => r.start === index && r.end === index + word.length)
  }

  return (
    <div>
      <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>Titolo articolo</label>
      <textarea value={text} onChange={e => onChange(e.target.value)} placeholder="Scrivi il titolo..." className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} />
      
      {text && (
        <>
          <div style={{ fontSize: '12px', fontWeight: '600', marginTop: '14px', marginBottom: '6px', color: 'var(--glass-text-secondary, #666)' }}>Anteprima</div>
          <div style={{ padding: '12px 14px', background: 'rgba(0,122,255,0.08)', borderRadius: '14px', fontSize: '14px', marginBottom: '14px' }}>
            {renderTextWithBold(text, rangeGrassetto)}
          </div>
          
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--glass-text-secondary, #666)' }}>
            Clicca per mettere in grassetto
            {rangeGrassetto.length > 0 && (
              <button onClick={() => onRangesChange([])} style={{ padding: '4px 10px', background: 'rgba(255,59,48,0.12)', color: '#FF3B30', border: 'none', borderRadius: '100px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                Rimuovi tutto
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {words.map(word => (
              <button key={word} onClick={() => toggleWord(word)} style={{ padding: '6px 14px', background: isWordBold(word) ? '#007AFF' : 'rgba(120,120,128,0.1)', color: isWordBold(word) ? 'white' : '#333', border: 'none', borderRadius: '100px', cursor: 'pointer', fontSize: '12px', fontWeight: isWordBold(word) ? 'bold' : 'normal' }}>
                {word}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

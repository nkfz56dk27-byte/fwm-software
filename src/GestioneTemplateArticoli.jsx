import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#f5f5f7', zIndex: 1000 }}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'white',
            borderBottom: '1px solid #e0e0e0',
            transition: 'padding 0.2s',
            ...(isMobile
              ? {
                  padding: `calc(env(safe-area-inset-top, 0px) + 57px) 30px 20px 30px`,
                  paddingTop: `calc(env(safe-area-inset-top, 0px) + 57px)`
                }
              : { padding: '20px 30px', paddingTop: '20px' }),
            // iPhone 17/17 Max specific: usa media query JS per device
            ...(typeof window !== 'undefined' && window.navigator.userAgent.match(/iPhone\s*17/) ? {
              paddingTop: `calc(env(safe-area-inset-top, 0px) + 77px)`,
              padding: `calc(env(safe-area-inset-top, 0px) + 77px) 30px 20px 30px`
            } : {})
          }}
        >
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
          <div style={{
            fontSize: isMobile ? '26px' : '24px',
            fontWeight: 'bold',
            flex: isMobile ? '1 1 0%' : undefined,
            marginLeft: 0,
            marginRight: 0,
            textAlign: 'center',
            width: isMobile ? '100%' : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>Template Articoli</div>
          <button onClick={() => setShowNuovo(true)} style={{ padding: '10px 20px', background: '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Nuovo Template</button>
        </div>

        {/* Contenuto */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: isMobile ? '30px 30px 30px 30px' : '30px',
          paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 30px)' : '30px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px', color: '#666' }}>Caricamento...</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>📋</div>
              <div style={{ fontSize: '20px', color: '#666' }}>Nessun template creato</div>
              <button onClick={() => setShowNuovo(true)} style={{ marginTop: '20px', padding: '12px 24px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Crea il primo template</button>
            </div>
          ) : (
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {templates.map(template => (
                <div key={template.id} style={{ background: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: template.categoria ? `4px solid ${template.categoria.colore}` : '4px solid #8E8E93' }}>
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
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setTemplateEdit(template)} style={{ padding: '8px 16px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Modifica</button>
                      <button onClick={() => eliminaTemplate(template.id)} style={{ padding: '8px 16px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Elimina</button>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                    {template.articoli.length} articoli
                  </div>
                  
                  {/* Preview articoli */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {template.articoli.slice(0, 5).map((art, idx) => (
                      <div key={idx} style={{ padding: '10px', background: '#f8f8f8', borderRadius: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                          {renderTextWithBold(art.titolo, art.range_grassetto || [])}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          {CATEGORIE.find(c => c.id === art.categoria)?.nome || art.categoria} • {art.giorno}
                        </div>
                      </div>
                    ))}
                    {template.articoli.length > 5 && (
                      <div style={{ padding: '10px', background: '#e0e0e0', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                        +{template.articoli.length - 5} altri articoli
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{template ? 'Modifica Template' : 'Nuovo Template'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* Nome */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Nome Template</div>
              <input
                type="text"
                placeholder="es: Formula E - Venerdì e Sabato"
                value={nome}
                onChange={e => setNome(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
              />
            </div>

            {/* Categoria */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Categoria</div>
              <select
                value={categoriaId || ''}
                onChange={e => setCategoriaId(e.target.value || null)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', background: 'white', cursor: 'pointer' }}
              >
                <option value="">Nessuna categoria (generico)</option>
                {categorie.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ height: '1px', background: '#e0e0e0' }}></div>

            {/* Articoli */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>📄 Articoli ({articoli.length})</div>
                <button onClick={() => { setEditIndex(null); setShowAggiungi(true) }} style={{ padding: '8px 16px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Aggiungi Articolo</button>
              </div>

              {/* Lista articoli */}
              {articoli.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {articoli.map((art, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f8f8', borderRadius: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                          {renderTextWithBold(art.titolo, art.range_grassetto || [])}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {CATEGORIE.find(c => c.id === art.categoria)?.nome || art.categoria} • {art.giorno}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => modificaArticolo(idx)} style={{ padding: '6px 12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => rimuoviArticolo(idx)} style={{ padding: '6px 12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 30px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            {template && (
              <button onClick={copiaTemplate} disabled={salvando} style={{ padding: '10px 20px', background: '#AF52DE', color: 'white', border: 'none', borderRadius: '10px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: salvando ? 0.5 : 1 }}>
                📋 Copia Template
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Annulla</button>
            <button onClick={salva} disabled={salvando} style={{ padding: '10px 20px', background: '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', opacity: salvando ? 0.5 : 1 }}>
              {salvando ? 'Salvataggio...' : template ? 'Salva Modifiche' : 'Crea Template'}
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{articolo ? 'Modifica Articolo' : 'Nuovo Articolo'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Editor Titolo con Grassetto */}
            <RichTextEditor text={titolo} rangeGrassetto={rangeGrassetto} onChange={setTitolo} onRangesChange={setRangeGrassetto} />

            {/* Categoria */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Categoria</div>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', background: 'white', cursor: 'pointer' }}
              >
                {CATEGORIE.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Giorno */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Giorno</div>
              <select
                value={giorno}
                onChange={e => setGiorno(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', background: 'white', cursor: 'pointer' }}
              >
                {GIORNI.map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 30px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Annulla</button>
          <button onClick={salva} style={{ padding: '10px 20px', background: '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
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
      <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Titolo Articolo</div>
      <textarea value={text} onChange={e => onChange(e.target.value)} placeholder="Scrivi il titolo..." style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
      
      {text && (
        <>
          <div style={{ fontSize: '12px', fontWeight: '600', marginTop: '10px', marginBottom: '5px' }}>👁️ Anteprima:</div>
          <div style={{ padding: '10px', background: '#007AFF1A', borderRadius: '8px', fontSize: '14px', marginBottom: '10px' }}>
            {renderTextWithBold(text, rangeGrassetto)}
          </div>
          
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
            🔤 Clicca per mettere in grassetto:
            {rangeGrassetto.length > 0 && (
              <button onClick={() => onRangesChange([])} style={{ marginLeft: '10px', padding: '4px 8px', background: '#FF3B301A', color: '#FF3B30', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                ✕ Rimuovi tutto
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {words.map(word => (
              <button key={word} onClick={() => toggleWord(word)} style={{ padding: '6px 12px', background: isWordBold(word) ? '#007AFF' : '#f0f0f0', color: isWordBold(word) ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: isWordBold(word) ? 'bold' : 'normal' }}>
                {isWordBold(word) ? '✓' : '○'} {word}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

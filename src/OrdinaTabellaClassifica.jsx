import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function OrdinaTabellaClassifica({ onClose, user }) {
  // Funzione di utilità per doppioni (deve stare fuori dal render JSX)
  function posizioneDoppia(pos, data) {
    if (!pos) return false;
    return data.filter(r => String(r.posizione) === String(pos)).length > 1;
  }
  const [templates, setTemplates] = useState([])
  const [inputHtml, setInputHtml] = useState('')
  const [outputHtml, setOutputHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [modalitaGara, setModalitaGara] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [templateSelezionato, setTemplateSelezionato] = useState(null)
  const [isNuovoTemplate, setIsNuovoTemplate] = useState(false)
  const [isEditingData, setIsEditingData] = useState(false)
  const [tableData, setTableData] = useState([])
  const [isModificaMode, setIsModificaMode] = useState(false)
  const [isPosizioniOrdinate, setIsPosizioniOrdinate] = useState(false)
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const [searchTerm, setSearchTerm] = useState('')

  // ✅ FIX 2: posizioniDuplicate calcolata a livello di componente, non dentro il .map()
  const posizioniDuplicate = tableData
    .map(r => r.posizione)
    .filter((v, i, arr) => v && arr.indexOf(v) !== i && arr.indexOf(v) < i)

  // Carica templates salvati al mount
  useEffect(() => {
    if (user && user.username) {
      caricaTemplates()
    }
  }, [user])

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function caricaTemplates() {
    // Ottieni l'auth user per il user_id
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    let query = supabase
      .from('ordina_tabella_templates')
      .select('*')
      .order('nome_template')
    
    // Filtra per user_id se disponibile (nuova struttura)
    // Fallback a username se user_id non c'è (migrazione graduale)
    if (authUser?.id) {
      query = query.eq('user_id', authUser.id)
    } else {
      query = query.eq('username', user.username)
    }

    const { data, error } = await query

    if (error) {
      console.error('Errore caricamento templates:', error)
      return
    }

    setTemplates(data || [])
  }

  // Apri template per editing dati
  function apriTemplate(template) {
    setTemplateSelezionato(template)
    setIsNuovoTemplate(false)
    setIsEditingData(true)
    setSearchTerm('')
    
    // Parsa il template HTML per estrarre i dati
    const parser = new DOMParser()
    const doc = parser.parseFromString(template.html_template, 'text/html')
    const rows = doc.querySelectorAll('tbody tr')
    
    const data = []
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 4) {
        data.push({
          id: `row-${index}-${Date.now()}`, // ID univoco e stabile
          posizione: '', // Vuoto per velocizzare
          pilota: cells[1].textContent.trim(),
          scuderia: cells[2].textContent.trim(),
          tempo: ''
        })
      }
    })
    
    // Ordina alfabeticamente per pilota
    data.sort((a, b) => a.pilota.localeCompare(b.pilota, 'it', { sensitivity: 'base' }))
    
    setTableData(data)
    setOutputHtml('')
    setShowPreview(false)
    setIsPosizioniOrdinate(false)
  }

  // Salva template
  async function salvaTemplate() {
    if (!templateName.trim() || !inputHtml.trim()) {
      alert('Inserisci un nome e incolla il codice HTML!')
      return
    }

    // Ottieni l'auth user per il user_id
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser?.id) {
      alert('❌ Errore: utente non autenticato')
      return
    }

    const { error } = await supabase
      .from('ordina_tabella_templates')
      .insert({
        username: user.username,
        user_id: authUser.id,
        nome_template: templateName.trim(),
        html_template: inputHtml
      })

    if (error) {
      console.error('Errore salvataggio template:', error)
      alert('❌ Errore nel salvataggio del template: ' + (error.message || 'Errore sconosciuto'))
      return
    }
    
    setTemplateName('')
    setShowSaveForm(false)
    alert(`✅ Template "${templateName.trim()}" salvato!`)
    caricaTemplates()
  }

  // Elimina template
  async function eliminaTemplate(id) {
    if (!confirm('Sei sicuro di voler eliminare questo template?')) return
    
    const { error } = await supabase
      .from('ordina_tabella_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Errore eliminazione template:', error)
      alert('❌ Errore nell\'eliminazione del template')
      return
    }

    caricaTemplates()
  }

  function ordinaTabella() {
    if (!inputHtml.trim()) {
      alert('Incolla prima il codice HTML della tabella!')
      return
    }

    // Parse HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(inputHtml, 'text/html')
    const rows = doc.querySelectorAll('tbody tr')

    if (rows.length === 0) {
      alert('Nessuna riga trovata nella tabella!')
      return
    }

    // Estrai dati
    const data = []
    rows.forEach(row => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 3) {
        data.push({
          posizione: parseInt(cells[0].textContent.trim()) || 999,
          pilota: cells[1].textContent.trim(),
          scuderia: cells[2].textContent.trim(),
          tempo: cells[3] ? cells[3].textContent.trim() : ''
        })
      }
    })

    // Ordina per posizione
    data.sort((a, b) => a.posizione - b.posizione)

    // Genera HTML
    let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n'
    html += '  <thead>\n'
    html += '    <tr>\n'
    html += '      <th>Posizione</th>\n'
    html += '      <th>Pilota</th>\n'
    html += '      <th>Scuderia</th>\n'
    html += '      <th>Tempo</th>\n'
    html += '    </tr>\n'
    html += '  </thead>\n'
    html += '  <tbody>\n'

    data.forEach(row => {
      html += `    <tr><td>${row.posizione}</td><td>${row.pilota}</td><td>${row.scuderia}</td><td>${row.tempo}</td></tr>\n`
    })

    html += '  </tbody>\n'
    html += '</table>'

    setOutputHtml(html)
    setShowPreview(true)

    // Scroll to output
    setTimeout(() => {
      document.getElementById('outputHtmlArea')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function ordinaDatiPerPosizione() {
    // Permetti ordinamento anche se non tutte le posizioni sono compilate
    // Non controllo più i tempi: si può ordinare anche se non sono tutti compilati

    const dataSorted = [...tableData].sort((a, b) => {
      const posA = parseInt(a.posizione) || 999
      const posB = parseInt(b.posizione) || 999
      return posA - posB
    })

    setTableData(dataSorted)
    setIsPosizioniOrdinate(true)
    setOutputHtml('')
    setShowPreview(false)
  }

  // Genera HTML dai dati editati
  function generaHtmlDaDati() {
    if (tableData.length === 0) {
      alert('Nessun dato da elaborare')
      return
    }

    if (!isPosizioniOrdinate) {
      alert('Prima ordina la griglia con il tasto ORDINA')
      return
    }

    // Genera HTML
    let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n'
    html += '  <thead>\n'
    html += '    <tr>\n'
    html += '      <th>Posizione</th>\n'
    html += '      <th>Pilota</th>\n'
    html += '      <th>Scuderia</th>\n'
    if (!modalitaGara) html += '      <th>Tempo</th>\n'
    html += '    </tr>\n'
    html += '  </thead>\n'
    html += '  <tbody>\n'

    tableData.forEach((row) => {
      html += `    <tr><td>${row.posizione}</td><td>${row.pilota}</td><td>${row.scuderia}</td>`
      if (!modalitaGara) html += `<td>${row.tempo}</td>`
      html += '</tr>\n'
    })

    html += '  </tbody>\n'
    html += '</table>'

    setOutputHtml(html)
    setShowPreview(true)

    // Scroll to output
    setTimeout(() => {
      document.getElementById('outputHtmlArea')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function copiaOutput() {
    if (!outputHtml) return

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(outputHtml).then(() => {
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      }).catch(() => {
        const textarea = document.createElement('textarea')
        textarea.value = outputHtml
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      })
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = outputHtml
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  function reset() {
    setInputHtml('')
    setOutputHtml('')
    setShowPreview(false)
    setCopySuccess(false)
    setTemplateName('')
    setShowSaveForm(false)
    setTemplateSelezionato(null)
  }

  // Vista lista template
  if (!templateSelezionato) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        overflowY: 'auto'
      }}>
        {/* Header con back button e bottone nuovo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#007AFF',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: 0
            }}
          >
            ← Indietro
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsModificaMode(!isModificaMode)}
              style={{
                background: isModificaMode ? '#10b981' : '#dc2626',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Modifica
            </button>

            <button
              onClick={() => {
                setInputHtml('')
                setTemplateSelezionato({ id: 'new' })
                setIsNuovoTemplate(true)
                setOutputHtml('')
                setShowPreview(false)
              }}
              style={{
                background: '#007AFF',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Aggiungi Template
            </button>
          </div>
        </div>

        {/* Titolo */}
        <h1 style={{ color: '#333', marginTop: 0, marginBottom: '30px', fontSize: '28px', textAlign: 'center' }}>Ordina Tabella Classifica</h1>

        {/* Grid di template */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginTop: '20px',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}>
          {templates.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>
              <p style={{ fontSize: '18px' }}>Nessun template salvato</p>
              <p style={{ color: '#bbb' }}>Clicca "Aggiungi Template" per crearne uno</p>
            </div>
          ) : (
            templates.map(template => (
              <div
                key={template.id}
                style={{
                  background: '#f8f9fa',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#007AFF'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,122,255,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* X per eliminare - visibile solo in modalità modifica */}
                {isModificaMode && (
                  <button
                    onClick={() => eliminaTemplate(template.id)}
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      width: '35px',
                      height: '35px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    ✕
                  </button>
                )}
                
                <button
                  onClick={() => apriTemplate(template)}
                  style={{
                    background: '#007AFF',
                    color: 'white',
                    border: 'none',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  {template.nome_template}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Vista editing dati (quando clicchi su un template salvato)
  if (isEditingData && templateSelezionato) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'url(/sfondo-fwm.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 20px',
        overflowY: 'auto'
      }}>
        <div style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          background: 'white',
          padding: '30px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          {/* Header */}
          <button
            onClick={() => {
              setTemplateSelezionato(null)
              setIsEditingData(false)
              setTableData([])
              setOutputHtml('')
              setShowPreview(false)
              setIsPosizioniOrdinate(false)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#007AFF',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '20px',
              padding: 0
            }}
          >
            ← Indietro
          </button>

          <h1 style={{ color: '#333', marginTop: 0, marginBottom: '10px', fontSize: '28px' }}>
            Modifica Template: {templateSelezionato.nome_template}
          </h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Step 1: inserisci le posizioni e premi ORDINA. Step 2: inserisci i tempi nella griglia ordinata e genera il codice.
          </p>

          {/* Search bar */}
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="🔍 Cerca pilota o scuderia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                boxSizing: 'border-box',
                transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007AFF'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
          </div>

          {/* Toggle Modalità GARA anche in modifica template */}
          <div style={{ margin: '10px 0 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setModalitaGara(v => !v)}
              style={{
                minWidth: 110,
                height: 38,
                borderRadius: 8,
                border: modalitaGara ? '2px solid #007AFF' : '2px solid #d1d5db',
                background: modalitaGara ? '#007AFF' : '#f3f4f6',
                color: modalitaGara ? '#fff' : '#374151',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all 0.15s',
                outline: 'none',
                boxShadow: modalitaGara ? '0 2px 8px rgba(0,122,255,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
                letterSpacing: 0.5,
                padding: '0 12px'
              }}
              aria-pressed={modalitaGara}
            >
              MODE GARA
            </button>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400, marginLeft: 4 }}>(solo posizioni)</span>
          </div>

          {/* Tabella input */}
          {!isMobileView ? (
            <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Posizione</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Pilota</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Scuderia</th>
                    {!modalitaGara && (
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tempo</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tableData
                    .filter(row =>
                      row.pilota.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      row.scuderia.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((row) => (
                      // ✅ FIX 1: rimosso il blocco JS illegale tra i <td>
                      <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => {
                              const newData = tableData.map(r =>
                                r.id === row.id ? { ...r, _posLocked: false } : r
                              )
                              setTableData(newData)
                            }}
                            disabled={!row._posLocked}
                            style={{
                              marginRight: 4,
                              background: row._posLocked ? '#f59e42' : '#eee',
                              color: row._posLocked ? '#fff' : '#bbb',
                              border: 'none',
                              borderRadius: 4,
                              width: 22,
                              height: 22,
                              cursor: row._posLocked ? 'pointer' : 'not-allowed',
                              fontWeight: 700,
                              fontSize: 14,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Sblocca posizione"
                          >
                            ⟳
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={row.posizione}
                            disabled={row._posLocked}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newData = tableData.map(r =>
                                r.id === row.id ? { ...r, posizione: val } : r
                              )
                              setTableData(newData)
                              setIsPosizioniOrdinate(false)
                              setOutputHtml('')
                              setShowPreview(false)
                            }}
                            onBlur={(e) => {
                              if (e.target.value && String(e.target.value).trim() !== '') {
                                let val = e.target.value;
                                if (Number(val) < 1) val = '1';
                                const newData = tableData.map(r =>
                                  r.id === row.id ? { ...r, posizione: val, _posLocked: true } : r
                                )
                                setTableData(newData)
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              background: row._posLocked ? '#f3f4f6' : 'white',
                              color: row._posLocked ? '#888' : '#222',
                              cursor: row._posLocked ? 'not-allowed' : 'text',
                              borderColor: posizioneDoppia(row.posizione, tableData) ? '#e11d48' : '#ddd',
                              boxShadow: posizioneDoppia(row.posizione, tableData) ? '0 0 0 2px #e11d4822' : 'none'
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{row.pilota}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{row.scuderia}</td>
                        {!modalitaGara && (
                          <td style={{ padding: '12px' }}>
                            <input
                              type="text"
                              value={row.tempo}
                              disabled={!isPosizioniOrdinate}
                              onChange={(e) => {
                                const newData = tableData.map(r =>
                                  r.id === row.id ? { ...r, tempo: e.target.value } : r
                                )
                                setTableData(newData)
                                setOutputHtml('')
                                setShowPreview(false)
                              }}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                background: isPosizioniOrdinate ? 'white' : '#f1f3f5',
                                cursor: isPosizioniOrdinate ? 'text' : 'not-allowed'
                              }}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            // ✅ FIX 3: aggiunto indice "i" al .map() della mobile view
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tableData
                .filter(row =>
                  row.pilota.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  row.scuderia.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((row, i) => (
                  <div key={row.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px', background: '#fff' }}>
                    <div style={{ marginBottom: '8px', fontWeight: '700', color: '#1f2937' }}>{row.pilota}</div>
                    <div style={{ marginBottom: '10px', fontSize: '13px', color: '#6b7280' }}>{row.scuderia}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Posizione</label>
                        <div style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          marginTop: '4px',
                          background: '#f9fafb',
                          textAlign: 'center',
                          fontWeight: 600
                        }}>{i + 1}</div>
                      </div>
                      {!modalitaGara && (
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280' }}>Tempo</label>
                          <input
                            type="text"
                            value={row.tempo}
                            disabled={!isPosizioniOrdinate}
                            onChange={(e) => {
                              const newData = tableData.map(r =>
                                r.id === row.id ? { ...r, tempo: e.target.value } : r
                              )
                              setTableData(newData)
                              setOutputHtml('')
                              setShowPreview(false)
                            }}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              marginTop: '4px',
                              background: isPosizioniOrdinate ? 'white' : '#f1f3f5',
                              cursor: isPosizioniOrdinate ? 'text' : 'not-allowed'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ✅ FIX 2: posizioniDuplicate ora è accessibile perché calcolata a livello di componente */}
          {posizioniDuplicate.length > 0 && (
            <div style={{ color: '#e11d48', fontWeight: 600, marginBottom: 10 }}>
              Attenzione: ci sono posizioni duplicate ({[...new Set(posizioniDuplicate)].join(', ')}).
            </div>
          )}

          {/* Pulsanti */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexDirection: isMobileView ? 'column' : 'row' }}>
            {!isPosizioniOrdinate ? (
              <button
                onClick={ordinaDatiPerPosizione}
                style={{
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  width: isMobileView ? '100%' : 'auto',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                ORDINA
              </button>
            ) : (
              <button
                onClick={generaHtmlDaDati}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  width: isMobileView ? '100%' : 'auto',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Genera HTML
              </button>
            )}
          </div>

          {/* Anteprima */}
          {showPreview && (
            <div style={{
              marginTop: '30px',
              padding: '20px',
              border: '2px solid #ddd',
              borderRadius: '4px',
              background: '#fafafa',
              marginBottom: '20px'
            }}>
              <h2 style={{ marginTop: 0, color: '#555', fontSize: '20px' }}>Anteprima Ordinata:</h2>
              <div dangerouslySetInnerHTML={{ __html: outputHtml }} />
              
              {/* Pulsante Copia sotto l'anteprima */}
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={copiaOutput}
                  style={{
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '12px 30px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Copia Output
                </button>

                {copySuccess && (
                  <span style={{ color: '#28a745', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    ✓ Copiato!
                  </span>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    )
  }

  // Vista ordinamento template
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: 'url(/sfondo-fwm.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px 20px',
      overflowY: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        {/* Pulsante Indietro Blu */}
        <button
          onClick={() => {
            setTemplateSelezionato(null)
            setIsNuovoTemplate(false)
            setInputHtml('')
            setOutputHtml('')
            setShowPreview(false)
            setTemplateName('')
            setShowSaveForm(false)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#007AFF',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '20px',
            padding: 0
          }}
        >
          ← Indietro
        </button>

        <h1 style={{ color: '#333', marginTop: 0, marginBottom: '10px', fontSize: '28px' }}>🏁 Ordina Tabella Classifica</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>Incolla il codice HTML della tabella qui sotto e clicca "Ordina"</p>

        {/* Templates salvati per accesso rapido */}
        {templates.length > 0 && !isNuovoTemplate && (
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #4a90e2' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#2563eb', fontSize: '16px' }}>📋 Carica Template</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setInputHtml(template.html_template)}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {template.nome_template}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={inputHtml}
          onChange={(e) => setInputHtml(e.target.value)}
          placeholder="Incolla qui il codice HTML della tabella..."
          style={{
            width: '100%',
            minHeight: '300px',
            padding: '15px',
            border: '2px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '13px',
            marginBottom: '15px',
            resize: 'vertical'
          }}
        />

        <div style={{ marginBottom: '20px' }}>
          {!isNuovoTemplate && (
            <>
              <button
                onClick={ordinaTabella}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  marginRight: '10px'
                }}
              >
                Ordina per Posizione
              </button>

              <button
                onClick={copiaOutput}
                disabled={!outputHtml}
                style={{
                  background: outputHtml ? '#28a745' : '#ccc',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '4px',
                  cursor: outputHtml ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  marginRight: '10px'
                }}
              >
                Copia Output
              </button>

              <button
                onClick={() => setShowSaveForm(!showSaveForm)}
                disabled={!inputHtml.trim()}
                style={{
                  background: inputHtml.trim() ? '#f59e0b' : '#ccc',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '4px',
                  cursor: inputHtml.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  marginRight: '10px'
                }}
              >
                Salva Template
              </button>

              <button
                onClick={reset}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Reset
              </button>

              {copySuccess && (
                <span style={{ color: '#28a745', marginLeft: '10px', fontWeight: 'bold' }}>
                  ✓ Copiato!
                </span>
              )}
            </>
          )}

          {isNuovoTemplate && (
            <>
              <button
                onClick={() => setShowSaveForm(!showSaveForm)}
                disabled={!inputHtml.trim()}
                style={{
                  background: inputHtml.trim() ? '#10b981' : '#ccc',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '4px',
                  cursor: inputHtml.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  marginRight: '10px'
                }}
              >
                Salva
              </button>
              
              <button
                onClick={() => {
                  setTemplateSelezionato(null)
                  setIsNuovoTemplate(false)
                  setInputHtml('')
                  setOutputHtml('')
                  setShowPreview(false)
                  setTemplateName('')
                  setShowSaveForm(false)
                }}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Annulla
              </button>
            </>
          )}
        </div>

        {/* Form salvataggio template */}
        {showSaveForm && (
          <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #f59e0b' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '16px' }}>💾 Salva come Template</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nome template (es: Formula 2, Formula 3...)"
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '2px solid #f59e0b',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => e.key === 'Enter' && salvaTemplate()}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#f59e0b', fontWeight: 500 }}>
                <input type="checkbox" checked={modalitaGara} onChange={e => setModalitaGara(e.target.checked)} style={{ marginRight: 4 }} />
                Modalità GARA (solo posizioni)
              </label>
              <button
                onClick={salvaTemplate}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Salva
              </button>
              <button
                onClick={() => { setShowSaveForm(false); setTemplateName('') }}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {showPreview && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            border: '2px solid #ddd',
            borderRadius: '4px',
            background: '#fafafa'
          }}>
            <h2 style={{ marginTop: 0, color: '#555', fontSize: '20px' }}>Anteprima Ordinata:</h2>
            <div dangerouslySetInnerHTML={{ __html: outputHtml }} />
          </div>
        )}

      </div>
    </div>
  )
}

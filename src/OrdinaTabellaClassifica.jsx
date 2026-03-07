import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Timing71Setup from './Timing71Setup'

export default function OrdinaTabellaClassifica({ onClose, user }) {
  function posizioneDoppia(pos, data) {
    if (!pos) return false
    return data.filter(r => String(r.posizione) === String(pos)).length > 1
  }

  function normalizzaNome(str) {
    if (!str) return ''
    const mappa = {
      'ł':'l','Ł':'l','ø':'o','Ø':'o','ß':'ss',
      'æ':'ae','Æ':'ae','œ':'oe','Œ':'oe',
      'đ':'d','Đ':'d','ħ':'h','Ħ':'h',
      'ı':'i','ĸ':'k','ŋ':'n','Ŋ':'n',
      'þ':'th','Þ':'th','ð':'d','Ð':'d'
    }
    return str
      .split('').map(c => mappa[c] || c).join('')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
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

  // ── Timing71 ─────────────────────────────────────────────────────────────
  const [showTiming71Setup, setShowTiming71Setup] = useState(false)
  const [showSyncPanel, setShowSyncPanel] = useState(false)
  const [timing71Sessions, setTiming71Sessions] = useState([])
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncMessage, setSyncMessage] = useState('')

  const posizioniDuplicate = tableData
    .map(r => r.posizione)
    .filter((v, i, arr) => v && arr.indexOf(v) !== i && arr.indexOf(v) < i)

  useEffect(() => {
    if (user && user.username) caricaTemplates()
  }, [user])

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function caricaTemplates() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    let query = supabase.from('ordina_tabella_templates').select('*').order('nome_template')
    if (authUser?.id) query = query.eq('user_id', authUser.id)
    else query = query.eq('username', user.username)
    const { data, error } = await query
    if (error) { console.error('Errore caricamento templates:', error); return }
    setTemplates(data || [])
  }

  // ── Carica sessioni Timing71 (con pulizia automatica > 24h) ───────────────
  async function caricaSessioniTiming71() {
    setSyncLoading(true)
    try {
      const u = JSON.parse(sessionStorage.getItem('user'))
      if (!u?.id) {
        setSyncStatus('error'); setSyncMessage('❌ Utente non autenticato')
        setSyncLoading(false); return
      }

      // Elimina sessioni più vecchie di 24 ore
      const ieri = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('timing71_import').delete()
        .eq('user_id', u.id)
        .lt('created_at', ieri)

      const { data, error } = await supabase
        .from('timing71_import')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        setSyncStatus('error'); setSyncMessage('❌ Errore: ' + error.message)
        setSyncLoading(false); return
      }
      setTiming71Sessions(data || [])
    } catch(e) {
      setSyncStatus('error'); setSyncMessage('❌ Errore lettura sessione')
    }
    setSyncLoading(false)
  }

  // ── Applica sessione Timing71 al tableData ────────────────────────────────
  function applicaSessione(sessione) {
    const importati = sessione.data
    if (!Array.isArray(importati) || importati.length === 0) {
      setSyncStatus('error'); setSyncMessage('❌ Nessun dato in questa sessione'); return
    }

    if (tableData.length > 0) {
      const aggiornati = tableData.map(row => {
        const match = importati.find(imp => {
          if (!imp.pilota) return false
          const nr = normalizzaNome(row.pilota)
          const ni = normalizzaNome(imp.pilota)
          return nr === ni ||
            nr.includes(ni) || ni.includes(nr) ||
            nr.split(' ').pop() === ni.split(' ').pop() ||
            nr.split(' ')[0] === ni.split(' ')[0]
        })
        if (match) return { ...row, posizione: match.posizione || row.posizione, tempo: match.tempo || row.tempo, _posLocked: !!match.posizione }
        return row
      })

      const matched = aggiornati.filter((r, i) =>
        r.posizione !== tableData[i].posizione || r.tempo !== tableData[i].tempo
      ).length

      setTableData(aggiornati)
      setIsPosizioniOrdinate(false); setOutputHtml(''); setShowPreview(false); setShowSyncPanel(false)

      if (matched === 0) { setSyncStatus('warning'); setSyncMessage(`⚠️ Nessun pilota trovato in comune. Controlla i nomi nel template.`) }
      else if (matched < tableData.length) { setSyncStatus('warning'); setSyncMessage(`⚠️ Aggiornati ${matched}/${tableData.length} piloti. Completa i rimanenti manualmente.`) }
      else { setSyncStatus('success'); setSyncMessage(`✅ Importati ${matched} piloti da "${sessione.session_name}"! Premi ORDINA.`) }
    } else {
      const nuoviDati = importati.map((imp, index) => ({
        id: `t71-${index}-${Date.now()}`,
        posizione: imp.posizione || '', pilota: imp.pilota || '',
        scuderia: imp.scuderia || '', tempo: imp.tempo || '',
        _posLocked: !!imp.posizione
      }))
      setTableData(nuoviDati)
      setIsPosizioniOrdinate(false); setOutputHtml(''); setShowPreview(false); setShowSyncPanel(false)
      setSyncStatus('success'); setSyncMessage(`✅ Caricati ${nuoviDati.length} piloti da "${sessione.session_name}"!`)
    }
  }

  async function eliminaSessione(id, e) {
    e.stopPropagation()
    if (!confirm('Eliminare questa sessione?')) return
    await supabase.from('timing71_import').delete().eq('id', id)
    caricaSessioniTiming71()
  }

  function apriTemplate(template) {
    setTemplateSelezionato(template); setIsNuovoTemplate(false)
    setIsEditingData(true); setSearchTerm('')
    const parser = new DOMParser()
    const doc = parser.parseFromString(template.html_template, 'text/html')
    const rows = doc.querySelectorAll('tbody tr')
    const data = []
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 4) {
        data.push({ id: `row-${index}-${Date.now()}`, posizione: '', pilota: cells[1].textContent.trim(), scuderia: cells[2].textContent.trim(), tempo: '' })
      }
    })
    data.sort((a, b) => a.pilota.localeCompare(b.pilota, 'it', { sensitivity: 'base' }))
    setTableData(data); setOutputHtml(''); setShowPreview(false)
    setIsPosizioniOrdinate(false); setSyncStatus(null); setSyncMessage('')
  }

  async function salvaTemplate() {
    if (!templateName.trim() || !inputHtml.trim()) { alert('Inserisci un nome e incolla il codice HTML!'); return }
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser?.id) { alert('❌ Errore: utente non autenticato'); return }
    const { error } = await supabase.from('ordina_tabella_templates').insert({
      username: user.username, user_id: authUser.id, nome_template: templateName.trim(), html_template: inputHtml
    })
    if (error) { alert('❌ Errore nel salvataggio: ' + (error.message || '')); return }
    setTemplateName(''); setShowSaveForm(false)
    alert(`✅ Template "${templateName.trim()}" salvato!`)
    caricaTemplates()
  }

  async function eliminaTemplate(id) {
    if (!confirm('Sei sicuro di voler eliminare questo template?')) return
    const { error } = await supabase.from('ordina_tabella_templates').delete().eq('id', id)
    if (error) { alert('❌ Errore eliminazione template'); return }
    caricaTemplates()
  }

  function ordinaTabella() {
    if (!inputHtml.trim()) { alert('Incolla prima il codice HTML della tabella!'); return }
    const parser = new DOMParser()
    const doc = parser.parseFromString(inputHtml, 'text/html')
    const rows = doc.querySelectorAll('tbody tr')
    if (rows.length === 0) { alert('Nessuna riga trovata nella tabella!'); return }
    const data = []
    rows.forEach(row => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 3) data.push({ posizione: parseInt(cells[0].textContent.trim()) || 999, pilota: cells[1].textContent.trim(), scuderia: cells[2].textContent.trim(), tempo: cells[3] ? cells[3].textContent.trim() : '' })
    })
    data.sort((a, b) => a.posizione - b.posizione)
    let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n'
    html += '  <thead>\n    <tr>\n      <th>Posizione</th>\n      <th>Pilota</th>\n      <th>Scuderia</th>\n      <th>Tempo</th>\n    </tr>\n  </thead>\n  <tbody>\n'
    data.forEach(row => { html += `    <tr><td>${row.posizione}</td><td>${row.pilota}</td><td>${row.scuderia}</td><td>${row.tempo}</td></tr>\n` })
    html += '  </tbody>\n</table>'
    setOutputHtml(html); setShowPreview(true)
  }

  function ordinaDatiPerPosizione() {
    const dataSorted = [...tableData].sort((a, b) => (parseInt(a.posizione) || 999) - (parseInt(b.posizione) || 999))
    setTableData(dataSorted); setIsPosizioniOrdinate(true); setOutputHtml(''); setShowPreview(false)
  }

  function generaHtmlDaDati() {
    if (tableData.length === 0) { alert('Nessun dato da elaborare'); return }
    if (!isPosizioniOrdinate) { alert('Prima ordina la griglia con il tasto ORDINA'); return }
    let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n'
    html += '  <thead>\n    <tr>\n      <th>Posizione</th>\n      <th>Pilota</th>\n      <th>Scuderia</th>\n'
    if (!modalitaGara) html += '      <th>Tempo</th>\n'
    html += '    </tr>\n  </thead>\n  <tbody>\n'
    tableData.forEach(row => {
      html += `    <tr><td>${row.posizione}</td><td>${row.pilota}</td><td>${row.scuderia}</td>`
      if (!modalitaGara) html += `<td>${row.tempo}</td>`
      html += '</tr>\n'
    })
    html += '  </tbody>\n</table>'
    setOutputHtml(html); setShowPreview(true)
    setTimeout(() => { document.getElementById('outputHtmlArea')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 100)
  }

  function copiaOutput() {
    if (!outputHtml) return
    const doFallback = () => {
      const ta = document.createElement('textarea'); ta.value = outputHtml
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000)
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(outputHtml).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000) }).catch(doFallback)
    } else doFallback()
  }

  function reset() {
    setInputHtml(''); setOutputHtml(''); setShowPreview(false)
    setCopySuccess(false); setTemplateName(''); setShowSaveForm(false); setTemplateSelezionato(null)
  }

  function formattaData(iso) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // ── Vista Setup Timing71 ──────────────────────────────────────────────────
  if (showTiming71Setup) {
    return <Timing71Setup onClose={() => setShowTiming71Setup(false)} user={user} />
  }

  // ── Vista Lista Template ──────────────────────────────────────────────────
  if (!templateSelezionato) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '10px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>← Indietro</button>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowTiming71Setup(true)}
              style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' }}>
              📡 Setup Timing71
            </button>
            <button onClick={() => setIsModificaMode(!isModificaMode)}
              style={{ background: isModificaMode ? '#10b981' : '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              Modifica
            </button>
            <button onClick={() => { setInputHtml(''); setTemplateSelezionato({ id: 'new' }); setIsNuovoTemplate(true); setOutputHtml(''); setShowPreview(false) }}
              style={{ background: '#007AFF', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
              Aggiungi Template
            </button>
          </div>
        </div>

        <h1 style={{ color: '#333', marginTop: 0, marginBottom: '30px', fontSize: '28px', textAlign: 'center' }}>Ordina Tabella Classifica</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          {templates.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>
              <p style={{ fontSize: '18px' }}>Nessun template salvato</p>
              <p style={{ color: '#bbb' }}>Clicca "Aggiungi Template" per crearne uno</p>
            </div>
          ) : (
            templates.map(template => (
              <div key={template.id}
                style={{ background: '#f8f9fa', border: '2px solid #e0e0e0', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#007AFF'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,122,255,0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {isModificaMode && (
                  <button onClick={() => eliminaTemplate(template.id)}
                    style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#dc2626', color: 'white', border: 'none', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>✕</button>
                )}
                <button onClick={() => apriTemplate(template)}
                  style={{ background: '#007AFF', color: 'white', border: 'none', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                  {template.nome_template}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Vista Editing Dati ────────────────────────────────────────────────────
  if (isEditingData && templateSelezionato) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>

          <button onClick={() => { setTemplateSelezionato(null); setIsEditingData(false); setTableData([]); setOutputHtml(''); setShowPreview(false); setIsPosizioniOrdinate(false); setSyncStatus(null); setShowSyncPanel(false) }}
            style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
            ← Indietro
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            <h1 style={{ color: '#333', marginTop: 0, marginBottom: 0, fontSize: '28px' }}>
              {templateSelezionato.nome_template}
            </h1>
            <button
              onClick={() => { setShowSyncPanel(v => !v); if (!showSyncPanel) caricaSessioniTiming71() }}
              style={{ background: showSyncPanel ? '#15803d' : '#16a34a', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
              🔄 Sincronizza Timing71
            </button>
          </div>

          <p style={{ color: '#666', marginBottom: '20px' }}>
            Step 1: inserisci le posizioni (o sincronizza da Timing71). Step 2: premi ORDINA. Step 3: inserisci i tempi e genera il codice.
          </p>

          {/* ── PANNELLO SYNC ── */}
          {showSyncPanel && (
            <div style={{ marginBottom: '24px', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#166534', fontSize: '17px' }}>📡 Sessioni Timing71 salvate</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={caricaSessioniTiming71} style={{ background: 'none', border: '1px solid #86efac', color: '#166534', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>↺ Aggiorna</button>
                  <button onClick={() => setShowTiming71Setup(true)} style={{ background: 'none', border: '1px solid #86efac', color: '#166534', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>⚙️ Setup</button>
                  <button onClick={() => setShowSyncPanel(false)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                </div>
              </div>

              {syncLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Caricamento...</div>
              ) : timing71Sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  <p style={{ marginBottom: '8px' }}>Nessuna sessione salvata.</p>
                  <p style={{ fontSize: '13px' }}>Usa il bookmarklet su timing71.org, poi aggiorna.</p>
                  <button onClick={() => setShowTiming71Setup(true)} style={{ marginTop: '10px', background: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    📡 Vai al Setup
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {timing71Sessions.map(sessione => (
                    <div key={sessione.id}
                      onClick={() => applicaSessione(sessione)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderRadius: '8px', border: '1px solid #d1fae5', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#6ee7b7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1fae5' }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#111', fontSize: '15px' }}>{sessione.session_name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {Array.isArray(sessione.data) ? sessione.data.length : 0} piloti · {formattaData(sessione.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#16a34a', color: 'white', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px' }}>Usa</span>
                        <button onClick={(e) => eliminaSessione(sessione.id, e)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '2px 6px', borderRadius: '4px' }}
                          title="Elimina">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messaggio stato sync */}
          {syncStatus && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '14px',
              background: syncStatus === 'success' ? '#dcfce7' : syncStatus === 'warning' ? '#fef9c3' : '#fee2e2',
              color: syncStatus === 'success' ? '#166534' : syncStatus === 'warning' ? '#854d0e' : '#991b1b',
              border: `1px solid ${syncStatus === 'success' ? '#86efac' : syncStatus === 'warning' ? '#fde047' : '#fca5a5'}`
            }}>
              {syncMessage}
            </div>
          )}

          {/* Search */}
          <div style={{ marginBottom: '20px' }}>
            <input type="text" placeholder="🔍 Cerca pilota o scuderia..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }}
              onFocus={(e) => e.target.style.borderColor = '#007AFF'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
          </div>

          {/* Toggle Modalità GARA */}
          <div style={{ margin: '10px 0 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setModalitaGara(v => !v)}
              style={{ minWidth: 110, height: 38, borderRadius: 8, border: modalitaGara ? '2px solid #007AFF' : '2px solid #d1d5db', background: modalitaGara ? '#007AFF' : '#f3f4f6', color: modalitaGara ? '#fff' : '#374151', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
              MODE GARA
            </button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>(solo posizioni)</span>
          </div>

          {/* Tabella - Desktop */}
          {!isMobileView ? (
            <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Posizione</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Pilota</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Scuderia</th>
                    {!modalitaGara && <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tempo</th>}
                  </tr>
                </thead>
                <tbody>
                  {tableData
                    .filter(row => row.pilota.toLowerCase().includes(searchTerm.toLowerCase()) || row.scuderia.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button type="button" onClick={() => setTableData(tableData.map(r => r.id === row.id ? { ...r, _posLocked: false } : r))}
                            disabled={!row._posLocked}
                            style={{ marginRight: 4, background: row._posLocked ? '#f59e42' : '#eee', color: row._posLocked ? '#fff' : '#bbb', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: row._posLocked ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Sblocca posizione">⟳</button>
                          <input type="number" min="1" value={row.posizione} disabled={row._posLocked}
                            onChange={(e) => { setTableData(tableData.map(r => r.id === row.id ? { ...r, posizione: e.target.value } : r)); setIsPosizioniOrdinate(false); setOutputHtml(''); setShowPreview(false) }}
                            onBlur={(e) => { if (e.target.value && String(e.target.value).trim() !== '') { let val = e.target.value; if (Number(val) < 1) val = '1'; setTableData(tableData.map(r => r.id === row.id ? { ...r, posizione: val, _posLocked: true } : r)) } }}
                            style={{ width: '100%', padding: '8px', border: '1px solid', borderRadius: '4px', fontSize: '14px', background: row._posLocked ? '#f3f4f6' : 'white', color: row._posLocked ? '#888' : '#222', cursor: row._posLocked ? 'not-allowed' : 'text', borderColor: posizioneDoppia(row.posizione, tableData) ? '#e11d48' : '#ddd', boxShadow: posizioneDoppia(row.posizione, tableData) ? '0 0 0 2px #e11d4822' : 'none' }}
                          />
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{row.pilota}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{row.scuderia}</td>
                        {!modalitaGara && (
                          <td style={{ padding: '12px' }}>
                            <input type="text" value={row.tempo} disabled={!isPosizioniOrdinate}
                              onChange={(e) => { setTableData(tableData.map(r => r.id === row.id ? { ...r, tempo: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', background: isPosizioniOrdinate ? 'white' : '#f1f3f5', cursor: isPosizioniOrdinate ? 'text' : 'not-allowed' }}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tableData
                .filter(row => row.pilota.toLowerCase().includes(searchTerm.toLowerCase()) || row.scuderia.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((row, i) => (
                  <div key={row.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px', background: '#fff' }}>
                    <div style={{ marginBottom: '8px', fontWeight: '700', color: '#1f2937' }}>{row.pilota}</div>
                    <div style={{ marginBottom: '10px', fontSize: '13px', color: '#6b7280' }}>{row.scuderia}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Posizione</label>
                        <div style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', marginTop: '4px', background: '#f9fafb', textAlign: 'center', fontWeight: 600 }}>{i + 1}</div>
                      </div>
                      {!modalitaGara && (
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280' }}>Tempo</label>
                          <input type="text" value={row.tempo} disabled={!isPosizioniOrdinate}
                            onChange={(e) => { setTableData(tableData.map(r => r.id === row.id ? { ...r, tempo: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', marginTop: '4px', background: isPosizioniOrdinate ? 'white' : '#f1f3f5', cursor: isPosizioniOrdinate ? 'text' : 'not-allowed' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {posizioniDuplicate.length > 0 && (
            <div style={{ color: '#e11d48', fontWeight: 600, marginBottom: 10 }}>
              ⚠️ Posizioni duplicate: {[...new Set(posizioniDuplicate)].join(', ')}
            </div>
          )}

          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexDirection: isMobileView ? 'column' : 'row' }}>
            {!isPosizioniOrdinate ? (
              <button onClick={ordinaDatiPerPosizione} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 30px', width: isMobileView ? '100%' : 'auto', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>ORDINA</button>
            ) : (
              <button onClick={generaHtmlDaDati} style={{ background: '#007bff', color: 'white', border: 'none', padding: '12px 30px', width: isMobileView ? '100%' : 'auto', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>Genera HTML</button>
            )}
          </div>

          {showPreview && (
            <div style={{ marginTop: '30px', padding: '20px', border: '2px solid #ddd', borderRadius: '4px', background: '#fafafa', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, color: '#555', fontSize: '20px' }}>Anteprima Ordinata:</h2>
              <div dangerouslySetInnerHTML={{ __html: outputHtml }} />
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                <button onClick={copiaOutput} style={{ background: '#28a745', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>Copia Output</button>
                {copySuccess && <span style={{ color: '#28a745', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>✓ Copiato!</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Vista ordinamento manuale ─────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <button onClick={() => { setTemplateSelezionato(null); setIsNuovoTemplate(false); setInputHtml(''); setOutputHtml(''); setShowPreview(false); setTemplateName(''); setShowSaveForm(false) }}
          style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
          ← Indietro
        </button>
        <h1 style={{ color: '#333', marginTop: 0, marginBottom: '10px', fontSize: '28px' }}>🏁 Ordina Tabella Classifica</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>Incolla il codice HTML della tabella qui sotto e clicca "Ordina"</p>
        {templates.length > 0 && !isNuovoTemplate && (
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #4a90e2' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#2563eb', fontSize: '16px' }}>📋 Carica Template</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {templates.map(template => (
                <button key={template.id} onClick={() => setInputHtml(template.html_template)}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                  {template.nome_template}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea value={inputHtml} onChange={(e) => setInputHtml(e.target.value)} placeholder="Incolla qui il codice HTML della tabella..."
          style={{ width: '100%', minHeight: '300px', padding: '15px', border: '2px solid #ddd', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '15px', resize: 'vertical' }}
        />
        <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {!isNuovoTemplate && (
            <>
              <button onClick={ordinaTabella} style={{ background: '#007bff', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>Ordina per Posizione</button>
              <button onClick={copiaOutput} disabled={!outputHtml} style={{ background: outputHtml ? '#28a745' : '#ccc', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '4px', cursor: outputHtml ? 'pointer' : 'not-allowed', fontSize: '16px' }}>Copia Output</button>
              <button onClick={() => setShowSaveForm(!showSaveForm)} disabled={!inputHtml.trim()} style={{ background: inputHtml.trim() ? '#f59e0b' : '#ccc', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '4px', cursor: inputHtml.trim() ? 'pointer' : 'not-allowed', fontSize: '16px' }}>Salva Template</button>
              <button onClick={reset} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>Reset</button>
              {copySuccess && <span style={{ color: '#28a745', fontWeight: 'bold', alignSelf: 'center' }}>✓ Copiato!</span>}
            </>
          )}
          {isNuovoTemplate && (
            <>
              <button onClick={() => setShowSaveForm(!showSaveForm)} disabled={!inputHtml.trim()} style={{ background: inputHtml.trim() ? '#10b981' : '#ccc', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '4px', cursor: inputHtml.trim() ? 'pointer' : 'not-allowed', fontSize: '16px' }}>Salva</button>
              <button onClick={() => { setTemplateSelezionato(null); setIsNuovoTemplate(false); setInputHtml(''); setOutputHtml(''); setShowPreview(false); setTemplateName(''); setShowSaveForm(false) }}
                style={{ background: '#6c757d', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>Annulla</button>
            </>
          )}
        </div>
        {showSaveForm && (
          <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #f59e0b' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '16px' }}>💾 Salva come Template</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Nome template (es: Formula 2, Formula 3...)"
                style={{ flex: 1, padding: '10px', border: '2px solid #f59e0b', borderRadius: '4px', fontSize: '14px', minWidth: '200px' }}
                onKeyPress={(e) => e.key === 'Enter' && salvaTemplate()}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#f59e0b', fontWeight: 500 }}>
                <input type="checkbox" checked={modalitaGara} onChange={e => setModalitaGara(e.target.checked)} style={{ marginRight: 4 }} />
                Modalità GARA
              </label>
              <button onClick={salvaTemplate} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Salva</button>
              <button onClick={() => { setShowSaveForm(false); setTemplateName('') }} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Annulla</button>
            </div>
          </div>
        )}
        {showPreview && (
          <div style={{ marginTop: '30px', padding: '20px', border: '2px solid #ddd', borderRadius: '4px', background: '#fafafa' }}>
            <h2 style={{ marginTop: 0, color: '#555', fontSize: '20px' }}>Anteprima Ordinata:</h2>
            <div dangerouslySetInnerHTML={{ __html: outputHtml }} />
          </div>
        )}
      </div>
    </div>
  )
}

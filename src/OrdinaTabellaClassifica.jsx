  // Importa solo le posizioni da una sessione Timing71, matchando per nome pilota
  function handleImportaSoloPosizioni(sessione) {
    if (!sessione || !Array.isArray(sessione.data)) return;
    // Crea una mappa nome pilota -> posizione dalla sessione Timing71
    const posMap = {};
    sessione.data.forEach(row => {
      const nomePilota = row.Pilota || row.DRIVER || row.Driver || row.pilota || row["Nome"] || row["NOME"] || row["driver"] || '';
      const posizione = row.Posizione || row.POS || row.posizione || row["Pos"] || row["POSIZIONE"] || row["pos"] || '';
      const key = chiavePilota(nomePilota)
      if (key && posizione) posMap[key] = posizione;
    });
    setTableData(prev => prev.map(r => {
      const key = chiavePilota(r.Pilota || r.pilota || r.PilotaRaw || '')
      if (key && posMap[key]) {
        // Aggiorna solo posizione, non toccare mai la scuderia
        return { 
          ...r, 
          posizione: posMap[key], 
          Posizione: posMap[key]
        };
      }
      return r;
    }));
    setSyncStatus('success');
    setSyncMessage('✅ Posizioni aggiornate solo per i piloti già presenti');
    setShowSyncPanel(false);
  }
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Timing71Setup from './Timing71Setup'

export default function OrdinaTabellaClassifica({ onClose, user }) {

  function capitalizzaNomePilota(nome) {
    if (!nome) return '';
    return nome.split(',').map(parte =>
      parte.trim().split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    ).join(', ');
  }

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

  function pilotaNomeCognome(nome) {
    if (!nome) return ''
    const raw = String(nome).trim()
    if (!raw) return ''
    if (raw.includes(',')) {
      const [cognome, nomeProprio] = raw.split(',').map(s => s.trim())
      const swapped = (nomeProprio && cognome) ? `${nomeProprio} ${cognome}` : raw
      return swapped
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
    return raw
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  function chiavePilota(nome) {
    return normalizzaNome(pilotaNomeCognome(nome))
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
  const MAIN_COLUMNS = ["Posizione", "Pilota", "Scuderia", "Best", "Tempo"]

  const COLUMN_MAP = {
    'POS': 'Posizione', 'NUM': 'Numero', 'STATE': 'Stato',
    'DRIVER': 'Pilota', 'TEAM': 'Scuderia', 'LAPS': 'Giri',
    'T': 'T', 'TS': 'TS', 'TA': 'TA', 'GAP': 'Gap',
    'INT': 'Intervallo', 'S1': 'S1', 'S2': 'S2', 'S3': 'S3',
    'SPD': 'Velocità', 'LAST': 'Tempo', 'BEST': 'Best', 'PITS': 'Pits',
    'Track Temp': 'Temp Pista', 'Air Temp': 'Temp Aria',
    'Wind Speed': 'Vento', 'Direction': 'Direzione Vento',
    'Humidity': 'Umidità', 'Pressure': 'Pressione',
    'Track': 'Tracciato', 'Visible': 'Visible',
    'Column': 'Column', 'Description': 'Description'
  }
  const REVERSE_COLUMN_MAP = Object.fromEntries(
    Object.entries(COLUMN_MAP).map(([k, v]) => [v, k])
  )

  const [showColonneModal, setShowColonneModal] = useState(false)
  const [colonneVisibili, setColonneVisibili] = useState([...MAIN_COLUMNS])
  const [tableColumns, setTableColumns] = useState(MAIN_COLUMNS)
  const [extraColumns, setExtraColumns] = useState([])
  const [isModificaMode, setIsModificaMode] = useState(false)
  const [isPosizioniOrdinate, setIsPosizioniOrdinate] = useState(false)
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (modalitaGara) {
      setColonneVisibili(["Posizione", "Pilota", "Scuderia"])
    } else {
      setColonneVisibili([...MAIN_COLUMNS])
    }
  }, [modalitaGara])

  const [showRemoveMode, setShowRemoveMode] = useState(false)

  // ── Timing71 ──────────────────────────────────────────────────────────────
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
    const { data, error } = await supabase.from('ordina_tabella_templates').select('*').order('nome_template')
    if (error) { console.error('Errore caricamento templates:', error); return }
    setTemplates(data || [])
  }

  // ── FIX #2: apriTemplate aggiunta (era mancante) ─────────────────────────
  function apriTemplate(template, inModificaMode = false) {
    setInputHtml(template.html_template || '')
    setTemplateSelezionato(template)
    setIsNuovoTemplate(false)
    setOutputHtml('')
    setShowPreview(false)
    setIsPosizioniOrdinate(false)
    setSyncStatus(null)
    setShowSyncPanel(false)
    setIsModificaMode(inModificaMode) // Imposta modalità modifica se richiesto

    // Parsa l'HTML del template per ricostruire tableData
    const parser = new DOMParser()
    const doc = parser.parseFromString(template.html_template || '', 'text/html')
    const headers = Array.from(doc.querySelectorAll('thead th')).map(th => th.textContent.trim())
    const rows = doc.querySelectorAll('tbody tr')

    if (rows.length > 0 && headers.length > 0) {
      const data = Array.from(rows).map((row, idx) => {
        const cells = row.querySelectorAll('td')
        const obj = { id: `row-${idx}-${Date.now()}`, _posLocked: false }
        headers.forEach((header, i) => {
          // Carica tutto dal template tranne posizione e tempi
          if (header !== 'Posizione' && header !== 'posizione' && header !== 'POS' &&
              header !== 'Tempo' && header !== 'tempo' && header !== 'Best' && header !== 'best') {
            obj[header] = cells[i] ? cells[i].textContent.trim() : ''
          }
        })
        // Posizione e tempi vuoti all'apertura
        obj.posizione = ''
        obj.Posizione = ''
        obj.Tempo = ''
        obj.tempo = ''
        obj.Best = ''
        obj.best = ''
        // Alias minuscoli per compatibilità
        obj.pilota = obj['Pilota'] || ''
        obj.scuderia = obj['Scuderia'] || ''
        return obj
      })
      setTableData(data)

      const extraCols = headers.filter(h => !MAIN_COLUMNS.includes(h))
      setTableColumns([...MAIN_COLUMNS, ...extraCols])
      setExtraColumns(extraCols)
    }

    setIsEditingData(true)
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

  // ── FIX #3: eliminaSessione aggiunta (era mancante) ──────────────────────
  async function eliminaSessione(id, e) {
    e.stopPropagation()
    if (!confirm('Eliminare questa sessione Timing71?')) return
    const { error } = await supabase.from('timing71_import').delete().eq('id', id)
    if (error) { alert('❌ Errore eliminazione sessione'); return }
    setTiming71Sessions(prev => prev.filter(s => s.id !== id))
  }

  // ── FIX #1: applicaSessione riscritta correttamente ──────────────────────
  function applicaSessione(sessione) {
    const LOCAL_COLUMN_MAP = {
      'Pos': 'Posizione', 'Driver': 'Pilota', 'Team': 'Scuderia',
      'Laps': 'Giri', 'Gap': 'Gap', 'Best': 'Best', 'Last': 'Tempo',
      'Pits': 'Pits', 'State': 'Stato', 'Num Jump to:': 'Numero',
      'T': 'T', 'TS': 'TS', 'TA': 'TA', 'Int': 'Intervallo',
      'S1': 'S1', 'S2': 'S2', 'S3': 'S3', 'Spd': 'Velocità',
    }
    const LOCAL_REVERSE_MAP = Object.fromEntries(
      Object.entries(LOCAL_COLUMN_MAP).map(([k, v]) => [v, k])
    )

    const importati = sessione.data
    if (!Array.isArray(importati) || importati.length === 0) {
      setSyncStatus('error'); setSyncMessage('❌ Nessun dato in questa sessione'); return
    }

    // Costruisce lista colonne da tutti i dati importati
    const allColumnsRaw = Array.from(new Set(importati.flatMap(obj => Object.keys(obj))))
    const mappedColumns = allColumnsRaw.map(col => LOCAL_COLUMN_MAP[col] || col)
    const allColumns = Array.from(new Set([
      ...MAIN_COLUMNS,
      ...mappedColumns.filter(col => !MAIN_COLUMNS.includes(col))
    ]))

    setTableColumns(allColumns)
    setExtraColumns(allColumns.filter(col => !MAIN_COLUMNS.includes(col)))
    setColonneVisibili(["Posizione", "Pilota", "Scuderia", "Best"])

    // Utility: normalizza chiave (solo alfanumerici minuscoli)
    const normalizeKey = key => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    // Helper: ricerca tollerante tra le chiavi dell'oggetto (case-insensitive + rimozione punteggiatura)
    const getVal = (obj, ...keys) => {
      for (const k of keys) {
        const nk = normalizeKey(k)
        for (const key of Object.keys(obj)) {
          if (normalizeKey(key) === nk) {
            return (obj[key] || '').trim()
          }
        }
      }
      return ''
    }

    const parsePos = (v) => {
      if (v === null || v === undefined) return null
      const raw = String(v).trim()
      if (!raw) return null
      const m = raw.match(/\d+/)
      if (!m) return null
      const n = parseInt(m[0], 10)
      return Number.isFinite(n) ? n : null
    }

    const getCellsFromCols = (imp) => {
      const entries = Object.entries(imp || {})
        .map(([k, v]) => {
          const m = String(k).match(/^COL_(\d+)$/i)
          if (!m) return null
          return { idx: parseInt(m[1], 10), value: (v ?? '').toString().trim() }
        })
        .filter(Boolean)
        .sort((a, b) => a.idx - b.idx)
      return entries.map(e => e.value)
    }

    const inferFieldsFromCols = (imp) => {
      const cells = getCellsFromCols(imp)
      if (!cells.length) return { pos: '', driver: '', team: '', last: '', best: '' }

      let posIdx = -1
      let driverIdx = -1
      let teamIdx = -1
      let lastIdx = -1
      let bestIdx = -1

      for (let i = 0; i < cells.length; i++) {
        const v = cells[i]
        if (posIdx === -1 && /^\d{1,2}$/.test(v)) posIdx = i
        if (driverIdx === -1 && (String(v).includes(',') || /^[A-Z\s]+$/i.test(v))) driverIdx = i
      }
      if (driverIdx !== -1 && driverIdx + 1 < cells.length) teamIdx = driverIdx + 1

      // tempi: spesso sono verso destra; prendo gli ultimi 2 valori che sembrano "mm:ss" o "hh:mm:ss" o simili
      const isTime = (s) => /^\d{1,2}:\d{2}(?:\.\d+)?$/.test(String(s || '').trim()) || /^\d{1,2}:\d{2}:\d{2}$/.test(String(s || '').trim())
      for (let i = cells.length - 1; i >= 0; i--) {
        if (lastIdx === -1 && isTime(cells[i])) { lastIdx = i; continue }
        if (lastIdx !== -1 && bestIdx === -1 && isTime(cells[i])) { bestIdx = i; break }
      }

      return {
        pos: posIdx !== -1 ? cells[posIdx] : '',
        driver: driverIdx !== -1 ? cells[driverIdx] : '',
        team: teamIdx !== -1 ? cells[teamIdx] : '',
        last: lastIdx !== -1 ? cells[lastIdx] : '',
        best: bestIdx !== -1 ? cells[bestIdx] : '',
      }
    }

    // Filtra solo piloti validi (posizione numerica + pilota + scuderia presenti)
    const validi = importati.filter(imp => {
      const inferred = inferFieldsFromCols(imp)
      const pos      = getVal(imp, 'POS', 'Pos', 'pos', 'posizione') || inferred.pos
      const pilotaRaw = getVal(imp, 'DRIVER', 'Driver', 'pilota') || inferred.driver
      const scuderia  = getVal(imp, 'TEAM', 'Team', 'scuderia') || inferred.team
      return parsePos(pos) !== null && !!normalizzaNome(pilotaRaw)
    })

    if (validi.length === 0) {
      const first = importati && importati[0] ? importati[0] : null
      const keys = first ? Object.keys(first) : []
      alert('❌ Nessun pilota valido trovato nell\'importazione. I dati esistenti non sono stati toccati.')
      console.warn('[Timing71] Import fallito: nessuna riga valida', { firstRowKeys: keys, firstRow: first })
      return
    }

    // Crea mappa dei piloti importati per matching
    const pilotiImportati = validi.map((imp, index) => {
      const inferred = inferFieldsFromCols(imp)
      const posizioneRaw = getVal(imp, 'POS', 'Pos', 'pos', 'posizione') || inferred.pos
      const posParsed = parsePos(posizioneRaw)
      const posizione = posParsed !== null ? String(posParsed) : (posizioneRaw || '')
      const pilotaRaw = getVal(imp, 'DRIVER', 'Driver', 'pilota') || inferred.driver
      const key = chiavePilota(pilotaRaw)

      // Conversione: se formato "Cognome, Nome" => "Nome Cognome"
      let pilota = pilotaRaw;
      if (pilotaRaw && pilotaRaw.includes(',')) {
        const [cognome, nome] = pilotaRaw.split(',').map(s => s.trim());
        pilota = nome && cognome ? `${nome} ${cognome}` : pilotaRaw;
      }
      // Capitalizza ogni parola
      pilota = pilota.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

      return {
        key,
        pilota,
        pilotaRaw,
        posizione,
        tempo: getVal(imp, 'LAST', 'Last', 'tempo') || inferred.last || '',
        best: getVal(imp, 'BEST', 'Best', 'best') || inferred.best || ''
      }
    })

    // Aggiorna solo i piloti esistenti che matchano, NON aggiungere nuovi piloti
    const datiAggiornati = tableData.map(esistente => {
      const keyEsistente = chiavePilota(esistente.Pilota || esistente.pilota || esistente.PilotaRaw || '')
      const importato = pilotiImportati.find(p => p.key === keyEsistente)

      if (importato) {
        // Pilota matchato: aggiorna solo posizione e tempi, MANTIENI TUTTO il resto incluso Pilota, Scuderia/Team
        const aggiornato = { ...esistente }
        aggiornato.Posizione = importato.posizione
        aggiornato.posizione = importato.posizione
        aggiornato.Tempo = importato.tempo
        aggiornato.Best = importato.best
        // Pilota, Scuderia, Team e tutte le altre colonne NON vengono toccati
        return aggiornato
      }

      // Pilota non matchato: mantieni TUTTO come è
      return esistente
    })

    // Ordina per posizione
    const datiOrdinati = datiAggiornati.sort((a, b) => {
      const posA = parseInt(a.posizione) || 999
      const posB = parseInt(b.posizione) || 999
      return posA - posB
    })

    setTableData(datiOrdinati)
    setSyncStatus('success')
    setSyncMessage(`✅ ${nuovi.length} piloti importati da Timing71`)
    setShowSyncPanel(false)
  }

  async function salvaTemplate() {
    if (!templateName.trim() || !inputHtml.trim()) { alert('Inserisci un nome e incolla il codice HTML!'); return }
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser?.id) { alert('❌ Errore: utente non autenticato'); return }
    const { error } = await supabase.from('ordina_tabella_templates').insert({
      username: user.username, user_id: authUser.id,
      nome_template: templateName.trim(), html_template: inputHtml
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

  async function aggiornaTemplate() {
    if (!templateSelezionato?.id) { alert('❌ Nessun template selezionato'); return }

    console.log('[aggiornaTemplate] Template selezionato:', templateSelezionato)
    console.log('[aggiornaTemplate] tableData:', tableData)
    console.log('[aggiornaTemplate] tableColumns:', tableColumns)
    console.log('[aggiornaTemplate] extraColumns:', extraColumns)

    // Genera HTML dai dati modificati, ma NON includere tempi e posizione
    const headers = Array.from(new Set([...tableColumns, ...extraColumns]))
    console.log('[aggiornaTemplate] Headers:', headers)

    let html = '<table>\n<thead>\n<tr>\n'
    headers.forEach(h => { html += `<th>${h}</th>\n` })
    html += '</tr>\n</thead>\n<tbody>\n'
    tableData.forEach(row => {
      html += '<tr>\n'
      headers.forEach(h => {
        // NON salvare tempi e posizione
        if (h !== 'Tempo' && h !== 'Best' && h !== 'Posizione' && h !== 'posizione' && h !== 'POS') {
          const value = row[h] || ''
          html += `<td>${value}</td>\n`
        } else {
          html += `<td></td>\n` // Cella vuota per tempi e posizione
        }
      })
      html += '</tr>\n'
    })
    html += '</tbody>\n</table>'

    console.log('[aggiornaTemplate] HTML generato:', html)
    console.log('[aggiornaTemplate] ID template:', templateSelezionato.id)

    const { error } = await supabase.from('ordina_tabella_templates').update({
      html_template: html
    }).eq('id', templateSelezionato.id)

    console.log('[aggiornaTemplate] Errore Supabase:', error)

    if (error) { alert('❌ Errore nel salvataggio: ' + (error.message || '')); return }
    alert(`✅ Template "${templateSelezionato.nome_template}" aggiornato!`)
    setInputHtml(html)
    // Ricarica i dati per assicurarsi che siano sincronizzati
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const newHeaders = Array.from(doc.querySelectorAll('thead th')).map(th => th.textContent.trim())
    const newRows = doc.querySelectorAll('tbody tr')

    if (newRows.length > 0 && newHeaders.length > 0) {
      const data = Array.from(newRows).map((row, idx) => {
        const cells = row.querySelectorAll('td')
        const obj = { id: `row-${idx}-${Date.now()}`, _posLocked: false }
        newHeaders.forEach((header, i) => {
          if (header !== 'Posizione' && header !== 'posizione' && header !== 'POS') {
            obj[header] = cells[i] ? cells[i].textContent.trim() : ''
          }
        })
        obj.posizione = ''
        obj.Posizione = ''
        obj.pilota = obj['Pilota'] || ''
        obj.scuderia = obj['Scuderia'] || ''
        obj.tempo = obj['Tempo'] || ''
        return obj
      })
      setTableData(data)
      const newExtraCols = newHeaders.filter(h => !MAIN_COLUMNS.includes(h))
      setTableColumns([...MAIN_COLUMNS, ...newExtraCols])
      setExtraColumns(newExtraCols)
    }
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
      if (cells.length >= 3) data.push({
        posizione: parseInt(cells[0].textContent.trim()) || 999,
        pilota: cells[1].textContent.trim(),
        scuderia: cells[2].textContent.trim(),
        tempo: cells[3] ? cells[3].textContent.trim() : ''
      })
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
    const columns = colonneVisibili
    let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n'
    html += '  <thead>\n    <tr>'
    columns.forEach(col => { html += `<th>${col}</th>` })
    html += '</tr>\n  </thead>\n  <tbody>\n'
    tableData.forEach((row) => {
      html += '    <tr>'
      columns.forEach(col => {
        let value = row[col] !== undefined ? row[col] : ''
        if (col === 'Pilota') {
          value = row.Pilota || pilotaNomeCognome(row.PilotaRaw || row.pilota || value)
        }
        html += `<td>${value}</td>`
      })
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
      navigator.clipboard.writeText(outputHtml)
        .then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000) })
        .catch(doFallback)
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

        <h1 style={{ color: '#333', marginTop: 0, marginBottom: '30px', fontSize: '28px', textAlign: 'center' }}>Tabella HTML</h1>

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
                <button onClick={() => apriTemplate(template, isModificaMode)}
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', padding: isMobileView ? '20px 0' : '40px 20px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', background: 'white', padding: isMobileView ? '20px' : '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>

          <button onClick={() => { setTemplateSelezionato(null); setIsEditingData(false); setTableData([]); setOutputHtml(''); setShowPreview(false); setIsPosizioniOrdinate(false); setSyncStatus(null); setShowSyncPanel(false) }}
            style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
            ← Indietro
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            <h1 style={{ color: '#333', marginTop: 0, marginBottom: 0, fontSize: '28px' }}>
              {templateSelezionato.nome_template}
            </h1>
            <div style={{ display: 'flex', gap: '10px', flexDirection: isMobileView ? 'column' : 'row', flexWrap: isMobileView ? 'nowrap' : 'nowrap', width: isMobileView ? '100%' : 'auto' }}>
              <button
                onClick={() => { setShowSyncPanel(v => !v); if (!showSyncPanel) caricaSessioniTiming71() }}
                style={{ background: showSyncPanel ? '#15803d' : '#16a34a', color: 'white', border: 'none', padding: isMobileView ? '12px' : '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobileView ? '14px' : '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(22,163,74,0.3)', width: isMobileView ? '100%' : 'auto' }}>
                🔄 Sincronizza Timing71
              </button>
              {isModificaMode && (
                <>
                  <button
                    onClick={() => setTableData([...tableData, { id: `new-${Date.now()}`, Pilota: '', Scuderia: '', posizione: '', Posizione: '', Tempo: '', Best: '', _posLocked: false }])}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: isMobileView ? '12px' : '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobileView ? '14px' : '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap', width: isMobileView ? '100%' : 'auto' }}>
                    ➕ Aggiungi pilota
                  </button>
                  <button
                    onClick={aggiornaTemplate}
                    style={{ background: '#10b981', color: 'white', border: 'none', padding: isMobileView ? '12px' : '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobileView ? '14px' : '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap', width: isMobileView ? '100%' : 'auto' }}>
                    💾 Salva modifiche
                  </button>
                </>
              )}
            </div>
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
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderRadius: '8px', border: '1px solid #d1fae5', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#6ee7b7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1fae5' }}
                    >
                      <div onClick={() => applicaSessione(sessione)} style={{ flex: 1, cursor: 'pointer' }}>
                        <div style={{ fontWeight: 700, color: '#111', fontSize: '15px' }}>{sessione.session_name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {Array.isArray(sessione.data) ? sessione.data.length : 0} piloti · {formattaData(sessione.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#16a34a', color: 'white', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', cursor: 'pointer' }} onClick={() => applicaSessione(sessione)}>Usa</span>
                        <button onClick={(e) => eliminaSessione(sessione.id, e)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '2px 6px', borderRadius: '4px' }}
                          title="Elimina">✕</button>
                        <button onClick={() => handleImportaSoloPosizioni(sessione)}
                          style={{ background: '#2563eb', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          title="Importa solo posizioni">
                          Solo posizioni
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
            <button type="button" onClick={() => {
              setModalitaGara(v => {
                const next = !v
                if (next) setColonneVisibili(["Posizione", "Pilota", "Scuderia"])
                return next
              })
            }}
              style={{ minWidth: 110, height: 38, borderRadius: 8, border: modalitaGara ? '2px solid #007AFF' : '2px solid #d1d5db', background: modalitaGara ? '#007AFF' : '#f3f4f6', color: modalitaGara ? '#fff' : '#374151', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
              MODE GARA
            </button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>(solo posizioni)</span>
          </div>

          {/* Toggle colonne */}
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setShowColonneModal(true)}
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
            >
              Seleziona colonne da mostrare
            </button>
          </div>

          {/* Modale selezione colonne */}
          {showColonneModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', borderRadius: 12, padding: 24, minWidth: 520, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', maxWidth: 700, maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginTop: 0, marginBottom: 18, fontSize: 20, color: '#2563eb' }}>Colonne visibili</h3>
                <form style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                    {[...new Set([...tableColumns, ...extraColumns])].map((col) => (
                      <div key={col} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={colonneVisibili.includes(col)}
                          onChange={e => {
                            if (e.target.checked) setColonneVisibili(prev => Array.from(new Set([...prev, col])))
                            else setColonneVisibili(prev => prev.filter(c => c !== col))
                          }}
                          id={"chk-"+col}
                        />
                        <label htmlFor={"chk-"+col} style={{ fontSize: 15 }}>{col}</label>
                      </div>
                    ))}
                  </div>
                  {[...new Set([...tableColumns, ...extraColumns])].length === MAIN_COLUMNS.length && (
                    <div style={{ color: '#888', fontSize: 14, marginTop: 10 }}>Non ci sono colonne extra. Puoi aggiungerle manualmente o tramite import.</div>
                  )}
                </form>
                <div style={{ display: 'flex', gap: 12, marginTop: 18, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowColonneModal(false)} style={{ background: '#64748b', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Chiudi</button>
                </div>
              </div>
            </div>
          )}

          {/* Tabella - Desktop */}
          {!isMobileView ? (
            <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {isModificaMode && (
                      <th key="azioni" style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd', width: '60px' }}>Azioni</th>
                    )}
                    {Array.from(new Set([
                      ...tableColumns.filter(col => col !== "Tempo" || !modalitaGara),
                      ...extraColumns
                    ])).filter(col => colonneVisibili.includes(col)).map((col, idx) => (
                      <th key={col+idx} style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', background: extraColumns.includes(col) ? '#f3f4f6' : undefined, color: extraColumns.includes(col) ? '#64748b' : undefined }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData
                    .filter(row => Array.from(new Set([...tableColumns, ...extraColumns])).some(col => (row[col] || '').toLowerCase().includes(searchTerm.toLowerCase())))
                    .map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                        {isModificaMode && (
                          <td key="azioni" style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => setTableData(tableData.filter(r => r.id !== row.id))}
                              style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                              title="Cancella pilota"
                            >
                              ✕
                            </button>
                          </td>
                        )}
                        {Array.from(new Set([
                          ...tableColumns.filter(col => col !== "Tempo" || !modalitaGara),
                          ...extraColumns
                        ])).filter(col => colonneVisibili.includes(col)).map((col, idx) => {
                          if (col === "Posizione") {
                            return (
                              <td key={col+idx} style={{ padding: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button type="button" onClick={() => setTableData(tableData.map(r => r.id === row.id ? { ...r, _posLocked: false } : r))}
                                  disabled={!row._posLocked}
                                  style={{ marginRight: 4, background: row._posLocked ? '#f3f4f6' : '#eee', color: row._posLocked ? '#888' : '#bbb', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: row._posLocked ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Sblocca posizione">⟳</button>
                                <input type="number" min="1" value={row.posizione || row["Posizione"] || ''}
                                  disabled={row._posLocked}
                                  onChange={(e) => { setTableData(tableData.map(r => r.id === row.id ? { ...r, posizione: e.target.value, [col]: e.target.value } : r)); setIsPosizioniOrdinate(false); setOutputHtml(''); setShowPreview(false) }}
                                  onBlur={(e) => { if (e.target.value && String(e.target.value).trim() !== '') { let val = e.target.value; if (Number(val) < 1) val = '1'; setTableData(tableData.map(r => r.id === row.id ? { ...r, posizione: val, [col]: val, _posLocked: true } : r)) } }}
                                  style={{ width: '100%', padding: '8px', border: '1px solid', borderRadius: '4px', fontSize: '14px', background: row._posLocked ? '#f3f4f6' : 'white', color: row._posLocked ? '#888' : '#222', cursor: row._posLocked ? 'not-allowed' : 'text', borderColor: posizioneDoppia(row.posizione || row["Posizione"], tableData) ? '#e11d48' : '#ddd', boxShadow: posizioneDoppia(row.posizione || row["Posizione"], tableData) ? '0 0 0 2px #e11d4822' : 'none' }}
                                />
                              </td>
                            )
                          }
                          if (col === "Pilota") {
                            return (
                              <td key={col+idx} style={{ padding: '12px', fontSize: '14px' }}>
                                {isModificaMode ? (
                                  <input
                                    type="text"
                                    value={row.PilotaRaw || row.Pilota || row[col] || ''}
                                    onChange={e => { setTableData(tableData.map(r => r.id === row.id ? { ...r, Pilota: e.target.value, PilotaRaw: e.target.value, [col]: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                                  />
                                ) : (
                                  <span>{row.PilotaRaw || row.Pilota || row[col] || ''}</span>
                                )}
                              </td>
                            )
                          }
                          if (col === "Scuderia") {
                            return (
                              <td key={col+idx} style={{ padding: '12px', fontSize: '14px' }}>
                                {isModificaMode ? (
                                  <input
                                    type="text"
                                    value={row[col] || ''}
                                    onChange={e => { setTableData(tableData.map(r => r.id === row.id ? { ...r, [col]: e.target.value, scuderia: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                                  />
                                ) : (
                                  <span>{row[col]}</span>
                                )}
                              </td>
                            )
                          }
                          if (col === "Tempo" && modalitaGara) return null
                          const tuttePosizioniOk = tableData.every(r => (r.posizione || r["Posizione"]) && String(r.posizione || r["Posizione"]).trim() !== '')
                          const isTempo = col === "Tempo"
                          const isTempoLocked = isTempo && !tuttePosizioniOk
                          return (
                            <td key={col+idx} style={{ padding: '12px', fontSize: '14px', background: extraColumns.includes(col) ? 'white' : undefined }}>
                              <input
                                type={col.toLowerCase().includes('pos') ? 'number' : 'text'}
                                value={row[col] || ''}
                                onChange={e => { setTableData(tableData.map(r => r.id === row.id ? { ...r, [col]: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', background: isTempoLocked ? '#f3f4f6' : 'white', color: isTempoLocked ? '#888' : '#222', cursor: isTempoLocked ? 'not-allowed' : 'text' }}
                                disabled={isTempoLocked}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tableData
                .filter(row => tableColumns.some(col => (row[col] || '').toLowerCase().includes(searchTerm.toLowerCase())))
                .map((row) => (
                  <div key={row.id} style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '16px', background: '#fff', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'relative' }}>
                    {isModificaMode && (
                      <button
                        onClick={() => setTableData(tableData.filter(r => r.id !== row.id))}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: '#dc2626', color: 'white', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Cancella pilota"
                      >
                        ✕
                      </button>
                    )}
                    <div style={{ fontWeight: 700, fontSize: '17px', color: '#222', marginBottom: 2 }}>
                      {isModificaMode ? (
                        <input
                          type="text"
                          value={row.PilotaRaw || row.Pilota || row.pilota || ''}
                          onChange={e => { setTableData(tableData.map(r => r.id === row.id ? { ...r, Pilota: e.target.value, PilotaRaw: e.target.value, pilota: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold' }}
                        />
                      ) : (
                        <span>{row.PilotaRaw || row.Pilota || row.pilota || ''}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: 10 }}>
                      {isModificaMode ? (
                        <input
                          type="text"
                          value={row.Scuderia || row.scuderia || ''}
                          onChange={e => { setTableData(tableData.map(r => r.id === row.id ? { ...r, Scuderia: e.target.value, scuderia: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                        />
                      ) : (
                        <span>{row.Scuderia || row.scuderia}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Posizione</label>
                        <input type="number" min="1" value={row.posizione || row["Posizione"] || ''}
                          disabled={row._posLocked}
                          onChange={e => { setTableData(tableData.map(r => r.id === row.id ? { ...r, posizione: e.target.value, ["Posizione"]: e.target.value } : r)); setIsPosizioniOrdinate(false); setOutputHtml(''); setShowPreview(false) }}
                          onBlur={e => { if (e.target.value && String(e.target.value).trim() !== '') { let val = e.target.value; if (Number(val) < 1) val = '1'; setTableData(tableData.map(r => r.id === row.id ? { ...r, posizione: val, ["Posizione"]: val, _posLocked: true } : r)) } }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', background: row._posLocked ? '#f3f4f6' : 'white', color: row._posLocked ? '#888' : '#222', cursor: row._posLocked ? 'not-allowed' : 'text' }}
                        />
                      </div>
                      {!modalitaGara && (
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', color: '#6b7280' }}>Tempo</label>
                          <input type="text" value={row.tempo || row["Tempo"] || ''}
                            disabled={!isPosizioniOrdinate}
                            onChange={e => { setTableData(tableData.map(r => r.id === row.id ? { ...r, tempo: e.target.value, ["Tempo"]: e.target.value } : r)); setOutputHtml(''); setShowPreview(false) }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', background: isPosizioniOrdinate ? 'white' : '#f1f3f5', color: isPosizioniOrdinate ? '#222' : '#888', cursor: isPosizioniOrdinate ? 'text' : 'not-allowed' }}
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
            <div id="outputHtmlArea" style={{ marginTop: '30px', padding: '20px', border: '2px solid #ddd', borderRadius: '4px', background: '#fafafa', marginBottom: '20px' }}>
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

  // ── Vista ordinamento manuale (Nuovo Template) ────────────────────────────
  return (
    isNuovoTemplate ? (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <button onClick={() => { setTemplateSelezionato(null); setIsNuovoTemplate(false); setInputHtml(''); setOutputHtml(''); setShowPreview(false); setTemplateName(''); setShowSaveForm(false) }}
            style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
            ← Indietro
          </button>
          <h1 style={{ color: '#2563eb', marginTop: 0, marginBottom: '10px', fontSize: '32px', fontWeight: 700, letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: '10px' }}>📝 Nuovo Template Timing71</h1>
          <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '17px', fontWeight: 500 }}>Inserisci solo pilota e scuderia. Le altre colonne saranno generate automaticamente.</p>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
              <button onClick={() => setTableData(prev => [...prev, { pilota: '', scuderia: '' }])}
                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '17px', fontWeight: 700, boxShadow: '0 2px 8px rgba(37,99,235,0.12)', cursor: 'pointer' }}>+ Aggiungi pilota</button>
              {tableData.length > 0 && (
                <button onClick={() => setShowRemoveMode(true)}
                  style={{ background: '#64748b', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '17px', fontWeight: 700, cursor: 'pointer' }}>- Rimuovi pilota</button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
              {tableData.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#2563eb', fontWeight: 600, fontSize: '18px', padding: '32px 0' }}>Aggiungi almeno un pilota</div>
              )}
              {tableData.map((row, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '2px solid #e0e7ef', borderRadius: '16px', boxShadow: '0 2px 8px rgba(37,99,235,0.07)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '12px', right: '18px', color: '#2563eb', fontWeight: 700, fontSize: '18px', opacity: 0.7 }}>#{idx+1}</div>
                  {showRemoveMode && (
                    <button onClick={() => { setTableData(prev => prev.filter((_, i) => i !== idx)); if (tableData.length === 1) setShowRemoveMode(false) }}
                      style={{ position: 'absolute', top: '12px', left: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '20px', fontWeight: 700, cursor: 'pointer', zIndex: 2 }}
                      title="Rimuovi pilota">✕</button>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '15px', color: '#2563eb', fontWeight: 600 }}>Pilota</label>
                    <input type="text" placeholder="Nome pilota" style={{ padding: '12px', border: '2px solid #c7d2fe', borderRadius: '8px', fontSize: '16px', fontWeight: 500, background: '#fff', color: '#1e293b' }} value={row.pilota || ''} onChange={e => { const val = e.target.value; setTableData(prev => { const arr = [...prev]; arr[idx] = { ...arr[idx], pilota: val }; return arr }) }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '15px', color: '#2563eb', fontWeight: 600 }}>Scuderia</label>
                    <input type="text" placeholder="Nome scuderia" style={{ padding: '12px', border: '2px solid #c7d2fe', borderRadius: '8px', fontSize: '16px', fontWeight: 500, background: '#fff', color: '#1e293b' }} value={row.scuderia || ''} onChange={e => { const val = e.target.value; setTableData(prev => { const arr = [...prev]; arr[idx] = { ...arr[idx], scuderia: val }; return arr }) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nome template (es: Formula 2, Formula 3...)"
              style={{ flex: 1, padding: '14px', border: '2px solid #2563eb', borderRadius: '8px', fontSize: '17px', minWidth: '220px', fontWeight: 600, background: '#f8fafc', color: '#2563eb' }} />
            <button onClick={() => {
              const timing71Columns = ['Posizione', 'Pilota', 'Scuderia', 'Tempo', 'Giri', 'Gap', 'Gap Leader', 'Gap Prec.', 'Best Lap', 'Pit', 'Status', 'Penalità', 'Note']
              let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n'
              html += '  <thead>\n    <tr>'
              timing71Columns.forEach(col => { html += `<th>${col}</th>` })
              html += '</tr>\n  </thead>\n  <tbody>\n'
              tableData.forEach((row, idx) => {
                if (!row || !row.pilota) return
                html += `    <tr><td>${idx+1}</td><td>${row.pilota || ''}</td><td>${row.scuderia || ''}</td>`
                for (let i = 3; i < timing71Columns.length; i++) html += '<td></td>'
                html += '</tr>\n'
              })
              html += '  </tbody>\n</table>'
              setInputHtml(html); setOutputHtml(html); setShowPreview(true); setShowSaveForm(true)
            }} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '14px 36px', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}>Genera e Salva</button>
            <button onClick={() => { setTemplateSelezionato(null); setIsNuovoTemplate(false); setInputHtml(''); setOutputHtml(''); setShowPreview(false); setTemplateName(''); setShowSaveForm(false) }}
              style={{ background: '#64748b', color: 'white', border: 'none', padding: '14px 36px', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}>Annulla</button>
          </div>
          {showPreview && (
            <div style={{ marginTop: '30px', padding: '20px', border: '2px solid #ddd', borderRadius: '4px', background: '#fafafa' }}>
              <h2 style={{ marginTop: 0, color: '#555', fontSize: '20px' }}>Anteprima Template:</h2>
              <div dangerouslySetInnerHTML={{ __html: outputHtml }} />
            </div>
          )}
          {showSaveForm && (
            <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '16px' }}>💾 Salva come Template</h3>
              <button onClick={salvaTemplate} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Salva</button>
              <button onClick={() => { setShowSaveForm(false); setTemplateName('') }} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Annulla</button>
            </div>
          )}
        </div>
      </div>
    ) : (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          {/* Contenuto fallback — questo branch non dovrebbe essere raggiunto normalmente */}
        </div>
      </div>
    )
  )
}

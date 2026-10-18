import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './OrdinaTabellaClassifica.css'
import {
  indovinaRuoliColonne, intestazioneColonna, costruisciTabellaCompleta, abbreviaNomiPilota,
  leggiContenutoImportato, scaricaHtmlEntryList, costruisciHtmlTabella,
  trovaColonnaClasse, top3PerClasse, colonnePilotiEquipaggio, nomiEquipaggio, unisciBlocchiHtml
} from './ordinaTabellaHelpers'

const TIMING71_EXTENSION_URL = 'https://chromewebstore.google.com/detail/iaaeepalpcdjjbgghcjdjhclhdiamanp?utm_source=item-share-cb'

// ── Piccoli componenti di interfaccia ───────────────────────────────────────
const ICONE = {
  indietro: 'M15 18l-6-6 6-6',
  avanti: 'M9 18l6-6-6-6',
  piu: 'M12 5v14M5 12h14',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  copia: 'M9 9h11v11H9zM5 15V4h11',
  aggiorna: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  scarica: 'M12 3v12m0 0l-4-4m4 4l4-4M5 21h14',
  cerca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  sblocca: 'M7 11V7a5 5 0 0 1 9.9-1M5 11h14v10H5z',
  colonne: 'M4 5h16M4 12h16M4 19h16',
  cestino: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'
}

function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONE[name]} />
    </svg>
  )
}

function Btn({ variant = 'secondary', size, block, icon, className = '', children, ...props }) {
  const classi = ['ot-btn', variant !== 'secondary' && `ot-btn--${variant}`, size && `ot-btn--${size}`, block && 'ot-btn--block', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={classi} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

function Interruttore({ checked, onChange, children, hint, disabled }) {
  return (
    <label className={`ot-switch${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="ot-switch__track" />
      <span>{children}{hint && <span className="ot-switch__hint"> {hint}</span>}</span>
    </label>
  )
}

function Passi({ passi, corrente }) {
  return (
    <ol className="ot-steps" aria-label="Avanzamento">
      {passi.map((p, i) => {
        const n = i + 1
        const stato = n < corrente ? 'is-done' : n === corrente ? 'is-current' : ''
        return (
          <li key={p} className={stato} aria-current={n === corrente ? 'step' : undefined}>
            <span className="ot-steps__n">{n < corrente ? <Icon name="check" size={12} /> : n}</span>
            {p}
          </li>
        )
      })}
    </ol>
  )
}

// Risultato: tutte le tabelle intere, una sotto l'altra. "Copia tutto" mette nel clipboard TUTTE le tabelle in un colpo solo.
// blocchi = [{ chiave, titolo, html }] · copiato = chiave dell'ultimo blocco copiato ('tutto' = tutto insieme)
// onCopia(html, chiave) · il codice è nascosto finché non serve.
function PannelloRisultato({ blocchi, copiato, onCopia, titolo = 'Risultato', id }) {
  const [mostraCodice, setMostraCodice] = useState(false)
  const [conTitoli, setConTitoli] = useState(false)
  const molte = blocchi.length > 1
  const codice = unisciBlocchiHtml(blocchi, conTitoli)
  return (
    <section className="ot-card ot-result" id={id}>
      <div className="ot-result__head">
        <div>
          <h2 className="ot-h2">{titolo}</h2>
          <p className="ot-muted">
            {molte ? `${blocchi.length} tabelle: «Copia tutto» le copia insieme, in un colpo solo.` : 'Controlla la tabella, poi copia il codice.'}
          </p>
        </div>
        <div className="ot-result__actions">
          {molte && <Interruttore checked={conTitoli} onChange={setConTitoli} hint="<h3>">Titoli sopra le tabelle</Interruttore>}
          <Btn variant="ghost" onClick={() => setMostraCodice(v => !v)}>{mostraCodice ? 'Nascondi codice' : 'Mostra codice'}</Btn>
          <Btn variant="tinted" icon={copiato === 'tutto' ? 'check' : 'copia'} onClick={() => onCopia(codice, 'tutto')}>
            {copiato === 'tutto' ? 'Copiato' : molte ? 'Copia tutto' : 'Copia codice'}
          </Btn>
        </div>
      </div>

      {blocchi.map(b => (
        <div key={b.chiave} className="ot-output__block">
          {molte && (
            <div className="ot-output__blockhead">
              <h3 className="ot-h3">{b.titolo}</h3>
              <Btn size="sm" icon={copiato === b.chiave ? 'check' : 'copia'} onClick={() => onCopia(b.html, b.chiave)}>
                {copiato === b.chiave ? 'Copiato' : 'Copia solo questa'}
              </Btn>
            </div>
          )}
          <div className="ot-output__preview" dangerouslySetInnerHTML={{ __html: b.html }} />
        </div>
      ))}

      {mostraCodice && (
        <div className="ot-output__block">
          <div className="ot-output__blockhead"><h3 className="ot-h3">Codice HTML</h3></div>
          <textarea className="ot-code" readOnly value={codice} onFocus={e => e.target.select()} aria-label="Codice HTML" />
        </div>
      )}
    </section>
  )
}

// Elenco di colonne con un interruttore ciascuna (usato sia nella finestra "Colonne" sia nell'import).
// voci = [{ chiave, etichetta, attiva }]
function GrigliaColonne({ voci, onToggle, onTutte, onNessuna }) {
  const attive = voci.filter(v => v.attiva).length
  return (
    <div className="ot-cols">
      <div className="ot-cols__bar">
        <span className="ot-cols__count">{attive} di {voci.length} attive</span>
        <span className="ot-cols__quick">
          <button type="button" className="ot-link" onClick={onTutte}>Tutte</button>
          <button type="button" className="ot-link" onClick={onNessuna}>Nessuna</button>
        </span>
      </div>
      <div className="ot-cols__grid">
        {voci.map(v => (
          <label key={v.chiave} className={`ot-tile${v.attiva ? ' is-on' : ''}`}>
            <span className="ot-tile__name">{v.etichetta}</span>
            <input type="checkbox" role="switch" className="ot-tile__input" checked={v.attiva} onChange={() => onToggle(v.chiave)} />
            <span className="ot-switch__track" />
          </label>
        ))}
      </div>
    </div>
  )
}

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
  const [copySuccess, setCopySuccess] = useState('') // chiave del riquadro appena copiato ('' = nessuno)
  const [top3Classi, setTop3Classi] = useState(false) // true = oltre alla classifica genera la Top 3 di ogni classe
  const [outputTop3, setOutputTop3] = useState([]) // [{ classe, html }]
  const [templateName, setTemplateName] = useState('')
  const [modalitaGara, setModalitaGara] = useState(false)
  const [templateSelezionato, setTemplateSelezionato] = useState(null)
  const [isNuovoTemplate, setIsNuovoTemplate] = useState(false)
  const [isEditingData, setIsEditingData] = useState(false)
  const [tableData, setTableData] = useState([])
  const MAIN_COLUMNS = ["Posizione", "Pilota", "Scuderia", "Best", "Tempo"]

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

  // Colonne di un template "a tabella completa" (importato da link, senza colonna "Pilota"); null = template classico
  const [colonneTemplateCompleto, setColonneTemplateCompleto] = useState(null)
  const COLONNE_FISSE_TEMPLATE = ['Posizione', 'Best', 'Tempo']
  // true dopo un import da Timing71 su template a tabella completa: si vede solo il pilota in macchina (Posizione, Pilota, Scuderia, Best)
  const [vistaTiming71, setVistaTiming71] = useState(false)
  // Opzioni di stampa del codice HTML
  const [nomiAbbreviati, setNomiAbbreviati] = useState(false)
  // true = nella colonna Pilota stampa TUTTI i piloti della vettura (Pilota 1, 2, 3…); false = solo quello in macchina (qualifiche)
  const [tuttiPiloti, setTuttiPiloti] = useState(false)

  useEffect(() => {
    if (colonneTemplateCompleto && vistaTiming71) {
      setColonneVisibili(modalitaGara
        ? ["Posizione", "Pilota", "Scuderia"]
        : ["Posizione", "Pilota", "Scuderia", "Best"])
    } else if (colonneTemplateCompleto) {
      setColonneVisibili(modalitaGara
        ? colonneTemplateCompleto.filter(c => c !== 'Best' && c !== 'Tempo')
        : [...colonneTemplateCompleto])
    } else if (modalitaGara) {
      setColonneVisibili(["Posizione", "Pilota", "Scuderia"])
    } else {
      setColonneVisibili([...MAIN_COLUMNS])
    }
  }, [modalitaGara, colonneTemplateCompleto, vistaTiming71])

  const [sorgenteTemplate, setSorgenteTemplate] = useState('link') // 'link' = importa tabella, 'manuale' = piloti inseriti a mano
  const [toast, setToast] = useState('')
  const [pickerAperto, setPickerAperto] = useState(true) // false dopo l'importazione: la scelta colonne si richiude

  useEffect(() => {
    if (!showColonneModal) return
    const onKey = (e) => { if (e.key === 'Escape') setShowColonneModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showColonneModal])

  // ── Import tabella da link ────────────────────────────────────────────────
  const [urlEntryList, setUrlEntryList] = useState('')
  const [entryListLoading, setEntryListLoading] = useState(false)
  const [entryListMsg, setEntryListMsg] = useState(null)
  const [entryListShowPaste, setEntryListShowPaste] = useState(false)
  const [entryListTesto, setEntryListTesto] = useState('')
  const [entryListTabelle, setEntryListTabelle] = useState([])
  const [entryListIdx, setEntryListIdx] = useState(0)
  const [entryListColAttive, setEntryListColAttive] = useState([]) // true = colonna inclusa (ON), false = ignorata (OFF)
  const [entryListHeader, setEntryListHeader] = useState(true)
  const [entryListCorreggi, setEntryListCorreggi] = useState(true)
  const [entryListItaliano, setEntryListItaliano] = useState(true)
  const [tabellaCompleta, setTabellaCompleta] = useState(null) // { intestazioni: [], righe: [][] }

  // ── Timing71 ──────────────────────────────────────────────────────────────
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
    setOutputHtml(''); setOutputTop3([])
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

      if (!headers.includes('Pilota')) {
        // Template a tabella completa (es. Numero, Team, Pilota 1, Pilota 2, Pilota 3, Vettura, Classe):
        // Posizione per prima, poi TUTTE le colonne del template, poi Best e Tempo (nascondibili da "Seleziona colonne")
        const daTemplate = headers.filter(h => !['Posizione', 'posizione', 'POS', 'Best', 'best', 'Tempo', 'tempo'].includes(h))
        const colonne = ['Posizione', ...daTemplate, 'Best', 'Tempo']
        setTableColumns(colonne)
        setExtraColumns([])
        setColonneTemplateCompleto(colonne)
        setVistaTiming71(false)
      } else {
        const extraCols = headers.filter(h => !MAIN_COLUMNS.includes(h))
        setTableColumns([...MAIN_COLUMNS, ...extraCols])
        setExtraColumns(extraCols)
        setColonneTemplateCompleto(null)
        setVistaTiming71(false)
      }
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

  // Numero vettura normalizzato: "#07" → "7"
  function normNumeroVettura(v) {
    return String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^0+(?=\d)/, '')
  }

  // Nome confrontabile a prescindere da MAIUSCOLO, accenti e ordine: "SCHURING Morris" = "Morris Schuring" = "Schuring, Morris"
  function chiaveNomeSenzaOrdine(nome) {
    return normalizzaNome(String(nome || '').replace(/,/g, ' '))
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/).filter(Boolean).sort().join(' ')
  }

  // ── FIX #1: applicaSessione riscritta correttamente ──────────────────────
  function applicaSessione(sessione, opzioni = {}) {
    const soloPosizioni = !!opzioni.soloPosizioni
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

    if (!colonneTemplateCompleto && !soloPosizioni) {
      setTableColumns(allColumns)
      setExtraColumns(allColumns.filter(col => !MAIN_COLUMNS.includes(col)))
      setColonneVisibili(["Posizione", "Pilota", "Scuderia", "Best"])
    }

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
        num: normNumeroVettura(getVal(imp, 'NUM', 'Num', 'Numero', 'Num Jump to:', 'Number', 'No', 'Nr', 'Car', 'Car #')),
        tokens: chiaveNomeSenzaOrdine(pilotaRaw),
        pilota,
        pilotaRaw,
        posizione,
        tempo: getVal(imp, 'LAST', 'Last', 'tempo') || inferred.last || '',
        best: getVal(imp, 'BEST', 'Best', 'best') || inferred.best || ''
      }
    })

    // Aggiorna solo le righe esistenti che matchano, NON aggiunge nuove righe.
    // Match: 1) numero vettura (se il template ha la colonna Numero)  2) nome su Pilota / Pilota 1 / Pilota 2 / Pilota 3…
    // (Timing71 mostra un solo pilota per vettura, quello in macchina in quel momento)
    const colNumero = tableColumns.find(c => /^(numero|num|n°|nr\.?|no\.?|car\s*#?)$/i.test(String(c).trim()))
    const colPilotiTemplate = tableColumns.filter(c => /^pilot/i.test(String(c).trim()))

    const trovaImportato = (esistente) => {
      if (colNumero) {
        const n = normNumeroVettura(esistente[colNumero])
        if (n) {
          const perNumero = pilotiImportati.find(p => p.num && p.num === n)
          if (perNumero) return perNumero
        }
      }
      const nomi = [
        ...colPilotiTemplate.map(c => esistente[c]),
        esistente.Pilota, esistente.pilota, esistente.PilotaRaw
      ].map(chiaveNomeSenzaOrdine).filter(Boolean)
      if (nomi.length === 0) return null
      return pilotiImportati.find(p => p.tokens && nomi.includes(p.tokens)) || null
    }

    // Template a tabella completa: mostro SOLO il pilota in macchina (quello di Timing71) + Scuderia (= Team) + Best
    const vistaPilotaSingolo = !!colonneTemplateCompleto && !soloPosizioni
    const conScuderia = (r) => {
      if (!vistaPilotaSingolo) return r
      const team = r.Team || r.Scuderia || r.scuderia || ''
      return { ...r, Scuderia: team, scuderia: team }
    }

    let aggiornati = 0
    const datiAggiornati = tableData.map(esistente => {
      const importato = trovaImportato(esistente)
      if (!importato) return conScuderia(esistente) // non matchato: resta tutto com'è
      aggiornati++
      const aggiornato = { ...conScuderia(esistente) }
      aggiornato.Posizione = importato.posizione
      aggiornato.posizione = importato.posizione
      if (!soloPosizioni) {
        aggiornato.Tempo = importato.tempo
        aggiornato.tempo = importato.tempo
        aggiornato.Best = importato.best
        aggiornato.best = importato.best
      }
      if (vistaPilotaSingolo) {
        const nomeDalTemplate = colPilotiTemplate
          .filter(c => !/^pilota$/i.test(String(c).trim()))
          .map(c => esistente[c])
          .find(n => n && chiaveNomeSenzaOrdine(n) === importato.tokens)
        const nome = nomeDalTemplate || importato.pilota
        aggiornato.Pilota = nome
        aggiornato.PilotaRaw = nome
        aggiornato.pilota = nome
      }
      return aggiornato
    })

    if (aggiornati === 0) {
      setSyncStatus('error')
      setSyncMessage('⚠️ Nessuna riga abbinata. Il template deve avere la colonna "Numero" (o i nomi dei piloti scritti come su Timing71). I dati non sono stati toccati.')
      return
    }

    const datiOrdinati = datiAggiornati.sort((a, b) => {
      const posA = parseInt(a.posizione) || 999
      const posB = parseInt(b.posizione) || 999
      return posA - posB
    })

    if (vistaPilotaSingolo) {
      const altre = tableColumns.filter(c => !['Posizione', 'Best', 'Tempo', 'Pilota', 'Scuderia'].includes(c))
      setTableColumns(['Posizione', 'Pilota', 'Scuderia', ...altre, 'Best', 'Tempo'])
      setExtraColumns([])
      setVistaTiming71(true)
    }
    setTableData(datiOrdinati)
    setSyncStatus('success')
    setSyncMessage(`✅ ${aggiornati} righe su ${tableData.length} aggiornate da Timing71${soloPosizioni ? ' (solo posizioni)' : ''}`)
    setShowSyncPanel(false)
  }

  async function salvaTemplate(htmlDaSalvare) {
    const html = htmlDaSalvare ?? inputHtml
    if (!templateName.trim() || !html.trim()) { alert('Inserisci un nome e crea prima la tabella!'); return false }
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser?.id) { alert('❌ Errore: utente non autenticato'); return false }
    const { error } = await supabase.from('ordina_tabella_templates').insert({
      username: user.username, user_id: authUser.id,
      nome_template: templateName.trim(), html_template: html
    })
    if (error) { alert('❌ Errore nel salvataggio: ' + (error.message || '')); return false }
    setTemplateName('')
    caricaTemplates()
    return true
  }

  // ── Import tabella da link / testo ────────────────────────────────────────
  function selezionaTabellaImportata(i, tabelle, daTesto) {
    const g = indovinaRuoliColonne(tabelle[i], daTesto)
    setEntryListIdx(i)
    setEntryListColAttive(tabelle[i][0].map(() => true))
    setEntryListHeader(g.intestazione)
  }

  function caricaTabelleImportate(tabelle, daTesto) {
    if (!tabelle || tabelle.length === 0) {
      setEntryListTabelle([])
      setEntryListMsg({ tipo: 'errore', testo: '⚠️ Non ho trovato nessuna tabella nella pagina (potrebbe essere caricata con JavaScript). Apri il link, copia la tabella e incollala nel riquadro qui sotto.' })
      setEntryListShowPaste(true)
      return
    }
    setEntryListTabelle(tabelle)
    setTabellaCompleta(null)
    setPickerAperto(true)
    setEntryListShowPaste(false)
    selezionaTabellaImportata(0, tabelle, daTesto)
    setEntryListMsg(null)
  }

  async function importaEntryListDaLink() {
    const url = urlEntryList.trim()
    if (!/^https?:\/\//i.test(url)) {
      setEntryListMsg({ tipo: 'errore', testo: '⚠️ Inserisci un link valido che inizi con https://' })
      return
    }
    setEntryListLoading(true)
    setEntryListMsg(null)
    try {
      const contenuto = await scaricaHtmlEntryList(url)
      const { tabelle, linkLive } = leggiContenutoImportato(contenuto)
      if (tabelle.length === 0 && linkLive.length > 0) {
        setEntryListTabelle([])
        setEntryListMsg({ tipo: 'errore', testo: `⚠️ In questa pagina non c'è una tabella: il live timing è un'app esterna (${linkLive[0]}) che carica i dati via JavaScript. Apri quel link, premi F12 → Network → Fetch/XHR, clicca la richiesta che contiene la classifica e incolla qui l'URL di quella richiesta (oppure il suo contenuto nel riquadro qui sotto).` })
        setEntryListShowPaste(true)
        return
      }
      caricaTabelleImportate(tabelle, false)
    } catch (e) {
      console.error('[import tabella] errore download:', e)
      setEntryListMsg({ tipo: 'errore', testo: '❌ Non riesco a scaricare la pagina da qui (il sito blocca le richieste dal browser). Apri il link, copia la tabella e incollala nel riquadro qui sotto.' })
      setEntryListShowPaste(true)
    } finally {
      setEntryListLoading(false)
    }
  }

  function importaEntryListDaTesto() {
    const t = entryListTesto.trim()
    const daTesto = !(t.startsWith('{') || t.startsWith('[') || t.startsWith('<'))
    caricaTabelleImportate(leggiContenutoImportato(entryListTesto).tabelle, daTesto)
  }

  function attivaDisattivaColonna(ci) {
    setEntryListColAttive(prev => prev.map((v, i) => i === ci ? !(v !== false) : v))
  }

  function importaTabellaCompleta() {
    const tab = entryListTabelle[entryListIdx]
    if (!tab) return
    if (!tab[0].some((_, i) => entryListColAttive[i] !== false)) {
      setEntryListMsg({ tipo: 'errore', testo: '⚠️ Tutte le colonne sono su OFF: attivane almeno una.' })
      return
    }
    const risultato = costruisciTabellaCompleta(tab, entryListColAttive, entryListHeader, entryListCorreggi, entryListItaliano)
    if (risultato.righe.length === 0) {
      setEntryListMsg({ tipo: 'errore', testo: '⚠️ La tabella non contiene righe di dati.' })
      return
    }
    setTabellaCompleta(risultato)
    setPickerAperto(false)
    setEntryListMsg(null)
    setEntryListMsg({ tipo: 'ok', testo: `✅ Importata la tabella completa: ${risultato.righe.length} righe, ${risultato.intestazioni.length} colonne. Controllala qui sotto: ogni cella è modificabile.` })
  }

  function modificaCellaTabellaCompleta(ri, ci, valore) {
    setTabellaCompleta(prev => prev && ({ ...prev, righe: prev.righe.map((r, i) => i === ri ? r.map((c, j) => j === ci ? valore : c) : r) }))
  }

  function modificaIntestazioneTabellaCompleta(ci, valore) {
    setTabellaCompleta(prev => prev && ({ ...prev, intestazioni: prev.intestazioni.map((h, i) => i === ci ? valore : h) }))
  }

  function rimuoviRigaTabellaCompleta(ri) {
    setTabellaCompleta(prev => prev && ({ ...prev, righe: prev.righe.filter((_, i) => i !== ri) }))
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
      .filter(h => !(colonneTemplateCompleto && (h === 'Pilota' || h === 'Scuderia')))
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

  function ordinaDatiPerPosizione() {
    const dataSorted = [...tableData].sort((a, b) => (parseInt(a.posizione) || 999) - (parseInt(b.posizione) || 999))
    setTableData(dataSorted); setIsPosizioniOrdinate(true); invalidaOutput()
  }

  // Tabella HTML dalle righe date. posizioneInClasse = true → la colonna Posizione riparte da 1 (usata nelle Top 3)
  function htmlTabellaDati(righe, columns, posizioneInClasse = false) {
    let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n'
    html += '  <thead>\n    <tr>'
    columns.forEach(col => { html += `<th>${col}</th>` })
    html += '</tr>\n  </thead>\n  <tbody>\n'
    righe.forEach((row, i) => {
      html += '    <tr>'
      columns.forEach(col => {
        let value = row[col] !== undefined ? row[col] : ''
        if (col === 'Pilota') {
          value = row.Pilota || pilotaNomeCognome(row.PilotaRaw || row.pilota || value)
          if (tuttiPiloti) {
            const nomi = nomiEquipaggio(row, tutteLeColonne)
            if (nomi.length) value = nomi.join(', ')
          }
        }
        if (posizioneInClasse && col === 'Posizione') value = String(i + 1)
        if (nomiAbbreviati && /^pilot/i.test(col)) value = abbreviaNomiPilota(value)
        html += `<td>${value}</td>`
      })
      html += '</tr>\n'
    })
    return html + '  </tbody>\n</table>'
  }

  function generaHtmlDaDati() {
    if (tableData.length === 0) { alert('Nessun dato da elaborare'); return }
    if (!isPosizioniOrdinate) { alert('Prima ordina la griglia con il tasto ORDINA'); return }
    const columns = colonneVisibili
    if (columns.length === 0) { alert('Seleziona almeno una colonna da stampare'); return }
    setOutputHtml(htmlTabellaDati(tableData, columns))
    if (top3Classi && colonnaClasse) {
      const gruppi = top3PerClasse(tableData, r => r[colonnaClasse])
      if (gruppi.length === 0) mostraToast(`Nessun valore nella colonna «${colonnaClasse}»: Top 3 non generate`)
      setOutputTop3(gruppi.map(g => ({ classe: g.classe, html: htmlTabellaDati(g.righe, columns, true) })))
    } else {
      setOutputTop3([])
    }
    setShowPreview(true)
    setTimeout(() => { document.getElementById('outputHtmlArea')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 100)
  }

  // Copia un codice HTML negli appunti; "chiave" dice quale riquadro mostrare come "Copiato"
  function copiaOutput(html, chiave = 'principale') {
    if (!html) return
    const fatto = () => { setCopySuccess(chiave); mostraToast('Codice copiato'); setTimeout(() => setCopySuccess(''), 2000) }
    const doFallback = () => {
      const ta = document.createElement('textarea'); ta.value = html
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      fatto()
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(html).then(fatto).catch(doFallback)
    } else doFallback()
  }

  function formattaData(iso) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  function openTiming71ExtensionPage() {
    window.open(TIMING71_EXTENSION_URL, '_blank', 'noopener,noreferrer')
  }

  // ── Azioni di interfaccia ─────────────────────────────────────────────────
  function mostraToast(testo) {
    setToast(testo)
    setTimeout(() => setToast(''), 2600)
  }

  function apriNuovo() {
    setSorgenteTemplate('link')
    setInputHtml(''); setOutputHtml(''); setShowPreview(false); setTemplateName('')
    setTemplateSelezionato({ id: 'new' }); setIsNuovoTemplate(true)
    setTabellaCompleta(null); setEntryListTabelle([]); setEntryListMsg(null); setTableData([])
    setEntryListShowPaste(false); setEntryListTesto(''); setPickerAperto(true)
  }

  function chiudiNuovo() {
    setTemplateSelezionato(null); setIsNuovoTemplate(false)
    setInputHtml(''); setOutputHtml(''); setShowPreview(false); setTemplateName('')
    setTableData([])
  }

  function chiudiEditor() {
    setTemplateSelezionato(null); setIsEditingData(false); setTableData([]); setOutputHtml(''); setOutputTop3([]); setShowPreview(false)
    setIsPosizioniOrdinate(false); setSyncStatus(null); setShowSyncPanel(false)
  }

  function invalidaOutput() { setOutputHtml(''); setOutputTop3([]); setShowPreview(false) }

  function aggiornaRiga(id, patch) {
    setTableData(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function toggleModalitaGara() {
    setModalitaGara(v => {
      const prossima = !v
      if (prossima) setColonneVisibili(['Posizione', 'Pilota', 'Scuderia'])
      return prossima
    })
  }

  function cambiaPosizione(row, valore) {
    aggiornaRiga(row.id, { posizione: valore, Posizione: valore })
    setIsPosizioniOrdinate(false); invalidaOutput()
  }

  function bloccaPosizione(row, valore) {
    if (!valore || String(valore).trim() === '') return
    const v = Number(valore) < 1 ? '1' : valore
    aggiornaRiga(row.id, { posizione: v, Posizione: v, _posLocked: true })
  }

  // HTML del template che si sta creando (da tabella importata oppure inserita a mano)
  function costruisciHtmlTemplate() {
    if (sorgenteTemplate === 'link') {
      if (!tabellaCompleta) return ''
      return costruisciHtmlTabella(tabellaCompleta.intestazioni, tabellaCompleta.righe)
    }
    const colonne = ['Posizione', 'Pilota', 'Scuderia', 'Tempo', 'Giri', 'Gap', 'Gap Leader', 'Gap Prec.', 'Best Lap', 'Pit', 'Status', 'Penalità', 'Note']
    const righe = tableData
      .filter(r => r && r.pilota)
      .map((r, i) => [String(i + 1), r.pilota || '', r.scuderia || '', ...Array(colonne.length - 3).fill('')])
    return righe.length ? costruisciHtmlTabella(colonne, righe) : ''
  }

  function anteprimaTemplate() {
    const html = costruisciHtmlTemplate()
    if (!html) { alert('Non c\'è ancora nessuna tabella: importala da un link oppure aggiungi almeno un pilota.'); return }
    setInputHtml(html); setOutputHtml(html); setShowPreview(true)
  }

  async function salvaNuovoTemplate() {
    const nome = templateName.trim()
    if (!nome) { alert('Dai un nome al template.'); return }
    const html = costruisciHtmlTemplate()
    if (!html) { alert('Non c\'è ancora nessuna tabella da salvare: importala da un link oppure aggiungi almeno un pilota.'); return }
    const salvato = await salvaTemplate(html)
    if (salvato) { mostraToast(`Template «${nome}» salvato`); chiudiNuovo() }
  }

  // Risultati da online → codice HTML, senza passare dal template
  function generaHtmlRisultatiOnline() {
    if (!tabellaCompleta) { alert('Prima importa una tabella dal link o incollandola.'); return }
    const colonneNomi = tabellaCompleta.intestazioni.map(h => /pilot|driver/i.test(String(h)))
    const righe = tabellaCompleta.righe.map(r => r.map((c, ci) => (nomiAbbreviati && colonneNomi[ci]) ? abbreviaNomiPilota(c) : c))
    const html = costruisciHtmlTabella(tabellaCompleta.intestazioni, righe)
    setInputHtml(html); setOutputHtml(html); setShowPreview(true)
    setTimeout(() => { document.getElementById('outputHtmlArea')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 100)
  }

  // ── Valori derivati per la grafica ────────────────────────────────────────
  const tutteLeColonne = Array.from(new Set([...tableColumns, ...extraColumns]))
  const colonneMostrate = Array.from(new Set([
    ...tableColumns.filter(c => c !== 'Tempo' || !modalitaGara),
    ...extraColumns
  ])).filter(c => colonneVisibili.includes(c))
  const ricerca = searchTerm.trim().toLowerCase()
  const righeFiltrate = tableData.filter(row => !ricerca || tutteLeColonne.some(c => String(row[c] ?? '').toLowerCase().includes(ricerca)))
  const tuttePosizioniOk = tableData.every(r => { const p = r.posizione || r.Posizione; return p && String(p).trim() !== '' })
  const passoCorrente = !tuttePosizioniOk ? 1 : !isPosizioniOrdinate ? 2 : 3
  const suggerimentoPasso = [
    'Inserisci la posizione di ogni riga, oppure sincronizza da Timing71.',
    'Le posizioni sono complete: ordina la griglia.',
    'Compila i tempi e genera il codice HTML.'
  ][passoCorrente - 1]

  // Colonna "Classe" (se esiste) e interruttore Top 3 per classe
  const colonnaClasse = trovaColonnaClasse(tutteLeColonne)
  // Il template ha una colonna per ogni pilota (Pilota 1, 2, 3…)? Allora si può stampare l'equipaggio completo
  const haEquipaggio = colonnePilotiEquipaggio(tutteLeColonne).length > 0

  // Le colonne restano sempre nell'ordine della tabella, a prescindere da quando le accendi
  function impostaColonneVisibili(attive) {
    setColonneVisibili([
      ...tutteLeColonne.filter(c => attive.includes(c)),
      ...attive.filter(c => !tutteLeColonne.includes(c))
    ])
    invalidaOutput()
  }
  function toggleColonnaVisibile(col) {
    impostaColonneVisibili(colonneVisibili.includes(col) ? colonneVisibili.filter(c => c !== col) : [...colonneVisibili, col])
  }

  const modaleColonne = showColonneModal ? (
    <div className="ot-modal" onClick={() => setShowColonneModal(false)}>
      <div className="ot-dialog" role="dialog" aria-modal="true" aria-labelledby="ot-colonne-titolo" onClick={e => e.stopPropagation()}>
        <h2 className="ot-h2" id="ot-colonne-titolo">Colonne del codice HTML</h2>
        <p className="ot-muted">Accendi quelle che vuoi nella tabella.</p>
        <GrigliaColonne
          voci={tutteLeColonne.map(c => ({ chiave: c, etichetta: c, attiva: colonneVisibili.includes(c) }))}
          onToggle={toggleColonnaVisibile}
          onTutte={() => impostaColonneVisibili([...tutteLeColonne])}
          onNessuna={() => impostaColonneVisibili([])}
        />
        <div className="ot-dialog__foot">
          <Btn variant="primary" block onClick={() => setShowColonneModal(false)}>Fatto</Btn>
        </div>
      </div>
    </div>
  ) : null

  const shell = (figli, onIndietro, { titolo, sotto, azioni } = {}) => (
    <div className="ot-shell">
      <button className="page-back-button" onClick={onIndietro}>Indietro</button>
      <div className="ot-panel">
        <header className="ot-head">
          <div>
            <h1 className="ot-title">{titolo}</h1>
            {sotto && <p className="ot-sub">{sotto}</p>}
          </div>
          {azioni && <div className="ot-head__actions">{azioni}</div>}
        </header>
        {figli}
      </div>
      {modaleColonne}
      {toast && <div className="ot-toast" role="status">{toast}</div>}
    </div>
  )

  // ── Lista template ────────────────────────────────────────────────────────
  if (!templateSelezionato) {
    return shell(
      <>
        <div className="ot-actions-grid">
          <Btn variant="primary" icon="piu" onClick={apriNuovo}>Nuovo template</Btn>
          <Btn variant={isModificaMode ? 'tinted' : undefined} icon={isModificaMode ? 'check' : undefined} onClick={() => setIsModificaMode(v => !v)}>
            {isModificaMode ? 'Fine modifica' : 'Modifica'}
          </Btn>
        </div>

        <h2 className="ot-label">Template salvati <span className="ot-count">{templates.length}</span></h2>
        {templates.length === 0 ? (
          <div className="ot-empty">Nessun template salvato. Creane uno con «Nuovo template».</div>
        ) : (
          <div className="ot-list">
            {templates.map(t => (
              <div key={t.id} className="ot-list__item">
                <button type="button" className="ot-list__open" title={t.nome_template} onClick={() => apriTemplate(t, isModificaMode)}>
                  <span>{t.nome_template}</span><Icon name="avanti" />
                </button>
                {isModificaMode && (
                  <button type="button" className="ot-icon-btn ot-list__delete" onClick={() => eliminaTemplate(t.id)} aria-label={`Elimina ${t.nome_template}`}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="ot-footer-link">
          <button type="button" className="ot-link" onClick={openTiming71ExtensionPage}>Installa l'estensione Timing71</button>
        </div>
      </>,
      onClose,
      { titolo: 'Tabella HTML', sotto: 'Apri un template, oppure creane uno nuovo importando una tabella da un link.' }
    )
  }

  // ── Editor: posizioni, tempi, codice HTML ─────────────────────────────────
  if (isEditingData) {
    const renderCella = (row, col) => {
      if (col === 'Posizione') {
        const valore = row.posizione || row.Posizione || ''
        const doppia = posizioneDoppia(valore, tableData)
        return (
          <td key={col}>
            <div className="ot-pos">
              <input
                className={`ot-cell-input ot-cell-input--num${row._posLocked ? ' is-locked' : ''}${doppia ? ' is-dup' : ''}`}
                type="number" min="1" inputMode="numeric" aria-label="Posizione" value={valore} disabled={!!row._posLocked}
                onChange={e => cambiaPosizione(row, e.target.value)}
                onBlur={e => bloccaPosizione(row, e.target.value)}
              />
              <button type="button" className="ot-icon-btn" disabled={!row._posLocked} title="Sblocca posizione" aria-label="Sblocca posizione"
                onClick={() => aggiornaRiga(row.id, { _posLocked: false })}>
                <Icon name="sblocca" size={14} />
              </button>
            </div>
          </td>
        )
      }
      if (col === 'Pilota') {
        const nome = row.PilotaRaw || row.Pilota || row[col] || ''
        return (
          <td key={col} className="ot-td--text">
            {isModificaMode ? (
              <input className="ot-cell-input" type="text" aria-label="Pilota" value={nome}
                onChange={e => { aggiornaRiga(row.id, { Pilota: e.target.value, PilotaRaw: e.target.value, pilota: e.target.value }); invalidaOutput() }} />
            ) : nome}
          </td>
        )
      }
      if (col === 'Scuderia') {
        const squadra = row.Scuderia || row.scuderia || ''
        return (
          <td key={col} className="ot-td--text">
            {isModificaMode ? (
              <input className="ot-cell-input" type="text" aria-label="Scuderia" value={squadra}
                onChange={e => { aggiornaRiga(row.id, { Scuderia: e.target.value, scuderia: e.target.value }); invalidaOutput() }} />
            ) : squadra}
          </td>
        )
      }
      if (colonneTemplateCompleto && !COLONNE_FISSE_TEMPLATE.includes(col) && !isModificaMode) {
        return <td key={col} className="ot-td--text">{row[col] || ''}</td>
      }
      const bloccato = col === 'Tempo' && !tuttePosizioniOk
      const classeTempo = col === 'Best' ? ' ot-cell-input--best' : col === 'Tempo' ? ' ot-cell-input--time' : ''
      return (
        <td key={col}>
          <input
            className={`ot-cell-input${classeTempo}`} aria-label={col}
            type={col.toLowerCase().includes('pos') ? 'number' : 'text'}
            value={row[col] || ''} disabled={bloccato} title={bloccato ? 'Inserisci prima tutte le posizioni' : undefined}
            onChange={e => { aggiornaRiga(row.id, { [col]: e.target.value }); invalidaOutput() }}
          />
        </td>
      )
    }

    const renderScheda = (row) => {
      const valorePos = row.posizione || row.Posizione || ''
      return (
        <div key={row.id} className="ot-rowcard">
          {isModificaMode && (
            <button type="button" className="ot-icon-btn ot-icon-btn--danger ot-rowcard__remove" aria-label="Elimina riga"
              onClick={() => setTableData(prev => prev.filter(r => r.id !== row.id))}>
              <Icon name="x" />
            </button>
          )}
          {colonneTemplateCompleto && !vistaTiming71 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {colonneTemplateCompleto.filter(c => !COLONNE_FISSE_TEMPLATE.includes(c)).map(c => (
                <div key={c} className="ot-kv"><span>{c}</span><span>{row[c] || ''}</span></div>
              ))}
            </div>
          ) : (
            <>
              <div className="ot-rowcard__title">
                {isModificaMode ? (
                  <input className="ot-cell-input" type="text" aria-label="Pilota" value={row.PilotaRaw || row.Pilota || row.pilota || ''}
                    onChange={e => { aggiornaRiga(row.id, { Pilota: e.target.value, PilotaRaw: e.target.value, pilota: e.target.value }); invalidaOutput() }} />
                ) : (row.PilotaRaw || row.Pilota || row.pilota || '')}
              </div>
              <div className="ot-rowcard__sub">
                {isModificaMode ? (
                  <input className="ot-cell-input" type="text" aria-label="Scuderia" value={row.Scuderia || row.scuderia || ''}
                    onChange={e => { aggiornaRiga(row.id, { Scuderia: e.target.value, scuderia: e.target.value }); invalidaOutput() }} />
                ) : (row.Scuderia || row.scuderia || '')}
              </div>
            </>
          )}
          <div className="ot-rowcard__grid">
            <div>
              <label>Posizione</label>
              <input className={`ot-cell-input${row._posLocked ? ' is-locked' : ''}`} type="number" min="1" inputMode="numeric" value={valorePos} disabled={!!row._posLocked}
                onChange={e => cambiaPosizione(row, e.target.value)} onBlur={e => bloccaPosizione(row, e.target.value)} />
            </div>
            {!modalitaGara && (vistaTiming71 ? (
              <div>
                <label>Best</label>
                <input className="ot-cell-input ot-cell-input--best" type="text" value={row.Best || row.best || ''}
                  onChange={e => { aggiornaRiga(row.id, { Best: e.target.value, best: e.target.value }); invalidaOutput() }} />
              </div>
            ) : (
              <div>
                <label>Tempo</label>
                <input className="ot-cell-input ot-cell-input--time" type="text" value={row.tempo || row.Tempo || ''} disabled={!isPosizioniOrdinate}
                  onChange={e => { aggiornaRiga(row.id, { tempo: e.target.value, Tempo: e.target.value }); invalidaOutput() }} />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return shell(
      <>
        {isModificaMode && (
          <div className="ot-toolbar">
            <Btn icon="piu" onClick={() => setTableData(prev => [...prev, { id: `new-${Date.now()}`, Pilota: '', Scuderia: '', posizione: '', Posizione: '', Tempo: '', Best: '', _posLocked: false }])}>
              Aggiungi riga
            </Btn>
            <Btn variant="primary" onClick={aggiornaTemplate}>Salva modifiche</Btn>
          </div>
        )}

        <Passi passi={['Posizioni', 'Ordina', 'Genera']} corrente={passoCorrente} />
        <p className="ot-hint">{suggerimentoPasso}</p>

        {showSyncPanel && (
          <section className="ot-card ot-card--sync">
            <div className="ot-card__head ot-card__head--row">
              <div>
                <h2 className="ot-h2">Sessioni Timing71 salvate</h2>
                <p className="ot-muted">Scegli la sessione da applicare alla tabella.</p>
              </div>
              <div className="ot-sync__actions">
                <Btn size="sm" icon="aggiorna" onClick={caricaSessioniTiming71}>Aggiorna</Btn>
                <Btn size="sm" variant="ghost" onClick={openTiming71ExtensionPage}>Installa estensione</Btn>
                <button type="button" className="ot-icon-btn" onClick={() => setShowSyncPanel(false)} aria-label="Chiudi"><Icon name="x" /></button>
              </div>
            </div>
            {syncLoading ? (
              <p className="ot-muted">Caricamento…</p>
            ) : timing71Sessions.length === 0 ? (
              <div className="ot-empty">Nessuna sessione salvata. Salvane una con l'estensione Timing71, poi premi Aggiorna.</div>
            ) : (
              <div className="ot-sync__list">
                {timing71Sessions.map(sessione => (
                  <div key={sessione.id} className="ot-sync__item">
                    <div>
                      <div className="ot-sync__name">{sessione.session_name}</div>
                      <div className="ot-sync__meta">{Array.isArray(sessione.data) ? sessione.data.length : 0} piloti, {formattaData(sessione.created_at)}</div>
                    </div>
                    <div className="ot-sync__actions">
                      <Btn size="sm" variant="primary" onClick={() => applicaSessione(sessione)}>Usa</Btn>
                      <Btn size="sm" onClick={() => applicaSessione(sessione, { soloPosizioni: true })}>Solo posizioni</Btn>
                      <button type="button" className="ot-icon-btn ot-icon-btn--danger" onClick={(e) => eliminaSessione(sessione.id, e)} aria-label="Elimina sessione" title="Elimina sessione"><Icon name="cestino" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {syncStatus && (
          <div className={`ot-banner ot-banner--${syncStatus === 'success' ? 'ok' : syncStatus === 'warning' ? 'warn' : 'bad'}`} role="status">{syncMessage}</div>
        )}

        <div className="ot-toolbar">
          <div className="ot-search">
            <Icon name="cerca" />
            <input className="ot-input" type="search" placeholder="Cerca pilota o scuderia" aria-label="Cerca" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Interruttore checked={modalitaGara} onChange={toggleModalitaGara} hint="solo posizioni">Mode gara</Interruttore>
          <Interruttore checked={nomiAbbreviati} onChange={v => { setNomiAbbreviati(v); invalidaOutput() }} hint="M. Schuring">Nomi abbreviati</Interruttore>
          <Interruttore checked={tuttiPiloti && haEquipaggio} disabled={!haEquipaggio}
            onChange={v => { setTuttiPiloti(v); invalidaOutput() }}
            hint={haEquipaggio ? "dell'equipaggio" : 'servono Pilota 1, 2, 3'}>Tutti i piloti</Interruttore>
          <Interruttore checked={top3Classi && !!colonnaClasse} disabled={!colonnaClasse}
            onChange={v => { setTop3Classi(v); invalidaOutput() }}
            hint={colonnaClasse ? undefined : 'serve la colonna Classe'}>Top 3 per classe</Interruttore>
          <Btn icon="colonne" onClick={() => setShowColonneModal(true)}>Colonne ({colonneMostrate.length}/{tutteLeColonne.length})</Btn>
        </div>

        {!isMobileView ? (
          <div className="ot-tablewrap">
            <div className="ot-scroll">
              <table className="ot-table">
                <thead>
                  <tr>
                    {isModificaMode && <th className="ot-td--actions"><span className="sr-only" /></th>}
                    {colonneMostrate.map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {righeFiltrate.length === 0 && (
                    <tr><td colSpan={colonneMostrate.length + (isModificaMode ? 1 : 0)}><div className="ot-empty" style={{ border: 'none' }}>Nessuna riga da mostrare.</div></td></tr>
                  )}
                  {righeFiltrate.map(row => (
                    <tr key={row.id}>
                      {isModificaMode && (
                        <td className="ot-td--actions">
                          <button type="button" className="ot-icon-btn ot-icon-btn--danger" aria-label="Elimina riga" title="Elimina riga"
                            onClick={() => setTableData(prev => prev.filter(r => r.id !== row.id))}><Icon name="x" /></button>
                        </td>
                      )}
                      {colonneMostrate.map(c => renderCella(row, c))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="ot-cards">
            {righeFiltrate.length === 0 ? <div className="ot-empty">Nessuna riga da mostrare.</div> : righeFiltrate.map(renderScheda)}
          </div>
        )}

        {posizioniDuplicate.length > 0 && (
          <div className="ot-banner ot-banner--warn" role="alert">Posizioni duplicate: {[...new Set(posizioniDuplicate)].join(', ')}</div>
        )}

        <div className={`ot-actionbar${showPreview && outputHtml ? ' is-static' : ''}`}>
          {!isPosizioniOrdinate
            ? <Btn variant="primary" onClick={ordinaDatiPerPosizione}>Ordina per posizione</Btn>
            : <Btn variant="primary" onClick={generaHtmlDaDati}>{top3Classi && colonnaClasse ? 'Genera HTML + Top 3' : 'Genera HTML'}</Btn>}
        </div>

        {showPreview && outputHtml && (
          <PannelloRisultato id="outputHtmlArea" titolo="Risultato"
            blocchi={[
              { chiave: 'generale', titolo: 'Classifica generale', html: outputHtml },
              ...outputTop3.map(g => ({ chiave: `top3-${g.classe}`, titolo: `Top 3 ${g.classe}`, html: g.html }))
            ]}
            copiato={copySuccess} onCopia={copiaOutput} />
        )}
      </>,
      chiudiEditor,
      {
        titolo: templateSelezionato.nome_template,
        sotto: `${tableData.length} righe`,
        azioni: (
          <>
            <Btn variant={isModificaMode ? 'tinted' : undefined} icon={isModificaMode ? 'check' : undefined} onClick={() => setIsModificaMode(v => !v)}>{isModificaMode ? 'Fine modifica' : 'Modifica'}</Btn>
            <Btn icon="aggiorna" onClick={() => { setShowSyncPanel(v => !v); if (!showSyncPanel) caricaSessioniTiming71() }}>Sincronizza Timing71</Btn>
          </>
        )
      }
    )
  }

  // ── Nuovo template / Risultati da online ──────────────────────────────────
  if (isNuovoTemplate) {
    const tabellaScelta = entryListTabelle[entryListIdx]

    const sorgenteLetta = !!tabellaScelta
    const inizioCorpo = entryListHeader ? 1 : 0
    const colonneAttive = tabellaScelta ? tabellaScelta[0].filter((_, i) => entryListColAttive[i] !== false).length : 0

    const pannelloImport = (
      <>
        <section className={`ot-card${sorgenteLetta ? ' ot-card--slim' : ''}`}>
          {!sorgenteLetta ? (
            <>
              <div className="ot-card__head">
                <h2 className="ot-h2">Da dove prendo la tabella?</h2>
                <p className="ot-muted">Incolla il link della pagina (entry list, risultati…), oppure incolla direttamente i dati.</p>
              </div>
              <div className="ot-field-row">
                <input className="ot-input" type="url" aria-label="Link della pagina" value={urlEntryList}
                  onChange={e => setUrlEntryList(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !entryListLoading) importaEntryListDaLink() }}
                  placeholder="https://www.gt-world-challenge-europe.com/entry-list/2026/portimao" />
                <Btn variant="primary" onClick={importaEntryListDaLink} disabled={entryListLoading || !urlEntryList.trim()}>
                  {entryListLoading ? 'Lettura…' : 'Leggi tabella'}
                </Btn>
              </div>
              {entryListMsg && (
                <div className={`ot-banner ot-banner--${entryListMsg.tipo === 'ok' ? 'ok' : 'bad'}`} role="status">{entryListMsg.testo}</div>
              )}
              <button type="button" className="ot-link" style={{ marginTop: 6 }} onClick={() => setEntryListShowPaste(v => !v)}>
                {entryListShowPaste ? 'Nascondi' : 'Incolla i dati a mano'}
              </button>
              {entryListShowPaste && (
                <div style={{ marginTop: 12 }}>
                  <textarea className="ot-input ot-textarea" rows={6} aria-label="Tabella incollata" value={entryListTesto}
                    onChange={e => setEntryListTesto(e.target.value)}
                    placeholder="Incolla qui la tabella copiata dal sito o da Excel, oppure un JSON copiato dalla scheda Network del browser." />
                  <div style={{ marginTop: 10 }}>
                    <Btn variant="primary" onClick={importaEntryListDaTesto} disabled={!entryListTesto.trim()}>Leggi dal testo</Btn>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="ot-summary">
              <div style={{ minWidth: 0 }}>
                <div className="ot-summary__label">Sorgente</div>
                <div className="ot-summary__value">{urlEntryList.trim() || 'Dati incollati'}</div>
              </div>
              <Btn size="sm" onClick={() => { setEntryListTabelle([]); setTabellaCompleta(null); setEntryListMsg(null) }}>Cambia</Btn>
            </div>
          )}
        </section>

        {sorgenteLetta && pickerAperto && (
          <section className="ot-card">
            <div className="ot-card__head">
              <h2 className="ot-h2">Scegli le colonne</h2>
              <p className="ot-muted">Lascia accese solo quelle che ti servono. Le altre vengono ignorate.</p>
            </div>
            {entryListTabelle.length > 1 && (
              <select className="ot-select" aria-label="Tabella da usare" value={entryListIdx}
                onChange={e => selezionaTabellaImportata(Number(e.target.value), entryListTabelle, false)}>
                {entryListTabelle.map((t, i) => (
                  <option key={i} value={i}>
                    Tabella {i + 1}{t.etichetta ? ` (${t.etichetta})` : ''}: {t.length} righe, {t[0].length} colonne
                  </option>
                ))}
              </select>
            )}
            <div className="ot-options">
              <Interruttore checked={entryListHeader} onChange={setEntryListHeader}>La prima riga è l'intestazione</Interruttore>
              <Interruttore checked={entryListItaliano} onChange={setEntryListItaliano}>Intestazioni in italiano</Interruttore>
              <Interruttore checked={entryListCorreggi} onChange={setEntryListCorreggi} hint="SCHURING diventa Schuring">Cognomi senza maiuscolo</Interruttore>
            </div>
            <GrigliaColonne
              voci={tabellaScelta[0].map((_, ci) => ({
                chiave: ci,
                etichetta: intestazioneColonna(tabellaScelta[0], ci, entryListHeader, entryListItaliano),
                attiva: entryListColAttive[ci] !== false
              }))}
              onToggle={attivaDisattivaColonna}
              onTutte={() => setEntryListColAttive(tabellaScelta[0].map(() => true))}
              onNessuna={() => setEntryListColAttive(tabellaScelta[0].map(() => false))}
            />
            <div className="ot-scroll ot-box" style={{ marginTop: 16 }}>
              <table className="ot-table ot-table--preview">
                <thead>
                  <tr>
                    {tabellaScelta[0].map((_, ci) => (
                      <th key={ci} className={entryListColAttive[ci] === false ? 'is-off' : ''}>
                        {intestazioneColonna(tabellaScelta[0], ci, entryListHeader, entryListItaliano)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabellaScelta.slice(inizioCorpo, inizioCorpo + 6).map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => <td key={ci} className={entryListColAttive[ci] === false ? 'is-off' : ''}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ot-muted">Anteprima di {Math.min(6, tabellaScelta.length - inizioCorpo)} righe su {tabellaScelta.length - inizioCorpo}.</p>
            <div style={{ marginTop: 16 }}>
              <Btn variant="primary" onClick={importaTabellaCompleta} disabled={colonneAttive === 0}>Importa tabella</Btn>
            </div>
          </section>
        )}

        {sorgenteLetta && !pickerAperto && (
          <section className="ot-card ot-card--slim">
            <div className="ot-summary">
              <div>
                <div className="ot-summary__label">Colonne</div>
                <div className="ot-summary__value">{colonneAttive} su {tabellaScelta[0].length} incluse</div>
              </div>
              <Btn size="sm" onClick={() => setPickerAperto(true)}>Modifica colonne</Btn>
            </div>
          </section>
        )}

        {tabellaCompleta && (
          <section className="ot-card">
            <div className="ot-card__head ot-card__head--row">
              <div>
                <h2 className="ot-h2">Tabella importata</h2>
                <p className="ot-muted">{tabellaCompleta.righe.length} righe, {tabellaCompleta.intestazioni.length} colonne. Correggi le celle o togli le righe che non servono.</p>
              </div>
            </div>
            <div className="ot-scroll ot-box">
              <table className="ot-table ot-table--edit">
                <thead>
                  <tr>
                    {tabellaCompleta.intestazioni.map((h, ci) => (
                      <th key={ci}>
                        <input className="ot-cell-input ot-cell-input--head" aria-label={`Intestazione colonna ${ci + 1}`} value={h}
                          onChange={e => modificaIntestazioneTabellaCompleta(ci, e.target.value)} />
                      </th>
                    ))}
                    <th className="ot-td--actions" />
                  </tr>
                </thead>
                <tbody>
                  {tabellaCompleta.righe.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => (
                        <td key={ci}>
                          <input className="ot-cell-input" aria-label={`${tabellaCompleta.intestazioni[ci]}, riga ${ri + 1}`} value={c}
                            onChange={e => modificaCellaTabellaCompleta(ri, ci, e.target.value)} />
                        </td>
                      ))}
                      <td className="ot-td--actions">
                        <button type="button" className="ot-icon-btn ot-icon-btn--danger" onClick={() => rimuoviRigaTabellaCompleta(ri)} aria-label="Rimuovi riga" title="Rimuovi riga"><Icon name="x" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    )

    const pannelloManuale = (
      <section className="ot-card">
        <div className="ot-card__head ot-card__head--row">
          <div>
            <h2 className="ot-h2">Piloti</h2>
            <p className="ot-muted">Le altre colonne (tempo, giri, gap…) vengono create vuote.</p>
          </div>
          <Btn icon="piu" onClick={() => setTableData(prev => [...prev, { pilota: '', scuderia: '' }])}>Aggiungi pilota</Btn>
        </div>
        {tableData.length === 0 ? (
          <div className="ot-empty">Nessun pilota. Aggiungine uno per iniziare.</div>
        ) : (
          <div className="ot-scroll" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
            <table className="ot-table">
              <thead><tr><th style={{ width: 48 }}>#</th><th>Pilota</th><th>Scuderia</th><th className="ot-td--actions" /></tr></thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td><input className="ot-cell-input" aria-label={`Pilota ${idx + 1}`} value={row.pilota || ''}
                      onChange={e => { const v = e.target.value; setTableData(prev => prev.map((r, i) => i === idx ? { ...r, pilota: v } : r)) }} /></td>
                    <td><input className="ot-cell-input" aria-label={`Scuderia ${idx + 1}`} value={row.scuderia || ''}
                      onChange={e => { const v = e.target.value; setTableData(prev => prev.map((r, i) => i === idx ? { ...r, scuderia: v } : r)) }} /></td>
                    <td className="ot-td--actions">
                      <button type="button" className="ot-icon-btn ot-icon-btn--danger" onClick={() => setTableData(prev => prev.filter((_, i) => i !== idx))} aria-label={`Rimuovi pilota ${idx + 1}`}><Icon name="x" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )

    const mostraAzioni = sorgenteTemplate === 'manuale' || !!tabellaCompleta

    return shell(
      <>
        {sorgenteTemplate === 'link' ? pannelloImport : pannelloManuale}

        {mostraAzioni && (
          <section className="ot-card">
            <div className="ot-export-grid">
              <div>
                <h2 className="ot-h2">Salva come template</h2>
                <p className="ot-muted">Lo ritrovi nella lista, pronto per inserire posizioni e tempi.</p>
                <div className="ot-field-row" style={{ marginTop: 14 }}>
                  <input className="ot-input" aria-label="Nome del template" placeholder="Nome del template, per esempio GTWC Portimão" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                  {sorgenteTemplate === 'manuale' && <Btn onClick={anteprimaTemplate}>Anteprima</Btn>}
                  <Btn variant="primary" onClick={salvaNuovoTemplate}>Salva template</Btn>
                </div>
              </div>
              {sorgenteTemplate === 'link' && (
                <div>
                  <h2 className="ot-h2">Genera subito il codice HTML</h2>
                  <p className="ot-muted">Senza salvare nulla: generi il codice e lo copi.</p>
                  <div className="ot-field-row ot-field-row--center" style={{ marginTop: 14 }}>
                    <Interruttore checked={nomiAbbreviati} onChange={v => { setNomiAbbreviati(v); invalidaOutput() }} hint="M. Schuring">Nomi abbreviati</Interruttore>
                    <Btn variant="primary" onClick={generaHtmlRisultatiOnline}>Genera codice HTML</Btn>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {showPreview && outputHtml && (
          <PannelloRisultato id="outputHtmlArea" titolo={sorgenteTemplate === 'link' ? 'Codice HTML' : 'Anteprima del template'}
            blocchi={[{ chiave: 'generale', titolo: 'Tabella', html: outputHtml }]}
            copiato={copySuccess} onCopia={copiaOutput} />
        )}
      </>,
      chiudiNuovo,
      {
        titolo: 'Nuovo template',
        sotto: 'Importa una tabella da un link o inserisci i piloti a mano. Poi salvala come template oppure genera subito il codice HTML.',
        azioni: (
          <div className="ot-segmented" role="group" aria-label="Come inserire i piloti">
            <button type="button" aria-pressed={sorgenteTemplate === 'link'} onClick={() => { setSorgenteTemplate('link'); invalidaOutput() }}>Da un link</button>
            <button type="button" aria-pressed={sorgenteTemplate === 'manuale'} onClick={() => { setSorgenteTemplate('manuale'); invalidaOutput() }}>A mano</button>
          </div>
        )
      }
    )
  }

  return shell(<div className="ot-empty">Niente da mostrare qui.</div>, chiudiNuovo, { titolo: 'Tabella HTML' })
}

// Funzioni pure per OrdinaTabellaClassifica: lettura di tabelle (HTML, JSON, testo), correzione e abbreviazione dei nomi.
// Nessuna dipendenza da React.

// ── Import tabella da link / testo incollato ────────────────────────────────
// Particelle che arrivano in MAIUSCOLO ma si scrivono in minuscolo (Kelvin van der Linde)
export const PARTICELLE_COGNOME = new Set(['van', 'von', 'der', 'den', 'ter', 'ten', 'de', 'dos', 'da', 'do', 'du'])

// Eccezioni: chiave = nome come arriva dal sito (minuscolo), valore = scrittura corretta.
export const ECCEZIONI_NOMI_PILOTI = {
  'dean macdonald': 'Dean MacDonald',
}

// Strade per scaricare la pagina: prima diretta, poi proxy CORS pubblici.
// Se hai già un endpoint /api che scarica URL generici, mettilo come primo elemento.
export const PROXY_ENTRY_LIST = [
  (u) => u,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
]

export const RE_COL_PILOTA = /driver|pilot|fahrer|pilote|piloto|coureur/i
export const RE_COL_ESCLUDI = /categ|class|nation|country|licen|rating|grade|rank|\bage\b|birth/i
export const RE_COL_TEAM = /^(team|entrant|squadra|scuderia|equipe|écurie|ecurie|crew)\b/i

export function titleCaseToken(tok) {
  // FITZ-SIMON → Fitz-Simon, D'ANGELO → D'Angelo
  return tok
    .split(/([-'’])/)
    .map(p => (!p || /^[-'’]$/.test(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('')
}

// "Morris SCHURING" → "Morris Schuring" | "Kelvin VAN DER LINDE" → "Kelvin van der Linde"
// Cambia SOLO le parole tutte in maiuscolo: accenti, ordine e parole già corrette restano identici.
export function formattaNomePilotaEntryList(raw) {
  const pulito = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!pulito) return ''
  const eccezione = ECCEZIONI_NOMI_PILOTI[pulito.toLowerCase()]
  if (eccezione) return eccezione
  return pulito.split(' ').map((tok, i) => {
    const lettere = tok.replace(/[^\p{L}]/gu, '')
    const tuttoMaiuscolo = lettere.length > 1 && tok === tok.toUpperCase() && tok !== tok.toLowerCase()
    if (!tuttoMaiuscolo) return tok
    const lower = tok.toLowerCase()
    if (i > 0 && PARTICELLE_COGNOME.has(lower)) return lower
    if (/^mc\p{L}/u.test(lower)) return 'Mc' + titleCaseToken(lower.slice(2))
    return titleCaseToken(tok)
  }).join(' ')
}

export function uniformaLarghezza(righe) {
  const larghezza = Math.max(0, ...righe.map(r => r.length))
  return righe.map(r => Array.from({ length: larghezza }, (_, i) => r[i] || ''))
}

// Restituisce TUTTE le tabelle della pagina (array di tabelle; tabella = array di righe; riga = array di celle)
export function estraiTabelleDaHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const testoCella = (el) => {
    const s = el.innerHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
    const ta = document.createElement('textarea')
    ta.innerHTML = s // decodifica &amp; &ouml; ecc.
    return ta.value.trim()
  }
  const risultati = []
  doc.querySelectorAll('table').forEach(tbl => {
    const righe = [...tbl.querySelectorAll('tr')]
      .map(tr => [...tr.children].filter(c => /^(td|th)$/i.test(c.tagName)).map(testoCella))
      .filter(r => r.some(c => c))
    const uniformi = uniformaLarghezza(righe)
    if (uniformi.length >= 2 && uniformi[0].length >= 1) risultati.push(uniformi)
  })
  return risultati
}

// Testo incollato (da sito o da Excel): colonne separate da TAB, una riga per riga
export function estraiTabellaDaTesto(testo) {
  const righe = String(testo || '')
    .split(/\r?\n/)
    .map(l => l.split('\t').map(c => c.trim()))
    .filter(r => r.some(c => c))
  return righe.length ? [uniformaLarghezza(righe)] : []
}

// Prova a indovinare quali colonne sono Pilota / Scuderia (l'utente può comunque cambiarle)
export function indovinaRuoliColonne(tabella, daTesto) {
  const head = tabella[0] || []
  const ruoli = head.map(h => {
    const t = String(h || '').trim()
    if (!t) return ''
    if (RE_COL_TEAM.test(t)) return 'scuderia'
    if (RE_COL_PILOTA.test(t) && !RE_COL_ESCLUDI.test(t)) return 'pilota'
    return ''
  })
  if (ruoli.some(Boolean)) return { ruoli, intestazione: true }
  if (daTesto && head.length <= 2) {
    return { ruoli: head.map((_, i) => i === 0 ? 'pilota' : 'scuderia'), intestazione: false }
  }
  return { ruoli, intestazione: !daTesto }
}

export function traduciIntestazione(h) {
  const t = String(h || '').trim()
  if (/^(car\s*#|#|no\.?|nr\.?|number|car\s*no\.?|car\s*number)$/i.test(t)) return 'Numero'
  if (/^(team|entrant)$/i.test(t)) return 'Team'
  const m = t.match(/^driver\s*(\d+)$/i)
  if (m) return `Pilota ${m[1]}`
  if (/^drivers?$/i.test(t)) return 'Piloti'
  if (/^(car|vehicle|model)$/i.test(t)) return 'Vettura'
  if (/^(class|category|cat\.?)$/i.test(t)) return 'Classe'
  if (/^(nationality|country)$/i.test(t)) return 'Nazionalità'
  return t
}

// Intestazione finale di una colonna: quella della tabella (tradotta se richiesto), oppure "Colonna N"
export function intestazioneColonna(head, i, conIntestazione, italiano) {
  const base = conIntestazione ? String((head || [])[i] || '').replace(/\s+/g, ' ').trim() : ''
  if (!base) return `Colonna ${i + 1}`
  return italiano ? traduciIntestazione(base) : base
}

// Colonne con nomi di piloti (riconosciute dal titolo): solo lì si corregge il MAIUSCOLO
export function colonnaConNomiPilota(head, i, conIntestazione) {
  const t = conIntestazione ? String((head || [])[i] || '').trim() : ''
  return !!t && ((RE_COL_PILOTA.test(t) && !RE_COL_ESCLUDI.test(t)) || /^(full\s*)?name$/i.test(t))
}

// Tabella completa: tiene solo le colonne attive (ON), ognuna con la SUA intestazione.
export function costruisciTabellaCompleta(tabella, attive, conIntestazione, correggiMaiuscolo, italiano) {
  const head = tabella[0] || []
  const indici = head.map((_, i) => i).filter(i => attive[i] !== false)
  const intestazioni = indici.map(i => intestazioneColonna(head, i, conIntestazione, italiano))
  const corpo = conIntestazione ? tabella.slice(1) : tabella
  const righe = corpo
    .filter(r => r.some(c => String(c || '').trim()))
    .map(r => indici.map(ci => {
      const parti = String(r[ci] || '').split(/\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
      const nomi = correggiMaiuscolo && colonnaConNomiPilota(head, ci, conIntestazione)
      return (nomi ? parti.map(formattaNomePilotaEntryList) : parti).join(' / ')
    }))
  return { intestazioni, righe }
}

// "Morris Schuring" → "M. Schuring" | "Kelvin van der Linde" → "K. van der Linde" | "Jean-Baptiste Simmenauer" → "J.-B. Simmenauer"
export function abbreviaNomePilota(nome) {
  let n = String(nome || '').replace(/\s+/g, ' ').trim()
  if (!n) return ''
  if (n.includes(',')) { // "Cognome, Nome" → "Nome Cognome"
    const [cognome, proprio] = n.split(',').map(x => x.trim())
    if (cognome && proprio) n = `${proprio} ${cognome}`
  }
  const tok = n.split(' ')
  if (tok.length < 2) return n // un solo nome: niente da abbreviare
  if (tok[0].includes('.')) return n // già abbreviato
  const iniziali = tok[0].split('-').filter(Boolean).map(p => p.charAt(0).toUpperCase() + '.').join('-')
  return [iniziali, ...tok.slice(1)].join(' ')
}

// Cella con uno o più piloti: "Lucas Auer, Luca Stolz" → "L. Auer, L. Stolz" (mantiene il separatore usato)
export function abbreviaNomiPilota(testo) {
  const t = String(testo || '').trim()
  if (!t) return ''
  const separatore = /\s\/\s/.test(t) ? ' / ' : (t.includes(';') ? '; ' : ', ')
  const nomi = t.split(/\s*(?:\/|;|\n)\s*/).flatMap(blocco => {
    const virgole = blocco.split(/\s*,\s*/).filter(Boolean)
    // "Nome Cognome, Nome Cognome" = elenco; "Cognome, Nome" = un solo pilota
    return (virgole.length > 1 && virgole.every(v => v.trim().split(/\s+/).length >= 2)) ? virgole : [blocco]
  })
  return nomi.map(abbreviaNomePilota).join(separatore)
}

export function escapeHtmlCella(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Sorgenti JSON (es. live timing): ogni array di oggetti diventa una tabella ──
export function appiattisciOggetto(o, prefisso = '', out = {}) {
  Object.entries(o).forEach(([k, v]) => {
    const chiave = prefisso ? `${prefisso}.${k}` : k
    if (Array.isArray(v)) {
      out[chiave] = v.map(x => (x && typeof x === 'object')
        ? Object.values(x).filter(y => y !== null && typeof y !== 'object').join(' ')
        : String(x ?? '')).join(' / ')
    } else if (v && typeof v === 'object') {
      appiattisciOggetto(v, chiave, out)
    } else {
      out[chiave] = v ?? ''
    }
  })
  return out
}

export function estraiTabelleDaJson(json) {
  const trovate = []
  const visita = (nodo, percorso, profondita) => {
    if (profondita > 7 || nodo === null || typeof nodo !== 'object') return
    if (Array.isArray(nodo)) {
      const oggetti = nodo.filter(x => x && typeof x === 'object' && !Array.isArray(x))
      const array = nodo.filter(x => Array.isArray(x) && x.every(y => y === null || typeof y !== 'object'))
      if (oggetti.length >= 2 && oggetti.length >= nodo.length * 0.8) {
        const righeObj = oggetti.map(o => appiattisciOggetto(o))
        const colonne = []
        righeObj.forEach(r => Object.keys(r).forEach(k => { if (!colonne.includes(k)) colonne.push(k) }))
        const tab = [colonne, ...righeObj.map(r => colonne.map(c => String(r[c] ?? '')))]
        tab.etichetta = percorso || 'root'
        trovate.push(tab)
        return
      }
      if (array.length >= 2 && array.length >= nodo.length * 0.8) {
        const larghezza = Math.max(...array.map(r => r.length))
        const intestazione = Array.from({ length: larghezza }, (_, i) => `Colonna ${i + 1}`)
        const tab = [intestazione, ...array.map(r => Array.from({ length: larghezza }, (_, i) => String(r[i] ?? '')))]
        tab.etichetta = percorso || 'root'
        trovate.push(tab)
        return
      }
      nodo.forEach((x, i) => visita(x, `${percorso}[${i}]`, profondita + 1))
    } else {
      Object.entries(nodo).forEach(([k, v]) => visita(v, percorso ? `${percorso}.${k}` : k, profondita + 1))
    }
  }
  visita(json, '', 0)
  return trovate
}

// Link a pagine/app di live timing presenti nell'HTML (quando la tabella non è nella pagina ma in un iframe)
export function trovaLinkLiveTiming(html) {
  const re = /https?:\/\/[^\s"'<>\\)]+/gi
  const trovati = (String(html || '').match(re) || [])
    .filter(u => /swisstiming|livetiming|liveresults|timing71|alkamel|mylaps|raceresult|results\./i.test(u))
    .map(u => u.replace(/&amp;/g, '&'))
  return Array.from(new Set(trovati)).slice(0, 3)
}

// Legge una risposta scaricata o incollata: JSON, HTML con tabelle oppure testo a tabulazioni
export function leggiContenutoImportato(contenuto) {
  const t = String(contenuto || '').trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return { tabelle: estraiTabelleDaJson(JSON.parse(t)), linkLive: [] } } catch (e) { /* non è JSON valido: provo come HTML */ }
  }
  if (t.startsWith('<')) {
    return { tabelle: estraiTabelleDaHtml(t), linkLive: trovaLinkLiveTiming(t) }
  }
  return { tabelle: estraiTabellaDaTesto(t), linkLive: [] }
}

export async function scaricaHtmlEntryList(url) {
  let ultimoErrore = null
  for (const build of PROXY_ENTRY_LIST) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12000)
    try {
      const res = await fetch(build(url), { signal: ctrl.signal })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const txt = await res.text()
      if (txt && txt.trim().length > 20) return txt
    } catch (e) {
      ultimoErrore = e
    } finally {
      clearTimeout(timer)
    }
  }
  throw ultimoErrore || new Error('Impossibile scaricare la pagina')
}

// Tabella HTML pronta da incollare: intestazioni = array di stringhe, righe = array di array di celle
export function costruisciHtmlTabella(intestazioni, righe) {
  let html = '<table class="table table-hover table-striped table-condensed" style="width:100%;">\n  <thead>\n    <tr>'
  intestazioni.forEach(h => { html += `<th>${escapeHtmlCella(h)}</th>` })
  html += '</tr>\n  </thead>\n  <tbody>\n'
  righe.forEach(r => { html += '    <tr>' + r.map(c => `<td>${escapeHtmlCella(c)}</td>`).join('') + '</tr>\n' })
  return html + '  </tbody>\n</table>'
}

// ── Top 3 per classe (GT: PRO, SILVER, GOLD, BRONZE) ────────────────────────
export const ORDINE_CLASSI = ['PRO', 'SILVER', 'GOLD', 'BRONZE']
export const RE_COL_CLASSE = /^(classe|class|category|categoria|cat\.?)$/i

// Nome della colonna "Classe" tra le colonne disponibili (o null se non c'è)
export function trovaColonnaClasse(colonne) {
  return (colonne || []).find(c => RE_COL_CLASSE.test(String(c || '').trim())) || null
}

// "Pro" / " pro " → "PRO"
export function normalizzaClasse(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
}

// Righe GIÀ in ordine di classifica → [{ classe, righe: [prime N] }]
// Ordine dei gruppi: PRO, SILVER, GOLD, BRONZE, poi le altre classi in ordine alfabetico.
// Le righe senza classe vengono ignorate.
export function top3PerClasse(righe, leggiClasse, n = 3) {
  const gruppi = new Map()
  ;(righe || []).forEach(r => {
    const classe = normalizzaClasse(leggiClasse(r))
    if (!classe) return
    if (!gruppi.has(classe)) gruppi.set(classe, [])
    const lista = gruppi.get(classe)
    if (lista.length < n) lista.push(r)
  })
  const posizione = (c) => { const i = ORDINE_CLASSI.indexOf(c); return i === -1 ? ORDINE_CLASSI.length : i }
  return [...gruppi.entries()]
    .sort((a, b) => posizione(a[0]) - posizione(b[0]) || a[0].localeCompare(b[0]))
    .map(([classe, lista]) => ({ classe, righe: lista }))
}

// ── Equipaggio completo: tutti i piloti della vettura nella stessa cella ────
// Colonne con un pilota ciascuna ("Pilota 1", "Driver 2"…) oppure un elenco già unito ("Piloti", "Drivers")
export const RE_COL_PILOTA_NUMERATA = /^(pilot[ai]?|drivers?|pilote|fahrer)\s*\d+$/i
export const RE_COL_PILOTI_ELENCO = /^(piloti|drivers)$/i

export function colonnePilotiEquipaggio(colonne) {
  return (colonne || []).filter(c => {
    const t = String(c || '').trim()
    return RE_COL_PILOTA_NUMERATA.test(t) || RE_COL_PILOTI_ELENCO.test(t)
  })
}

// Nomi dell'equipaggio di una riga, nell'ordine delle colonne, senza doppioni
export function nomiEquipaggio(riga, colonne) {
  const nomi = []
  colonnePilotiEquipaggio(colonne).forEach(c => {
    String((riga || {})[c] ?? '').split(/\s\/\s|\n|;/).map(x => x.trim()).filter(Boolean).forEach(n => {
      if (!nomi.includes(n)) nomi.push(n)
    })
  })
  return nomi
}

// ── Codice unico: più tabelle in un solo blocco da copiare ──────────────────
// blocchi = [{ titolo, html }]. Con conTitoli e più di una tabella, sopra ognuna mette <h3>titolo</h3>.
export function unisciBlocchiHtml(blocchi, conTitoli = false) {
  const piuTabelle = (blocchi || []).length > 1
  return (blocchi || [])
    .map(b => (conTitoli && piuTabelle ? `<h3>${escapeHtmlCella(b.titolo)}</h3>\n` : '') + b.html)
    .join('\n\n')
}

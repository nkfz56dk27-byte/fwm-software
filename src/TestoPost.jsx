import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// SEZIONE 1 — LOGICA TESTO (auto-wrap, adattamento font, formattazione mista)
// Nessuna dipendenza da React: usata sia dall'anteprima (sezione 2) sia
// dall'export in canvas ad alta risoluzione, così quello che vedi è
// esattamente quello che viene salvato.
//
// FORMATTAZIONE PARZIALE (colore/sottolineato su una porzione di testo, non su
// tutta la casella): ogni box ha un colore/sottolineato di DEFAULT (box.color,
// box.underline) più un elenco box.spans = [{ start, end, color?, underline? }]
// con gli intervalli di caratteri (offset nel testo originale) che hanno una
// formattazione diversa dal default. Per un dato carattere, l'ultimo span che
// lo contiene "vince" sul default.
// ============================================================================

let _measureCanvas = null
function getMeasureCtx() {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas')
  }
  return _measureCanvas.getContext('2d')
}

// Spaziatura tra lettere richiesta: fissa, sempre uguale, non regolabile dall'utente.
// Espressa in pixel dello SCHERMO (anteprima); per l'export ad alta risoluzione viene
// convertita in pixel REALI dividendo per la scala (stesso trattamento dei font-size).
// Spaziatura tra lettere richiesta: 19 "unità Canva" = 19 millesimi di em (1/1000 della
// dimensione del font) — NON 19 pixel fissi. Su Canva questo valore si applica in proporzione
// alla dimensione del testo, non come pixel assoluti: un font più grande ha una spaziatura
// (in pixel veri) proporzionalmente più larga. Verificato guardando il pannello "Spaziatura
// lettere" di Canva sullo stesso identico progetto.
export const LETTER_SPACING_RATIO = 19 / 1000
// Interlinea richiesta, anch'essa verificata sullo stesso pannello Canva ("Spaziatura righe: 1.2").
export const DEFAULT_LINE_HEIGHT_RATIO = 1.2

// Spezza un singolo blocco di testo (senza a-capo manuali al suo interno) in righe che
// stanno dentro maxWidth, ad una data dimensione font (wrap "greedy").
function wrapAtSize(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio = 0) {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.letterSpacing = `${fontSize * letterSpacingRatio}px`
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

// Come wrapAtSize, ma distribuisce le parole in modo BILANCIATO tra le righe.
function wrapBalanced(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio = 0) {
  const greedyLines = wrapAtSize(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio)
  if (greedyLines.length <= 1) return greedyLines
  const targetLineCount = greedyLines.length

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.letterSpacing = `${fontSize * letterSpacingRatio}px`
  const words = text.split(/\s+/).filter(Boolean)
  let longestWordWidth = 0
  words.forEach((w) => { longestWordWidth = Math.max(longestWordWidth, ctx.measureText(w).width) })

  let lo = longestWordWidth
  let hi = maxWidth
  for (let iter = 0; iter < 20 && hi - lo > 1; iter++) {
    const mid = (lo + hi) / 2
    const lines = wrapAtSize(ctx, text, fontSize, fontWeight, fontFamily, mid, letterSpacingRatio)
    if (lines.length <= targetLineCount) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return wrapAtSize(ctx, text, fontSize, fontWeight, fontFamily, hi, letterSpacingRatio)
}

// Calcola la struttura completa delle righe (rispettando gli a-capo manuali \n) ad una data
// dimensione font uniforme. Ogni paragrafo (separato da \n) viene bilanciato per conto suo.
function computeStructure(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio = 0) {
  const paragraphs = text.split(/\n/)
  let lines = []
  paragraphs.forEach((p) => {
    if (p.trim() === '') {
      lines.push('')
    } else {
      lines = lines.concat(wrapBalanced(ctx, p, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio))
    }
  })
  return lines
}

// Come computeStructure, ma SENZA bilanciamento (usa il wrap "greedy" semplice, senza la
// ricerca binaria interna di wrapBalanced). Molto più veloce, pensata per essere chiamata
// decine/centinaia di volte durante la SCANSIONE della dimensione giusta in fitText — il
// bilanciamento "carino" si applica una sola volta, alla fine, sulla dimensione già scelta.
function computeStructureFast(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio = 0) {
  const paragraphs = text.split(/\n/)
  let lines = []
  paragraphs.forEach((p) => {
    if (p.trim() === '') {
      lines.push('')
    } else {
      lines = lines.concat(wrapAtSize(ctx, p, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio))
    }
  })
  return lines
}

// Calcola la struttura delle righe a una data dimensione di riferimento, poi stira SUBITO
// ogni riga a piena larghezza. Restituisce le righe già stirate (senza offset).
function computeStretchedAtSize(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio = 0) {
  const lines = computeStructure(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio)
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.letterSpacing = `${fontSize * letterSpacingRatio}px`
  return lines.map((line) => {
    if (!line) return { text: '', fontSize }
    const w = ctx.measureText(line).width || 1
    const scale = maxWidth / w
    const size = Math.min(maxFontSize, Math.max(minFontSize, fontSize * scale))
    return { text: line, fontSize: size }
  })
}

// Come computeStretchedAtSize, ma usa la struttura VELOCE (senza bilanciamento) — pensata
// per la scansione in fitText, dove viene chiamata fino a centinaia di volte.
function computeStretchedAtSizeFast(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio = 0) {
  const lines = computeStructureFast(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio)
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.letterSpacing = `${fontSize * letterSpacingRatio}px`
  return lines.map((line) => {
    if (!line) return { text: '', fontSize }
    const w = ctx.measureText(line).width || 1
    const scale = maxWidth / w
    const size = Math.min(maxFontSize, Math.max(minFontSize, fontSize * scale))
    return { text: line, fontSize: size }
  })
}

// Dato il testo originale e l'elenco delle righe già decise (stringhe), calcola per ciascuna
// riga l'intervallo di caratteri [start,end) nel testo originale a cui corrisponde. Serve per
// sapere quale porzione di ogni riga ricade in uno "span" con formattazione diversa dal default.
// Le righe sono sempre sottostringhe letterali del testo originale (il wrap non altera le
// parole, solo dove le spezza), quindi indexOf le trova in modo affidabile.
function attachOffsets(text, lines) {
  const result = []
  let cursor = 0
  lines.forEach((lineText) => {
    if (!lineText) {
      result.push({ text: lineText, startOffset: cursor, endOffset: cursor })
      return
    }
    const idx = text.indexOf(lineText, cursor)
    const startOffset = idx >= 0 ? idx : cursor
    const endOffset = startOffset + lineText.length
    result.push({ text: lineText, startOffset, endOffset })
    cursor = endOffset
  })
  return result
}

// Trova il colore/sottolineato "effettivo" di un carattere: l'ultimo span che lo contiene
// vince sul default della casella.
function getEffectiveFormat(spans, index, defaultColor, defaultUnderline) {
  let color = defaultColor
  let underline = defaultUnderline
  for (const s of (spans || [])) {
    if (index >= s.start && index < s.end) {
      if (s.color) color = s.color
      if (typeof s.underline === 'boolean') underline = s.underline
    }
  }
  return { color, underline }
}

// Calcola, per ogni carattere della riga, se è sottolineato — poi "salda" i singoli spazi
// che separano due tratti sottolineati adiacenti, così due parole sottolineate una accanto
// all'altra (anche se formattate in momenti separati) appaiono come un'unica riga continua,
// invece di due trattini staccati con un buco in mezzo.
function computeBridgedUnderline(lineText, startOffset, spans, defaultUnderline) {
  const n = lineText.length
  const flags = []
  for (let i = 0; i < n; i++) {
    flags.push(getEffectiveFormat(spans, startOffset + i, '#000000', defaultUnderline).underline)
  }
  for (let i = 0; i < n; i++) {
    if (lineText[i] === ' ' && !flags[i]) {
      let a = i - 1
      while (a >= 0 && lineText[a] === ' ') a--
      let b = i + 1
      while (b < n && lineText[b] === ' ') b++
      if (a >= 0 && b < n && flags[a] && flags[b]) {
        flags[i] = true
      }
    }
  }
  return flags
}

// Spezza una riga in "run" (segmenti) di formattazione costante, per poterli disegnare/
// renderizzare separatamente ognuno con il proprio colore/sottolineato.
function splitLineIntoRuns(lineText, startOffset, spans, defaultColor, defaultUnderline) {
  if (!lineText) return []
  const bridgedUnderline = computeBridgedUnderline(lineText, startOffset, spans, defaultUnderline)
  const runs = []
  let runStart = 0
  let currentColor = getEffectiveFormat(spans, startOffset, defaultColor, defaultUnderline).color
  let currentUnderline = bridgedUnderline[0]
  for (let i = 1; i <= lineText.length; i++) {
    const nextColor = i < lineText.length ? getEffectiveFormat(spans, startOffset + i, defaultColor, defaultUnderline).color : null
    const nextUnderline = i < lineText.length ? bridgedUnderline[i] : null
    if (nextColor === null || nextColor !== currentColor || nextUnderline !== currentUnderline) {
      runs.push({ text: lineText.slice(runStart, i), color: currentColor, underline: currentUnderline })
      runStart = i
      currentColor = nextColor
      currentUnderline = nextUnderline
    }
  }
  return runs
}

// Funzione principale: calcola le righe (con offset) e la dimensione di ciascuna.
export function fitText(text, {
  maxWidth,
  minFontSize = 16,
  maxFontSize = 1000,
  fontWeight = 800,
  fontFamily = 'Roboto, sans-serif',
  lineHeightRatio = DEFAULT_LINE_HEIGHT_RATIO,
  maxHeight = Infinity,
  manualFontSize = null,
  letterSpacingRatio = 0
}) {
  const ctx = getMeasureCtx()

  if (!text || !text.trim()) {
    return { lines: [], totalHeight: 0, lineHeightRatio, baseFontSize: minFontSize }
  }

  const attachAndReturn = (rawLines) => {
    const withOffsets = attachOffsets(text, rawLines.map((l) => l.text))
    const merged = rawLines.map((l, i) => ({ ...l, startOffset: withOffsets[i].startOffset, endOffset: withOffsets[i].endOffset }))
    const totalHeight = merged.reduce((sum, l) => sum + l.fontSize * lineHeightRatio, 0)
    return { lines: merged, totalHeight, lineHeightRatio, baseFontSize: merged[0]?.fontSize || minFontSize }
  }

  // Se è impostata una dimensione manuale, la usa direttamente e uniforme su tutte le righe.
  if (manualFontSize && manualFontSize > 0) {
    const size = Math.min(maxFontSize, Math.max(minFontSize, manualFontSize))
    const rawLines = computeStructure(ctx, text, size, fontWeight, fontFamily, maxWidth, letterSpacingRatio).map((line) => ({ text: line, fontSize: size }))
    return attachAndReturn(rawLines)
  }

  // Scansiona tutte le dimensioni possibili e tiene quella che, dopo lo stiramento, riempie
  // meglio l'altezza disponibile SENZA superarla. Durante la scansione usa il calcolo VELOCE
  // (senza bilanciamento): per un testo lungo, il bilanciamento dentro ogni singolo passo della
  // scansione moltiplicherebbe il costo per centinaia di volte (era la causa dei blocchi di
  // diversi secondi quando si incollava testo lungo). Il bilanciamento "carino" delle righe si
  // applica una sola volta, alla fine, sulla dimensione già scelta.
  let bestSize = null
  let bestTotalHeight = -1
  const step = Math.max(1, (maxFontSize - minFontSize) / 300)
  for (let size = minFontSize; size <= maxFontSize; size += step) {
    const stretched = computeStretchedAtSizeFast(ctx, text, size, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio)
    const totalH = stretched.reduce((sum, l) => sum + l.fontSize * lineHeightRatio, 0)
    if (totalH <= maxHeight && totalH > bestTotalHeight) {
      bestSize = size
      bestTotalHeight = totalH
    }
  }

  if (bestSize === null) {
    // Caso estremo: nessuna dimensione testata rientra nell'altezza disponibile.
    const minLines = computeStretchedAtSize(ctx, text, minFontSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio)
    const minTotal = minLines.reduce((sum, l) => sum + l.fontSize * lineHeightRatio, 0)
    const shrink = minTotal > 0 ? Math.min(1, maxHeight / minTotal) : 1
    const safeLines = minLines.map((l) => ({ text: l.text, fontSize: Math.max(1, l.fontSize * shrink) }))
    return attachAndReturn(safeLines)
  }

  // Ricalcolo finale, UNA SOLA VOLTA, con il bilanciamento vero sulla dimensione vincente.
  const finalLines = computeStretchedAtSize(ctx, text, bestSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio)
  return attachAndReturn(finalLines)
}

// Disegna un box di testo direttamente su un canvas 2D (per l'export ad alta risoluzione),
// usando la STESSA logica di fitText così il risultato corrisponde esattamente all'anteprima.
// Rispetta la formattazione parziale (box.spans) esattamente come l'anteprima.
export function drawTextBoxOnCanvas(ctx, box, scale) {
  if (!box.text || !box.text.trim()) return

  // "scale" è il fattore SCHERMO/REALE (es. 0.33 se lo schermo mostra l'immagine a 1/3 della
  // sua dimensione reale). box.x/y/width/height sono salvati in coordinate SCHERMO: per
  // portarli alle coordinate REALI dell'immagine esportata bisogna quindi DIVIDERE per scale
  // (ingrandire), non moltiplicare — moltiplicare le rimpiccioliva ulteriormente, rendendo il
  // testo troppo piccolo e mal posizionato per essere visibile nell'immagine finale.
  const realX = box.x / scale
  const realY = box.y / scale
  const realWidth = box.width / scale
  const realHeight = (box.height || 120) / scale
  const realMinFont = box.minFontSize / scale
  const realMaxFont = box.maxFontSize / scale
  // Gli span sono offset di CARATTERI (indipendenti dalla scala), non serve riscalarli.
  const spans = box.spans || []

  const { lines, lineHeightRatio } = fitText(box.text, {
    maxWidth: realWidth,
    minFontSize: realMinFont,
    maxFontSize: realMaxFont,
    fontWeight: 700,
    fontFamily: 'Roboto, sans-serif',
    maxHeight: realHeight,
    manualFontSize: box.manualFontSize ? box.manualFontSize / scale : null,
    letterSpacingRatio: LETTER_SPACING_RATIO
  })

  ctx.save()
  // Blocco di sicurezza: ritaglia il disegno ai bordi del box
  ctx.beginPath()
  ctx.rect(realX, realY, realWidth, realHeight)
  ctx.clip()

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left' // gestiamo l'allineamento manualmente per poter disegnare run multipli

  let cursorY = realY
  lines.forEach((line) => {
    ctx.font = `700 ${line.fontSize}px Roboto, sans-serif`
    // La spaziatura si ricalcola qui in base alla dimensione REALE di QUESTA riga (che può
    // differire tra le righe con l'auto-adattamento) — proporzionale, non un valore fisso.
    ctx.letterSpacing = `${line.fontSize * LETTER_SPACING_RATIO}px`
    const lineHeight = line.fontSize * lineHeightRatio
    const runs = splitLineIntoRuns(line.text, line.startOffset, spans, box.color, box.underline)

    // Calcola la larghezza totale della riga per poter allineare centro/destra
    const totalWidth = runs.reduce((sum, r) => sum + ctx.measureText(r.text).width, 0)
    let startX = realX
    if (box.align === 'center') startX = realX + (realWidth - totalWidth) / 2
    else if (box.align === 'right') startX = realX + realWidth - totalWidth

    let cursorX = startX
    runs.forEach((run) => {
      ctx.fillStyle = run.color
      ctx.fillText(run.text, cursorX, cursorY)
      const runWidth = ctx.measureText(run.text).width
      if (run.underline) {
        const underlineY = cursorY + line.fontSize * 0.92
        const thickness = Math.max(1, line.fontSize * 0.06)
        ctx.fillStyle = run.color
        ctx.fillRect(cursorX, underlineY, runWidth, thickness)
      }
      cursorX += runWidth
    })

    cursorY += lineHeight
  })

  ctx.restore()
}

// Crea un nuovo box di testo con valori di default.
export function createTextBox(overrides = {}) {
  return {
    id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: 'NUOVO TESTO',
    x: 40,
    y: 40,
    width: 300,
    height: 120,
    color: '#FFFFFF',
    align: 'left',
    minFontSize: 14,
    maxFontSize: 300,
    manualFontSize: null, // null = automatico; un numero = dimensione scelta a mano
    underline: false,
    spans: [], // formattazione (colore/sottolineato) su porzioni specifiche di testo
    ...overrides
  }
}

// ============================================================================
// SEZIONE 2 — COMPONENTE REACT (interfaccia trascinabile)
// ============================================================================

const COLOR_SWATCHES = [
  { value: '#FFFFFF', label: 'Bianco' },
  { value: '#39C7F2', label: 'Azzurro' },
  { value: '#FF3B30', label: 'Rosso' }
]

export default function TextOverlay({ containerWidth, containerHeight, textBoxes, onChange, isMobile = false, displayScale = 1, zoomLevel = 1 }) {
  const [activeId, setActiveId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const dragStateRef = useRef(null)
  const textareaRef = useRef(null) // riferimento alla textarea attualmente in modifica
  const lastTapRef = useRef({ id: null, time: 0 }) // per rilevare il doppio tap su mobile
  const [snapGuides, setSnapGuides] = useState({ v: null, h: null }) // linee guida smart (stile Canva) mostrate durante il trascinamento

  // Le caselle di testo memorizzano posizione e dimensione in PIXEL DELLO SCHERMO (non in
  // percentuale). Se il contenitore cambia larghezza — es. passando da vista mobile a desktop
  // in DevTools, o ruotando il telefono — quei pixel non sono più corretti e la casella appare
  // disallineata. Qui la ricalcoliamo in proporzione, appena il contenitore cambia larghezza.
  const prevContainerWidthRef = useRef(containerWidth)
  useEffect(() => {
    const prevWidth = prevContainerWidthRef.current
    const roundedPrev = Math.round(prevWidth)
    const roundedNow = Math.round(containerWidth)
    if (roundedPrev && roundedPrev > 0 && roundedPrev !== roundedNow) {
      const ratio = containerWidth / prevWidth
      if (textBoxes.length > 0) {
        onChange(textBoxes.map((b) => ({
          ...b,
          x: b.x * ratio,
          y: b.y * ratio,
          width: b.width * ratio,
          height: (b.height || 120) * ratio
        })))
      }
    }
    prevContainerWidthRef.current = containerWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth])

  const updateBox = (id, patch) => {
    onChange(textBoxes.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  // Inserisce un nuovo span rimuovendo/tagliando qualunque sovrapposizione con quelli già
  // esistenti, invece di limitarsi ad accumularli in coda. Così la lista resta sempre
  // compatta (una voce per zona di testo formattata diversamente), anche se l'utente cambia
  // colore sulla stessa parola decine di volte — evitando che la lista cresca senza limite e
  // rallenti sempre di più il calcolo (ogni carattere deve scandire tutta la lista di span).
  const mergeSpan = (existingSpans, newSpan) => {
    const result = []
    for (const s of existingSpans) {
      if (s.end <= newSpan.start || s.start >= newSpan.end) {
        result.push(s) // nessuna sovrapposizione con il nuovo span: lo teniamo intero
      } else {
        if (s.start < newSpan.start) result.push({ ...s, end: newSpan.start }) // pezzo prima
        if (s.end > newSpan.end) result.push({ ...s, start: newSpan.end }) // pezzo dopo
        // la parte centrale (dentro il nuovo span) viene scartata: il nuovo span la ricopre
      }
    }
    result.push(newSpan)
    return result
  }

  // Applica un colore o un cambio di sottolineato: se nella textarea c'è del testo
  // SELEZIONATO, la formattazione si applica solo a quella porzione (aggiunge/unisce uno
  // span); altrimenti si applica come default a tutta la casella (comportamento di prima).
  const applyFormat = (box, patch) => {
    const ta = textareaRef.current
    const hasSelection = ta && ta.selectionStart !== ta.selectionEnd
    if (hasSelection) {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      // Se si tocca SOLO una proprietà (es. solo il sottolineato), portiamo dietro anche l'altra
      // già presente in quel punto — altrimenti verrebbe "dimenticata" dal nuovo span e tornerebbe
      // al valore di default (es. il colore tornerebbe bianco toccando solo il sottolineato).
      const currentFormat = getEffectiveFormat(box.spans, start, box.color, box.underline)
      const fullPatch = {
        color: patch.color !== undefined ? patch.color : currentFormat.color,
        underline: patch.underline !== undefined ? patch.underline : currentFormat.underline
      }
      const nextSpans = mergeSpan(box.spans || [], { start, end, ...fullPatch })
      updateBox(box.id, { spans: nextSpans })
    } else {
      updateBox(box.id, patch)
    }
  }

  const startEditing = (id) => {
    const box = textBoxes.find((b) => b.id === id)
    if (box && box.text === 'NUOVO TESTO') {
      updateBox(id, { text: '' })
    }
    setEditingId(id)
  }

  // Rileva manualmente il doppio tap: molti browser mobili NON generano un evento "dblclick"
  // affidabile da due tocchi ravvicinati (a differenza del doppio click del mouse su desktop,
  // che funziona sempre). Se lo stesso box riceve due tocchi entro 350ms, lo trattiamo come
  // un doppio tap ed entriamo in modifica. Restituisce true se ha attivato la modifica, così il
  // chiamante sa di NON dover avviare anche un trascinamento (altrimenti startDrag chiuderebbe
  // subito la modifica appena aperta, dato che azzera sempre editingId).
  const handlePotentialDoubleTap = (id) => {
    const now = Date.now()
    const last = lastTapRef.current
    if (last.id === id && now - last.time < 350) {
      dragStateRef.current = null // annulla qualunque trascinamento in corso: stiamo entrando in modifica
      lastTapRef.current = { id: null, time: 0 }
      startEditing(id)
      return true
    } else {
      lastTapRef.current = { id, time: now }
      return false
    }
  }

  const addTextBox = () => {
    const box = createTextBox({
      x: Math.max(20, containerWidth / 2 - 150),
      y: Math.max(20, containerHeight / 2 - 30),
      width: Math.min(300, Math.max(120, containerWidth - 40))
    })
    onChange([...textBoxes, box])
    setActiveId(box.id)
    setEditingId(box.id)
  }

  const removeTextBox = (id) => {
    onChange(textBoxes.filter((b) => b.id !== id))
    if (activeId === id) setActiveId(null)
    if (editingId === id) setEditingId(null)
  }

  const startDrag = (e, id, mode) => {
    e.stopPropagation()
    const box = textBoxes.find((b) => b.id === id)
    if (!box) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    dragStateRef.current = {
      id, mode, startX: clientX, startY: clientY,
      startBoxX: box.x, startBoxY: box.y, startWidth: box.width, startHeight: box.height || 120
    }
    setActiveId(id)
    setEditingId(null)
  }

  useEffect(() => {
    const handleMove = (e) => {
      const ds = dragStateRef.current
      if (!ds) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      // Se l'area di lavoro è ingrandita visivamente (zoomLevel > 1, tramite transform:scale nel
      // file principale), un movimento di N pixel reali dello schermo corrisponde a N/zoomLevel
      // unità nel nostro sistema di coordinate (che non cambia con lo zoom, solo con la vista).
      const dx = (clientX - ds.startX) / zoomLevel
      const dy = (clientY - ds.startY) / zoomLevel
      const box = textBoxes.find((b) => b.id === ds.id)
      if (!box) return

      if (ds.mode === 'move') {
        let newX = Math.min(Math.max(0, ds.startBoxX + dx), Math.max(0, containerWidth - box.width))
        let newY = Math.min(Math.max(0, ds.startBoxY + dy), Math.max(0, containerHeight - 20))

        // Linee guida smart (stile Canva): se il centro o un bordo della casella finisce vicino
        // al centro o ai bordi della foto, "scatta" (snap) esattamente in quella posizione e
        // mostra una linea rosa come riferimento visivo.
        const SNAP = 6
        const boxHeight = box.height || 120
        let vGuide = null
        let hGuide = null

        const centerX = containerWidth / 2
        const boxCenterX = newX + box.width / 2
        if (Math.abs(boxCenterX - centerX) < SNAP) {
          newX = centerX - box.width / 2
          vGuide = centerX
        } else if (Math.abs(newX) < SNAP) {
          newX = 0
          vGuide = 0
        } else if (Math.abs(newX + box.width - containerWidth) < SNAP) {
          newX = containerWidth - box.width
          vGuide = containerWidth
        }

        const centerY = containerHeight / 2
        const boxCenterY = newY + boxHeight / 2
        if (Math.abs(boxCenterY - centerY) < SNAP) {
          newY = centerY - boxHeight / 2
          hGuide = centerY
        } else if (Math.abs(newY) < SNAP) {
          newY = 0
          hGuide = 0
        } else if (Math.abs(newY + boxHeight - containerHeight) < SNAP) {
          newY = containerHeight - boxHeight
          hGuide = containerHeight
        }

        setSnapGuides({ v: vGuide, h: hGuide })
        updateBox(ds.id, { x: newX, y: newY })
      } else if (ds.mode === 'resize-right') {
        const newWidth = Math.min(Math.max(60, ds.startWidth + dx), containerWidth - box.x)
        updateBox(ds.id, { width: newWidth })
      } else if (ds.mode === 'resize-left') {
        const newWidth = Math.max(60, ds.startWidth - dx)
        const newX = Math.min(Math.max(0, ds.startBoxX + dx), ds.startBoxX + ds.startWidth - 60)
        updateBox(ds.id, { width: newWidth, x: newX })
      } else if (ds.mode === 'resize-corner') {
        const newWidth = Math.min(Math.max(60, ds.startWidth + dx), containerWidth - box.x)
        const newHeight = Math.min(Math.max(30, ds.startHeight + dy), containerHeight - box.y)
        updateBox(ds.id, { width: newWidth, height: newHeight })
      } else if (ds.mode === 'resize-bottom') {
        const newHeight = Math.min(Math.max(30, ds.startHeight + dy), containerHeight - box.y)
        updateBox(ds.id, { height: newHeight })
      } else if (ds.mode === 'resize-top') {
        const newHeight = Math.max(30, ds.startHeight - dy)
        const newY = Math.min(Math.max(0, ds.startBoxY + dy), ds.startBoxY + ds.startHeight - 30)
        updateBox(ds.id, { height: newHeight, y: newY })
      }
    }

    const stopDrag = () => { dragStateRef.current = null; setSnapGuides({ v: null, h: null }) }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', stopDrag)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', stopDrag)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', stopDrag)
    }
  }, [textBoxes, containerWidth, containerHeight])

  // Barra di formattazione mostrata SOPRA la textarea mentre si scrive/modifica: seleziona
  // del testo e clicca un colore o "S" per formattare solo quella porzione; senza selezione,
  // si applica come default a tutta la casella.
  const renderEditingToolbar = (box) => (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: '-42px', left: 0, display: 'flex', gap: '6px', alignItems: 'center',
        background: 'rgba(28,28,30,0.92)', padding: '6px 8px', borderRadius: '10px', zIndex: 65,
        maxWidth: isMobile ? '92vw' : 'none', flexWrap: 'wrap'
      }}
    >
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c.value}
          title={c.label}
          onMouseDown={(e) => { e.preventDefault(); applyFormat(box, { color: c.value }) }}
          style={{ width: '22px', height: '22px', borderRadius: '50%', background: c.value, border: '1px solid rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
        />
      ))}
      <div style={{ width: '1px', height: '20px', background: '#555', margin: '0 2px' }} />
      <button
        title="Sottolineato (su selezione, o su tutta la casella se nulla è selezionato)"
        onMouseDown={(e) => {
          e.preventDefault()
          const ta = textareaRef.current
          const hasSelection = ta && ta.selectionStart !== ta.selectionEnd
          if (hasSelection) {
            // Controlla se il PRIMO carattere della selezione è già sottolineato: se sì,
            // questo click lo TOGLIE; altrimenti lo aggiunge. Così il pulsante alterna
            // davvero, invece di poter solo aggiungere la sottolineatura senza mai toglierla.
            const currentlyUnderlined = getEffectiveFormat(box.spans, ta.selectionStart, box.color, box.underline).underline
            applyFormat(box, { underline: !currentlyUnderlined })
          } else {
            applyFormat(box, { underline: !box.underline })
          }
        }}
        style={{ width: '26px', height: '22px', borderRadius: '5px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: '12px', fontWeight: '900', textDecoration: 'underline', cursor: 'pointer' }}
      >
        S
      </button>
      <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>
        {isMobile ? 'seleziona per colorare' : 'seleziona testo per colorare solo una parte'}
      </span>
    </div>
  )

  const renderToolbar = (targetBox, targetLines, sidePanel = false) => (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={
        sidePanel
          ? {
              position: 'absolute', top: `${targetBox.y}px`, left: '100%', marginLeft: '12px',
              display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'stretch',
              background: 'rgba(28,28,30,0.92)', padding: '8px', borderRadius: '10px', zIndex: 70, width: '112px'
            }
          : {
              position: 'absolute', top: '-46px', left: 0, display: 'flex', gap: '6px',
              alignItems: 'center', background: 'rgba(28,28,30,0.9)', padding: '6px 8px', borderRadius: '10px', zIndex: 60
            }
      }
    >
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: sidePanel ? 'center' : 'flex-start', flexWrap: sidePanel ? 'wrap' : 'nowrap' }}>
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c.value}
            title={c.label}
            onClick={() => updateBox(targetBox.id, { color: c.value })}
            style={{ width: '22px', height: '22px', borderRadius: '50%', background: c.value, border: targetBox.color === c.value ? '2px solid #007AFF' : '1px solid #555', cursor: 'pointer', padding: 0 }}
          />
        ))}
        <button
          onClick={() => updateBox(targetBox.id, { underline: !targetBox.underline })}
          title="Sottolineato"
          style={{ width: '22px', height: '22px', borderRadius: '5px', border: 'none', background: targetBox.underline ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: '12px', fontWeight: '900', textDecoration: 'underline', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          U
        </button>
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: sidePanel ? 'center' : 'flex-start', flexWrap: sidePanel ? 'wrap' : 'nowrap' }}>
        <button
          onClick={() => updateBox(targetBox.id, { align: 'left' })}
          title="Allinea a sinistra"
          style={{ width: '26px', height: '24px', borderRadius: '6px', border: 'none', background: targetBox.align === 'left' ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          ⬅
        </button>
        <button
          onClick={() => updateBox(targetBox.id, { align: 'center' })}
          title="Allinea al centro"
          style={{ width: '26px', height: '24px', borderRadius: '6px', border: 'none', background: targetBox.align === 'center' ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          ↔
        </button>
        <button
          onClick={() => updateBox(targetBox.id, { align: 'right' })}
          title="Allinea a destra"
          style={{ width: '26px', height: '24px', borderRadius: '6px', border: 'none', background: targetBox.align === 'right' ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          ➡
        </button>
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: sidePanel ? 'center' : 'flex-start', flexWrap: sidePanel ? 'wrap' : 'nowrap' }}>
        <button
          onClick={() => {
            const current = targetBox.manualFontSize || targetLines[0]?.fontSize || targetBox.minFontSize
            updateBox(targetBox.id, { manualFontSize: Math.max(targetBox.minFontSize, Math.round(current - 4)) })
          }}
          title="Rimpicciolisci"
          style={{ width: '22px', height: '24px', borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          −
        </button>
        <button
          onClick={() => {
            const current = targetBox.manualFontSize || targetLines[0]?.fontSize || targetBox.minFontSize
            updateBox(targetBox.id, { manualFontSize: Math.min(targetBox.maxFontSize, Math.round(current + 4)) })
          }}
          title="Ingrandisci"
          style={{ width: '22px', height: '24px', borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          +
        </button>
        <select
          value={targetBox.manualFontSize || ''}
          onChange={(e) => {
            const val = e.target.value
            updateBox(targetBox.id, { manualFontSize: val === '' ? null : Math.min(targetBox.maxFontSize, Math.max(targetBox.minFontSize, parseInt(val, 10))) })
          }}
          title="Scegli una dimensione predefinita"
          style={{ height: '24px', borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer', padding: '0 2px' }}
        >
          <option value="">Auto</option>
          {[16, 20, 24, 28, 32, 40, 48, 56, 64, 72, 80, 96, 112, 128, 150, 180, 220, 260, 300].map((size) => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: sidePanel ? 'center' : 'flex-start' }}>
        <button
          onClick={() => updateBox(targetBox.id, { manualFontSize: null })}
          title="Torna alla dimensione automatica"
          style={{ padding: '5px 7px', borderRadius: '6px', border: 'none', background: targetBox.manualFontSize ? '#3A3A3C' : '#007AFF', color: '#fff', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
        >
          AUTO
        </button>
        <button
          onClick={() => startEditing(targetBox.id)}
          style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
        >
          ✎ Testo
        </button>
      </div>
    </div>
  )

  return (
    <>
      {textBoxes.map((box) => {
        const boxHeight = box.height || 120
        const { lines } = fitText(box.text, {
          maxWidth: box.width,
          minFontSize: box.minFontSize,
          maxFontSize: box.maxFontSize,
          fontWeight: 700,
          fontFamily: 'Roboto, sans-serif',
          maxHeight: boxHeight,
          manualFontSize: box.manualFontSize,
          letterSpacingRatio: LETTER_SPACING_RATIO
        })
        const isActive = activeId === box.id
        const isEditing = editingId === box.id

        return (
          <div
            key={box.id}
            onMouseDown={(e) => { if (!isEditing) startDrag(e, box.id, 'move') }}
            onTouchStart={(e) => { if (!isEditing) { const openedEditing = handlePotentialDoubleTap(box.id); if (!openedEditing) startDrag(e, box.id, 'move') } }}
            onClick={(e) => { e.stopPropagation(); setActiveId(box.id) }}
            onDoubleClick={(e) => { e.stopPropagation(); startEditing(box.id) }}
            style={{
              position: 'absolute',
              left: `${box.x}px`,
              top: `${box.y}px`,
              width: `${box.width}px`,
              height: `${boxHeight}px`,
              cursor: isEditing ? 'text' : 'move',
              userSelect: 'none',
              touchAction: 'manipulation', // 'none' bloccava anche il pinch-to-zoom con due dita;
              // 'manipulation' lascia passare il pinch, blocca solo il doppio-tap-zoom nativo del
              // browser (che comunque gestiamo noi manualmente per aprire la modifica del testo)
              outline: isActive ? '1px dashed rgba(0,122,255,0.8)' : 'none',
              outlineOffset: '6px',
              zIndex: isActive ? 50 : 40
            }}
          >
            {isEditing ? (
              <>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={box.text}
                  onChange={(e) => updateBox(box.id, { text: e.target.value.toUpperCase() })}
                  onBlur={(e) => {
                    // Non chiudere se il click è stato su un pulsante della barra di formattazione
                    setTimeout(() => setEditingId((cur) => (cur === box.id ? null : cur)), 120)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    height: '100%',
                    fontFamily: 'Roboto, sans-serif',
                    fontWeight: 700,
                    fontSize: `${Math.min(box.maxFontSize, 32)}px`,
                    letterSpacing: `${Math.min(box.maxFontSize, 32) * LETTER_SPACING_RATIO}px`,
                    color: box.color,
                    textAlign: box.align,
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px dashed rgba(255,255,255,0.6)',
                    borderRadius: '4px',
                    padding: '2px',
                    resize: 'none',
                    outline: 'none',
                    touchAction: 'auto', // ripristina copia-incolla e doppio tap nativi del telefono,
                    // ignorando il touchAction:none impostato sul contenitore (serve solo per il
                    // trascinamento della casella, non deve toccare la scrittura)
                    userSelect: 'text',
                    WebkitUserSelect: 'text'
                  }}
                />
                {/* Barra colori/sottolineato + anteprima dal vivo: "teletrasportate" con un portale
                in un contenitore FUORI dal canvas (in RitaglioImmagine.jsx, a destra della foto),
                altrimenti — essendo l'area della foto con overflow:hidden/auto per via dello zoom —
                resterebbero tagliate o intrappolate dentro il frame. */}
                {typeof document !== 'undefined' && document.getElementById('fwm-text-side-portal') && createPortal(
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap',
                        background: 'rgba(28,28,30,0.92)', padding: '8px', borderRadius: '10px'
                      }}
                    >
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c.value}
                          title={c.label}
                          onMouseDown={(e) => { e.preventDefault(); applyFormat(box, { color: c.value }) }}
                          style={{ width: '22px', height: '22px', borderRadius: '50%', background: c.value, border: '1px solid rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                      <div style={{ width: '1px', height: '20px', background: '#555', margin: '0 2px' }} />
                      <button
                        title="Sottolineato (su selezione, o su tutta la casella se nulla è selezionato)"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          const ta = textareaRef.current
                          const hasSelection = ta && ta.selectionStart !== ta.selectionEnd
                          if (hasSelection) {
                            const currentlyUnderlined = getEffectiveFormat(box.spans, ta.selectionStart, box.color, box.underline).underline
                            applyFormat(box, { underline: !currentlyUnderlined })
                          } else {
                            applyFormat(box, { underline: !box.underline })
                          }
                        }}
                        style={{ width: '26px', height: '22px', borderRadius: '5px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: '12px', fontWeight: '900', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        S
                      </button>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>seleziona per colorare solo una parte</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: '10px', padding: '12px 16px', maxWidth: '90vw' }}>
                      <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '6px', fontWeight: '700', letterSpacing: '0.5px' }}>ANTEPRIMA</div>
                      <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 700, textAlign: box.align }}>
                        {lines.length > 0
                          ? lines.map((line, i) => {
                              const runs = splitLineIntoRuns(line.text, line.startOffset, box.spans, box.color, box.underline)
                              const previewScale = Math.min(1, 28 / (line.fontSize || 28))
                              return (
                                <div key={i} style={{ fontSize: `${(line.fontSize || 16) * previewScale}px`, letterSpacing: `${(line.fontSize || 16) * previewScale * LETTER_SPACING_RATIO}px`, lineHeight: DEFAULT_LINE_HEIGHT_RATIO, whiteSpace: 'nowrap' }}>
                                  {runs.map((run, ri) => (
                                    <span key={ri} style={{ color: run.color, textDecoration: run.underline ? 'underline' : 'none' }}>
                                      {run.text}
                                    </span>
                                  ))}
                                </div>
                              )
                            })
                          : <span style={{ color: '#777', fontSize: '12px' }}>...</span>}
                      </div>
                    </div>
                  </div>,
                  document.getElementById('fwm-text-side-portal')
                )}
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                <div
                  style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontWeight: 700,
                    textAlign: box.align,
                    pointerEvents: 'none'
                  }}
                >
                  {lines.length > 0
                    ? lines.map((line, i) => {
                        const runs = splitLineIntoRuns(line.text, line.startOffset, box.spans, box.color, box.underline)
                        return (
                          <div key={i} style={{ fontSize: `${line.fontSize}px`, letterSpacing: `${line.fontSize * LETTER_SPACING_RATIO}px`, lineHeight: DEFAULT_LINE_HEIGHT_RATIO, whiteSpace: 'nowrap' }}>
                            {runs.length > 0
                              ? runs.map((run, ri) => (
                                  <span key={ri} style={{ color: run.color, textDecoration: run.underline ? 'underline' : 'none' }}>
                                    {run.text}
                                  </span>
                                ))
                              : '\u00A0'}
                          </div>
                        )
                      })
                    : <div style={{ opacity: 0.4, fontSize: '16px', color: '#fff' }}>Doppio click per scrivere...</div>}
                </div>
              </div>
            )}

            {isActive && !isEditing && (
              <>
                {/* Maniglie laterali per regolare la larghezza */}
                <div
                  onMouseDown={(e) => startDrag(e, box.id, 'resize-left')}
                  onTouchStart={(e) => startDrag(e, box.id, 'resize-left')}
                  style={{
                    position: 'absolute', top: '50%', left: 0, transform: 'translate(-50%, -50%)',
                    width: '28px', height: '28px', cursor: 'ew-resize', touchAction: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: '3px solid #007AFF' }} />
                </div>
                <div
                  onMouseDown={(e) => startDrag(e, box.id, 'resize-right')}
                  onTouchStart={(e) => startDrag(e, box.id, 'resize-right')}
                  style={{
                    position: 'absolute', top: '50%', right: 0, transform: 'translate(50%, -50%)',
                    width: '28px', height: '28px', cursor: 'ew-resize', touchAction: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: '3px solid #007AFF' }} />
                </div>

                {/* Maniglie in alto/basso per regolare SOLO l'altezza */}
                <div
                  onMouseDown={(e) => startDrag(e, box.id, 'resize-top')}
                  onTouchStart={(e) => startDrag(e, box.id, 'resize-top')}
                  style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)',
                    width: '28px', height: '28px', cursor: 'ns-resize', touchAction: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: '3px solid #007AFF' }} />
                </div>
                <div
                  onMouseDown={(e) => startDrag(e, box.id, 'resize-bottom')}
                  onTouchStart={(e) => startDrag(e, box.id, 'resize-bottom')}
                  style={{
                    position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 50%)',
                    width: '28px', height: '28px', cursor: 'ns-resize', touchAction: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: '3px solid #007AFF' }} />
                </div>

                {/* Maniglia d'angolo: ridimensiona LARGHEZZA e ALTEZZA insieme */}
                <div
                  onMouseDown={(e) => startDrag(e, box.id, 'resize-corner')}
                  onTouchStart={(e) => startDrag(e, box.id, 'resize-corner')}
                  style={{
                    position: 'absolute', bottom: 0, right: 0, transform: 'translate(50%, 50%)',
                    width: '28px', height: '28px', cursor: 'nwse-resize', touchAction: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: '3px solid #007AFF' }} />
                </div>

                {/* Pulsante elimina */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeTextBox(box.id) }}
                  style={{
                    position: 'absolute', top: '-8px', right: '-8px', width: '16px', height: '16px',
                    borderRadius: '50%', border: 'none', background: 'rgba(255,59,48,0.85)', color: '#fff',
                    fontSize: '9px', fontWeight: '700', cursor: 'pointer', zIndex: 60,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0
                  }}
                >
                  ✕
                </button>

                {/* Barra controlli: su mobile resta ancorata sopra la casella (su desktop è un pannello a parte, fuori dal frame) */}
                {isMobile && renderToolbar(box, lines, false)}
              </>
            )}
          </div>
        )
      })}

      {/* Su desktop: pannello controlli fuori dal frame, a destra, per la casella attiva */}
      {!isMobile && (() => {
        const activeBox = textBoxes.find((b) => b.id === activeId)
        if (!activeBox || editingId === activeId) return null
        const { lines: activeLines } = fitText(activeBox.text, {
          maxWidth: activeBox.width,
          minFontSize: activeBox.minFontSize,
          maxFontSize: activeBox.maxFontSize,
          fontWeight: 700,
          fontFamily: 'Roboto, sans-serif',
          maxHeight: activeBox.height || 120,
          manualFontSize: activeBox.manualFontSize,
          letterSpacingRatio: LETTER_SPACING_RATIO
        })
        return renderToolbar(activeBox, activeLines, true)
      })()}

      {/* Linee guida smart (stile Canva): appaiono solo mentre trascini una casella e si
      allinea al centro o ai bordi della foto. */}
      {snapGuides.v !== null && (
        <div style={{ position: 'absolute', left: `${snapGuides.v}px`, top: 0, bottom: 0, width: '1px', background: '#007AFF', zIndex: 90, pointerEvents: 'none', boxShadow: '0 0 4px rgba(0,122,255,0.8)' }} />
      )}
      {snapGuides.h !== null && (
        <div style={{ position: 'absolute', top: `${snapGuides.h}px`, left: 0, right: 0, height: '1px', background: '#007AFF', zIndex: 90, pointerEvents: 'none', boxShadow: '0 0 4px rgba(0,122,255,0.8)' }} />
      )}

    </>
  )
}

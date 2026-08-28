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
let _robotoReady = false // diventa true solo dopo che il font Roboto è davvero caricato dal browser

// Forza il caricamento del font "Roboto" il prima possibile, e tiene traccia di quando è
// pronto — senza questo, il canvas "nascosto" usato per calcolare quanto allargare il testo
// potrebbe misurare con un font di riserva (più stretto di Roboto) prima che quello vero sia
// disponibile, causando uno stiramento incompleto (il testo non arriva ai bordi).
if (typeof document !== 'undefined' && document.fonts) {
  Promise.all([
    document.fonts.load('700 16px Roboto'),
    document.fonts.load('900 16px Roboto')
  ]).then(() => { _robotoReady = true })
  document.fonts.ready.then(() => { _robotoReady = true })
}

// Hook React che restituisce true solo quando Roboto è DAVVERO pronto — e fa RI-RENDERIZZARE
// il componente che lo usa nel momento esatto in cui lo diventa. Prima, _robotoReady veniva
// impostata ma nessun componente React la "osservava": se il primissimo disegno avveniva prima
// che Roboto fosse caricato (misurando quindi con un font di riserva più stretto), quella misura
// sbagliata restava congelata per sempre — anche dopo che Roboto diventava disponibile, perché
// nulla innescava un nuovo disegno. Questo hook chiude quel buco.
function useRobotoReady() {
  const [ready, setReady] = useState(_robotoReady)
  useEffect(() => {
    if (ready) return
    let cancelled = false
    const markReady = () => { if (!cancelled) setReady(true) }
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([
        document.fonts.load('700 16px Roboto'),
        document.fonts.load('900 16px Roboto')
      ]).then(markReady)
      document.fonts.ready.then(markReady)
    }
    return () => { cancelled = true }
  }, [ready])
  return ready
}

function getMeasureCtx() {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas')
  }
  return _measureCanvas.getContext('2d')
}

// Misura la larghezza di un testo con spaziatura tra lettere GESTITA A MANO (somma delle
// larghezze dei singoli caratteri + uno spazio fisso tra ognuno), invece di affidarsi alla
// proprietà nativa ctx.letterSpacing del browser. Necessario perché in alcuni browser
// ctx.letterSpacing può essere applicata in modo leggermente diverso tra measureText e
// fillText — un conto quando si MISURA, un altro quando si DISEGNA — quindi qualunque
// ricalibrazione basata sulla stessa misurazione nativa eredita lo stesso scarto e non risolve
// mai davvero il problema. Misurando e disegnando SEMPRE con questo stesso identico algoritmo,
// il risultato combacia sempre esattamente, perché siamo noi (non il browser) a decidere dove
// va ogni carattere.
function measureTextWithSpacing(ctx, text, letterSpacingPx) {
  if (!text) return 0
  let width = 0
  for (const ch of text) {
    width += ctx.measureText(ch).width
  }
  if (text.length > 1) width += (Array.from(text).length - 1) * letterSpacingPx
  return width
}

// Disegna un testo con la stessa spaziatura manuale usata da measureTextWithSpacing, carattere
// per carattere. Restituisce la larghezza totale effettivamente disegnata.
function fillTextWithSpacing(ctx, text, x, y, letterSpacingPx) {
  let cursorX = x
  for (const ch of text) {
    ctx.fillText(ch, cursorX, y)
    cursorX += ctx.measureText(ch).width + letterSpacingPx
  }
  return cursorX - x
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

// Interruttore per il pulsante "📍 Posizione" (mostra le coordinate in pixel reali della
// casella). Metti a "true" per riattivarlo — tutto il resto del codice resta invariato.
const SHOW_POSITION_BUTTON = true
// Interlinea richiesta, anch'essa verificata sullo stesso pannello Canva ("Spaziatura righe: 1.2").
export const DEFAULT_LINE_HEIGHT_RATIO = 0.8
// Rapporto "incollato": usato SOLO quando l'interlinea è impostata manualmente, come base da cui
// il campo "Interlinea" parte a 0 (righe che si toccano). Più basso di DEFAULT_LINE_HEIGHT_RATIO
// perché quello include già una spaziatura "leggibile" di default, mentre qui 0 deve voler dire
// letteralmente incollato — poi ogni px scritto nel campo si aggiunge SOLO da qui in su.
export const TIGHT_LINE_HEIGHT_RATIO = 0.62

// Spezza un singolo blocco di testo (senza a-capo manuali al suo interno) in righe che
// stanno dentro maxWidth, ad una data dimensione font (wrap "greedy").
function wrapAtSize(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio = 0) {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const letterSpacingPx = fontSize * letterSpacingRatio
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measureTextWithSpacing(ctx, candidate, letterSpacingPx) > maxWidth) {
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
  const letterSpacingPx = fontSize * letterSpacingRatio
  const words = text.split(/\s+/).filter(Boolean)
  let longestWordWidth = 0
  words.forEach((w) => { longestWordWidth = Math.max(longestWordWidth, measureTextWithSpacing(ctx, w, letterSpacingPx)) })

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

// Dopo aver PREVISTO una dimensione stirata (in base a una misurazione fatta a una dimensione
// diversa e proiettata linearmente), la rimisura DAVVERO a quella dimensione esatta — con la
// spaziatura tra lettere corrispondente — e la corregge se il risultato non centra esattamente
// il bordo. Serve perché la proiezione lineare (dimensione_base * scala) non è garantita essere
// perfettamente esatta (arrotondamenti del motore di rendering, sub-pixel), quindi senza questa
// rifinitura le righe potevano finire leggermente più strette del previsto e non toccare i bordi.
function refineStretchToWidth(ctx, lineText, predictedSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio) {
  // Se la dimensione prevista è già al limite min/max, resterebbe comunque clampata lì: non ha
  // senso (e potrebbe essere fuorviante) provare a "correggerla" oltre quel limite.
  if (predictedSize <= minFontSize || predictedSize >= maxFontSize) return predictedSize
  ctx.font = `${fontWeight} ${predictedSize}px ${fontFamily}`
  const actualW = measureTextWithSpacing(ctx, lineText, predictedSize * letterSpacingRatio) || 1
  if (actualW <= 0) return predictedSize
  const correctedSize = predictedSize * (maxWidth / actualW)
  return Math.min(maxFontSize, Math.max(minFontSize, correctedSize))
}

// Calcola la struttura delle righe a una data dimensione di riferimento, poi stira SUBITO
// ogni riga a piena larghezza. Restituisce le righe già stirate (senza offset).
function computeStretchedAtSize(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio = 0) {
  const lines = computeStructure(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio)
  return lines.map((line) => {
    if (!line) return { text: '', fontSize }
    // IMPORTANTE: ctx.font va reimpostato alla dimensione BASE qui, per OGNI riga — non basta
    // farlo una volta sola prima del ciclo, perché refineStretchToWidth (chiamata più sotto)
    // lascia ctx.font impostato sulla dimensione RIFINITA di questa riga. Senza reimpostarlo, la
    // riga SUCCESSIVA erediterebbe quella dimensione sbagliata invece di ripartire dalla base,
    // con un errore di misurazione che si accumula (e aggrava) riga dopo riga.
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    const w = measureTextWithSpacing(ctx, line, fontSize * letterSpacingRatio) || 1
    const scale = maxWidth / w
    const predictedSize = Math.min(maxFontSize, Math.max(minFontSize, fontSize * scale))
    const size = refineStretchToWidth(ctx, line, predictedSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio)
    return { text: line, fontSize: size }
  })
}

// Come computeStretchedAtSize, ma usa la struttura VELOCE (senza bilanciamento) — pensata
// per la scansione in fitText, dove viene chiamata fino a centinaia di volte.
// "refine": se true (default) rimisura esattamente ogni riga per la massima precisione — costa
// una misurazione canvas in più a riga. Durante la SCANSIONE (dove serve solo confrontare le
// altezze tra tanti candidati, non un risultato pixel-perfect) va passato false, altrimenti il
// costo si moltiplica per centinaia di iterazioni ed è quello che rendeva tutto lentissimo.
function computeStretchedAtSizeFast(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio = 0, refine = true) {
  const lines = computeStructureFast(ctx, text, fontSize, fontWeight, fontFamily, maxWidth, letterSpacingRatio)
  return lines.map((line) => {
    if (!line) return { text: '', fontSize }
    // Stesso motivo del commento in computeStretchedAtSize: reimposta SEMPRE la dimensione BASE
    // prima di misurare questa riga, altrimenti eredita quella (rifinita) lasciata dalla riga
    // precedente nel ciclo.
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    const w = measureTextWithSpacing(ctx, line, fontSize * letterSpacingRatio) || 1
    const scale = maxWidth / w
    const sizeGrezza = fontSize * scale
    const predictedSize = Math.min(maxFontSize, Math.max(minFontSize, sizeGrezza))
    const size = refine
      ? refineStretchToWidth(ctx, line, predictedSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio)
      : predictedSize
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
  maxFontSize = 300,
  fontWeight = 700,
  fontFamily = 'Roboto, sans-serif',
  lineHeightRatio = DEFAULT_LINE_HEIGHT_RATIO,
  maxHeight = Infinity,
  manualFontSize = null,
  letterSpacingRatio = 0,
  lineGaps = null // array opzionale: le giunzioni REALI impostate manualmente dall'utente (stessa
  // unità di maxWidth/maxHeight). Se fornito, il font può CRESCERE oltre la dimensione "di
  // sicurezza" quando queste giunzioni reali occupano MENO spazio del rapporto automatico
  // roomy — mai farlo restringere: si prende sempre il maggiore tra le due dimensioni calcolate.
}) {
  const ctx = getMeasureCtx()

  if (!text || !text.trim()) {
    return { lines: [], totalHeight: 0, lineHeightRatio, baseFontSize: minFontSize }
  }

  const attachAndReturn = (rawLines, refSize) => {
    const withOffsets = attachOffsets(text, rawLines.map((l) => l.text))
    const merged = rawLines.map((l, i) => ({ ...l, startOffset: withOffsets[i].startOffset, endOffset: withOffsets[i].endOffset }))
    // L'altezza di riga qui è usata SOLO per decidere quanto testo entra nella casella (durante
    // la scansione della dimensione), NON per il disegno finale — quella (con l'eventuale
    // interlinea manuale) la calcola separatamente drawTextBoxOnCanvas usando "rowFontSize".
    // "refSize" è una dimensione UNIFORME, uguale per ogni riga — è il MASSIMO tra le dimensioni
    // post-stiramento di tutte le righe — e NON la dimensione effettiva di ciascuna singola riga
    // presa da sola. Così tutte le righe hanno sempre la STESSA distanza tra loro, ed essendo il
    // massimo è sempre abbastanza alta da contenere anche la riga più stirata (nessuna
    // sovrapposizione).
    const rowHeight = refSize * lineHeightRatio
    const totalHeight = merged.length * rowHeight
    return { lines: merged, totalHeight, lineHeightRatio, rowFontSize: refSize, baseFontSize: merged[0]?.fontSize || minFontSize }
  }

  // Se è impostata una dimensione manuale, la usa direttamente e uniforme su tutte le righe.
  if (manualFontSize && manualFontSize > 0) {
    const size = Math.min(maxFontSize, Math.max(minFontSize, manualFontSize))
    const rawLines = computeStructure(ctx, text, size, fontWeight, fontFamily, maxWidth, letterSpacingRatio).map((line) => ({ text: line, fontSize: size }))
    return attachAndReturn(rawLines, size)
  }

  // Scansiona tutte le dimensioni possibili e tiene quella che, dopo lo stiramento, riempie
  // meglio l'altezza disponibile SENZA superarla. Durante la scansione usa il calcolo VELOCE
  // (senza bilanciamento): per un testo lungo, il bilanciamento dentro ogni singolo passo della
  // scansione moltiplicherebbe il costo per centinaia di volte (era la causa dei blocchi di
  // diversi secondi quando si incollava testo lungo). Il bilanciamento "carino" delle righe si
  // applica una sola volta, alla fine, sulla dimensione già scelta.
  // Prima scansione: SEMPRE con il rapporto automatico "roomy" (lineHeightRatio) — questa è la
  // dimensione "di sicurezza", che NON dipende mai dall'interlinea manuale scelta dall'utente.
  // L'altezza di riga usata per il confronto è quella della riga PIÙ GRANDE dopo lo stiramento
  // (non la dimensione base pre-stiramento): usare la base pre-stiramento lasciava che una riga
  // corta, stirata molto più delle altre per riempire la larghezza, finisse più alta della riga
  // che le veniva allocata — sovrapponendosi alla riga successiva. Usando il massimo, la riga di
  // riferimento è sempre abbastanza alta da contenere anche la riga più stirata.
  const scanBestSize = (heightForCandidate) => {
    let best = null
    let bestTotal = -1
    const step = Math.max(1, (maxFontSize - minFontSize) / 120)
    for (let size = minFontSize; size <= maxFontSize; size += step) {
      const stretched = computeStretchedAtSizeFast(ctx, text, size, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio, false)
      const maxLineSize = stretched.reduce((m, l) => Math.max(m, l.fontSize), 0)
      const totalH = heightForCandidate(stretched, maxLineSize)
      if (totalH <= maxHeight && totalH > bestTotal) {
        best = size
        bestTotal = totalH
      }
    }
    // Se NESSUNA dimensione testata rientra nell'altezza disponibile (testo davvero troppo
    // lungo per la casella), usa comunque minFontSize invece di restituire null. È FONDAMENTALE
    // che il chiamante prosegua sempre nel percorso normale (che stira ogni riga a piena
    // larghezza) — il vecchio ramo "caso estremo" più sotto rimpiccioliva UNIFORMEMENTE il font
    // DOPO averlo già stirato correttamente, vanificando lo stiramento: ogni riga finiva
    // proporzionalmente più corta del bordo della casella (era la causa vera del testo che non
    // toccava i bordi — non c'entrava letterSpacing). L'eventuale eccedenza verticale resta
    // comunque al sicuro, tagliata dal ritaglio (ctx.clip) del box.
    return best === null ? minFontSize : best
  }

  const bestSizeSafe = scanBestSize((stretched, maxLineSize) => stretched.length * (maxLineSize * lineHeightRatio))

  // Seconda scansione (solo se sono state fornite le giunzioni REALI): usa lo spazio
  // EFFETTIVAMENTE occupato dalle giunzioni impostate dall'utente, invece del rapporto
  // automatico. Se queste giunzioni sono più STRETTE del rapporto automatico, questa scansione
  // può restituire una dimensione PIÙ GRANDE (c'è più spazio libero da riempire) — mai più
  // piccola di bestSizeSafe nel risultato finale, perché prendiamo sempre il maggiore dei due.
  let bestSizeReal = null
  if (lineGaps != null) {
    bestSizeReal = scanBestSize((stretched, maxLineSize) => {
      let total = maxLineSize // estensione della prima/ultima riga, come termine di paragone
      for (let i = 0; i < stretched.length - 1; i++) {
        const gapVal = lineGaps[i] != null ? lineGaps[i] : 0
        total += computeGapLineHeight(maxLineSize, gapVal)
      }
      return total
    })
  }

  const bestSize = (bestSizeReal != null && bestSizeReal > bestSizeSafe) ? bestSizeReal : bestSizeSafe

  // Ricalcolo finale con lo STESSO metodo (veloce) usato durante la scansione.
  const finalLines = computeStretchedAtSizeFast(ctx, text, bestSize, fontWeight, fontFamily, maxWidth, minFontSize, maxFontSize, letterSpacingRatio)
  const finalMaxLineSize = finalLines.reduce((m, l) => Math.max(m, l.fontSize), 0)
  return attachAndReturn(finalLines, finalMaxLineSize)
}

// Calcola l'altezza (spazio verticale) di UNA giunzione tra due righe consecutive, dato il suo
// valore specifico (già nell'unità giusta: px reali per l'export, px schermo per l'anteprima).
// gapValue === null → quella giunzione (o l'intera casella, se è null per costruzione) usa il
// rapporto automatico "leggibile" di sempre. gapValue è un numero (anche 0 o negativo, con un
// minimo di sicurezza) → parte dal rapporto "incollato" (TIGHT_LINE_HEIGHT_RATIO) e ci si somma.
function computeGapLineHeight(rowFontSize, gapValue) {
  if (gapValue == null) return rowFontSize * DEFAULT_LINE_HEIGHT_RATIO
  return Math.max(rowFontSize * 0.08, rowFontSize * TIGHT_LINE_HEIGHT_RATIO + gapValue)
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

  const { lines, rowFontSize } = fitText(box.text, {
    maxWidth: realWidth,
    minFontSize: realMinFont,
    maxFontSize: realMaxFont,
    fontWeight: 700,
    fontFamily: 'Roboto, sans-serif',
    maxHeight: realHeight,
    manualFontSize: box.manualFontSize ? box.manualFontSize / scale : null,
    letterSpacingRatio: LETTER_SPACING_RATIO,
    // Le giunzioni reali (già convertite da px SCHERMO a px REALI, come width/height/minFontSize)
    // servono qui SOLO per permettere al font di CRESCERE oltre la base di sicurezza quando
    // occupano meno spazio del rapporto automatico — mai per farlo restringere, vedi fitText.
    lineGaps: box.lineGaps != null ? box.lineGaps.map((g) => (g != null ? g / scale : g)) : null
  })

  ctx.save()
  // Blocco di sicurezza: ritaglia il disegno ai bordi del box
  ctx.beginPath()
  ctx.rect(realX, realY, realWidth, realHeight)
  ctx.clip()

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left' // gestiamo l'allineamento manualmente per poter disegnare run multipli

  // L'avanzamento verticale (spazio tra una riga e l'altra) usa SEMPRE rowFontSize — una
  // dimensione UNIFORME uguale per tutte le righe — e NON la dimensione stirata di ciascuna
  // riga: altrimenti una riga corta stirata più delle altre (per riempire tutta la larghezza)
  // finiva anche per "occupare" più spazio verticale, rendendo il distacco alla riga successiva
  // visibilmente diverso dagli altri.
  // Ogni GIUNZIONE tra riga e riga successiva ha il proprio valore indipendente in
  // box.lineGaps[i] (i = 0 tra riga 1 e 2, ecc.), così si può stringere/allargare una singola
  // coppia di righe senza toccare le altre, tutte dentro la stessa casella. box.lineGaps === null
  // → l'intera casella resta sul rapporto automatico "leggibile" di sempre. Se invece è un array
  // (modalità manuale attiva sulla casella) ma questa specifica giunzione non è stata
  // personalizzata, parte "incollata" (0) e non dal rapporto automatico più largo.
  let cursorY = realY
  lines.forEach((line, i) => {
    ctx.font = `700 ${line.fontSize}px Roboto, sans-serif`
    const letterSpacingPx = line.fontSize * LETTER_SPACING_RATIO

    // Larghezza totale della riga (per l'allineamento centro/destra): misurata con LO STESSO
    // identico algoritmo (carattere per carattere) usato durante lo stiramento e che verrà
    // usato qui sotto per disegnare — deve combaciare sempre esattamente, altrimenti la riga
    // non tocca i bordi come previsto.
    const totalWidth = measureTextWithSpacing(ctx, line.text, letterSpacingPx)
    let startX = realX
    if (box.align === 'center') startX = realX + (realWidth - totalWidth) / 2
    else if (box.align === 'right') startX = realX + realWidth - totalWidth

    // Disegna CARATTERE PER CARATTERE, in modo continuo su tutta la riga — non un "run" (blocco
    // di colore) alla volta: sommare le larghezze di più run separati perdeva lo spazio esatto
    // nel punto di giunzione tra un colore e l'altro (un carattere di troppo poco vicino al
    // successivo), causando lo stesso tipo di scarto che impediva di toccare i bordi.
    const bridgedUnderline = computeBridgedUnderline(line.text, line.startOffset, spans, box.underline)
    let cursorX = startX
    let underlineStart = null
    let underlineColor = null
    const flushUnderline = (endX) => {
      if (underlineStart == null) return
      const underlineY = cursorY + line.fontSize * 0.92
      const thickness = Math.max(1, line.fontSize * 0.06)
      ctx.fillStyle = underlineColor
      ctx.fillRect(underlineStart, underlineY, endX - underlineStart, thickness)
      underlineStart = null
    }
    for (let ci = 0; ci < line.text.length; ci++) {
      const ch = line.text[ci]
      const { color } = getEffectiveFormat(spans, line.startOffset + ci, box.color, box.underline)
      const isUnderlined = bridgedUnderline[ci]
      ctx.fillStyle = color
      ctx.fillText(ch, cursorX, cursorY)
      const chWidth = ctx.measureText(ch).width
      if (isUnderlined && underlineStart == null) {
        underlineStart = cursorX
        underlineColor = color
      } else if (!isUnderlined) {
        flushUnderline(cursorX)
      }
      cursorX += chWidth + (ci < line.text.length - 1 ? letterSpacingPx : 0)
    }
    flushUnderline(cursorX)

    if (i < lines.length - 1) {
      const gapValue = box.lineGaps != null
        ? (box.lineGaps[i] != null ? box.lineGaps[i] / scale : 0)
        : null
      cursorY += computeGapLineHeight(rowFontSize, gapValue)
    }
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
    maxFontSize: 1000,
    manualFontSize: null, // null = automatico; un numero = dimensione scelta a mano
    underline: false,
    spans: [], // formattazione (colore/sottolineato) su porzioni specifiche di testo
    lineGaps: null, // array px SCHERMO, uno per ogni giunzione tra riga e riga successiva (indice 0 = tra riga 1 e 2, ecc); null = tutta la casella in automatico. Elementi mancanti nell'array = quella giunzione è "incollata" (0 sopra al rapporto stretto)
    locked: false, // se true: la casella non si sposta né si ridimensiona (come il lucchetto di Canva) — di default sbloccata; la casella automatica del progetto passa locked:true esplicitamente
    ...overrides
  }
}

// ============================================================================
// SEZIONE 2 — COMPONENTE REACT (interfaccia trascinabile)
// ============================================================================

const COLOR_SWATCHES = [
  { value: '#FFFFFF', label: 'Bianco' },
  { value: '#01a9ce', label: 'Azzurro' },
  { value: '#fe0001', label: 'Rosso' }
]

// Disegna l'anteprima della casella usando la STESSA IDENTICA funzione (drawTextBoxOnCanvas)
// usata per l'export finale — non più HTML/CSS. Così non può più esserci nessuno scarto tra
// quello che vedi mentre lavori e quello che ottieni nel file scaricato: è letteralmente lo
// stesso codice di disegno, solo con scale=1 (le coordinate del box sono già in pixel schermo).
function TextBoxCanvasPreview({ box, boxHeight }) {
  const canvasRef = useRef(null)
  const robotoReady = useRobotoReady()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = Math.max(1, Math.round(box.width))
    const height = Math.max(1, Math.round(boxHeight))
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // scale=1: le proprietà del box (minFontSize, maxFontSize, ecc.) sono già pensate per lo
    // schermo, non serve nessuna conversione — x/y a 0 perché disegniamo nel riquadro LOCALE
    // del canvas (il posizionamento nella pagina lo fa il contenitore <div> che lo racchiude).
    drawTextBoxOnCanvas(ctx, { ...box, x: 0, y: 0, width, height }, 1)
  }, [box, boxHeight, robotoReady])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
      {(!box.text || !box.text.trim()) && (
        <div style={{ opacity: 0.4, fontSize: '16px', color: '#fff', pointerEvents: 'none' }}>Doppio click per scrivere...</div>
      )}
    </div>
  )
}

// Campo numerico editabile usato nel popup "📍 Posizione" (mostra px REALI e converte da/verso
// i px del canvas moltiplicando/dividendo per displayScale quando l'utente scrive un valore).
// DEVE stare a livello di modulo (fuori da qualunque funzione che si rieseguisce ad ogni render,
// come l'IIFE del popup): definirlo lì dentro gli dava un'identità DIVERSA ad ogni render, quindi
// React lo smontava e rimontava da zero ad ogni battitura, azzerando lo stato locale prima
// ancora che l'utente potesse vedere il numero cambiare — sembrava che scrivere o usare le
// freccette del campo non facesse assolutamente nulla.
// Il testo digitato vive in uno stato LOCALE, sincronizzato dal valore ufficiale solo quando il
// campo NON ha il focus — altrimenti, siccome il valore ufficiale passa per un arrotondamento
// reale<->schermo, ogni tentativo di scrivere veniva subito "corretto" e spesso riportato a un
// altro numero prima ancora di poter scrivere la cifra successiva.
function PositionField({ label, value, onCommit }) {
  const [local, setLocal] = useState(String(value))
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusedRef.current) setLocal(String(value))
  }, [value])
  return (
    <div style={{ background: '#f2f2f7', borderRadius: '10px', padding: '10px' }}>
      <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: '700' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
        <input
          type="number"
          value={local}
          onFocus={(e) => { focusedRef.current = true; e.target.select() }}
          onBlur={() => { focusedRef.current = false; setLocal(String(value)) }}
          onChange={(e) => {
            const raw = e.target.value
            setLocal(raw)
            const v = raw === '' || raw === '-' ? 0 : Number(raw)
            if (!Number.isNaN(v)) onCommit(v)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
          style={{
            width: '70px', fontSize: '18px', fontWeight: '800', border: 'none',
            background: 'transparent', padding: 0, outline: 'none', color: '#000',
            fontFamily: 'inherit', MozAppearance: 'textfield'
          }}
        />
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#8e8e93' }}>px</span>
      </div>
    </div>
  )
}

export default function TextOverlay({ containerWidth, containerHeight, textBoxes, onChange, isMobile = false, displayScale = 1, zoomLevel = 1, baseContainerWidth = null }) {
  useRobotoReady() // forza un re-render (e quindi un ricalcolo di fitText ovunque) nel momento esatto in cui Roboto diventa davvero pronto — senza, una misurazione fatta col font di riserva del browser restava sbagliata per sempre
  const [activeId, setActiveId] = useState(null)
  const [showPositionInfo, setShowPositionInfo] = useState(null) // id della casella di cui mostrare la posizione, o null
  const [editingId, setEditingId] = useState(null)
  const dragStateRef = useRef(null)
  const textareaRef = useRef(null) // riferimento alla textarea attualmente in modifica
  const lastTapRef = useRef({ id: null, time: 0 }) // per rilevare il doppio tap su mobile
  const [snapGuides, setSnapGuides] = useState({ v: null, h: null }) // linee guida smart (stile Canva) mostrate durante il trascinamento
  // Trascinamento del MODALE "📍 Posizione in pixel reali" (solo desktop, dalla barra del
  // titolo) — per poterlo spostare via dal canvas e vedere sia la foto che i numeri insieme,
  // invece di doverlo chiudere per guardare dove sta andando a finire la casella di testo.
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 })
  const modalDragStateRef = useRef(null)
  // Riparte centrato ogni volta che si apre il popup per una NUOVA casella (o si riapre dopo
  // averlo chiuso), invece di restare fermo nell'ultima posizione trascinata potenzialmente fuori
  // vista.
  useEffect(() => {
    if (showPositionInfo) setModalOffset({ x: 0, y: 0 })
  }, [showPositionInfo])

  // Clic fuori da qualunque casella (e fuori dal pannello strumenti a destra) = deseleziona,
  // così il bordo blu tratteggiato sparisce. I clic DENTRO una casella o sul pannello (che vive
  // nel portale fwm-text-side-portal, fuori dal frame) non contano come "fuori".
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const clickedInsideBox = e.target.closest && e.target.closest('[data-fwm-textbox]')
      const clickedInsideDesktopPanel = e.target.closest && e.target.closest('#fwm-text-side-portal')
      const clickedInsideMobilePanel = e.target.closest && e.target.closest('#fwm-text-mobile-portal')
      if (!clickedInsideBox && !clickedInsideDesktopPanel && !clickedInsideMobilePanel) {
        setActiveId(null)
      }
    }
    window.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('touchstart', handleOutsideClick)
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [])

  // Le caselle di testo memorizzano posizione e dimensione in PIXEL DELLO SCHERMO (non in
  // percentuale). Se il contenitore cambia larghezza — es. passando da vista mobile a desktop
  // in DevTools, o ruotando il telefono — quei pixel non sono più corretti e la casella appare
  // disallineata. Qui la ricalcoliamo in proporzione, appena il contenitore cambia larghezza.
  // IMPORTANTE: reagisce a "baseContainerWidth" (la larghezza VERA del contenitore, senza
  // zoom), NON a "containerWidth" (che qui riceve zoomedWidth, cioè containerWidth*zoomLevel).
  // Prima usava containerWidth per errore: ogni volta che si zoomava (non solo ridimensionando
  // la finestra), questo effetto scattava e deformava le coordinate della casella, pensando
  // che il contenitore fosse stato ridimensionato per davvero.
  const prevContainerWidthRef = useRef(baseContainerWidth || containerWidth)
  useEffect(() => {
    const refWidth = baseContainerWidth || containerWidth
    const prevWidth = prevContainerWidthRef.current
    const roundedPrev = Math.round(prevWidth)
    const roundedNow = Math.round(refWidth)
    if (roundedPrev && roundedPrev > 0 && roundedPrev !== roundedNow) {
      const ratio = refWidth / prevWidth
      if (textBoxes.length > 0) {
        onChange(textBoxes.map((b) => ({
          ...b,
          x: b.x * ratio,
          y: b.y * ratio,
          width: b.width * ratio,
          height: (b.height || 120) * ratio,
          // Anche i parametri del TESTO vanno riscalati con lo stesso rapporto — altrimenti
          // box e testo cambiano dimensione insieme ma la spaziatura/font-size restano fissi
          // in pixel assoluti, e il rapporto tra i due cambia tra desktop e mobile (è la causa
          // della spaziatura diversa segnalata: qualunque valore si imposta, deve apparire
          // IDENTICO in proporzione su ogni dispositivo, non solo su quello dove è stato scelto).
          minFontSize: b.minFontSize * ratio,
          maxFontSize: b.maxFontSize * ratio,
          manualFontSize: b.manualFontSize != null ? b.manualFontSize * ratio : b.manualFontSize,
          lineGaps: b.lineGaps != null ? b.lineGaps.map((g) => (g != null ? g * ratio : g)) : b.lineGaps
        })))
      }
    }
    prevContainerWidthRef.current = refWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseContainerWidth, containerWidth])

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

  // Avvia il trascinamento del modale "Posizione" quando si tiene premuto sulla sua barra del
  // titolo — SOLO su desktop (su mobile il modale resta centrato/a schermo intero, non c'è
  // spazio utile per spostarlo e trascinarlo interferirebbe con lo scroll a dito).
  const startModalDrag = (e) => {
    if (isMobile) return
    // Non avviare il trascinamento se si è premuto sul pulsante "✕" di chiusura.
    if (e.target.closest && e.target.closest('button')) return
    e.preventDefault()
    modalDragStateRef.current = {
      startX: e.clientX, startY: e.clientY,
      startOffsetX: modalOffset.x, startOffsetY: modalOffset.y
    }
  }

  useEffect(() => {
    const handleModalMove = (e) => {
      const ds = modalDragStateRef.current
      if (!ds) return
      setModalOffset({
        x: ds.startOffsetX + (e.clientX - ds.startX),
        y: ds.startOffsetY + (e.clientY - ds.startY)
      })
    }
    const stopModalDrag = () => { modalDragStateRef.current = null }
    window.addEventListener('mousemove', handleModalMove)
    window.addEventListener('mouseup', stopModalDrag)
    return () => {
      window.removeEventListener('mousemove', handleModalMove)
      window.removeEventListener('mouseup', stopModalDrag)
    }
  }, [])

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

  const renderToolbar = (targetBox, targetLines, sidePanel = false) => {
  // Su mobile (sidePanel=false) i pulsanti sono troppo piccoli per il tocco — questo
  // moltiplicatore li ingrandisce del 60% SOLO lì, lasciando il pannello desktop (sidePanel=true,
  // spazio stretto accanto al canvas) esattamente come prima.
  const m = sidePanel ? 1 : 1.6
  const mpx = (n) => `${Math.round(n * m)}px`
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={
        sidePanel
          ? {
              display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'stretch',
              background: 'rgba(28,28,30,0.92)', padding: '8px', borderRadius: '10px', width: '148px'
            }
          : {
              display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center',
              background: 'rgba(28,28,30,0.92)', padding: '10px', borderRadius: '12px', width: '100%', boxSizing: 'border-box'
            }
      }
    >
      {/* Su mobile: prima riga = formattazione (colore, sottolineato, allineamento). Su
      desktop questi restano due gruppi separati, uno sotto l'altro come sempre. */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: sidePanel ? undefined : 'wrap', flexDirection: sidePanel ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', width: sidePanel ? '100%' : 'auto' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c.value}
            title={c.label}
            onClick={() => updateBox(targetBox.id, { color: c.value })}
            style={{ width: mpx(26), height: mpx(26), borderRadius: '50%', background: c.value, border: targetBox.color === c.value ? '2px solid #007AFF' : '1px solid #555', cursor: 'pointer', padding: 0 }}
          />
        ))}
        <button
          onClick={() => updateBox(targetBox.id, { underline: !targetBox.underline })}
          title="Sottolineato"
          style={{ width: mpx(26), height: mpx(26), borderRadius: '6px', border: 'none', background: targetBox.underline ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: mpx(13), fontWeight: '900', textDecoration: 'underline', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          U
        </button>
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: sidePanel ? 'center' : 'flex-start', flexWrap: sidePanel ? 'wrap' : 'nowrap' }}>
        <button
          onClick={() => updateBox(targetBox.id, { align: 'left' })}
          title="Allinea a sinistra"
          style={{ width: mpx(30), height: mpx(28), borderRadius: '6px', border: 'none', background: targetBox.align === 'left' ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: mpx(14), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          ⬅
        </button>
        <button
          onClick={() => updateBox(targetBox.id, { align: 'center' })}
          title="Allinea al centro"
          style={{ width: mpx(30), height: mpx(28), borderRadius: '6px', border: 'none', background: targetBox.align === 'center' ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: mpx(14), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          ↔
        </button>
        <button
          onClick={() => updateBox(targetBox.id, { align: 'right' })}
          title="Allinea a destra"
          style={{ width: mpx(30), height: mpx(28), borderRadius: '6px', border: 'none', background: targetBox.align === 'right' ? '#007AFF' : '#3A3A3C', color: '#fff', fontSize: mpx(14), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        >
          ➡
        </button>
      </div>
      </div>

      {/* Su mobile: seconda riga = dimensione (- / + / predefinite) e Auto/Testo */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: sidePanel ? undefined : 'wrap', flexDirection: sidePanel ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', width: sidePanel ? '100%' : 'auto' }}>
      {/* Box unico "dimensione testo": raggruppa -/+/numero e lo switch AUTO/MANUALE, così si
      vede a colpo d'occhio che sono parte dello stesso sistema. */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: sidePanel ? 'center' : 'flex-start', flexWrap: sidePanel ? 'wrap' : 'nowrap', background: '#242426', border: '1px solid #3A3A3C', borderRadius: '9px', padding: '5px' }}>
        <button
          onClick={() => {
            if (targetBox.manualFontSize == null) return // in automatico i pulsanti sono disattivati
            const current = targetBox.manualFontSize || targetLines[0]?.fontSize || targetBox.minFontSize
            updateBox(targetBox.id, { manualFontSize: Math.max(targetBox.minFontSize, Math.round((current - 1) * 10) / 10) })
          }}
          disabled={targetBox.manualFontSize == null}
          title="Rimpicciolisci"
          style={{ width: mpx(28), height: mpx(28), borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: mpx(16), fontWeight: '800', cursor: targetBox.manualFontSize == null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: targetBox.manualFontSize == null ? 0.4 : 1 }}
        >
          −
        </button>
        <button
          onClick={() => {
            if (targetBox.manualFontSize == null) return // in automatico i pulsanti sono disattivati
            const current = targetBox.manualFontSize || targetLines[0]?.fontSize || targetBox.minFontSize
            updateBox(targetBox.id, { manualFontSize: Math.min(targetBox.maxFontSize, Math.round((current + 1) * 10) / 10) })
          }}
          disabled={targetBox.manualFontSize == null}
          title="Ingrandisci"
          style={{ width: mpx(28), height: mpx(28), borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: mpx(16), fontWeight: '800', cursor: targetBox.manualFontSize == null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: targetBox.manualFontSize == null ? 0.4 : 1 }}
        >
          +
        </button>
        <input
          type="number"
          step="0.1"
          min="0"
          value={targetBox.manualFontSize ?? ''}
          disabled={targetBox.manualFontSize == null}
          onChange={(e) => {
            const val = e.target.value
            if (val === '') { updateBox(targetBox.id, { manualFontSize: null }); return }
            const parsed = parseFloat(val)
            if (Number.isNaN(parsed)) return
            if (parsed < 0) return // mai negativo, nemmeno mentre si scrive
            updateBox(targetBox.id, { manualFontSize: parsed }) // sotto il minimo si può scrivere liberamente, il limite scatta solo al blur
          }}
          onBlur={() => {
            // Il limite minimo/massimo si applica solo ORA, quando si esce dal campo — così si
            // può cancellare tutto e scrivere un numero nuovo senza scattare al minimo a metà.
            if (targetBox.manualFontSize == null) return
            const clamped = Math.min(targetBox.maxFontSize, Math.max(targetBox.minFontSize, targetBox.manualFontSize))
            if (clamped !== targetBox.manualFontSize) updateBox(targetBox.id, { manualFontSize: clamped })
          }}
          placeholder="Auto"
          title="Dimensione font — puoi scrivere anche i decimali, es. 12.1, 12.2..."
          style={{ width: mpx(52), height: mpx(28), borderRadius: '6px', border: 'none', background: targetBox.manualFontSize == null ? '#2C2C2E' : '#3A3A3C', color: targetBox.manualFontSize == null ? '#8e8e93' : '#fff', fontSize: mpx(11), fontWeight: '700', padding: '0 6px', textAlign: 'center', cursor: targetBox.manualFontSize == null ? 'not-allowed' : 'text' }}
        />
        <div style={{ width: '1px', alignSelf: 'stretch', background: '#3A3A3C', margin: '0 1px' }} />
        {/* Switch esplicito Automatico / Manuale per la dimensione del testo */}
        <div style={{ display: 'flex', gap: '3px', background: '#1c1c1e', padding: '2px', borderRadius: '7px' }}>
          <button
            onClick={() => updateBox(targetBox.id, { manualFontSize: null })}
            title="La dimensione si adatta da sola alla casella"
            style={{ padding: sidePanel ? '5px 9px' : '7px 12px', borderRadius: '5px', border: 'none', background: targetBox.manualFontSize == null ? '#007AFF' : 'transparent', color: '#fff', fontSize: mpx(10), fontWeight: '800', cursor: 'pointer' }}
          >
            AUTO
          </button>
          <button
            onClick={() => {
              if (targetBox.manualFontSize != null) return // già in manuale
              const startSize = targetLines[0]?.fontSize || targetBox.minFontSize
              updateBox(targetBox.id, { manualFontSize: Math.round(startSize * 10) / 10 })
            }}
            title="Scrivi tu la dimensione del testo"
            style={{ padding: sidePanel ? '5px 9px' : '7px 12px', borderRadius: '5px', border: 'none', background: targetBox.manualFontSize != null ? '#007AFF' : 'transparent', color: '#fff', fontSize: mpx(10), fontWeight: '800', cursor: 'pointer' }}
          >
            MANUALE
          </button>
        </div>
      </div>

      {/* Gruppo "Interlinea": UNA riga di controlli per OGNI giunzione tra due righe adiacenti
      (indice i = spazio tra la riga i+1 e la riga i+2) — non un valore unico per tutta la
      casella, perché ogni coppia di righe deve potersi regolare in modo indipendente, anche con
      valori diversi tra loro, restando sempre dentro la stessa casella. Pulsante "AUTO" in alto
      riporta l'INTERA casella al rapporto automatico "leggibile" di sempre (nessun controllo
      manuale su nessuna giunzione); appena si tocca anche solo una giunzione, la casella entra in
      modalità manuale e le giunzioni non ancora toccate partono "incollate" (0). */}
      {targetLines.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'stretch', background: '#242426', border: '1px solid #3A3A3C', borderRadius: '9px', padding: '5px', width: sidePanel ? '100%' : 'auto', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', padding: '0 2px' }}>
            <span style={{ fontSize: mpx(10), color: '#8e8e93', fontWeight: '700' }}>Interlinea (per ogni riga)</span>
            <button
              onClick={() => updateBox(targetBox.id, { lineGaps: null })}
              disabled={targetBox.lineGaps == null}
              title="Torna tutta la casella alla spaziatura automatica"
              style={{
                padding: sidePanel ? '3px 8px' : '5px 11px', borderRadius: '5px', border: 'none',
                background: targetBox.lineGaps == null ? '#007AFF' : 'transparent',
                color: '#fff', fontSize: mpx(9), fontWeight: '800',
                cursor: targetBox.lineGaps == null ? 'default' : 'pointer'
              }}
            >
              AUTO
            </button>
          </div>
          {Array.from({ length: targetLines.length - 1 }).map((_, gapIndex) => {
            const currentValue = (targetBox.lineGaps && targetBox.lineGaps[gapIndex] != null) ? targetBox.lineGaps[gapIndex] : 0
            const setGap = (newValue) => {
              // Ricostruisce l'array partendo da quello attuale (o da uno vuoto se la casella
              // era ancora in automatico), allungandolo se serve, e tocca SOLO l'indice
              // interessato — le altre giunzioni restano come stanno.
              const base = targetBox.lineGaps ? [...targetBox.lineGaps] : []
              while (base.length <= gapIndex) base.push(0)
              base[gapIndex] = newValue
              updateBox(targetBox.id, { lineGaps: base })
            }
            return (
              <div key={gapIndex} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-start' }}>
                <span style={{ fontSize: mpx(9), color: '#8e8e93', fontWeight: '700', width: mpx(38), flexShrink: 0 }}>{gapIndex + 1}↕{gapIndex + 2}</span>
                <button
                  onClick={() => setGap(currentValue - 1)}
                  title={`Riduci lo spazio tra riga ${gapIndex + 1} e riga ${gapIndex + 2}`}
                  style={{ width: mpx(24), height: mpx(24), borderRadius: '5px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: mpx(14), fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                >
                  −
                </button>
                <button
                  onClick={() => setGap(currentValue + 1)}
                  title={`Aumenta lo spazio tra riga ${gapIndex + 1} e riga ${gapIndex + 2}`}
                  style={{ width: mpx(24), height: mpx(24), borderRadius: '5px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: mpx(14), fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                >
                  +
                </button>
                <input
                  type="number"
                  step="1"
                  value={currentValue}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || val === '-') { setGap(0); return }
                    const parsed = parseFloat(val)
                    if (Number.isNaN(parsed)) return
                    // Valori NEGATIVI ammessi: avvicinano questa coppia di righe oltre
                    // l'incollato. La dimensione del testo resta invariata in ogni caso.
                    setGap(parsed)
                  }}
                  title={`Spazio (px, anche negativo, 0 = incollate) tra riga ${gapIndex + 1} e riga ${gapIndex + 2}`}
                  style={{ width: mpx(44), height: mpx(24), borderRadius: '5px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: mpx(10), fontWeight: '700', padding: '0 4px', textAlign: 'center', flexShrink: 0 }}
                />
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: '4px', justifyContent: sidePanel ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
        <button
          onClick={() => updateBox(targetBox.id, { locked: !targetBox.locked })}
          title={targetBox.locked ? 'Sblocca posizione' : 'Blocca posizione (come su Canva: non si sposta né ridimensiona)'}
          style={{ padding: sidePanel ? '5px 9px' : '9px 14px', borderRadius: '6px', border: 'none', background: targetBox.locked ? '#FF9500' : '#3A3A3C', color: '#fff', fontSize: mpx(12), fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg viewBox="0 0 24 24" width={Math.round(13 * m)} height={Math.round(13 * m)} fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10.5" width="16" height="10" rx="2" />
            {targetBox.locked ? (
              <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
            ) : (
              <path d="M7.5 10.5V7a4.5 4.5 0 0 1 8.5-2.8" />
            )}
          </svg>
        </button>
        <button
          onClick={() => startEditing(targetBox.id)}
          style={{ padding: sidePanel ? '5px 9px' : '9px 14px', borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: mpx(12), fontWeight: '800', cursor: 'pointer' }}
        >
          ✎ Testo
        </button>
        {SHOW_POSITION_BUTTON && (
          <button
            onClick={() => setShowPositionInfo(targetBox.id)}
            title="Vedi la posizione in pixel reali"
            style={{ padding: sidePanel ? '5px 9px' : '9px 14px', borderRadius: '6px', border: 'none', background: '#3A3A3C', color: '#fff', fontSize: mpx(12), fontWeight: '800', cursor: 'pointer' }}
          >
            📍 Posizione
          </button>
        )}
      </div>
      </div>
    </div>
  )
  }

  return (
    <>
      {/* Tutte le caselle di testo vivono qui dentro: un contenitore che si INGRANDISCE con lo
      zoom (transform:scale), così posizione e dimensione di ogni casella seguono
      automaticamente lo zoom della foto, invece di restare "ferme" in pixel fissi mentre la
      foto sotto cresce/si rimpicciolisce. Le coordinate delle caselle (box.x/y/width) restano
      SEMPRE quelle "vere" (a zoom 100%) — è solo la resa visiva che si scala qui. */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: `${zoomLevel > 0 ? 100 / zoomLevel : 100}%`,
        height: `${zoomLevel > 0 ? 100 / zoomLevel : 100}%`,
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'top left',
        zIndex: 45, // più alto della grafica overlay (zIndex:6 in RitaglioImmagine.jsx) — il
        // "transform" qui sopra crea un nuovo livello di sovrapposizione isolato, quindi senza
        // questo numero esplicito il gruppo di caselle finiva sotto alla grafica per errore.
        pointerEvents: 'none' // lascia passare i clic alla foto sottostante nelle zone SENZA
        // testo — altrimenti questo contenitore (che copre l'intera area) intercettava anche i
        // clic destinati al trascinamento della foto, impedendo di spostarla.
      }}>
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
          letterSpacingRatio: LETTER_SPACING_RATIO,
          lineGaps: box.lineGaps
        })
        const isActive = activeId === box.id
        const isEditing = editingId === box.id

        return (
          <div
            key={box.id}
            data-fwm-textbox="true"
            onMouseDown={(e) => { if (!isEditing && !box.locked) startDrag(e, box.id, 'move') }}
            onTouchStart={(e) => { if (!isEditing) { const openedEditing = handlePotentialDoubleTap(box.id); if (!openedEditing && !box.locked) startDrag(e, box.id, 'move') } }}
            onClick={(e) => { e.stopPropagation(); setActiveId(box.id) }}
            onDoubleClick={(e) => { e.stopPropagation(); startEditing(box.id) }}
            style={{
              position: 'absolute',
              left: `${box.x}px`,
              top: `${box.y}px`,
              width: `${box.width}px`,
              height: `${boxHeight}px`,
              cursor: isEditing ? 'text' : (box.locked ? 'default' : 'move'),
              userSelect: 'none',
              touchAction: 'manipulation', // 'none' bloccava anche il pinch-to-zoom con due dita;
              // 'manipulation' lascia passare il pinch, blocca solo il doppio-tap-zoom nativo del
              // browser (che comunque gestiamo noi manualmente per aprire la modifica del testo)
              outline: isActive ? '1px dashed rgba(0,122,255,0.8)' : 'none',
              outlineOffset: '6px',
              zIndex: isActive ? 50 : 40,
              pointerEvents: 'auto' // riattiva i clic SOLO qui, dato che il contenitore intorno
              // (vedi sopra) li ha disattivati di default per lasciar passare quelli sulla foto
            }}
          >
            {/* Badge lucchetto: sempre visibile sulla casella bloccata, anche senza selezionarla */}
            {box.locked && (
              <div style={{
                position: 'absolute', top: '-8px', left: '-8px', width: '16px', height: '16px',
                borderRadius: '50%', background: '#FF9500', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 61, pointerEvents: 'none'
              }}>
                <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10.5" width="16" height="10" rx="2" />
                  <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
                </svg>
              </div>
            )}
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
                {/* Barra colori/sottolineato + anteprima dal vivo, MENTRE SI SCRIVE (isEditing):
                unico punto dove esistono davvero questi controlli in quel momento — l'ALTRA
                barra (renderToolbar) appare in un momento diverso (box selezionato ma NON in
                modifica), quindi qui NON è una duplicazione, va mostrata su mobile e desktop. */}
                {typeof document !== 'undefined' && document.getElementById(isMobile ? 'fwm-text-mobile-portal' : 'fwm-text-side-portal') && createPortal(
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: isMobile ? 'center' : 'stretch', width: '100%' }}>
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
                    <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: '10px', padding: '12px 16px', maxWidth: '90vw', overflow: 'hidden', boxSizing: 'border-box', margin: isMobile ? '0 auto' : 0 }}>
                      <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '6px', fontWeight: '700', letterSpacing: '0.5px' }}>ANTEPRIMA</div>
                      <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 700, textAlign: box.align }}>
                        {lines.length > 0
                          ? lines.map((line, i) => {
                              const runs = splitLineIntoRuns(line.text, line.startOffset, box.spans, box.color, box.underline)
                              const previewScale = Math.min(1, 28 / (line.fontSize || 28))
                              // Per la riga i, lo spazio rilevante è la giunzione PRIMA di essa
                              // (tra la riga precedente e questa), cioè box.lineGaps[i - 1]. La
                              // prima riga non ha una giunzione prima di sé.
                              const gapIndex = i - 1
                              const gapValueRaw = gapIndex < 0
                                ? null
                                : (box.lineGaps != null ? (box.lineGaps[gapIndex] != null ? box.lineGaps[gapIndex] : 0) : null)
                              const previewLineHeight = gapValueRaw == null
                                ? (line.fontSize || 16) * previewScale * DEFAULT_LINE_HEIGHT_RATIO
                                : Math.max(
                                    (line.fontSize || 16) * previewScale * 0.08,
                                    (line.fontSize || 16) * previewScale * TIGHT_LINE_HEIGHT_RATIO + gapValueRaw * previewScale
                                  )
                              return (
                                <div key={i} style={{ fontSize: `${(line.fontSize || 16) * previewScale}px`, letterSpacing: `${(line.fontSize || 16) * previewScale * LETTER_SPACING_RATIO}px`, lineHeight: `${previewLineHeight}px`, whiteSpace: 'normal', wordBreak: 'break-word' }}>
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
                  document.getElementById(isMobile ? 'fwm-text-mobile-portal' : 'fwm-text-side-portal')
                )}
              </>
            ) : (
              <TextBoxCanvasPreview box={box} boxHeight={boxHeight} />
            )}

            {isActive && !isEditing && (
              <>
                {!box.locked && (
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
                  </>
                )}

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

                {/* Barra controlli: su mobile teleportata in un punto FISSO sotto il canvas
                (sopra il pulsante Salva) — prima restava ancorata vicino alla casella e, se
                questa era vicina al bordo destro, usciva fuori dallo schermo diventando
                inutilizzabile. Su desktop resta un pannello a parte, fuori dal frame. */}
                {isMobile && typeof document !== 'undefined' && document.getElementById('fwm-text-mobile-portal') &&
                  createPortal(renderToolbar(box, lines, false), document.getElementById('fwm-text-mobile-portal'))}
              </>
            )}
          </div>
        )
      })}
      </div>

      {/* Su desktop: pannello controlli SEMPRE fuori dal frame, a destra — usa lo stesso
      "portale" affidabile già usato per note/anteprima (fwm-text-side-portal, gestito da
      RitaglioImmagine.jsx), invece del vecchio posizionamento "a destra della casella" che
      finiva DENTRO la foto quando la casella non era vicina al bordo destro del frame. */}
      {!isMobile && (() => {
        const activeBox = textBoxes.find((b) => b.id === activeId)
        if (!activeBox || editingId === activeId) return null
        if (typeof document === 'undefined' || !document.getElementById('fwm-text-side-portal')) return null
        const { lines: activeLines } = fitText(activeBox.text, {
          maxWidth: activeBox.width,
          minFontSize: activeBox.minFontSize,
          maxFontSize: activeBox.maxFontSize,
          fontWeight: 700,
          fontFamily: 'Roboto, sans-serif',
          maxHeight: activeBox.height || 120,
          manualFontSize: activeBox.manualFontSize,
          letterSpacingRatio: LETTER_SPACING_RATIO,
          lineGaps: activeBox.lineGaps
        })
        return createPortal(renderToolbar(activeBox, activeLines, true), document.getElementById('fwm-text-side-portal'))
      })()}

      {/* Linee guida smart (stile Canva): appaiono solo mentre trascini una casella e si
      allinea al centro o ai bordi della foto. */}
      {snapGuides.v !== null && (
        <div style={{ position: 'absolute', left: `${snapGuides.v}px`, top: 0, bottom: 0, width: '1px', background: '#007AFF', zIndex: 90, pointerEvents: 'none', boxShadow: '0 0 4px rgba(0,122,255,0.8)' }} />
      )}
      {snapGuides.h !== null && (
        <div style={{ position: 'absolute', top: `${snapGuides.h}px`, left: 0, right: 0, height: '1px', background: '#007AFF', zIndex: 90, pointerEvents: 'none', boxShadow: '0 0 4px rgba(0,122,255,0.8)' }} />
      )}

      {/* Popup con la posizione della casella in PIXEL REALI, pronta da copiare — niente più
      bisogno di guardare la Console o fare calcoli a mano. */}
      {showPositionInfo && (() => {
        const box = textBoxes.find((b) => b.id === showPositionInfo)
        if (!box) return null
        const s = displayScale || 1
        const x = Math.round(box.x / s)
        const y = Math.round(box.y / s)
        const w = Math.round(box.width / s)
        const h = Math.round((box.height || 120) / s)
        const testo = `const TESTO_SX_REALE = ${x}\nconst TESTO_DX_REALE = ${x + w}  // oppure: dimensions.width - ${Math.round(x)}\nconst TESTO_ALTO_REALE = ${y}\nconst TESTO_BASSO_REALE = ${y + h}`
        return (
          <div
            onClick={() => setShowPositionInfo(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: '16px', padding: '20px', maxWidth: '380px', width: '100%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                transform: (!isMobile && (modalOffset.x || modalOffset.y)) ? `translate(${modalOffset.x}px, ${modalOffset.y}px)` : 'none'
              }}
            >
              <div
                onMouseDown={startModalDrag}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
                  cursor: isMobile ? 'default' : 'grab', userSelect: 'none'
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px' }}>📍 Posizione in pixel reali</h3>
                <button onClick={() => setShowPositionInfo(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
              </div>
              {(
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  <PositionField
                    label="X (sinistra)"
                    value={x}
                    onCommit={(v) => updateBox(box.id, { x: Math.round(v * s) })}
                  />
                  <PositionField
                    label="Y (alto)"
                    value={y}
                    onCommit={(v) => updateBox(box.id, { y: Math.round(v * s) })}
                  />
                  <PositionField
                    label="Larghezza"
                    value={w}
                    onCommit={(v) => updateBox(box.id, { width: Math.round(v * s) })}
                  />
                  <PositionField
                    label="Altezza"
                    value={h}
                    onCommit={(v) => updateBox(box.id, { height: Math.round(v * s) })}
                  />
                  <PositionField
                    label="Bordo destro"
                    value={x + w}
                    onCommit={(v) => updateBox(box.id, { width: Math.round((v - x) * s) })}
                  />
                  <PositionField
                    label="Bordo inferiore"
                    value={y + h}
                    onCommit={(v) => updateBox(box.id, { height: Math.round((v - y) * s) })}
                  />
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: '700', marginBottom: '4px' }}>Pronto da incollare in RitaglioImmagine.jsx:</div>
              <textarea
                readOnly
                value={testo}
                onClick={(e) => e.target.select()}
                style={{ width: '100%', minHeight: '90px', padding: '10px', borderRadius: '10px', border: '1px solid #e5e5ea', fontSize: '12px', fontFamily: 'monospace', background: '#1c1c1e', color: '#0f0', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <button
                onClick={() => { navigator.clipboard?.writeText(testo); }}
                style={{ marginTop: '10px', width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: '#007AFF', color: '#fff', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                📋 Copia tutto
              </button>
            </div>
          </div>
        )
      })()}

    </>
  )
}

import { useEffect, useRef, useState } from 'react'

// =====================================================================================
// MODALITÀ TECNICA — frecce (SVG) colorabili/spostabili/ruotabili + lente d'ingrandimento
// tonda. Stessa filosofia di TestoPost.jsx e LineeGuida.jsx: qui vive tutta la logica, in
// RitaglioImmagine.jsx restano solo pochi punti di aggancio.
//
// Tutte le coordinate (x, y, width, d) sono in PIXEL REALI del canvas finale, non dello
// schermo: così l'export è identico all'anteprima a prescindere da zoom e finestra.
// =====================================================================================

// Colori esatti richiesti, usati ovunque in TECNICA: freccia, evidenziatore (rettangolo,
// ellisse, mano libera) e contorno della lente. Codici fissi, non approssimati per coerenza
// col resto dell'app.
export const TECNICA_COLORI = [
  { key: 'giallo', label: 'Giallo', hex: '#ffff00' },
  { key: 'rosso', label: 'Rosso', hex: '#FF0000' },
  { key: 'nero', label: 'Nero', hex: '#000000' },
  { key: 'bianco', label: 'Bianco', hex: '#ffffff' }
]

// I 3 asset fissi della modalità TECNICA: vanno messi nella cartella /public del progetto
// (serviti quindi da path assoluti tipo /tecnica-freccia.svg, non importati da src/assets).
// - tecnica-freccia.svg → la freccia disegnata sulla foto (disegnata puntando verso DESTRA,
//   così la rotazione 0° è corretta) e l'icona del tool "Freccia".
// - tecnica-ovale.svg   → l'ovale: si aggiunge con un clic come la freccia ("Ellisse") ed è anche
//   l'icona del tool Evidenziatore.
// - tecnica-cornice.svg → l'icona del tool "Lente": il cerchietto piccolo indica il punto
//   osservato, il cerchio grande (collegato da una linea tratteggiata) mostra l'ingrandimento.
export const FRECCIA_TECNICA = { key: 'tecnica-freccia', label: 'Freccia', url: '/tecnica-freccia.svg' }
export const OVALE_TECNICA_URL = '/tecnica-ovale.svg'
// L'ovale funziona come la freccia (un clic e compare, poi si sposta/ruota/ridimensiona/colora);
// il suo SVG viene ritagliato in automatico sul disegno vero (preparaSvg con autoCrop).
export const CORNICE_TECNICA_URL = '/tecnica-cornice.svg'

const nuovoId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const dataUrlSvg = (text) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)

// Normalizza un SVG: ricava le proporzioni e gli dà una dimensione esplicita (molti SVG hanno
// solo il viewBox e alcuni browser li disegnano a 0x0 su canvas). Ritorna { src, aspect }
// dove aspect = altezza / larghezza.
// Con { autoCrop: true } misura dove c'è davvero il disegno (pixel non trasparenti) e restringe
// il viewBox a quella zona: così riquadro di selezione e proporzioni lo avvolgono stretto e si
// vede sempre tutto, qualunque margine abbia il file (anche nessuno).
export const preparaSvg = async (url, opzioni = {}) => {
  const text = await (await fetch(url)).text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('SVG non valido')
  }
  let w = 0
  let h = 0
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    w = vb[2]
    h = vb[3]
  } else {
    w = parseFloat(svg.getAttribute('width'))
    h = parseFloat(svg.getAttribute('height'))
  }
  if (!(w > 0) || !(h > 0)) { w = 100; h = 100 }
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  const dimensiona = () => {
    const k = 1024 / Math.max(w, h)
    svg.setAttribute('width', String(Math.round(w * k)))
    svg.setAttribute('height', String(Math.round(h * k)))
  }
  dimensiona()

  if (opzioni.autoCrop) {
    try {
      const crop = await misuraDisegno(dataUrlSvg(new XMLSerializer().serializeToString(svg)), w, h)
      if (crop) {
        const v = svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number)
        const nx = v[0] + crop.x * v[2]
        const ny = v[1] + crop.y * v[3]
        w = crop.w * v[2]
        h = crop.h * v[3]
        svg.setAttribute('viewBox', `${nx} ${ny} ${w} ${h}`)
        dimensiona()
      }
    } catch {
      // misura non riuscita: si usa l'SVG intero, senza ritaglio
    }
  }
  return { src: dataUrlSvg(new XMLSerializer().serializeToString(svg)), aspect: h / w }
}

// Disegna l'SVG su un canvas piccolo e cerca il rettangolo che contiene tutti i pixel visibili.
// Ritorna frazioni {x, y, w, h} del viewBox (con un filo di margine), oppure null se non serve.
const misuraDisegno = (src, w, h) =>
  new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => {
      const N = 512
      const cw = w >= h ? N : Math.max(1, Math.round((N * w) / h))
      const ch = w >= h ? Math.max(1, Math.round((N * h) / w)) : N
      const c = document.createElement('canvas')
      c.width = cw
      c.height = ch
      const ctx = c.getContext('2d')
      ctx.drawImage(im, 0, 0, cw, ch)
      const d = ctx.getImageData(0, 0, cw, ch).data
      let x0 = cw, y0 = ch, x1 = -1, y1 = -1
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          if (d[(y * cw + x) * 4 + 3] > 10) {
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
          }
        }
      }
      if (x1 < 0) return resolve(null) // niente di visibile: lascia stare
      const pad = 0.012
      const fx = Math.max(0, x0 / cw - pad)
      const fy = Math.max(0, y0 / ch - pad)
      const fx2 = Math.min(1, (x1 + 1) / cw + pad)
      const fy2 = Math.min(1, (y1 + 1) / ch + pad)
      resolve({ x: fx, y: fy, w: fx2 - fx, h: fy2 - fy })
    }
    im.onerror = reject
    im.src = src
  })

export const creaFreccia = ({ src, aspect, canvasW, canvasH, color = TECNICA_COLORI[0].hex, widthRatio = 0.18 }) => ({
  id: nuovoId('fr'),
  src,
  aspect,
  color,
  x: canvasW / 2,
  y: canvasH / 2,
  width: Math.round(canvasW * widthRatio),
  rotation: 0
})

// Lente "a richiamo" come nell'icona: un cerchietto (sx, sy) indica il punto della foto
// osservato, collegato da una linea tratteggiata al cerchio grande (x, y) dove quel punto
// viene mostrato ingrandito. Il cerchietto sorgente è sempre una frazione fissa (SORGENTE_RATIO)
// del diametro del cerchio grande — si ridimensionano insieme.
export const SORGENTE_RATIO = 0.34
export const creaLente = (canvasW, canvasH) => {
  const d = Math.round(Math.min(canvasW, canvasH) * 0.3)
  const sx = canvasW / 2
  const sy = canvasH / 2
  const x = clamp(sx + d * 0.95, d / 2, canvasW - d / 2)
  const y = clamp(sy + d * 0.55, d / 2, canvasH - d / 2)
  return { sx, sy, x, y, d, zoom: 2, color: '#ffffff' }
}

// ---------- Testo (Roboto, una sola riga, casella che si adatta al testo) ----------
// Come in Testo Post: carattere Roboto Bold. Qui però il testo non va mai a capo e la casella è
// sempre larga quanto il testo (grandezza automatica); la dimensione del carattere è libera.
// Anteprima ed export usano la STESSA funzione di disegno (disegnaTestoCentrato), così quello che
// vedi è esattamente quello che viene salvato.
const TESTO_FONT = 'Roboto, sans-serif'
const TESTO_PESO = 700
const fontTesto = (size) => `${TESTO_PESO} ${size}px ${TESTO_FONT}`
let _misuraCtx = null

// Misura il testo (px reali del canvas finale). La larghezza minima evita una casella di
// larghezza zero quando il testo è ancora vuoto.
export const misuraTesto = (text, size) => {
  if (!_misuraCtx) _misuraCtx = document.createElement('canvas').getContext('2d')
  _misuraCtx.font = fontTesto(size)
  const w = Math.max(_misuraCtx.measureText(text || '').width, size * 0.5)
  return { w, h: size * 1.2 }
}

export const creaTesto = ({ canvasW, canvasH, color = TECNICA_COLORI[0].hex }) => ({
  id: nuovoId('tx'),
  text: '',
  color,
  x: canvasW / 2,
  y: canvasH / 2,
  size: Math.round(canvasW * 0.06), // dimensione del carattere in px reali del canvas
  rotation: 0
})

// Disegna il testo centrato nell'origine; posizione e rotazione le gestisce chi chiama.
const disegnaTestoCentrato = (ctx, t) => {
  if (!t.text) return
  ctx.save()
  ctx.font = fontTesto(t.size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = t.color
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = t.size * 0.06
  ctx.shadowOffsetY = t.size * 0.025
  ctx.fillText(t.text, 0, 0)
  ctx.restore()
}

const disegnaTesti = (ctx, texts = []) => {
  texts.forEach((t) => {
    ctx.save()
    ctx.translate(t.x, t.y)
    ctx.rotate((t.rotation * Math.PI) / 180)
    disegnaTestoCentrato(ctx, t)
    ctx.restore()
  })
}

// Da chiamare (con await) prima dell'export: assicura che Roboto sia davvero caricato, altrimenti
// il canvas userebbe un carattere di riserva.
export const precaricaTesti = async (texts = []) => {
  if (!texts.length || typeof document === 'undefined' || !document.fonts) return
  try { await document.fonts.load(`${TESTO_PESO} 16px Roboto`) } catch { /* si usa il carattere di riserva */ }
}

// Fa ri-renderizzare l'anteprima nel momento esatto in cui Roboto diventa pronto (come in Testo
// Post): una misura fatta prima, col carattere di riserva, resterebbe sbagliata.
let _robotoPronto = false
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.load(`${TESTO_PESO} 16px Roboto`).then(() => { _robotoPronto = true }).catch(() => {})
}
function useRobotoPronto() {
  const [ok, setOk] = useState(_robotoPronto)
  useEffect(() => {
    if (ok || typeof document === 'undefined' || !document.fonts) return
    let vivo = true
    const fine = () => { if (vivo) setOk(true) }
    document.fonts.load(`${TESTO_PESO} 16px Roboto`).then(fine).catch(() => {})
    document.fonts.ready.then(fine)
    return () => { vivo = false }
  }, [ok])
  return ok
}

// Anteprima del testo: un canvas disegnato con la stessa funzione dell'export.
function TestoCanvas({ t, k, pronto }) {
  const ref = useRef(null)
  const { w, h } = misuraTesto(t.text, t.size)
  const pad = t.size * 0.3 // margine attorno al testo per l'ombra
  const W = (w + 2 * pad) * k
  const H = (h + 2 * pad) * k
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.max(1, Math.ceil(W * dpr))
    c.height = Math.max(1, Math.ceil(H * dpr))
    const ctx = c.getContext('2d')
    ctx.scale(dpr * k, dpr * k)
    ctx.translate(w / 2 + pad, h / 2 + pad)
    disegnaTestoCentrato(ctx, t)
  }, [t.text, t.size, t.color, k, pronto, W, H]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} style={{ position: 'absolute', left: -pad * k, top: -pad * k, width: W, height: H, pointerEvents: 'none' }} />
}

// ---------- Evidenziatore (aree colorate semitrasparenti) ----------
// Forme disegnate trascinando: 'rect' (x, y, w, h in px reali) e 'lasso' (pts = [{x, y}, ...]).
// (L'ellisse non è una forma disegnata: è il timbro SVG dell'ovale, gestito come le frecce.)
export const creaEvidenziatura = (shape) => ({
  id: nuovoId('hl'),
  color: TECNICA_COLORI[0].hex, // giallo di default
  opacity: 0.4,
  outline: true,
  ...shape
})

const bboxHl = (h) => {
  if (h.pts) {
    const xs = h.pts.map((p) => p.x)
    const ys = h.pts.map((p) => p.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
  }
  return { x: h.x, y: h.y, w: h.w, h: h.h }
}
const spostaHl = (h, dx, dy) =>
  h.pts
    ? { ...h, pts: h.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    : { ...h, x: h.x + dx, y: h.y + dy }
const scalaHl = (h, sx, sy) => {
  const b = bboxHl(h)
  if (h.pts) return { ...h, pts: h.pts.map((p) => ({ x: b.x + (p.x - b.x) * sx, y: b.y + (p.y - b.y) * sy })) }
  return { ...h, w: h.w * sx, h: h.h * sy }
}
export const duplicaEvidenziatura = (h, off) => ({ ...spostaHl(h, off, off), id: nuovoId('hl') })
const hlStroke = (canvasW) => Math.max(3, canvasW * 0.004) // spessore contorno in px reali

const tracciaHl = (ctx, h) => {
  ctx.beginPath()
  if (h.kind === 'rect') ctx.rect(h.x, h.y, h.w, h.h)
  else {
    h.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.closePath()
  }
}

export const disegnaEvidenziature = (ctx, highlights = []) => {
  highlights.forEach((h) => {
    ctx.save()
    tracciaHl(ctx, h)
    ctx.globalAlpha = h.opacity
    ctx.fillStyle = h.color
    ctx.fill()
    if (h.outline) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = h.color
      ctx.lineWidth = hlStroke(ctx.canvas.width)
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    ctx.restore()
  })
}

// ---------- Export su canvas ----------
const cacheImg = new Map()
const caricaImmagine = (src) =>
  new Promise((resolve, reject) => {
    if (cacheImg.has(src)) return resolve(cacheImg.get(src))
    const im = new Image()
    im.onload = () => { cacheImg.set(src, im); resolve(im) }
    im.onerror = reject
    im.src = src
  })

// Da chiamare (con await) subito prima di disegnare, così le immagini sono sicuramente pronte.
export const precaricaFrecce = async (arrows) => {
  await Promise.all(arrows.map((a) => caricaImmagine(a.src).catch(() => null)))
}

// Disegna lente e frecce sul canvas finale. `drawPhoto(ctx)` deve ridisegnare la foto con la
// stessa posizione/zoom usati per il canvas: la lente la riusa ingrandita.
export const disegnaTecnicaSuCanvas = (ctx, { arrows = [], texts = [], lens = null, highlights = [], drawPhoto = null }) => {
  // Ordine (dal basso): evidenziature, lente (che ingrandisce anche loro), frecce.
  disegnaEvidenziature(ctx, highlights)

  if (lens && drawPhoto) {
    const r = lens.d / 2
    const sd = lens.d * SORGENTE_RATIO
    const sr = sd / 2
    const bordo = Math.max(2, lens.d * 0.025)
    const sBordo = Math.max(1.5, sd * 0.06)

    // Linea tratteggiata dal cerchietto sorgente al cerchio grande (dietro a entrambi, così
    // i due bordi la coprono in modo pulito dove la toccano).
    const dx = lens.x - lens.sx
    const dy = lens.y - lens.sy
    const dist = Math.hypot(dx, dy) || 1
    const ux = dx / dist
    const uy = dy / dist
    ctx.save()
    ctx.strokeStyle = lens.color
    ctx.lineWidth = Math.max(1.5, lens.d * 0.012)
    ctx.setLineDash([lens.d * 0.03, lens.d * 0.025])
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = lens.d * 0.02
    ctx.beginPath()
    ctx.moveTo(lens.sx + ux * sr, lens.sy + uy * sr)
    ctx.lineTo(lens.x - ux * r, lens.y - uy * r)
    ctx.stroke()
    ctx.restore()

    // Cerchietto sorgente: solo un anello bianco che indica il punto osservato (non mostra
    // contenuto proprio: è il "mirino", il cerchio grande è il "monitor").
    ctx.save()
    ctx.strokeStyle = lens.color
    ctx.lineWidth = sBordo
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = sd * 0.08
    ctx.beginPath()
    ctx.arc(lens.sx, lens.sy, sr - sBordo / 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // Cerchio grande: mostra la foto ingrandita attorno al punto sorgente (sx, sy), non attorno
    // a se stesso — è questo lo scarto rispetto a una lente classica "a lente d'ingrandimento".
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = lens.d * 0.05
    ctx.shadowOffsetY = lens.d * 0.02
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(lens.x, lens.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.arc(lens.x, lens.y, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(lens.x - r, lens.y - r, lens.d, lens.d)
    ctx.translate(lens.x, lens.y)
    ctx.scale(lens.zoom, lens.zoom)
    ctx.translate(-lens.sx, -lens.sy)
    drawPhoto(ctx)
    disegnaEvidenziature(ctx, highlights)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = lens.color
    ctx.lineWidth = bordo
    ctx.beginPath()
    ctx.arc(lens.x, lens.y, r - bordo / 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  arrows.forEach((a) => {
    const im = cacheImg.get(a.src)
    if (!im) return
    const w = a.width
    const h = a.width * a.aspect
    const tw = Math.max(1, Math.ceil(w))
    const th = Math.max(1, Math.ceil(h))
    // Tinta: disegna l'SVG e poi riempie solo dove c'è forma (source-in) col colore scelto.
    const tmp = document.createElement('canvas')
    tmp.width = tw
    tmp.height = th
    const t = tmp.getContext('2d')
    t.drawImage(im, 0, 0, tw, th)
    t.globalCompositeOperation = 'source-in'
    t.fillStyle = a.color
    t.fillRect(0, 0, tw, th)

    ctx.save()
    ctx.translate(a.x, a.y)
    ctx.rotate((a.rotation * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = a.width * 0.03
    ctx.shadowOffsetY = a.width * 0.012
    ctx.drawImage(tmp, -w / 2, -h / 2, w, h)
    ctx.restore()
  })

  // Testi: sopra a tutto, come le frecce.
  disegnaTesti(ctx, texts)
}

// ---------- Overlay interattivo sulla foto ----------
const HANDLE_HIT = 36
const dotStyle = {
  width: 14, height: 14, borderRadius: '50%', background: '#fff',
  border: '3px solid #007AFF', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', pointerEvents: 'none'
}
const maskStyle = (src) => ({
  WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")`,
  WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center', maskPosition: 'center'
})

// SVG con le evidenziature. Il viewBox è in pixel REALI del canvas, quindi forma e spessore del
// contorno sono identici a quelli disegnati in export.
function HighlightsSvg({ highlights, canvasWidth, canvasHeight, width, height, interactive = false, onDown }) {
  if (!highlights.length) return null
  const sw = hlStroke(canvasWidth)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{ position: 'absolute', left: 0, top: 0, display: 'block', pointerEvents: 'none', touchAction: interactive ? 'none' : 'auto' }}
    >
      {highlights.map((h) => {
        const common = {
          fill: h.color,
          fillOpacity: h.opacity,
          stroke: h.outline ? h.color : 'none',
          strokeWidth: sw,
          strokeLinejoin: 'round',
          style: { pointerEvents: interactive ? 'all' : 'none', cursor: interactive ? 'move' : 'default' },
          onPointerDown: interactive ? (e) => onDown(e, 'move', h.id) : undefined
        }
        if (h.kind === 'rect') {
          return <rect key={h.id} x={h.x} y={h.y} width={Math.max(0, h.w)} height={Math.max(0, h.h)} {...common} />
        }
        return <polygon key={h.id} points={h.pts.map((p) => `${p.x},${p.y}`).join(' ')} {...common} />
      })}
    </svg>
  )
}

// Strato "di selezione" attivo mentre è scelta una forma: cattura il trascinamento sulla foto
// e disegna l'anteprima della forma; al rilascio la consegna a chi l'ha chiamato.
function DrawLayer({ tool, canvasWidth, canvasHeight, containerWidth, containerHeight, onDone }) {
  const ref = useRef(null)
  const st = useRef(null) // gesto in corso (puntatore premuto)
  const poly = useRef(null) // contorno a clic in corso: { pts: [...] }
  const lastDown = useRef({ t: 0, x: 0, y: 0 })
  const [draft, setDraft] = useState(null)
  const [polyN, setPolyN] = useState(0) // vertici del contorno a clic (0 = non attivo)
  const k = containerWidth / canvasWidth

  const toCanvas = (e) => {
    const r = ref.current.getBoundingClientRect()
    return {
      x: clamp(((e.clientX - r.left) / r.width) * canvasWidth, 0, canvasWidth),
      y: clamp(((e.clientY - r.top) / r.height) * canvasHeight, 0, canvasHeight)
    }
  }

  const build = (start, p, shift) => {
    let w = Math.abs(p.x - start.x)
    let h = Math.abs(p.y - start.y)
    if (shift) w = h = Math.max(w, h)
    const x = p.x >= start.x ? start.x : start.x - w
    const y = p.y >= start.y ? start.y : start.y - h
    return { kind: tool, x, y, w, h }
  }

  const reset = () => { st.current = null; poly.current = null; setDraft(null); setPolyN(0) }

  // Chiude il contorno (mano libera o a clic) e lo consegna.
  const finishLasso = (pts) => {
    const minPx = 6 / k // sotto i 6 px a schermo non è una selezione
    reset()
    if (pts.length < 3) return
    const b = bboxHl({ pts })
    if (b.w < minPx || b.h < minPx) return
    onDone({ kind: 'lasso', pts })
  }

  // Invio chiude il contorno a clic. (Esc è gestito dall'overlay: esce dallo strumento.)
  const fin = useRef(null)
  fin.current = () => { if (poly.current) finishLasso(poly.current.pts) }
  useEffect(() => {
    const key = (e) => { if (e.key === 'Enter') { e.preventDefault(); fin.current && fin.current() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const onDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    ref.current.setPointerCapture(e.pointerId)
    const p = toCanvas(e)

    if (tool === 'lasso' && poly.current) {
      // Contorno a clic già avviato: ogni clic aggiunge un punto (segmenti dritti).
      const pts = poly.current.pts
      const now = Date.now()
      const ld = lastDown.current
      lastDown.current = { t: now, x: p.x, y: p.y }
      const dClose = Math.hypot(p.x - pts[0].x, p.y - pts[0].y) * k
      const dDouble = Math.hypot(p.x - ld.x, p.y - ld.y) * k
      // Si chiude cliccando sul primo punto o con doppio clic.
      if (pts.length >= 3 && (dClose < 14 || (now - ld.t < 350 && dDouble < 12))) { finishLasso(pts); return }
      pts.push(p)
      st.current = { polyDrag: true } // tenendo premuto si può aggiustare il punto appena messo
      setPolyN(pts.length)
      setDraft({ kind: 'lasso', pts: [...pts] })
      return
    }

    lastDown.current = { t: Date.now(), x: p.x, y: p.y }
    st.current = { start: p, pts: [p], moved: false }
    setDraft(tool === 'lasso' ? { kind: 'lasso', pts: [p] } : build(p, p, false))
  }

  const onMove = (e) => {
    const p = toCanvas(e)
    if (tool !== 'lasso') {
      if (st.current) setDraft(build(st.current.start, p, e.shiftKey))
      return
    }
    if (st.current && st.current.polyDrag) {
      const pts = poly.current.pts
      pts[pts.length - 1] = p
      setDraft({ kind: 'lasso', pts: [...pts] })
      return
    }
    if (!st.current) {
      // Nessun tasto premuto: nel contorno a clic mostra il segmento "elastico" verso il cursore.
      if (poly.current) setDraft({ kind: 'lasso', pts: [...poly.current.pts, p] })
      return
    }
    const cur = st.current
    if (!cur.moved && Math.hypot(p.x - cur.start.x, p.y - cur.start.y) * k > 4) cur.moved = true
    if (e.shiftKey) {
      // Con Shift il tratto va dritto dall'ultimo punto fissato al cursore; rilasciandolo si
      // fissa il vertice e si riprende a mano libera.
      cur.tail = p
      setDraft({ kind: 'lasso', pts: [...cur.pts, p] })
      return
    }
    if (cur.tail) { cur.pts.push(cur.tail); cur.tail = null }
    const last = cur.pts[cur.pts.length - 1]
    if (Math.hypot(p.x - last.x, p.y - last.y) * k >= 2) cur.pts.push(p) // ignora micro-movimenti
    setDraft({ kind: 'lasso', pts: [...cur.pts] })
  }

  const onUp = (e) => {
    if (!st.current) return
    if (st.current.polyDrag) { st.current = null; return }
    const p = toCanvas(e)
    const { start, pts, tail, moved } = st.current
    st.current = null
    if (tool === 'lasso') {
      if (!moved) {
        // Un semplice clic: parte il contorno a clic (si continua cliccando i punti).
        poly.current = { pts: [start] }
        setPolyN(1)
        setDraft({ kind: 'lasso', pts: [start] })
        return
      }
      if (tail) pts.push(tail)
      finishLasso(pts)
      return
    }
    setDraft(null)
    const minPx = 6 / k
    const s = build(start, p, e.shiftKey)
    if (s.w < minPx || s.h < minPx) return
    onDone(s)
  }

  const onCancel = () => { st.current = null; if (!poly.current) setDraft(null) }

  let hint = 'Trascina sulla foto'
  if (tool === 'lasso') {
    if (polyN === 0) hint = 'Trascina a mano libera, oppure clicca i punti per linee dritte'
    else if (polyN < 3) hint = 'Clicca gli altri punti'
    else hint = 'Clicca altri punti · doppio clic o primo punto per chiudere'
  }

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: 'crosshair', touchAction: 'none', pointerEvents: 'auto' }}
    >
      {draft && draft.kind === 'lasso' && (
        // Mentre disegni il contorno è solo una LINEA APERTA (niente riempimento e niente chiusura
        // automatica verso il primo punto): la forma chiusa e colorata compare solo a fine disegno.
        <svg
          width={containerWidth}
          height={containerHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        >
          <polyline
            points={draft.pts.map((q) => `${q.x},${q.y}`).join(' ')}
            fill="none"
            stroke={TECNICA_COLORI[0].hex}
            strokeWidth={hlStroke(canvasWidth)}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}
      {draft && draft.kind !== 'lasso' && (
        <HighlightsSvg
          highlights={[{ id: 'draft', color: TECNICA_COLORI[0].hex, opacity: 0.4, outline: true, ...draft }]}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          width={containerWidth}
          height={containerHeight}
        />
      )}
      {polyN > 0 && poly.current && (
        <svg
          width={containerWidth}
          height={containerHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        >
          {poly.current.pts.map((q, i) => (
            <circle
              key={i}
              cx={q.x}
              cy={q.y}
              r={(i === 0 ? 7 : 4.5) / k}
              fill={i === 0 && polyN >= 3 ? '#34C759' : '#fff'}
              stroke="#007AFF"
              strokeWidth={2 / k}
            />
          ))}
        </svg>
      )}
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', maxWidth: '94%', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', textAlign: 'center' }}>
          {hint} · Esc per annullare
        </div>
        {tool === 'lasso' && polyN >= 3 && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => finishLasso(poly.current.pts)}
            style={{ pointerEvents: 'auto', background: '#34C759', color: '#fff', border: 'none', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            ✓ Chiudi
          </button>
        )}
      </div>
    </div>
  )
}

export default function TecnicaOverlay({
  canvasWidth, containerWidth, containerHeight,
  arrows, onArrowsChange, lens, onLensChange,
  highlights, onHighlightsChange, tool, onToolChange,
  selectedId, onSelect,
  photoSrc, photoImgStyle, background,
  texts = [], onTextsChange = () => {}, editingId = null, onEditingChange = () => {}
}) {
  const k = containerWidth / canvasWidth // pixel reali -> pixel a schermo
  const canvasHeight = containerHeight / k

  // I listener globali leggono sempre l'ultimo stato da qui, senza dover essere ricreati.
  const live = useRef({})
  live.current = { k, canvasWidth, canvasHeight, arrows, lens, highlights, tool, selectedId, onArrowsChange, onLensChange, onHighlightsChange, onToolChange, onSelect, texts, onTextsChange, onEditingChange }
  const dragRef = useRef(null)
  const elRefs = useRef({})
  const lastTapRef = useRef({ id: null, time: 0 }) // per riconoscere il doppio tocco su un testo
  const robotoPronto = useRobotoPronto()


  useEffect(() => {
    const patch = (target, p) => {
      const L = live.current
      if (target === 'lens') L.onLensChange({ ...L.lens, ...p })
      else if (L.texts.some((t) => t.id === target)) L.onTextsChange(L.texts.map((t) => (t.id === target ? { ...t, ...p } : t)))
      else L.onArrowsChange(L.arrows.map((a) => (a.id === target ? { ...a, ...p } : a)))
    }

    const move = (e) => {
      const d = dragRef.current
      if (!d) return
      const L = live.current
      e.preventDefault()
      const dx = (e.clientX - d.startX) / L.k
      const dy = (e.clientY - d.startY) / L.k
      if (d.type === 'move') {
        if (d.hl) {
          L.onHighlightsChange(L.highlights.map((h) => (h.id === d.target ? spostaHl(d.orig, dx, dy) : h)))
          return
        }
        patch(d.target, {
          x: clamp(d.orig.x + dx, 0, L.canvasWidth),
          y: clamp(d.orig.y + dy, 0, L.canvasHeight)
        })
      } else if (d.type === 'move-source') {
        // Sposta solo il cerchietto sorgente della lente (sx, sy): il cerchio grande (x, y)
        // dove si vede l'ingrandimento resta dov'è.
        patch(d.target, {
          sx: clamp(d.orig.sx + dx, 0, L.canvasWidth),
          sy: clamp(d.orig.sy + dy, 0, L.canvasHeight)
        })
      } else if (d.type === 'rotate') {
        let ang = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90
        ang = ((ang % 360) + 360) % 360
        if (e.shiftKey) ang = (Math.round(ang / 15) * 15) % 360 // Shift = scatti da 15°
        patch(d.target, { rotation: Math.round(ang * 10) / 10 })
      } else if (d.type === 'resize') {
        if (d.hl) {
          const b = bboxHl(d.orig)
          const sx = clamp((b.w + dx) / Math.max(b.w, 1), 0.05, 30)
          const sy = clamp((b.h + dy) / Math.max(b.h, 1), 0.05, 30)
          L.onHighlightsChange(L.highlights.map((h) => (h.id === d.target ? scalaHl(d.orig, sx, sy) : h)))
          return
        }
        const ratio = Math.hypot(e.clientX - d.cx, e.clientY - d.cy) / d.startDist
        if (d.txt) { patch(d.target, { size: clamp(d.orig.size * ratio, 8, L.canvasWidth) }); return }
        if (d.target === 'lens') patch('lens', { d: clamp(d.orig.d * ratio, 40, L.canvasWidth) })
        else patch(d.target, { width: clamp(d.orig.width * ratio, 24, L.canvasWidth * 1.5) })
      }
    }
    const up = () => { dragRef.current = null }

    const key = (e) => {
      const L = live.current
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return
      if (e.key === 'Escape') {
        if (L.tool) L.onToolChange(null)
        else L.onSelect(null)
        return
      }
      if (!L.selectedId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (L.selectedId === 'lens') L.onLensChange(null)
        else if (L.highlights.some((h) => h.id === L.selectedId)) L.onHighlightsChange(L.highlights.filter((h) => h.id !== L.selectedId))
        else if (L.texts.some((t) => t.id === L.selectedId)) L.onTextsChange(L.texts.filter((t) => t.id !== L.selectedId))
        else L.onArrowsChange(L.arrows.filter((a) => a.id !== L.selectedId))
        L.onSelect(null)
      }
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
    }
  }, [])

  // Precarica le immagini delle frecce, così l'export non deve aspettare.
  const srcKey = arrows.map((a) => a.id).join(',')
  useEffect(() => {
    arrows.forEach((a) => caricaImmagine(a.src).catch(() => {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey])

  const startDrag = (e, type, target) => {
    e.stopPropagation()
    e.preventDefault()
    const L = live.current
    const el = elRefs.current[target]
    const r = el ? el.getBoundingClientRect() : null
    const cx = r ? r.left + r.width / 2 : e.clientX
    const cy = r ? r.top + r.height / 2 : e.clientY
    const hl = L.highlights.find((h) => h.id === target)
    const tx = L.texts.find((t) => t.id === target)
    const orig = target === 'lens' ? { ...L.lens } : hl ? hl : tx ? { ...tx } : { ...L.arrows.find((a) => a.id === target) }
    dragRef.current = {
      type, target, orig, cx, cy, hl: !!hl, txt: !!tx,
      startX: e.clientX, startY: e.clientY,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1
    }
    L.onSelect(target)
  }

  // Doppio clic (mouse) o doppio tocco (touch) su un testo = modifica; un solo clic lo trascina.
  const onTextDown = (e, t) => {
    const now = Date.now()
    const lt = lastTapRef.current
    if (lt.id === t.id && now - lt.time < 350) {
      e.stopPropagation()
      e.preventDefault()
      lastTapRef.current = { id: null, time: 0 }
      dragRef.current = null
      live.current.onSelect(t.id)
      live.current.onEditingChange(t.id)
      return
    }
    lastTapRef.current = { id: t.id, time: now }
    startDrag(e, 'move', t.id)
  }

  // Fine modifica: un testo rimasto vuoto non serve a nulla, quindi sparisce.
  const fineModifica = (id) => {
    const L = live.current
    L.onEditingChange(null)
    const t = L.texts.find((x) => x.id === id)
    if (t && !t.text.trim()) {
      L.onTextsChange(L.texts.filter((x) => x.id !== id))
      L.onSelect(null)
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}>
      {/* EVIDENZIATURE — sotto lente e frecce */}
      <HighlightsSvg
        highlights={highlights}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        width={containerWidth}
        height={containerHeight}
        interactive
        onDown={startDrag}
      />

      {/* LENTE — sotto le frecce. Cerchietto sorgente (dove sta puntando) + linea tratteggiata
      + cerchio grande (dove quel punto si vede ingrandito), come nell'icona della cornice. */}
      {lens && (() => {
        const D = lens.d * k
        const sd = lens.d * SORGENTE_RATIO * k
        const bordo = Math.max(2, lens.d * 0.025) * k
        const sBordo = Math.max(1.5, lens.d * SORGENTE_RATIO * 0.06) * k
        const sel = selectedId === 'lens'
        const off = (D / 2 + 6) * 0.7071
        const sx = lens.sx * k
        const sy = lens.sy * k
        const x = lens.x * k
        const y = lens.y * k
        const distC = Math.hypot(x - sx, y - sy) || 1
        const ux = (x - sx) / distC
        const uy = (y - sy) / distC
        const lineX1 = sx + ux * (sd / 2)
        const lineY1 = sy + uy * (sd / 2)
        const lineX2 = x - ux * (D / 2)
        const lineY2 = y - uy * (D / 2)
        return (
          <>
            {/* Connettore tratteggiato, dietro a entrambi i cerchi */}
            <svg width={containerWidth} height={containerHeight} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
              <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} stroke={lens.color} strokeWidth={Math.max(1.5, lens.d * 0.012 * k)} strokeDasharray={`${lens.d * 0.03 * k} ${lens.d * 0.025 * k}`} />
            </svg>

            {/* Cerchietto sorgente: il "mirino" che indica il punto osservato */}
            <div
              ref={(el) => { elRefs.current['lens-source'] = el }}
              onPointerDown={(e) => startDrag(e, 'move-source', 'lens')}
              style={{
                position: 'absolute', left: sx - sd / 2, top: sy - sd / 2, width: sd, height: sd, borderRadius: '50%',
                border: `${sBordo}px solid ${lens.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', boxSizing: 'border-box',
                cursor: 'move', touchAction: 'none', pointerEvents: 'auto'
              }}
            />

            {/* Cerchio grande: il "monitor" che mostra il punto sorgente ingrandito */}
            <div
              ref={(el) => { elRefs.current.lens = el }}
              style={{ position: 'absolute', left: x - D / 2, top: y - D / 2, width: D, height: D, pointerEvents: 'none' }}
            >
              <div
                onPointerDown={(e) => startDrag(e, 'move', 'lens')}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', isolation: 'isolate',
                  transform: 'translateZ(0)', boxSizing: 'border-box', border: `${bordo}px solid ${lens.color}`,
                  boxShadow: `0 ${lens.d * 0.02 * k}px ${lens.d * 0.05 * k}px rgba(0,0,0,0.4)`,
                  background, cursor: 'move', touchAction: 'none', pointerEvents: 'auto'
                }}
              >
                <div
                  style={{
                    position: 'absolute', left: '50%', top: '50%', width: containerWidth, height: containerHeight,
                    transformOrigin: '0 0', overflow: 'hidden', background, pointerEvents: 'none',
                    transform: `scale(${lens.zoom}) translate(${-lens.sx * k}px, ${-lens.sy * k}px)`
                  }}
                >
                  <img src={photoSrc} draggable={false} alt="" style={photoImgStyle} />
                  <HighlightsSvg highlights={highlights} canvasWidth={canvasWidth} canvasHeight={canvasHeight} width={containerWidth} height={containerHeight} />
                </div>
              </div>
              {sel && (
                <>
                  <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '2px dashed #007AFF', pointerEvents: 'none' }} />
                  <div
                    onPointerDown={(e) => startDrag(e, 'resize', 'lens')}
                    style={{
                      position: 'absolute', left: `calc(50% + ${off}px)`, top: `calc(50% + ${off}px)`,
                      width: HANDLE_HIT, height: HANDLE_HIT, transform: 'translate(-50%, -50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'nwse-resize', touchAction: 'none', pointerEvents: 'auto'
                    }}
                  >
                    <div style={dotStyle} />
                  </div>
                </>
              )}
            </div>
          </>
        )
      })()}

      {/* FRECCE */}
      {arrows.map((a) => {
        const w = a.width * k
        const h = a.width * a.aspect * k
        const sel = selectedId === a.id
        const rot = `rotate(${a.rotation}deg)`
        return (
          <div
            key={a.id}
            ref={(el) => { elRefs.current[a.id] = el }}
            style={{ position: 'absolute', left: a.x * k - w / 2, top: a.y * k - h / 2, width: w, height: h, pointerEvents: 'none' }}
          >
            {/* Il filtro ombra sta su un contenitore NON ruotato: l'ombra cade sempre verso il
            basso, come nell'export. */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', filter: `drop-shadow(0 ${a.width * 0.012 * k}px ${a.width * 0.03 * k}px rgba(0,0,0,0.45))` }}>
              <div
                onPointerDown={(e) => startDrag(e, 'move', a.id)}
                style={{
                  position: 'absolute', inset: 0, transform: rot, background: a.color,
                  ...maskStyle(a.src), cursor: 'move', touchAction: 'none', pointerEvents: 'auto'
                }}
              />
            </div>
            {sel && (
              <div style={{ position: 'absolute', inset: -3, transform: rot, border: '2px dashed #007AFF', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: '50%', top: -22, width: 2, height: 20, marginLeft: -1, background: '#007AFF' }} />
                <div
                  onPointerDown={(e) => startDrag(e, 'rotate', a.id)}
                  title="Ruota (Shift = scatti da 15°)"
                  style={{
                    position: 'absolute', left: '50%', top: -22 - HANDLE_HIT / 2, width: HANDLE_HIT, height: HANDLE_HIT,
                    transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'grab', touchAction: 'none', pointerEvents: 'auto'
                  }}
                >
                  <div style={dotStyle} />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 'resize', a.id)}
                  style={{
                    position: 'absolute', right: 0, bottom: 0, width: HANDLE_HIT, height: HANDLE_HIT,
                    transform: 'translate(50%, 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'nwse-resize', touchAction: 'none', pointerEvents: 'auto'
                  }}
                >
                  <div style={dotStyle} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* TESTI — Roboto Bold, una riga, casella larga quanto il testo */}
      {texts.map((t) => {
        const m = misuraTesto(t.text, t.size)
        const w = m.w * k
        const h = m.h * k
        const sel = selectedId === t.id
        const editing = editingId === t.id
        return (
          <div
            key={t.id}
            ref={(el) => { elRefs.current[t.id] = el }}
            style={{ position: 'absolute', left: t.x * k - w / 2, top: t.y * k - h / 2, width: w, height: h, transform: `rotate(${t.rotation}deg)`, pointerEvents: 'none' }}
          >
            {editing ? (
              <input
                autoFocus
                value={t.text}
                placeholder="Scrivi…"
                onChange={(e) => onTextsChange(texts.map((x) => (x.id === t.id ? { ...x, text: e.target.value.replace(/[\r\n]+/g, ' ') } : x)))}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
                onBlur={() => fineModifica(t.id)}
                style={{
                  position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: Math.max(w, t.size * k * 2.5) + 24, height: h + 8, boxSizing: 'border-box', padding: '0 12px',
                  fontFamily: TESTO_FONT, fontWeight: TESTO_PESO, fontSize: t.size * k, color: t.color, textAlign: 'center',
                  background: 'rgba(128,128,128,0.35)', border: '2px dashed #007AFF', borderRadius: 6, outline: 'none',
                  pointerEvents: 'auto'
                }}
              />
            ) : (
              <>
                <TestoCanvas t={t} k={k} pronto={robotoPronto} />
                <div
                  onPointerDown={(e) => onTextDown(e, t)}
                  style={{ position: 'absolute', inset: 0, cursor: 'move', touchAction: 'none', pointerEvents: 'auto' }}
                />
              </>
            )}
            {sel && !editing && (
              <div style={{ position: 'absolute', inset: -3, border: '2px dashed #007AFF', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: '50%', top: -22, width: 2, height: 20, marginLeft: -1, background: '#007AFF' }} />
                <div
                  onPointerDown={(e) => startDrag(e, 'rotate', t.id)}
                  title="Ruota (Shift = scatti da 15°)"
                  style={{
                    position: 'absolute', left: '50%', top: -22 - HANDLE_HIT / 2, width: HANDLE_HIT, height: HANDLE_HIT,
                    transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'grab', touchAction: 'none', pointerEvents: 'auto'
                  }}
                >
                  <div style={dotStyle} />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 'resize', t.id)}
                  title="Cambia la dimensione del carattere"
                  style={{
                    position: 'absolute', right: 0, bottom: 0, width: HANDLE_HIT, height: HANDLE_HIT,
                    transform: 'translate(50%, 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'nwse-resize', touchAction: 'none', pointerEvents: 'auto'
                  }}
                >
                  <div style={dotStyle} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Cornice + maniglia di ridimensionamento dell'evidenziatura selezionata */}
      {(() => {
        const h = highlights.find((x) => x.id === selectedId)
        if (!h) return null
        const b = bboxHl(h)
        return (
          <div style={{ position: 'absolute', left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k, border: '2px dashed #007AFF', boxSizing: 'border-box', pointerEvents: 'none' }}>
            <div
              onPointerDown={(e) => startDrag(e, 'resize', h.id)}
              style={{
                position: 'absolute', right: 0, bottom: 0, width: HANDLE_HIT, height: HANDLE_HIT,
                transform: 'translate(50%, 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'nwse-resize', touchAction: 'none', pointerEvents: 'auto'
              }}
            >
              <div style={dotStyle} />
            </div>
          </div>
        )
      })()}

      {tool && (
        <DrawLayer
          tool={tool}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          onDone={(shape) => {
            const nuovo = creaEvidenziatura(shape)
            onHighlightsChange([...highlights, nuovo])
            onSelect(nuovo.id)
            onToolChange(null)
          }}
        />
      )}
    </div>
  )
}

// ---------- Numero con − e + (al posto di uno slider) ----------
// Un clic su − o + cambia di 1 (Shift = 10); tenendo premuto si ripete, sempre più in fretta
// dopo un attimo. Il numero si può anche scrivere: vale quando premi Invio o esci dal campo.
function StepperNumero({ value, min, max, onChange, unita = 'px' }) {
  const [bozza, setBozza] = useState(null) // cifre digitate, finché non si conferma
  const val = useRef(value)
  val.current = value
  const attesa = useRef(null)
  const ripeti = useRef(null)
  const ferma = () => {
    clearTimeout(attesa.current)
    clearInterval(ripeti.current)
    attesa.current = null
    ripeti.current = null
  }
  useEffect(() => ferma, [])

  // Il valore corrente si aggiorna subito (prima del ridisegno), così tenendo premuto nessun
  // passo si perde nemmeno se l'interfaccia è un attimo in ritardo.
  const applica = (n) => {
    const v = clamp(Math.round(n), min, max)
    val.current = v
    onChange(v)
  }
  const passo = (d) => applica(val.current + d)
  const parti = (d) => {
    ferma()
    passo(d)
    attesa.current = setTimeout(() => {
      let n = 0
      ripeti.current = setInterval(() => {
        n++
        passo(n > 12 ? d * 4 : d) // dopo un po' accelera
      }, 55)
    }, 380)
  }
  const conferma = () => {
    if (bozza !== null && bozza !== '') applica(Number(bozza))
    setBozza(null)
  }

  const bottone = {
    width: '34px', height: '34px', borderRadius: '10px', border: 'none', background: '#f2f2f7', color: '#1c1c1e',
    fontSize: '20px', fontWeight: '800', lineHeight: 1, cursor: 'pointer', padding: 0, userSelect: 'none',
    touchAction: 'manipulation', display: 'flex', alignItems: 'center', justifyContent: 'center'
  }
  const premi = (d, label) => (
    <button
      type="button"
      aria-label={label}
      style={bottone}
      onPointerDown={(e) => { e.preventDefault(); parti(d * (e.shiftKey ? 10 : 1)) }}
      onPointerUp={ferma}
      onPointerLeave={ferma}
      onPointerCancel={ferma}
      onClick={(e) => { if (e.detail === 0) passo(d) }} // attivazione da tastiera (Invio/Spazio)
    >
      {d < 0 ? '−' : '+'}
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {premi(-1, 'Diminuisci')}
      <input
        type="text"
        inputMode="numeric"
        value={bozza !== null ? bozza : String(Math.round(value))}
        onChange={(e) => setBozza(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onFocus={(e) => e.target.select()}
        onBlur={conferma}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') { setBozza(null); e.currentTarget.blur() }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setBozza(null); passo(e.shiftKey ? 10 : 1) }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setBozza(null); passo(e.shiftKey ? -10 : -1) }
        }}
        style={{
          width: '56px', height: '34px', boxSizing: 'border-box', textAlign: 'center', fontSize: '15px', fontWeight: '800',
          color: '#1c1c1e', background: '#fff', border: '2px solid #e5e5ea', borderRadius: '10px', outline: 'none'
        }}
      />
      {premi(1, 'Aumenta')}
      <span style={{ fontSize: '12px', fontWeight: '800', color: '#8e8e93' }}>{unita}</span>
    </div>
  )
}

// ---------- Pannello sotto la foto: colore, rotazione, dimensione, ingrandimento ----------
export function TecnicaPanel({
  width, canvasWidth, canvasHeight, arrows, onArrowsChange, lens, onLensChange,
  highlights, onHighlightsChange, selectedId, onSelect,
  texts = [], onTextsChange = () => {}, onEditText = () => {}
}) {
  const arrow = selectedId && selectedId !== 'lens' ? arrows.find((a) => a.id === selectedId) : null
  const txt = selectedId ? texts.find((t) => t.id === selectedId) : null
  const lensSel = selectedId === 'lens' && lens ? lens : null
  const hl = selectedId ? highlights.find((h) => h.id === selectedId) : null

  const patchArrow = (p) => onArrowsChange(arrows.map((a) => (a.id === arrow.id ? { ...a, ...p } : a)))
  const elimina = () => {
    if (arrow) onArrowsChange(arrows.filter((a) => a.id !== arrow.id))
    else onLensChange(null)
    onSelect(null)
  }
  const duplica = () => {
    const off = canvasWidth * 0.04
    const copia = {
      ...arrow, id: nuovoId('fr'),
      x: clamp(arrow.x + off, 0, canvasWidth), y: clamp(arrow.y + off, 0, canvasHeight)
    }
    onArrowsChange([...arrows, copia])
    onSelect(copia.id)
  }

  const box = {
    width: `${width}px`, maxWidth: '100%', boxSizing: 'border-box', marginTop: '12px', padding: '10px 14px',
    background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px 18px', minHeight: '58px'
  }
  const lab = { fontSize: '11px', fontWeight: '800', color: '#8e8e93', textTransform: 'uppercase' }
  const group = { display: 'flex', alignItems: 'center', gap: '8px' }
  const btn = (extra = {}) => ({
    padding: '8px 14px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '800',
    cursor: 'pointer', background: '#f2f2f7', color: '#1c1c1e', ...extra
  })

  if (!arrow && !lensSel && !hl && !txt) {
    return (
      <div style={box}>
        <span style={{ fontSize: '13px', color: '#8e8e93', fontWeight: '600', textAlign: 'center' }}>
          Aggiungi una freccia, un testo, la lente o un'evidenziatura, poi trascinala sulla foto. Clicca un elemento per modificarlo.
        </span>
      </div>
    )
  }

  if (hl) {
    const patchHl = (p) => onHighlightsChange(highlights.map((h) => (h.id === hl.id ? { ...h, ...p } : h)))
    const eliminaHl = () => { onHighlightsChange(highlights.filter((h) => h.id !== hl.id)); onSelect(null) }
    const duplicaHl = () => {
      const copia = duplicaEvidenziatura(hl, canvasWidth * 0.04)
      onHighlightsChange([...highlights, copia])
      onSelect(copia.id)
    }
    return (
      <div style={box}>
        <div style={group}>
          <span style={lab}>Colore</span>
          {TECNICA_COLORI.map((c) => (
            <button
              key={c.key}
              title={c.label}
              onClick={() => patchHl({ color: c.hex })}
              style={{
                width: '30px', height: '30px', borderRadius: '50%', background: c.hex, cursor: 'pointer', padding: 0,
                border: hl.color === c.hex ? '3px solid #1c1c1e' : '3px solid #fff',
                boxShadow: '0 0 0 1px #d1d1d6'
              }}
            />
          ))}
        </div>
        <div style={group}>
          <span style={lab}>Intensità</span>
          <input type="range" min="10" max="90" step="1" value={Math.round(hl.opacity * 100)} onChange={(e) => patchHl({ opacity: Number(e.target.value) / 100 })} style={{ width: '110px' }} />
          <span style={{ fontSize: '12px', fontWeight: '800', minWidth: '34px' }}>{Math.round(hl.opacity * 100)}%</span>
        </div>
        <div style={group}>
          <button onClick={() => patchHl({ outline: !hl.outline })} style={btn(hl.outline ? { background: '#007AFF', color: '#fff' } : {})}>Contorno</button>
          <button onClick={duplicaHl} style={btn()}>Duplica</button>
          <button onClick={eliminaHl} style={btn({ background: '#FF3B30', color: '#fff' })}>Elimina</button>
        </div>
      </div>
    )
  }

  if (txt) {
    const patchTxt = (p) => onTextsChange(texts.map((t) => (t.id === txt.id ? { ...t, ...p } : t)))
    const eliminaTxt = () => { onTextsChange(texts.filter((t) => t.id !== txt.id)); onSelect(null) }
    const duplicaTxt = () => {
      const off = canvasWidth * 0.04
      const copia = { ...txt, id: nuovoId('tx'), x: clamp(txt.x + off, 0, canvasWidth), y: clamp(txt.y + off, 0, canvasHeight) }
      onTextsChange([...texts, copia])
      onSelect(copia.id)
    }
    return (
      <div style={box}>
        <div style={group}>
          <span style={lab}>Colore</span>
          {TECNICA_COLORI.map((c) => (
            <button
              key={c.key}
              title={c.label}
              onClick={() => patchTxt({ color: c.hex })}
              style={{
                width: '30px', height: '30px', borderRadius: '50%', background: c.hex, cursor: 'pointer', padding: 0,
                border: txt.color === c.hex ? '3px solid #1c1c1e' : '3px solid #fff',
                boxShadow: '0 0 0 1px #d1d1d6'
              }}
            />
          ))}
        </div>
        <div style={group}>
          <span style={lab}>Dimensione</span>
          <StepperNumero value={txt.size} min={8} max={Math.round(canvasWidth)} onChange={(n) => patchTxt({ size: n })} />
        </div>
        <div style={group}>
          <span style={lab}>Rotazione</span>
          <input type="range" min="0" max="359" step="1" value={Math.round(txt.rotation)} onChange={(e) => patchTxt({ rotation: Number(e.target.value) })} style={{ width: '110px' }} />
          <span style={{ fontSize: '12px', fontWeight: '800', minWidth: '34px' }}>{Math.round(txt.rotation)}°</span>
        </div>
        <div style={group}>
          <button onClick={() => onEditText(txt.id)} style={btn()}>Modifica</button>
          <button onClick={duplicaTxt} style={btn()}>Duplica</button>
          <button onClick={eliminaTxt} style={btn({ background: '#FF3B30', color: '#fff' })}>Elimina</button>
        </div>
      </div>
    )
  }

  if (arrow) {
    return (
      <div style={box}>
        <div style={group}>
          <span style={lab}>Colore</span>
          {TECNICA_COLORI.map((c) => (
            <button
              key={c.key}
              title={c.label}
              onClick={() => patchArrow({ color: c.hex })}
              style={{
                width: '30px', height: '30px', borderRadius: '50%', background: c.hex, cursor: 'pointer', padding: 0,
                border: arrow.color === c.hex ? '3px solid #1c1c1e' : '3px solid #fff',
                boxShadow: '0 0 0 1px #d1d1d6'
              }}
            />
          ))}
        </div>
        <div style={group}>
          <span style={lab}>Rotazione</span>
          <input type="range" min="0" max="359" step="1" value={Math.round(arrow.rotation)} onChange={(e) => patchArrow({ rotation: Number(e.target.value) })} style={{ width: '110px' }} />
          <span style={{ fontSize: '12px', fontWeight: '800', minWidth: '34px' }}>{Math.round(arrow.rotation)}°</span>
        </div>
        <div style={group}>
          <span style={lab}>Dimensione</span>
          <input
            type="range" min="3" max="100" step="1"
            value={Math.round((arrow.width / canvasWidth) * 100)}
            onChange={(e) => patchArrow({ width: (Number(e.target.value) / 100) * canvasWidth })}
            style={{ width: '110px' }}
          />
        </div>
        <div style={group}>
          <button onClick={duplica} style={btn()}>Duplica</button>
          <button onClick={elimina} style={btn({ background: '#FF3B30', color: '#fff' })}>Elimina</button>
        </div>
      </div>
    )
  }

  return (
    <div style={box}>
      <div style={group}>
        <span style={lab}>Contorno</span>
        {TECNICA_COLORI.map((c) => (
          <button
            key={c.key}
            title={c.label}
            onClick={() => onLensChange({ ...lens, color: c.hex })}
            style={{
              width: '30px', height: '30px', borderRadius: '50%', background: c.hex, cursor: 'pointer', padding: 0,
              border: lens.color === c.hex ? '3px solid #1c1c1e' : '3px solid #fff',
              boxShadow: '0 0 0 1px #d1d1d6'
            }}
          />
        ))}
      </div>
      <div style={group}>
        <span style={lab}>Ingrandimento</span>
        {[2, 3, 4, 5].map((z) => (
          <button
            key={z}
            onClick={() => onLensChange({ ...lens, zoom: z })}
            style={btn(lens.zoom === z ? { background: '#007AFF', color: '#fff' } : {})}
          >
            {z}×
          </button>
        ))}
      </div>
      <div style={group}>
        <span style={lab}>Dimensione</span>
        <input
          type="range" min="8" max="80" step="1"
          value={Math.round((lens.d / canvasWidth) * 100)}
          onChange={(e) => onLensChange({ ...lens, d: (Number(e.target.value) / 100) * canvasWidth })}
          style={{ width: '110px' }}
        />
      </div>
      <button onClick={elimina} style={btn({ background: '#FF3B30', color: '#fff' })}>Elimina</button>
    </div>
  )
}

// ---------- Modale di scelta della forma di selezione (evidenziatore) ----------
// Stesso identico stile dei modali già nel sito (es. "Scegli la grafica"): sfondo
// rgba(0,0,0,0.5) senza blur, card bianca 20px, header con ✕ rossa piatta, griglia di
// card scure con l'anteprima della forma — non righe, come nel modale di ritaglio.
export function EvidenziaModal({ onPick, onClose }) {
  const voci = [
    { kind: 'rect', label: 'Rettangolo', desc: 'Shift = quadrato' },
    { kind: 'ellipse', label: 'Ellisse', desc: 'Un clic e appare' },
    { kind: 'lasso', label: 'A mano libera', desc: 'Trascina o clicca i punti' }
  ]
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '17px' }}>Evidenzia una zona</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: '12px', color: '#8e8e93', margin: '0 0 16px' }}>Rettangolo e mano libera si disegnano sulla foto, l'ellisse compare subito. Il colore lo cambi dopo.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {voci.map((v) => (
            <button
              key={v.kind}
              onClick={() => onPick(v.kind)}
              style={{
                border: '3px solid transparent', borderRadius: '14px', padding: 0, cursor: 'pointer',
                background: '#1c1c1e', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0
              }}
            >
              <div style={{ width: '100%', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3a3a3c' }}>
                {v.kind === 'rect' && <div style={{ width: '60%', height: '42%', border: '3px solid #FFD400' }} />}
                {v.kind === 'ellipse' && (
                  <img src={OVALE_TECNICA_URL} alt="" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
                )}
                {v.kind === 'lasso' && <span style={{ fontSize: '28px', color: '#FFD400' }}>✎</span>}
              </div>
              <span style={{ display: 'block', padding: '8px 4px 2px', fontSize: '12px', fontWeight: '700', color: '#fff', textAlign: 'center' }}>
                {v.label}
              </span>
              <span style={{ display: 'block', padding: '0 4px 8px', fontSize: '10px', color: '#8e8e93', textAlign: 'center' }}>
                {v.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

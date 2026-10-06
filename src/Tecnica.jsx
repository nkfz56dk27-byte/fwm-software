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
// - tecnica-ovale.svg   → l'icona del tool "Evidenziatore" (il tratto a mano libera ovale).
// - tecnica-cornice.svg → l'icona del tool "Lente": il cerchietto piccolo indica il punto
//   osservato, il cerchio grande (collegato da una linea tratteggiata) mostra l'ingrandimento.
export const FRECCIA_TECNICA = { key: 'tecnica-freccia', label: 'Freccia', url: '/tecnica-freccia.svg' }
export const OVALE_TECNICA_URL = '/tecnica-ovale.svg'
export const CORNICE_TECNICA_URL = '/tecnica-cornice.svg'

const nuovoId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const dataUrlSvg = (text) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)

// Normalizza un SVG: ricava le proporzioni e gli dà una dimensione esplicita (molti SVG hanno
// solo il viewBox e alcuni browser li disegnano a 0x0 su canvas). Ritorna { src, aspect }
// dove aspect = altezza / larghezza.
export const preparaSvg = async (url) => {
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
  const k = 1024 / Math.max(w, h)
  svg.setAttribute('width', String(Math.round(w * k)))
  svg.setAttribute('height', String(Math.round(h * k)))
  return { src: dataUrlSvg(new XMLSerializer().serializeToString(svg)), aspect: h / w }
}

export const creaFreccia = ({ src, aspect, canvasW, canvasH, color = TECNICA_COLORI[0].hex }) => ({
  id: nuovoId('fr'),
  src,
  aspect,
  color,
  x: canvasW / 2,
  y: canvasH / 2,
  width: Math.round(canvasW * 0.18),
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

// ---------- Evidenziatore (aree colorate semitrasparenti) ----------
// Forme: 'rect', 'ellipse' (x, y, w, h in px reali) e 'lasso' (pts = [{x, y}, ...], px reali).
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
  else if (h.kind === 'ellipse') ctx.ellipse(h.x + h.w / 2, h.y + h.h / 2, Math.abs(h.w / 2), Math.abs(h.h / 2), 0, 0, Math.PI * 2)
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
export const disegnaTecnicaSuCanvas = (ctx, { arrows = [], lens = null, highlights = [], drawPhoto = null }) => {
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
        if (h.kind === 'ellipse') {
          return <ellipse key={h.id} cx={h.x + h.w / 2} cy={h.y + h.h / 2} rx={Math.abs(h.w / 2)} ry={Math.abs(h.h / 2)} {...common} />
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
  const st = useRef(null)
  const [draft, setDraft] = useState(null)
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

  const onDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    ref.current.setPointerCapture(e.pointerId)
    const p = toCanvas(e)
    st.current = { start: p, pts: [p] }
    setDraft(tool === 'lasso' ? { kind: 'lasso', pts: [p] } : build(p, p, false))
  }

  const onMove = (e) => {
    if (!st.current) return
    const p = toCanvas(e)
    if (tool === 'lasso') {
      const last = st.current.pts[st.current.pts.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) * k < 2) return // ignora micro-movimenti
      st.current.pts.push(p)
      setDraft({ kind: 'lasso', pts: [...st.current.pts] })
    } else {
      setDraft(build(st.current.start, p, e.shiftKey))
    }
  }

  const onUp = (e) => {
    if (!st.current) return
    const p = toCanvas(e)
    const { start, pts } = st.current
    st.current = null
    setDraft(null)
    const minPx = 6 / k // sotto i 6 px a schermo lo consideriamo un click, non una selezione
    if (tool === 'lasso') {
      if (pts.length < 3) return
      const b = bboxHl({ pts })
      if (b.w < minPx || b.h < minPx) return
      onDone({ kind: 'lasso', pts })
    } else {
      const s = build(start, p, e.shiftKey)
      if (s.w < minPx || s.h < minPx) return
      onDone(s)
    }
  }

  const onCancel = () => { st.current = null; setDraft(null) }

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: 'crosshair', touchAction: 'none', pointerEvents: 'auto' }}
    >
      {draft && (
        <HighlightsSvg
          highlights={[{ id: 'draft', color: TECNICA_COLORI[0].hex, opacity: 0.4, outline: true, ...draft }]}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          width={containerWidth}
          height={containerHeight}
        />
      )}
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        {tool === 'lasso' ? 'Disegna il contorno' : 'Trascina sulla foto'} · Esc per annullare
      </div>
    </div>
  )
}

export default function TecnicaOverlay({
  canvasWidth, containerWidth, containerHeight,
  arrows, onArrowsChange, lens, onLensChange,
  highlights, onHighlightsChange, tool, onToolChange,
  selectedId, onSelect,
  photoSrc, photoImgStyle, background
}) {
  const k = containerWidth / canvasWidth // pixel reali -> pixel a schermo
  const canvasHeight = containerHeight / k

  // I listener globali leggono sempre l'ultimo stato da qui, senza dover essere ricreati.
  const live = useRef({})
  live.current = { k, canvasWidth, canvasHeight, arrows, lens, highlights, tool, selectedId, onArrowsChange, onLensChange, onHighlightsChange, onToolChange, onSelect }
  const dragRef = useRef(null)
  const elRefs = useRef({})

  useEffect(() => {
    const patch = (target, p) => {
      const L = live.current
      if (target === 'lens') L.onLensChange({ ...L.lens, ...p })
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
    const orig = target === 'lens' ? { ...L.lens } : hl ? hl : { ...L.arrows.find((a) => a.id === target) }
    dragRef.current = {
      type, target, orig, cx, cy, hl: !!hl,
      startX: e.clientX, startY: e.clientY,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1
    }
    L.onSelect(target)
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

// ---------- Pannello sotto la foto: colore, rotazione, dimensione, ingrandimento ----------
export function TecnicaPanel({
  width, canvasWidth, canvasHeight, arrows, onArrowsChange, lens, onLensChange,
  highlights, onHighlightsChange, selectedId, onSelect
}) {
  const arrow = selectedId && selectedId !== 'lens' ? arrows.find((a) => a.id === selectedId) : null
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

  if (!arrow && !lensSel && !hl) {
    return (
      <div style={box}>
        <span style={{ fontSize: '13px', color: '#8e8e93', fontWeight: '600', textAlign: 'center' }}>
          Aggiungi una freccia, un ovale, la lente o un'evidenziatura, poi trascinala sulla foto. Clicca un elemento per modificarlo.
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
    { kind: 'ellipse', label: 'Ellisse', desc: 'Shift = cerchio' },
    { kind: 'lasso', label: 'A mano libera', desc: 'Si chiude da solo' }
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
        <p style={{ fontSize: '12px', color: '#8e8e93', margin: '0 0 16px' }}>Trascina sulla foto per selezionare la zona. Il colore lo cambi dopo (giallo, verde o rosso).</p>
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

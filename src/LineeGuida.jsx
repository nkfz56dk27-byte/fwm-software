import { useRef, useEffect, useState } from 'react'

// Linee guida viola, permanenti (salvate su Supabase dal componente padre).
// Sola visualizzazione per la maggior parte degli utenti; trascinabili/eliminabili solo se
// canEdit=true (controllato dal padre in base allo username).
//
// Le posizioni (line.position) sono sempre in PIXEL REALI del canvas (proporzionali a
// dimensions.width/height), NON in pixel a schermo — così restano coerenti per tutti,
// indipendentemente dalla dimensione della finestra di chi le guarda. La conversione da/verso
// i pixel a schermo avviene qui dentro tramite "displayScale".
//
// Per eliminare: un click SOLO sulla linea la seleziona (compare una piccola X); un click
// altrove la deseleziona. Il doppio click è scomodo su linee sottili, specialmente su mobile.
//
// PROPS:
// - containerRef: ref al div del frame (per calcolare le coordinate durante il trascinamento)
// - containerWidth, containerHeight: dimensioni a schermo del frame (px)
// - displayScale: rapporto tra pixel a schermo e pixel reali (containerWidth / dimensions.width)
// - guideLines: array di { id, orientation: 'h'|'v', position } (position in px REALI)
// - onChange(updaterFn): aggiorna lo stato locale durante il trascinamento
// - onDragEnd(id): chiamato al rilascio, per salvare la posizione finale su Supabase
// - onDelete(id): chiamato cliccando la X (solo se canEdit), per eliminare la linea
// - canEdit: se false, le linee sono solo visive e non intercettano il mouse
export default function GuideLines({
  containerRef,
  containerWidth,
  containerHeight,
  displayScale,
  guideLines,
  onChange,
  onDragEnd,
  onDelete,
  canEdit
}) {
  const dragRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const movedRef = useRef(false) // distingue un click da un trascinamento

  const startDrag = (e, id) => {
    if (!canEdit) return
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = { id }
    movedRef.current = false
  }

  // Clic altrove nella pagina deseleziona la linea attiva
  useEffect(() => {
    if (!canEdit || !activeId) return
    const handleOutside = () => setActiveId(null)
    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('touchstart', handleOutside)
    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('touchstart', handleOutside)
    }
  }, [canEdit, activeId])

  useEffect(() => {
    if (!canEdit) return

    const handleMove = (e) => {
      const ds = dragRef.current
      if (!ds || !containerRef.current) return
      movedRef.current = true
      const rect = containerRef.current.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY

      onChange((prev) => prev.map((l) => {
        if (l.id !== ds.id) return l
        if (l.orientation === 'h') {
          const displayY = Math.min(containerHeight, Math.max(0, clientY - rect.top))
          return { ...l, position: Math.round(displayY / displayScale) }
        } else {
          const displayX = Math.min(containerWidth, Math.max(0, clientX - rect.left))
          return { ...l, position: Math.round(displayX / displayScale) }
        }
      }))
    }

    const stopDrag = () => {
      const ds = dragRef.current
      if (ds) {
        if (movedRef.current && onDragEnd) {
          onDragEnd(ds.id) // era un trascinamento: salva la nuova posizione
        } else {
          setActiveId(ds.id) // era solo un click: seleziona (mostra la X)
        }
      }
      dragRef.current = null
    }

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
  }, [canEdit, containerRef, containerWidth, containerHeight, displayScale, onChange, onDragEnd])

  return (
    <>
      {guideLines.map((line) => {
        const displayPos = line.position * displayScale
        const hitSize = canEdit ? '14px' : '0px'
        const isActive = activeId === line.id

        const deleteButton = isActive && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (onDelete) onDelete(line.id)
              setActiveId(null)
            }}
            style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: 'none',
              background: '#A855F7',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              zIndex: 46,
              ...(line.orientation === 'h'
                ? { top: '-10px', left: '8px' }
                : { top: '8px', left: '-10px' })
            }}
          >
            ✕
          </button>
        )

        return line.orientation === 'h' ? (
          <div
            key={line.id}
            onMouseDown={(e) => startDrag(e, line.id)}
            onTouchStart={(e) => startDrag(e, line.id)}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${displayPos}px`,
              height: hitSize,
              transform: 'translateY(-50%)',
              cursor: canEdit ? 'ns-resize' : 'default',
              zIndex: 45,
              touchAction: 'none',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: canEdit ? 'auto' : 'none'
            }}
          >
            <div style={{
              width: '100%', height: isActive ? '2.5px' : '1.5px', background: '#A855F7',
              boxShadow: isActive ? '0 0 6px rgba(168,85,247,1)' : '0 0 3px rgba(168,85,247,0.9)'
            }} />
            {deleteButton}
          </div>
        ) : (
          <div
            key={line.id}
            onMouseDown={(e) => startDrag(e, line.id)}
            onTouchStart={(e) => startDrag(e, line.id)}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${displayPos}px`,
              width: hitSize,
              transform: 'translateX(-50%)',
              cursor: canEdit ? 'ew-resize' : 'default',
              zIndex: 45,
              touchAction: 'none',
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: canEdit ? 'auto' : 'none'
            }}
          >
            <div style={{
              height: '100%', width: isActive ? '2.5px' : '1.5px', background: '#A855F7',
              boxShadow: isActive ? '0 0 6px rgba(168,85,247,1)' : '0 0 3px rgba(168,85,247,0.9)'
            }} />
            {deleteButton}
          </div>
        )
      })}
    </>
  )
}

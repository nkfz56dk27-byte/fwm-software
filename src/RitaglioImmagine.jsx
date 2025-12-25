import { useState, useRef, useEffect } from 'react'

export default function RitaglioImmagine({ onClose }) {
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const [lastDragPosition, setLastDragPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [savedFilePath, setSavedFilePath] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [conLogo, setConLogo] = useState(false)
  const [logoImage, setLogoImage] = useState(null)
  
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  
  const DISPLAY_SCALE = 0.6
  const CROP_WIDTH = 1200
  const CROP_HEIGHT = 729
  const DISPLAY_WIDTH = CROP_WIDTH * DISPLAY_SCALE
  const DISPLAY_HEIGHT = CROP_HEIGHT * DISPLAY_SCALE

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      setLogoImage(canvas.toDataURL('image/png'))
      console.log('✅ Logo caricato automaticamente')
    }
    img.onerror = () => {
      console.warn('⚠️ Logo non trovato in /public/Logo_Formula1it.png')
    }
    img.src = '/Logo_Formula1it.png'
  }, [])

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target.result)
      setImageOffset({ x: 0, y: 0 })
      setLastDragPosition({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target.result)
      setImageOffset({ x: 0, y: 0 })
      setLastDragPosition({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleMouseDown(e) {
    if (!selectedImage) return
    setIsDragging(true)
  }

  function handleMouseMove(e) {
    if (!isDragging || !selectedImage) return
    
    const deltaX = e.movementX
    const deltaY = e.movementY
    const newOffsetX = imageOffset.x + deltaX
    const newOffsetY = imageOffset.y + deltaY
    
    setImageOffset({
      x: newOffsetX,
      y: newOffsetY
    })
  }

  function handleMouseUp() {
    if (isDragging) {
      setLastDragPosition(imageOffset)
      setIsDragging(false)
    }
  }

  function resetPosition() {
    setImageOffset({ x: 0, y: 0 })
    setLastDragPosition({ x: 0, y: 0 })
  }

  function removeImage() {
    setSelectedImage(null)
    setImageOffset({ x: 0, y: 0 })
    setLastDragPosition({ x: 0, y: 0 })
  }

  async function salvaCrop() {
    if (!selectedImage || isSaving) return
    setIsSaving(true)

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = selectedImage
      })

      const canvas = document.createElement('canvas')
      canvas.width = CROP_WIDTH
      canvas.height = CROP_HEIGHT
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, CROP_WIDTH, CROP_HEIGHT)

      const scaleToFillWidth = CROP_WIDTH / img.width
      const scaleToFillHeight = CROP_HEIGHT / img.height
      const scaleToFill = Math.max(scaleToFillWidth, scaleToFillHeight)
      
      const scaledImageWidth = img.width * scaleToFill
      const scaledImageHeight = img.height * scaleToFill
      
      const scaleFactor = CROP_WIDTH / DISPLAY_WIDTH
      const finalOffsetX = imageOffset.x * scaleFactor
      const finalOffsetY = imageOffset.y * scaleFactor
      
      const drawX = (CROP_WIDTH - scaledImageWidth) / 2 + finalOffsetX
      const drawY = (CROP_HEIGHT - scaledImageHeight) / 2 + finalOffsetY

      ctx.drawImage(img, drawX, drawY, scaledImageWidth, scaledImageHeight)

      if (conLogo && logoImage) {
        const logo = new Image()
        await new Promise((resolve) => {
          logo.onload = resolve
          logo.src = logoImage
        })

        const logoWidth = 400
        const logoAspect = logo.height / logo.width
        const logoHeight = logoWidth * logoAspect
        const logoX = (CROP_WIDTH - logoWidth) / 2
        const logoY = CROP_HEIGHT - logoHeight - 20

        ctx.globalAlpha = 0.8
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight)
        ctx.globalAlpha = 1.0
      }

      canvas.toBlob((blob) => {
        const prefix = conLogo ? 'Sito con logo' : 'Sito senza logo'
        const storageKey = conLogo ? 'ritaglio_counter_logo' : 'ritaglio_counter_no_logo'
        let counter = parseInt(localStorage.getItem(storageKey) || '0') + 1
        localStorage.setItem(storageKey, counter.toString())
        
        const fileName = `${prefix} ${counter}.jpg`
        
        const link = document.createElement('a')
        link.download = fileName
        link.href = URL.createObjectURL(blob)
        link.click()
        
        setSavedFilePath('success')
        setShowSuccessAlert(true)
        setIsSaving(false)
      }, 'image/jpeg', 1.0)

    } catch (error) {
      console.error('Errore salvataggio:', error)
      setSavedFilePath('❌ Errore durante il salvataggio')
      setShowSuccessAlert(true)
      setIsSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: '#f5f5f7', borderRadius: '15px', width: '1000px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Indietro
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Ritaglio Immagine</div>
            <div style={{ fontSize: '13px', color: '#666' }}>1200 x 729 px</div>
          </div>
          <div style={{ width: '90px' }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', padding: '15px 25px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={() => setConLogo(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: !conLogo ? '#007AFF1A' : '#f0f0f0', border: !conLogo ? '2px solid #007AFF' : '2px solid #d0d0d0', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600', color: !conLogo ? '#007AFF' : '#666' }}>
            <span style={{ fontSize: '18px' }}>{!conLogo ? '☑' : '☐'}</span>
            Senza Logo
          </button>
          <button onClick={() => setConLogo(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: conLogo ? '#007AFF1A' : '#f0f0f0', border: conLogo ? '2px solid #007AFF' : '2px solid #d0d0d0', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600', color: conLogo ? '#007AFF' : '#666' }}>
            <span style={{ fontSize: '18px' }}>{conLogo ? '☑' : '☐'}</span>
            Con Logo
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {!selectedImage ? (
            <div 
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{ 
                width: `${DISPLAY_WIDTH}px`, 
                height: `${DISPLAY_HEIGHT}px`, 
                border: '3px dashed #ccc', 
                borderRadius: '12px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '15px',
                cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '50px', color: '#999' }}>📷</div>
              <div style={{ fontSize: '18px', color: '#666' }}>Trascina un'immagine qui</div>
              <div style={{ fontSize: '14px', color: '#999' }}>oppure</div>
              <button style={{ padding: '12px 25px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                📁 Carica Immagine
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>
          ) : (
            <div>
              <div 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ 
                  width: `${DISPLAY_WIDTH}px`, 
                  height: `${DISPLAY_HEIGHT}px`, 
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '12px',
                  border: '5px solid rgba(128,128,128,0.5)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  background: '#000'
                }}
              >
                <img 
                  src={selectedImage} 
                  alt="Crop" 
                  draggable={false}
                  style={{ 
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `translate(${imageOffset.x}px, ${imageOffset.y}px)`,
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }} 
                />

                {conLogo && logoImage && (
                  <div style={{ position: 'absolute', bottom: `${20 * DISPLAY_SCALE}px`, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                    <img src={logoImage} alt="Logo" style={{ width: `${400 * DISPLAY_SCALE}px`, opacity: 0.8 }} />
                  </div>
                )}

                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <line x1={DISPLAY_WIDTH / 3} y1="0" x2={DISPLAY_WIDTH / 3} y2={DISPLAY_HEIGHT} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                  <line x1={(2 * DISPLAY_WIDTH) / 3} y1="0" x2={(2 * DISPLAY_WIDTH) / 3} y2={DISPLAY_HEIGHT} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                  <line x1="0" y1={DISPLAY_HEIGHT / 3} x2={DISPLAY_WIDTH} y2={DISPLAY_HEIGHT / 3} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                  <line x1="0" y1={(2 * DISPLAY_HEIGHT) / 3} x2={DISPLAY_WIDTH} y2={(2 * DISPLAY_HEIGHT) / 3} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                </svg>

                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '3px solid white', borderRadius: '8px', pointerEvents: 'none' }}></div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={resetPosition} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  🔄 Reset Posizione
                </button>
                <button onClick={removeImage} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  🗑️ Rimuovi Immagine
                </button>
              </div>

              <div style={{ marginTop: '15px', padding: '12px', background: '#007AFF1A', borderRadius: '8px', textAlign: 'center', maxWidth: `${DISPLAY_WIDTH}px` }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                  💡 <strong>Trascina l'immagine</strong> per posizionarla
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  Usa la griglia per centrare il soggetto • Bordo bianco 3px incluso
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedImage && (
          <div style={{ padding: '15px 25px', background: 'white', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>
              Annulla
            </button>
            <button onClick={salvaCrop} disabled={isSaving} style={{ padding: '10px 20px', background: isSaving ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {isSaving ? '⏳ Salvataggio...' : '💾 Salva Ritaglio (1200x729)'}
            </button>
          </div>
        )}

        {showSuccessAlert && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '15px', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>
                {savedFilePath === 'success' ? '✅' : '❌'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '10px' }}>
                {savedFilePath === 'success' ? 'Immagine Salvata!' : 'Errore'}
              </div>
              {savedFilePath === 'success' && (
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                  L'immagine è stata salvata nella cartella Download
                </div>
              )}
              {savedFilePath !== 'success' && (
                <div style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>{savedFilePath}</div>
              )}
              <button onClick={() => setShowSuccessAlert(false)} style={{ width: '100%', padding: '14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '16px' }}>
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

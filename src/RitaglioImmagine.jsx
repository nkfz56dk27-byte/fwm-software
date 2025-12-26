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
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000)
  
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  
  // Costanti per il salvataggio (1200x729 - NON TOCCARE!)
  const CROP_WIDTH = 1200
  const CROP_HEIGHT = 729
  
  // Scale responsive per preview
  const isMobile = windowWidth <= 768
  const DISPLAY_SCALE = isMobile ? 0.35 : 0.6
  const DISPLAY_WIDTH = CROP_WIDTH * DISPLAY_SCALE
  const DISPLAY_HEIGHT = CROP_HEIGHT * DISPLAY_SCALE

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  async function handleSave() {
    if (!selectedImage) return

    setIsSaving(true)
    setSavedFilePath('')
    setShowSuccessAlert(false)

    try {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        // SALVATAGGIO 1200x729 (NON CAMBIARE!)
        canvas.width = CROP_WIDTH
        canvas.height = CROP_HEIGHT
        const ctx = canvas.getContext('2d')

        const scale = CROP_WIDTH / DISPLAY_WIDTH
        const adjustedOffsetX = imageOffset.x * scale
        const adjustedOffsetY = imageOffset.y * scale

        ctx.drawImage(img, adjustedOffsetX, adjustedOffsetY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)

        if (conLogo && logoImage) {
          const logoImg = new Image()
          logoImg.onload = () => {
            const logoWidth = 400
            const logoHeight = (logoImg.height / logoImg.width) * logoWidth
            const logoX = (CROP_WIDTH - logoWidth) / 2
            const logoY = CROP_HEIGHT - logoHeight - 20

            ctx.globalAlpha = 0.8
            ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight)
            ctx.globalAlpha = 1.0

            downloadImage(canvas)
          }
          logoImg.src = logoImage
        } else {
          downloadImage(canvas)
        }
      }
      img.src = selectedImage
    } catch (error) {
      console.error('Errore salvataggio:', error)
      setSavedFilePath('❌ Errore durante il salvataggio')
      setShowSuccessAlert(true)
      setIsSaving(false)
    }
  }

  function downloadImage(canvas) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ritaglio_${Date.now()}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSavedFilePath(`✅ Download completato: ${a.download}`)
      setShowSuccessAlert(true)
      setIsSaving(false)
    }, 'image/jpeg', 1.0)
  }

  const containerWidth = isMobile ? '100vw' : '1000px'
  const containerMaxHeight = isMobile ? '100vh' : '95vh'
  const containerBorderRadius = isMobile ? '0' : '15px'
  const headerPadding = isMobile ? '12px 15px' : '15px 25px'
  const contentPadding = isMobile ? '15px 10px' : '25px'
  const buttonPadding = isMobile ? '8px 12px' : '10px 20px'
  const buttonFontSize = isMobile ? '13px' : '16px'

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: '#f5f5f7', borderRadius: containerBorderRadius, width: containerWidth, maxHeight: containerMaxHeight, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: headerPadding, background: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: isMobile ? '14px' : '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', minHeight: isMobile ? '44px' : 'auto' }}>
            ← Indietro
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 'bold' }}>Ritaglio Immagine</div>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: '#666' }}>1200 x 729 px</div>
          </div>
          <div style={{ width: isMobile ? '60px' : '90px' }}></div>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', gap: isMobile ? '8px' : '15px', padding: headerPadding, background: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={() => setConLogo(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: buttonPadding, background: !conLogo ? '#007AFF1A' : '#f0f0f0', border: !conLogo ? '2px solid #007AFF' : '2px solid #d0d0d0', borderRadius: '10px', cursor: 'pointer', fontSize: buttonFontSize, fontWeight: '600', color: !conLogo ? '#007AFF' : '#666', minHeight: isMobile ? '48px' : 'auto' }}>
            <span style={{ fontSize: isMobile ? '16px' : '18px' }}>{!conLogo ? '☑' : '☐'}</span>
            Senza Logo
          </button>
          <button onClick={() => setConLogo(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: buttonPadding, background: conLogo ? '#007AFF1A' : '#f0f0f0', border: conLogo ? '2px solid #007AFF' : '2px solid #d0d0d0', borderRadius: '10px', cursor: 'pointer', fontSize: buttonFontSize, fontWeight: '600', color: conLogo ? '#007AFF' : '#666', minHeight: isMobile ? '48px' : 'auto' }}>
            <span style={{ fontSize: isMobile ? '16px' : '18px' }}>{conLogo ? '☑' : '☐'}</span>
            Con Logo
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: contentPadding, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {!selectedImage ? (
            <div 
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{ 
                width: `${DISPLAY_WIDTH}px`, 
                height: `${DISPLAY_HEIGHT}px`, 
                maxWidth: '100%',
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
              <div style={{ fontSize: isMobile ? '35px' : '50px', color: '#999' }}>📷</div>
              <div style={{ fontSize: isMobile ? '14px' : '18px', color: '#666', textAlign: 'center', padding: '0 10px' }}>Trascina un'immagine qui</div>
              <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#999' }}>oppure</div>
              <button style={{ padding: isMobile ? '10px 20px' : '12px 25px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '10px', fontSize: isMobile ? '14px' : '16px', fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '44px' : 'auto' }}>
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
                  maxWidth: 'calc(100vw - 20px)',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '12px',
                  border: '5px solid rgba(128,128,128,0.5)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  background: '#000',
                  margin: '0 auto'
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
              </div>

              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', gap: isMobile ? '8px' : '15px', marginTop: isMobile ? '15px' : '25px' }}>
                <button onClick={resetPosition} style={{ padding: buttonPadding, background: '#f0f0f0', color: '#333', border: 'none', borderRadius: '10px', fontSize: buttonFontSize, fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>
                  🔄 Reset Posizione
                </button>
                <button onClick={() => { setSelectedImage(null); fileInputRef.current?.click(); }} style={{ padding: buttonPadding, background: '#FF9500', color: 'white', border: 'none', borderRadius: '10px', fontSize: buttonFontSize, fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>
                  🖼 Cambia Immagine
                </button>
                <button onClick={handleSave} disabled={isSaving} style={{ padding: buttonPadding, background: isSaving ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '10px', fontSize: buttonFontSize, fontWeight: '600', cursor: isSaving ? 'not-allowed' : 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>
                  {isSaving ? '⏳ Salvataggio...' : '💾 Salva'}
                </button>
              </div>
            </div>
          )}
        </div>

        {showSuccessAlert && (
          <div style={{ background: savedFilePath.startsWith('✅') ? '#d4edda' : '#f8d7da', color: savedFilePath.startsWith('✅') ? '#155724' : '#721c24', padding: '15px', textAlign: 'center', fontSize: '14px', borderTop: '1px solid #e0e0e0' }}>
            {savedFilePath}
          </div>
        )}
      </div>
    </div>
  )
}

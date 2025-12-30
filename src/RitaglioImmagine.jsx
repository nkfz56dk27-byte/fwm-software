import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function RitaglioImmagine({ onClose }) {
  const [view, setView] = useState('menu')
  const [dimensions, setDimensions] = useState({ width: 1200, height: 729 })
  const [recentProjects, setRecentProjects] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [conLogo, setConLogo] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [exportFormat, setExportFormat] = useState('image/webp')

  const fileInputRef = useRef(null)
  const logoImgRef = useRef(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000)

  const isMobile = windowWidth <= 768
  const DISPLAY_SCALE = isMobile ? 0.35 : 0.6
  const displayDim = {
    w: dimensions.width * DISPLAY_SCALE,
    h: dimensions.height * DISPLAY_SCALE
  }

  useEffect(() => {
    fetchCloudProgetti()
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    const img = new Image()
    img.src = '/Logo_Formula1it.png'
    img.onload = () => { logoImgRef.current = img }
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchCloudProgetti = async () => {
    const { data } = await supabase
      .from('progetti_dimensioni')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6)
    if (data) setRecentProjects(data)
  }

  const startNewProject = async (w, h, nome) => {
    const width = parseInt(w)
    const height = parseInt(h)
    const projectName = nome || `${width}x${height}`
    setDimensions({ width, height })
    const exists = recentProjects.find(p => p.width === width && p.height === height && p.nome === projectName)
    if (!exists) {
      await supabase.from('progetti_dimensioni').insert([{ width, height, nome: projectName }])
      fetchCloudProgetti()
    }
    setView('editor')
  }

  const deleteProject = async (e, id) => {
    e.stopPropagation()
    if (window.confirm("Vuoi eliminare questo formato?")) {
      await supabase.from('progetti_dimensioni').delete().eq('id', id)
      fetchCloudProgetti()
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target.result)
      setImageOffset({ x: 0, y: 0 })
      setFeedback('')
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!selectedImage) return
    setIsSaving(true)
    const img = new Image()
    img.src = selectedImage
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = dimensions.width
      canvas.height = dimensions.height
      const ctx = canvas.getContext('2d')
      const scale = dimensions.width / img.width
      const renderW = dimensions.width
      const renderH = img.height * scale
      const realY = (imageOffset.y / DISPLAY_SCALE)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, realY, renderW, renderH)
      if (conLogo && logoImgRef.current) {
        const lW = dimensions.width * 0.45
        const lH = (logoImgRef.current.height / logoImgRef.current.width) * lW
        ctx.drawImage(logoImgRef.current, (dimensions.width - lW) / 2, dimensions.height - lH - 20, lW, lH)
      }
      const ext = exportFormat === 'image/webp' ? 'webp' : 'jpg'
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `FWM_${Date.now()}.${ext}`; a.click()
        URL.revokeObjectURL(url)
        setFeedback(`✅ Esportato: ${ext.toUpperCase()}`)
        setIsSaving(false)
        setTimeout(() => setFeedback(''), 4000)
      }, exportFormat, 0.92)
    }
  }

  const StyledButton = ({ onClick, children, variant = 'primary', disabled = false, fullWidth = false }) => {
    const variants = {
      primary: { background: '#007AFF', color: '#fff' },
      secondary: { background: '#ffffff', color: '#1c1c1e', border: '1px solid #d1d1d6' },
      success: { background: '#34C759', color: '#fff' },
      warning: { background: '#FF9500', color: '#fff' },
      outline: { background: 'transparent', color: '#007AFF', boxShadow: 'none' }
    }
    return (
      <button disabled={disabled} onClick={onClick} style={{ 
        padding: '16px 28px', borderRadius: '14px', border: 'none', fontSize: '15px', fontWeight: '800', 
        cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        gap: '8px', width: fullWidth ? '100%' : 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textTransform: 'uppercase',
        ...variants[variant], opacity: disabled ? 0.6 : 1
      }}>{children}</button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ background: '#F2F2F7', width: isMobile ? '100%' : '900px', borderRadius: isMobile ? 0 : '28px', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
        
        <div style={{ padding: '18px 25px', background: '#fff', borderBottom: '1px solid #e5e5ea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <StyledButton variant="outline" onClick={view === 'menu' ? onClose : () => setView('menu')}>
            {view === 'menu' ? '✕ Chiudi' : '← Indietro'}
          </StyledButton>
          <span style={{ fontWeight: '900', fontSize: '18px', color: '#1c1c1e' }}>EDITOR FOTO FWM</span>
          <div style={{ width: '80px' }}></div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
          {view === 'menu' ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '40px' }}>Progetti Condivisi</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '30px' }}>
                <div style={{ background: '#fff', padding: '35px', borderRadius: '24px', width: '300px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px', textAlign: 'left' }}>NOME PROGETTO</label>
                  <input id="proj_name" type="text" placeholder="Es: Post Facebook" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '20px' }} />
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px', textAlign: 'left' }}>LARGHEZZA (PX)</label>
                  <input id="w" type="number" defaultValue={1200} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '20px' }} />
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px', textAlign: 'left' }}>ALTEZZA (PX)</label>
                  <input id="h" type="number" defaultValue={729} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '30px' }} />
                  <StyledButton fullWidth onClick={() => startNewProject(document.getElementById('w').value, document.getElementById('h').value, document.getElementById('proj_name').value)}>Apri Cloud</StyledButton>
                </div>

                <div style={{ background: '#fff', padding: '35px', borderRadius: '24px', width: '300px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '15px' }}>FORMATI CLOUD</label>
                  {recentProjects.length > 0 ? recentProjects.map((p, i) => (
                    <div key={i} onClick={() => { setDimensions({width: p.width, height: p.height}); setView('editor'); }} 
                         style={{ cursor: 'pointer', padding: '14px', background: '#F2F2F7', marginBottom: '12px', borderRadius: '14px', border: '1px solid transparent', position: 'relative' }}>
                      <div style={{ fontWeight: '800', fontSize: '13px', color: '#007AFF' }}>{p.nome || 'Senza Nome'}</div>
                      <div style={{ fontSize: '12px', color: '#8e8e93' }}>{p.width} × {p.height}</div>
                      <div onClick={(e) => deleteProject(e, p.id)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#FF3B30', fontSize: '18px', fontWeight: 'bold', padding: '5px' }}>✕</div>
                    </div>
                  )) : <p style={{ color: '#c7c7cc', fontSize: '14px' }}>Nessun formato salvato</p>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} accept="image/*" />
              {!selectedImage ? (
                <div onClick={() => fileInputRef.current.click()} style={{ width: '100%', maxWidth: '550px', height: '320px', border: '3px dashed #c7c7cc', borderRadius: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff' }}>
                  <div style={{ fontSize: '60px' }}>📷</div>
                  <p style={{ fontWeight: '800', color: '#8e8e93', marginTop: '15px' }}>Carica Foto</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '20px' }}><span style={{ background: '#1c1c1e', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>{dimensions.width} × {dimensions.height} PX</span></div>
                  <div 
                    onMouseDown={() => setIsDragging(true)}
                    onMouseMove={(e) => isDragging && setImageOffset(prev => ({ x: 0, y: prev.y + e.movementY }))}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onTouchStart={(e) => { setIsDragging(true); e.currentTarget.dataset.startY = e.touches[0].clientY; }}
                    onTouchMove={(e) => {
                      if (!isDragging) return;
                      const y = e.touches[0].clientY;
                      const diff = y - parseFloat(e.currentTarget.dataset.startY);
                      setImageOffset(prev => ({ x: 0, y: prev.y + diff }));
                      e.currentTarget.dataset.startY = y;
                    }}
                    onTouchEnd={() => setIsDragging(false)}
                    style={{ 
                      width: `${displayDim.w}px`, height: `${displayDim.h}px`, background: '#fff', position: 'relative', 
                      overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', cursor: isDragging ? 'grabbing' : 'grab',
                      touchAction: 'none' 
                    }}
                  >
                    <img src={selectedImage} draggable={false} style={{ position: 'absolute', width: '100%', height: 'auto', top: 0, left: 0, transform: `translateY(${imageOffset.y}px)`, pointerEvents: 'none' }} />
                    {conLogo && <div style={{ position: 'absolute', bottom: '6%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}><img src="/Logo_Formula1it.png" style={{ width: '45%', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} /></div>}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '40px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                    <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ padding: '12px', borderRadius: '14px', border: '1px solid #d1d1d6', fontWeight: '800', background: '#fff', height: '45px' }}>
                      <option value="image/webp">WEBP</option>
                      <option value="image/jpeg">JPEG</option>
                    </select>
                    <StyledButton variant={conLogo ? 'success' : 'secondary'} onClick={() => setConLogo(!conLogo)}>{conLogo ? '✅ Logo' : '➕ Logo'}</StyledButton>
                    <StyledButton variant="warning" onClick={() => fileInputRef.current.click()}>Nuova Foto</StyledButton>
                    <StyledButton variant="primary" onClick={handleSave} disabled={isSaving}>{isSaving ? '⏳...' : 'Salva'}</StyledButton>
                  </div>
                </>
              )}
              {feedback && <div style={{ marginTop: '25px', padding: '14px 28px', background: '#34C759', color: '#fff', borderRadius: '16px', fontWeight: '800' }}>{feedback}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

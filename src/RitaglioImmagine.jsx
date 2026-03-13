import { useState, useRef, useEffect } from 'react'
import { encode as encodeWebp } from '@jsquash/webp'
import piexif from 'piexifjs'
import { supabase } from './supabaseClient'

export default function RitaglioImmagine({ user, onClose }) {
  const [view, setView] = useState('menu')
  const [userCategorie, setUserCategorie] = useState([])
  const [selectedLogo, setSelectedLogo] = useState('formula1it')
  const [logoConfig, setLogoConfig] = useState({
    formula1it: { widthPercent: 0.30, offsetX: -45, offsetYPercent: 0.01 },
    blogformulae: { widthPercent: 0.38, offsetX: -5, offsetYPercent: 0.01 }
  })
  const [dimensions, setDimensions] = useState({ width: 1200, height: 729 })
  const [recentProjects, setRecentProjects] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [conLogo, setConLogo] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [exportFormat, setExportFormat] = useState('image/jpeg')
  const [counterWithLogo, setCounterWithLogo] = useState(1)
  const [counterWithoutLogo, setCounterWithoutLogo] = useState(1)
  const [projectMode, setProjectMode] = useState('normale') // SOLO per il menu, non tocca il sistema
  const [projectImages, setProjectImages] = useState({ normale: [], cover: [] }) // Separa le foto per progetto
  const [favoriteProjects, setFavoriteProjects] = useState([]) // Progetti preferiti
  const [mobileImgStyle, setMobileImgStyle] = useState({ width: '100%', height: 'auto' }) // FIX MOBILE: dimensioni immagine
  const [showCenterCross, setShowCenterCross] = useState(false) // Croce di centratura
  const [canvasBackground, setCanvasBackground] = useState('#000000') // Colore delle strisce del canvas

  const fileInputRef = useRef(null)
  const logosRef = useRef({ formula1it: null, blogformulae: null })
  const containerRef = useRef(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000)
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800)

  const isMobile = windowWidth <= 768
  
  // FIX: Rimpicciolisce il container se il canvas è troppo grande, mantenendo dimensioni reali per export
  const { displayScale, containerWidth, containerHeight } = (() => {
    const realW = dimensions.width
    const realH = dimensions.height
    
    let scale = 1
    
    if (isMobile) {
      // SU MOBILE: Scala smart per entrare nella finestra
      const maxWidth = windowWidth * 0.9
      const maxHeight = windowHeight * 0.55 // Spazio per header + pulsanti
      const canvasAspect = realW / realH
      
      let w = maxWidth
      let h = w / canvasAspect
      
      if (h > maxHeight) {
        h = maxHeight
        w = h * canvasAspect
      }
      
      scale = w / realW
    } else {
      // SU DESKTOP: 
      // Se PICCOLO (< 1500x1000): scala al 60%
      // Se GRANDE (>= 1500x1000): scala dinamicamente per stare nella finestra
      const maxWidth = windowWidth * 0.85
      const maxHeight = windowHeight * 0.62
      
      if (realW < 1500 && realH < 1000) {
        scale = 0.6
      } else {
        const scaleW = maxWidth / realW
        const scaleH = maxHeight / realH
        scale = Math.min(scaleW, scaleH, 1)
      }
    }
    
    console.log('📐 Canvas display scale:', {
      device: isMobile ? 'MOBILE' : 'DESKTOP',
      realDim: `${realW}×${realH}`,
      scale: scale.toFixed(2),
      displayDim: `${(realW * scale).toFixed(0)}×${(realH * scale).toFixed(0)}`
    })
    
    return {
      displayScale: scale,
      containerWidth: realW * scale,
      containerHeight: realH * scale
    }
  })()

  // --- Sincronizzazione Cloud (SUPABASE RIPRISTINATO) ---
  useEffect(() => {
    fetchCloudProgetti()
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      setWindowHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    
    // Carica entrambi i loghi
    const img1 = new Image()
    img1.src = '/Logo_Formula1it.png'
    img1.onload = () => { logosRef.current.formula1it = img1; console.log('[LOGO] Formula1it caricato') }
    img1.onerror = () => { console.warn('[LOGO] Formula1it errore caricamento') }
    
    const img2 = new Image()
    img2.src = '/Logo_Blogformulae.png'
    img2.onload = () => { logosRef.current.blogformulae = img2; console.log('[LOGO] BlogFormulae caricato') }
    img2.onerror = () => { console.warn('[LOGO] BlogFormulae errore caricamento') }
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Carica categorie dell'utente quando il componente monta
  useEffect(() => {
    if (!user || !user.username) return
    
    const loadCategories = async () => {
      try {
        const { data: gruppiUtente } = await supabase
          .from('gruppi_redattori')
          .select('categoria_id')
          .eq('username', user.username)
        
        let categorie = []
        if (gruppiUtente && gruppiUtente.length > 0) {
          const categorieIds = gruppiUtente.map(g => g.categoria_id).filter(Boolean)
          
          if (categorieIds.length > 0) {
            const { data: categorieArr, error: catError } = await supabase
              .from('categorie_weekend')
              .select('nome')
              .in('id', categorieIds)
            if (!catError && Array.isArray(categorieArr) && categorieArr.length > 0) {
              categorie = categorieArr.map(c => c.nome)
            }
          }
        }
        
        setUserCategorie(categorie)
      } catch (err) {
        console.error('Errore caricamento categorie:', err)
      }
    }
    
    loadCategories()
  }, [user?.username])

  // Carica preferiti da Supabase all'avvio
  const loadFavorites = async () => {
    if (!user || !user.username) return;
    try {
      const { data } = await supabase
        .from('progetti_preferiti')
        .select('project_id')
        .eq('username', user.username);
      if (data) setFavoriteProjects(data.map(p => p.project_id));
    } catch (err) {
      console.error('Errore caricamento preferiti:', err);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [user?.username]);

  const fetchCloudProgetti = async () => {
    const { data } = await supabase
      .from('progetti_dimensioni')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6)
    if (data) setRecentProjects(data)
  }

  const startNewProject = async (width, height, nome) => {
    setProjectMode('normale')
    width = parseInt(width)
    height = parseInt(height)
    if (!width || !height || width < 100 || height < 100) {
      setFeedback('⚠️ Inserisci dimensioni valide (minimo 100px)')
      setTimeout(() => setFeedback(''), 4000)
      return
    }
    const projectName = nome.trim() || `${width}x${height}`
    
    // Aggiunge "COVER" al nome se la modalità è cover
    const finalProjectName = projectMode === 'cover' && !projectName.toLowerCase().includes('cover') 
      ? `${projectName} - COVER` 
      : projectName
    
    setDimensions({ width, height })
    
    // Logica di salvataggio su Supabase ripristinata
    const exists = recentProjects.find(p => p.width === width && p.height === height && p.nome === finalProjectName)
    if (!exists) {
      await supabase.from('progetti_dimensioni').insert([{ width, height, nome: finalProjectName }])
      fetchCloudProgetti()
    }
    setView('editor')
  }

  const deleteProject = async (e, id) => {
    e.stopPropagation()
    if (window.confirm("Vuoi eliminare questo formato dal Cloud?")) {
      await supabase.from('progetti_dimensioni').delete().eq('id', id)
      fetchCloudProgetti()
    }
  }

  // --- Drag & Drop e File Processing ---
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    processFile(file)
  }

  const processFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Salva l'immagine nel progetto corretto
        setProjectImages(prev => ({
          ...prev,
          [projectMode]: [...prev[projectMode], e.target.result]
        }))
        setSelectedImage(e.target.result)
        
        // Reset offset e style mobile
        setImageOffset({ x: 0, y: 0 })
        setMobileImgStyle({ width: '100%', height: 'auto' })
        
        setView('editor')
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  // Pulisce le foto quando si cambia modalità progetto
  const handleModeChange = (newMode) => {
    setProjectMode(newMode)
    setSelectedImage(null) // Pulisce l'immagine corrente
    setImageOffset({ x: 0, y: 0 })
  }

  // Gestisce i preferiti su Supabase con controllo tipi e feedback
  const toggleFavorite = async (projectId) => {
    let errorMsg = '';
    const usernameSafe = typeof user?.username === 'string' ? user.username : '';
    const projectIdSafe = String(projectId); // sempre stringa
    console.log('[DEBUG] toggleFavorite chiamato', { projectId, projectIdSafe, favoriteProjects, usernameSafe });
    if (!usernameSafe || !projectIdSafe) {
      errorMsg = 'Dati preferito non validi: username o projectId';
      setFeedback(errorMsg);
      setTimeout(() => setFeedback(''), 4000);
      console.error(errorMsg);
      return;
    }
    if (favoriteProjects.includes(projectIdSafe)) {
      // Rimuovi da Supabase
      const { data, error } = await supabase.from('progetti_preferiti').delete().eq('username', usernameSafe).eq('project_id', projectIdSafe);
      console.log('[DEBUG] Supabase DELETE', { data, error });
      if (error) errorMsg = 'Errore rimozione preferito: ' + error.message;
    } else {
      // Aggiungi su Supabase
      const { data, error } = await supabase.from('progetti_preferiti').insert([{ username: usernameSafe, project_id: projectIdSafe }]);
      console.log('[DEBUG] Supabase INSERT', { data, error });
      if (error) errorMsg = 'Errore aggiunta preferito: ' + error.message;
    }
    // Aggiorna subito la UI per reattività
    if (favoriteProjects.includes(projectIdSafe)) {
      setFavoriteProjects(favoriteProjects.filter(id => id !== projectIdSafe));
    } else {
      setFavoriteProjects([...favoriteProjects, projectIdSafe]);
    }
    // Ricarica preferiti da Supabase per sincronizzare
    if (typeof loadFavorites === 'function') {
      await loadFavorites();
    }
    if (errorMsg) {
      setFeedback(errorMsg);
      setTimeout(() => setFeedback(''), 4000);
      console.error(errorMsg);
    }
    console.log('[DEBUG] toggleFavorite FINE', { favoriteProjects });
  }

  // Applica bounds per NORMALE (drag X/Y)
  const applyBounds = (newX, newY) => {
    if (!containerRef.current) return { x: newX, y: newY }
    const imgElement = containerRef.current.querySelector('img')
    if (!imgElement) return { x: newX, y: newY }
    
    // Se è un progetto cover, usa logica diversa
    if (projectMode === 'cover') {
      // In cover, l'immagine riempie tutto il canvas, quindi niente scroll
      return { x: 0, y: 0 }
    }
    
    // Calcola dimensioni effettive dell'immagine in modalità cover
    const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight
    const containerAspect = containerWidth / containerHeight
    
    let actualImgHeight, actualImgWidth
    
    if (imgAspect > containerAspect) {
      // Foto ORIZZONTALE → scala per HEIGHT
      actualImgHeight = containerHeight
      actualImgWidth = actualImgHeight * imgAspect
    } else {
      // Foto VERTICALE → scala per WIDTH
      actualImgWidth = containerWidth
      actualImgHeight = actualImgWidth / imgAspect
    }
    
    const maxOffsetX = Math.max(0, (actualImgWidth - containerWidth) / 2)
    const maxOffsetY = Math.max(0, (actualImgHeight - containerHeight) / 2)
    
    const boundedX = Math.min(maxOffsetX, Math.max(-maxOffsetX, newX))
    const boundedY = Math.min(maxOffsetY, Math.max(-maxOffsetY, newY))
    
    return { x: boundedX, y: boundedY }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    processFile(file)
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
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      if (projectMode === 'cover') {
        // Logica COVER: riempi tutto il canvas con objectFit cover
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Calcola le dimensioni per riempire tutto il canvas (object-fit: cover)
        const canvasRatio = canvas.width / canvas.height
        const imgRatio = img.width / img.height
        
        let drawWidth, drawHeight, drawX, drawY
        
        if (imgRatio > canvasRatio) {
          // Immagine più larga del canvas (foto orizzontale)
          drawHeight = canvas.height
          drawWidth = drawHeight * imgRatio
          drawX = (canvas.width - drawWidth) / 2
          drawY = 0
        } else {
          // Immagine più alta del canvas (foto verticale)
          drawWidth = canvas.width
          drawHeight = drawWidth / imgRatio
          drawX = 0
          drawY = (canvas.height - drawHeight) / 2
        }
        
        // Applica lo zoom del 5% MANTENENDO IL CENTRO
        const zoomFactor = 1.05
        const originalDrawWidth = drawWidth
        const originalDrawHeight = drawHeight
        const originalDrawX = drawX
        const originalDrawY = drawY
        
        drawWidth *= zoomFactor
        drawHeight *= zoomFactor
        drawX = originalDrawX - (drawWidth - originalDrawWidth) / 2
        drawY = originalDrawY - (drawHeight - originalDrawHeight) / 2
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
      } else {
        // Logica NORMALE: cover + offset X/Y (allineata all’anteprima)
        const imgAspect = img.width / img.height
        const canvasAspect = canvas.width / canvas.height

        let drawW, drawH, scaleToCanvas
        if (imgAspect > canvasAspect) {
          // Immagine più larga: scala per altezza
          drawH = canvas.height
          drawW = drawH * imgAspect
          scaleToCanvas = canvas.height / containerHeight
        } else {
          // Immagine più alta: scala per larghezza
          drawW = canvas.width
          drawH = drawW / imgAspect
          scaleToCanvas = canvas.width / containerWidth
        }

        const baseX = (canvas.width - drawW) / 2
        const baseY = (canvas.height - drawH) / 2
        const offsetX = imageOffset.x * scaleToCanvas
        const offsetY = imageOffset.y * scaleToCanvas

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, baseX + offsetX, baseY + offsetY, drawW, drawH)
      }
      
      if (conLogo && logosRef.current[selectedLogo]) {
        const logoImg = logosRef.current[selectedLogo]
        const config = logoConfig[selectedLogo]
        const lW = dimensions.width * config.widthPercent
        const lH = (logoImg.height / logoImg.width) * lW
        const lX = (dimensions.width - lW) / 2 + config.offsetX
        const lY = dimensions.height - lH - Math.round(dimensions.height * config.offsetYPercent)
        ctx.drawImage(logoImg, lX, lY, lW, lH)
      }
      
      const ext = exportFormat === 'image/webp' ? 'webp' : 'jpg'
      // Nome file richiesto
      const fileName = conLogo ? `Foto con logo_${counterWithLogo}.${ext}` : `Foto senza logo_${counterWithoutLogo}.${ext}`
      
      const exportWithDpi = async () => {
        const dpi = 600
        const quality = 1.0
        let blob

        if (exportFormat === 'image/webp') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const webpBuffer = await encodeWebp(imageData, { quality: 100, lossless: true })
          blob = new Blob([webpBuffer], { type: 'image/webp' })
        } else {
          let dataUrl = canvas.toDataURL(exportFormat, quality)
          if (exportFormat === 'image/jpeg') {
            const exifObj = {
              '0th': {
                [piexif.ImageIFD.XResolution]: [dpi, 1],
                [piexif.ImageIFD.YResolution]: [dpi, 1],
                [piexif.ImageIFD.ResolutionUnit]: 2
              }
            }
            const exifBytes = piexif.dump(exifObj)
            dataUrl = piexif.insert(exifBytes, dataUrl)
          }
          blob = await (await fetch(dataUrl)).blob()
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
        if (conLogo) {
          setCounterWithLogo(counterWithLogo + 1)
        } else {
          setCounterWithoutLogo(counterWithoutLogo + 1)
        }
        setFeedback(`✅ Esportato: ${ext.toUpperCase()}`)
        setIsSaving(false)
        setTimeout(() => setFeedback(''), 4000)
      }

      exportWithDpi().catch((err) => {
        console.error('Errore export con DPI:', err)
        setFeedback('❌ Errore export')
        setIsSaving(false)
        setTimeout(() => setFeedback(''), 4000)
      })
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
    <div 
      onDragOver={(e) => e.preventDefault()} 
      onDrop={handleDrop}
      style={{ position: 'fixed', inset: 0, background: '#fff', minHeight: '100vh', paddingTop: 'env(safe-area-inset-top)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', zIndex: 10000, fontFamily: '-apple-system, sans-serif', overflow: isMobile ? 'auto' : 'hidden' }}
    >
      <div style={{ background: '#F2F2F7', width: isMobile ? '100%' : '95vw', borderRadius: isMobile ? 0 : '28px', overflow: 'hidden', height: isMobile ? '100%' : 'auto', maxHeight: isMobile ? 'none' : '95vh', display: 'flex', flexDirection: 'column', boxShadow: isMobile ? 'none' : '0 30px 60px rgba(0,0,0,0.5)' }}>
        
        <div style={{ padding: isMobile ? '38px 25px 18px 25px' : '18px 25px', background: '#fff', borderBottom: '1px solid #e5e5ea', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <button onClick={view === 'menu' ? onClose : () => setView('menu')} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', position: 'absolute', left: 18, top: isMobile ? '55px' : '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ← Indietro
          </button>
          <span style={{ fontWeight: '900', fontSize: isMobile ? '15px' : '18px', color: '#1c1c1e', marginTop: isMobile ? '20px' : 0, whiteSpace: 'nowrap', overflow: 'visible', maxWidth: isMobile ? '100vw' : 'none', textAlign: 'center', width: '100%' }}>EDITOR FOTO FWM</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
          {view === 'menu' ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '40px' }}>Progetti Condivisi</h2>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '30px' }}>
                <div style={{ background: '#fff', padding: '35px', borderRadius: '24px', width: '300px' }}>
                  
                  {/* SOLO TAB DI SCELTA - NON TOCCA IL SISTEMA */}
                  <div style={{ 
                    display: 'flex', 
                    background: '#F8F9FA', 
                    borderRadius: '10px', 
                    padding: '3px', 
                    marginBottom: '25px',
                    border: '1px solid #E9ECEF'
                  }}>
                    <button 
                      onClick={() => handleModeChange('normale')}
                      style={{ 
                        flex: 1, 
                        padding: '10px 8px', 
                        borderRadius: '7px', 
                        border: 'none', 
                        background: projectMode === 'normale' ? '#007AFF' : 'transparent', 
                        color: projectMode === 'normale' ? '#fff' : '#8E8E93', 
                        fontWeight: '600', 
                        fontSize: '11px', 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      NORMALE
                    </button>
                    <button 
                      onClick={() => handleModeChange('cover')}
                      style={{ 
                        flex: 1, 
                        padding: '10px 8px', 
                        borderRadius: '7px', 
                        border: 'none', 
                        background: projectMode === 'cover' ? '#007AFF' : 'transparent', 
                        color: projectMode === 'cover' ? '#fff' : '#8E8E93', 
                        fontWeight: '600', 
                        fontSize: '11px', 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      COVER
                    </button>
                  </div>
                  
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px', textAlign: 'left' }}>NOME PROGETTO</label>
                  <input id="proj_name" type="text" placeholder="Es: Post Facebook" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '20px' }} />
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px', textAlign: 'left' }}>LARGHEZZA (PX)</label>
                  <input id="w" type="number" defaultValue={1200} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '20px' }} />
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px', textAlign: 'left' }}>ALTEZZA (PX)</label>
                  <input id="h" type="number" defaultValue={729} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '30px' }} />
                  <StyledButton fullWidth onClick={() => startNewProject(document.getElementById('w').value, document.getElementById('h').value, document.getElementById('proj_name').value)}>SALVA</StyledButton>
                </div>

                <div style={{ background: '#fff', padding: '35px 35px 35px 50px', borderRadius: '24px', width: '300px', textAlign: 'left', position: 'relative' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '15px' }}>FORMATI CLOUD</label>
                  
                  {/* SEZIONE PREFERITI */}
                  {favoriteProjects.length > 0 && (
                    <>
                      <label style={{ fontSize: '11px', fontWeight: '800', color: '#FF3B30', display: 'block', marginBottom: '10px' }}>⭐ PREFERITI</label>
                      {recentProjects.filter(p => favoriteProjects.includes(p.id)).map((p, i) => (
                        <div key={i} onClick={() => { 
                          setDimensions({width: p.width, height: p.height}); 
                          setView('editor'); 
                          // Imposta la modalità corretta quando apri il progetto
                          setProjectMode(p.nome && p.nome.toLowerCase().includes('cover') ? 'cover' : 'normale');
                        }} 
                             style={{ 
                               cursor: 'pointer', 
                               padding: '14px', 
                               background: '#FFF8F0', 
                               marginBottom: '12px', 
                               borderRadius: '14px', 
                               border: p.nome && p.nome.toLowerCase().includes('cover') ? '2px solid #FF3B30' : '2px solid #007AFF', 
                               position: 'relative' 
                             }}>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: '#FF9500' }}>{p.nome || 'Senza Nome'}</div>
                          <div style={{ fontSize: '12px', color: '#8e8e93' }}>{p.width} × {p.height}</div>
                          <div style={{ position: 'absolute', left: '-40px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', cursor: 'pointer', padding: '5px' }} onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}>
                            ⭐
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* SEZIONE ALTRI PROGETTI */}
                  {recentProjects.filter(p => !favoriteProjects.includes(p.id)).length > 0 && (
                    <>
                      <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '10px', marginTop: favoriteProjects.length > 0 ? '20px' : '0' }}>ALTRI PROGETTI</label>
                      {recentProjects.filter(p => !favoriteProjects.includes(p.id)).map((p, i) => (
                        <div key={i} onClick={() => { 
                          setDimensions({width: p.width, height: p.height}); 
                          setView('editor'); 
                          // Imposta la modalità corretta quando apri il progetto
                          setProjectMode(p.nome && p.nome.toLowerCase().includes('cover') ? 'cover' : 'normale');
                        }} 
                             style={{ 
                               cursor: 'pointer', 
                               padding: '14px', 
                               background: '#F2F2F7', 
                               marginBottom: '12px', 
                               borderRadius: '14px', 
                               border: p.nome && p.nome.toLowerCase().includes('cover') ? '2px solid #FF3B30' : '2px solid #007AFF', 
                               position: 'relative' 
                             }}>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: '#007AFF' }}>{p.nome || 'Senza Nome'}</div>
                          <div style={{ fontSize: '12px', color: '#8e8e93' }}>{p.width} × {p.height}</div>
                          <div style={{ position: 'absolute', left: '-40px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', cursor: 'pointer', padding: '5px' }} onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}>
                            ☆
                          </div>
                          <div onClick={(e) => deleteProject(e, p.id)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#FF3B30', fontSize: '18px', fontWeight: 'bold', padding: '5px' }}>✕</div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {recentProjects.length === 0 && <p style={{ color: '#c7c7cc', fontSize: '14px' }}>Nessun formato salvato</p>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} accept="image/*" />
              {!selectedImage ? (
                <div 
                  onClick={() => fileInputRef.current.click()} 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  style={{ width: '100%', maxWidth: '550px', height: '320px', border: '3px dashed #c7c7cc', borderRadius: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff' }}
                >
                  <div style={{ fontSize: '60px' }}>📷</div>
                  <p style={{ fontWeight: '800', color: '#8e8e93', marginTop: '15px' }}>Carica o trascina qui</p>
                </div>
              ) : (
                <>
                  {/* Bottoni di selezione logo e dimensioni */}
                  {userCategorie.length > 0 && userCategorie.some(cat => cat.toLowerCase() === 'formula e') ? (
                    <div style={{ marginBottom: '20px', marginLeft: '47px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: '12px', position: 'relative', width: '100%', minHeight: '40px' }}>
                      {isMobile ? (
                        <>
                          <span style={{ background: '#1c1c1e', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>{dimensions.width} × {dimensions.height} PX</span>
                          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                            <button
                              onClick={() => setSelectedLogo('formula1it')}
                              style={{
                                flex: 1,
                                padding: '12px 20px',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '15px',
                                fontWeight: '800',
                                background: selectedLogo === 'formula1it' ? '#007AFF' : '#E5E5EA',
                                color: selectedLogo === 'formula1it' ? '#fff' : '#1c1c1e',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Formula1.it
                            </button>
                            <button
                              onClick={() => setSelectedLogo('blogformulae')}
                              style={{
                                flex: 1,
                                padding: '12px 20px',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '15px',
                                fontWeight: '800',
                                background: selectedLogo === 'blogformulae' ? '#007AFF' : '#E5E5EA',
                                color: selectedLogo === 'blogformulae' ? '#fff' : '#1c1c1e',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              BlogFormulae.it
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setSelectedLogo('formula1it')}
                            style={{
                              padding: '12px 20px',
                              borderRadius: '12px',
                              border: 'none',
                              fontSize: '15px',
                              fontWeight: '800',
                              background: selectedLogo === 'formula1it' ? '#007AFF' : '#E5E5EA',
                              color: selectedLogo === 'formula1it' ? '#fff' : '#1c1c1e',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            Formula1.it
                          </button>
                          <span style={{ background: '#1c1c1e', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>{dimensions.width} × {dimensions.height} PX</span>
                          <button
                            onClick={() => setSelectedLogo('blogformulae')}
                            style={{
                              padding: '12px 20px',
                              borderRadius: '12px',
                              border: 'none',
                              fontSize: '15px',
                              fontWeight: '800',
                              background: selectedLogo === 'blogformulae' ? '#007AFF' : '#E5E5EA',
                              color: selectedLogo === 'blogformulae' ? '#fff' : '#1c1c1e',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            BlogFormulae.it
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '20px', marginLeft: '47px' }}><span style={{ background: '#1c1c1e', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>{dimensions.width} × {dimensions.height} PX</span></div>
                  )}
                  <div 
                    ref={containerRef}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseMove={(e) => {
                      if (!isDragging) return
                      const next = applyBounds(imageOffset.x + e.movementX, imageOffset.y + e.movementY)
                      setImageOffset(next)
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onTouchStart={(e) => {
                      setIsDragging(true)
                      e.currentTarget.dataset.startX = e.touches[0].clientX
                      e.currentTarget.dataset.startY = e.touches[0].clientY
                    }}
                    onTouchMove={(e) => {
                      if (!isDragging) return
                      const x = e.touches[0].clientX
                      const y = e.touches[0].clientY
                      const diffX = x - parseFloat(e.currentTarget.dataset.startX)
                      const diffY = y - parseFloat(e.currentTarget.dataset.startY)
                      const next = applyBounds(imageOffset.x + diffX, imageOffset.y + diffY)
                      setImageOffset(next)
                      e.currentTarget.dataset.startX = x
                      e.currentTarget.dataset.startY = y
                    }}
                    onTouchEnd={() => setIsDragging(false)}
                    style={{ 
                      width: `${containerWidth}px`, 
                      height: `${containerHeight}px`, 
                      background: canvasBackground, 
                      position: 'relative', 
                      overflow: 'hidden', 
                      boxShadow: '0 25px 60px rgba(0,0,0,0.4)', 
                      cursor: isDragging ? 'grabbing' : 'grab',
                      touchAction: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto'
                    }}
                  >
                    {/* Immagine normale */}
                    <img 
                      src={selectedImage} 
                      draggable={false}
                      onLoad={(e) => {
                        if (projectMode === 'normale') {
                          // Calcola dimensioni per riempire TUTTO (object-fit: cover)
                          const img = e.target
                          const imgAspect = img.naturalWidth / img.naturalHeight
                          const containerAspect = containerWidth / containerHeight
                          
                          console.log('📐 Image loaded:', {
                            imgAspect: imgAspect.toFixed(2),
                            containerAspect: containerAspect.toFixed(2),
                            imgNatural: `${img.naturalWidth}×${img.naturalHeight}`,
                            container: `${containerWidth}×${containerHeight}`
                          })
                          
                          if (imgAspect > containerAspect) {
                            // ORIZZONTALE → scala per HEIGHT
                            console.log('✅ ORIZZONTALE → scala per HEIGHT')
                            setMobileImgStyle({ width: 'auto', height: '100%' })
                          } else {
                            // VERTICALE → scala per WIDTH
                            console.log('✅ VERTICALE → scala per WIDTH')
                            setMobileImgStyle({ width: '100%', height: 'auto' })
                          }
                        }
                      }}
                      style={{ 
                        position: 'absolute', 
                        ...(projectMode === 'normale' ? {
                          // NORMALE: cover e drag X/Y
                          ...mobileImgStyle,
                          left: '50%',
                          top: '50%',
                          transform: `translate(calc(-50% + ${imageOffset.x}px), calc(-50% + ${imageOffset.y}px))`
                        } : {
                          width: '100%',
                          height: 'auto',
                          top: 0,
                          left: 0,
                          transform: `translateY(${imageOffset.y}px)`
                        }),
                        pointerEvents: 'none',
                        display: projectMode === 'cover' ? 'none' : 'block'
                      }} 
                    />
                    
                    {/* Immagine cover - solo per cover */}
                    {projectMode === 'cover' && (
                      <img src={selectedImage} draggable={false} style={{ 
                        position: 'absolute', 
                        width: '100%', 
                        height: '100%', 
                        top: 0, 
                        left: 0, 
                        objectFit: 'cover',
                        objectPosition: 'center',
                        pointerEvents: 'none',
                        display: 'block',
                        margin: 0,
                        padding: 0,
                        border: 'none',
                        boxSizing: 'border-box',
                        transform: 'scale(1.05)',
                        transformOrigin: 'center'
                      }} />
                    )}
                    {conLogo && (
                      <div style={{ position: 'absolute', bottom: `${logoConfig[selectedLogo].offsetYPercent * 100}%`, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                        <img 
                          src={`/Logo_${selectedLogo === 'formula1it' ? 'Formula1it' : 'Blogformulae'}.png`} 
                          style={{ 
                            width: `${logoConfig[selectedLogo].widthPercent * 100}%`, 
                            marginLeft: `${logoConfig[selectedLogo].offsetX}px`, 
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                          }} 
                        />
                      </div>
                    )}
                    
                    {/* Croce di centratura */}
                    {showCenterCross && (
                      <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        pointerEvents: 'none',
                        zIndex: 10
                      }}>
                        {/* Linea orizzontale */}
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: 0,
                          right: 0,
                          height: '1px',
                          background: 'rgba(255, 0, 0, 0.8)',
                          transform: 'translateY(-0.5px)'
                        }} />
                        {/* Linea verticale */}
                        <div style={{
                          position: 'absolute',
                          left: '50%',
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          background: 'rgba(255, 0, 0, 0.8)',
                          transform: 'translateX(-0.5px)'
                        }} />
                        {/* Cerchio centrale */}
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: '20px',
                          height: '20px',
                          border: '2px solid rgba(255, 0, 0, 0.8)',
                          borderRadius: '50%',
                          transform: 'translate(-50%, -50%)'
                        }} />
                      </div>
                    )}
                  </div>
                  {/* Layout responsive SOLO per mobile */}
                  {isMobile ? (
                    <>
                      {/* PRIMA RIGA: Selettore formato + tasto luminosità */}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '40px', justifyContent: 'center', alignItems: 'center' }}>
                        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ padding: '12px', borderRadius: '14px', border: '1px solid #d1d1d6', fontWeight: '800', background: '#fff', height: '45px', flex: 1, maxWidth: '150px' }}>
                          <option value="image/webp">WEBP</option>
                          <option value="image/jpeg">JPEG</option>
                        </select>
                        <button
                          onClick={() => setCanvasBackground(canvasBackground === '#000000' ? '#FFFFFF' : '#000000')}
                          style={{
                            width: '45px',
                            height: '45px',
                            borderRadius: '50%',
                            border: '2px solid #d1d1d6',
                            background: canvasBackground === '#000000' ? '#000000' : '#FFFFFF',
                            color: canvasBackground === '#000000' ? '#FFFFFF' : '#000000',
                            fontSize: '18px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {canvasBackground === '#000000' ? '🌙' : '☀️'}
                        </button>
                      </div>
                      
                      {/* SECONDA RIGA: Pulsante centro + logo */}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'center', alignItems: 'center' }}>
                        <StyledButton variant={showCenterCross ? 'success' : 'secondary'} onClick={() => { console.log('Croce clicked'); setShowCenterCross(!showCenterCross); }} style={{ minWidth: '120px', fontSize: '14px', flex: 1 }}>{showCenterCross ? 'Centro ON' : 'Centro OFF'}</StyledButton>
                        <StyledButton variant={conLogo ? 'success' : 'secondary'} onClick={() => setConLogo(!conLogo)} style={{ flex: 1 }}>{conLogo ? '➕ Logo' : '➕ Logo'}</StyledButton>
                      </div>
                      
                      {/* TERZA RIGA: Nuova foto + salva */}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'center', alignItems: 'center' }}>
                        <StyledButton variant="warning" onClick={() => fileInputRef.current.click()} style={{ flex: 1 }}>Nuova Foto</StyledButton>
                        <StyledButton variant="primary" onClick={handleSave} disabled={isSaving} style={{ flex: 1 }}>{isSaving ? '⏳...' : 'Salva'}</StyledButton>
                      </div>
                    </>
                  ) : (
                    /* Layout desktop originale */
                    <div style={{ display: 'flex', gap: '12px', marginTop: '40px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                      <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ padding: '12px', borderRadius: '14px', border: '1px solid #d1d1d6', fontWeight: '800', background: '#fff', height: '45px' }}>
                        <option value="image/webp">WEBP</option>
                        <option value="image/jpeg">JPEG</option>
                      </select>
                      <button
                        onClick={() => setCanvasBackground(canvasBackground === '#000000' ? '#FFFFFF' : '#000000')}
                        style={{
                          width: '45px',
                          height: '45px',
                          borderRadius: '50%',
                          border: '2px solid #d1d1d6',
                          background: canvasBackground === '#000000' ? '#000000' : '#FFFFFF',
                          color: canvasBackground === '#000000' ? '#FFFFFF' : '#000000',
                          fontSize: '18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {canvasBackground === '#000000' ? '🌙' : '☀️'}
                      </button>
                      <StyledButton variant={showCenterCross ? 'success' : 'secondary'} onClick={() => { console.log('Croce clicked'); setShowCenterCross(!showCenterCross); }} style={{ minWidth: '120px', fontSize: '14px' }}>{showCenterCross ? 'Centro ON' : 'Centro OFF'}</StyledButton>
                      <StyledButton variant={conLogo ? 'success' : 'secondary'} onClick={() => setConLogo(!conLogo)}>{conLogo ? '➕ Logo' : '➕ Logo'}</StyledButton>
                      <StyledButton variant="warning" onClick={() => fileInputRef.current.click()}>Nuova Foto</StyledButton>
                      <StyledButton variant="primary" onClick={handleSave} disabled={isSaving}>{isSaving ? '⏳...' : 'Salva'}</StyledButton>
                    </div>
                  )}
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

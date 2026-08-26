import { useState, useRef, useEffect } from 'react'
import { encode as encodeWebp } from '@jsquash/webp'
import piexif from 'piexifjs'
import { supabase } from './supabaseClient'
import TextOverlay, { drawTextBoxOnCanvas, createTextBox } from './TestoPost'
import GuideLines from './LineeGuida'

// CSS per nascondere la barra di scorrimento nativa nell'area zoomata (resta comunque
  // possibile scorrere con mouse/trackpad/touch, solo non si vede più la striscia grigia)
  const hideScrollbarCSS = `
    .fwm-zoom-scroll::-webkit-scrollbar { display: none; }
    .fwm-zoom-scroll { scrollbar-width: none; -ms-overflow-style: none; }
  `

// Legge automaticamente tutti i PNG dentro src/assets/overlays/ — per aggiungerne uno nuovo
// basta trascinare il file lì dentro, senza toccare il codice. Il nome del file (senza .png)
// diventa la voce nel menu di selezione.
const overlayModulesPng = import.meta.glob('/src/assets/overlays/*.png', { eager: true, import: 'default' })
const overlayModulesSvg = import.meta.glob('/src/assets/overlays/*.svg', { eager: true, import: 'default' })
const overlayModulesJpg = import.meta.glob('/src/assets/overlays/*.{jpg,jpeg}', { eager: true, import: 'default' })
const overlayModules = { ...overlayModulesPng, ...overlayModulesSvg, ...overlayModulesJpg }
const OVERLAY_GRAPHICS = Object.entries(overlayModules)
  .map(([path, url]) => {
    const filename = path.split('/').pop().replace(/\.png$/i, '')
    const label = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    return { key: filename, label, url }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

// Posizione FISSA della casella di testo per ciascuna grafica sovrapposta (chiave = "key" di
// OVERLAY_GRAPHICS, cioè il nome del file in src/assets/overlays/ senza estensione). Aggiungendo
// una nuova grafica basta aggiungere qui una nuova riga con i suoi 4 numeri: nessun if/else da
// far crescere a mano.
//
// Come trovare i numeri per una nuova grafica: seleziona quella grafica, trascina/ridimensiona
// la casella di testo dove deve stare SEMPRE per quella grafica, poi attiva temporaneamente
// SHOW_POSITION_BUTTON in TestoPost.jsx (mettilo a true), clicca "📍 Posizione" sulla casella e
// copia i 4 valori mostrati nel popup dentro una nuova riga qui sotto (usando la key giusta).
// "default" è la posizione usata quando una grafica non ha una voce dedicata.
const TESTO_POSIZIONE_PER_GRAFICA = {
  default: { sx: 62, dx: 1056, alto: 820, basso: 1225, spaziaturaRighe: 7 },
  'BREAKING NEWS.svg': { sx: 62, dx: 1041, alto: 931, basso: 1267, spaziaturaRighe: 7 },
  // esempio — aggiungi una riga così per ogni grafica:
  // 'nome-file-grafica': { sx: 40, dx: 900, alto: 700, basso: 1100, spaziaturaRighe: 7 },
}

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
  const [projectAccess, setProjectAccess] = useState({}) // { progetto_id: [username, username, ...] } — vuoto/assente = pubblico
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [selectedProjectForAccess, setSelectedProjectForAccess] = useState(null)
  const [allUsersForAccess, setAllUsersForAccess] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const [imageScale, setImageScale] = useState(1) // Zoom immagine (modalità NORMALE), 1 = riempie il frame
const [isResizing, setIsResizing] = useState(false) // true mentre si trascina un angolo per zoomare
const resizeStateRef = useRef({ corner: null, startScale: 1, startDist: 0, centerX: 0, centerY: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [gridLayout, setGridLayout] = useState('strips') // 'strips' | 'grid2x2'
  const [gridCount, setGridCount] = useState(3) // 2, 3 o 4 (solo per 'strips')
  const [gridImages, setGridImages] = useState([]) // [{ src, offset:{x,y}, scale }, ...]
  const [isGridDragging, setIsGridDragging] = useState(false)
  const [isGridResizing, setIsGridResizing] = useState(false)
  const gridFileInputRef = useRef(null)
  const gridActiveCellRef = useRef(0)
  const gridDragCellRef = useRef(null)
  const gridResizeStateRef = useRef({ cellIndex: 0, startScale: 1, startDist: 0, centerX: 0, centerY: 0 })
  const gridCellContainerRefs = useRef([])
  const [conLogo, setConLogo] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [exportFormat, setExportFormat] = useState('image/jpeg')
  const [counterWithLogo, setCounterWithLogo] = useState(1)
  const [counterWithoutLogo, setCounterWithoutLogo] = useState(1)
  const [projectMode, setProjectMode] = useState('normale') // SOLO per il menu, non tocca il sistema
  const [projectImages, setProjectImages] = useState({ normale: [], cover: [] }) // Separa le foto per progetto
  const [favoriteProjects, setFavoriteProjects] = useState([]) // Solo gli id dei preferiti
  const [favoriteProjectsData, setFavoriteProjectsData] = useState([]) // Dati completi dei preferiti
  const [showFormatsInfo, setShowFormatsInfo] = useState(false) // Popup riepilogo dimensioni di tutti i formati salvati
  const [novoNome, setNovoNome] = useState('')
  const [novoW, setNovoW] = useState(1200)
  const [novoH, setNovoH] = useState(729)
  const [showGraphicsModal, setShowGraphicsModal] = useState(false) // Modale con anteprima di ogni grafica sovrapposta
  const [graphicNotes, setGraphicNotes] = useState([]) // Elenco di note per la grafica attualmente selezionata
  const [newNoteText, setNewNoteText] = useState('') // Testo della nuova nota in scrittura
  const [showNotesModal, setShowNotesModal] = useState(false) // Solo su mobile: apre l'elenco note in un popup
  const [notesOpen, setNotesOpen] = useState(false) // Solo desktop: il fumetto è chiuso di default, si apre al click
  const [showAddNoteModal, setShowAddNoteModal] = useState(false) // Modale per scrivere una nuova nota
  const [noteSaving, setNoteSaving] = useState(false)
  const [mobileImgStyle, setMobileImgStyle] = useState({ width: '100%', height: 'auto' }) // FIX MOBILE: dimensioni immagine
  // (croce di centratura manuale rimossa: sostituita dalle linee guida blu automatiche)
  const [canvasBackground, setCanvasBackground] = useState('#000000') // Colore delle strisce del canvas
  const [textBoxes, setTextBoxes] = useState([]) // Caselle di testo (solo NORMALE/COVER)
  const [guideLines, setGuideLines] = useState([]) // Linee guida viola (solo POST SOCIAL)
  const [selectedOverlay, setSelectedOverlay] = useState(OVERLAY_GRAPHICS[0]?.key || null) // Grafica sovrapposta (solo POST SOCIAL)
  const overlayImagesRef = useRef({}) // Cache delle immagini precaricate, per l'export
  const [zoomLevel, setZoomLevel] = useState(1) // Zoom "vero" dell'area di lavoro (1 = 100%), gestito da noi
  const [showRulers, setShowRulers] = useState(true) // Righelli fissi (visibili solo in POST SOCIAL)
  const zoomViewportRef = useRef(null) // il "riquadro" visibile che scorre (dimensione fissa)
  const innerScrollRef = useRef(null) // l'area INTERNA che scorre davvero, quando sei zoomato
  const pinchStateRef = useRef({ startDist: 0, startZoom: 1 }) // per il pinch-to-zoom a due dita
  // Solo admin o l'utente "vcancelliere" possono aggiungere/spostare le linee guida
  const canEditGuides = user?.ruolo === 'admin' || !!(user?.permessi_speciali && user.permessi_speciali.linee_guida)
  console.log('DEBUG utente:', user)

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

  const zoomedWidth = containerWidth * zoomLevel // dimensione REALE (non visiva) del contenuto quando sei zoomato
  const zoomedHeight = containerHeight * zoomLevel
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 }) // per far seguire i righelli allo scorrimento
  const [photoSnapGuides, setPhotoSnapGuides] = useState({ v: false, h: false }) // linee blu di centraggio automatico della foto

  // Quando torni al 100% (o comunque a un livello dove non c'è più nulla da scorrere), il
  // browser a volte mantiene "congelata" l'ultima posizione di scorrimento anche se il
  // contenuto è tornato piccolo — lasciando visibile una zona vuota/nera di troppo. Qui la
  // azzeriamo esplicitamente ogni volta che lo zoom torna a 1.
  useEffect(() => {
    if (zoomLevel <= 1 && innerScrollRef.current) {
      innerScrollRef.current.scrollLeft = 0
      innerScrollRef.current.scrollTop = 0
      setScrollOffset({ x: 0, y: 0 })
    }
  }, [zoomLevel])

  // Ricalcola le proporzioni della foto (per riempire la cornice senza fasce nere) ogni volta
  // che cambia lo spazio disponibile — non solo quando la foto viene caricata la prima volta.
  useEffect(() => {
    if (!containerRef.current) return
    if (projectMode !== 'normale' && projectMode !== 'postsocial') return
    const imgEl = containerRef.current.querySelector('img')
    if (!imgEl || !imgEl.naturalWidth) return
    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight
    const containerAspect = containerWidth / containerHeight
    if (imgAspect > containerAspect) {
      setMobileImgStyle({ width: 'auto', height: '100%' })
    } else {
      setMobileImgStyle({ width: '100%', height: 'auto' })
    }
  }, [containerWidth, containerHeight, projectMode, selectedImage])

  // Riscala PROPORZIONALMENTE anche lo spostamento della foto (imageOffset) quando cambia la
  // dimensione della finestra. Senza questo, uno spostamento fatto trascinando su schermo grande
  // resta in pixel fissi: su uno schermo molto più piccolo, lo stesso valore in pixel diventa
  // enorme in proporzione e spinge la foto quasi fuori dalla cornice (causa della fascia nera).
  // Confrontiamo pixel INTERI arrotondati (non il numero decimale grezzo) per evitare che
  // micro-variazioni impercettibili nel calcolo (che capitano ad ogni piccolo re-render)
  // facciano scattare inutilmente il ricalcolo, accumulando piccole derive nel tempo.
  const prevContainerWidthRef = useRef(Math.round(containerWidth))
  useEffect(() => {
    const roundedNow = Math.round(containerWidth)
    const prevRounded = prevContainerWidthRef.current
    if (prevRounded && prevRounded !== roundedNow && prevRounded > 0) {
      const ratio = roundedNow / prevRounded
      setImageOffset(prev => applyBounds(prev.x * ratio, prev.y * ratio))
    }
    prevContainerWidthRef.current = roundedNow
  }, [containerWidth])

  // Rotellina del mouse (o pinch a due dita sul trackpad, che il browser riporta come "wheel"
  // con ctrlKey attivo) = zoom "vero" dell'area di lavoro. Lo scorrimento normale a due dita
  // NON viene intercettato: passa naturalmente al contenitore con overflow:auto qui sotto.
  useEffect(() => {
    const el = zoomViewportRef.current
    if (!el) return
    const handleWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoomLevel((z) => {
        const next = z - e.deltaY * 0.0015
        return Math.min(4, Math.max(1, next))
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [selectedImage, projectMode, view])

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

    // Precarica tutte le grafiche sovrapposte (per l'export ad alta risoluzione)
    OVERLAY_GRAPHICS.forEach((g) => {
      const im = new Image()
      im.src = g.url
      im.onload = () => {
        overlayImagesRef.current[g.key] = im
        console.log('DEBUG OVERLAY - caricata:', g.key, g.url, 'dimensioni:', im.naturalWidth, 'x', im.naturalHeight)
      }
      im.onerror = (err) => {
        console.error('DEBUG OVERLAY - ERRORE caricamento:', g.key, g.url, err)
      }
    })
    
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
      if (data) {
        const ids = data.map(p => p.project_id);
        setFavoriteProjects(ids);
        if (ids.length > 0) {
          // Carica i dati completi dei progetti preferiti
          const { data: progettiData } = await supabase
            .from('progetti_dimensioni')
            .select('*')
            .in('id', ids);
          setFavoriteProjectsData(progettiData || []);
        } else {
          setFavoriteProjectsData([]);
        }
      }
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
      .limit(200) // pool ampio: praticamente tutti i progetti salvati, non solo gli ultimi
    if (!data) return

    const { data: accessData } = await supabase.from('progetto_accessi').select('*')
    const accessMap = {}
    ;(accessData || []).forEach((a) => {
      if (!accessMap[a.progetto_id]) accessMap[a.progetto_id] = []
      accessMap[a.progetto_id].push(a.username)
    })
    setProjectAccess(accessMap)

    const isAdmin = user?.ruolo === 'admin'
    const visible = isAdmin
      ? data
      : data.filter((p) => {
          const restricted = accessMap[p.id] && accessMap[p.id].length > 0
          return !restricted || accessMap[p.id].includes(user?.username)
        })
    setRecentProjects(visible) // mostra TUTTI i progetti visibili, non più tagliati a 6
  }

  const fetchAllUsersForAccess = async () => {
    const { data } = await supabase.from('utenti').select('username, nome_completo').order('nome_completo')
    setAllUsersForAccess(data || [])
  }

  const grantProjectAccess = async (progettoId, username) => {
    const { error } = await supabase.from('progetto_accessi').insert([{ progetto_id: progettoId, username }])
    if (!error) {
      setProjectAccess((prev) => ({ ...prev, [progettoId]: [...(prev[progettoId] || []), username] }))
    }
  }

  const revokeProjectAccess = async (progettoId, username) => {
    setProjectAccess((prev) => ({ ...prev, [progettoId]: (prev[progettoId] || []).filter((u) => u !== username) }))
    await supabase.from('progetto_accessi').delete().eq('progetto_id', progettoId).eq('username', username)
  }

  // --- LINEE GUIDA (solo POST SOCIAL) — ora specifiche per GRAFICA attiva, non solo per
  // dimensioni: cambiando grafica (selectedOverlay) cambiano anche le linee mostrate.
  const fetchGuideLines = async (width, height, overlayKey) => {
    let query = supabase.from('linee_guida_post').select('*').eq('width', width).eq('height', height)
    query = overlayKey ? query.eq('overlay_key', overlayKey) : query.is('overlay_key', null)
    const { data, error } = await query
    if (!error && data) {
      setGuideLines(data.map(d => ({ id: d.id, orientation: d.orientation, position: Number(d.position) })))
    } else {
      setGuideLines([])
    }
  }

  const addGuideLine = async (orientation) => {
    if (!canEditGuides) return
    const position = orientation === 'h' ? Math.round(dimensions.height / 2) : Math.round(dimensions.width / 2)
    const { data, error } = await supabase
      .from('linee_guida_post')
      .insert([{ width: dimensions.width, height: dimensions.height, orientation, position, overlay_key: selectedOverlay }])
      .select()
    if (!error && data && data[0]) {
      setGuideLines(prev => [...prev, { id: data[0].id, orientation, position }])
    }
  }

  const deleteGuideLine = async (id) => {
    if (!canEditGuides) return
    setGuideLines(prev => prev.filter(l => l.id !== id))
    await supabase.from('linee_guida_post').delete().eq('id', id)
  }

  const persistGuideLinePosition = async (id) => {
    if (!canEditGuides) return
    const line = guideLines.find(l => l.id === id)
    if (!line) return
    await supabase.from('linee_guida_post').update({ position: Math.round(line.position) }).eq('id', id)
  }

  // --- NOTE legate alla grafica attiva (es. dimensioni consigliate, promemoria...) ---
  // Ora sono un ELENCO: se ne possono aggiungere quante se ne vuole per ciascuna grafica.
  const fetchGraphicNotes = async (width, height, overlayKey) => {
    let query = supabase.from('note_grafiche_post').select('*').eq('width', width).eq('height', height)
    query = overlayKey ? query.eq('overlay_key', overlayKey) : query.is('overlay_key', null)
    const { data, error } = await query.order('updated_at', { ascending: true })
    console.log('DEBUG NOTE - fetch:', { width, height, overlayKey, data, error })
    setGraphicNotes(!error && data ? data : [])
  }

  const addGraphicNote = async (text) => {
    if (!canEditGuides || !text.trim()) return
    setNoteSaving(true)
    const payload = { width: dimensions.width, height: dimensions.height, overlay_key: selectedOverlay, testo: text.trim(), username: user?.username || null, updated_at: new Date().toISOString() }
    console.log('DEBUG NOTE - aggiungo:', payload)
    const { data, error } = await supabase.from('note_grafiche_post').insert([payload]).select()
    console.log('DEBUG NOTE - risultato aggiunta:', { data, error })
    if (error) {
      alert('Errore nell\'aggiungere la nota: ' + error.message)
      setNoteSaving(false)
      return
    }
    if (data && data[0]) setGraphicNotes(prev => [...prev, data[0]])
    setNewNoteText('')
    setNoteSaving(false)
    setShowAddNoteModal(false)
  }

  const deleteGraphicNote = async (id) => {
    if (!canEditGuides) return
    setGraphicNotes(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from('note_grafiche_post').delete().eq('id', id)
    if (error) console.log('DEBUG NOTE - errore cancellazione:', error)
  }

  // Carica linee guida e note ogni volta che si entra nell'editor di un progetto POST SOCIAL,
  // O CAMBIA LA GRAFICA ATTIVA (selectedOverlay è ora tra le dipendenze) — così cambiando
  // grafica cambiano automaticamente anche le linee e le note mostrate.
  useEffect(() => {
    if (projectMode === 'postsocial' && view === 'editor' && dimensions.width && dimensions.height) {
      fetchGuideLines(dimensions.width, dimensions.height, selectedOverlay)
      fetchGraphicNotes(dimensions.width, dimensions.height, selectedOverlay)
    }
  }, [projectMode, view, dimensions.width, dimensions.height, selectedOverlay])

  // Se si cambia grafica mentre c'è ANCORA solo la casella di testo di default (nessun'altra
  // casella aggiunta a mano), la riposiziona secondo TESTO_POSIZIONE_PER_GRAFICA per la nuova
  // grafica — così "casella si sposta da sola cambiando grafica" senza toccare caselle extra
  // che l'utente ha aggiunto manualmente.
  useEffect(() => {
    if (projectMode === 'postsocial' && view === 'editor' && textBoxes.length === 1) {
      const posCfg = TESTO_POSIZIONE_PER_GRAFICA[selectedOverlay] || TESTO_POSIZIONE_PER_GRAFICA.default
      const s = displayScale || 1
      const larghezza = posCfg.dx - posCfg.sx
      const altezza = posCfg.basso - posCfg.alto
      setTextBoxes(([box]) => [{
        ...box,
        x: posCfg.sx * s,
        y: posCfg.alto * s,
        width: Math.max(60, larghezza * s),
        height: Math.max(30, altezza * s),
        lineGapPx: posCfg.spaziaturaRighe * s
      }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOverlay])

  const startNewProject = async (width, height, nome) => {
    if (projectMode === 'griglia') {
      setGridImages([])
    } else if (projectMode === 'postsocial') {
      // Mantieni la modalità Post Social, nessun reset necessario
    } else {
      setProjectMode('normale')
    }
    width = parseInt(width)
    height = parseInt(height)
    if (!width || !height || width < 100 || height < 100) {
      setFeedback('⚠️ Inserisci dimensioni valide (minimo 100px)')
      setTimeout(() => setFeedback(''), 4000)
      return
    }
    const projectName = nome.trim() || `${width}x${height}`
    
    // Aggiunge "COVER", "GRIGLIA" o "POST SOCIAL" al nome in base alla modalità
    const finalProjectName = projectMode === 'cover' && !projectName.toLowerCase().includes('cover') 
      ? `${projectName} - COVER` 
      : projectMode === 'griglia' && !projectName.toLowerCase().includes('griglia')
        ? `${projectName} - GRIGLIA-${gridLayout === 'grid2x2' ? '2X2' : gridCount}`
        : projectMode === 'postsocial' && !projectName.toLowerCase().includes('post social')
          ? `${projectName} - POST SOCIAL`
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
    if (projectMode === 'griglia') return // In GRIGLIA si carica dalle singole celle, non da qui
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Salva l'immagine nel progetto corretto
        setProjectImages(prev => ({
          ...prev,
          [projectMode]: [...(prev[projectMode] || []), e.target.result]
        }))
        setSelectedImage(e.target.result)
        
        // Reset offset, zoom, style mobile e testo
        setImageOffset({ x: 0, y: 0 })
        setImageScale(1)
        setMobileImgStyle({ width: '100%', height: 'auto' })
        if (projectMode === 'postsocial') {
          // Quattro "punti" (in PIXEL REALI dell'immagine finale, non dello schermo) che
          // definiscono i bordi della casella di testo — presi dalla configurazione
          // TESTO_POSIZIONE_PER_GRAFICA in base alla grafica attualmente selezionata, con
          // fallback su "default" se questa grafica non ha ancora una voce dedicata.
          const posCfg = TESTO_POSIZIONE_PER_GRAFICA[selectedOverlay] || TESTO_POSIZIONE_PER_GRAFICA.default
          const TESTO_SX_REALE = posCfg.sx
const TESTO_DX_REALE = posCfg.dx  // oppure: dimensions.width - posCfg.sx
const TESTO_ALTO_REALE = posCfg.alto
const TESTO_BASSO_REALE = posCfg.basso
          const SPAZIATURA_RIGHE_PX = posCfg.spaziaturaRighe   // px reali fissi extra tra una riga e l'altra

          const TESTO_LARGHEZZA_REALE = TESTO_DX_REALE - TESTO_SX_REALE
          const TESTO_ALTEZZA_REALE = TESTO_BASSO_REALE - TESTO_ALTO_REALE

          setTextBoxes([createTextBox({
            x: TESTO_SX_REALE * displayScale,
            y: TESTO_ALTO_REALE * displayScale,
            width: Math.max(60, TESTO_LARGHEZZA_REALE * displayScale),
            height: Math.max(30, TESTO_ALTEZZA_REALE * displayScale),
            lineGapPx: SPAZIATURA_RIGHE_PX * displayScale,
            locked: true // la casella di default è già bloccata all'apertura del progetto
          })])
        } else {
          setTextBoxes([])
        }
        
        setView('editor')
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  // Pulisce le foto quando si cambia modalità progetto
  // Nome "pulito" da mostrare all'utente (nasconde i suffissi tecnici -COVER/-GRIGLIA-N usati per il riconoscimento)
  const getDisplayName = (nome) => {
    if (!nome) return 'Senza Nome'
    const cleaned = nome
      .replace(/\s*-\s*GRIGLIA-(2X2|\d)\s*$/i, '')
      .replace(/\s*-\s*COVER\s*$/i, '')
      .replace(/\s*-\s*POST SOCIAL\s*$/i, '')
      .trim()
    return cleaned || nome
  }

  const handleModeChange = (newMode) => {
    setProjectMode(newMode)
    setSelectedImage(null) // Pulisce l'immagine corrente
    setImageOffset({ x: 0, y: 0 })
    setImageScale(1)
    setGridImages([])
    setTextBoxes([])
  }

  // --- GRIGLIA: caricamento foto per singola cella ---
  const processGridFile = (file, cellIndex) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setGridImages(prev => {
        const next = [...prev]
        next[cellIndex] = { src: e.target.result, offset: { x: 0, y: 0 }, scale: 1, fitStyle: { width: '100%', height: 'auto' } }
        return next
      })
    }
    reader.readAsDataURL(file)
  }

  // --- GRIGLIA: taglio diagonale per le strisce (stile magazine/Canva), con spessore fisso in px come la 2x2 ---
  const getStripClipPath = (i, total, cellWidthPx, slantPct = 0.6, gapPx = 0.6) => {
    const isFirst = i === 0
    const isLast = i === total - 1
    const gapPct = cellWidthPx > 0 ? (gapPx / cellWidthPx) * 100 : 0
    const leftTop = isFirst ? 0 : slantPct + gapPct / 2
    const leftBottom = isFirst ? 0 : gapPct / 2
    const rightTop = isLast ? 100 : 100 - gapPct / 2
    const rightBottom = isLast ? 100 : (100 - slantPct) - gapPct / 2
    return `polygon(${leftTop}% 0%, ${rightTop}% 0%, ${rightBottom}% 100%, ${leftBottom}% 100%)`
  }

  // --- GRIGLIA: bounds di trascinamento per singola cella ---
  const applyGridBounds = (cellIndex, newX, newY, scale) => {
    const cellEl = gridCellContainerRefs.current[cellIndex]
    if (!cellEl) return { x: newX, y: newY }
    const imgEl = cellEl.querySelector('img')
    if (!imgEl) return { x: newX, y: newY }
    const cellW = cellEl.clientWidth
    const cellH = cellEl.clientHeight
    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight
    const cellAspect = cellW / cellH
    let actualW, actualH
    if (imgAspect > cellAspect) {
      actualH = cellH * scale
      actualW = actualH * imgAspect
    } else {
      actualW = cellW * scale
      actualH = actualW / imgAspect
    }
    const maxX = Math.max(0, (actualW - cellW) / 2)
    const maxY = Math.max(0, (actualH - cellH) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, newX)), y: Math.min(maxY, Math.max(-maxY, newY)) }
  }

  const startGridDrag = (i) => {
    gridDragCellRef.current = i
    setIsGridDragging(true)
  }
  const stopGridDrag = () => {
    gridDragCellRef.current = null
    setIsGridDragging(false)
  }

  // --- GRIGLIA: zoom trascinando l'angolo della cella ---
  const startGridCornerResize = (e, cellIndex) => {
    e.stopPropagation()
    e.preventDefault()
    const cellEl = gridCellContainerRefs.current[cellIndex]
    if (!cellEl) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const rect = cellEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startDist = Math.hypot(clientX - centerX, clientY - centerY) || 1
    const startScale = gridImages[cellIndex]?.scale || 1
    gridResizeStateRef.current = { cellIndex, startScale, startDist, centerX, centerY }
    setIsGridResizing(true)
  }

  useEffect(() => {
    if (!isGridResizing) return
    const handleMove = (e) => {
      e.preventDefault()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const { cellIndex, startScale, startDist, centerX, centerY } = gridResizeStateRef.current
      const newDist = Math.hypot(clientX - centerX, clientY - centerY)
      const ratio = newDist / startDist
      const newScale = Math.min(5, Math.max(1, startScale * ratio))
      setGridImages(prev => {
        const next = [...prev]
        const g = next[cellIndex]
        if (!g) return prev
        const bounded = applyGridBounds(cellIndex, g.offset.x, g.offset.y, newScale)
        next[cellIndex] = { ...g, scale: newScale, offset: bounded }
        return next
      })
    }
    const stop = () => setIsGridResizing(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', stop)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', stop)
    }
  }, [isGridResizing])

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

  // Applica bounds per NORMALE (drag X/Y). "scale" = zoom corrente (default: quello in stato)
  const applyBounds = (newX, newY, scale = imageScale) => {
    if (!containerRef.current) return { x: newX, y: newY }
    const imgElement = containerRef.current.querySelector('img')
    if (!imgElement) return { x: newX, y: newY }

    if (projectMode === 'cover') {
      return { x: 0, y: 0 }
    }

    const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight
    const containerAspect = containerWidth / containerHeight

    let actualImgHeight, actualImgWidth

    if (imgAspect > containerAspect) {
      actualImgHeight = containerHeight * scale
      actualImgWidth = actualImgHeight * imgAspect
    } else {
      actualImgWidth = containerWidth * scale
      actualImgHeight = actualImgWidth / imgAspect
    }

    const maxOffsetX = Math.max(0, (actualImgWidth - containerWidth) / 2)
    const maxOffsetY = Math.max(0, (actualImgHeight - containerHeight) / 2)

    const boundedX = Math.min(maxOffsetX, Math.max(-maxOffsetX, newX))
    const boundedY = Math.min(maxOffsetY, Math.max(-maxOffsetY, newY))

    return { x: boundedX, y: boundedY }
  }

  // --- Zoom trascinando gli angoli (stile Canva) ---
  const startCornerResize = (e, corner) => {
    e.stopPropagation()
    e.preventDefault()
    if (!containerRef.current) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startDist = Math.hypot(clientX - centerX, clientY - centerY) || 1
    resizeStateRef.current = { corner, startScale: imageScale, startDist, centerX, centerY }
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMove = (e) => {
      e.preventDefault()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const { startScale, startDist, centerX, centerY } = resizeStateRef.current
      const newDist = Math.hypot(clientX - centerX, clientY - centerY)
      const ratio = newDist / startDist
      const newScale = Math.min(5, Math.max(1, startScale * ratio))
      setImageScale(newScale)
      setImageOffset(prev => applyBounds(prev.x, prev.y, newScale))
    }

    const stopResize = () => setIsResizing(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', stopResize)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', stopResize)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', stopResize)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', stopResize)
    }
  }, [isResizing])

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    processFile(file)
  }

  // --- GRIGLIA: export ad alta risoluzione ---
  const handleSaveGrid = () => {
    const cellsCount = gridLayout === 'grid2x2' ? 4 : gridCount
    const filled = gridImages.slice(0, cellsCount).filter(Boolean).length
    if (filled < cellsCount) {
      setFeedback('⚠️ Carica tutte le foto della griglia prima di salvare')
      setTimeout(() => setFeedback(''), 4000)
      return
    }
    setIsSaving(true)

    const cols = gridLayout === 'grid2x2' ? 2 : cellsCount
    const rows = gridLayout === 'grid2x2' ? 2 : 1
    const gapPx = 6

    const loadImg = (src) => new Promise((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = src
    })

    Promise.all(gridImages.slice(0, cellsCount).map(g => loadImg(g.src)))
      .then((loadedImages) => {
        const canvas = document.createElement('canvas')
        canvas.width = dimensions.width
        canvas.height = dimensions.height
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const cellW = (canvas.width - gapPx * (cols - 1)) / cols
        const cellH = (canvas.height - gapPx * (rows - 1)) / rows
        const screenCellW = (containerWidth - gapPx * (cols - 1)) / cols
        const screenCellH = (containerHeight - gapPx * (rows - 1)) / rows

        loadedImages.forEach((im, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          const cellX = col * (cellW + gapPx)
          const cellY = row * (cellH + gapPx)

          const g = gridImages[i]
          const imgAspect = im.width / im.height
          const cellAspect = cellW / cellH

          let drawW, drawH, scaleToCanvas
          if (imgAspect > cellAspect) {
            drawH = cellH * g.scale
            drawW = drawH * imgAspect
            scaleToCanvas = cellH / screenCellH
          } else {
            drawW = cellW * g.scale
            drawH = drawW / imgAspect
            scaleToCanvas = cellW / screenCellW
          }

          const baseX = cellX + (cellW - drawW) / 2
          const baseY = cellY + (cellH - drawH) / 2
          const offsetX = g.offset.x * scaleToCanvas
          const offsetY = g.offset.y * scaleToCanvas

          ctx.save()
          ctx.beginPath()
          ctx.rect(cellX, cellY, cellW, cellH)
          ctx.clip()
          ctx.drawImage(im, baseX + offsetX, baseY + offsetY, drawW, drawH)
          ctx.restore()
        })

        if (conLogo && logosRef.current[selectedLogo]) {
          const logoImg = logosRef.current[selectedLogo]
          const config = logoConfig[selectedLogo]
          const lW = dimensions.width * config.widthPercent
          const lH = (logoImg.height / logoImg.width) * lW
          const lX = (dimensions.width - lW) / 2 + config.offsetX
          const lY = dimensions.height - lH - Math.round(dimensions.height * config.offsetYPercent)
          ctx.drawImage(logoImg, lX, lY, lW, lH)
        }

        const ext = exportFormat === 'image/webp' ? 'webp' : (exportFormat === 'image/png' ? 'png' : 'jpg')
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
          if (conLogo) setCounterWithLogo(counterWithLogo + 1)
          else setCounterWithoutLogo(counterWithoutLogo + 1)
          setFeedback(`Esportato: ${ext.toUpperCase()}`)
          setIsSaving(false)
          setTimeout(() => setFeedback(''), 4000)
        }

        exportWithDpi().catch((err) => {
          console.error('Errore export griglia:', err)
          setFeedback('❌ Errore export')
          setIsSaving(false)
          setTimeout(() => setFeedback(''), 4000)
        })
      })
      .catch((err) => {
        console.error('Errore caricamento immagini griglia:', err)
        setFeedback('❌ Errore caricamento immagini')
        setIsSaving(false)
        setTimeout(() => setFeedback(''), 4000)
      })
  }

  const handleSave = () => {
    if (projectMode === 'griglia') {
      handleSaveGrid()
      return
    }
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
          // Immagine più larga: scala per altezza (+ zoom)
          drawH = canvas.height * imageScale
          drawW = drawH * imgAspect
          scaleToCanvas = canvas.height / containerHeight
        } else {
          // Immagine più alta: scala per larghezza (+ zoom)
          drawW = canvas.width * imageScale
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

     // --- GRAFICA SOVRAPPOSTA + TESTO (solo POST SOCIAL) ---
      if (projectMode === 'postsocial') {
        console.log('DEBUG EXPORT - textBoxes:', textBoxes)
        console.log('DEBUG EXPORT - displayScale:', displayScale)
        console.log('DEBUG EXPORT OVERLAY - selectedOverlay:', selectedOverlay)
        console.log('DEBUG EXPORT OVERLAY - immagine in cache?', !!overlayImagesRef.current[selectedOverlay])
        if (selectedOverlay && overlayImagesRef.current[selectedOverlay]) {
          try {
            ctx.drawImage(overlayImagesRef.current[selectedOverlay], 0, 0, canvas.width, canvas.height)
            console.log('DEBUG EXPORT OVERLAY - disegnata con successo')
          } catch (err) {
            console.error('DEBUG EXPORT OVERLAY - ERRORE nel disegnare:', err)
          }
        } else {
          console.warn('DEBUG EXPORT OVERLAY - saltata: nessuna grafica selezionata o non ancora caricata in cache')
        }
        textBoxes.forEach(box => {
          console.log('DEBUG EXPORT - disegno box:', box.id, 'testo:', JSON.stringify(box.text))
          try {
            drawTextBoxOnCanvas(ctx, box, displayScale)
          } catch (err) {
            console.error('DEBUG EXPORT - ERRORE nel disegnare il box:', box.id, err)
          }
        })
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
      
      const ext = exportFormat === 'image/webp' ? 'webp' : (exportFormat === 'image/png' ? 'png' : 'jpg')
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
        setFeedback(`Esportato: ${ext.toUpperCase()}`)
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

  const [showAddMenu, setShowAddMenu] = useState(false)

  const addMenuItemStyle = {
    padding: '10px 14px', borderRadius: '8px', border: 'none', background: 'transparent',
    color: '#1c1c1e', fontSize: '13px', fontWeight: '700', cursor: 'pointer', textAlign: 'left',
    display: 'flex', alignItems: 'center', gap: '8px', width: '100%'
  }

  // Menu unico "+ Aggiungi" che raggruppa testo e linee guida, per non affollare la barra
  // di pulsanti separati.
  const AddMenuButton = ({ vertical = true }) => (
    <div style={{ position: 'relative', width: vertical ? '100%' : 'auto' }}>
      <ToolIconButton icon="➕" label="Elementi" active={showAddMenu} onClick={() => setShowAddMenu(v => !v)} vertical={vertical} />
      {showAddMenu && (
        <>
          <div onClick={() => setShowAddMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px',
            background: '#fff', borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '190px', zIndex: 100
          }}>
            <button
              onClick={() => {
                setTextBoxes([...textBoxes, createTextBox({
                  x: Math.max(20, containerWidth / 2 - 150),
                  y: Math.max(20, containerHeight / 2 - 30),
                  width: Math.min(300, Math.max(120, containerWidth - 40))
                })])
                setShowAddMenu(false)
              }}
              style={addMenuItemStyle}
            >
               Casella di testo
            </button>
            {canEditGuides && (
              <>
                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
                <button onClick={() => { addGuideLine('h'); setShowAddMenu(false) }} style={addMenuItemStyle}>
                   Linea guida orizzontale
                </button>
                <button onClick={() => { addGuideLine('v'); setShowAddMenu(false) }} style={addMenuItemStyle}>
                   Linea guida verticale
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )

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

  // Pulsante minimal in stile Canva: icona sopra, etichetta sotto, nessun bordo pesante — si
  // colora solo quando è "attivo". Usato nel menu strumenti (verticale su desktop, orizzontale
  // su mobile). "vertical" controlla se il layout interno del pulsante è a colonna (icona sopra
  // etichetta, per la barra verticale desktop) o riga stretta (per la barra orizzontale mobile).
  const ToolIconButton = ({ icon, label, onClick, active = false, vertical = true }) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: vertical ? '4px' : '8px',
        padding: vertical ? '10px 6px' : '12px 16px',
        borderRadius: '14px',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'rgba(0,122,255,0.12)' : 'transparent',
        color: active ? '#007AFF' : '#1c1c1e',
        width: vertical ? '100%' : 'auto',
        flexShrink: 0,
        transition: 'background 0.15s ease'
      }}
    >
      <span style={{ fontSize: vertical ? '18px' : '22px', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: vertical ? '10px' : '14px', fontWeight: '700', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )

  // Contenuto dell'elenco note: lista + campo per aggiungerne di nuove (se hai i permessi).
  // Riutilizzato sia nel fumetto sempre visibile su desktop, sia nel popup su mobile.
  const renderNotesList = () => (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', marginBottom: canEditGuides ? '10px' : 0 }}>
        {graphicNotes.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#8e8e93', margin: 0 }}>Nessuna nota per questa grafica.</p>
        ) : (
          graphicNotes.map((n) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f2f2f7', padding: '10px 12px', borderRadius: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '13px', color: '#1c1c1e', whiteSpace: 'pre-wrap' }}>{n.testo}</span>
                {n.username && (
                  <span style={{ display: 'block', fontSize: '10px', color: '#8e8e93', marginTop: '4px', fontWeight: '700' }}>— @{n.username}</span>
                )}
              </div>
              {canEditGuides && (
                <button onClick={() => deleteGraphicNote(n.id)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: '14px', padding: 0, flexShrink: 0 }}>✕</button>
              )}
            </div>
          ))
        )}
      </div>
      {canEditGuides && (
        <button
          onClick={() => { setNewNoteText(''); setShowAddNoteModal(true) }}
          style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: '#007AFF', color: '#fff', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
        >
          + Aggiungi nota
        </button>
      )}
    </>
  )

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
            <div style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '8px', textAlign: 'left' }}>Progetti Condivisi</h2>
              <p style={{ fontSize: '13px', color: '#8e8e93', marginBottom: '30px', textAlign: 'left' }}>Riprendi un formato salvato, o creane uno nuovo qui sotto.</p>

              {(() => {
                const iconaTipo = (nome) => {
                  const n = (nome || '').toLowerCase()
                  if (n.includes('griglia')) return { colore: '#5856D6' }
                  if (n.includes('post social')) return { colore: '#007AFF' }
                  if (n.includes('cover')) return { colore: '#FF3B30' }
                  return { colore: '#34C759' }
                }
                const apriProgetto = (p) => {
                  setDimensions({ width: p.width, height: p.height })
                  setView('editor')
                  const nomeLower = (p.nome || '').toLowerCase()
                  if (nomeLower.includes('griglia')) {
                    setProjectMode('griglia')
                    setGridImages([])
                    if (nomeLower.includes('2x2')) {
                      setGridLayout('grid2x2')
                    } else {
                      setGridLayout('strips')
                      const match = nomeLower.match(/griglia/)
                      setGridCount(match ? parseInt(match[1]) : 3)
                    }
                  } else if (nomeLower.includes('post social')) {
                    setProjectMode('postsocial')
                  } else {
                    setProjectMode(nomeLower.includes('cover') ? 'cover' : 'normale')
                  }
                }

                const RigaOrizzontale = ({ titolo, coloreTitolo, progetti, mostraStella, mostraElimina }) => (
                  <div style={{ marginBottom: '28px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: coloreTitolo || '#8e8e93', display: 'block', marginBottom: '12px', textAlign: 'left' }}>{titolo}</label>
                    <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px' }}>
                      {progetti.map((p, i) => {
                        const icona = iconaTipo(p.nome)
                        const preferito = favoriteProjects.includes(p.id)
                        return (
                          <div
                            key={i}
                            onClick={() => apriProgetto(p)}
                            style={{
                              cursor: 'pointer', flexShrink: 0, width: '160px', padding: '16px',
                              background: '#fff', borderRadius: '16px', border: `2px solid ${icona.colore}`,
                              boxShadow: '0 2px 10px rgba(0,0,0,0.06)', position: 'relative', textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginBottom: '10px' }}>
                              {mostraStella && (
                                <span onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id) }} style={{ cursor: 'pointer', display: 'flex' }}>
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill={preferito ? '#FFD600' : 'none'} stroke={preferito ? '#FFD600' : '#C7C7CC'} strokeWidth="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                </span>
                              )}
                              {mostraElimina && (
                                <span onClick={(e) => deleteProject(e, p.id)} style={{ fontSize: '15px', color: '#FF3B30', fontWeight: 'bold', cursor: 'pointer' }}>✕</span>
                              )}
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '13px', color: '#1c1c1e', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getDisplayName(p.nome)}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: icona.colore }}>
                              {p.width} × {p.height}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )

                return (
                  <>
                    {favoriteProjectsData.length > 0 && (
                      <RigaOrizzontale titolo="PREFERITI" coloreTitolo="#FF3B30" progetti={favoriteProjectsData} mostraStella />
                    )}
                    {recentProjects.filter(p => !favoriteProjects.includes(p.id)).length > 0 && (
                      <RigaOrizzontale titolo="ALTRI PROGETTI" progetti={recentProjects.filter(p => !favoriteProjects.includes(p.id))} mostraStella mostraElimina />
                    )}
                    {recentProjects.length === 0 && (
                      <p style={{ color: '#c7c7cc', fontSize: '14px', textAlign: 'left', marginBottom: '20px' }}>Nessun formato salvato ancora.</p>
                    )}
                  </>
                )
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '14px' }}>
                {user?.ruolo === 'admin' && (
                  <button
                    onClick={() => { setShowAccessModal(true); setSelectedProjectForAccess(null); fetchAllUsersForAccess() }}
                    title="Gestisci a chi è visibile ogni progetto (solo admin)"
                    style={{
                      width: '26px', height: '26px', borderRadius: '50%', border: '1.5px solid #FF9500',
                      background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FF9500" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="10.5" width="16" height="10" rx="2" />
                      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setShowFormatsInfo(true)}
                  title="Vedi le dimensioni di tutti i formati salvati"
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%', border: '1.5px solid #007AFF',
                    background: 'transparent', color: '#007AFF', fontSize: '13px', fontWeight: '800',
                    fontFamily: '-apple-system, sans-serif', fontStyle: 'normal', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0
                  }}
                >
                  i
                </button>
              </div>

              <div style={{ background: '#fff', padding: '32px', borderRadius: '24px', textAlign: 'left', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px' }}>Crea nuovo progetto</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '26px' }}>
                  {[
                    { val: 'normale', label: 'Normale', colore: '#34C759' },
                    { val: 'cover', label: 'Cover', colore: '#FF3B30' },
                    { val: 'griglia', label: 'Griglia', colore: '#5856D6' },
                    { val: 'postsocial', label: 'Post Social', colore: '#007AFF' },
                  ].map(m => (
                    <button
                      key={m.val}
                      onClick={() => handleModeChange(m.val)}
                      style={{
                        padding: '28px 16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                        border: `2px solid ${projectMode === m.val ? m.colore : '#E9ECEF'}`,
                        background: projectMode === m.val ? `${m.colore}14` : '#fff',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: '800', fontSize: '13px', color: projectMode === m.val ? m.colore : '#1c1c1e' }}>{m.label}</div>
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px' }}>NOME PROGETTO</label>
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  type="text" placeholder="Es: Post Facebook"
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '20px', boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', gap: '16px', marginBottom: '26px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px' }}>LARGHEZZA (PX)</label>
                    <input
                      value={novoW}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') { setNovoW(''); return }
                        const n = parseInt(val, 10)
                        setNovoW(Number.isNaN(n) ? '' : Math.max(0, n)) // mai negativo
                      }}
                      type="number"
                      min="1"
                      style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', display: 'block', marginBottom: '8px' }}>ALTEZZA (PX)</label>
                    <input
                      value={novoH}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') { setNovoH(''); return }
                        const n = parseInt(val, 10)
                        setNovoH(Number.isNaN(n) ? '' : Math.max(0, n)) // mai negativo
                      }}
                      type="number"
                      min="1"
                      style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <StyledButton fullWidth onClick={() => startNewProject(novoW, novoH, novoNome)}>SALVA</StyledButton>
              </div>

              {showFormatsInfo && (
                <div
                  onClick={() => setShowFormatsInfo(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                >
                  <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '17px' }}>Dimensioni formati salvati</h3>
                      <button onClick={() => setShowFormatsInfo(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
                    </div>
                    {recentProjects.length === 0 ? (
                      <p style={{ color: '#8e8e93', fontSize: '14px' }}>Nessun formato salvato.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recentProjects.map((p, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f2f2f7', borderRadius: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1c1c1e' }}>
                              {favoriteProjects.includes(p.id) ? '⭐ ' : ''}{p.nome || 'Senza nome'}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#007AFF', background: '#fff', padding: '4px 10px', borderRadius: '20px' }}>
                              {p.width} × {p.height} px
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showAccessModal && (
                <div
                  onClick={() => { setShowAccessModal(false); setSelectedProjectForAccess(null) }}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                >
                  <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', maxHeight: '75vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                    {!selectedProjectForAccess ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <h3 style={{ margin: 0, fontSize: '17px' }}>Accessi progetti</h3>
                          <button onClick={() => setShowAccessModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#8e8e93', marginBottom: '16px' }}>
                          Scegli un progetto per decidere chi può vederlo. Senza restrizioni, un progetto è visibile a tutti.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {recentProjects.length === 0 ? (
                            <p style={{ color: '#8e8e93', fontSize: '14px' }}>Nessun formato salvato.</p>
                          ) : (
                            recentProjects.map((p) => {
                              const restrictedCount = (projectAccess[p.id] || []).length
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => setSelectedProjectForAccess(p)}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f2f2f7', borderRadius: '10px', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1c1c1e' }}>{p.nome || 'Senza nome'}</span>
                                  <span style={{ fontSize: '11px', fontWeight: '800', color: restrictedCount > 0 ? '#FF9500' : '#34C759', background: '#fff', padding: '4px 10px', borderRadius: '20px' }}>
                                    {restrictedCount > 0 ? `🔒 ${restrictedCount}` : '🌍 Pubblico'}
                                  </span>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <button onClick={() => setSelectedProjectForAccess(null)} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '14px', fontWeight: '700', cursor: 'pointer', padding: 0 }}>← Indietro</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px' }}>{selectedProjectForAccess.nome || 'Senza nome'}</h3>
                          <button onClick={() => setShowAccessModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#8e8e93', marginBottom: '14px' }}>
                          {(projectAccess[selectedProjectForAccess.id] || []).length === 0
                            ? '🌍 Pubblico: lo vedono tutti. Spunta un utente per iniziare a restringere l\'accesso.'
                            : '🔒 Riservato: lo vedono solo gli utenti spuntati (più gli admin).'}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {allUsersForAccess.map((u) => {
                            const hasAccess = (projectAccess[selectedProjectForAccess.id] || []).includes(u.username)
                            return (
                              <label key={u.username} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f2f2f7', borderRadius: '10px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={hasAccess}
                                  onChange={() => hasAccess
                                    ? revokeProjectAccess(selectedProjectForAccess.id, u.username)
                                    : grantProjectAccess(selectedProjectForAccess.id, u.username)}
                                  style={{ width: '18px', height: '18px' }}
                                />
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>{u.nome_completo} <span style={{ color: '#8e8e93' }}>@{u.username}</span></span>
                              </label>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} accept="image/*" />
              {projectMode === 'griglia' ? (
                <>
                  <input
                    ref={gridFileInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) processGridFile(file, gridActiveCellRef.current)
                      e.target.value = ''
                    }}
                  />
                  <div style={{ marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                    {userCategorie.length > 0 && userCategorie.some(cat => cat.toLowerCase() === 'formula e') && (
                      <button
                        onClick={() => setSelectedLogo('formula1it')}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: '800',
                          background: selectedLogo === 'formula1it' ? '#007AFF' : '#E5E5EA',
                          color: selectedLogo === 'formula1it' ? '#fff' : '#1c1c1e',
                          cursor: 'pointer'
                        }}
                      >
                        Formula1.it
                      </button>
                    )}
                    <span style={{ background: '#1c1c1e', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
                      {dimensions.width} × {dimensions.height} PX — GRIGLIA {gridLayout === 'grid2x2' ? '2×2' : `${gridCount} FOTO`}
                    </span>
                    {userCategorie.length > 0 && userCategorie.some(cat => cat.toLowerCase() === 'formula e') && (
                      <button
                        onClick={() => setSelectedLogo('blogformulae')}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: '800',
                          background: selectedLogo === 'blogformulae' ? '#007AFF' : '#E5E5EA',
                          color: selectedLogo === 'blogformulae' ? '#fff' : '#1c1c1e',
                          cursor: 'pointer'
                        }}
                      >
                        BlogFormulae.it
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93' }}>TIPO</span>
                    <button
                      onClick={() => { setGridLayout('strips'); setGridImages([]) }}
                      style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer', background: gridLayout === 'strips' ? '#007AFF' : '#E5E5EA', color: gridLayout === 'strips' ? '#fff' : '#1c1c1e' }}
                    >
                      Strisce
                    </button>
                    <button
                      onClick={() => { setGridLayout('grid2x2'); setGridImages([]) }}
                      style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer', background: gridLayout === 'grid2x2' ? '#007AFF' : '#E5E5EA', color: gridLayout === 'grid2x2' ? '#fff' : '#1c1c1e' }}
                    >
                      2×2
                    </button>
                    {gridLayout === 'strips' && (
                      <>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', marginLeft: '8px' }}>N° FOTO</span>
                        {[2, 3, 4].map(n => (
                          <button
                            key={n}
                            onClick={() => { setGridCount(n); setGridImages([]) }}
                            style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer', background: gridCount === n ? '#007AFF' : '#E5E5EA', color: gridCount === n ? '#fff' : '#1c1c1e' }}
                          >
                            {n}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  <div style={{ position: 'relative', width: `${containerWidth}px`, height: `${containerHeight}px`, margin: '0 auto' }}>
                  <div style={{
                    width: `${containerWidth}px`,
                    height: `${containerHeight}px`,
                    background: '#fff',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridLayout === 'grid2x2' ? 2 : gridCount}, 1fr)`,
                    gridTemplateRows: `repeat(${gridLayout === 'grid2x2' ? 2 : 1}, 1fr)`,
                    gap: gridLayout === 'strips' ? '0px' : '4px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.4)'
                  }}>
                    {Array.from({ length: gridLayout === 'grid2x2' ? 4 : gridCount }).map((_, i) => {
                      const cell = gridImages[i]
                      const cellsTotal = gridLayout === 'grid2x2' ? 4 : gridCount
                      const cellPixelWidth = gridLayout === 'strips' ? containerWidth / cellsTotal : containerWidth / 2
                      const clipPath = gridLayout === 'strips' ? getStripClipPath(i, cellsTotal, cellPixelWidth) : 'none'
                      return (
                        <div
                          key={i}
                          ref={(el) => (gridCellContainerRefs.current[i] = el)}
                          onMouseDown={() => cell && startGridDrag(i)}
                          onMouseMove={(e) => {
                            if (!isGridDragging || gridDragCellRef.current !== i) return
                            setGridImages(prev => {
                              const next = [...prev]
                              const g = next[i]
                              if (!g) return prev
                              const bounded = applyGridBounds(i, g.offset.x + e.movementX, g.offset.y + e.movementY, g.scale)
                              next[i] = { ...g, offset: bounded }
                              return next
                            })
                          }}
                          onMouseUp={stopGridDrag}
                          onMouseLeave={stopGridDrag}
                          onTouchStart={(e) => {
                            if (!cell) return
                            gridDragCellRef.current = i
                            setIsGridDragging(true)
                            e.currentTarget.dataset.startX = e.touches[0].clientX
                            e.currentTarget.dataset.startY = e.touches[0].clientY
                          }}
                          onTouchMove={(e) => {
                            if (!isGridDragging || gridDragCellRef.current !== i) return
                            const x = e.touches[0].clientX
                            const y = e.touches[0].clientY
                            const diffX = x - parseFloat(e.currentTarget.dataset.startX)
                            const diffY = y - parseFloat(e.currentTarget.dataset.startY)
                            setGridImages(prev => {
                              const next = [...prev]
                              const g = next[i]
                              if (!g) return prev
                              const bounded = applyGridBounds(i, g.offset.x + diffX, g.offset.y + diffY, g.scale)
                              next[i] = { ...g, offset: bounded }
                              return next
                            })
                            e.currentTarget.dataset.startX = x
                            e.currentTarget.dataset.startY = y
                          }}
                          onTouchEnd={stopGridDrag}
                          onClick={() => { if (!cell) { gridActiveCellRef.current = i; gridFileInputRef.current?.click() } }}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const file = e.dataTransfer.files?.[0]
                            if (file) processGridFile(file, i)
                          }}
                          style={{
                            position: 'relative',
                            overflow: 'hidden',
                            background: canvasBackground,
                            cursor: cell ? (isGridDragging && gridDragCellRef.current === i ? 'grabbing' : 'grab') : 'pointer',
                            touchAction: 'none',
                            clipPath: clipPath,
                            WebkitClipPath: clipPath
                          }}
                        >
                          {cell ? (
                            <>
                              <img
                                src={cell.src}
                                draggable={false}
                                onLoad={(e) => {
                                  const cellEl = gridCellContainerRefs.current[i]
                                  if (!cellEl) return
                                  const im = e.target
                                  const imgAspect = im.naturalWidth / im.naturalHeight
                                  const cellAspect = cellEl.clientWidth / cellEl.clientHeight
                                  const nextFitStyle = imgAspect > cellAspect
                                    ? { width: 'auto', height: '100%' }
                                    : { width: '100%', height: 'auto' }
                                  setGridImages(prev => {
                                    const next = [...prev]
                                    const g = next[i]
                                    if (!g) return prev
                                    next[i] = { ...g, fitStyle: nextFitStyle }
                                    return next
                                  })
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  ...(cell.fitStyle || { width: '100%', height: 'auto' }),
                                  transform: `translate(calc(-50% + ${cell.offset.x}px), calc(-50% + ${cell.offset.y}px)) scale(${cell.scale})`,
                                  pointerEvents: 'none'
                                }}
                              />
                              <div
                                onMouseDown={(e) => startGridCornerResize(e, i)}
                                onTouchStart={(e) => startGridCornerResize(e, i)}
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: '36px',
                                  height: '36px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'nwse-resize',
                                  touchAction: 'none',
                                  zIndex: 20
                                }}
                              >
                                <div style={{
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  background: '#fff',
                                  border: '3px solid #007AFF',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                                  pointerEvents: 'none'
                                }} />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); gridActiveCellRef.current = i; gridFileInputRef.current?.click() }}
                                style={{
                                  position: 'absolute',
                                  top: '6px',
                                  right: '6px',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: 'rgba(0,0,0,0.55)',
                                  color: '#fff',
                                  fontSize: '13px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  zIndex: 21
                                }}
                              >
                                ⟳
                              </button>
                            </>
                          ) : (
                            <div
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const file = e.dataTransfer.files?.[0]
                                if (file) processGridFile(file, i)
                              }}
                              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#F2F2F7' }}
                            >
                              <div style={{ fontSize: '28px' }}>📷</div>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#8e8e93', marginTop: '6px' }}>Carica o trascina</span>
                            </div>
                          )}
                        </div>
                      )
                   })}
                  </div>

                    {/* Anteprima logo sovrapposta a tutta la griglia, FUORI dal contenitore grid così è sempre sopra */}
                    {conLogo && (
                      <div style={{ position: 'absolute', bottom: `${logoConfig[selectedLogo].offsetYPercent * 100}%`, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 999 }}>
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
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '40px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                    <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ padding: '12px', borderRadius: '14px', border: '1px solid #d1d1d6', fontWeight: '800', background: '#fff', height: '45px' }}>
                      <option value="image/webp">WEBP</option>
                      <option value="image/jpeg">JPEG</option>
                      <option value="image/png">PNG</option>
                    </select>
                    <StyledButton variant={conLogo ? 'success' : 'secondary'} onClick={() => setConLogo(!conLogo)}>➕ Logo</StyledButton>
                    <StyledButton variant="primary" onClick={handleSave} disabled={isSaving}>{isSaving ? '⏳...' : 'Salva'}</StyledButton>
                  </div>
                </>
              ) : !selectedImage ? (
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
                  <div style={{ display: isMobile ? 'block' : 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Menu strumenti: colonna a SINISTRA su desktop, riga sotto il canvas su
                    mobile (una colonna fissa da 170px non ci starebbe su schermi stretti). */}
                    {!isMobile && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#fff', padding: '10px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '110px', flexShrink: 0 }}>
                        {/* Salva è SEMPRE il primo elemento, in cima: stessa posizione identica in
                        ogni modalità, non scivola più in basso quando ci sono altri pulsanti sopra
                        (es. Grafica/Righelli, presenti solo in POST SOCIAL). */}
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '16px 6px', borderRadius: '12px', border: 'none', cursor: isSaving ? 'default' : 'pointer',
                            background: '#007AFF', color: '#fff', width: '100%', fontWeight: '700',
                            opacity: isSaving ? 0.6 : 1, marginBottom: '4px'
                          }}
                        >
                          <span style={{ fontSize: '14px', fontWeight: '800' }}>{isSaving ? 'Salvo...' : 'Salva'}</span>
                        </button>

                        {/* Formato file SEMPRE subito sotto Salva */}
                        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} title="Formato file" style={{ padding: '8px', borderRadius: '10px', border: 'none', background: '#f2f2f7', fontWeight: '700', fontSize: '11px', width: '100%', marginBottom: '4px' }}>
                          <option value="image/webp">WEBP</option>
                          <option value="image/jpeg">JPEG</option>
                      <option value="image/png">PNG</option>
                        </select>
                        <div style={{ height: '1px', background: '#f2f2f2', margin: '2px 4px 6px' }} />

                        {projectMode === 'postsocial' && OVERLAY_GRAPHICS.length > 0 && (
                          <ToolIconButton icon="🎨" label="Grafica" onClick={() => setShowGraphicsModal(true)} />
                        )}
                        {projectMode === 'postsocial' && (
                          <ToolIconButton icon="📐" label={showRulers ? 'Righelli' : 'Righelli'} active={showRulers} onClick={() => setShowRulers((v) => !v)} />
                        )}
                        {projectMode === 'postsocial' && <div style={{ height: '1px', background: '#f2f2f2', margin: '6px 4px' }} />}

                        <ToolIconButton
                          icon={canvasBackground === '#000000' ? '🌙' : '☀️'}
                          label="Sfondo"
                          onClick={() => setCanvasBackground(canvasBackground === '#000000' ? '#FFFFFF' : '#000000')}
                        />
                        <div style={{ height: '1px', background: '#f2f2f2', margin: '6px 4px' }} />

                        <ToolIconButton icon="🖼️" label="Logo" active={conLogo} onClick={() => setConLogo(!conLogo)} />
                        {projectMode === 'postsocial' && <AddMenuButton />}
                        <div style={{ height: '1px', background: '#f2f2f2', margin: '6px 4px' }} />

                        <ToolIconButton icon="📷" label="Nuova foto" onClick={() => fileInputRef.current.click()} />
                      </div>
                    )}

                    {/* Colonna centrale: foto + pannello destro (anteprima testo), poi sotto lo zoom e Salva */}
                    <div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{
                    width: `${containerWidth + (showRulers && projectMode === 'postsocial' ? 20 : 0)}px`,
                    display: 'grid',
                    gridTemplateColumns: showRulers && projectMode === 'postsocial' ? '20px 1fr' : '1fr',
                    gridTemplateRows: showRulers && projectMode === 'postsocial' ? '20px 1fr' : '1fr'
                  }}>
                    {/* Angolo in alto a sinistra: cella vuota (il pulsante mostra/nascondi righelli
                    è UNICO, sempre sotto il canvas — vedi più in basso) */}
                    {showRulers && projectMode === 'postsocial' && (
                      <div style={{ gridColumn: 1, gridRow: 1, background: 'rgba(20,20,22,0.92)' }} />
                    )}

                    {/* Righello ORIZZONTALE: FUORI dal frame, sopra di esso — cella propria della
                    griglia, mai sovrapposta alla foto. Segue lo scorrimento sottraendo scrollOffset. */}
                    {showRulers && projectMode === 'postsocial' && (() => {
                      const realWidth = dimensions.width
                      const pxPerReal = displayScale * zoomLevel
                      const TARGET_GAP = 100
                      const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
                      const majorStep = niceSteps.find((s) => s >= TARGET_GAP / pxPerReal) || niceSteps[niceSteps.length - 1]
                      const minorStep = majorStep % 5 === 0 ? majorStep / 5 : (majorStep % 2 === 0 ? majorStep / 2 : majorStep)
                      const majorX = []; for (let r = 0; r <= realWidth; r += majorStep) majorX.push(r)
                      const minorX = []; for (let r = 0; r <= realWidth; r += minorStep) minorX.push(r)
                      const chip = { background: 'rgba(0,0,0,0.9)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', lineHeight: '1.4' }

                      return (
                        <div style={{ gridColumn: 2, gridRow: 1, position: 'relative', height: '20px', overflow: 'hidden', background: 'rgba(20,20,22,0.92)', borderBottom: '1px solid rgba(255,255,255,0.25)' }}>
                          {minorX.map((r) => (
                            <div key={`m${r}`} style={{ position: 'absolute', left: `${r * pxPerReal - scrollOffset.x}px`, bottom: 0, width: '1px', height: '5px', background: 'rgba(255,255,255,0.4)' }} />
                          ))}
                          {majorX.map((r) => (
                            <div key={`M${r}`} style={{ position: 'absolute', left: `${r * pxPerReal - scrollOffset.x}px`, top: 0, bottom: 0 }}>
                              <div style={{ width: '1px', height: '100%', background: 'rgba(255,255,255,0.9)' }} />
                              <span style={{ position: 'absolute', top: '1px', left: '2px', ...chip }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Righello VERTICALE: FUORI dal frame, a sinistra di esso — cella propria. */}
                    {showRulers && projectMode === 'postsocial' && (() => {
                      const realHeight = dimensions.height
                      const pxPerReal = displayScale * zoomLevel
                      const TARGET_GAP = 100
                      const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
                      const majorStep = niceSteps.find((s) => s >= TARGET_GAP / pxPerReal) || niceSteps[niceSteps.length - 1]
                      const minorStep = majorStep % 5 === 0 ? majorStep / 5 : (majorStep % 2 === 0 ? majorStep / 2 : majorStep)
                      const majorY = []; for (let r = 0; r <= realHeight; r += majorStep) majorY.push(r)
                      const minorY = []; for (let r = 0; r <= realHeight; r += minorStep) minorY.push(r)
                      const chip = { background: 'rgba(0,0,0,0.9)', padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', lineHeight: '1.4' }

                      return (
                        <div style={{ gridColumn: 1, gridRow: 2, position: 'relative', width: '20px', overflow: 'hidden', background: 'rgba(20,20,22,0.92)', borderRight: '1px solid rgba(255,255,255,0.25)' }}>
                          {minorY.map((r) => (
                            <div key={`m${r}`} style={{ position: 'absolute', top: `${r * pxPerReal - scrollOffset.y}px`, right: 0, height: '1px', width: '5px', background: 'rgba(255,255,255,0.4)' }} />
                          ))}
                          {majorY.map((r) => (
                            <div key={`M${r}`} style={{ position: 'absolute', top: `${r * pxPerReal - scrollOffset.y}px`, left: 0, right: 0 }}>
                              <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.9)' }} />
                              <span style={{ position: 'absolute', top: '2px', left: '1px', transform: 'rotate(-90deg)', transformOrigin: 'left top', ...chip }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Cella della foto: SOLO qui vive il frame vero e proprio, con la sua ombra. */}
                    <div style={{
                      gridColumn: showRulers && projectMode === 'postsocial' ? 2 : 1,
                      gridRow: showRulers && projectMode === 'postsocial' ? 2 : 1,
                      width: `${containerWidth}px`, height: `${containerHeight}px`,
                      position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.4)'
                    }}>
                      <style>{`
                        .fwm-zoom-scroll::-webkit-scrollbar { display: none; }
                        .fwm-zoom-scroll { scrollbar-width: none; -ms-overflow-style: none; }
                      `}</style>
                      <div
                        ref={zoomViewportRef}
                        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
                      >
                        <div
                          ref={innerScrollRef}
                          className="fwm-zoom-scroll"
                          onScroll={(e) => setScrollOffset({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
                          style={{
                            width: '100%', height: '100%', position: 'relative',
                            overflow: zoomLevel > 1 ? 'auto' : 'hidden',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                          }}
                        >
                          <div style={{ position: 'relative', width: `${zoomedWidth}px`, height: `${zoomedHeight}px` }}>
                            <div 
                              ref={containerRef}
                              onMouseDown={() => setIsDragging(true)}
                              onMouseMove={(e) => {
                                if (!isDragging) return
                                let newX = imageOffset.x + e.movementX / zoomLevel
                                let newY = imageOffset.y + e.movementY / zoomLevel
                                const SNAP = 6
                                let vGuide = false, hGuide = false
                                if (Math.abs(newX) < SNAP) { newX = 0; vGuide = true }
                                if (Math.abs(newY) < SNAP) { newY = 0; hGuide = true }
                                setPhotoSnapGuides({ v: vGuide, h: hGuide })
                                const next = applyBounds(newX, newY)
                                setImageOffset(next)
                              }}
                              onMouseUp={() => { setIsDragging(false); setPhotoSnapGuides({ v: false, h: false }) }}
                              onMouseLeave={() => { setIsDragging(false); setPhotoSnapGuides({ v: false, h: false }) }}
                              onTouchStart={(e) => {
                                if (e.touches.length === 2) {
                                  setIsDragging(false)
                                  const dx = e.touches[0].clientX - e.touches[1].clientX
                                  const dy = e.touches[0].clientY - e.touches[1].clientY
                                  pinchStateRef.current = { startDist: Math.hypot(dx, dy) || 1, startZoom: zoomLevel }
                                  return
                                }
                                setIsDragging(true)
                                e.currentTarget.dataset.startX = e.touches[0].clientX
                                e.currentTarget.dataset.startY = e.touches[0].clientY
                              }}
                              onTouchMove={(e) => {
                                if (e.touches.length === 2) {
                                  const dx = e.touches[0].clientX - e.touches[1].clientX
                                  const dy = e.touches[0].clientY - e.touches[1].clientY
                                  const dist = Math.hypot(dx, dy) || 1
                                  const ratio = dist / pinchStateRef.current.startDist
                                  const next = Math.min(4, Math.max(1, pinchStateRef.current.startZoom * ratio))
                                  setZoomLevel(next)
                                  return
                                }
                                if (!isDragging) return
                                const x = e.touches[0].clientX
                                const y = e.touches[0].clientY
                                let newX = imageOffset.x + (x - parseFloat(e.currentTarget.dataset.startX)) / zoomLevel
                                let newY = imageOffset.y + (y - parseFloat(e.currentTarget.dataset.startY)) / zoomLevel
                                const SNAP = 6
                                let vGuide = false, hGuide = false
                                if (Math.abs(newX) < SNAP) { newX = 0; vGuide = true }
                                if (Math.abs(newY) < SNAP) { newY = 0; hGuide = true }
                                setPhotoSnapGuides({ v: vGuide, h: hGuide })
                                const next = applyBounds(newX, newY)
                                setImageOffset(next)
                                e.currentTarget.dataset.startX = x
                                e.currentTarget.dataset.startY = y
                              }}
                              onTouchEnd={() => { setIsDragging(false); setPhotoSnapGuides({ v: false, h: false }) }}
                              style={{ 
                                width: `${zoomedWidth}px`, 
                                height: `${zoomedHeight}px`, 
                                background: canvasBackground, 
                                position: 'relative', 
                                overflow: 'hidden', 
                                cursor: isDragging ? 'grabbing' : 'grab',
                                touchAction: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {/* Immagine normale */}
                              <img 
                                src={selectedImage} 
                                draggable={false}
                                onLoad={(e) => {
                                  if (projectMode === 'normale' || projectMode === 'postsocial') {
                                    const img = e.target
                                    const imgAspect = img.naturalWidth / img.naturalHeight
                                    const containerAspect = containerWidth / containerHeight
                                    
                                    if (imgAspect > containerAspect) {
                                      setMobileImgStyle({ width: 'auto', height: '100%' })
                                    } else {
                                      setMobileImgStyle({ width: '100%', height: 'auto' })
                                    }
                                  }
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  maxWidth: 'none',
                                  ...((projectMode === 'normale' || projectMode === 'postsocial') ? {
                                    ...mobileImgStyle,
                                    left: '50%',
                                    top: '50%',
                                    transform: `translate(calc(-50% + ${imageOffset.x * zoomLevel}px), calc(-50% + ${imageOffset.y * zoomLevel}px)) scale(${imageScale})`
                                  } : {
                                    width: '100%',
                                    height: 'auto',
                                    top: 0,
                                    left: 0,
                                    transform: `translateY(${imageOffset.y * zoomLevel}px)`
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
                              
                              {/* Grafica sovrapposta (badge/sfumature/cornici forniti dalla grafica), solo POST SOCIAL */}
                              {projectMode === 'postsocial' && selectedOverlay && OVERLAY_GRAPHICS.find((g) => g.key === selectedOverlay) && (
                                <img
                                  src={OVERLAY_GRAPHICS.find((g) => g.key === selectedOverlay).url}
                                  draggable={false}
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 6
                                  }}
                                />
                              )}

                            </div>

                            {/* Linee guida blu di centraggio automatico per la foto: appaiono solo
                            mentre la trascini e si avvicina al centro esatto del frame — e solo
                            nelle modalità dove la foto si può davvero spostare (NORMALE, POST
                            SOCIAL). In COVER la foto riempie a fissa, non si trascina manualmente. */}
                            {(projectMode === 'normale' || projectMode === 'postsocial') && photoSnapGuides.v && (
                              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: '#007AFF', zIndex: 25, pointerEvents: 'none', boxShadow: '0 0 4px rgba(0,122,255,0.8)' }} />
                            )}
                            {(projectMode === 'normale' || projectMode === 'postsocial') && photoSnapGuides.h && (
                              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#007AFF', zIndex: 25, pointerEvents: 'none', boxShadow: '0 0 4px rgba(0,122,255,0.8)' }} />
                            )}

                            {/* Cornice di selezione + maniglie agli angoli */}
                            {(projectMode === 'normale' || projectMode === 'postsocial') && (
                              <>
                                <div style={{
                                  position: 'absolute',
                                  inset: 0,
                                  border: '2px solid #007AFF',
                                  pointerEvents: 'none',
                                  zIndex: 19
                                }} />

                                {[
                                  { corner: 'tl', top: 0, left: 0, translate: '-50%, -50%', cursor: 'nwse-resize' },
                                  { corner: 'tr', top: 0, right: 0, translate: '50%, -50%', cursor: 'nesw-resize' },
                                  { corner: 'bl', bottom: 0, left: 0, translate: '-50%, 50%', cursor: 'nesw-resize' },
                                  { corner: 'br', bottom: 0, right: 0, translate: '50%, 50%', cursor: 'nwse-resize' }
                                ].map((h) => (
                                  <div
                                    key={h.corner}
                                    onMouseDown={(e) => startCornerResize(e, h.corner)}
                                    onTouchStart={(e) => startCornerResize(e, h.corner)}
                                    style={{
                                      position: 'absolute',
                                      top: h.top,
                                      bottom: h.bottom,
                                      left: h.left,
                                      right: h.right,
                                      transform: `translate(${h.translate})`,
                                      width: '44px',
                                      height: '44px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: h.cursor,
                                      touchAction: 'none',
                                      zIndex: 20
                                    }}
                                  >
                                    <div style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      background: '#fff',
                                      border: '3px solid #007AFF',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                                      pointerEvents: 'none'
                                    }} />
                                  </div>
                                ))}
                              </>
                            )}

                            {projectMode === 'postsocial' && (
                             <TextOverlay
                                containerWidth={zoomedWidth}
                                containerHeight={zoomedHeight}
                                textBoxes={textBoxes}
                                onChange={setTextBoxes}
                                isMobile={isMobile}
                                displayScale={displayScale}
                                zoomLevel={zoomLevel}
                                baseContainerWidth={containerWidth}
                              />
                            )}

                            {projectMode === 'postsocial' && (
                              <GuideLines
                                containerRef={containerRef}
                                containerWidth={zoomedWidth}
                                containerHeight={zoomedHeight}
                                displayScale={displayScale}
                                guideLines={guideLines}
                                onChange={setGuideLines}
                                onDragEnd={persistGuideLinePosition}
                                onDelete={deleteGuideLine}
                                canEdit={canEditGuides}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Colonna FISSA a destra (stessa larghezza sempre, come quella sinistra):
                  Note in cima, pannello colori/sottolineato (via portale da TestoPost.jsx)
                  subito sotto. Essendo una colonna a larghezza fissa nella STESSA riga
                  flessibile della sidebar sinistra, comparire/sparire del contenuto al suo
                  interno non sposta MAI il canvas — esattamente come la sidebar sinistra. */}
                  {!isMobile && projectMode === 'postsocial' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '220px', flexShrink: 0 }}>
                      <div style={{ position: 'relative' }}>
                        {!notesOpen ? (
                          <button
                            onClick={() => setNotesOpen(true)}
                            title="Note per questa grafica"
                            style={{
                              width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                              background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', position: 'relative',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                            }}
                          >
                            📝
                            {graphicNotes.length > 0 && (
                              <span style={{
                                position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', padding: '0 4px',
                                borderRadius: '9px', background: '#FF3B30', color: '#fff', fontSize: '10px', fontWeight: '800',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {graphicNotes.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div style={{ background: '#fff', borderRadius: '16px', padding: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1c1c1e' }}>
                                📝 {OVERLAY_GRAPHICS.find((g) => g.key === selectedOverlay)?.label || 'Grafica'}
                              </span>
                              <button onClick={() => setNotesOpen(false)} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '16px', padding: 0 }}>✕</button>
                            </div>
                            {renderNotesList()}
                          </div>
                        )}
                      </div>

                      {/* Pannello colori/sottolineato + anteprima testo: arriva qui via portale
                      da TestoPost.jsx, SUBITO SOTTO Note, nella stessa colonna fissa. */}
                      <div id="fwm-text-side-portal" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} />
                    </div>
                  )}
                  </div>
                  {(projectMode === 'normale' || projectMode === 'postsocial') && (
                    <div style={{ width: `${containerWidth + (showRulers && projectMode === 'postsocial' ? 20 : 0)}px`, textAlign: 'center', marginTop: '10px' }}>
                      <div
                        onClick={() => setZoomLevel(1)}
                        title="Clicca per tornare al 100%"
                        style={{
                          display: 'inline-block', cursor: 'pointer', padding: '4px 12px',
                          background: '#1c1c1e', color: '#fff', borderRadius: '20px',
                          fontSize: '12px', fontWeight: '800'
                        }}
                      >
                        🔍 {Math.round(zoomLevel * 100)}%
                      </div>
                    </div>
                  )}
                  {feedback && (
                    <div style={{ width: `${containerWidth + (showRulers && projectMode === 'postsocial' ? 20 : 0)}px`, textAlign: 'center', marginTop: '10px' }}>
                      <div style={{ display: 'inline-block', padding: '14px 28px', background: '#34C759', color: '#fff', borderRadius: '16px', fontWeight: '800' }}>
                        {feedback}
                      </div>
                    </div>
                  )}

                  {/* Su mobile: Salva a piena larghezza, ben in vista, e il resto degli strumenti
                  in una griglia che VA A CAPO da sola (niente più scroll orizzontale, tutto
                  visibile subito, come nella toolbar mobile di Canva). */}
                  {isMobile && (
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                      {/* Punto di atterraggio FISSO per la barra colori/sottolineato quando si
                      modifica un testo — sempre qui, sempre visibile per intero, mai più
                      "attaccata" alla casella (dove poteva uscire dal bordo dello schermo). */}
                      {projectMode === 'postsocial' && (
                        <div id="fwm-text-mobile-portal" style={{ width: '100%' }} />
                      )}

                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                          width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                          cursor: isSaving ? 'default' : 'pointer', background: '#007AFF', color: '#fff',
                          fontWeight: '800', fontSize: '15px', opacity: isSaving ? 0.6 : 1,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                        }}
                      >
                        {isSaving ? 'Salvo...' : 'Salva'}
                      </button>

                      <div style={{
                        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '4px',
                        background: '#fff', padding: '10px', borderRadius: '18px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                      }}>
                        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} title="Formato file" style={{ padding: '12px 14px', borderRadius: '14px', border: 'none', background: '#f2f2f7', fontWeight: '700', fontSize: '14px' }}>
                          <option value="image/webp">WEBP</option>
                          <option value="image/jpeg">JPEG</option>
                      <option value="image/png">PNG</option>
                        </select>

                        {projectMode === 'postsocial' && OVERLAY_GRAPHICS.length > 0 && (
                          <ToolIconButton icon="🎨" label="Grafica" onClick={() => setShowGraphicsModal(true)} vertical={false} />
                        )}
                        {projectMode === 'postsocial' && (
                          <ToolIconButton icon="📐" label="Righelli" active={showRulers} onClick={() => setShowRulers((v) => !v)} vertical={false} />
                        )}
                        {projectMode === 'postsocial' && (
                          <ToolIconButton icon="📝" label={`Note${graphicNotes.length ? ` (${graphicNotes.length})` : ''}`} active={graphicNotes.length > 0} onClick={() => setShowNotesModal(true)} vertical={false} />
                        )}
                        <ToolIconButton
                          icon={canvasBackground === '#000000' ? '🌙' : '☀️'}
                          label="Sfondo"
                          onClick={() => setCanvasBackground(canvasBackground === '#000000' ? '#FFFFFF' : '#000000')}
                          vertical={false}
                        />
                        <ToolIconButton icon="🖼️" label="Logo" active={conLogo} onClick={() => setConLogo(!conLogo)} vertical={false} />
                        {projectMode === 'postsocial' && <AddMenuButton vertical={false} />}
                        <ToolIconButton icon="📷" label="Nuova foto" onClick={() => fileInputRef.current.click()} vertical={false} />
                      </div>
                    </div>
                  )}

                  {/* Modale per scrivere una nuova nota (usato sia da desktop sia da mobile) */}
                  {showAddNoteModal && (
                    <div
                      onClick={() => setShowAddNoteModal(false)}
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    >
                      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <h3 style={{ margin: 0, fontSize: '17px' }}>Nuova nota</h3>
                          <button onClick={() => setShowAddNoteModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#8e8e93', marginBottom: '10px' }}>
                          Per "{OVERLAY_GRAPHICS.find((g) => g.key === selectedOverlay)?.label || 'questa grafica'}" — firmata come @{user?.username || 'tu'}.
                        </p>
                        <textarea
                          autoFocus
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Es. testo max 40px, evita l'angolo in basso a destra..."
                          style={{ width: '100%', minHeight: '110px', padding: '12px', borderRadius: '12px', border: '1px solid #e5e5ea', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <button
                          onClick={() => addGraphicNote(newNoteText)}
                          disabled={noteSaving || !newNoteText.trim()}
                          style={{ marginTop: '14px', width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: '#007AFF', color: '#fff', fontWeight: '800', fontSize: '14px', cursor: noteSaving ? 'default' : 'pointer', opacity: (noteSaving || !newNoteText.trim()) ? 0.5 : 1 }}
                        >
                          {noteSaving ? 'Salvo...' : 'Salva nota'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Popup elenco note, solo su mobile (su desktop il fumetto è sempre visibile) */}
                  {showNotesModal && (
                    <div
                      onClick={() => setShowNotesModal(false)}
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    >
                      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: '17px' }}>Note per questa grafica</h3>
                          <button onClick={() => setShowNotesModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#8e8e93', marginBottom: '14px' }}>
                          Legate a "{OVERLAY_GRAPHICS.find((g) => g.key === selectedOverlay)?.label || 'questa grafica'}" — cambiano automaticamente se selezioni un'altra grafica.
                        </p>
                        {renderNotesList()}
                      </div>
                    </div>
                  )}

                  {/* Modale con anteprima di ogni grafica sovrapposta disponibile, cliccabile */}
                  {showGraphicsModal && (
                    <div
                      onClick={() => setShowGraphicsModal(false)}
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    >
                      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '560px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                          <h3 style={{ margin: 0, fontSize: '17px' }}>Scegli la grafica</h3>
                          <button onClick={() => setShowGraphicsModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#FF3B30', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
                          {OVERLAY_GRAPHICS.map((g) => (
                            <button
                              key={g.key}
                              onClick={() => { setSelectedOverlay(g.key); setShowGraphicsModal(false) }}
                              style={{
                                border: g.key === selectedOverlay ? '3px solid #007AFF' : '3px solid transparent',
                                borderRadius: '14px', padding: 0, cursor: 'pointer', background: '#1c1c1e',
                                overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0
                              }}
                            >
                              <div style={{ width: '100%', aspectRatio: `${dimensions.width} / ${dimensions.height}`, position: 'relative', background: '#3a3a3c' }}>
                                <img src={g.url} alt={g.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              </div>
                              <span style={{ display: 'block', padding: '8px 4px', fontSize: '12px', fontWeight: '700', color: '#fff', textAlign: 'center' }}>
                                {g.key === selectedOverlay ? '✓ ' : ''}{g.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

}

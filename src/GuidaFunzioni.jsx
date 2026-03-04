import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

const FEATURE_SEPARATOR = '|||'

const COMMON_BUTTONS = [
  'Classifiche e Statistiche',
  'Editor Foto',
  'Disponibilità Weekend',
  'Calendario Accrediti',
  'Pannelli Vida',
  'Pannello Fonti',
  'Gestione Utenti',
  'Dispositivi Notifiche',
  'Indietro',
  'Accedi',
  'Salva',
  'Modifica',
  'Elimina',
  'Aggiungi',
  'Annulla',
  'Conferma',
  'Condividi',
  'Stampa',
  'Esporta',
  'Scarica',
  'Sincronizza',
  'Aggiorna',
  'Ricerca',
  'Filtra',
  'Apri'
]

const GUIDE_SECTIONS_DEFAULT = [
  {
    id: 'home',
    icon: '🏠',
    title: 'Home',
    subtitle: 'Panoramica e accessi rapidi',
    features: [
      'Accesso rapido a tutte le aree operative (Classifiche, Ritaglio, Disponibilità, Calendario).',
      'Widget evento imminente con informazioni sintetiche e stato generale.',
      'Pulsante guida (icona informazioni) per aprire questo pannello.'
    ]
  },
  {
    id: 'classifiche',
    icon: '🏆',
    title: 'Classifiche & Statistiche',
    subtitle: 'Gestione campionati e risultati',
    features: [
      'Creazione e modifica campionati/classifiche.',
      'Inserimento risultati GP, gestione punteggi, bonus e regole dedicate.',
      'Analisi statistiche, avanzamento stagione e viste riassuntive.'
    ]
  },
  {
    id: 'disponibilita',
    icon: '📅',
    title: 'Disponibilità Weekend',
    subtitle: 'Assegnazione articoli redazione',
    features: [
      'Gestione weekend con stato avanzamento e carico redattori.',
      'Aggiunta/modifica/eliminazione articoli per giorno e categoria.',
      'Sincronizzazione con template articoli per weekend futuri.'
    ]
  },
  {
    id: 'calendario',
    icon: '🪪',
    title: 'Calendario Accrediti',
    subtitle: 'Eventi e stato accrediti',
    features: [
      'Visualizzazione calendario eventi per campionato.',
      'Monitoraggio stato accrediti (da richiedere, richiesto, accettato).',
      'Notifiche e promemoria operativi legati agli eventi imminenti.'
    ]
  },
  {
    id: 'ritaglio',
    icon: '✂️',
    title: 'Editor Foto',
    subtitle: 'Ritaglio immagini rapido',
    features: [
      'Ritaglio immagini nel formato richiesto dalla redazione.',
      'Workflow rapido per preparazione asset grafici.',
      'Interfaccia focalizzata per operazioni veloci.'
    ]
  },
  {
    id: 'notifiche',
    icon: '🔔',
    title: 'Notifiche',
    subtitle: 'Push e aggiornamenti real-time',
    features: [
      'Ricezione notifiche push per attività e aggiornamenti importanti.',
      'Gestione dispositivi associati all\'utente.',
      'Aggiornamenti real-time su disponibilità e stato operativo.'
    ]
  }
]

function parseFeature(featureText = '') {
  const raw = String(featureText || '')
  let adminOnly = false
  let cleanedRaw = raw

  // Estrarre il flag [ADMIN]
  if (raw.startsWith('[ADMIN]')) {
    adminOnly = true
    cleanedRaw = raw.replace(/^\[ADMIN\]\s*/, '')
  }

  if (cleanedRaw.includes(FEATURE_SEPARATOR)) {
    const [title = '', ...rest] = cleanedRaw.split(FEATURE_SEPARATOR)
    return {
      title: title.trim(),
      description: rest.join(FEATURE_SEPARATOR).trim(),
      adminOnly
    }
  }

  const firstLine = cleanedRaw.split('\n')[0]?.trim() || ''
  const firstSentenceEnd = firstLine.indexOf('.')
  let fallbackTitle = firstSentenceEnd > 0 ? firstLine.slice(0, firstSentenceEnd + 1).trim() : firstLine
  if (!fallbackTitle) fallbackTitle = cleanedRaw.trim()
  if (fallbackTitle.length > 70) fallbackTitle = `${fallbackTitle.slice(0, 70)}...`
  return {
    title: fallbackTitle,
    description: cleanedRaw.trim(),
    adminOnly
  }
}

function serializeFeature(title = '', description = '', adminOnly = false) {
  const prefix = adminOnly ? '[ADMIN]' : ''
  return `${prefix}${String(title).trim()}${FEATURE_SEPARATOR}${String(description).trim()}`
}

function renderRichDescription(description = '', isAdmin = false) {
  let html = String(description || '')
  
  // Se non admin, rimuovi il contenuto [ADMIN]...[/ADMIN]
  if (!isAdmin) {
    html = html.replace(/\[ADMIN\](.*?)\[\/ADMIN\]/g, '')
  } else {
    // Se admin, sostituisci i marker con span colorato per evidenziare
    html = html.replace(/\[ADMIN\](.*?)\[\/ADMIN\]/g, '<span style="background-color:#FEF3C7;padding:0 2px;border:1px solid #FCD34D;border-radius:2px;font-weight:600;color:#92400E;">$1</span>')
  }
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  const decodedHtml = tempDiv.innerHTML
  
  return (
    <div
      style={{
        fontSize: '14px',
        color: '#0F172A',
        lineHeight: 1.6,
        wordBreak: 'break-word'
      }}
      dangerouslySetInnerHTML={{ __html: decodedHtml }}
    />
  )
}

function GuidaFunzioni({ user, onClose }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [sections, setSections] = useState([])
  const [editingSection, setEditingSection] = useState(null)
  const [showAddSection, setShowAddSection] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedFeatures, setExpandedFeatures] = useState([])
  const [editingFeatureIndex, setEditingFeatureIndex] = useState(null)
  const [editingFeatureTitle, setEditingFeatureTitle] = useState('')
  const [editingFeatureDescription, setEditingFeatureDescription] = useState('')
  const [editingFeaturePhotos, setEditingFeaturePhotos] = useState([])
  const [draggedPhotoId, setDraggedPhotoId] = useState(null)
  const [editingFeatureAdminOnly, setEditingFeatureAdminOnly] = useState(false)
  const textareaRef = useRef(null)

  const isAdmin = user?.ruolo === 'admin'

  const toggleFeature = (idx) => {
    setExpandedFeatures(prev => 
      prev.includes(idx) 
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    )
  }

  useEffect(() => {
    caricaSezioni()
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function caricaSezioni() {
    try {
      const { data, error } = await supabase
        .from('guida_sezioni')
        .select('*')
        .order('ordine', { ascending: true })

      if (error) {
        console.error('Errore caricamento sezioni:', error)
        setSections(GUIDE_SECTIONS_DEFAULT)
        setActiveSectionId(GUIDE_SECTIONS_DEFAULT[0].id)
        return
      }

      if (data && data.length > 0) {
        const sezioniCaricate = data.map(d => ({
          id: d.id,
          icon: d.icon,
          title: d.title,
          subtitle: d.subtitle,
          features: d.features || []
        }))
        setSections(sezioniCaricate)
        setActiveSectionId(sezioniCaricate[0].id)
      } else {
        await salvaSezioneDiDefault()
      }
    } catch (err) {
      console.error('Errore:', err)
      setSections(GUIDE_SECTIONS_DEFAULT)
      setActiveSectionId(GUIDE_SECTIONS_DEFAULT[0].id)
    }
  }

  async function salvaSezioneDiDefault() {
    try {
      const sezioniDaInserire = GUIDE_SECTIONS_DEFAULT.map((s, idx) => ({
        id: s.id,
        icon: s.icon,
        title: s.title,
        subtitle: s.subtitle,
        features: s.features,
        ordine: idx
      }))

      const { error } = await supabase
        .from('guida_sezioni')
        .insert(sezioniDaInserire)

      if (error) {
        console.error('Errore salvataggio sezioni default:', error)
      } else {
        setSections(GUIDE_SECTIONS_DEFAULT)
        setActiveSectionId(GUIDE_SECTIONS_DEFAULT[0].id)
      }
    } catch (err) {
      console.error('Errore:', err)
      setSections(GUIDE_SECTIONS_DEFAULT)
      setActiveSectionId(GUIDE_SECTIONS_DEFAULT[0].id)
    }
  }

  async function salvaSezione(sezione, options = {}) {
    const { closeForm = true, showSuccess = true } = options
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('guida_sezioni')
        .upsert({
          id: sezione.id,
          icon: sezione.icon,
          title: sezione.title,
          subtitle: sezione.subtitle,
          features: sezione.features,
          ordine: sections.findIndex(s => s.id === sezione.id)
        })

      if (error) {
        console.error('Errore salvataggio sezione:', error)
        alert('Errore durante il salvataggio')
      } else {
        await caricaSezioni()
        if (closeForm) setEditingSection(null)
        if (showSuccess) alert('Sezione salvata con successo!')
      }
    } catch (err) {
      console.error('Errore:', err)
      alert('Errore durante il salvataggio')
    }
    setIsSaving(false)
  }

  async function aggiungiNuovaSezione(nuovaSezione) {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('guida_sezioni')
        .insert({
          id: nuovaSezione.id,
          icon: nuovaSezione.icon,
          title: nuovaSezione.title,
          subtitle: nuovaSezione.subtitle,
          features: nuovaSezione.features,
          ordine: sections.length
        })

      if (error) {
        console.error('Errore aggiunta sezione:', error)
        alert('Errore durante l\'aggiunta della sezione')
      } else {
        await caricaSezioni()
        setShowAddSection(false)
        alert('Sezione aggiunta con successo!')
      }
    } catch (err) {
      console.error('Errore:', err)
      alert('Errore durante l\'aggiunta della sezione')
    }
    setIsSaving(false)
  }

  async function eliminaSezione(idSezione) {
    if (!confirm('Sei sicuro di voler eliminare questa sezione?')) return
    
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('guida_sezioni')
        .delete()
        .eq('id', idSezione)

      if (error) {
        console.error('Errore eliminazione sezione:', error)
        alert('Errore durante l\'eliminazione')
      } else {
        await caricaSezioni()
        alert('Sezione eliminata con successo!')
      }
    } catch (err) {
      console.error('Errore:', err)
      alert('Errore durante l\'eliminazione')
    }
    setIsSaving(false)
  }

  function marcaTestoCommeAdmin(textareaRef) {
    if (!textareaRef) return
    const textarea = textareaRef
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = editingFeatureDescription

    if (start === end) {
      alert('Seleziona del testo da marcare come admin-only')
      return
    }

    const selected = text.substring(start, end)
    const before = text.substring(0, start)
    const after = text.substring(end)
    const newText = `${before}[ADMIN]${selected}[/ADMIN]${after}`
    
    setEditingFeatureDescription(newText)
  }

  function togliMarcaturaAdmin(textareaRef) {
    if (!textareaRef) return
    const textarea = textareaRef
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = editingFeatureDescription

    if (start === end) {
      alert('Seleziona del testo con marcatura [ADMIN]...[/ADMIN]')
      return
    }

    const selected = text.substring(start, end)
    const cleaned = selected.replace(/\[ADMIN\](.*?)\[\/ADMIN\]/g, '$1')
    
    if (cleaned === selected) {
      alert('Il testo selezionato non contiene marcature [ADMIN]')
      return
    }

    const before = text.substring(0, start)
    const after = text.substring(end)
    const newText = `${before}${cleaned}${after}`
    
    setEditingFeatureDescription(newText)
  }

  const paragraphBlocks = String(editingFeatureDescription || '')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)

  function getImageStyle(align = 'left') {
    const baseSize = isMobile ? 'min(42vw, 150px)' : 'min(36vw, 240px)'
    const margin = align === 'right' ? '0 0 12px 12px' : '0 12px 12px 0'
    return `float:${align}; width:${baseSize}; max-width:100%; height:auto; border-radius:8px; margin:${margin};`
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function parseDescriptionForEditor(rawDescription = '') {
    let text = String(rawDescription || '')
    const extracted = []
    let imgIdx = 1

    text = text.replace(/<img[^>]*src="([^"]+)"[^>]*style="([^"]*)"[^>]*>/gi, (_m, src, style) => {
      const token = `[[IMG_${imgIdx}]]`
      const align = /float\s*:\s*right/i.test(style || '') ? 'right' : 'left'
      extracted.push({
        token,
        id: `img_${Date.now()}_${imgIdx}_${Math.random().toString(36).slice(2, 7)}`,
        src,
        alt: `Foto ${imgIdx}`,
        align
      })
      imgIdx += 1
      return ` ${token} `
    })

    text = text.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (_m, src) => {
      const token = `[[IMG_${imgIdx}]]`
      extracted.push({
        token,
        id: `img_${Date.now()}_${imgIdx}_${Math.random().toString(36).slice(2, 7)}`,
        src,
        alt: `Foto ${imgIdx}`,
        align: 'left'
      })
      imgIdx += 1
      return ` ${token} `
    })

    const plainWithTokens = text
      .replace(/<p[^>]*style="[^"]*clear:both[^"]*"[^>]*>\s*<\/p>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    const blocksWithTokens = plainWithTokens
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)

    const photos = extracted.map(photo => {
      const foundIndex = blocksWithTokens.findIndex(block => block.includes(photo.token))
      return {
        id: photo.id,
        src: photo.src,
        alt: photo.alt,
        align: photo.align,
        position: foundIndex === -1 ? blocksWithTokens.length : foundIndex
      }
    })

    const cleanText = plainWithTokens
      .replace(/\[\[IMG_\d+\]\]/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return {
      text: cleanText,
      photos
    }
  }

  function buildHtmlFromEditor(textContent = '', photos = []) {
    const blocks = String(textContent || '')
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)

    const parts = []
    const pushPhotosAt = (pos) => {
      photos
        .filter(photo => Number(photo.position ?? 0) === pos && photo?.src)
        .forEach((photo, idx) => {
          parts.push(`<img src="${photo.src}" alt="${photo.alt || `Foto ${idx + 1}`}" style="${getImageStyle(photo.align || 'left')}" />`)
        })
    }

    if (blocks.length === 0) {
      pushPhotosAt(0)
      parts.push('<p></p>')
    } else {
      blocks.forEach((block, idx) => {
        pushPhotosAt(idx)
        parts.push(`<p style="margin:0 0 10px 0; line-height:1.6;">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
      })
      pushPhotosAt(blocks.length)
    }

    parts.push('<div style="clear:both;"></div>')
    return parts.join('')
  }

  function inserisciFoto() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target?.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const url = String(event.target?.result || '')
        if (!url) return

        const newIndex = editingFeaturePhotos.length + 1
        setEditingFeaturePhotos(prev => [
          ...prev,
          {
            id: `img_${Date.now()}_${newIndex}`,
            src: url,
            alt: `Foto ${newIndex}`,
            align: 'left',
            position: paragraphBlocks.length
          }
        ])
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function impostaAllineamentoFoto(photoId, align) {
    setEditingFeaturePhotos(prev => prev.map(photo => (
      photo.id === photoId ? { ...photo, align } : photo
    )))
  }

  function spostaFotoInParagrafo(photoId, paragraphIndex) {
    setEditingFeaturePhotos(prev => prev.map(photo => (
      photo.id === photoId ? { ...photo, position: paragraphIndex } : photo
    )))
  }

  function rimuoviFoto(photoId) {
    setEditingFeaturePhotos(prev => prev.filter(photo => photo.id !== photoId))
  }

  function renderPreviewParagrafo() {
    let html = buildHtmlFromEditor(editingFeatureDescription, editingFeaturePhotos)
    
    // Nel preview in edit, evidenzia i marcatori admin
    html = html.replace(/\[ADMIN\](.*?)\[\/ADMIN\]/g, '<span style="background-color:#FEF3C7;padding:0 2px;border:1px solid #FCD34D;border-radius:2px;font-weight:600;color:#92400E;">$1</span>')

    return (
      <div style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '12px',
        background: '#F8FAFC',
        fontSize: '14px',
        lineHeight: 1.6,
        color: '#0F172A',
        minHeight: '100px',
        maxWidth: '100%',
        overflow: 'hidden',
        wordBreak: 'break-word'
      }}>
        <div style={{ maxWidth: '100%', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    )
  }

  async function salvaParagrafoEsistente(featureIndex, titoloAggiornato, descrizioneAggiornata) {
    if (!activeSection) return
    const titoloPulito = titoloAggiornato.trim()
    const descrizionePulita = descrizioneAggiornata.trim()
    if (!titoloPulito || !descrizionePulita) {
      alert('Titolo e descrizione sono obbligatori')
      return
    }

    const htmlFinale = buildHtmlFromEditor(descrizionePulita, editingFeaturePhotos)

    const featuresAggiornate = activeSection.features.map((f, idx) =>
      idx === featureIndex ? serializeFeature(titoloPulito, htmlFinale, editingFeatureAdminOnly) : f
    )

    await salvaSezione(
      { ...activeSection, features: featuresAggiornate },
      { closeForm: false, showSuccess: false }
    )

    setEditingFeatureIndex(null)
    setEditingFeatureTitle('')
    setEditingFeatureDescription('')
    setEditingFeaturePhotos([])
    setDraggedPhotoId(null)
    setEditingFeatureAdminOnly(false)
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredSections = sections.filter(section => {
    if (!normalizedSearch) return true

    const inTitle = section.title.toLowerCase().includes(normalizedSearch)
    const inSubtitle = section.subtitle.toLowerCase().includes(normalizedSearch)
    const inFeatures = section.features.some(feature => {
      const parsed = parseFeature(feature)
      return parsed.title.toLowerCase().includes(normalizedSearch) || parsed.description.toLowerCase().includes(normalizedSearch)
    })

    return inTitle || inSubtitle || inFeatures
  })

  useEffect(() => {
    if (!filteredSections.length) return
    if (!activeSectionId) {
      setActiveSectionId(filteredSections[0].id)
      return
    }
    const exists = filteredSections.some(section => section.id === activeSectionId)
    if (!exists) {
      setActiveSectionId(filteredSections[0].id)
    }
  }, [activeSectionId, filteredSections])

  useEffect(() => {
    setExpandedFeatures([])
    setEditingFeatureIndex(null)
    setEditingFeatureTitle('')
    setEditingFeatureDescription('')
    setEditingFeaturePhotos([])
    setDraggedPhotoId(null)
    setEditingFeatureAdminOnly(false)
  }, [activeSectionId])

  const activeSection = filteredSections.find(section => section.id === activeSectionId) || filteredSections[0]
  const visibleFeatures = activeSection
    ? activeSection.features
      .map((feature, originalIndex) => ({
        originalIndex,
        parsed: parseFeature(feature)
      }))
      .filter(item => {
        // Nascondi paragrafi adminOnly agli utenti non-admin
        if (item.parsed.adminOnly && !isAdmin) return false
        
        if (!normalizedSearch) return true
        return item.parsed.title.toLowerCase().includes(normalizedSearch) || item.parsed.description.toLowerCase().includes(normalizedSearch)
      })
    : []

  if (showAddSection) {
    return <FormNuovaSezione 
      onSave={aggiungiNuovaSezione}
      onCancel={() => setShowAddSection(false)}
      isSaving={isSaving}
      isMobile={isMobile}
    />
  }

  if (editingSection) {
    return <FormModificaSezione 
      section={editingSection}
      onSave={salvaSezione}
      onCancel={() => setEditingSection(null)}
      onDelete={() => eliminaSezione(editingSection.id)}
      isSaving={isSaving}
      isMobile={isMobile}
    />
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#FFFFFF',
        overflow: 'auto',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '10px' : 0,
        marginBottom: '10px'
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#007AFF',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: isMobile ? '52px' : '20px',
            marginLeft: isMobile ? '-8px' : '0',
            alignSelf: isMobile ? 'flex-start' : 'auto',
            width: 'auto',
            textAlign: 'left',
            paddingLeft: 0,
            paddingRight: 0
          }}
        >
          ← Indietro
        </button>

        {isAdmin && (
          <div style={{
            display: 'flex',
            gap: '10px',
            marginTop: isMobile ? '0' : '20px',
            flexWrap: isMobile ? 'wrap' : 'nowrap'
          }}>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              style={{
                background: isEditMode ? '#FF3B30' : '#007AFF',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                flex: isMobile ? 1 : 'unset',
                minHeight: '42px'
              }}
            >
              {isEditMode ? 'Esci da Modifica' : 'Modifica'}
            </button>
            {isEditMode && (
              <button
                onClick={() => setShowAddSection(true)}
                style={{
                  background: '#34C759',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  flex: isMobile ? 1 : 'unset',
                  minHeight: '42px'
                }}
              >
                Aggiungi Sezione
              </button>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '18px',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          minHeight: isMobile ? 'auto' : 'calc(100vh - 180px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
        }}
      >
        <aside
          style={{
            width: isMobile ? '100%' : '290px',
            borderRight: isMobile ? 'none' : '1px solid #E5E7EB',
            borderBottom: isMobile ? '1px solid #E5E7EB' : 'none',
            background: '#F8FAFC',
            padding: '14px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px', fontWeight: 700 }}>
            GUIDA FUNZIONI {isEditMode && <span style={{color: '#FF3B30'}}>(MODALITÀ MODIFICA)</span>}
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca sezione o funzione..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '9px 11px',
              fontSize: '13px',
              marginBottom: '10px',
              outline: 'none',
              background: '#FFFFFF'
            }}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              gap: '8px',
              overflowX: isMobile ? 'auto' : 'visible',
              paddingBottom: isMobile ? '6px' : 0
            }}
          >
            {filteredSections.map(section => {
              const isActive = section.id === activeSectionId
              return (
                <div key={section.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setActiveSectionId(section.id)}
                    style={{
                      minWidth: isMobile ? '240px' : '100%',
                      width: '100%',
                      textAlign: 'left',
                      border: isActive ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                      background: isActive ? '#EFF6FF' : '#FFFFFF',
                      color: '#0F172A',
                      borderRadius: '10px',
                      padding: isEditMode ? '10px 46px 10px 12px' : '10px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
                      <span>{section.icon}</span>
                      <span>{section.title}</span>
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748B' }}>{section.subtitle}</div>
                  </button>
                  {isEditMode && (
                    <button
                      onClick={() => setEditingSection(section)}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: '#007AFF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {filteredSections.length === 0 && (
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
              Nessun risultato trovato.
            </div>
          )}
        </aside>

        <main style={{ flex: 1, padding: isMobile ? '16px' : '24px', background: '#FFFFFF', overflowY: 'auto' }}>
          {!activeSection ? (
            <div style={{ color: '#64748B', fontSize: '15px' }}>
              Nessuna sezione da mostrare. Prova a modificare la ricerca.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px' }}>{activeSection.icon}</span>
                  <div>
                    <h2 style={{ margin: 0, color: '#0F172A', fontSize: '24px' }}>{activeSection.title}</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '14px' }}>{activeSection.subtitle}</p>
                  </div>
                </div>
                {isEditMode && (
                  <button
                    onClick={async () => {
                      const updatedSection = {
                        ...activeSection,
                        features: [...(activeSection.features || []), serializeFeature('', '')]
                      }
                      await salvaSezione(updatedSection)
                    }}
                    style={{
                      background: '#34C759',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Aggiungi Paragrafo
                  </button>
                )}
              </div>

              <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
                {visibleFeatures.map((featureItem) => {
                  const isExpanded = expandedFeatures.includes(featureItem.originalIndex)
                  const isEditingThis = editingFeatureIndex === featureItem.originalIndex

                  return (
                    <div
                      key={featureItem.originalIndex}
                      onClick={() => !isEditingThis && toggleFeature(featureItem.originalIndex)}
                      style={{
                        border: featureItem.parsed.adminOnly ? '2px solid #FCD34D' : '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        background: featureItem.parsed.adminOnly ? '#FFFBEB' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        position: 'relative'
                      }}
                    >
                      {featureItem.parsed.adminOnly && isEditMode && (
                        <div style={{ position: 'absolute', top: '6px', right: '10px', fontSize: '12px', fontWeight: 'bold', color: '#92400E', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>
                          SOLO ADMIN
                        </div>
                      )}
                      {isEditingThis ? (
                        <>
                          <input
                            type="text"
                            value={editingFeatureTitle}
                            onChange={(e) => setEditingFeatureTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Titolo (visibile a tendina chiusa)"
                            style={{
                              width: '100%',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px',
                              padding: '10px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              marginBottom: '8px',
                              outline: 'none'
                            }}
                          />

                          <div style={{ marginBottom: '8px', padding: '8px', borderRadius: '6px', background: editingFeatureAdminOnly ? '#FEF3C7' : '#F3F4F6', border: editingFeatureAdminOnly ? '1px solid #FCD34D' : '1px solid #E5E7EB' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: editingFeatureAdminOnly ? '#92400E' : '#374151', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={editingFeatureAdminOnly}
                                onChange={(e) => setEditingFeatureAdminOnly(e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              />
                              Solo Admin - nascosto agli utenti normali
                            </label>
                          </div>

                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                              Testo e Foto
                            </label>
                            <textarea
                              ref={textareaRef}
                              value={editingFeatureDescription}
                              onChange={(e) => setEditingFeatureDescription(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="1) Scrivi prima il testo. 2) Poi trascina le foto nelle zone 'prima del paragrafo'."
                              style={{
                                width: '100%',
                                minHeight: '130px',
                                border: '1px solid #CBD5E1',
                                borderRadius: '8px',
                                padding: '10px',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  marcaTestoCommeAdmin(textareaRef.current)
                                }}
                                style={{
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  border: '1px solid #FCD34D',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer'
                                }}
                                title="Marca il testo selezionato come admin-only"
                              >
                                Marca Admin
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  togliMarcaturaAdmin(textareaRef.current)
                                }}
                                style={{
                                  background: '#DBEAFE',
                                  color: '#0369A1',
                                  border: '1px solid #0EA5E9',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer'
                                }}
                                title="Rimuovi marcatura [ADMIN] dal testo selezionato"
                              >
                                Togli Marca
                              </button>
                            </div>
                          </div>

                          <div style={{ marginBottom: '8px', padding: '8px', border: '1px dashed #CBD5E1', borderRadius: '8px', background: '#FAFAFA' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                              📍 Posizione foto (drag & drop)
                            </div>
                            <div style={{ display: 'grid', gap: '6px' }}>
                              {[...Array((paragraphBlocks.length || 0) + 1)].map((_, idx) => (
                                <div
                                  key={`drop-zone-${idx}`}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (draggedPhotoId) {
                                      spostaFotoInParagrafo(draggedPhotoId, idx)
                                      setDraggedPhotoId(null)
                                    }
                                  }}
                                  style={{
                                    border: '1px dashed #94A3B8',
                                    borderRadius: '6px',
                                    padding: '6px 8px',
                                    fontSize: '12px',
                                    color: '#334155',
                                    background: '#FFFFFF'
                                  }}
                                >
                                  {idx < paragraphBlocks.length
                                    ? `Prima del paragrafo ${idx + 1}: ${paragraphBlocks[idx].slice(0, 80)}${paragraphBlocks[idx].length > 80 ? '…' : ''}`
                                    : 'Alla fine del testo'}
                                </div>
                              ))}
                            </div>
                          </div>

                          {editingFeaturePhotos.length > 0 && (
                            <>
                              <div style={{ marginBottom: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                                  📸 Foto ({editingFeaturePhotos.length})
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
                                  {editingFeaturePhotos.map((photo) => (
                                    <div
                                      key={photo.id}
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation()
                                        setDraggedPhotoId(photo.id)
                                      }}
                                      onDragEnd={(e) => {
                                        e.stopPropagation()
                                        setDraggedPhotoId(null)
                                      }}
                                      style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid #CBD5E1' }}
                                    >
                                      <img src={photo.src} alt={photo.alt} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                                      <div style={{ position: 'absolute', bottom: '2px', left: '2px', right: '2px', display: 'flex', gap: '2px' }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            impostaAllineamentoFoto(photo.id, 'left')
                                          }}
                                          style={{
                                            background: photo.align === 'left' ? '#2563EB' : '#64748B',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            width: '20px',
                                            height: '20px',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}
                                          title="Blocca a sinistra"
                                        >
                                          L
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            impostaAllineamentoFoto(photo.id, 'right')
                                          }}
                                          style={{
                                            background: photo.align === 'right' ? '#2563EB' : '#64748B',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            width: '20px',
                                            height: '20px',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}
                                          title="Blocca a destra"
                                        >
                                          R
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            rimuoviFoto(photo.id)
                                          }}
                                          style={{
                                            background: '#EF4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            width: '20px',
                                            height: '20px',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}
                                          title="Rimuovi"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          <div style={{ marginBottom: '8px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                inserisciFoto()
                              }}
                              style={{
                                background: '#9333EA',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                width: '100%'
                              }}
                            >
                            Aggiungi Foto (poi trascina nella posizione)
                            </button>
                          </div>

                          <div style={{ marginBottom: '8px', padding: '10px', background: '#F0F9FF', borderRadius: '6px', border: '1px solid #93C5FD' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#1E40AF', display: 'block', marginBottom: '6px' }}>
                              👁️ ANTEPRIMA WIKIPEDIA-STYLE
                            </label>
                            {renderPreviewParagrafo()}
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                salvaParagrafoEsistente(featureItem.originalIndex, editingFeatureTitle, editingFeatureDescription)
                              }}
                              disabled={isSaving}
                              style={{
                                background: '#007AFF',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                fontSize: '12px',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                opacity: isSaving ? 0.6 : 1,
                                flex: 1
                              }}
                            >
                              Salva
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingFeatureIndex(null)
                                setEditingFeatureTitle('')
                                setEditingFeatureDescription('')
                                setEditingFeaturePhotos([])
                                setDraggedPhotoId(null)
                                setEditingFeatureAdminOnly(false)
                              }}
                              style={{
                                background: '#E5E7EB',
                                color: '#111827',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                flex: 1
                              }}
                            >
                              Annulla
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '8px'
                          }}
                        >
                          <div
                            style={{
                              fontSize: '14px',
                              color: '#0F172A',
                              lineHeight: 1.45,
                              fontWeight: isExpanded ? '600' : '500',
                              flex: 1
                            }}
                          >
                            {!isExpanded ? (
                              <div style={isMobile
                                ? { whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', wordBreak: 'break-word' }
                                : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
                              }>
                                {featureItem.parsed.title}
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gap: '6px' }}>
                                <div style={{ fontWeight: 700 }}>{featureItem.parsed.title}</div>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                  {renderRichDescription(featureItem.parsed.description, isAdmin)}
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isEditMode && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const parsedEditor = parseDescriptionForEditor(featureItem.parsed.description)
                                    setEditingFeatureIndex(featureItem.originalIndex)
                                    setEditingFeatureTitle(featureItem.parsed.title)
                                    setEditingFeatureDescription(parsedEditor.text)
                                    setEditingFeaturePhotos(parsedEditor.photos)
                                    setEditingFeatureAdminOnly(featureItem.parsed.adminOnly)
                                    setDraggedPhotoId(null)
                                  }}
                                  style={{
                                    background: 'transparent',
                                    color: '#007AFF',
                                    border: 'none',
                                    borderRadius: '6px',
                                    width: '26px',
                                    height: '26px',
                                    cursor: 'pointer',
                                    fontSize: '18px'
                                  }}
                                  title="Modifica paragrafo"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (activeSection && window.confirm('Eliminare questo paragrafo?')) {
                                      const featuresAggiornate = activeSection.features.filter((_, idx) => idx !== featureItem.originalIndex)
                                      salvaSezione({ ...activeSection, features: featuresAggiornate }, { closeForm: false, showSuccess: false })
                                    }
                                  }}
                                  style={{
                                    background: 'transparent',
                                    color: '#EF4444',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    padding: 0
                                  }}
                                  title="Elimina paragrafo"
                                >
                                  ✖
                                </button>
                              </>
                            )}
                            <span
                              style={{
                                fontSize: '18px',
                                color: '#64748B',
                                transition: 'transform 0.2s ease',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                              }}
                            >
                              ▼
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div
                style={{
                  marginTop: '18px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: '#F8FAFC',
                  border: '1px dashed #CBD5E1',
                  color: '#334155',
                  fontSize: '13px'
                }}
              >
                Suggerimento: usa la search bar per trovare rapidamente una funzione specifica.
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function FormModificaSezione({ section, onSave, onCancel, onDelete, isSaving, isMobile }) {
  const [formData, setFormData] = useState({
    id: section.id,
    icon: section.icon,
    title: section.title,
    subtitle: section.subtitle
  })

  const salva = () => {
    if (!formData.title.trim() || !formData.subtitle.trim()) {
      alert('Compila titolo e sottotitolo')
      return
    }

    onSave({
      id: formData.id,
      icon: formData.icon,
      title: formData.title,
      subtitle: formData.subtitle,
      features: section.features || []
    })
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#FFFFFF',
      overflow: 'auto',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ marginTop: isMobile ? '52px' : '20px', color: '#0F172A' }}>✏️ Modifica Sezione</h2>
      
      <div style={{ maxWidth: '800px', margin: '20px 0' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            ID Sezione (non modificabile)
          </label>
          <input
            type="text"
            value={formData.id}
            disabled
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '14px',
              background: '#F1F5F9',
              color: '#64748B'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            Icona (emoji)
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['🏠', '🏆', '📅', '🪪', '✂️', '🔔', '📄', '⚙️', '📊', '💬', '🔍', '📱', '🖼️', '📝', '🎯', '🚀', '💡', '🎨', '📈', '🔧', '🏎️', '⚡', '✅'].map(emoji => (
              <button
                key={emoji}
                onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                style={{
                  padding: '8px 12px',
                  fontSize: '24px',
                  border: formData.icon === emoji ? '2px solid #007AFF' : '1px solid #E2E8F0',
                  borderRadius: '8px',
                  background: formData.icon === emoji ? '#EFF6FF' : '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            Titolo
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            Sottotitolo
          </label>
          <input
            type="text"
            value={formData.subtitle}
            onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
          <button
            onClick={salva}
            disabled={isSaving}
            style={{
              background: '#007AFF',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            {isSaving ? '💾 Salvataggio...' : '💾 Salva'}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              background: '#8E8E93',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            Annulla
          </button>
          <button
            onClick={onDelete}
            disabled={isSaving}
            style={{
              background: '#FF3B30',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              marginLeft: 'auto'
            }}
          >
            🗑️ Elimina Sezione
          </button>
        </div>
      </div>
    </div>
  )
}

function FormNuovaSezione({ onSave, onCancel, isSaving, isMobile }) {
  const [formData, setFormData] = useState({
    id: '',
    icon: '📄',
    title: '',
    subtitle: ''
  })

  const salva = () => {
    if (!formData.id || !formData.title || !formData.subtitle) {
      alert('Compila: ID, Titolo, Sottotitolo')
      return
    }

    onSave({
      id: formData.id,
      icon: formData.icon,
      title: formData.title,
      subtitle: formData.subtitle,
      features: []
    })
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#FFFFFF',
      overflow: 'auto',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ marginTop: isMobile ? '52px' : '20px', color: '#0F172A' }}>➕ Aggiungi Nuova Sezione</h2>
      
      <div style={{ maxWidth: '800px', margin: '20px 0' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            ID Sezione (univoco, minuscolo, senza spazi) *
          </label>
          <input
            type="text"
            value={formData.id}
            onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
            placeholder="es: nuova-sezione"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            Icona (emoji)
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['🏠', '🏆', '📅', '🪪', '✂️', '🔔', '📄', '⚙️', '📊', '💬', '🔍', '📱', '🖼️', '📝', '🎯', '🚀', '💡', '🎨', '📈', '🔧', '🏎️', '⚡', '✅'].map(emoji => (
              <button
                key={emoji}
                onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                style={{
                  padding: '8px 12px',
                  fontSize: '24px',
                  border: formData.icon === emoji ? '2px solid #007AFF' : '1px solid #E2E8F0',
                  borderRadius: '8px',
                  background: formData.icon === emoji ? '#EFF6FF' : '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            Titolo *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="es: Nuova Funzione"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
            Sottotitolo *
          </label>
          <input
            type="text"
            value={formData.subtitle}
            onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
            placeholder="es: Descrizione breve della funzione"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '20px', fontStyle: 'italic' }}>
          La sezione verrà creata vuota. Dopo potrai modificarla e aggiungere i paragrafi con testo e foto.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
          <button
            onClick={salva}
            disabled={isSaving}
            style={{
              background: '#34C759',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            {isSaving ? '💾 Salvataggio...' : '✅ Crea Sezione'}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              background: '#8E8E93',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}

export default GuidaFunzioni

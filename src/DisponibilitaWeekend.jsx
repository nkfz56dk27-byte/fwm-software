import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import html2canvas from 'html2canvas'

// ===== MAPPING UTENTE → REDATTORE =====
const UTENTE_TO_REDATTORE = {
  'gcianci': 'Giuseppe',
  'dmuscarella': 'Daniele',
  'msassara': 'Marco',
  'aciancola': 'Alessio',
  'pmanzoni': 'Prisca',
  'fparascandolo': 'Fabrizio',
  'vcaravella': 'Valeria',
  'mluraghi': 'Martina',
  'fdelfini': 'Flavia',
  'nmaruzzo': 'Nicole',
  'sderamo': 'Sofia',
  'vcancelliere': 'Veronica',
  'avalerioti': 'Alessia'
}

// ===== COSTANTI =====
const GIORNI_WEEKEND = [
  { id: 'giovedi', nome: 'Giovedì', emoji: '🔵', colore: 'rgba(0, 122, 255, 0.3)' },
  { id: 'venerdi', nome: 'Venerdì', emoji: '🟢', colore: 'rgba(52, 199, 89, 0.3)' },
  { id: 'sabato', nome: 'Sabato', emoji: '🟠', colore: 'rgba(255, 149, 0, 0.3)' },
  { id: 'domenica', nome: 'Domenica', emoji: '🔴', colore: 'rgba(255, 59, 48, 0.3)' }
]

const CATEGORIE = [
  { id: 'live', nome: '🏁 Live Coverage' },
  { id: 'analisi', nome: '📊 Analisi' },
  { id: 'sintesi', nome: '📝 Sintesi' },
  { id: 'dichiarazioni', nome: '💬 Dichiarazioni' },
  { id: 'news', nome: '📰 News' },
  { id: 'social', nome: '🎙️ Social & Paddock' },
  { id: 'tecnico', nome: '⚖️ FIA & Tecnico' },
  { id: 'opinioni', nome: '✍️ Opinioni' }
]

const TEMPLATE_ARTICOLI = [
  { titolo: 'Dichiarazioni piloti/TP', categoria: 'dichiarazioni', giorno: 'giovedi' },
  { titolo: 'Analisi Brembo - Immagini circuito', categoria: 'tecnico', giorno: 'giovedi' },
  { titolo: 'Live PL1', categoria: 'live', giorno: 'venerdi' },
  { titolo: 'Live PL2', categoria: 'live', giorno: 'venerdi' },
  { titolo: 'Analisi telemetria', categoria: 'analisi', giorno: 'venerdi' },
  { titolo: 'Analisi passo gara', categoria: 'analisi', giorno: 'venerdi' },
  { titolo: 'Analisi/commento', categoria: 'analisi', giorno: 'venerdi' },
  { titolo: 'Sintesi PL1', categoria: 'sintesi', giorno: 'venerdi' },
  { titolo: 'Sintesi PL2', categoria: 'sintesi', giorno: 'venerdi' },
  { titolo: 'Dichiarazioni piloti/TP post PL1', categoria: 'dichiarazioni', giorno: 'venerdi' },
  { titolo: 'Dichiarazioni piloti/TP post PL2', categoria: 'dichiarazioni', giorno: 'venerdi' },
  { titolo: 'News durante PL1', categoria: 'news', giorno: 'venerdi' },
  { titolo: 'News durante PL2', categoria: 'news', giorno: 'venerdi' },
  { titolo: 'Investigazioni e decisioni FIA', categoria: 'tecnico', giorno: 'venerdi' },
  { titolo: 'Bookmakers', categoria: 'tecnico', giorno: 'venerdi' },
  { titolo: 'Tabella parti usate', categoria: 'tecnico', giorno: 'venerdi' },
  { titolo: 'Live PL3', categoria: 'live', giorno: 'sabato' },
  { titolo: 'Live Qualifiche', categoria: 'live', giorno: 'sabato' },
  { titolo: 'Analisi telemetria qualifiche', categoria: 'analisi', giorno: 'sabato' },
  { titolo: 'Analisi strategie qualifiche', categoria: 'analisi', giorno: 'sabato' },
  { titolo: 'Griglia di partenza', categoria: 'tecnico', giorno: 'sabato' },
  { titolo: 'Sintesi PL3', categoria: 'sintesi', giorno: 'sabato' },
  { titolo: 'Sintesi Qualifica', categoria: 'sintesi', giorno: 'sabato' },
  { titolo: 'Dichiarazioni piloti/TP post PL3', categoria: 'dichiarazioni', giorno: 'sabato' },
  { titolo: 'Dichiarazioni piloti/TP post Qualifiche', categoria: 'dichiarazioni', giorno: 'sabato' },
  { titolo: 'News durante PL3', categoria: 'news', giorno: 'sabato' },
  { titolo: 'News durante Qualifiche', categoria: 'news', giorno: 'sabato' },
  { titolo: 'Investigazioni e decisioni FIA', categoria: 'tecnico', giorno: 'sabato' },
  { titolo: 'Aggiornamenti ufficiali scuderie', categoria: 'tecnico', giorno: 'sabato' },
  { titolo: 'Paddock Live (Vanzini/Bobbi/Capelli/Gene)', categoria: 'social', giorno: 'sabato' },
  { titolo: 'Social (Valsecchi/Vanzini/Bobbi)', categoria: 'social', giorno: 'sabato' },
  { titolo: 'Live Gara', categoria: 'live', giorno: 'domenica' },
  { titolo: 'Analisi strategie', categoria: 'analisi', giorno: 'domenica' },
  { titolo: 'Analisi telemetria', categoria: 'analisi', giorno: 'domenica' },
  { titolo: 'Analisi/commento', categoria: 'analisi', giorno: 'domenica' },
  { titolo: 'Sintesi gara', categoria: 'sintesi', giorno: 'domenica' },
  { titolo: 'Dichiarazioni podio P1', categoria: 'dichiarazioni', giorno: 'domenica' },
  { titolo: 'Dichiarazioni podio P2', categoria: 'dichiarazioni', giorno: 'domenica' },
  { titolo: 'Dichiarazioni podio P3', categoria: 'dichiarazioni', giorno: 'domenica' },
  { titolo: 'Dichiarazioni piloti/TP post gara', categoria: 'dichiarazioni', giorno: 'domenica' },
  { titolo: 'News durante gara', categoria: 'news', giorno: 'domenica' },
  { titolo: 'News classifiche aggiornate', categoria: 'news', giorno: 'domenica' },
  { titolo: 'Investigazioni e decisioni FIA', categoria: 'tecnico', giorno: 'domenica' },
  { titolo: 'Race Anatomy', categoria: 'tecnico', giorno: 'domenica' },
  { titolo: 'Paddock Live (Vanzini/Bobbi/Capelli/Gene)', categoria: 'social', giorno: 'domenica' },
  { titolo: 'Social (Valsecchi/Vanzini/Bobbi/Capelli/Gene)', categoria: 'social', giorno: 'domenica' },
  { titolo: 'Opinioni blog (Turrini/Zapelloni/Mazzola)', categoria: 'opinioni', giorno: 'domenica' }
]

const REDATTORI_DEFAULT = [
  'Alessia', 'Alessio', 'Daniele', 'Fabrizio', 'Flavia', 'Giuseppe', 
  'Marco', 'Martina', 'Mattia', 'Nicole', 'Prisca', 'Sofia', 'Valeria'
]

// ===== UTILITY FUNCTIONS =====
function renderTextWithBold(text, ranges) {
  if (!ranges || ranges.length === 0) {
    return <span>{text}</span>
  }

  const parts = []
  let lastIndex = 0

  ranges.sort((a, b) => a.start - b.start).forEach(range => {
    if (range.start > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, range.start)}</span>)
    }
    parts.push(<strong key={`bold-${range.start}`}>{text.substring(range.start, range.end)}</strong>)
    lastIndex = range.end
  })

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>)
  }

  return <>{parts}</>
}

function getWordsFromText(text) {
  const words = []
  let currentWord = ''
  
  for (let char of text) {
    if (/[a-zA-Z0-9àèéìòùÀÈÉÌÒÙ]/.test(char)) {
      currentWord += char
    } else {
      if (currentWord) {
        words.push(currentWord)
        currentWord = ''
      }
    }
  }
  if (currentWord) words.push(currentWord)
  
  return [...new Set(words)]
}

// ===== COMPONENTE PRINCIPALE =====
export default function DisponibilitaWeekend({ utenteCorrente, onClose, onNotificheChange, categoria }) {
  const [weekends, setWeekends] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNuovo, setShowNuovo] = useState(false)
  const [modalitaModifica, setModalitaModifica] = useState(false)
  const [notifiche, setNotifiche] = useState([])
  const [showNotifiche, setShowNotifiche] = useState(false)
  const [categorie, setCategorie] = useState([])
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000)
  
  const isAdmin = utenteCorrente?.ruolo === 'admin'
  const isMobile = windowWidth <= 768
  const nomeRedattore = UTENTE_TO_REDATTORE[utenteCorrente?.username] || utenteCorrente?.nomeCompleto || ''

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    document.title = categoria ? `FWM - Disponibilità ${categoria.nome}` : "FWM - Disponibilità Weekend"
  }, [categoria])

  useEffect(() => {
  caricaWeekends()
  caricaCategorie()
  caricaNotifiche()
}, [])

useEffect(() => {
  if (!utenteCorrente) return

  console.log('[NOTIFICHE] Attivazione realtime')

  const channel = supabase
    .channel('notifiche_disponibilita_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifiche_disponibilita'
      },
      () => {
        console.log('[NOTIFICHE] Realtime update')
        caricaNotifiche()
        if (onNotificheChange) onNotificheChange()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [utenteCorrente])


  async function caricaCategorie() {
    const { data } = await supabase
      .from('categorie_weekend')
      .select('*')
      .order('created_at', { ascending: true })
    setCategorie(data || [])
  }

  async function caricaWeekends() {
    let query = supabase
      .from('weekend')
      .select(`*, articoli:articoli(*)`)
      .order('data_creazione', { ascending: false })
    
    // Filtra per categoria se specificata
    if (categoria?.id) {
      query = query.eq('categoria_id', categoria.id)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Errore caricamento:', error)
      setLoading(false)
      return
    }
    
    setWeekends(data || [])
    setLoading(false)
  }

  async function eliminaWeekend(id) {
    const { error } = await supabase.from('weekend').delete().eq('id', id)
    if (!error) caricaWeekends()
  }

  async function caricaNotifiche() {
    try {
      const { data: tutteNotifiche } = await supabase
        .from('notifiche_disponibilita')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      const { data: lette } = await supabase
        .from('notifiche_disponibilita_lette')
        .select('notifica_id')
        .eq('username', utenteCorrente.username)
      
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      const notificheConStato = (tutteNotifiche || []).map(n => ({ 
        ...n, 
        letta: idsLette.has(n.id) 
      }))
      
      setNotifiche(notificheConStato)
      
      if (onNotificheChange) {
        onNotificheChange()
      }
    } catch (err) {
      console.error('Errore caricamento notifiche:', err)
    }
  }

  async function creaNotifica(messaggio, weekend_id = null) {
    try {
      await supabase.from('notifiche_disponibilita').insert({ 
        messaggio, 
        weekend_id 
      })
      await caricaNotifiche()
    } catch (err) {
      console.error('Errore creazione notifica:', err)
    }
  }

  async function segnaComeLetta(notificaId) {
    try {
      await supabase.from('notifiche_disponibilita_lette').insert({ 
        username: utenteCorrente.username, 
        notifica_id: notificaId 
      })
      await caricaNotifiche()
    } catch (err) {
      console.error('Errore segna come letta:', err)
    }
  }

  async function segnaTutteComeLette() {
    try {
      const nonLette = notifiche.filter(n => !n.letta)
      for (const n of nonLette) {
        await supabase.from('notifiche_disponibilita_lette').insert({ 
          username: utenteCorrente.username, 
          notifica_id: n.id 
        })
      }
      await caricaNotifiche()
    } catch (err) {
      console.error('Errore segna tutte come lette:', err)
    }
  }

  useEffect(() => {
    if (utenteCorrente) {
      caricaNotifiche()
    }
  }, [utenteCorrente])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            Disponibilità Weekend
            {categoria && <span style={{ color: categoria.colore, marginLeft: '10px' }}>- {categoria.nome}</span>}
          </div>
          {isAdmin && <div style={{ fontSize: '12px', color: '#FF9500' }}>Admin</div>}
        </div>
        {isAdmin ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setShowNotifiche(true)} 
              style={{ 
                position: 'relative',
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '8px 16px', 
                background: '#007AFF', 
                color: 'white', 
                border: 'none', 
                borderRadius: '10px', 
                fontSize: '16px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              🔔 Notifiche
              {notifiche.filter(n => !n.letta).length > 0 && (
                <span style={{ 
                  position: 'absolute', 
                  top: '-5px', 
                  right: '-5px', 
                  background: '#FF3B30', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '20px', 
                  height: '20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '10px', 
                  fontWeight: 'bold' 
                }}>
                  {notifiche.filter(n => !n.letta).length}
                </span>
              )}
            </button>
            <button onClick={() => setModalitaModifica(!modalitaModifica)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: modalitaModifica ? '#007AFF' : '#FF9500', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              {modalitaModifica ? '✓ Fine' : 'Modifica'}
            </button>
            <button onClick={() => setShowNuovo(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#34C759', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>+ Nuovo</button>
          </div>
        ) : (
          <button 
            onClick={() => setShowNotifiche(true)} 
            style={{ 
              position: 'relative',
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              background: '#007AFF', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              fontSize: '16px', 
              fontWeight: '600', 
              cursor: 'pointer' 
            }}
          >
            🔔 Notifiche
            {notifiche.filter(n => !n.letta).length > 0 && (
              <span style={{ 
                position: 'absolute', 
                top: '-5px', 
                right: '-5px', 
                background: '#FF3B30', 
                color: 'white', 
                borderRadius: '50%', 
                width: '20px', 
                height: '20px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '10px', 
                fontWeight: 'bold' 
              }}>
                {notifiche.filter(n => !n.letta).length}
              </span>
            )}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px', color: '#666' }}>Caricamento...</div>
        ) : weekends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px' }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}></div>
            <div style={{ fontSize: '20px', color: '#666', marginBottom: '10px' }}>Nessun weekend disponibile</div>
            {isAdmin && <div style={{ fontSize: '14px', color: '#999' }}>Clicca "Nuovo" per creare la prima tabella</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px', margin: '0 auto' }}>
            {weekends.map(weekend => (
              <WeekendCard key={weekend.id} weekend={weekend} categorie={categorie} isAdmin={isAdmin} nomeUtente={nomeRedattore} modalitaModifica={modalitaModifica} onDelete={() => eliminaWeekend(weekend.id)} onUpdate={caricaWeekends} isMobile={isMobile} />
            ))}
          </div>
        )}
      </div>

      {showNuovo && <NuovoWeekendModal categoria={categoria} onClose={() => setShowNuovo(false)} onCreated={() => { setShowNuovo(false); caricaWeekends(); }} onCreaNotifica={creaNotifica} />}
      
      {showNotifiche && (
        <NotificheModal 
          notifiche={notifiche} 
          onClose={() => setShowNotifiche(false)} 
          onSegnaLetta={segnaComeLetta} 
          onSegnaTutteLette={segnaTutteComeLette} 
        />
      )}
    </div>
  )
}

function WeekendCard({ weekend, categorie, isAdmin, nomeUtente, modalitaModifica, onDelete, onUpdate, isMobile }) {
  const [showDettaglio, setShowDettaglio] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const articoli = weekend.articoli || []
  const totale = articoli.length
  const assegnati = articoli.filter(a => a.stato === 'assegnato').length
  const percentuale = totale > 0 ? Math.round((assegnati / totale) * 100) : 0
  const mieiArticoli = articoli.filter(a => a.assegnato_a === nomeUtente).length
  
  // Trova la categoria del weekend
  const categoriaWeekend = categorie.find(c => c.id === weekend.categoria_id)
  const colore = categoriaWeekend?.colore || '#8E8E93'

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setShowDettaglio(true)} 
        style={{ 
          width: '100%', 
          padding: '20px', 
          background: 'white', 
          border: `4px solid ${colore}`,
          borderRadius: '15px', 
          boxShadow: `0 4px 12px ${colore}40`,
          cursor: 'pointer', 
          textAlign: 'left' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{weekend.nome_gp}</div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {weekend.data}
              {categoriaWeekend && <span style={{ marginLeft: '10px', color: colore, fontWeight: 'bold' }}>• {categoriaWeekend.nome}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', marginRight: isAdmin ? '35px' : '0' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: percentuale > 70 ? '#34C759' : '#FF9500' }}>{percentuale}%</div>
            <div style={{ fontSize: '12px', color: '#666' }}>completato</div>
          </div>
        </div>
        <div style={{ height: '8px', background: '#eee', borderRadius: '4px', marginBottom: '15px', overflow: 'hidden' }}>
          <div style={{ width: `${percentuale}%`, height: '100%', background: '#34C759' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#666' }}>
          <span>👥 {weekend.redattori?.length || 0} redattori</span>
          <span>📄 {totale} articoli</span>
          {mieiArticoli > 0 && <span style={{ color: '#34C759', fontWeight: 'bold' }}>✓ {mieiArticoli} tuoi</span>}
        </div>
      </button>

      {isAdmin && modalitaModifica && (
        <button onClick={() => setShowDeleteConfirm(true)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '20px', color: '#FF3B30', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>✕</button>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>✕ Elimina Weekend</div>
            <div style={{ marginBottom: '20px', color: '#666' }}>Sei sicuro di voler eliminare il weekend {weekend.nome_gp}?<br/><br/>Questa azione non può essere annullata.</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => { onDelete(); setShowDeleteConfirm(false) }} style={{ padding: '10px 20px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {showDettaglio && <RedattoreWeekendView weekend={weekend} categorie={categorie} nomeRedattore={nomeUtente} isAdmin={isAdmin} onClose={() => { setShowDettaglio(false); onUpdate() }} onDelete={onDelete} isMobile={isMobile} />}
    </div>
  )
}


function NuovoWeekendModal({ categoria, onClose, onCreated, onCreaNotifica }) {
  const [nomeGP, setNomeGP] = useState('')
  const [date, setDate] = useState('')
  const [usaTemplate, setUsaTemplate] = useState(true)
  const [redattori, setRedattori] = useState(new Set(REDATTORI_DEFAULT))
  const [nuovoRedattore, setNuovoRedattore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [categorie, setCategorie] = useState([])
  const [categoriaSelezionata, setCategoriaSelezionata] = useState(categoria?.id || null)
  const [templates, setTemplates] = useState([])
  const [templateSelezionato, setTemplateSelezionato] = useState(null)

  useEffect(() => {
    caricaCategorie()
  }, [])

  useEffect(() => {
    if (categoriaSelezionata) {
      caricaRedattoriCategoria(categoriaSelezionata)
      caricaTemplates(categoriaSelezionata)
    } else {
      setRedattori(new Set(REDATTORI_DEFAULT))
      setTemplates([])
      setTemplateSelezionato(null)
    }
  }, [categoriaSelezionata])

  async function caricaCategorie() {
    const { data } = await supabase
      .from('categorie_weekend')
      .select('*')
      .order('created_at', { ascending: true })
    setCategorie(data || [])
  }

  async function caricaTemplates(categoriaId) {
    const { data } = await supabase
      .from('template_articoli')
      .select('*')
      .eq('categoria_id', categoriaId)
      .order('nome')
    
    setTemplates(data || [])
    // Se c'è solo un template, selezionalo automaticamente
    if (data && data.length === 1) {
      setTemplateSelezionato(data[0].id)
    }
  }

  async function caricaRedattoriCategoria(categoriaId) {
    // Carica username redattori assegnati a questa categoria
    const { data: gruppi } = await supabase
      .from('gruppi_redattori')
      .select('username')
      .eq('categoria_id', categoriaId)
    
    if (gruppi && gruppi.length > 0) {
      // Carica nomi completi
      const { data: utenti } = await supabase
        .from('utenti')
        .select('username, nome_completo')
        .in('username', gruppi.map(g => g.username))
      
      const nomiCompleti = utenti?.map(u => u.nome_completo || u.username) || []
      setRedattori(new Set(nomiCompleti))
    } else {
      setRedattori(new Set(REDATTORI_DEFAULT))
    }
  }

  async function creaWeekend() {
    if (!nomeGP || !date) return
    setSalvando(true)
    
    const { data: weekend, error: errorWeekend } = await supabase
      .from('weekend')
      .insert({ 
        nome_gp: nomeGP, 
        data: date, 
        redattori: Array.from(redattori).sort(),
        categoria_id: categoriaSelezionata
      })
      .select()
      .single()
    
    if (errorWeekend) {
      console.error('Errore creazione weekend:', errorWeekend)
      alert('Errore nella creazione del weekend')
      setSalvando(false)
      return
    }
    
    if (usaTemplate && templateSelezionato) {
      // Carica il template selezionato
      const template = templates.find(t => t.id === parseInt(templateSelezionato))
      if (template && template.articoli) {
        const articoli = template.articoli.map(t => ({ 
          weekend_id: weekend.id, 
          titolo: t.titolo, 
          categoria: t.categoria, 
          giorno: t.giorno, 
          stato: 'libero', 
          range_grassetto: t.range_grassetto || [] 
        }))
        const { error: errorArticoli } = await supabase.from('articoli').insert(articoli)
        if (errorArticoli) console.error('Errore creazione articoli:', errorArticoli)
      }
    } else if (usaTemplate) {
      // Fallback al template hardcoded se nessun template selezionato
      const articoli = TEMPLATE_ARTICOLI.map(t => ({ 
        weekend_id: weekend.id, 
        titolo: t.titolo, 
        categoria: t.categoria, 
        giorno: t.giorno, 
        stato: 'libero', 
        range_grassetto: [] 
      }))
      const { error: errorArticoli } = await supabase.from('articoli').insert(articoli)
      if (errorArticoli) console.error('Errore creazione articoli:', errorArticoli)
    }
    
    // Crea notifica (non blocca se fallisce)
    try {
      if (onCreaNotifica) {
        await onCreaNotifica(`Nuovo weekend aperto: ${nomeGP} (${date})`, weekend.id)
      }
    } catch (err) {
      console.error('Errore creazione notifica:', err)
    }
    
    setSalvando(false)
    onCreated()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Nuova Tabella Weekend</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Nome GP</div>
              <input type="text" placeholder="es: GP Abu Dhabi" value={nomeGP} onChange={e => setNomeGP(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Date</div>
              <input type="text" placeholder="es: 5-7 Dicembre 2024" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Categoria</div>
              <select 
                value={categoriaSelezionata || ''} 
                onChange={e => setCategoriaSelezionata(e.target.value || null)} 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid #ddd', 
                  fontSize: '16px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">Nessuna categoria</option>
                {categorie.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
            </div>
            <div style={{ height: '1px', background: '#e0e0e0' }}></div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>📋 Template Articoli</div>
              
              {templates.length > 0 ? (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <select
                      value={templateSelezionato || ''}
                      onChange={e => {
                        setTemplateSelezionato(e.target.value || null)
                        setUsaTemplate(!!e.target.value)
                      }}
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        borderRadius: '8px', 
                        border: '1px solid #ddd', 
                        fontSize: '14px',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Nessun template (crea manualmente)</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.nome} ({t.articoli?.length || 0} articoli)</option>
                      ))}
                    </select>
                  </div>
                  {templateSelezionato && (
                    <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '8px', fontSize: '12px', color: '#666' }}>
                      ✓ Verranno creati {templates.find(t => t.id === parseInt(templateSelezionato))?.articoli?.length || 0} articoli
                    </div>
                  )}
                </>
              ) : categoriaSelezionata ? (
                <div style={{ padding: '12px', background: '#FFF3CD', borderRadius: '8px', fontSize: '14px', color: '#856404' }}>
                  ⚠️ Nessun template disponibile per questa categoria. <br />
                  <span style={{ fontSize: '12px' }}>Vai in Gestione → Template Articoli per crearne uno.</span>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={usaTemplate} onChange={e => setUsaTemplate(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                  <span>Usa template standard (47 articoli)</span>
                </label>
              )}
            </div>
            <div style={{ height: '1px', background: '#e0e0e0' }}></div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>👥 Redattori disponibili</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                {Array.from(redattori).sort().map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#34C7591A', borderRadius: '8px' }}>
                    <span style={{ color: '#34C759', fontSize: '18px' }}>✓</span>
                    <span style={{ fontSize: '14px', flex: 1 }}>{r}</span>
                    <button onClick={() => { const newSet = new Set(redattori); newSet.delete(r); setRedattori(newSet) }} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="Aggiungi redattore..." value={nuovoRedattore} onChange={e => setNuovoRedattore(e.target.value)} onKeyPress={e => { if (e.key === 'Enter' && nuovoRedattore.trim()) { setRedattori(new Set([...redattori, nuovoRedattore.trim()])); setNuovoRedattore('') }}} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
                <button onClick={() => { if (nuovoRedattore.trim()) { setRedattori(new Set([...redattori, nuovoRedattore.trim()])); setNuovoRedattore('') }}} style={{ padding: '8px 16px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Aggiungi</button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Annulla</button>
          <button onClick={creaWeekend} disabled={!nomeGP || !date || salvando} style={{ padding: '10px 20px', background: (!nomeGP || !date || salvando) ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: (!nomeGP || !date || salvando) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Creazione...' : 'Crea Tabella'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RedattoreWeekendView({ weekend, nomeRedattore, isAdmin, onClose, onDelete, isMobile }) {
  const [articoli, setArticoli] = useState([])
  const [articoliSelezionati, setArticoliSelezionati] = useState(new Set())
  const [expandedDays, setExpandedDays] = useState(new Set())
  const [showAdminView, setShowAdminView] = useState(false)
  const [showTabella, setShowTabella] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    caricaArticoli()
  }, [weekend.id])

  async function caricaArticoli() {
    const { data } = await supabase.from('articoli').select('*').eq('weekend_id', weekend.id).order('giorno').order('categoria')
    setArticoli(data || [])
    const miei = data?.filter(a => a.assegnato_a === nomeRedattore).map(a => a.id) || []
    setArticoliSelezionati(new Set(miei))
  }

  async function salvaArticoli(conferma = false) {
    setSalvando(true)
    for (const id of articoliSelezionati) {
      await supabase.from('articoli').update({ stato: 'assegnato', assegnato_a: nomeRedattore }).eq('id', id)
    }
    const articoliMiei = articoli.filter(a => a.assegnato_a === nomeRedattore)
    for (const art of articoliMiei) {
      if (!articoliSelezionati.has(art.id)) {
        await supabase.from('articoli').update({ stato: 'libero', assegnato_a: null }).eq('id', art.id)
      }
    }
    setSalvando(false)
    if (conferma) {
      if (articoliSelezionati.size > 0) {
        alert(`✅ Confermati ${articoliSelezionati.size} articoli per ${nomeRedattore}!`)
      } else {
        alert(`✅ Selezione aggiornata! ${nomeRedattore} non ha articoli assegnati.`)
      }
    }
    caricaArticoli()
  }

  function toggleGiorno(giorno) {
    const newSet = new Set(expandedDays)
    if (newSet.has(giorno)) newSet.delete(giorno)
    else newSet.add(giorno)
    setExpandedDays(newSet)
  }

  function toggleArticolo(articoloId, articolo) {
    const newSet = new Set(articoliSelezionati)
    if (newSet.has(articoloId)) {
      newSet.delete(articoloId)
    } else if (articolo.stato === 'libero' || articolo.assegnato_a === nomeRedattore) {
      newSet.add(articoloId)
    } else {
      alert(`❌ Articolo già assegnato a ${articolo.assegnato_a}`)
      return
    }
    setArticoliSelezionati(newSet)
  }

  const articoliPerGiorno = GIORNI_WEEKEND.map(g => ({ ...g, articoli: articoli.filter(a => a.giorno === g.id) }))

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: '#f5f5f7', borderRadius: '15px', width: '900px', height: '700px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', background: 'white', borderBottom: '1px solid #e0e0e0', borderRadius: '15px 15px 0 0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{weekend.nome_gp}</div>
            <div style={{ fontSize: '13px', color: '#666' }}>{weekend.data}</div>
          </div>
          {isAdmin ? (
            <button onClick={() => setShowAdminView(true)} style={{ padding: '6px 12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Tabella Admin</button>
          ) : (
            <div style={{ width: '90px' }}></div>
          )}
        </div>
        <div style={{ padding: '15px 30px', textAlign: 'center', background: 'white' }}>
          <div style={{ fontSize: '16px', marginBottom: '5px', fontWeight: 'bold' }}>👤 Ciao {nomeRedattore}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Seleziona gli articoli di cui ti occuperai:</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {articoliPerGiorno.map(giorno => (
              <GiornoAccordion key={giorno.id} giorno={giorno} articoli={giorno.articoli} isExpanded={expandedDays.has(giorno.id)} articoliSelezionati={articoliSelezionati} nomeRedattore={nomeRedattore} onToggle={() => toggleGiorno(giorno.id)} onToggleArticolo={toggleArticolo} />
            ))}
          </div>
        </div>
        <div style={{ padding: '20px 30px', background: 'white', borderTop: '1px solid #e0e0e0', borderRadius: '0 0 15px 15px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>✅ Hai selezionato {articoliSelezionati.size} articoli</div>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'space-between' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Annulla</button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowTabella(true)} style={{ padding: '10px 20px', background: '#AF52DE', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Mostra Tabella</button>
              <button onClick={() => salvaArticoli(true)} disabled={salvando} style={{ padding: '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Conferma Selezione</button>
            </div>
          </div>
        </div>
        {showTabella && <TabellaWeekendView weekend={weekend} articoli={articoli} onClose={() => setShowTabella(false)} isMobile={isMobile} />}
        {showAdminView && <AdminWeekendView weekend={weekend} articoli={articoli} onClose={() => setShowAdminView(false)} onRefresh={caricaArticoli} isMobile={isMobile} />}
      </div>
    </div>
  )
}

function GiornoAccordion({ giorno, articoli, isExpanded, articoliSelezionati, nomeRedattore, onToggle, onToggleArticolo }) {
  const articoliPerCategoria = {}
  CATEGORIE.forEach(cat => {
    const arts = articoli.filter(a => a.categoria === cat.id)
    if (arts.length > 0) articoliPerCategoria[cat.id] = { categoria: cat, articoli: arts }
  })

  return (
    <div style={{ 
      border: isExpanded ? `3px solid ${giorno.colore.replace('0.3', '1')}` : 'none',
      borderRadius: '10px',
      transition: 'border 0.2s ease'
    }}>
      <button onClick={onToggle} style={{ width: '100%', padding: '15px', background: giorno.colore, border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: 'bold' }}>
        <span>{giorno.emoji} {giorno.nome.toUpperCase()}</span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>
      {isExpanded && (
        <div style={{ marginTop: '10px', padding: '15px', background: 'white', borderRadius: '10px' }}>
          {Object.entries(articoliPerCategoria).map(([catId, { categoria, articoli: arts }]) => (
            <div key={catId} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#666', marginBottom: '10px' }}>{categoria.nome}</div>
              {arts.map(articolo => (
                <ArticoloCheckbox key={articolo.id} articolo={articolo} isSelected={articoliSelezionati.has(articolo.id)} nomeRedattore={nomeRedattore} onToggle={() => onToggleArticolo(articolo.id, articolo)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ArticoloCheckbox({ articolo, isSelected, nomeRedattore, onToggle }) {
  const isLibero = articolo.stato === 'libero'
  const isMio = articolo.assegnato_a === nomeRedattore
  const canSelect = isLibero || isMio
  
  let statoText = '👤 libero', statoColor = '#666', bgColor = 'transparent', checkIcon = '☐', checkColor = '#ccc'
  
  if (isSelected) {
    statoText = '✓ TU'; statoColor = '#34C759'; bgColor = '#34C7591A'; checkIcon = '☑'; checkColor = '#34C759'
  } else if (articolo.assegnato_a && articolo.assegnato_a !== nomeRedattore) {
    statoText = `⚠️ ${articolo.assegnato_a}`; statoColor = '#FF3B30'; bgColor = '#FFEBEE'; checkIcon = '☒'; checkColor = '#FF3B30'
  }

  return (
    <button onClick={onToggle} disabled={!canSelect} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: bgColor, border: 'none', borderRadius: '8px', cursor: canSelect ? 'pointer' : 'not-allowed', marginBottom: '8px', opacity: canSelect ? 1 : 0.6 }}>
      <span style={{ fontSize: '18px', color: checkColor }}>{checkIcon}</span>
      <span style={{ flex: 1, textAlign: 'left', fontSize: '14px', color: canSelect ? '#000' : '#666' }}>
        {renderTextWithBold(articolo.titolo, articolo.range_grassetto)}
      </span>
      <span style={{ fontSize: '12px', color: statoColor, fontWeight: 'bold' }}>{statoText}</span>
    </button>
  )
}

function TabellaWeekendView({ weekend, articoli, onClose, isMobile }) {
  const [zoom, setZoom] = useState(1)
  const redattoriOrdinati = [...(weekend.redattori || [])].sort()
  const articoliPerGiorno = GIORNI_WEEKEND.map(g => ({ giorno: g, articoli: articoli.filter(a => a.giorno === g.id) }))

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Tabella {weekend.nome_gp}</div>
          <div style={{ width: '90px' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', padding: '12px', background: '#f5f5f7', borderBottom: '1px solid #e0e0e0' }}>
          <span style={{ fontSize: '13px', color: '#666', fontWeight: 'bold' }}>🔍 Zoom: {Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} disabled={zoom <= 0.5} style={{ padding: '6px 12px', background: zoom > 0.5 ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: zoom > 0.5 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>−</button>
          <button onClick={() => setZoom(1)} style={{ padding: '6px 16px', background: '#34C759', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>100%</button>
          <button onClick={() => setZoom(Math.min(2.5, zoom + 0.25))} disabled={zoom >= 2.5} style={{ padding: '6px 12px', background: zoom < 2.5 ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: zoom < 2.5 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>+</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <table style={{ borderCollapse: 'collapse', width: 'auto', transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '10px', background: '#ddd', fontWeight: 'bold', fontSize: '12px', width: '120px' }}>GIORNO</th>
                {redattoriOrdinati.map(r => (
                  <th key={r} style={{ border: '1px solid black', padding: '10px', background: '#f0f0f0', fontWeight: 'bold', fontSize: '11px', width: '120px' }}>{r}</th>
                ))}
                <th style={{ border: '1px solid black', padding: '10px', background: '#FFE5CC', fontWeight: 'bold', fontSize: '12px', width: '120px' }}>Liberi</th>
              </tr>
            </thead>
            <tbody>
              {articoliPerGiorno.map(({ giorno, articoli: arts }) => {
                const liberi = arts.filter(a => a.stato === 'libero')
                return (
                  <tr key={giorno.id}>
                    <td style={{ border: '1px solid black', padding: '10px', background: giorno.colore, fontWeight: 'bold', fontSize: '11px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ fontSize: '16px', marginBottom: '5px' }}>{giorno.emoji}</div>
                      <div>{giorno.nome.toUpperCase()}</div>
                    </td>
                    {redattoriOrdinati.map(r => {
                      const articoliRedattore = arts.filter(a => a.assegnato_a === r)
                      return (
                        <td key={r} style={{ border: '1px solid #ccc', padding: '8px', background: giorno.colore.replace('0.3', '0.15'), fontSize: '9px', verticalAlign: 'top', height: '120px', overflow: 'auto' }}>
                          {articoliRedattore.map(a => (
                            <div key={a.id} style={{ marginBottom: '4px' }}>{renderTextWithBold(a.titolo, a.range_grassetto)}</div>
                          ))}
                        </td>
                      )
                    })}
                    <td style={{ border: '1px solid #ccc', padding: '8px', background: giorno.colore.replace('0.3', '0.3'), fontSize: '9px', verticalAlign: 'top', height: '120px', overflow: 'auto' }}>
                      {liberi.map(a => (
                        <div key={a.id} style={{ marginBottom: '4px' }}>{renderTextWithBold(a.titolo, a.range_grassetto)}</div>
                      ))}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td style={{ border: '1px solid black', padding: '10px', background: '#ddd', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>TOT</td>
                {redattoriOrdinati.map(r => {
                  const tot = articoli.filter(a => a.assegnato_a === r).length
                  return (<td key={r} style={{ border: '1px solid black', padding: '10px', background: '#f0f0f0', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>{tot}</td>)
                })}
                <td style={{ border: '1px solid black', padding: '10px', background: '#FFE5CC', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>{articoli.filter(a => a.stato === 'libero').length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


// ===== ADMIN WEEKEND VIEW =====

function AdminWeekendView({ weekend, articoli, onClose, onRefresh, isMobile }) {
  const [selectedTab, setSelectedTab] = useState('riepilogo')
  const [showModifica, setShowModifica] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showGrassetto, setShowGrassetto] = useState(false)

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '1200px', height: '800px', display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{weekend.nome_gp}</div>
            <div style={{ fontSize: '13px', color: '#666' }}>{weekend.data}</div>
          </div>
          {/* MIGLIORAMENTO 2: Menu più visibile */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ padding: '8px 16px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Menu Admin
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '5px', background: 'white', border: '1px solid #ddd', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', zIndex: 1000, minWidth: '220px' }}>
                <button onClick={() => { setShowExport(true); setShowMenu(false) }} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '500' }}>
                  📸 Esporta JPEG
                </button>
                <button onClick={() => { setShowGrassetto(true); setShowMenu(false) }} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid #eee', fontWeight: '500' }}>
                  🔤 Aggiorna Grassetto
                </button>
                <button onClick={() => { setShowModifica(true); setShowMenu(false) }} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid #eee', fontWeight: '500' }}>
                  ✏️ Modifica Tabella
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TAB BAR - MIGLIORAMENTO 1: Rimozione tab Log */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', padding: '0 30px' }}>
          {[
            { id: 'riepilogo', label: 'Riepilogo', icon: '' },
            { id: 'tabella', label: 'Tabella', icon: '' },
            { id: 'nonAssegnati', label: 'Non Assegnati', icon: '' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setSelectedTab(tab.id)} style={{ flex: 1, padding: '12px', background: selectedTab === tab.id ? '#007AFF1A' : 'transparent', border: 'none', borderBottom: selectedTab === tab.id ? '2px solid #007AFF' : '2px solid transparent', color: selectedTab === tab.id ? '#007AFF' : '#666', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {selectedTab === 'riepilogo' && <AdminRiepilogoTab weekend={weekend} articoli={articoli} />}
          {selectedTab === 'tabella' && <AdminTabellaTab weekend={weekend} articoli={articoli} />}
          {selectedTab === 'nonAssegnati' && <AdminNonAssegnatiTab weekend={weekend} articoli={articoli} />}
        </div>

        {/* MODALS */}
        {showModifica && <ModificaTabellaModal weekend={weekend} articoli={articoli} onClose={() => { setShowModifica(false); onRefresh() }} />}
        {showExport && <ExportJPEGModal weekend={weekend} articoli={articoli} onClose={() => setShowExport(false)} />}
        {showGrassetto && <AggiornaGrassettoModal weekend={weekend} articoli={articoli} onClose={() => { setShowGrassetto(false); onRefresh() }} />}
      </div>
    </div>
  )
}

// MIGLIORAMENTO 3: Riepilogo con giorni invece di pallini
function AdminRiepilogoTab({ weekend, articoli }) {
  const totale = articoli.length
  const assegnati = articoli.filter(a => a.stato === 'assegnato').length
  const percentuale = totale > 0 ? Math.round((assegnati / totale) * 100) : 0
  
  const articoliPerGiorno = GIORNI_WEEKEND.map(g => {
    const arts = articoli.filter(a => a.giorno === g.id)
    const ass = arts.filter(a => a.stato === 'assegnato').length
    return { giorno: g, totale: arts.length, assegnati: ass, percentuale: arts.length > 0 ? Math.round((ass / arts.length) * 100) : 0 }
  })

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '30px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>📊 STATO ASSEGNAZIONI</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1, padding: '20px', background: percentuale > 70 ? '#34C7591A' : '#FF95001A', borderRadius: '15px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Completamento</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: percentuale > 70 ? '#34C759' : '#FF9500' }}>{percentuale}%</div>
          </div>
          <div style={{ flex: 1, padding: '20px', background: '#007AFF1A', borderRadius: '15px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Articoli Assegnati</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#007AFF' }}>{assegnati}/{totale}</div>
          </div>
          <div style={{ flex: 1, padding: '20px', background: '#AF52DE1A', borderRadius: '15px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Redattori</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#AF52DE' }}>{weekend.redattori?.length || 0}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>PROGRESSI PER GIORNO</div>
        {articoliPerGiorno.map(({ giorno, totale, assegnati, percentuale }) => (
          <div key={giorno.id} style={{ marginBottom: '15px', padding: '15px', background: 'white', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: '600' }}>{giorno.emoji} {giorno.nome}</span>
              <span style={{ color: '#666' }}>{assegnati}/{totale} ({percentuale}%)</span>
            </div>
            <div style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${percentuale}%`, height: '100%', background: giorno.colore.replace('0.3', '1') }}></div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>👥 REDATTORI</div>
        {weekend.redattori?.sort().map(r => {
          const articoliRedattore = articoli.filter(a => a.assegnato_a === r)
          return (
            <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'white', borderRadius: '10px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{r}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{articoliRedattore.length} articoli confermati</div>
              </div>
              {/* MIGLIORAMENTO 3: Giorni invece di pallini */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {GIORNI_WEEKEND.map(g => {
                  const count = articoliRedattore.filter(a => a.giorno === g.id).length
                  return count > 0 ? (
                    <div key={g.id} style={{ padding: '4px 10px', background: g.colore, borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                      {g.emoji} {count}
                    </div>
                  ) : null
                })}
                {articoliRedattore.length > 0 ? <span style={{ color: '#34C759', fontSize: '18px' }}>✓</span> : <span style={{ color: '#FF9500', fontSize: '12px' }}>⏸️ Non confermato</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AdminTabellaTab({ weekend, articoli }) {
  const [zoom, setZoom] = useState(1)
  const redattoriOrdinati = [...(weekend.redattori || [])].sort()
  const articoliPerGiorno = GIORNI_WEEKEND.map(g => ({ giorno: g, articoli: articoli.filter(a => a.giorno === g.id) }))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', padding: '15px', borderBottom: '1px solid #e0e0e0' }}>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 'bold' }}>🔍 Zoom: {Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} disabled={zoom <= 0.5} style={{ padding: '6px 12px', background: zoom > 0.5 ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: zoom > 0.5 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>−</button>
        <button onClick={() => setZoom(1)} style={{ padding: '6px 16px', background: '#34C759', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>100%</button>
        <button onClick={() => setZoom(Math.min(2.5, zoom + 0.25))} disabled={zoom >= 2.5} style={{ padding: '6px 12px', background: zoom < 2.5 ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: zoom < 2.5 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>+</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <table style={{ borderCollapse: 'collapse', width: 'auto', transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '10px', background: '#ddd', fontWeight: 'bold', fontSize: '12px', width: '120px' }}>GIORNO</th>
              {redattoriOrdinati.map(r => (
                <th key={r} style={{ border: '1px solid black', padding: '10px', background: '#f0f0f0', fontWeight: 'bold', fontSize: '11px', width: '120px' }}>{r}</th>
              ))}
              <th style={{ border: '1px solid black', padding: '10px', background: '#FFE5CC', fontWeight: 'bold', fontSize: '12px', width: '120px' }}>Liberi</th>
            </tr>
          </thead>
          <tbody>
            {articoliPerGiorno.map(({ giorno, articoli: arts }) => {
              const liberi = arts.filter(a => a.stato === 'libero')
              return (
                <tr key={giorno.id}>
                  <td style={{ border: '1px solid black', padding: '10px', background: giorno.colore, fontWeight: 'bold', fontSize: '11px', textAlign: 'center', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '16px', marginBottom: '5px' }}>{giorno.emoji}</div>
                    <div>{giorno.nome.toUpperCase()}</div>
                  </td>
                  {redattoriOrdinati.map(r => {
                    const articoliRedattore = arts.filter(a => a.assegnato_a === r)
                    return (
                      <td key={r} style={{ border: '1px solid #ccc', padding: '8px', background: giorno.colore.replace('0.3', '0.15'), fontSize: '9px', verticalAlign: 'top', height: '120px', overflow: 'auto' }}>
                        {articoliRedattore.map(a => (
                          <div key={a.id} style={{ marginBottom: '4px' }}>{renderTextWithBold(a.titolo, a.range_grassetto)}</div>
                        ))}
                      </td>
                    )
                  })}
                  <td style={{ border: '1px solid #ccc', padding: '8px', background: giorno.colore.replace('0.3', '0.3'), fontSize: '9px', verticalAlign: 'top', height: '120px', overflow: 'auto' }}>
                    {liberi.map(a => (
                      <div key={a.id} style={{ marginBottom: '4px' }}>{renderTextWithBold(a.titolo, a.range_grassetto)}</div>
                    ))}
                  </td>
                </tr>
              )
            })}
            <tr>
              <td style={{ border: '1px solid black', padding: '10px', background: '#ddd', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>TOT</td>
              {redattoriOrdinati.map(r => {
                const tot = articoli.filter(a => a.assegnato_a === r).length
                return (<td key={r} style={{ border: '1px solid black', padding: '10px', background: '#f0f0f0', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>{tot}</td>)
              })}
              <td style={{ border: '1px solid black', padding: '10px', background: '#FFE5CC', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>{articoli.filter(a => a.stato === 'libero').length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// MIGLIORAMENTO 4: Non assegnati con accordion per giorno
function AdminNonAssegnatiTab({ weekend, articoli }) {
  const [expandedDays, setExpandedDays] = useState(new Set())
  const nonAssegnati = articoli.filter(a => a.stato === 'libero')
  const perGiorno = GIORNI_WEEKEND.map(g => ({ giorno: g, articoli: nonAssegnati.filter(a => a.giorno === g.id) }))

  function toggleGiorno(giornoId) {
    const newSet = new Set(expandedDays)
    if (newSet.has(giornoId)) newSet.delete(giornoId)
    else newSet.add(giornoId)
    setExpandedDays(newSet)
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>ARTICOLI NON ASSEGNATI ({nonAssegnati.length})</div>
      {nonAssegnati.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>Tutti gli articoli sono stati assegnati!</div>
        </div>
      ) : (
        perGiorno.map(({ giorno, articoli: arts }) => (
          arts.length > 0 && (
            <div key={giorno.id} style={{ 
              marginBottom: '15px',
              border: expandedDays.has(giorno.id) ? `3px solid ${giorno.colore.replace('0.3', '1')}` : 'none',
              borderRadius: '10px',
              transition: 'border 0.2s ease'
            }}>
              <button onClick={() => toggleGiorno(giorno.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: giorno.colore, border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>
                <span>{giorno.emoji} {giorno.nome} ({arts.length})</span>
                <span>{expandedDays.has(giorno.id) ? '▲' : '▼'}</span>
              </button>
              {expandedDays.has(giorno.id) && (
                <div style={{ marginTop: '10px', paddingLeft: '15px' }}>
                  {arts.map(a => (
                    <div key={a.id} style={{ padding: '10px 15px', background: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: '14px' }}>{renderTextWithBold(a.titolo, a.range_grassetto)}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                        {CATEGORIE.find(c => c.id === a.categoria)?.nome}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ))
      )}
    </div>
  )
}


// ===== MODIFICA TABELLA MODAL =====

function ModificaTabellaModal({ weekend, articoli, onClose }) {
  const [selectedSection, setSelectedSection] = useState('redattori')
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '900px', height: '700px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Modifica Tabella</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '15px 30px', borderBottom: '1px solid #e0e0e0' }}>
          {[
            { id: 'redattori', label: '👥 Redattori' },
            { id: 'articoli', label: '📝 Articoli' }
          ].map(sec => (
            <button key={sec.id} onClick={() => setSelectedSection(sec.id)} style={{ flex: 1, padding: '10px', background: selectedSection === sec.id ? '#007AFF' : '#f0f0f0', color: selectedSection === sec.id ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              {sec.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {selectedSection === 'redattori' && <ModificaRedattoriSection weekend={weekend} articoli={articoli} onUpdate={onClose} />}
          {selectedSection === 'articoli' && <ModificaArticoliSection weekend={weekend} articoli={articoli} onUpdate={onClose} />}
        </div>
      </div>
    </div>
  )
}

function ModificaRedattoriSection({ weekend, articoli, onUpdate }) {
  const [redattori, setRedattori] = useState(new Set(weekend.redattori || []))
  const [nuovoRedattore, setNuovoRedattore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  async function salvaRedattori() {
    setSalvando(true)
    const { error } = await supabase.from('disponibilita_weekend').update({ redattori: Array.from(redattori).sort() }).eq('id', weekend.id)
    if (error) console.error('Errore:', error)
    else alert('✅ Redattori aggiornati!')
    setSalvando(false)
    onUpdate()
  }

  async function eliminaRedattore(r) {
    setSalvando(true)
    await supabase.from('articoli').update({ stato: 'libero', assegnato_a: null }).eq('weekend_id', weekend.id).eq('assegnato_a', r)
    const newSet = new Set(redattori)
    newSet.delete(r)
    setRedattori(newSet)
    await supabase.from('disponibilita_weekend').update({ redattori: Array.from(newSet).sort() }).eq('id', weekend.id)
    setSalvando(false)
    setDeleteConfirm(null)
    alert('✅ Redattore eliminato!')
    onUpdate()
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '25px', padding: '20px', background: '#34C7591A', borderRadius: '10px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Aggiungi Redattore</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="Nome redattore..." value={nuovoRedattore} onChange={e => setNuovoRedattore(e.target.value)} onKeyPress={e => { if (e.key === 'Enter' && nuovoRedattore.trim() && !redattori.has(nuovoRedattore.trim())) { setRedattori(new Set([...redattori, nuovoRedattore.trim()])); setNuovoRedattore('') }}} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          <button onClick={() => { if (nuovoRedattore.trim() && !redattori.has(nuovoRedattore.trim())) { setRedattori(new Set([...redattori, nuovoRedattore.trim()])); setNuovoRedattore('') }}} style={{ padding: '10px 20px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Aggiungi</button>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Redattori ({redattori.size})</div>
        {Array.from(redattori).sort().map(r => {
          const count = articoli.filter(a => a.assegnato_a === r).length
          return (
            <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{r}</div>
                {count > 0 && <div style={{ fontSize: '12px', color: '#666' }}>{count} articoli assegnati</div>}
              </div>
              <button onClick={() => setDeleteConfirm(r)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
          )
        })}
      </div>

      <button onClick={salvaRedattori} disabled={salvando} style={{ width: '100%', padding: '12px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
        {salvando ? 'Salvataggio...' : '💾 Salva Redattori'}
      </button>

      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Elimina Redattore</div>
            <div style={{ marginBottom: '20px', color: '#666' }}>
              Vuoi eliminare '{deleteConfirm}'?<br/><br/>
              {articoli.filter(a => a.assegnato_a === deleteConfirm).length} articoli verranno rilasciati.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => eliminaRedattore(deleteConfirm)} style={{ padding: '10px 20px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModificaArticoliSection({ weekend, articoli, onUpdate }) {
  const [giorno, setGiorno] = useState('giovedi')
  const [categoria, setCategoria] = useState('live')
  const [titolo, setTitolo] = useState('')
  const [rangeGrassetto, setRangeGrassetto] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editArticolo, setEditArticolo] = useState(null)

  async function aggiungiArticolo() {
    if (!titolo.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('articoli').insert({ weekend_id: weekend.id, titolo: titolo.trim(), categoria, giorno, stato: 'libero', range_grassetto: rangeGrassetto })
    if (error) console.error('Errore:', error)
    else { alert('✅ Articolo aggiunto!'); setTitolo(''); setRangeGrassetto([]) }
    setSalvando(false)
    onUpdate()
  }

  async function modificaArticolo() {
    if (!editArticolo || !titolo.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('articoli').update({ titolo: titolo.trim(), categoria, giorno, range_grassetto: rangeGrassetto }).eq('id', editArticolo.id)
    if (error) console.error('Errore:', error)
    else { alert('✅ Articolo modificato!'); setEditArticolo(null); setTitolo(''); setRangeGrassetto([]) }
    setSalvando(false)
    onUpdate()
  }

  async function eliminaArticolo(id) {
    setSalvando(true)
    const { error } = await supabase.from('articoli').delete().eq('id', id)
    if (error) console.error('Errore:', error)
    else alert('✅ Articolo eliminato!')
    setSalvando(false)
    setDeleteConfirm(null)
    onUpdate()
  }

  function iniziaModifica(a) {
    setEditArticolo(a)
    setTitolo(a.titolo)
    setCategoria(a.categoria)
    setGiorno(a.giorno)
    setRangeGrassetto(a.range_grassetto || [])
  }

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ marginBottom: '25px', padding: '20px', background: '#34C7591A', borderRadius: '10px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>{editArticolo ? 'Modifica Articolo' : 'Aggiungi Articolo'}</div>
        
        {/* MIGLIORAMENTO 5: Menu dropdown più grandi e puliti */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#666' }}>Giorno</div>
            <select value={giorno} onChange={e => setGiorno(e.target.value)} style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: '2px solid #ddd', fontSize: '15px', fontWeight: '500', cursor: 'pointer', background: 'white' }}>
              {GIORNI_WEEKEND.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.nome}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#666' }}>Categoria</div>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: '2px solid #ddd', fontSize: '15px', fontWeight: '500', cursor: 'pointer', background: 'white' }}>
              {CATEGORIE.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <RichTextEditor text={titolo} rangeGrassetto={rangeGrassetto} onChange={setTitolo} onRangesChange={setRangeGrassetto} />

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          {editArticolo && (
            <button onClick={() => { setEditArticolo(null); setTitolo(''); setRangeGrassetto([]) }} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
          )}
          <button onClick={editArticolo ? modificaArticolo : aggiungiArticolo} disabled={!titolo.trim() || salvando} style={{ flex: 1, padding: '10px 20px', background: (!titolo.trim() || salvando) ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: (!titolo.trim() || salvando) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Salvataggio...' : editArticolo ? '✓ Salva Modifiche' : '+ Aggiungi Articolo'}
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Articoli per Giorno</div>
        {GIORNI_WEEKEND.map(g => {
          const arts = articoli.filter(a => a.giorno === g.id)
          return arts.length > 0 ? (
            <div key={g.id} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', padding: '10px', background: g.colore, borderRadius: '8px' }}>
                {g.emoji} {g.nome} ({arts.length})
              </div>
              {arts.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px' }}>{renderTextWithBold(a.titolo, a.range_grassetto)}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>
                      {CATEGORIE.find(c => c.id === a.categoria)?.nome} {a.assegnato_a && `• ${a.assegnato_a}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => iniziaModifica(a)} style={{ background: 'none', border: 'none', color: '#007AFF', cursor: 'pointer', fontSize: '16px' }}></button>
                    <button onClick={() => setDeleteConfirm(a)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null
        })}
      </div>

      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Elimina Articolo</div>
            <div style={{ marginBottom: '20px', color: '#666' }}>Sei sicuro di voler eliminare questo articolo?</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => eliminaArticolo(deleteConfirm.id)} style={{ padding: '10px 20px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== RICH TEXT EDITOR =====

function RichTextEditor({ text, rangeGrassetto, onChange, onRangesChange }) {
  const words = getWordsFromText(text)

  function toggleWord(word) {
    let newRanges = [...rangeGrassetto]
    let index = 0
    
    while ((index = text.indexOf(word, index)) !== -1) {
      const start = index
      const end = index + word.length
      const existingIndex = newRanges.findIndex(r => r.start === start && r.end === end)
      
      if (existingIndex !== -1) {
        newRanges.splice(existingIndex, 1)
      } else {
        newRanges.push({ start, end })
      }
      
      index = end
    }
    
    newRanges.sort((a, b) => a.start - b.start)
    onRangesChange(newRanges)
  }

  function isWordBold(word) {
    const index = text.indexOf(word)
    if (index === -1) return false
    return rangeGrassetto.some(r => r.start === index && r.end === index + word.length)
  }

  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>Titolo Articolo</div>
      <textarea value={text} onChange={e => onChange(e.target.value)} placeholder="Scrivi il titolo..." style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
      
      {text && (
        <>
          <div style={{ fontSize: '12px', fontWeight: '600', marginTop: '10px', marginBottom: '5px' }}>👁️ Anteprima:</div>
          <div style={{ padding: '10px', background: '#007AFF1A', borderRadius: '8px', fontSize: '14px', marginBottom: '10px' }}>
            {renderTextWithBold(text, rangeGrassetto)}
          </div>
          
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
            🔤 Clicca per mettere in grassetto:
            {rangeGrassetto.length > 0 && (
              <button onClick={() => onRangesChange([])} style={{ marginLeft: '10px', padding: '4px 8px', background: '#FF3B301A', color: '#FF3B30', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                ✕ Rimuovi tutto
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {words.map(word => (
              <button key={word} onClick={() => toggleWord(word)} style={{ padding: '6px 12px', background: isWordBold(word) ? '#007AFF' : '#f0f0f0', color: isWordBold(word) ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: isWordBold(word) ? 'bold' : 'normal' }}>
                {isWordBold(word) ? '✓' : '○'} {word}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


// ===== MIGLIORAMENTO 6: EXPORT JPEG VERO CON DIMENSIONI DINAMICHE =====

// ===== AGGIORNA GRASSETTO DA TEMPLATE =====

function AggiornaGrassettoModal({ weekend, articoli, onClose }) {
  const [templates, setTemplates] = useState([])
  const [templateSelezionato, setTemplateSelezionato] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aggiornando, setAggiornando] = useState(false)

  useEffect(() => {
    caricaTemplates()
  }, [])

  async function caricaTemplates() {
    setLoading(true)
    const { data } = await supabase
      .from('template_articoli')
      .select('*')
      .order('nome')
    setTemplates(data || [])
    setLoading(false)
  }

  async function aggiornaGrassetto() {
    if (!templateSelezionato) {
      alert('Seleziona un template')
      return
    }

    if (!confirm('Vuoi aggiornare il grassetto di tutti gli articoli usando questo template?\n\nGli articoli verranno matchati per titolo.')) {
      return
    }

    setAggiornando(true)

    const template = templates.find(t => t.id === parseInt(templateSelezionato))
    if (!template || !template.articoli) {
      alert('Template non valido')
      setAggiornando(false)
      return
    }

    let aggiornati = 0

    // Per ogni articolo del weekend
    for (const articolo of articoli) {
      // Trova articolo corrispondente nel template (match per titolo)
      const articoloTemplate = template.articoli.find(a => a.titolo === articolo.titolo)
      
      if (articoloTemplate && articoloTemplate.range_grassetto) {
        // Aggiorna il range_grassetto
        const { error } = await supabase
          .from('articoli')
          .update({ range_grassetto: articoloTemplate.range_grassetto })
          .eq('id', articolo.id)
        
        if (!error) aggiornati++
      }
    }

    setAggiornando(false)
    alert(`✅ Aggiornati ${aggiornati} articoli su ${articoli.length}`)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '600px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>🔤 Aggiorna Grassetto</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        <div style={{ padding: '30px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Caricamento template...</div>
          ) : (
            <>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#007AFF1A', borderRadius: '10px' }}>
                <div style={{ fontSize: '14px', color: '#007AFF', fontWeight: '600' }}>ℹ️ Come funziona</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                  Gli articoli verranno matchati per titolo. Se un articolo del weekend ha lo stesso titolo di un articolo nel template, il grassetto verrà copiato dal template.
                </div>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Seleziona Template</div>
                <select
                  value={templateSelezionato || ''}
                  onChange={e => setTemplateSelezionato(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid #ddd', 
                    fontSize: '16px',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Scegli template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.articoli?.length || 0} articoli)
                    </option>
                  ))}
                </select>
              </div>

              {templateSelezionato && (
                <div style={{ padding: '15px', background: '#34C7591A', borderRadius: '10px', fontSize: '14px', color: '#34C759', fontWeight: '600' }}>
                  ✓ Pronto per aggiornare {articoli.length} articoli
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Annulla</button>
          <button 
            onClick={aggiornaGrassetto} 
            disabled={!templateSelezionato || aggiornando || loading} 
            style={{ 
              padding: '10px 20px', 
              background: (!templateSelezionato || aggiornando || loading) ? '#ccc' : '#34C759', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              cursor: (!templateSelezionato || aggiornando || loading) ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            {aggiornando ? 'Aggiornamento...' : '✓ Aggiorna Grassetto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== EXPORT JPEG MODAL =====

function ExportJPEGModal({ weekend, articoli, onClose }) {
  const [generando, setGenerando] = useState(false)

  async function generaJPEG() {
    setGenerando(true)
    
    try {
      const element = document.getElementById('export-table-hidden')
      if (!element) {
        alert('Errore: elemento non trovato')
        setGenerando(false)
        return
      }

      // Genera canvas con alta risoluzione
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      })
      
      // Converti in JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
      
      // Download
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '') + '_' + 
                        new Date().toTimeString().split(' ')[0].replace(/:/g, '')
      link.download = `${weekend.nome_gp.replace(/\s+/g, '_')}_Tabella_${timestamp}.jpg`
      link.href = dataUrl
      link.click()
      
      alert('✅ Tabella esportata con successo!')
      onClose()
    } catch (error) {
      console.error('Errore export:', error)
      alert('❌ Errore durante l\'esportazione: ' + error.message)
    }
    
    setGenerando(false)
  }

  const redattoriOrdinati = [...(weekend.redattori || [])].sort()
  const articoliPerGiorno = GIORNI_WEEKEND.map(g => ({ giorno: g, articoli: articoli.filter(a => a.giorno === g.id) }))
  
  // Calcola altezza celle basata sul contenuto
  const calcolaAltezzaCella = (articoliCella) => {
    const baseHeight = 80
    const lineHeight = 16
    const lines = articoliCella.reduce((sum, a) => sum + Math.ceil(a.titolo.length / 30), 0)
    return Math.max(baseHeight, lines * lineHeight + 20)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '500px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Esporta Tabella JPEG</div>
          <div style={{ fontSize: '16px', color: '#666', marginBottom: '10px' }}>Crea un'immagine JPEG della tabella weekend</div>
          <div style={{ fontSize: '20px', fontWeight: '600', marginTop: '20px' }}>{weekend.nome_gp}</div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>{weekend.data}</div>
          
          {generando && (
            <div style={{ marginTop: '30px', padding: '20px', background: '#f5f5f7', borderRadius: '10px' }}>
              <div>⏳ Generazione in corso...</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Annulla</button>
          <button onClick={generaJPEG} disabled={generando} style={{ padding: '10px 20px', background: generando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: generando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {generando ? 'Generazione...' : '💾 Genera e Salva JPEG'}
          </button>
        </div>
      </div>

      {/* TABELLA NASCOSTA PER EXPORT - DIMENSIONI DINAMICHE */}
      <div style={{ position: 'fixed', top: '-20000px', left: '-20000px' }}>
        <div id="export-table-hidden" style={{ background: 'white', padding: '40px', width: 'fit-content' }}>
          {/* HEADER */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '42px', fontWeight: 'bold', marginBottom: '10px', color: '#000' }}>{weekend.nome_gp}</div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#666', marginBottom: '8px' }}>DISPONIBILITÀ WEEKEND REDATTORI</div>
            <div style={{ fontSize: '16px', color: '#999' }}>{weekend.data}</div>
          </div>

          {/* TABELLA */}
          <table style={{ borderCollapse: 'collapse', width: 'auto', margin: '0 auto' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '12px', background: '#ddd', fontWeight: 'bold', fontSize: '14px', minWidth: '100px', textAlign: 'center' }}>GIORNO</th>
                {redattoriOrdinati.map(r => (
                  <th key={r} style={{ border: '1px solid #000', padding: '12px', background: '#f0f0f0', fontWeight: 'bold', fontSize: '13px', minWidth: '140px', textAlign: 'center' }}>{r}</th>
                ))}
                <th style={{ border: '1px solid #000', padding: '12px', background: '#FFE5CC', fontWeight: 'bold', fontSize: '14px', minWidth: '140px', textAlign: 'center' }}>Liberi</th>
              </tr>
            </thead>
            <tbody>
              {articoliPerGiorno.map(({ giorno, articoli: arts }) => {
                const liberi = arts.filter(a => a.stato === 'libero')
                const maxArticoliPerCella = Math.max(
                  ...redattoriOrdinati.map(r => arts.filter(a => a.assegnato_a === r).length),
                  liberi.length,
                  1
                )
                const altezzaCella = calcolaAltezzaCella([...arts])
                
                return (
                  <tr key={giorno.id}>
                    <td style={{ border: '1px solid #000', padding: '12px', background: giorno.colore, fontWeight: 'bold', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle', minHeight: `${altezzaCella}px` }}>
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{giorno.emoji}</div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{giorno.nome.toUpperCase()}</div>
                    </td>
                    {redattoriOrdinati.map(r => {
                      const articoliRedattore = arts.filter(a => a.assegnato_a === r)
                      return (
                        <td key={r} style={{ border: '1px solid #ccc', padding: '10px', background: giorno.colore.replace('0.3', '0.1'), fontSize: '11px', verticalAlign: 'top', minHeight: `${altezzaCella}px`, lineHeight: '1.4' }}>
                          {articoliRedattore.map((a, idx) => (
                            <div key={a.id} style={{ marginBottom: idx < articoliRedattore.length - 1 ? '6px' : '0' }}>
                              {renderTextWithBold(a.titolo, a.range_grassetto)}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                    <td style={{ border: '1px solid #ccc', padding: '10px', background: giorno.colore.replace('0.3', '0.25'), fontSize: '11px', verticalAlign: 'top', minHeight: `${altezzaCella}px`, lineHeight: '1.4' }}>
                      {liberi.map((a, idx) => (
                        <div key={a.id} style={{ marginBottom: idx < liberi.length - 1 ? '6px' : '0' }}>
                          {renderTextWithBold(a.titolo, a.range_grassetto)}
                        </div>
                      ))}
                    </td>
                  </tr>
                )
              })}
              
              {/* RIGA TOTALI */}
              <tr>
                <td style={{ border: '1px solid #000', padding: '12px', background: '#ddd', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' }}>TOT</td>
                {redattoriOrdinati.map(r => {
                  const tot = articoli.filter(a => a.assegnato_a === r).length
                  return (
                    <td key={r} style={{ border: '1px solid #000', padding: '12px', background: '#f0f0f0', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' }}>{tot}</td>
                  )
                })}
                <td style={{ border: '1px solid #000', padding: '12px', background: '#FFE5CC', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' }}>
                  {articoli.filter(a => a.stato === 'libero').length}
                </td>
              </tr>
            </tbody>
          </table>

          {/* FOOTER */}
          <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '11px', color: '#999' }}>
            Generato: {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  )
}
function NotificheModal({ notifiche, onClose, onSegnaLetta, onSegnaTutteLette }) {
  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 10000 
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '15px', 
        width: '600px', 
        maxHeight: '90vh', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '20px 30px', 
          borderBottom: '1px solid #e0e0e0' 
        }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>🔔 Notifiche</div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer', 
              color: '#666' 
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 30px' }}>
          {notifiche.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Nessuna notifica
            </div>
          ) : (
            notifiche.map(n => (
              <div 
                key={n.id} 
                onClick={() => !n.letta && onSegnaLetta(n.id)} 
                style={{ 
                  padding: '15px', 
                  background: n.letta ? '#f5f5f7' : '#007AFF15', 
                  borderRadius: '10px', 
                  marginBottom: '10px', 
                  cursor: n.letta ? 'default' : 'pointer', 
                  borderLeft: `4px solid ${n.letta ? '#ccc' : '#007AFF'}` 
                }}
              >
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: n.letta ? 'normal' : 'bold', 
                  marginBottom: '5px' 
                }}>
                  {n.messaggio}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {new Date(n.created_at).toLocaleString('it-IT')}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ 
          padding: '20px 30px', 
          borderTop: '1px solid #e0e0e0', 
          display: 'flex', 
          gap: '10px' 
        }}>
          <button 
            onClick={onSegnaTutteLette} 
            style={{ 
              flex: 1, 
              padding: '12px', 
              background: '#34C759', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            Segna tutte come lette
          </button>
          <button 
            onClick={onClose} 
            style={{ 
              padding: '12px 30px', 
              background: '#007AFF', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
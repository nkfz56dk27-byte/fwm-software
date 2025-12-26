import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const UTENTE_TO_REDATTORE = {
  'alessia.rossi': 'Alessia',
  'alessio.bianchi': 'Alessio',
  'daniele.ferrari': 'Daniele',
  'fabrizio.romano': 'Fabrizio',
  'flavia.conti': 'Flavia',
  'giuseppe.greco': 'Giuseppe',
  'marco.villa': 'Marco',
  'martina.serra': 'Martina',
  'mattia.ricci': 'Mattia',
  'nicole.lombardi': 'Nicole',
  'prisca.gallo': 'Prisca',
  'sofia.marini': 'Sofia',
  'valeria.colombo': 'Valeria'
}

const ARTICOLI_DEFAULT = [
  { titolo: 'Live PL1', categoria: 'live', giorno: 'venerdi' },
  { titolo: 'Live PL2', categoria: 'live', giorno: 'venerdi' },
  { titolo: 'Analisi telemetria PL1', categoria: 'analisi', giorno: 'venerdi' },
  { titolo: 'Analisi telemetria PL2', categoria: 'analisi', giorno: 'venerdi' },
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

function renderTextWithBold(text, ranges) {
  if (!ranges || ranges.length === 0) {
    return <span>{text}</span>
  }
  const parts = []
  let lastIndex = 0
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start)
  sortedRanges.forEach((range, i) => {
    if (range.start > lastIndex) {
      parts.push(<span key={`text-${i}`}>{text.slice(lastIndex, range.start)}</span>)
    }
    parts.push(<strong key={`bold-${i}`}>{text.slice(range.start, range.end)}</strong>)
    lastIndex = range.end
  })
  if (lastIndex < text.length) {
    parts.push(<span key="text-last">{text.slice(lastIndex)}</span>)
  }
  return <>{parts}</>
}

function getArticoloBold(articolo) {
  if (!articolo?.bold_ranges) return articolo?.titolo || ''
  return renderTextWithBold(articolo.titolo, articolo.bold_ranges)
}

const CATEGORIE_COLORI = {
  live: { colore: '#FF3B30', emoji: '🔴' },
  analisi: { colore: '#007AFF', emoji: '📊' },
  sintesi: { colore: '#34C759', emoji: '📝' },
  dichiarazioni: { colore: '#FF9500', emoji: '💬' },
  news: { colore: '#5856D6', emoji: '📰' },
  tecnico: { colore: '#AF52DE', emoji: '⚙️' },
  social: { colore: '#FF2D55', emoji: '📱' },
  opinioni: { colore: '#FFD60A', emoji: '💭' }
}

async function inviaNotificaPush(titolo, corpo) {
  try {
    const { data: tokens } = await supabase.from('fcm_tokens').select('token')
    if (!tokens || tokens.length === 0) {
      console.log('Nessun token FCM trovato')
      return
    }
    console.log('📤 Invio notifica push:', { titolo, corpo, numTokens: tokens.length })
  } catch (error) {
    console.error('Errore invio notifica push:', error)
  }
}

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
  }, [])

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
      if (onNotificheChange) onNotificheChange()
    } catch (error) {
      console.error('Errore caricamento notifiche:', error)
    }
  }

  async function segnaComeLetta(notificaId) {
    await supabase
      .from('notifiche_disponibilita_lette')
      .insert({ username: utenteCorrente.username, notifica_id: notificaId })
    caricaNotifiche()
  }

  async function segnaTutteComeLette() {
    const nonLette = notifiche.filter(n => !n.letta)
    for (const n of nonLette) {
      await supabase
        .from('notifiche_disponibilita_lette')
        .insert({ username: utenteCorrente.username, notifica_id: n.id })
    }
    caricaNotifiche()
  }

  useEffect(() => {
    caricaNotifiche()
  }, [utenteCorrente])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px', color: '#666' }}>
        Caricamento...
      </div>
    )
  }

  const notificheNonLette = notifiche.filter(n => !n.letta).length

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      {/* HEADER RESPONSIVE */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'stretch' : 'center', 
        padding: isMobile ? '10px' : '20px 30px', 
        background: 'white', 
        borderBottom: '1px solid #e0e0e0',
        gap: isMobile ? '10px' : '0'
      }}>
        <button onClick={onClose} style={{ 
          background: 'none', 
          border: 'none', 
          color: '#007AFF', 
          fontSize: isMobile ? '14px' : '18px', 
          fontWeight: 'bold', 
          cursor: 'pointer',
          alignSelf: isMobile ? 'flex-start' : 'auto',
          minHeight: isMobile ? '44px' : 'auto',
          padding: isMobile ? '8px 0' : '0',
          textAlign: 'left'
        }}>← Indietro</button>
        
        <div style={{ textAlign: 'center', order: isMobile ? -1 : 0, padding: isMobile ? '10px 0' : '0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '24px', fontWeight: 'bold', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
            Disponibilità Weekend
            {categoria && <span style={{ color: categoria.colore, marginLeft: isMobile ? '0' : '10px', display: isMobile ? 'block' : 'inline', fontSize: isMobile ? '14px' : '24px', marginTop: isMobile ? '5px' : '0' }}>- {categoria.nome}</span>}
          </div>
          {isAdmin && <div style={{ fontSize: '12px', color: '#FF9500' }}>Admin</div>}
        </div>
        
        {isAdmin ? (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '12px' }}>
            <button 
              onClick={() => setShowNotifiche(true)} 
              style={{ 
                position: 'relative',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '6px', 
                padding: isMobile ? '12px' : '8px 16px', 
                background: '#007AFF', 
                color: 'white', 
                border: 'none', 
                borderRadius: '10px', 
                fontSize: isMobile ? '14px' : '16px', 
                fontWeight: '600', 
                cursor: 'pointer',
                minHeight: isMobile ? '48px' : 'auto'
              }}
            >
              🔔 Notifiche
              {notificheNonLette > 0 && (
                <span style={{ 
                  position: 'absolute', 
                  top: '-5px', 
                  right: '-5px', 
                  background: '#FF3B30', 
                  color: 'white', 
                  borderRadius: '50%', 
                  minWidth: '20px', 
                  height: '20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  padding: '0 5px'
                }}>
                  {notificheNonLette}
                </span>
              )}
            </button>
            <button onClick={() => setModalitaModifica(!modalitaModifica)} style={{ 
              padding: isMobile ? '12px' : '8px 16px', 
              background: '#FF9500', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              fontSize: isMobile ? '14px' : '16px', 
              fontWeight: '600', 
              cursor: 'pointer',
              minHeight: isMobile ? '48px' : 'auto'
            }}>
              {modalitaModifica ? '✓ Chiudi Modifica' : '✏️ Modifica'}
            </button>
            <button onClick={() => setShowNuovo(true)} style={{ 
              padding: isMobile ? '12px' : '8px 16px', 
              background: '#34C759', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              fontSize: isMobile ? '14px' : '16px', 
              fontWeight: '600', 
              cursor: 'pointer',
              minHeight: isMobile ? '48px' : 'auto'
            }}>
              + Nuovo GP
            </button>
          </div>
        ) : (
          <div style={{ width: isMobile ? 'auto' : '180px' }}></div>
        )}
      </div>

      {/* CONTENUTO */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '10px' : '30px' }}>
        {weekends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <div style={{ fontSize: isMobile ? '40px' : '60px', marginBottom: '20px' }}>📅</div>
            <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              Nessun weekend disponibile
            </div>
            {isAdmin && (
              <button onClick={() => setShowNuovo(true)} style={{ 
                marginTop: '20px', 
                padding: isMobile ? '12px 20px' : '10px 20px', 
                background: '#34C759', 
                color: 'white', 
                border: 'none', 
                borderRadius: '10px', 
                fontSize: isMobile ? '14px' : '16px', 
                fontWeight: '600', 
                cursor: 'pointer',
                minHeight: isMobile ? '48px' : 'auto'
              }}>
                + Crea il primo weekend
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {weekends.map(weekend => (
              <WeekendCard 
                key={weekend.id} 
                weekend={weekend} 
                nomeRedattore={nomeRedattore}
                isAdmin={isAdmin}
                modalitaModifica={modalitaModifica}
                onElimina={eliminaWeekend}
                onUpdate={caricaWeekends}
                utenteCorrente={utenteCorrente}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODALI */}
      {showNuovo && (
        <NuovoWeekendModal 
          onClose={() => setShowNuovo(false)} 
          onUpdate={caricaWeekends}
          categorie={categorie}
          utenteCorrente={utenteCorrente}
          isMobile={isMobile}
        />
      )}

      {showNotifiche && (
        <NotificheModal 
          notifiche={notifiche}
          onClose={() => setShowNotifiche(false)}
          onSegnaLetta={segnaComeLetta}
          onSegnaTutteLette={segnaTutteComeLette}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}

function WeekendCard({ weekend, nomeRedattore, isAdmin, modalitaModifica, onElimina, onUpdate, utenteCorrente, isMobile }) {
  const [showDettaglio, setShowDettaglio] = useState(false)
  const [disponibilitaLocale, setDisponibilitaLocale] = useState({})

  useEffect(() => {
    const disp = {}
    weekend.articoli?.forEach(art => {
      disp[art.id] = art.disponibili || []
    })
    setDisponibilitaLocale(disp)
  }, [weekend.articoli])

  async function toggleDisponibilita(articoloId) {
    const disponibili = disponibilitaLocale[articoloId] || []
    const nuovaDisp = disponibili.includes(nomeRedattore)
      ? disponibili.filter(r => r !== nomeRedattore)
      : [...disponibili, nomeRedattore]
    
    setDisponibilitaLocale(prev => ({
      ...prev,
      [articoloId]: nuovaDisp
    }))

    const { error } = await supabase
      .from('articoli')
      .update({ disponibili: nuovaDisp })
      .eq('id', articoloId)

    if (!error) {
      const articolo = weekend.articoli.find(a => a.id === articoloId)
      const azione = nuovaDisp.includes(nomeRedattore) ? 'si è reso disponibile' : 'si è reso non disponibile'
      
      await supabase.from('notifiche_disponibilita').insert({
        tipo: 'disponibilita_cambiata',
        messaggio: `${nomeRedattore} ${azione} per "${articolo.titolo}" (${weekend.nome_gp})`,
        weekend_id: weekend.id,
        articolo_id: articoloId
      })

      await inviaNotificaPush(
        `📝 Disponibilità aggiornata`,
        `${nomeRedattore} ${azione} per "${articolo.titolo}"`
      )

      onUpdate()
    }
  }

  const articoliVenerdi = weekend.articoli?.filter(a => a.giorno === 'venerdi') || []
  const articoliSabato = weekend.articoli?.filter(a => a.giorno === 'sabato') || []
  const articoliDomenica = weekend.articoli?.filter(a => a.giorno === 'domenica') || []

  return (
    <>
      <div style={{ background: 'white', borderRadius: '15px', padding: isMobile ? '15px' : '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '20px', gap: isMobile ? '15px' : '0' }}>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', marginBottom: '5px' }}>
              {weekend.nome_gp}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#666' }}>
              {new Date(weekend.data_weekend).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
            <button onClick={() => setShowDettaglio(true)} style={{ 
              padding: isMobile ? '12px' : '8px 16px', 
              background: '#007AFF', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontSize: isMobile ? '14px' : '14px', 
              fontWeight: '600', 
              cursor: 'pointer',
              minHeight: isMobile ? '48px' : 'auto'
            }}>
              📊 Visualizza
            </button>
            {isAdmin && modalitaModifica && (
              <button onClick={() => onElimina(weekend.id)} style={{ 
                padding: isMobile ? '12px' : '8px 16px', 
                background: '#FF3B30', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: isMobile ? '14px' : '14px', 
                fontWeight: '600', 
                cursor: 'pointer',
                minHeight: isMobile ? '48px' : 'auto'
              }}>
                🗑️ Elimina
              </button>
            )}
          </div>
        </div>

        {/* GRIGLIA GIORNI */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '15px' : '20px' }}>
          <GiornoCard 
            titolo="Venerdì" 
            articoli={articoliVenerdi} 
            disponibilita={disponibilitaLocale}
            onToggle={toggleDisponibilita}
            nomeRedattore={nomeRedattore}
            isMobile={isMobile}
          />
          <GiornoCard 
            titolo="Sabato" 
            articoli={articoliSabato} 
            disponibilita={disponibilitaLocale}
            onToggle={toggleDisponibilita}
            nomeRedattore={nomeRedattore}
            isMobile={isMobile}
          />
          <GiornoCard 
            titolo="Domenica" 
            articoli={articoliDomenica} 
            disponibilita={disponibilitaLocale}
            onToggle={toggleDisponibilita}
            nomeRedattore={nomeRedattore}
            isMobile={isMobile}
          />
        </div>
      </div>

      {showDettaglio && (
        <DettaglioWeekendModal 
          weekend={weekend}
          onClose={() => setShowDettaglio(false)}
          disponibilita={disponibilitaLocale}
          isAdmin={isAdmin}
          utenteCorrente={utenteCorrente}
          onUpdate={onUpdate}
          isMobile={isMobile}
        />
      )}
    </>
  )
}

function GiornoCard({ titolo, articoli, disponibilita, onToggle, nomeRedattore, isMobile }) {
  return (
    <div style={{ background: '#f5f5f7', borderRadius: '10px', padding: isMobile ? '12px' : '15px' }}>
      <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>
        {titolo}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {articoli.map(articolo => {
          const disp = disponibilita[articolo.id] || []
          const isSonoDisponibile = disp.includes(nomeRedattore)
          const categoria = CATEGORIE_COLORI[articolo.categoria] || { colore: '#666', emoji: '📄' }
          
          return (
            <button
              key={articolo.id}
              onClick={() => onToggle(articolo.id)}
              style={{
                padding: isMobile ? '10px' : '8px 10px',
                background: isSonoDisponibile ? `${categoria.colore}20` : 'white',
                border: isSonoDisponibile ? `2px solid ${categoria.colore}` : '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: isMobile ? '12px' : '11px',
                fontWeight: isSonoDisponibile ? 'bold' : 'normal',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: isMobile ? '44px' : 'auto',
                transition: 'all 0.2s'
              }}
            >
              <span>{categoria.emoji}</span>
              <span style={{ flex: 1, lineHeight: '1.3' }}>{getArticoloBold(articolo)}</span>
              {disp.length > 0 && (
                <span style={{ 
                  background: categoria.colore, 
                  color: 'white', 
                  borderRadius: '50%', 
                  minWidth: isMobile ? '22px' : '20px', 
                  height: isMobile ? '22px' : '20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: isMobile ? '11px' : '10px', 
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {disp.length}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DettaglioWeekendModal({ weekend, onClose, disponibilita, isAdmin, utenteCorrente, onUpdate, isMobile }) {
  const articoliVenerdi = weekend.articoli?.filter(a => a.giorno === 'venerdi') || []
  const articoliSabato = weekend.articoli?.filter(a => a.giorno === 'sabato') || []
  const articoliDomenica = weekend.articoli?.filter(a => a.giorno === 'domenica') || []

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
      zIndex: 10000,
      padding: isMobile ? '0' : '20px'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: isMobile ? '0' : '15px', 
        width: isMobile ? '100vw' : '90vw', 
        maxWidth: '1400px',
        height: isMobile ? '100vh' : 'auto',
        maxHeight: isMobile ? '100vh' : '90vh', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: isMobile ? '12px 15px' : '20px 30px', 
          borderBottom: '1px solid #e0e0e0',
          background: 'white',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
              {weekend.nome_gp}
            </div>
            <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#666' }}>
              {new Date(weekend.data_weekend).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '24px', 
            cursor: 'pointer', 
            color: '#666',
            minWidth: '44px',
            minHeight: '44px',
            flexShrink: 0
          }}>✕</button>
        </div>

        {/* TABELLE GIORNI */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: isMobile ? '15px' : '30px',
          WebkitOverflowScrolling: 'touch'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '30px' }}>
            <TabellaGiorno 
              titolo="Venerdì" 
              articoli={articoliVenerdi}
              disponibilita={disponibilita}
              isAdmin={isAdmin}
              utenteCorrente={utenteCorrente}
              weekend={weekend}
              onUpdate={onUpdate}
              isMobile={isMobile}
            />
            <TabellaGiorno 
              titolo="Sabato" 
              articoli={articoliSabato}
              disponibilita={disponibilita}
              isAdmin={isAdmin}
              utenteCorrente={utenteCorrente}
              weekend={weekend}
              onUpdate={onUpdate}
              isMobile={isMobile}
            />
            <TabellaGiorno 
              titolo="Domenica" 
              articoli={articoliDomenica}
              disponibilita={disponibilita}
              isAdmin={isAdmin}
              utenteCorrente={utenteCorrente}
              weekend={weekend}
              onUpdate={onUpdate}
              isMobile={isMobile}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TabellaGiorno({ titolo, articoli, disponibilita, isAdmin, utenteCorrente, weekend, onUpdate, isMobile }) {
  const redattoriUnici = [...new Set(articoli.flatMap(a => disponibilita[a.id] || []))].sort()

  if (articoli.length === 0) return null

  return (
    <div>
      <div style={{ 
        fontSize: isMobile ? '16px' : '18px', 
        fontWeight: 'bold', 
        marginBottom: isMobile ? '12px' : '15px', 
        color: '#333',
        whiteSpace: 'nowrap'
      }}>
        {titolo}
      </div>
      
      {/* TABELLA CON SCROLL ORIZZONTALE SU MOBILE */}
      <div style={{ 
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        marginBottom: isMobile ? '10px' : '0'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          minWidth: isMobile ? '800px' : 'auto'
        }}>
          <thead>
            <tr style={{ background: '#f5f5f7' }}>
              <th style={{ 
                padding: isMobile ? '10px 8px' : '12px', 
                textAlign: 'left', 
                fontSize: isMobile ? '12px' : '13px', 
                fontWeight: 'bold',
                borderBottom: '2px solid #e0e0e0',
                position: 'sticky',
                left: 0,
                background: '#f5f5f7',
                zIndex: 1,
                minWidth: isMobile ? '200px' : 'auto',
                whiteSpace: 'nowrap'
              }}>
                Articolo
              </th>
              <th style={{ 
                padding: isMobile ? '10px 8px' : '12px', 
                textAlign: 'center', 
                fontSize: isMobile ? '12px' : '13px', 
                fontWeight: 'bold',
                borderBottom: '2px solid #e0e0e0',
                minWidth: isMobile ? '80px' : 'auto',
                whiteSpace: 'nowrap'
              }}>
                Totale
              </th>
              {redattoriUnici.map(red => (
                <th key={red} style={{ 
                  padding: isMobile ? '10px 8px' : '12px', 
                  textAlign: 'center', 
                  fontSize: isMobile ? '11px' : '12px', 
                  fontWeight: '600',
                  borderBottom: '2px solid #e0e0e0',
                  minWidth: isMobile ? '70px' : 'auto',
                  whiteSpace: 'nowrap'
                }}>
                  {red}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {articoli.map((articolo, idx) => {
              const disp = disponibilita[articolo.id] || []
              const categoria = CATEGORIE_COLORI[articolo.categoria] || { colore: '#666', emoji: '📄' }
              
              return (
                <tr key={articolo.id} style={{ 
                  background: idx % 2 === 0 ? 'white' : '#fafafa',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  <td style={{ 
                    padding: isMobile ? '10px 8px' : '12px', 
                    fontSize: isMobile ? '12px' : '13px',
                    position: 'sticky',
                    left: 0,
                    background: idx % 2 === 0 ? 'white' : '#fafafa',
                    zIndex: 1,
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{categoria.emoji}</span>
                      <span>{getArticoloBold(articolo)}</span>
                    </div>
                  </td>
                  <td style={{ 
                    padding: isMobile ? '10px 8px' : '12px', 
                    textAlign: 'center', 
                    fontSize: isMobile ? '13px' : '14px', 
                    fontWeight: 'bold',
                    color: disp.length > 0 ? categoria.colore : '#999'
                  }}>
                    {disp.length}
                  </td>
                  {redattoriUnici.map(red => (
                    <td key={red} style={{ 
                      padding: isMobile ? '10px 8px' : '12px', 
                      textAlign: 'center'
                    }}>
                      {disp.includes(red) && (
                        <span style={{ fontSize: isMobile ? '16px' : '18px' }}>✓</span>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {isMobile && (
        <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', marginTop: '5px' }}>
          ← Scorri orizzontalmente per vedere tutti i redattori →
        </div>
      )}
    </div>
  )
}

function NuovoWeekendModal({ onClose, onUpdate, categorie, utenteCorrente, isMobile }) {
  const [nomeGP, setNomeGP] = useState('')
  const [dataWeekend, setDataWeekend] = useState('')
  const [categoriaId, setCategoriaId] = useState(categorie[0]?.id || null)
  const [salvando, setSalvando] = useState(false)

  async function salva() {
    if (!nomeGP || !dataWeekend) {
      alert('Compila tutti i campi obbligatori')
      return
    }

    setSalvando(true)

    const { data: nuovoWeekend, error: errorWeekend } = await supabase
      .from('weekend')
      .insert({
        nome_gp: nomeGP,
        data_weekend: dataWeekend,
        categoria_id: categoriaId,
        creato_da: utenteCorrente.username
      })
      .select()
      .single()

    if (errorWeekend) {
      console.error('Errore creazione weekend:', errorWeekend)
      alert('Errore durante la creazione del weekend')
      setSalvando(false)
      return
    }

    const articoliDaCreare = ARTICOLI_DEFAULT.map(art => ({
      weekend_id: nuovoWeekend.id,
      titolo: art.titolo,
      categoria: art.categoria,
      giorno: art.giorno,
      disponibili: []
    }))

    const { error: errorArticoli } = await supabase
      .from('articoli')
      .insert(articoliDaCreare)

    if (errorArticoli) {
      console.error('Errore creazione articoli:', errorArticoli)
    }

    await supabase.from('notifiche_disponibilita').insert({
      tipo: 'nuovo_weekend',
      messaggio: `📅 Nuovo weekend creato: ${nomeGP}`,
      weekend_id: nuovoWeekend.id
    })

    await inviaNotificaPush('📅 Nuovo weekend', `È stato creato il weekend: ${nomeGP}`)

    setSalvando(false)
    onUpdate()
    onClose()
  }

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
      zIndex: 10000,
      padding: isMobile ? '0' : '20px'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: isMobile ? '0' : '15px', 
        width: isMobile ? '100vw' : '500px',
        maxHeight: isMobile ? '100vh' : '90vh',
        display: 'flex', 
        flexDirection: 'column'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: isMobile ? '12px 15px' : '20px 30px', 
          borderBottom: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>
            Nuovo Weekend GP
          </div>
          <button onClick={onClose} style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '24px', 
            cursor: 'pointer', 
            color: '#666',
            minWidth: '44px',
            minHeight: '44px'
          }}>✕</button>
        </div>

        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: isMobile ? '15px' : '30px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Nome GP *
            </div>
            <input
              type="text"
              value={nomeGP}
              onChange={e => setNomeGP(e.target.value)}
              placeholder="Es: GP Bahrain"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #ddd',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Data Weekend *
            </div>
            <input
              type="date"
              value={dataWeekend}
              onChange={e => setDataWeekend(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #ddd',
                fontSize: '16px'
              }}
            />
          </div>

          {categorie.length > 0 && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                Categoria
              </div>
              <select
                value={categoriaId || ''}
                onChange={e => setCategoriaId(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #ddd',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                <option value="">Nessuna categoria</option>
                {categorie.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: '10px', 
          justifyContent: 'flex-end', 
          padding: isMobile ? '15px' : '20px 30px', 
          borderTop: '1px solid #e0e0e0'
        }}>
          <button onClick={onClose} style={{ 
            padding: isMobile ? '14px' : '10px 20px', 
            background: '#f0f0f0', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: isMobile ? '15px' : '14px',
            minHeight: isMobile ? '48px' : 'auto'
          }}>
            Annulla
          </button>
          <button onClick={salva} disabled={salvando} style={{ 
            padding: isMobile ? '14px' : '10px 20px', 
            background: salvando ? '#ccc' : '#34C759', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: salvando ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold',
            fontSize: isMobile ? '15px' : '14px',
            minHeight: isMobile ? '48px' : 'auto'
          }}>
            {salvando ? '...' : 'Crea Weekend'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotificheModal({ notifiche, onClose, onSegnaLetta, onSegnaTutteLette, isMobile }) {
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
      zIndex: 10000,
      padding: isMobile ? '0' : '20px'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: isMobile ? '0' : '15px', 
        width: isMobile ? '100vw' : '600px',
        maxHeight: isMobile ? '100vh' : '90vh',
        display: 'flex', 
        flexDirection: 'column'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: isMobile ? '12px 15px' : '20px 30px', 
          borderBottom: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>
            🔔 Notifiche
          </div>
          <button onClick={onClose} style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '24px', 
            cursor: 'pointer', 
            color: '#666',
            minWidth: '44px',
            minHeight: '44px'
          }}>✕</button>
        </div>

        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: isMobile ? '15px' : '20px 30px'
        }}>
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
          padding: isMobile ? '15px' : '20px 30px', 
          borderTop: '1px solid #e0e0e0', 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: '10px'
        }}>
          <button onClick={onSegnaTutteLette} style={{ 
            flex: 1, 
            padding: isMobile ? '14px' : '12px', 
            background: '#34C759', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            fontSize: isMobile ? '15px' : '14px',
            minHeight: isMobile ? '48px' : 'auto'
          }}>
            Segna tutte come lette
          </button>
          <button onClick={onClose} style={{ 
            padding: isMobile ? '14px 30px' : '12px 30px', 
            background: '#007AFF', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            fontSize: isMobile ? '15px' : '14px',
            minHeight: isMobile ? '48px' : 'auto'
          }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const CAMPIONATI_DEFAULT = [
  { id: 'f1', nome: 'Formula 1', colore: '#E10600', emoji: '🏎️', sigla: 'F1' },
  { id: 'f2', nome: 'Formula 2', colore: '#0090D0', emoji: '🏎️', sigla: 'F2' },
  { id: 'f3', nome: 'Formula 3', colore: '#FF6800', emoji: '🏎️', sigla: 'F3' },
  { id: 'motogp', nome: 'MotoGP', colore: '#D4145A', emoji: '🏍️', sigla: 'MOTOGP' },
  { id: 'wec', nome: 'WEC', colore: '#00A19C', emoji: '🏁', sigla: 'WEC' },
  { id: 'indycar', nome: 'IndyCar', colore: '#C8102E', emoji: '🏎️', sigla: 'INDYCAR' },
  { id: 'fe', nome: 'Formula E', colore: '#0098DB', emoji: '⚡', sigla: 'FE' }
]

const EMOJI_DISPONIBILI = [
  { value: '🏎️', label: '🏎️ Monoposto' },
  { value: '🏁', label: '🏁 Bandiera a scacchi' },
  { value: '🏍️', label: '🏍️ Moto' },
  { value: '🚗', label: '🚗 Auto sportiva' },
  { value: '⚡', label: '⚡ Fulmine' }
]

const MESI_ITALIANO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

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

export default function CalendarioAccrediti({ utenteCorrente, onClose, onNotificheChange }) {
  const [campionati, setCampionati] = useState([])
  const [eventi, setEventi] = useState([])
  const [prenotazioni, setPrenotazioni] = useState([])
  const [utenti, setUtenti] = useState([])
  const [notifiche, setNotifiche] = useState([])
  const [loading, setLoading] = useState(true)
  const [meseCorrente, setMeseCorrente] = useState(new Date())
  const [showNuovoEvento, setShowNuovoEvento] = useState(false)
  const [showGestioneCampionati, setShowGestioneCampionati] = useState(false)
  const [showNotifiche, setShowNotifiche] = useState(false)
  const [eventoSelezionato, setEventoSelezionato] = useState(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000)

  const isAdmin = utenteCorrente?.ruolo === 'admin'
  const isMobile = windowWidth <= 768

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => { caricaDati() }, [])

  async function caricaDati() {
    setLoading(true)
    let { data: campionatiDB } = await supabase.from('campionati').select('*').eq('attivo', true).order('nome')
    if (!campionatiDB || campionatiDB.length === 0) {
      const { data: nuoviCampionati } = await supabase.from('campionati').insert(CAMPIONATI_DEFAULT.map(c => ({ ...c, attivo: true }))).select()
      campionatiDB = nuoviCampionati || []
    }
    setCampionati(campionatiDB)
    const { data: eventiDB } = await supabase.from('eventi_calendario').select('*').order('data_inizio')
    setEventi(eventiDB || [])
    const { data: utentiDB } = await supabase.from('utenti').select('username, nome, cognome')
    setUtenti(utentiDB || [])
    const { data: prenotazioniDB } = await supabase.from('prenotazioni_accrediti').select('*')
    const prenotazioniConNomi = (prenotazioniDB || []).map(p => {
      const utente = (utentiDB || []).find(u => u.username === p.username)
      return { ...p, nome_completo: utente ? `${utente.nome} ${utente.cognome}` : p.username }
    })
    setPrenotazioni(prenotazioniConNomi)
    await caricaNotifiche()
    setLoading(false)
  }

  async function caricaNotifiche() {
    const { data: tutteNotifiche } = await supabase.from('notifiche_calendario').select('*').order('created_at', { ascending: false }).limit(50)
    const { data: lette } = await supabase.from('notifiche_lette').select('notifica_id').eq('username', utenteCorrente.username)
    const idsLette = new Set((lette || []).map(l => l.notifica_id))
    const notificheConStato = (tutteNotifiche || []).map(n => ({ ...n, letta: idsLette.has(n.id) }))
    setNotifiche(notificheConStato)
    if (onNotificheChange) onNotificheChange()
  }

  async function creaNotifica(tipo, messaggio, evento_id = null) {
    await supabase.from('notifiche_calendario').insert({ tipo, messaggio, evento_id })
    await caricaNotifiche()
  }

  async function segnaComeLetta(notificaId) {
    await supabase.from('notifiche_lette').insert({ username: utenteCorrente.username, notifica_id: notificaId })
    await caricaNotifiche()
  }

  async function segnaTutteComeLette() {
    const nonLette = notifiche.filter(n => !n.letta)
    for (const n of nonLette) {
      await supabase.from('notifiche_lette').insert({ username: utenteCorrente.username, notifica_id: n.id })
    }
    await caricaNotifiche()
  }

  function cambiaMese(offset) {
    setMeseCorrente(new Date(meseCorrente.getFullYear(), meseCorrente.getMonth() + offset))
  }

  function getEventiMese() {
    const anno = meseCorrente.getFullYear(), mese = meseCorrente.getMonth()
    const primoGiorno = new Date(anno, mese, 1).toISOString().split('T')[0]
    const ultimoGiorno = new Date(anno, mese + 1, 0).toISOString().split('T')[0]
    return eventi.filter(e => {
      const inizio = e.data_inizio, fine = e.data_fine || e.data_inizio
      return (inizio <= ultimoGiorno && fine >= primoGiorno)
    })
  }

  const notificheNonLette = notifiche.filter(n => !n.letta).length

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px', color: '#666' }}>Caricamento...</div>

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', padding: isMobile ? '10px' : '15px 30px', background: 'white', borderBottom: '1px solid #e0e0e0', gap: isMobile ? '10px' : '0' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', cursor: 'pointer', alignSelf: isMobile ? 'flex-start' : 'auto', minHeight: isMobile ? '44px' : 'auto', padding: isMobile ? '8px 0' : '0', textAlign: 'left' }}>← Indietro</button>
        <div style={{ textAlign: 'center', order: isMobile ? -1 : 0, padding: isMobile ? '10px 0' : '0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Calendario Accrediti</div>
          <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#666' }}>Gare ed Eventi</div>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '10px' }}>
          <button onClick={() => setShowNotifiche(true)} style={{ position: 'relative', padding: isMobile ? '12px' : '6px 12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: isMobile ? '14px' : '13px', fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>
            🔔 Notifiche
            {notificheNonLette > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#FF3B30', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>{notificheNonLette}</span>}
          </button>
          {isAdmin && <button onClick={() => setShowGestioneCampionati(true)} style={{ padding: isMobile ? '12px' : '6px 12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', fontSize: isMobile ? '14px' : '13px', fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>Categorie</button>}
          <button onClick={() => setShowNuovoEvento(true)} style={{ padding: isMobile ? '12px' : '6px 12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', fontSize: isMobile ? '14px' : '13px', fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>Nuovo</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '10px' : '12px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={() => cambiaMese(-1)} style={{ padding: isMobile ? '10px 16px' : '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: isMobile ? '16px' : '13px', minHeight: isMobile ? '44px' : 'auto' }}>←</button>
        <div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 'bold' }}>{MESI_ITALIANO[meseCorrente.getMonth()]} {meseCorrente.getFullYear()}</div>
        <button onClick={() => cambiaMese(1)} style={{ padding: isMobile ? '10px 16px' : '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: isMobile ? '16px' : '13px', minHeight: isMobile ? '44px' : 'auto' }}>→</button>
      </div>
      <div style={{ padding: isMobile ? '8px 10px' : '10px 30px', background: 'white', borderBottom: '1px solid #e0e0e0', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: '12px', fontSize: isMobile ? '10px' : '11px', minWidth: isMobile ? 'max-content' : 'auto' }}>
          {campionati.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.colore, flexShrink: 0 }}></div><span>{c.emoji} {c.nome}</span></div>)}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#666', flexShrink: 0 }}></div><span>📅 Eventi</span></div>
          <span style={{ marginLeft: '15px', color: '#666', whiteSpace: 'nowrap' }}>🟡 Da richiedere • 📨 Richiesto • ✅ Accettato</span>
        </div>
      </div>
      <div style={{ flex: 1, padding: isMobile ? '10px' : '20px 30px', overflow: 'auto' }}>
        <CalendarioMensile mese={meseCorrente} eventi={getEventiMese()} campionati={campionati} prenotazioni={prenotazioni} onEventoClick={e => setEventoSelezionato(e)} isMobile={isMobile} />
      </div>
      {showNuovoEvento && <NuovoEventoModal campionati={campionati} onClose={() => setShowNuovoEvento(false)} onSave={async (titolo) => { await creaNotifica('nuovo_evento', `📅 Nuovo evento: ${titolo}`); await inviaNotificaPush('📅 Nuovo evento', titolo); caricaDati(); }} utenteCorrente={utenteCorrente} isMobile={isMobile} />}
      {showGestioneCampionati && <GestioneCampionatiModal campionati={campionati} onClose={() => setShowGestioneCampionati(false)} onUpdate={caricaDati} isMobile={isMobile} />}
      {showNotifiche && <NotificheModal notifiche={notifiche} onClose={() => setShowNotifiche(false)} onSegnaLetta={segnaComeLetta} onSegnaTutteLette={segnaTutteComeLette} isMobile={isMobile} />}
      {eventoSelezionato && <DettaglioEventoModal evento={eventoSelezionato} campionati={campionati} prenotazioni={prenotazioni} utenti={utenti} isAdmin={isAdmin} utenteCorrente={utenteCorrente} onClose={() => setEventoSelezionato(null)} onUpdate={async (notificaMsg) => { if (notificaMsg) { await creaNotifica('modifica', notificaMsg, eventoSelezionato.id); await inviaNotificaPush('🎫 Aggiornamento', notificaMsg); } caricaDati(); }} isMobile={isMobile} />}
    </div>
  )
}

function CalendarioMensile({ mese, eventi, campionati, prenotazioni, onEventoClick, isMobile }) {
  const anno = mese.getFullYear(), meseNum = mese.getMonth()
  const primoGiorno = new Date(anno, meseNum, 1).getDay(), ultimoGiorno = new Date(anno, meseNum + 1, 0).getDate()
  const offset = primoGiorno === 0 ? 6 : primoGiorno - 1
  const giorni = []
  for (let i = 0; i < offset; i++) giorni.push(<div key={`empty-${i}`} style={{ background: '#f9f9f9', borderRadius: '6px' }}></div>)
  for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
    const dataCorrente = new Date(anno, meseNum, giorno)
    const dataCorrenteStr = `${anno}-${String(meseNum + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
    const eventiGiorno = eventi.filter(e => {
      const dataInizio = e.data_inizio, dataFine = e.data_fine || e.data_inizio
      return dataCorrenteStr >= dataInizio && dataCorrenteStr <= dataFine
    })
    const isOggi = new Date().toDateString() === dataCorrente.toDateString()
    giorni.push(<GiornoCell key={giorno} giorno={giorno} eventi={eventiGiorno} campionati={campionati} prenotazioni={prenotazioni} isOggi={isOggi} onEventoClick={onEventoClick} isMobile={isMobile} />)
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '4px' : '8px', marginBottom: isMobile ? '4px' : '8px' }}>
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(g => <div key={g} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: isMobile ? '10px' : '12px', color: '#666' }}>{g}</div>)}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', gap: isMobile ? '4px' : '8px', minHeight: 0 }}>{giorni}</div>
    </div>
  )
}

function GiornoCell({ giorno, eventi, campionati, prenotazioni, isOggi, onEventoClick, isMobile }) {
  return (
    <div style={{ background: 'white', borderRadius: '6px', border: isOggi ? '2px solid #007AFF' : '1px solid #e0e0e0', padding: isMobile ? '8px 4px' : '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: isMobile ? '100px' : '80px' }}>
      <div style={{ fontSize: isMobile ? '18px' : '14px', fontWeight: 'bold', marginBottom: '4px', color: isOggi ? '#007AFF' : '#000', flexShrink: 0 }}>{giorno}</div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {eventi.map(evento => {
          const campionato = campionati.find(c => c.id === evento.campionato_id)
          const colore = evento.tipo === 'gara' && campionato ? campionato.colore : (evento.colore_personalizzato || '#666')
          const emoji = evento.tipo === 'gara' && campionato ? campionato.emoji : '📅'
          const sigla = evento.tipo === 'gara' && campionato ? campionato.sigla : 'EVENTO'
          const prenotazioniEvento = prenotazioni.filter(p => p.evento_id === evento.id)
          const numPrenotati = prenotazioniEvento.length, maxAccrediti = evento.max_accrediti || 0
          let badge = null
          if (evento.accredito_status === 'da_richiedere') badge = { icon: '🟡', text: 'DA RICHIEDERE', bg: '#FFD60A', color: '#000' }
          else if (evento.accredito_status === 'richiesto') badge = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
          else if (evento.accredito_status === 'accettato') badge = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
          return (
            <div key={evento.id} onClick={() => onEventoClick(evento)} title={evento.titolo} style={{ padding: isMobile ? '8px' : '6px 8px', background: `${colore}40`, borderLeft: `4px solid ${colore}`, borderRadius: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '3px', minHeight: isMobile ? '50px' : 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: isMobile ? '14px' : '11px' }}>
                <span>{emoji}</span>
                <strong style={{ fontSize: isMobile ? '12px' : '10px' }}>{sigla}</strong>
              </div>
              <div style={{ fontSize: isMobile ? '12px' : '10px', fontWeight: '600', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: isMobile ? 3 : 2, WebkitBoxOrient: 'vertical' }}>{evento.titolo}</div>
              {badge && <div style={{ fontSize: isMobile ? '10px' : '8px', padding: isMobile ? '4px 6px' : '3px 5px', background: badge.bg, color: badge.color, borderRadius: '3px', fontWeight: 'bold', textAlign: 'center' }}>{badge.icon} {badge.text}</div>}
              {maxAccrediti > 0 && <div style={{ fontSize: isMobile ? '10px' : '8px', color: numPrenotati >= maxAccrediti ? '#FF3B30' : '#666', fontWeight: '600' }}>🎫 {numPrenotati}/{maxAccrediti}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NuovoEventoModal({ campionati, onClose, onSave, utenteCorrente, isMobile }) {
  const [tipo, setTipo] = useState('gara')
  const [campionatoId, setCampionatoId] = useState(campionati[0]?.id || '')
  const [titolo, setTitolo] = useState('')
  const [dataInizio, setDataInizio] = useState('')
  const [dataFine, setDataFine] = useState('')
  const [maxAccrediti, setMaxAccrediti] = useState(0)
  const [accreditoStatus, setAccreditoStatus] = useState('nessuno')
  const [note, setNote] = useState('')
  const [colorePersonalizzato, setColorePersonalizzato] = useState('#666')
  const [salvando, setSalvando] = useState(false)
  async function salva() {
    if (!titolo || !dataInizio) return alert('Compila titolo e data inizio')
    setSalvando(true)
    const nuovoEvento = { tipo, campionato_id: tipo === 'gara' ? campionatoId : null, titolo, data_inizio: dataInizio, data_fine: dataFine || null, max_accrediti: maxAccrediti, accredito_status: accreditoStatus, note, colore_personalizzato: tipo === 'evento' ? colorePersonalizzato : null, creato_da: utenteCorrente.username }
    await supabase.from('eventi_calendario').insert(nuovoEvento)
    await onSave(titolo)
    setSalvando(false)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Nuovo Evento</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Tipo</div>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
              <option value="gara">Gara</option>
              <option value="evento">Evento Personalizzato</option>
            </select>
          </div>
          {tipo === 'gara' && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Campionato</div>
            <select value={campionatoId} onChange={e => setCampionatoId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
              {campionati.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}
            </select>
          </div>}
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo</div>
            <input type="text" value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="Es: GP Italia" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
          </div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Inizio</div>
              <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>
            <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Fine (opzionale)</div>
              <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Numero Pass Disponibili (0 = nessun limite)</div>
            <input type="number" min="0" value={maxAccrediti} onChange={e => setMaxAccrediti(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Stato Accredito</div>
            <select value={accreditoStatus} onChange={e => setAccreditoStatus(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
              <option value="nessuno">Nessuno</option>
              <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
              <option value="richiesto">📨 Richiesto</option>
              <option value="accettato">✅ Accettato</option>
            </select>
          </div>
          <div><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note (opzionali)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Informazioni aggiuntive..." style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', justifyContent: 'flex-end', padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ padding: isMobile ? '14px' : '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Annulla</button>
          <button onClick={salva} disabled={salvando} style={{ padding: isMobile ? '14px' : '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>{salvando ? '...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  )
}

function GestioneCampionatiModal({ campionati, onClose, onUpdate, isMobile }) {
  const [lista, setLista] = useState(campionati)
  const [edit, setEdit] = useState(null)
  async function salva() {
    if (edit.id) {
      await supabase.from('campionati').update({ nome: edit.nome, colore: edit.colore, emoji: edit.emoji, sigla: edit.sigla }).eq('id', edit.id)
    } else {
      await supabase.from('campionati').insert({ nome: edit.nome, colore: edit.colore, emoji: edit.emoji, sigla: edit.sigla, attivo: true })
    }
    await onUpdate()
    setEdit(null)
  }
  async function elimina(id) {
    if (!confirm('Eliminare questo campionato?')) return
    await supabase.from('campionati').update({ attivo: false }).eq('id', id)
    await onUpdate()
  }
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '600px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Gestione Categorie</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
          {edit ? (
            <div>
              <div style={{ marginBottom: '15px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Nome</div>
                <input type="text" value={edit.nome} onChange={e => setEdit({...edit, nome: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Sigla</div>
                <input type="text" value={edit.sigla} onChange={e => setEdit({...edit, sigla: e.target.value})} placeholder="Es: F1" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Emoji</div>
                <select value={edit.emoji} onChange={e => setEdit({...edit, emoji: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
                  {EMOJI_DISPONIBILI.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Colore</div>
                <input type="color" value={edit.colore} onChange={e => setEdit({...edit, colore: e.target.value})} style={{ width: '100%', height: '50px', borderRadius: '8px', border: '2px solid #ddd', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
                <button onClick={() => setEdit(null)} style={{ flex: 1, padding: isMobile ? '14px' : '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Annulla</button>
                <button onClick={salva} style={{ flex: 1, padding: isMobile ? '14px' : '10px 20px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Salva</button>
              </div>
            </div>
          ) : (
            <>
              {lista.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f5f5f7', borderRadius: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: c.colore, flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{c.emoji} {c.nome}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{c.sigla}</div>
                  </div>
                  <button onClick={() => setEdit(c)} style={{ padding: isMobile ? '10px 14px' : '6px 12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: isMobile ? '13px' : '12px', minHeight: isMobile ? '44px' : 'auto' }}>Modifica</button>
                  <button onClick={() => elimina(c.id)} style={{ padding: isMobile ? '10px 14px' : '6px 12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: isMobile ? '13px' : '12px', minHeight: isMobile ? '44px' : 'auto' }}>Elimina</button>
                </div>
              ))}
              <button onClick={() => setEdit({ nome: '', sigla: '', emoji: '🏎️', colore: '#000000' })} style={{ width: '100%', padding: isMobile ? '14px' : '12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: isMobile ? '15px' : '14px', minHeight: isMobile ? '48px' : 'auto' }}>+ Nuova Categoria</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DettaglioEventoModal({ evento, campionati, prenotazioni, utenti, isAdmin, utenteCorrente, onClose, onUpdate, isMobile }) {
  const [modalita, setModalita] = useState('visualizza')
  const [edit, setEdit] = useState(evento)
  const [salvando, setSalvando] = useState(false)
  const campionato = campionati.find(c => c.id === evento.campionato_id)
  const prenotazioniEvento = prenotazioni.filter(p => p.evento_id === evento.id)
  const numPrenotati = prenotazioniEvento.length
  const maxAccrediti = evento.max_accrediti || 0
  const postiDisponibili = maxAccrediti - numPrenotati
  const prenotatoCorrente = prenotazioniEvento.find(p => p.username === utenteCorrente.username)
  async function togglePrenotazione() {
    if (prenotatoCorrente) {
      await supabase.from('prenotazioni_accrediti').delete().eq('id', prenotatoCorrente.id)
      await onUpdate(`${utenteCorrente.nome} ${utenteCorrente.cognome} ha annullato la prenotazione per ${evento.titolo}`)
    } else {
      await supabase.from('prenotazioni_accrediti').insert({ evento_id: evento.id, username: utenteCorrente.username })
      await onUpdate(`${utenteCorrente.nome} ${utenteCorrente.cognome} si è prenotato per ${evento.titolo}`)
    }
  }
  async function elimina() {
    if (!confirm('Eliminare questo evento?')) return
    await supabase.from('eventi_calendario').delete().eq('id', evento.id)
    await onUpdate(null)
    onClose()
  }
  async function salva() {
    setSalvando(true)
    await supabase.from('eventi_calendario').update({ titolo: edit.titolo, data_inizio: edit.data_inizio, data_fine: edit.data_fine || null, max_accrediti: edit.max_accrediti || 0, accredito_status: edit.accredito_status, note: edit.note }).eq('id', edit.id)
    await onUpdate(`Evento ${edit.titolo} modificato`)
    setSalvando(false)
    setModalita('visualizza')
  }
  if (modalita === 'modifica') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
        <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Modifica Evento</div>
            <button onClick={() => setModalita('visualizza')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
            <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo</div>
              <input type="text" value={edit.titolo} onChange={e => setEdit({...edit, titolo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Inizio</div>
                <input type="date" value={edit.data_inizio} onChange={e => setEdit({...edit, data_inizio: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Fine</div>
                <input type="date" value={edit.data_fine || ''} onChange={e => setEdit({...edit, data_fine: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
              </div>
            </div>
            {isAdmin && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Numero Pass Disponibili (0 = nessun limite)</div>
              <input type="number" min="0" value={edit.max_accrediti || 0} onChange={e => setEdit({...edit, max_accrediti: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>}
            <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Accredito</div>
              <select value={edit.accredito_status} onChange={e => setEdit({...edit, accredito_status: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
                <option value="nessuno">Nessuno</option>
                <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
                <option value="richiesto">📨 Richiesto</option>
                <option value="accettato">✅ Accettato</option>
              </select>
            </div>
            <div><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note</div>
              <textarea value={edit.note || ''} onChange={e => setEdit({...edit, note: e.target.value})} style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', justifyContent: 'flex-end', padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0' }}>
            <button onClick={() => setModalita('visualizza')} style={{ padding: isMobile ? '14px' : '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Annulla</button>
            <button onClick={salva} disabled={salvando} style={{ padding: isMobile ? '14px' : '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>{salvando ? '...' : 'Salva'}</button>
          </div>
        </div>
      </div>
    )
  }
  let badge = null
  if (evento.accredito_status === 'da_richiedere') badge = { icon: '🟡', text: 'DOVREMMO RICHIEDERLO', bg: '#FFD60A', color: '#000' }
  else if (evento.accredito_status === 'richiesto') badge = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
  else if (evento.accredito_status === 'accettato') badge = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
  const slots = Array.from({ length: maxAccrediti }, (_, i) => prenotazioniEvento[i] || null)
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 'calc(100% - 60px)' : 'auto' }}>Dettagli</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', marginBottom: '5px', wordBreak: 'break-word' }}>{evento.titolo}</div>
            {campionato && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: campionato.colore }}></div>
              <span style={{ fontSize: '16px' }}>{campionato.emoji} {campionato.nome}</span>
            </div>}
          </div>
          {badge && <div style={{ marginBottom: '20px', padding: '15px 20px', background: badge.bg, color: badge.color, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <span style={{ fontSize: '32px' }}>{badge.icon}</span>
            <div><div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '2px' }}>STATO</div><div style={{ fontSize: '18px', fontWeight: 'bold' }}>{badge.text}</div></div>
          </div>}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>📅 Data</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{new Date(evento.data_inizio).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}{evento.data_fine && ` - ${new Date(evento.data_fine).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`}</div>
          </div>
          {maxAccrediti > 0 && <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f7', borderRadius: '10px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>👤 Pass Disponibili ({numPrenotati}/{maxAccrediti})</div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '15px' }}>
              {slots.map((prenotazione, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'white', borderRadius: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '24px', filter: prenotazione ? 'none' : 'grayscale(1)', opacity: prenotazione ? 1 : 0.3 }}>👤</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: prenotazione ? '#000' : '#999' }}>
                    {prenotazione ? prenotazione.nome_completo : `Posto ${i + 1} libero`}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={togglePrenotazione} disabled={!prenotatoCorrente && postiDisponibili <= 0} style={{ width: '100%', padding: isMobile ? '14px' : '12px', background: prenotatoCorrente ? '#FF3B30' : (postiDisponibili > 0 ? '#34C759' : '#ccc'), color: 'white', border: 'none', borderRadius: '8px', cursor: prenotatoCorrente || postiDisponibili > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '14px', minHeight: isMobile ? '48px' : 'auto' }}>
              {prenotatoCorrente ? 'Annulla la mia prenotazione' : (postiDisponibili > 0 ? 'Prenota il mio pass' : 'Posti esauriti')}
            </button>
          </div>}
          {evento.note && <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>📝 Note</div>
            <div style={{ fontSize: '14px', padding: '12px', background: '#f5f5f7', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>{evento.note}</div>
          </div>}
        </div>
        <div style={{ padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          {isAdmin ? <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
            <button onClick={elimina} style={{ flex: 1, padding: isMobile ? '14px' : '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Elimina</button>
            <button onClick={() => setModalita('modifica')} style={{ flex: 1, padding: isMobile ? '14px' : '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Modifica</button>
          </div> : <button onClick={onClose} style={{ width: '100%', padding: isMobile ? '14px' : '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Chiudi</button>}
        </div>
      </div>
    </div>
  )
}

function NotificheModal({ notifiche, onClose, onSegnaLetta, onSegnaTutteLette, isMobile }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '600px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>🔔 Notifiche</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '20px 30px' }}>
          {notifiche.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nessuna notifica</div>
          ) : (
            notifiche.map(n => (
              <div key={n.id} onClick={() => !n.letta && onSegnaLetta(n.id)} style={{ padding: '15px', background: n.letta ? '#f5f5f7' : '#007AFF15', borderRadius: '10px', marginBottom: '10px', cursor: n.letta ? 'default' : 'pointer', borderLeft: `4px solid ${n.letta ? '#ccc' : '#007AFF'}` }}>
                <div style={{ fontSize: '14px', fontWeight: n.letta ? 'normal' : 'bold', marginBottom: '5px' }}>{n.messaggio}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{new Date(n.created_at).toLocaleString('it-IT')}</div>
              </div>
            ))
          )}
        </div>
        <div style={{ padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
          <button onClick={onSegnaTutteLette} style={{ flex: 1, padding: isMobile ? '14px' : '12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Segna tutte come lette</button>
          <button onClick={onClose} style={{ padding: isMobile ? '14px 30px' : '12px 30px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}

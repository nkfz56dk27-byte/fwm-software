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

// Funzione per inviare notifiche push a tutti gli utenti
async function inviaNotificaPush(titolo, corpo) {
  try {
    // Ottieni tutti i token FCM degli utenti
    const { data: tokens } = await supabase.from('fcm_tokens').select('token')
    
    if (!tokens || tokens.length === 0) {
      console.log('Nessun token FCM trovato')
      return
    }
    
    // Qui puoi aggiungere la chiamata alla tua Cloud Function
    // Per ora logghiamo solo
    console.log('📤 Invio notifica push:', { titolo, corpo, numTokens: tokens.length })
    
    // TODO: Implementa la chiamata alla Cloud Function quando sarà pronta
    // await fetch('/api/send-notification', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     tokens: tokens.map(t => t.token),
    //     notification: { title: titolo, body: corpo }
    //   })
    // })
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
  const [selezioniTemporanee, setSelezioniTemporanee] = useState([])

  const isAdmin = utenteCorrente?.ruolo === 'admin'

  useEffect(() => { caricaDati() }, [])

  // ===== REALTIME =====
  useEffect(() => {
    const channel = supabase.channel('calendario-realtime')

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni_accrediti' }, (payload) => {
      console.log('🔄 Prenotazione:', payload)
      caricaDati()
    })

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'eventi_calendario' }, (payload) => {
      console.log('🔄 Evento:', payload)
      caricaDati()
    })

    channel.on('broadcast', { event: 'temp_booking' }, ({ payload }) => {
      const { username, evento_id, stato, action } = payload
      if (username === utenteCorrente.username) return

      setSelezioniTemporanee(prev => {
        if (action === 'select') {
          return [...prev.filter(s => s.evento_id !== evento_id || s.username !== username), { username, evento_id, stato, timestamp: Date.now() }]
        } else {
          return prev.filter(s => !(s.evento_id === evento_id && s.username === username))
        }
      })

      setTimeout(() => setSelezioniTemporanee(prev => prev.filter(s => !(s.evento_id === evento_id && s.username === username))), 30000)
    })

    channel.subscribe()
    return () => channel.unsubscribe()
  }, [utenteCorrente.username])

  // Polling disabilitato - il real-time è sufficiente
  // useEffect(() => {
  //   const interval = setInterval(() => caricaDati(), 60000)
  //   return () => clearInterval(interval)
  // }, [])

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
    
    if (onNotificheChange) {
      onNotificheChange()
    }
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
    const nuovaData = new Date(meseCorrente)
    nuovaData.setMonth(nuovaData.getMonth() + offset)
    setMeseCorrente(nuovaData)
  }

  function getEventiDelMese() {
    const anno = meseCorrente.getFullYear()
    const mese = meseCorrente.getMonth()
    return eventi.filter(evento => {
      const dataInizio = new Date(evento.data_inizio + 'T00:00:00')
      const dataFine = evento.data_fine ? new Date(evento.data_fine + 'T23:59:59') : dataInizio
      const primoGiornoMese = new Date(anno, mese, 1)
      const ultimoGiornoMese = new Date(anno, mese + 1, 0, 23, 59, 59)
      return dataInizio <= ultimoGiornoMese && dataFine >= primoGiornoMese
    })
  }

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7' }}><div style={{ fontSize: '18px', color: '#666' }}>Caricamento...</div></div>

  const notificheNonLette = notifiche.filter(n => !n.letta).length

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 'bold' }}>Calendario Accrediti</div><div style={{ fontSize: '11px', color: '#666' }}>Gare ed Eventi</div></div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowNotifiche(true)} style={{ position: 'relative', padding: '6px 12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            Notifiche
            {notificheNonLette > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#FF3B30', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>{notificheNonLette}</span>}
          </button>
          {isAdmin && <button onClick={() => setShowGestioneCampionati(true)} style={{ padding: '6px 12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Categorie</button>}
          <button onClick={() => setShowNuovoEvento(true)} style={{ padding: '6px 12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Nuovo</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={() => cambiaMese(-1)} style={{ padding: '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>←</button>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{MESI_ITALIANO[meseCorrente.getMonth()]} {meseCorrente.getFullYear()}</div>
        <button onClick={() => cambiaMese(1)} style={{ padding: '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>→</button>
      </div>

      <div style={{ padding: '10px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px' }}>
          {campionati.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.colore }}></div><span>{c.emoji} {c.nome}</span></div>)}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#666' }}></div><span>📅 Eventi</span></div>
          <span style={{ marginLeft: '15px', color: '#666' }}>🟡 Da richiedere • 📨 Richiesto • ✅ Accettato</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 30px', overflow: 'hidden' }}>
        <CalendarioMensile mese={meseCorrente} eventi={getEventiDelMese()} campionati={campionati} prenotazioni={prenotazioni} selezioniTemp={selezioniTemporanee} utenteCorrente={utenteCorrente} onEventoClick={e => setEventoSelezionato(e)} />
      </div>

      {showNuovoEvento && <NuovoEventoModal campionati={campionati} onClose={() => setShowNuovoEvento(false)} onSave={async (titolo) => { 
        await creaNotifica('nuovo_evento', `📅 Nuovo evento: ${titolo}`); 
        await inviaNotificaPush('📅 Nuovo evento', titolo);
        // caricaDati(); // Rimosso - il real-time lo farà
      }} utenteCorrente={utenteCorrente} />}
      {showGestioneCampionati && <GestioneCampionatiModal campionati={campionati} onClose={() => setShowGestioneCampionati(false)} onUpdate={caricaDati} />}
      {showNotifiche && <NotificheModal notifiche={notifiche} onClose={() => setShowNotifiche(false)} onSegnaLetta={segnaComeLetta} onSegnaTutteLette={segnaTutteComeLette} />}
      {eventoSelezionato && <DettaglioEventoModal evento={eventoSelezionato} campionati={campionati} prenotazioni={prenotazioni} utenti={utenti} isAdmin={isAdmin} utenteCorrente={utenteCorrente} onClose={() => setEventoSelezionato(null)} onUpdate={async (notificaMsg) => { 
        if (notificaMsg) {
          await creaNotifica('modifica', notificaMsg, eventoSelezionato.id);
          await inviaNotificaPush('🎫 Aggiornamento', notificaMsg);
        }
        // caricaDati(); // Rimosso - il real-time postgres_changes lo farà automaticamente
      }} />}
    </div>
  )
}

function CalendarioMensile({ mese, eventi, campionati, prenotazioni, selezioniTemp = [], utenteCorrente, onEventoClick }) {
  const anno = mese.getFullYear(), meseNum = mese.getMonth()
  const primoGiorno = new Date(anno, meseNum, 1).getDay(), ultimoGiorno = new Date(anno, meseNum + 1, 0).getDate()
  const offset = primoGiorno === 0 ? 6 : primoGiorno - 1
  const giorni = []
  for (let i = 0; i < offset; i++) giorni.push(<div key={`empty-${i}`} style={{ background: '#f9f9f9', borderRadius: '6px' }}></div>)
  for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
    const dataCorrente = new Date(anno, meseNum, giorno)
    const dataCorrenteStr = `${anno}-${String(meseNum + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
    const eventiGiorno = eventi.filter(e => {
      const dataInizio = e.data_inizio
      const dataFine = e.data_fine || e.data_inizio
      return dataCorrenteStr >= dataInizio && dataCorrenteStr <= dataFine
    })
    const isOggi = new Date().toDateString() === dataCorrente.toDateString()
    giorni.push(<GiornoCell key={giorno} giorno={giorno} eventi={eventiGiorno} campionati={campionati} prenotazioni={prenotazioni} selezioniTemp={selezioniTemp} utenteCorrente={utenteCorrente} isOggi={isOggi} onEventoClick={onEventoClick} />)
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(g => <div key={g} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>{g}</div>)}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gap: '8px' }}>{giorni}</div>
    </div>
  )
}

function GiornoCell({ giorno, eventi, campionati, prenotazioni, selezioniTemp = [], utenteCorrente, isOggi, onEventoClick }) {
  return (
    <div style={{ background: 'white', borderRadius: '6px', border: isOggi ? '2px solid #007AFF' : '1px solid #e0e0e0', padding: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '3px', color: isOggi ? '#007AFF' : '#000' }}>{giorno}</div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {eventi.map(evento => {
          const campionato = campionati.find(c => c.id === evento.campionato_id)
          const colore = evento.tipo === 'gara' && campionato ? campionato.colore : (evento.colore_personalizzato || '#666')
          const emoji = evento.tipo === 'gara' && campionato ? campionato.emoji : '📅'
          const sigla = evento.tipo === 'gara' && campionato ? campionato.sigla : 'EVENTO'
          
          const prenotazioniEvento = prenotazioni.filter(p => p.evento_id === evento.id)
          const numPrenotati = prenotazioniEvento.length
          const maxAccrediti = evento.max_accrediti || 0
          
          const altriSelezionano = selezioniTemp.filter(s => s.evento_id === evento.id)
          const hasTempSelection = altriSelezionano.length > 0
          
          let badge = null
          if (evento.accredito_status === 'da_richiedere') badge = { icon: '🟡', text: 'DA RICHIEDERE', bg: '#FFD60A', color: '#000' }
          else if (evento.accredito_status === 'richiesto') badge = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
          else if (evento.accredito_status === 'accettato') badge = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
          
          return (
            <div key={evento.id} onClick={() => onEventoClick(evento)} title={evento.titolo} style={{ padding: '5px 7px', background: `${colore}40`, borderLeft: `4px solid ${colore}`, border: hasTempSelection ? '2px dashed #FF9500' : undefined, borderRadius: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
              {hasTempSelection && (
                <div style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  background: '#FF9500',
                  color: 'white',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  fontSize: '8px',
                  fontWeight: 'bold'
                }}>
                  👁️ {altriSelezionano.length}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                <span style={{ fontSize: '14px' }}>{emoji}</span>
                <span style={{ fontWeight: 'bold', color: '#000', fontSize: '9px' }}>{sigla}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600', color: '#000' }}>{evento.titolo}</span>
              </div>
              {maxAccrediti > 0 && <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                {Array.from({ length: maxAccrediti }).map((_, i) => {
                  const prenotato = prenotazioniEvento[i]
                  return <span key={i} style={{ fontSize: '12px', filter: prenotato ? 'none' : 'grayscale(1)', opacity: prenotato ? 1 : 0.3 }} title={prenotato?.nome_completo}>👤</span>
                })}
              </div>}
              {badge && <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 4px', background: badge.bg, color: badge.color, borderRadius: '3px', fontSize: '8px', fontWeight: 'bold' }}><span style={{ fontSize: '9px' }}>{badge.icon}</span><span>{badge.text}</span></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NuovoEventoModal({ campionati, onClose, onSave, utenteCorrente }) {
  const [tipo, setTipo] = useState('gara')
  const [titolo, setTitolo] = useState('')
  const [dataInizio, setDataInizio] = useState('')
  const [dataFine, setDataFine] = useState('')
  const [campionatoId, setCampionatoId] = useState('')
  const [accreditoStatus, setAccreditoStatus] = useState('nessuno')
  const [note, setNote] = useState('')
  const [colorePersonalizzato, setColorePersonalizzato] = useState('#666666')
  const [maxAccrediti, setMaxAccrediti] = useState(0)
  const [salvando, setSalvando] = useState(false)

  async function salvaEvento() {
    if (!titolo || !dataInizio) { alert('❌ Compila titolo e data'); return }
    if (tipo === 'gara' && !campionatoId) { alert('❌ Seleziona campionato'); return }
    setSalvando(true)
    const { error } = await supabase.from('eventi_calendario').insert({
      tipo, titolo, data_inizio: dataInizio, data_fine: dataFine || null,
      campionato_id: tipo === 'gara' ? campionatoId : null,
      accredito_status: accreditoStatus,
      colore_personalizzato: tipo === 'evento' ? colorePersonalizzato : null,
      max_accrediti: maxAccrediti > 0 ? maxAccrediti : null,
      note: note || null, creato_da: utenteCorrente.username
    })
    setSalvando(false)
    if (error) { console.error(error); alert('❌ Errore: ' + error.message); return }
    onSave(titolo)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Nuovo Evento</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Tipo</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setTipo('gara')} style={{ flex: 1, padding: '12px', background: tipo === 'gara' ? '#007AFF' : '#f0f0f0', color: tipo === 'gara' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Gara</button>
              <button onClick={() => setTipo('evento')} style={{ flex: 1, padding: '12px', background: tipo === 'evento' ? '#007AFF' : '#f0f0f0', color: tipo === 'evento' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Evento</button>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo *</div>
            <input type="text" value={titolo} onChange={e => setTitolo(e.target.value)} placeholder={tipo === 'gara' ? 'es: GP Abu Dhabi' : 'es: Presentazione'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          </div>
          {tipo === 'gara' && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Categoria *</div>
            <select value={campionatoId} onChange={e => setCampionatoId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', cursor: 'pointer' }}>
              <option value="">Seleziona...</option>{campionati.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}
            </select>
          </div>}
          {tipo === 'evento' && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Colore</div>
            <input type="color" value={colorePersonalizzato} onChange={e => setColorePersonalizzato(e.target.value)} style={{ width: '100%', height: '50px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
          </div>}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Data Inizio *</div>
              <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
            <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Data Fine</div>
              <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Numero Pass Disponibili (0 = nessun limite)</div>
            <input type="number" min="0" value={maxAccrediti} onChange={e => setMaxAccrediti(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Stato Accredito</div>
            <select value={accreditoStatus} onChange={e => setAccreditoStatus(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', cursor: 'pointer' }}>
              <option value="nessuno">Nessuno</option>
              <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
              <option value="richiesto">📨 Richiesto</option>
              <option value="accettato">✅ Accettato</option>
            </select>
          </div>
          <div><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Dettagli..." style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
          <button onClick={salvaEvento} disabled={salvando} style={{ padding: '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>{salvando ? '...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  )
}

function GestioneCampionatiModal({ campionati, onClose, onUpdate }) {
  const [nuovo, setNuovo] = useState({ nome: '', emoji: '🏎️', colore: '#000000', sigla: '' })
  const [salvando, setSalvando] = useState(false)

  async function aggiungi() {
    if (!nuovo.nome || !nuovo.sigla) { alert('❌ Nome e sigla richiesti'); return }
    setSalvando(true)
    await supabase.from('campionati').insert({ ...nuovo, attivo: true })
    setSalvando(false)
    setNuovo({ nome: '', emoji: '🏎️', colore: '#000000', sigla: '' })
    onUpdate()
  }

  async function elimina(id) {
    if (!confirm('Eliminare?')) return
    await supabase.from('campionati').delete().eq('id', id)
    onUpdate()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Gestione Categorie</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ marginBottom: '30px', padding: '20px', background: '#34C7591A', borderRadius: '10px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Nuova Categoria</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input type="text" placeholder="Nome" value={nuovo.nome} onChange={e => setNuovo({...nuovo, nome: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <input type="text" placeholder="SIGLA" value={nuovo.sigla} onChange={e => setNuovo({...nuovo, sigla: e.target.value.toUpperCase()})} style={{ width: '90px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }} />
              <select value={nuovo.emoji} onChange={e => setNuovo({...nuovo, emoji: e.target.value})} style={{ width: '150px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '14px' }}>
                {EMOJI_DISPONIBILI.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <input type="color" value={nuovo.colore} onChange={e => setNuovo({...nuovo, colore: e.target.value})} style={{ width: '60px', height: '42px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
            </div>
            <button onClick={aggiungi} disabled={salvando} style={{ width: '100%', padding: '10px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>{salvando ? '...' : 'Aggiungi Categoria'}</button>
          </div>
          <div><div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Categorie Attive ({campionati.length})</div>
            {campionati.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: c.colore }}></div>
              <span style={{ fontSize: '18px' }}>{c.emoji}</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold', background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px' }}>{c.sigla}</span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: '600' }}>{c.nome}</span>
              <button onClick={() => elimina(c.id)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}>×</button>
            </div>)}
          </div>
        </div>
  )
}

function DettaglioEventoModal({ evento, campionati, prenotazioni, utenti, isAdmin, utenteCorrente, onClose, onUpdate }) {
  const [modalita, setModalita] = useState('visualizza')
  const [edit, setEdit] = useState({...evento})
  const [salvando, setSalvando] = useState(false)
  const campionato = campionati.find(c => c.id === evento.campionato_id)
  
  const prenotazioniEvento = prenotazioni.filter(p => p.evento_id === evento.id)
  const prenotatoCorrente = prenotazioniEvento.find(p => p.username === utenteCorrente.username)
  const numPrenotati = prenotazioniEvento.length
  const maxAccrediti = evento.max_accrediti || 0
  const postiDisponibili = maxAccrediti > 0 ? maxAccrediti - numPrenotati : 999

  async function salva() {
    setSalvando(true)
    const { error } = await supabase.from('eventi_calendario').update({
      titolo: edit.titolo, data_inizio: edit.data_inizio, data_fine: edit.data_fine,
      accredito_status: edit.accredito_status, note: edit.note,
      colore_personalizzato: edit.colore_personalizzato,
      max_accrediti: edit.max_accrediti > 0 ? edit.max_accrediti : null
    }).eq('id', evento.id)
    setSalvando(false)
    if (error) { console.error(error); alert('❌ Errore: ' + error.message); return }
    
    let notificaMsg = null
    if (edit.max_accrediti !== evento.max_accrediti) {
      notificaMsg = `🎫 Modificati pass disponibili per "${evento.titolo}": ${edit.max_accrediti}`
    }
    onUpdate(notificaMsg)
    onClose()
  }

  async function elimina() {
    if (!confirm(`Eliminare "${evento.titolo}"?`)) return
    await supabase.from('eventi_calendario').delete().eq('id', evento.id)
    onUpdate()
    onClose()
  }

  const broadcastPrenotazione = async (evento_id, stato, action) => {
    try {
      const channel = supabase.channel('calendario-realtime')
      await channel.send({
        type: 'broadcast',
        event: 'temp_booking',
        payload: { username: utenteCorrente.username, evento_id, stato, action }
      })
    } catch (e) {}
  }

  async function togglePrenotazione() {
    const action = prenotatoCorrente ? 'deselect' : 'select'
    const stato = prenotatoCorrente ? null : 'da_richiedere'
    await broadcastPrenotazione(evento.id, stato, action)
    
    if (prenotatoCorrente) {
      await supabase.from('prenotazioni_accrediti').delete().eq('id', prenotatoCorrente.id)
      const utente = utenti.find(u => u.username === utenteCorrente.username)
      const nome = utente ? `${utente.nome} ${utente.cognome}` : utenteCorrente.username
      onUpdate(`❌ ${nome} ha cancellato la prenotazione per "${evento.titolo}"`)
    } else {
      if (maxAccrediti > 0 && numPrenotati >= maxAccrediti) {
        alert('❌ Posti esauriti')
        return
      }
      
      const utente = utenti.find(u => u.username === utenteCorrente.username)
      const nomeCompleto = utente ? `${utente.nome} ${utente.cognome}` : utenteCorrente.username
      
      await supabase.from('prenotazioni_accrediti').insert({ 
        evento_id: evento.id, 
        username: utenteCorrente.username,
        nome_completo: nomeCompleto
      })
      
      onUpdate(`✅ ${nomeCompleto} ha prenotato un pass per "${evento.titolo}"`)
    }
  }

  if (modalita === 'modifica') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
        <div style={{ background: 'white', borderRadius: '15px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>✏️ Modifica</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
            <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo</div>
              <input type="text" value={edit.titolo} onChange={e => setEdit({...edit, titolo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
            {edit.tipo === 'evento' && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Colore</div>
              <input type="color" value={edit.colore_personalizzato || '#666666'} onChange={e => setEdit({...edit, colore_personalizzato: e.target.value})} style={{ width: '100%', height: '50px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
            </div>}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Inizio</div>
                <input type="date" value={edit.data_inizio} onChange={e => setEdit({...edit, data_inizio: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Fine</div>
                <input type="date" value={edit.data_fine || ''} onChange={e => setEdit({...edit, data_fine: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              </div>
            </div>
            {isAdmin && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Numero Pass Disponibili (0 = nessun limite)</div>
              <input type="number" min="0" value={edit.max_accrediti || 0} onChange={e => setEdit({...edit, max_accrediti: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>}
            <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Accredito</div>
              <select value={edit.accredito_status} onChange={e => setEdit({...edit, accredito_status: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', cursor: 'pointer' }}>
                <option value="nessuno">Nessuno</option>
                <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
                <option value="richiesto">📨 Richiesto</option>
                <option value="accettato">✅ Accettato</option>
              </select>
            </div>
            <div><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note</div>
              <textarea value={edit.note || ''} onChange={e => setEdit({...edit, note: e.target.value})} style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
            <button onClick={() => setModalita('visualizza')} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
            <button onClick={salva} disabled={salvando} style={{ padding: '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>{salvando ? '...' : 'Salva'}</button>
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '550px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{evento.tipo === 'gara' ? '' : ''} Dettagli</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>{evento.titolo}</div>
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
            <button onClick={togglePrenotazione} disabled={!prenotatoCorrente && postiDisponibili <= 0} style={{ width: '100%', padding: '12px', background: prenotatoCorrente ? '#FF3B30' : (postiDisponibili > 0 ? '#34C759' : '#ccc'), color: 'white', border: 'none', borderRadius: '8px', cursor: prenotatoCorrente || postiDisponibili > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '14px' }}>
              {prenotatoCorrente ? 'Annulla la mia prenotazione' : (postiDisponibili > 0 ? 'Prenota il mio pass' : 'Posti esauriti')}
            </button>
          </div>}
          
          {evento.note && <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>📝 Note</div>
            <div style={{ fontSize: '14px', padding: '12px', background: '#f5f5f7', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>{evento.note}</div>
          </div>}
        </div>
        <div style={{ padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          {isAdmin ? <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={elimina} style={{ flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Elimina</button>
            <button onClick={() => setModalita('modifica')} style={{ flex: 1, padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Modifica</button>
          </div> : <button onClick={onClose} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Chiudi</button>}
        </div>
      </div>
    </div>
  )
}

function NotificheModal({ notifiche, onClose, onSegnaLetta, onSegnaTutteLette }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>🔔 Notifiche</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 30px' }}>
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
        <div style={{ padding: '20px 30px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '10px' }}>
          <button onClick={onSegnaTutteLette} style={{ flex: 1, padding: '12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Segna tutte come lette</button>
          <button onClick={onClose} style={{ padding: '12px 30px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}

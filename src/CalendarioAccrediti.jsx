import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { inviaNotificaPush } from './utils/notifiche'

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
  
  useEffect(() => { 
    caricaDati() 
  }, [])
  
  async function caricaDati() {
    setLoading(true)
    
    // 1. Caricamento Campionati
    let { data: campionatiDB } = await supabase.from('campionati').select('*').eq('attivo', true).order('nome')
    if (!campionatiDB || campionatiDB.length === 0) {
      const { data: nuoviCampionati } = await supabase.from('campionati').insert(CAMPIONATI_DEFAULT.map(c => ({ ...c, attivo: true }))).select()
      campionatiDB = nuoviCampionati || []
    }
    setCampionati(campionatiDB)
    
    // 2. Caricamento Eventi
    const { data: eventiDB } = await supabase.from('eventi_calendario').select('*').order('data_inizio')
    setEventi(eventiDB || [])
    
    // 3. Caricamento Utenti
    const { data: utentiDB } = await supabase.from('utenti').select('username, nome, cognome')
    setUtenti(utentiDB || [])
    
    // 4. Caricamento Prenotazioni con protezione "null null"
    const { data: prenotazioniDB } = await supabase.from('prenotazioni_accrediti').select('*')
    
    const prenotazioniConNomi = (prenotazioniDB || []).map(p => {
      const utente = (utentiDB || []).find(u => u.username === p.username)
      
      // Fallback: se non troviamo nome/cognome, usiamo lo username
      let nomeVisualizzato = p.username 
      
      if (utente) {
        const n = utente.nome || ''
        const c = utente.cognome || ''
        const unito = `${n} ${c}`.trim()
        
        // Se la stringa unita non è vuota, usiamo il nome reale
        if (unito) {
          nomeVisualizzato = unito
        }
      }
      
      return { ...p, nome_completo: nomeVisualizzato }
    })
    
    setPrenotazioni(prenotazioniConNomi)
    
    // 5. Caricamento Notifiche e fine loading
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
    await inviaNotificaPush(messaggio)
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
  
  async function cancellaTutte() {
    try {
      const tutteNotifiche = notifiche
      for (const n of tutteNotifiche) {
        await supabase
          .from('notifiche_lette')
          .upsert({ 
            username: utenteCorrente.username, 
            notifica_id: n.id 
          }, { 
            onConflict: 'username,notifica_id',
            ignoreDuplicates: true 
          })
      }
      await caricaNotifiche()
      setShowNotifiche(false)
    } catch (err) {
      console.error('Errore cancella tutte:', err)
    }
  }
  
  function cambiaMese(offset) {
    setMeseCorrente(new Date(meseCorrente.getFullYear(), meseCorrente.getMonth() + offset))
  }
  
  function formatData(dataStr) {
    if (!dataStr) return ''
    const [anno, mese, giorno] = dataStr.split('-')
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 
                  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    return `${parseInt(giorno)} ${mesi[parseInt(mese) - 1]}`
  }
  
  function getEventiMese() {
    // Se è mobile, restituiamo tutti gli eventi per la lista stile "Agenda"
    if (isMobile) {
      return eventi; 
    }
    
    const anno = meseCorrente.getFullYear();
    const mese = meseCorrente.getMonth();
    
    // CORREZIONE 31 DICEMBRE: Costruzione manuale stringa YYYY-MM-DD
    const primoGiorno = `${anno}-${String(mese + 1).padStart(2, '0')}-01`;
    const ultimoG = new Date(anno, mese + 1, 0).getDate();
    const ultimoGiorno = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(ultimoG).padStart(2, '0')}`;
    
    return eventi.filter(e => {
      const inizio = e.data_inizio;
      const fine = e.data_fine || e.data_inizio;
      return (inizio <= ultimoGiorno && fine >= primoGiorno);
    });
  }
  
  const notificheNonLette = notifiche.filter(n => !n.letta).length;
  
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px', color: '#666' }}>Caricamento...</div>;
  
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      {/* HEADER */}
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
      
      {/* NAVIGAZIONE MESE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '10px' : '12px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={() => cambiaMese(-1)} style={{ padding: isMobile ? '10px 16px' : '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: isMobile ? '16px' : '13px', minHeight: isMobile ? '44px' : 'auto' }}>←</button>
        <div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 'bold' }}>{MESI_ITALIANO[meseCorrente.getMonth()]} {meseCorrente.getFullYear()}</div>
        <button onClick={() => cambiaMese(1)} style={{ padding: isMobile ? '10px 16px' : '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: isMobile ? '16px' : '13px', minHeight: isMobile ? '44px' : 'auto' }}>→</button>
      </div>
      
      {/* LEGENDA */}
      <div style={{ padding: isMobile ? '8px 10px' : '10px 30px', background: 'white', borderBottom: '1px solid #e0e0e0', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: '12px', fontSize: isMobile ? '10px' : '11px', minWidth: isMobile ? 'max-content' : 'auto' }}>
          {campionati.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.colore, flexShrink: 0 }}></div><span>{c.emoji} {c.nome}</span></div>)}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#666', flexShrink: 0 }}></div><span>📅 Eventi</span></div>
        </div>
      </div>
      
      {/* CONTENUTO CALENDARIO */}
      <div style={{ flex: 1, padding: isMobile ? '10px' : '20px 30px', overflow: 'auto' }}>
        {isMobile ? (
          <ListaGiorniMobile mese={meseCorrente} eventi={getEventiMese()} campionati={campionati} prenotazioni={prenotazioni} onEventoClick={e => setEventoSelezionato(e)} />
        ) : (
          <CalendarioMensile mese={meseCorrente} eventi={getEventiMese()} campionati={campionati} prenotazioni={prenotazioni} onEventoClick={e => setEventoSelezionato(e)} isMobile={isMobile} />
        )}
      </div>
      
      {/* MODALI - RIPRISTINATI E COMPLETI */}
      {showNuovoEvento && (
        <NuovoEventoModal 
          campionati={campionati} 
          onClose={() => setShowNuovoEvento(false)} 
          onSave={async (titolo, eventoId, dataInizio) => { 
            const dataFormattata = formatData(dataInizio);
            await creaNotifica('nuovo_evento', `📅 Nuovo evento: ${titolo} il ${dataFormattata}`, eventoId); 
            caricaDati(); 
          }} 
          utenteCorrente={utenteCorrente} 
          isMobile={isMobile} 
        />
      )}
      
      {showGestioneCampionati && (
        <GestioneCampionatiModal 
          campionati={campionati} 
          onClose={() => setShowGestioneCampionati(false)} 
          onUpdate={caricaDati} 
          isMobile={isMobile} 
        />
      )}
      
      {showNotifiche && (
        <NotificheModal 
          notifiche={notifiche} 
          onClose={() => setShowNotifiche(false)} 
          onSegnaLetta={segnaComeLetta} 
          onSegnaTutteLette={segnaTutteComeLette} 
          onCancellaTutte={cancellaTutte} 
          isMobile={isMobile} 
        />
      )}
      
      {eventoSelezionato && (
        <DettaglioEventoModal 
          evento={eventoSelezionato} 
          campionati={campionati} 
          prenotazioni={prenotazioni} 
          utenti={utenti} 
          isAdmin={isAdmin} 
          utenteCorrente={utenteCorrente} 
          onClose={() => setEventoSelezionato(null)} 
          onUpdate={async (notificaMsg) => { 
            if (notificaMsg) { 
              const dataFormattata = formatData(eventoSelezionato.data_inizio);
              const messaggioConData = `${notificaMsg} il ${dataFormattata}`;
              await creaNotifica('modifica', messaggioConData, eventoSelezionato.id); 
            } 
            caricaDati(); 
          }} 
          isMobile={isMobile} 
        />
      )}
    </div>
  );
}

function ListaGiorniMobile({ mese, eventi, campionati, prenotazioni, onEventoClick }) {
  const anno = mese.getFullYear();
  const meseNum = mese.getMonth(); // 11 per Dicembre
  const ultimoGiornoMese = new Date(anno, meseNum + 1, 0).getDate();
  
  const oggi = new Date();
  const oggiStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;

  const tuttiIGiorni = [];

  for (let g = 1; g <= ultimoGiornoMese; g++) {
    // Costruiamo la data in modo esplicito (Mezzogiorno per sicurezza fuso)
    const dataGiorno = new Date(anno, meseNum, g, 12, 0, 0);
    
    // Formato YYYY-MM-DD esatto per il confronto con il DB
    const mStr = String(meseNum + 1).padStart(2, '0');
    const gStr = String(g).padStart(2, '0');
    const dataCorrenteStr = `${anno}-${mStr}-${gStr}`;
    
    const isOggi = dataCorrenteStr === oggiStr;
    const nomeGiorno = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][dataGiorno.getDay()];

    const eventiGiorno = eventi.filter(evento => {
      // Puliamo le stringhe da eventuali spazi
      const inizio = evento.data_inizio.trim();
      const fine = (evento.data_fine || evento.data_inizio).trim();
      
      // Confronto puramente testuale (il più affidabile per le date YYYY-MM-DD)
      return dataCorrenteStr >= inizio && dataCorrenteStr <= fine;
    });

    // Debug per il 31 Dicembre (lo vedrai nella console del browser F12)
    if (g === 31 && meseNum === 11) {
      console.log("DEBUG 31 DIC:", {
        dataCorrenteStr,
        eventiTrovati: eventiGiorno.length,
        tuttiEventiDB: eventi
      });
    }

    tuttiIGiorni.push({ 
      data: dataCorrenteStr, 
      giorno: g, 
      nomeGiorno, 
      isOggi, 
      eventi: eventiGiorno 
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '30px' }}>
      {tuttiIGiorni.map(({ data, giorno, nomeGiorno, isOggi, eventi: eventiGiorno }) => (
        <div key={data} style={{ 
          background: isOggi ? '#007AFF' : 'white', 
          borderRadius: '12px', 
          padding: '12px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          border: isOggi ? 'none' : '1px solid #eee'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: eventiGiorno.length > 0 ? '10px' : '0' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: isOggi ? 'rgba(255,255,255,0.8)' : '#999', marginRight: '8px' }}>
                {nomeGiorno.toUpperCase()}
              </span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: isOggi ? 'white' : '#333' }}>
                {giorno}
              </span>
            </div>
            {isOggi && <div style={{ fontSize: '10px', fontWeight: '800', color: 'white', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px' }}>OGGI</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {eventiGiorno.map(evento => {
              const campionato = campionati.find(c => c.id === evento.campionato_id);
              const colore = evento.tipo === 'gara' && campionato ? campionato.colore : (evento.colore_personalizzato || '#666');
              
              return (
                <div key={evento.id} onClick={() => onEventoClick(evento)} style={{ 
                  padding: '10px', 
                  background: isOggi ? 'rgba(255,255,255,0.15)' : '#f8f9fa',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${colore}`,
                  cursor: 'pointer'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: isOggi ? 'white' : '#333' }}>
                    {evento.titolo}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarioMensile({ mese, eventi, campionati, prenotazioni, onEventoClick, isMobile }) {
  const anno = mese.getFullYear(), meseNum = mese.getMonth()
  const primoGiorno = new Date(anno, meseNum, 1).getDay(), ultimoGiorno = new Date(anno, meseNum + 1, 0).getDate()
  const offset = primoGiorno === 0 ? 6 : primoGiorno - 1
  const giorni = []
  for (let i = 0; i < offset; i++) giorni.push(<div key={`empty-${i}`} style={{ background: '#f9f9f9', borderRadius: '6px' }}></div>)
  for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
    const dataStr = `${anno}-${String(meseNum + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
    const eventiGiorno = eventi.filter(e => dataStr >= e.data_inizio && dataStr <= (e.data_fine || e.data_inizio))
    const isOggi = new Date().toDateString() === new Date(anno, meseNum, giorno).toDateString()
    giorni.push(<GiornoCell key={giorno} giorno={giorno} eventi={eventiGiorno} campionati={campionati} prenotazioni={prenotazioni} isOggi={isOggi} onEventoClick={onEventoClick} isMobile={isMobile} />)
  }
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Intestazione Giorni */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '8px', 
        marginBottom: '15px' 
      }}>
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(g => (
          <div key={g} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>
            {g}
          </div>
        ))}
      </div>

      {/* Griglia Calendario - Questa è la parte che "alza" le celle */}
      <div style={{ 
        flex: 1, 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gridAutoRows: '120px', 
        gap: '5px', 
        paddingBottom: '10px', // Crea il vuoto in fondo
        alignContent: 'start'   // Impedisce alla griglia di allungarsi
      }}>
        {giorni}
      </div>
    </div>
  );
} // <--- QUESTA CHIUDE IL COMPONENTE CALENDARIOMENSILE

function GiornoCell({ giorno, eventi, campionati, prenotazioni, isOggi, onEventoClick, isMobile }) {
  // ... (manteniamo la parte mobile invariata)
  if (isMobile) {
    // codice mobile esistente...
  }
  
  return (
    <div style={{ background: 'white', borderRadius: '8px', border: isOggi ? '2px solid #007AFF' : '1px solid #e0e0e0', padding: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '6px', color: isOggi ? '#007AFF' : '#000', flexShrink: 0 }}>{giorno}</div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {eventi.map(evento => {
          const campionato = campionati.find(c => c.id === evento.campionato_id)
          const colore = evento.tipo === 'gara' && campionato ? campionato.colore : (evento.colore_personalizzato || '#666')
          const emoji = evento.tipo === 'gara' && campionato ? campionato.emoji : '📅'
          const sigla = evento.tipo === 'gara' && campionato ? campionato.sigla : 'EVENTO'
          const prenotazioniEvento = prenotazioni.filter(p => p.evento_id === evento.id)
          const numPrenotati = prenotazioniEvento.length
          const maxAccrediti = evento.max_accrediti || 0
          
          let badge = null
          if (evento.accredito_status === 'da_richiedere') badge = { icon: '🟡', text: 'DA RICHIEDERE', bg: '#FFD60A', color: '#000' }
          else if (evento.accredito_status === 'richiesto') badge = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
          else if (evento.accredito_status === 'accettato') badge = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
          
          return (
            <div key={evento.id} onClick={() => onEventoClick(evento)} title={evento.titolo} style={{ 
              padding: '8px', 
              background: `${colore}10`, 
              borderLeft: `5px solid ${colore}`, 
              borderRadius: '6px', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {/* Riga Categoria/Sigla - Leggermente più grande */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                <span>{emoji}</span>
                <strong style={{ color: colore, letterSpacing: '0.5px' }}>{sigla}</strong>
              </div>
              
              {/* TITOLO - Ingrandito e più evidente */}
              <div style={{ fontSize: '13px', fontWeight: '800', lineHeight: '1', color: '#1a1a1a' }}>
                {evento.titolo.toUpperCase()}
              </div>
              
              {/* FASCIA STATO (es. ACCETTATO) - Ingrandita a tutta larghezza */}
              {badge && (
                <div style={{ 
                  fontSize: '10px', 
                  padding: '1px 2px', 
                  background: badge.bg, 
                  color: badge.color, 
                  borderRadius: '4px', 
                  fontWeight: '900', 
                  textAlign: 'center',
                  marginTop: '2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  {badge.icon} {badge.text}
                </div>
              )}
              
              {/* Omini e Conteggio Pass */}
              {maxAccrediti > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', padding: '0 2px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: maxAccrediti }, (_, i) => (
                      <span key={i} style={{ fontSize: '13px', filter: i < numPrenotati ? 'none' : 'grayscale(1)', opacity: i < numPrenotati ? 1 : 0.2 }}>
                        👤
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: numPrenotati >= maxAccrediti ? '#FF3B30' : '#444' }}>
                    {numPrenotati}/{maxAccrediti}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NuovoEventoModal({ campionati, onClose, onSave, utenteCorrente, isMobile }) {
  const [tipo, setTipo] = useState('gara') // 'gara' o 'evento'
  const [campionatoId, setCampionatoId] = useState(campionati[0]?.id || '')
  const [titolo, setTitolo] = useState('')
  const [dataInizio, setDataInizio] = useState('')
  const [dataFine, setDataFine] = useState('')
  const [maxAccrediti, setMaxAccrediti] = useState(0)
  const [accreditoStatus, setAccreditoStatus] = useState('nessuno')
  const [note, setNote] = useState('')
  const [colorePersonalizzato, setColorePersonalizzato] = useState('#666666')
  const [salvando, setSalvando] = useState(false)
  
  async function salva() {
    if (!titolo || !dataInizio) return alert('Compila titolo e data inizio')
    setSalvando(true)
    
    const nuovoEvento = { 
      tipo, 
      campionato_id: tipo === 'gara' ? campionatoId : null, 
      titolo, 
      data_inizio: dataInizio, 
      data_fine: dataFine || null, 
      max_accrediti: maxAccrediti, 
      accredito_status: accreditoStatus, 
      note, 
      // Il colore personalizzato viene salvato solo se il tipo è 'evento'
      colore_personalizzato: tipo === 'evento' ? colorePersonalizzato : null, 
      creato_da: utenteCorrente.username 
    }
    
    const { data: eventoCreato } = await supabase.from('eventi_calendario').insert(nuovoEvento).select().single()
    await onSave(titolo, eventoCreato?.id, dataInizio)
    setSalvando(false)
    onClose()
  }
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Nuovo Evento</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
          
          {/* SELEZIONE TIPO (TAB) */}
          <div style={{ marginBottom: '25px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#666' }}>CATEGORIA EVENTO</div>
            <div style={{ display: 'flex', background: '#f0f0f0', padding: '4px', borderRadius: '10px', gap: '4px' }}>
              <button 
                onClick={() => setTipo('gara')}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s', background: tipo === 'gara' ? 'white' : 'transparent', color: tipo === 'gara' ? '#007AFF' : '#666', boxShadow: tipo === 'gara' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
              >🏎️ Gara</button>
              <button 
                onClick={() => setTipo('evento')}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s', background: tipo === 'evento' ? 'white' : 'transparent', color: tipo === 'evento' ? '#007AFF' : '#666', boxShadow: tipo === 'evento' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
              >📅 Evento</button>
            </div>
          </div>

          {/* CAMPIONATO (Solo se Gara) */}
          {tipo === 'gara' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Campionato</div>
              <select value={campionatoId} onChange={e => setCampionatoId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
                {campionati.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}
              </select>
            </div>
          )}

          {/* COLORE PERSONALIZZATO (Solo se Altro Evento) */}
          {tipo === 'evento' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Colore Etichetta</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <input 
                  type="color" 
                  value={colorePersonalizzato} 
                  onChange={e => setColorePersonalizzato(e.target.value)} 
                  style={{ width: '60px', height: '44px', padding: '2px', border: '2px solid #ddd', borderRadius: '8px', cursor: 'pointer' }} 
                />
                <span style={{ fontSize: '14px', color: '#666' }}>Scegli come apparirà nel calendario</span>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo</div>
            <input type="text" value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="Es: GP Italia" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Inizio</div>
              <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Fine (opzionale)</div>
              <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Numero Pass Disponibili (0 = nessuno)</div>
            <input type="number" min="0" value={maxAccrediti} onChange={e => setMaxAccrediti(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Stato Accredito</div>
            <select value={accreditoStatus} onChange={e => setAccreditoStatus(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
              <option value="nessuno">Nessuno</option>
              <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
              <option value="richiesto">📨 Richiesto</option>
              <option value="accettato">✅ Accettato</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note (opzionali)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Informazioni aggiuntive..." style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', justifyContent: 'flex-end', padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ padding: isMobile ? '14px' : '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Annulla</button>
          <button onClick={salva} disabled={salvando} style={{ padding: isMobile ? '14px' : '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>{salvando ? '...' : 'Salva Evento'}</button>
        </div>
      </div>
    </div>
  )
}

function GestioneCampionatiModal({ campionati, onClose, onUpdate, isMobile }) {
  const [lista, setLista] = useState(campionati)
  const [edit, setEdit] = useState(null)
  async function salva() {
    if (edit.id) await supabase.from('campionati').update({ nome: edit.nome, colore: edit.colore, emoji: edit.emoji, sigla: edit.sigla }).eq('id', edit.id)
    else await supabase.from('campionati').insert({ nome: edit.nome, colore: edit.colore, emoji: edit.emoji, sigla: edit.sigla, attivo: true })
    await onUpdate(); setEdit(null)
  }
  async function elimina(id) {
    if (!confirm('Eliminare questo campionato?')) return
    await supabase.from('campionati').update({ attivo: false }).eq('id', id); await onUpdate()
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
              {campionati.map(c => (
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
      await onUpdate(`${utenteCorrente.username} ha annullato la prenotazione per ${evento.titolo}`)
    } else {
      await supabase.from('prenotazioni_accrediti').insert({ evento_id: evento.id, username: utenteCorrente.username })
      await onUpdate(`${utenteCorrente.username} si è prenotato per ${evento.titolo}`)
    }
  }
  
  async function elimina() {
    if (!confirm('Eliminare questo evento?')) return
    await supabase.from('eventi_calendario').delete().eq('id', evento.id); await onUpdate(null); onClose()
  }
  
  async function salva() {
    setSalvando(true)
    await supabase.from('eventi_calendario').update({ titolo: edit.titolo, data_inizio: edit.data_inizio, data_fine: edit.data_fine || null, max_accrediti: edit.max_accrediti || 0, accredito_status: edit.accredito_status, note: edit.note }).eq('id', edit.id)
    await onUpdate(`Evento ${edit.titolo} modificato`); setSalvando(false); setModalita('visualizza')
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
  
  let b = null
  if (evento.accredito_status === 'da_richiedere') b = { icon: '🟡', text: 'DOVREMMO RICHIEDERLO', bg: '#FFD60A', color: '#000' }
  else if (evento.accredito_status === 'richiesto') b = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
  else if (evento.accredito_status === 'accettato') b = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
  
  const slots = Array.from({ length: maxAccrediti }, (_, i) => prenotazioniEvento[i] || null)
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Dettagli</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>{evento.titolo}</div>
          {b && <div style={{ marginBottom: '20px', padding: '15px', background: b.bg, color: b.color, borderRadius: '10px', fontWeight: 'bold' }}>{b.icon} {b.text}</div>}
          <div style={{ marginBottom: '20px' }}>📅 {new Date(evento.data_inizio).toLocaleDateString()} {evento.data_fine && `- ${new Date(evento.data_fine).toLocaleDateString()}`}</div>
          {maxAccrediti > 0 && <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f7', borderRadius: '10px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>👤 Pass ({numPrenotati}/{maxAccrediti})</div>
            {slots.map((p, i) => (
              <div key={i} style={{ padding: '8px', background: 'white', borderRadius: '6px', marginBottom: '6px', fontSize: '14px' }}>
                {p ? `👤 ${p.nome_completo}` : `Posto ${i+1} libero`}
              </div>
            ))}
            <button onClick={togglePrenotazione} style={{ width: '100%', marginTop: '10px', padding: '12px', background: prenotatoCorrente ? '#FF3B30' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              {prenotatoCorrente ? 'Annulla prenotazione' : 'Prenota pass'}
            </button>
          </div>}
          {evento.note && <div style={{ fontSize: '14px', color: '#666' }}>📝 {evento.note}</div>}
        </div>
        <div style={{ padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          {isAdmin ? <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={elimina} style={{ flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px' }}>Elimina</button>
            <button onClick={() => setModalita('modifica')} style={{ flex: 1, padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px' }}>Modifica</button>
          </div> : <button onClick={onClose} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px' }}>Chiudi</button>}
        </div>
      </div>
    </div>
  )
}

function NotificheModal({ notifiche, onClose, onSegnaLetta, onSegnaTutteLette, onCancellaTutte, isMobile }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '600px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>🔔 Notifiche</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '20px 30px' }}>
          {notifiche.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nessuna notifica</div> : 
            notifiche.map(n => (
              <div key={n.id} onClick={() => !n.letta && onSegnaLetta(n.id)} style={{ padding: '15px', background: n.letta ? '#f5f5f7' : '#007AFF15', borderRadius: '10px', marginBottom: '10px', borderLeft: `4px solid ${n.letta ? '#ccc' : '#007AFF'}` }}>
                <div style={{ fontSize: '14px', fontWeight: n.letta ? 'normal' : 'bold' }}>{n.messaggio}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))
          }
        </div>
        <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onSegnaTutteLette} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Segna tutte come lette</button>
        </div>
      </div>
    </div>
  )
}

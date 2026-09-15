import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Utility: Estrai e formatta le sessioni per un giorno specifico
function estraiSessioniGiornata(programmazione_weekend, giornoKey) {
  if (!programmazione_weekend) return [];
  let programmazionePerGiorno = null;
  if (typeof programmazione_weekend === 'object' && programmazione_weekend !== null && !Array.isArray(programmazione_weekend)) {
    programmazionePerGiorno = programmazione_weekend;
  } else if (typeof programmazione_weekend === 'string') {
    try {
      programmazionePerGiorno = JSON.parse(programmazione_weekend);
    } catch (e) {
      return [];
    }
  } else {
    return [];
  }
  if (!programmazionePerGiorno || typeof programmazionePerGiorno !== 'object') return [];
  const nomiGiorni = {
    'sabato': 'sab', 'domenica': 'dom', 'lunedì': 'lun', 'martedì': 'mar', 'mercoledì': 'mer', 'giovedì': 'gio', 'venerdì': 'ven',
    'sab': 'sab', 'dom': 'dom', 'lun': 'lun', 'mar': 'mar', 'mer': 'mer', 'gio': 'gio', 'ven': 'ven'
  };
  const giornoKeyStr = typeof giornoKey === 'string' ? giornoKey : String(giornoKey || '').trim();
  let chiave = nomiGiorni[giornoKeyStr.toLowerCase()] || giornoKeyStr.toLowerCase();
  let sessioniGiorno = programmazionePerGiorno[chiave];
  if (!sessioniGiorno) return [];
  let sessioniPulite = Array.isArray(sessioniGiorno) ? sessioniGiorno.map(s => {
    if (typeof s === 'string') {
      const match = s.match(/(.+?):\s*([0-9]{2}:[0-9]{2})/);
      if (match) {
        return { nome: match[1].trim(), orario: match[2].trim() };
      }
      return null;
    } else if (typeof s === 'object' && s !== null) {
      return s;
    }
    return null;
  }).filter(Boolean) : [];
  return sessioniPulite;
}

const CAMPIONATI_DEFAULT = [
  { id: 'f1', nome: 'Formula 1', colore: '#E10600', emoji: '🏎️', sigla: 'F1' },
  { id: 'f2', nome: 'Formula 2', colore: '#0090D0', emoji: '🏎️', sigla: 'F2' },
  { id: 'f3', nome: 'Formula 3', colore: '#FF6800', emoji: '🏎️', sigla: 'F3' },
  { id: 'motogp', nome: 'MotoGP', colore: '#D4145A', emoji: '🏍️', sigla: 'MOTOGP' },
  { id: 'wec', nome: 'WEC', colore: '#00A19C', emoji: '🏁', sigla: 'WEC' },
  { id: 'indycar', nome: 'IndyCar', colore: '#C8102E', emoji: '🏎️', sigla: 'INDYCAR' },
  { id: 'fe', nome: 'Formula E', colore: '#0098DB', emoji: '⚡', sigla: 'FE' }
]

// Funzione per formattare orario HH:MM (senza secondi)
function formatOrario(orario) {
  if (!orario) return null
  if (orario.length === 5) return orario
  return orario.substring(0, 5)
}

// Utility: determina se lo stato accredito è "urgente" in base ai giorni mancanti
// da_richiedere -> urgente entro 3 mesi (90 giorni) — nessuna azione ancora presa
// richiesto -> urgente entro 3 settimane (21 giorni) — richiesta già inviata, in attesa di risposta
function isStatoAccreditoUrgente(accreditoStatus, giorniMancanti) {
  if (typeof giorniMancanti !== 'number') return false
  if (accreditoStatus === 'da_richiedere') return giorniMancanti <= 90
  if (accreditoStatus === 'richiesto') return giorniMancanti <= 21
  return false
}

export default function EventiMobileMenu({ onClose }) {
  const [prossimoEvento, setProssimoEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Detect mobile
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  
  useEffect(() => {
    caricaProssimoEvento()
  }, [])
  
  async function caricaProssimoEvento() {
    try {
      setLoading(true)
      
      // Carica eventi, prenotazioni e utenti in parallelo
      const [eventiResponse, prenotazioniResponse, utentiResponse] = await Promise.all([
        supabase.from('eventi_calendario').select('*').order('data_inizio').order('orario', { nullsFirst: false }),
        supabase.from('prenotazioni_accrediti').select('*'),
        supabase.from('utenti').select('username, nome, cognome')
      ])
      
      let eventi = eventiResponse.data
      const prenotazioniDB = prenotazioniResponse.data || []
      const utentiDB = utentiResponse.data || []
      
      if (!eventi || eventi.length === 0) {
        setProssimoEvento(null)
        setLoading(false)
        return
      }
      
      // Ordina gli eventi PER DATA prima, poi per campionato (F1 > F2 > F3)
      eventi = eventi.sort((a, b) => {
        // Prima ordina per data
        const diffData = new Date(a.data_inizio) - new Date(b.data_inizio);
        if (diffData !== 0) {
          return diffData;
        }
        
        // Se stessa data, ordina per priorità campionato (F1 > F2 > F3)
        const priorità = { 'f1': 0, 'f2': 1, 'f3': 2 };
        const prioritàA = priorità[a.campionato_id] !== undefined ? priorità[a.campionato_id] : 999;
        const prioritàB = priorità[b.campionato_id] !== undefined ? priorità[b.campionato_id] : 999;
        return prioritàA - prioritàB;
      });
      
      const oggi = new Date()
      oggi.setHours(0, 0, 0, 0)
      
      const eventiFuturi = eventi.filter(evento => {
        const dataEvento = new Date(evento.data_inizio)
        return dataEvento >= oggi
      })
      
      if (eventiFuturi.length === 0) {
        setProssimoEvento(null)
        setLoading(false)
        return
      }
      
      // Scansiona TUTTI gli eventi futuri (non solo i prossimi 6 mostrati) per segnalare
      // accrediti da gestire con urgenza, anche se lontani nel tempo
      const accreditiUrgenti = eventiFuturi
        .map(ev => {
          const dataEv = new Date(ev.data_inizio)
          dataEv.setHours(0, 0, 0, 0)
          const giorniMancantiEv = Math.floor((dataEv.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
          return { ...ev, giorniMancantiEv }
        })
        .filter(ev => {
          if (ev.accredito_status === 'da_richiedere') return ev.giorniMancantiEv <= 90
          if (ev.accredito_status === 'richiesto') return ev.giorniMancantiEv <= 21
          return false
        })
        .sort((a, b) => a.giorniMancantiEv - b.giorniMancantiEv)
      
      const prossimo = eventiFuturi[0]
      
      const dataProssimo = new Date(prossimo.data_inizio)
      oggi.setHours(0, 0, 0, 0)
      dataProssimo.setHours(0, 0, 0, 0)
      const giorniMancantiProssimo = Math.floor((dataProssimo.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
      
      // Prendi i prossimi 6 eventi futuri (1 prossimo + 5 altri), indipendentemente dalla data
      const eventiProssimi5Giorni = eventiFuturi.slice(0, 6)
      
      // Calcola le prenotazioni per tutti gli eventi dei prossimi 5 giorni
      const prenotatiConNomi = []
      eventiProssimi5Giorni.forEach(evento => {
        const prenotatiEvento = prenotazioniDB.filter(p => p.evento_id === evento.id)
        const prenotatiConNomiEvento = prenotatiEvento.map(prenotazione => {
          const utente = utentiDB.find(u => u.username === prenotazione.username)
          return {
            ...prenotazione,
            nomeCompleto: utente ? `${utente.nome || ''} ${utente.cognome || ''}`.trim() || prenotazione.username : prenotazione.username,
            eventoTitolo: evento.titolo
          }
        })
        prenotatiConNomi.push(...prenotatiConNomiEvento)
      })
      
      const accettati = prenotatiConNomi.filter(p => p.stato === 'accettato')
      const richiesti = prenotatiConNomi.filter(p => p.stato === 'richiesto')
      const totaliPrenotati = prenotatiConNomi.length
      
      // Calcola i dati per tutti gli eventi dei prossimi 5 giorni
      const tuttiEventiFuturi = eventiProssimi5Giorni.map((evento, index) => {
        const campionato = CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)
        const emojiCampionato = campionato ? campionato.emoji : '📅'
        
        const dataEvento = new Date(evento.data_inizio)
        const dataBreve = dataEvento.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
        
        const giorniMancanti = Math.floor((dataEvento.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
        
        // Estrai tutte le sessioni dalla programmazione weekend raggruppate per giorno
        let sessioniPerGiorno = []
        let dataInizioEvento = null
        let dataFineEvento = null
        
        if (evento.programmazione_weekend) {
          let programmazionePerGiorno = null
          if (typeof evento.programmazione_weekend === 'object' && evento.programmazione_weekend !== null && !Array.isArray(evento.programmazione_weekend)) {
            programmazionePerGiorno = evento.programmazione_weekend
          } else if (typeof evento.programmazione_weekend === 'string') {
            try {
              programmazionePerGiorno = JSON.parse(evento.programmazione_weekend)
            } catch (e) {
              programmazionePerGiorno = null
            }
          }
          
          if (programmazionePerGiorno && typeof programmazionePerGiorno === 'object') {
            const ordineGiorni = { 'ven': 0, 'sab': 1, 'dom': 2, 'lun': 3, 'mar': 4, 'mer': 5, 'gio': 6 }
            const giorniOffset = { 'ven': -1, 'sab': 0, 'dom': 1, 'lun': 2, 'mar': 3, 'mer': 4, 'gio': 5 }
            
            Object.entries(programmazionePerGiorno).forEach(([giorno, sessioni]) => {
              if (Array.isArray(sessioni)) {
                const offset = giorniOffset[giorno] ?? 0
                const dataGiorno = new Date(dataEvento)
                dataGiorno.setDate(dataGiorno.getDate() + offset)
                const dataGiornoStr = dataGiorno.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
                
                // Calcola data inizio e fine evento
                if (!dataInizioEvento || dataGiorno < dataInizioEvento) {
                  dataInizioEvento = new Date(dataGiorno)
                }
                if (!dataFineEvento || dataGiorno > dataFineEvento) {
                  dataFineEvento = new Date(dataGiorno)
                }
                
                const sessioniGiorno = []
                sessioni.forEach(s => {
                  if (typeof s === 'string') {
                    const match = s.match(/(.+?):\s*([0-9]{2}:[0-9]{2})/)
                    if (match) {
                      sessioniGiorno.push({ nome: match[1].trim(), orario: match[2].trim() })
                    }
                  } else if (typeof s === 'object' && s !== null && s.nome && s.orario) {
                    sessioniGiorno.push({ nome: s.nome, orario: s.orario })
                  }
                })
                
                // Ordina sessioni del giorno per orario
                sessioniGiorno.sort((a, b) => a.orario.localeCompare(b.orario))
                
                if (sessioniGiorno.length > 0) {
                  sessioniPerGiorno.push({
                    giorno,
                    data: dataGiornoStr,
                    sessioni: sessioniGiorno,
                    ordine: ordineGiorni[giorno] ?? 999
                  })
                }
              }
            })
            
            // Ordina i giorni
            sessioniPerGiorno.sort((a, b) => a.ordine - b.ordine)
          }
        }
        
        // Se non c'è programmazione_weekend, usa data_inizio e data_fine dell'evento
        if (!dataInizioEvento && !dataFineEvento && evento.data_fine) {
          dataInizioEvento = new Date(evento.data_inizio)
          dataFineEvento = new Date(evento.data_fine)
        }
        
        // Calcola intervallo date completo
        let dataBreveCompleta = dataBreve
        if (dataInizioEvento && dataFineEvento && dataInizioEvento.getTime() !== dataFineEvento.getTime()) {
          const dataInizioStr = dataInizioEvento.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          const dataFineStr = dataFineEvento.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          dataBreveCompleta = `${dataInizioStr} - ${dataFineStr}`
        }
        
        return {
          ...evento,
          giorniMancanti,
          emojiCampionato,
          dataBreve: dataBreveCompleta,
          sessioniPerGiorno
        }
      })
      
      console.log('DEBUG EventiMobileMenu - eventiProssimi5Giorni:', eventiProssimi5Giorni)
      console.log('DEBUG EventiMobileMenu - tuttiEventiFuturi:', tuttiEventiFuturi)
      
      setProssimoEvento({
        ...prossimo,
        giorniMancanti: giorniMancantiProssimo,
        dataFormattata: dataProssimo.toLocaleDateString('it-IT', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        emojiCampionato: CAMPIONATI_DEFAULT.find(c => c.id === prossimo.campionato_id)?.emoji || '📅',
        nomeCampionato: CAMPIONATI_DEFAULT.find(c => c.id === prossimo.campionato_id)?.nome || 'Evento',
        maxAccrediti: prossimo.max_accrediti,
        accettati: accettati.length,
        richiesti: richiesti.length,
        prenotatiConNomi,
        tuttiEventiFuturi,
        eventiProssimi5Giorni: tuttiEventiFuturi,
        accreditiUrgenti
      })
      
    } catch (error) {
      console.error('Errore:', error)
      setProssimoEvento(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', boxSizing: 'border-box' }}>
        <div style={{
          background: 'rgba(28, 28, 30, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '16px',
          minWidth: '280px',
          maxWidth: '340px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFF' }}>
            Caricamento...
          </div>
        </div>
      </div>
    )
  }

  if (!prossimoEvento) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', boxSizing: 'border-box' }}>
        <div style={{
          background: 'rgba(28, 28, 30, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '16px',
          minWidth: '280px',
          maxWidth: '340px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFF' }}>
              Nessun evento
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
              style={{
                background: 'rgba(255, 255, 255, 0.12)', border: 'none', color: 'rgba(255,255,255,0.85)',
                fontSize: '13px', cursor: 'pointer', width: '26px', height: '26px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    )
  }

  const haAccreditoUrgente = (prossimoEvento.accreditiUrgenti || []).length > 0

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 16px)',
      paddingRight: 'calc(env(safe-area-inset-right, 0px) + 16px)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'rgba(28, 28, 30, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: haAccreditoUrgente ? '1px solid rgba(255, 69, 58, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '16px',
        minWidth: '290px',
        maxWidth: '340px',
        width: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
        animation: haAccreditoUrgente ? 'pulseUrgenteBordo 1.6s ease-in-out infinite' : 'none',
        overflow: 'hidden'
      }}>
        <style>{`
          @keyframes pulseUrgenteAccredito {
            0% { opacity: 1; }
            50% { opacity: 0.65; }
            100% { opacity: 1; }
          }
          @keyframes pulseUrgenteBordo {
            0% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.45); }
            70% { box-shadow: 0 0 0 8px rgba(255, 69, 58, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0); }
          }
        `}</style>

        {/* HEADER: titolo + chiusura, SEMPRE visibile e raggiungibile (non scrolla via) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexShrink: 0 }}>
          <div style={{ fontSize: '17px', fontWeight: '700', color: '#FFF', letterSpacing: '-0.2px' }}>
            📅 Eventi
          </div>
          <button 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '14px',
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              flexShrink: 0,
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255, 69, 58, 0.85)' }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(255, 255, 255, 0.12)' }}
          >
            ✕
          </button>
        </div>
        
        {/* CORPO SCROLLABILE: banner + lista eventi, l'header resta sempre fisso sopra */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
        
        {/* BANNER RIEPILOGO: accrediti da gestire, indipendentemente da quale sia il "prossimo evento" */}
        {prossimoEvento.accreditiUrgenti && prossimoEvento.accreditiUrgenti.length > 0 && (
          <div style={{
            background: 'rgba(255, 69, 58, 0.14)',
            border: '1px solid rgba(255, 69, 58, 0.35)',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: '#FF453A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                flexShrink: 0,
                animation: 'pulseUrgenteAccredito 1.6s ease-in-out infinite'
              }}>
                ⚠️
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#FF6961' }}>
                {prossimoEvento.accreditiUrgenti.length} accredit{prossimoEvento.accreditiUrgenti.length === 1 ? 'o' : 'i'} da gestire
              </div>
            </div>
            <div>
              {prossimoEvento.accreditiUrgenti.slice(0, 4).map((ev, idx) => (
                <div key={ev.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '7px 0',
                  borderTop: idx > 0 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none'
                }}>
                  <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.titolo}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.55)', fontWeight: '500' }}>
                      {ev.giorniMancantiEv <= 0 ? 'oggi' : `${ev.giorniMancantiEv}gg`}
                    </span>
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: '700',
                      padding: '3px 7px',
                      borderRadius: '20px',
                      background: 'rgba(255, 69, 58, 0.22)',
                      color: '#FF6961',
                      whiteSpace: 'nowrap'
                    }}>
                      {ev.accredito_status === 'da_richiedere' ? 'DA RICHIEDERE' : 'IN ATTESA'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {prossimoEvento.accreditiUrgenti.length > 4 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '6px', fontWeight: '500' }}>
                + altri {prossimoEvento.accreditiUrgenti.length - 4}
              </div>
            )}
          </div>
        )}
        
        {/* CONTENUTO CON RETTANGOLO BIANCO */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: '8px', 
          padding: '12px',
          marginBottom: '8px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFF', marginBottom: '8px' }}>
            {prossimoEvento.giorniMancanti === 0 ? 'OGGI!' : 
             prossimoEvento.giorniMancanti === 1 ? 'DOMANI!' : 
             `Tra ${prossimoEvento.giorniMancanti} giorni`}
          </div>
          
          <div style={{ fontSize: '13px', color: '#FFF', marginBottom: '8px' }}>
            {prossimoEvento.dataFormattata}
          </div>
          
          {/* MOSTRA TUTTI GLI EVENTI FUTURI IN ORDINE CRONOLOGICO */}
          {prossimoEvento.eventiProssimi5Giorni && prossimoEvento.eventiProssimi5Giorni.map((evento, index) => (
            <div key={evento.id} style={{ marginBottom: index < prossimoEvento.eventiProssimi5Giorni.length - 1 ? '12px' : '0' }}>
              {/* COUNTDOWN SOLO PER EVENTI SUCCESSIVI AL PRIMO */}
              {index > 0 && (
                <div style={{ fontSize: '12px', color: '#FFD60A', fontWeight: 'bold', marginBottom: '4px' }}>
                  {evento.giorniMancanti === 0 ? 'OGGI!' : 
                   evento.giorniMancanti === 1 ? 'DOMANI!' : 
                   `Tra ${evento.giorniMancanti} giorni`}
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '22px' }}>
                  {CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.emoji || '📅'}
                </span>
                <div>
                  <div style={{ fontSize: '14px', color: '#FF4444', fontWeight: 'bold', marginTop: '2px' }}>
                    {typeof CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.nome === 'object' ? '[Oggetto non visualizzabile: ' + JSON.stringify(CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.nome) + ']' : CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.nome || 'Evento'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFF', marginTop: '2px' }}>
                    {typeof evento.titolo === 'object' ? '[Oggetto non visualizzabile: ' + JSON.stringify(evento.titolo) + ']' : evento.titolo}
                  </div>
                  <div style={{ fontSize: '12px', color: '#00D9FF', fontWeight: 'bold', marginTop: '2px' }}>
                    {typeof evento.dataBreve === 'object' ? '[Oggetto non visualizzabile: ' + JSON.stringify(evento.dataBreve) + ']' : evento.dataBreve}
                  </div>
                  {evento.sessioniPerGiorno && evento.sessioniPerGiorno.length > 0 && (
                    <>
                      <div style={{ height: '1px', backgroundColor: '#00D9FF', margin: '4px 0', opacity: '0.5' }}></div>
                      <div style={{ fontSize: '10px', color: '#FFF', marginTop: '2px', lineHeight: '1.4' }}>
                        {evento.sessioniPerGiorno.map((giorno, idx) => (
                          <div key={idx} style={{ marginBottom: idx < evento.sessioniPerGiorno.length - 1 ? '4px' : '0' }}>
                            <span style={{ fontWeight: 'bold', color: '#00D9FF' }}>{giorno.data}:</span>
                            {giorno.sessioni.map((s, sIdx) => (
                              <div key={sIdx} style={{ marginLeft: '4px' }}>
                                {s.nome} {s.orario}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* FASCIA STATO ACCREDITO */}
              {evento.accredito_status && evento.accredito_status !== 'nessuno' && (
                <div style={{ marginBottom: '4px', marginTop: '4px' }}>
                  {(() => {
                    const urgenteBadge = isStatoAccreditoUrgente(evento.accredito_status, evento.giorniMancanti)
                    if (evento.accredito_status === 'da_richiedere') {
                      return (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 10px',
                          borderRadius: '20px',
                          background: urgenteBadge ? 'rgba(255, 69, 58, 0.85)' : 'rgba(255, 214, 10, 0.18)',
                          color: urgenteBadge ? '#FFF' : '#FFD60A',
                          fontSize: '11px',
                          fontWeight: '700',
                          animation: urgenteBadge ? 'pulseUrgenteAccredito 1.6s ease-in-out infinite' : 'none'
                        }}>
                          {urgenteBadge ? `⚠️ Da richiedere — ${evento.giorniMancanti}gg` : '🟡 Da richiedere'}
                        </div>
                      )
                    } else if (evento.accredito_status === 'richiesto') {
                      return (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 10px',
                          borderRadius: '20px',
                          background: urgenteBadge ? 'rgba(255, 69, 58, 0.85)' : 'rgba(255, 149, 0, 0.18)',
                          color: urgenteBadge ? '#FFF' : '#FF9F0A',
                          fontSize: '11px',
                          fontWeight: '700',
                          animation: urgenteBadge ? 'pulseUrgenteAccredito 1.6s ease-in-out infinite' : 'none'
                        }}>
                          {urgenteBadge ? `⚠️ In attesa di risposta — ${evento.giorniMancanti}gg` : '📨 Richiesto'}
                        </div>
                      )
                    } else if (evento.accredito_status === 'accettato') {
                      return (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 10px',
                          borderRadius: '20px',
                          background: 'rgba(52, 199, 89, 0.18)',
                          color: '#30D158',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          ✅ Accettato
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
              
              {/* ACCREDITI SOLO PER L'ULTIMO EVENTO - SOLO SE CI SONO PRENOTAZIONI */}
              {index === prossimoEvento.tuttiEventiFuturi.length - 1 && (prossimoEvento.accettati > 0 || prossimoEvento.richiesti > 0) && (
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', gap: '4px', fontSize: '11px', marginBottom: '4px' }}>
                    {prossimoEvento.accettati > 0 && (
                      <span style={{ 
                        background: '#4CAF50', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        ✅ {prossimoEvento.accettati} accettati
                      </span>
                    )}
                    {prossimoEvento.richiesti > 0 && (
                      <span style={{ 
                        background: '#FF9800', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                      ⏳ {prossimoEvento.richiesti} richiesti
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* FRECCIA IN BASSO */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '8px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }}>
          <span></span>
          <span style={{ fontSize: 'Opx' }}></span>
        </div>
        </div>
      </div>
    </div>
  )
}

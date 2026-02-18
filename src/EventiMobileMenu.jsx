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

// Funzione per formattare orario HH:MM (senza secondi)
function formatOrario(orario) {
  if (!orario) return null
  if (orario.length === 5) return orario
  return orario.substring(0, 5)
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
        
        return {
          ...evento,
          giorniMancanti,
          emojiCampionato,
          dataBreve
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
        eventiProssimi5Giorni: tuttiEventiFuturi
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: '12px',
          minWidth: '280px',
          maxWidth: '320px'
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: '12px',
          minWidth: '280px',
          maxWidth: '320px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFF' }}>
            Nessun evento
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{
        background: 'rgba(0, 0, 0, 0.85)',
        border: '2px solid rgba(51, 51, 51, 0.8)',
        borderRadius: '12px',
        padding: '12px',
        minWidth: '280px',
        maxWidth: '320px',
        position: 'relative'
      }}>
        {/* PULSANTE X IN ALTO A DESTRA */}
        <button 
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('X clicked - closing menu')
            onClose()
          }}
          style={{
            position: 'absolute',
            top: '15px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#FFF',
            fontSize: '20px',
            cursor: 'pointer',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            zIndex: 1000,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 59, 48, 0.8)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)'
          }}
        >
          ✕
        </button>
        
        {/* CONTENUTO CON RETTANGOLO BIANCO */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: '8px', 
          padding: '12px',
          marginBottom: '8px',
          // SOLO SU MOBILE: aggiungi scroll verticale
          ...(isMobile && {
            maxHeight: '70vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          })
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
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>
                    {typeof evento.titolo === 'object' ? '[Oggetto non visualizzabile: ' + JSON.stringify(evento.titolo) + ']' : evento.titolo}
                  </div>
                  <div style={{ fontSize: '12px', color: '#00D9FF', fontWeight: 'bold', marginTop: '2px' }}>
                    {typeof evento.dataBreve === 'object' ? '[Oggetto non visualizzabile: ' + JSON.stringify(evento.dataBreve) + ']' : evento.dataBreve} {typeof evento.orario === 'object' ? '[Oggetto non visualizzabile: ' + JSON.stringify(evento.orario) + ']' : evento.orario && `- ${formatOrario(evento.orario)}`}
                  </div>
                </div>
              </div>
              
              <div style={{ fontSize: '14px', color: '#FFF', marginBottom: '4px' }}>
                {typeof CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.nome === 'object' ? '[Oggetto non visualizzabile: ' + JSON.stringify(CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.nome) + ']' : CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.nome || 'Evento'}
              </div>
              
              {/* FASCIA STATO ACCREDITO */}
              {evento.accredito_status && evento.accredito_status !== 'nessuno' && (
                <div style={{ marginBottom: '4px' }}>
                  {(() => {
                    if (evento.accredito_status === 'da_richiedere') {
                      return (
                        <div style={{ 
                          background: '#FFD60A', 
                          color: '#000', 
                          padding: '4px 8px', 
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          🟡 DOVREMMO RICHIEDERLO
                        </div>
                      )
                    } else if (evento.accredito_status === 'richiesto') {
                      return (
                        <div style={{ 
                          background: '#FF9500', 
                          color: '#FFF', 
                          padding: '4px 8px', 
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          📨 RICHIESTO
                        </div>
                      )
                    } else if (evento.accredito_status === 'accettato') {
                      return (
                        <div style={{ 
                          background: '#34C759', 
                          color: '#FFF', 
                          padding: '4px 8px', 
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          ✅ ACCETTATO
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
  )
}

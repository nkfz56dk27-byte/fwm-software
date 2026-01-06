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
      
      const eventi = eventiResponse.data
      const prenotazioniDB = prenotazioniResponse.data || []
      const utentiDB = utentiResponse.data || []
      
      if (!eventi || eventi.length === 0) {
        setProssimoEvento(null)
        setLoading(false)
        return
      }
      
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
      
      // Trova tutti gli eventi dello stesso giorno del prossimo evento e ordinali per orario
      const eventiStessoGiorno = eventiFuturi
        .filter(evento => {
          const dataEvento = new Date(evento.data_inizio)
          dataEvento.setHours(0, 0, 0, 0)
          return dataEvento.getTime() === dataProssimo.getTime()
        })
        .sort((a, b) => {
          // Ordina per orario: eventi senza orario vanno alla fine
          if (!a.orario && !b.orario) return 0
          if (!a.orario) return 1
          if (!b.orario) return -1
          return a.orario.localeCompare(b.orario)
        })
      
      // Calcola le prenotazioni per tutti gli eventi dello stesso giorno
      const prenotatiConNomi = []
      eventiStessoGiorno.forEach(evento => {
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
      
      // Calcola i prossimi 5 giorni CON eventi dopo il giorno del prossimo evento
      const eventiPerGiorno = {}
      eventiFuturi.forEach(evento => {
        const dataEvento = new Date(evento.data_inizio)
        oggi.setHours(0, 0, 0, 0)
        dataEvento.setHours(0, 0, 0, 0)
        const giorniMancanti = Math.floor((dataEvento.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
        
        if (!eventiPerGiorno[giorniMancanti]) {
          eventiPerGiorno[giorniMancanti] = []
        }
        eventiPerGiorno[giorniMancanti].push(evento)
      })
      
      // Prendi solo i giorni successivi a quello del prossimo evento (max 5 giorni)
      const giorniDisponibili = Object.keys(eventiPerGiorno)
        .map(g => parseInt(g))
        .filter(g => g > giorniMancantiProssimo) // Escludi il giorno del prossimo evento e i giorni precedenti
        .sort((a, b) => a - b)
        .slice(0, 5) // Prendi solo i prossimi 5 giorni
      
      const tuttiEventiFuturi = giorniDisponibili.flatMap(giorni => {
        const eventiDelGiorno = eventiPerGiorno[giorni]
        
        return eventiDelGiorno.map((evento, index) => {
          const campionato = CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)
          const emojiCampionato = campionato ? campionato.emoji : '📅'
          
          const dataEvento = new Date(evento.data_inizio)
          const dataBreve = dataEvento.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          
          return {
            ...evento,
            giorniMancanti: giorni,
            emojiCampionato,
            dataBreve,
            ePrimoDelGiorno: index === 0,
            numeroEventi: eventiDelGiorno.length
          }
        })
      })
      
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
        eventiStessoGiorno
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
          {prossimoEvento.tuttiEventiFuturi && prossimoEvento.tuttiEventiFuturi.map((evento, index) => (
            <div key={evento.id} style={{ marginBottom: index < prossimoEvento.tuttiEventiFuturi.length - 1 ? '12px' : '0' }}>
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
                    {evento.titolo}
                  </div>
                  <div style={{ fontSize: '12px', color: '#00D9FF', fontWeight: 'bold', marginTop: '2px' }}>
                     {evento.dataBreve} {evento.orario && `- ${formatOrario(evento.orario)}`}
                  </div>
                </div>
              </div>
              
              <div style={{ fontSize: '14px', color: '#FFF', marginBottom: '4px' }}>
                {CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.nome || 'Evento'}
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

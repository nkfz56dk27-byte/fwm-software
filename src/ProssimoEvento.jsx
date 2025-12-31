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

export default function ProssimoEvento() {
  const [prossimoEvento, setProssimoEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [prenotazioni, setPrenotazioni] = useState([])
  
  useEffect(() => {
    caricaProssimoEvento()
    
    // Aggiorna ogni 30 secondi per vedere i cambiamenti nelle prenotazioni
    const interval = setInterval(() => {
      caricaProssimoEvento()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])
  
  async function caricaProssimoEvento() {
    try {
      setLoading(true)
      
      // Carica eventi, prenotazioni e utenti in parallelo
      const [eventiResponse, prenotazioniResponse, utentiResponse] = await Promise.all([
        supabase.from('eventi_calendario').select('*').order('data_inizio'),
        supabase.from('prenotazioni_accrediti').select('*'),
        supabase.from('utenti').select('username, nome, cognome')
      ])
      
      const eventi = eventiResponse.data
      const prenotazioniDB = prenotazioniResponse.data || []
      const utentiDB = utentiResponse.data || []
      
      console.log('ProssimoEvento - Eventi caricati:', eventi?.length || 0)
      console.log('ProssimoEvento - Prenotazioni caricate:', prenotazioniDB?.length || 0)
      console.log('ProssimoEvento - Utenti caricati:', utentiDB?.length || 0)
      
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
      
      console.log('ProssimoEvento - Evento selezionato:', prossimo)
      console.log('ProssimoEvento - max_accrediti:', prossimo.max_accrediti)
      
      const dataProssimo = new Date(prossimo.data_inizio)
      oggi.setHours(0, 0, 0, 0)
      dataProssimo.setHours(0, 0, 0, 0)
      const giorniMancantiProssimo = Math.floor((dataProssimo.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
      
      // Trova tutti gli eventi dello stesso giorno del prossimo evento
      const eventiStessoGiorno = eventiFuturi.filter(evento => {
        const dataEvento = new Date(evento.data_inizio)
        dataEvento.setHours(0, 0, 0, 0)
        return dataEvento.getTime() === dataProssimo.getTime()
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
      
      // Calcola i prossimi 2 giorni CON eventi dopo il giorno del prossimo evento
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
      
      // Prendi solo i giorni successivi a quello del prossimo evento
      const giorniDisponibili = Object.keys(eventiPerGiorno)
        .map(g => parseInt(g))
        .filter(g => g > giorniMancantiProssimo) // Escludi il giorno del prossimo evento e i giorni precedenti
        .sort((a, b) => a - b)
        .slice(0, 2)
      
      const prossimiEventi = giorniDisponibili.flatMap(giorni => {
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
      
      console.log('ProssimoEvento - Prenotati per questo evento:', prenotatiConNomi.length)
      console.log('ProssimoEvento - Dettagli prenotati:', prenotatiConNomi)
      console.log('ProssimoEvento - Accettati:', accettati.length, 'Richiesti:', richiesti.length)
      console.log('ProssimoEvento - Totali prenotati:', totaliPrenotati)
      console.log('ProssimoEvento - max_accrediti dall evento:', prossimo.max_accrediti)
      console.log('ProssimoEvento - maxAccrediti usato:', prossimo.max_accrediti || 10)
      console.log('ProssimoEvento - Prossimi eventi:', prossimiEventi.length)
      console.log('ProssimoEvento - Eventi stesso giorno:', eventiStessoGiorno.length)
      
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
        prossimiEventi,
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
    )
  }

  if (!prossimoEvento) {
    return (
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
    )
  }

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.85)',
      border: '2px solid rgba(51, 51, 51, 0.8)',
      borderRadius: '12px',
      padding: '12px',
      minWidth: '280px',
      maxWidth: '320px'
    }}>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFF', marginBottom: '6px' }}>
        {prossimoEvento.giorniMancanti === 0 ? 'OGGI!' : 
         prossimoEvento.giorniMancanti === 1 ? 'DOMANI!' : 
         `Tra ${prossimoEvento.giorniMancanti} giorni`}
      </div>
      
      <div style={{ fontSize: '11px', color: '#FFF', marginBottom: '6px' }}>
        {prossimoEvento.dataFormattata}
      </div>
      
      {/* MOSTRA TUTTI GLI EVENTI DEL GIORNO */}
      {prossimoEvento.eventiStessoGiorno && prossimoEvento.eventiStessoGiorno.map((evento, index) => (
        <div key={evento.id} style={{ marginBottom: index < prossimoEvento.eventiStessoGiorno.length - 1 ? '8px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '20px' }}>
              {CAMPIONATI_DEFAULT.find(c => c.id === evento.campionato_id)?.emoji || '📅'}
            </span>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFF' }}>
              {evento.titolo}
            </div>
          </div>
          
          <div style={{ fontSize: '12px', color: '#FFF', marginBottom: '4px' }}>
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
                      fontSize: '10px',
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
                      fontSize: '10px',
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
                      fontSize: '10px',
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
          {index === prossimoEvento.eventiStessoGiorno.length - 1 && (prossimoEvento.accettati > 0 || prossimoEvento.richiesti > 0) && (
            <div style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', gap: '4px', fontSize: '10px', marginBottom: '4px' }}>
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
      
      {/* PROSSIMI EVENTI */}
      {prossimoEvento.prossimiEventi && prossimoEvento.prossimiEventi.length > 0 && (
        <div style={{ 
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 'bold', 
            color: '#FFF', 
            marginBottom: '4px',
            textAlign: 'center'
          }}>
            PROSSIMI EVENTI
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {prossimoEvento.prossimiEventi.map((evento, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '10px',
                color: '#FFF',
                padding: '2px 4px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.1)'
              }}>
                <span style={{ fontSize: '13px' }}>{evento.emojiCampionato}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {evento.titolo}
                  </div>
                  <div style={{ fontSize: '9px', color: '#FFF' }}>
                    {evento.giorniMancanti === 1 ? 'DOMANI' : `+${evento.giorniMancanti} giorni`} • {evento.dataBreve}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


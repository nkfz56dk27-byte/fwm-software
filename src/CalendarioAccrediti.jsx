import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const CAMPIONATI_DEFAULT = [
  { id: 'f1', nome: 'Formula 1', colore: '#E10600', emoji: '🏎️' },
  { id: 'f2', nome: 'Formula 2', colore: '#0090D0', emoji: '🏁' },
  { id: 'f3', nome: 'Formula 3', colore: '#FF6800', emoji: '🏎️' },
  { id: 'motogp', nome: 'MotoGP', colore: '#D4145A', emoji: '🏍️' },
  { id: 'wec', nome: 'WEC', colore: '#00A19C', emoji: '🏁' },
  { id: 'indycar', nome: 'IndyCar', colore: '#C8102E', emoji: '🏎️' },
  { id: 'fe', nome: 'Formula E', colore: '#0098DB', emoji: '⚡' }
]

const MESI_ITALIANO = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
]

export default function CalendarioAccrediti({ utenteCorrente, onClose }) {
  const [campionati, setCampionati] = useState([])
  const [eventi, setEventi] = useState([])
  const [loading, setLoading] = useState(true)
  const [meseCorrente, setMeseCorrente] = useState(new Date())
  const [showNuovoEvento, setShowNuovoEvento] = useState(false)
  const [showGestioneCampionati, setShowGestioneCampionati] = useState(false)
  const [eventoSelezionato, setEventoSelezionato] = useState(null)

  const isAdmin = utenteCorrente?.ruolo === 'admin'

  useEffect(() => {
    caricaDati()
  }, [])

  async function caricaDati() {
    setLoading(true)
    
    let { data: campionatiDB } = await supabase.from('campionati').select('*').eq('attivo', true).order('nome')
    
    if (!campionatiDB || campionatiDB.length === 0) {
      const { data: nuoviCampionati } = await supabase
        .from('campionati')
        .insert(CAMPIONATI_DEFAULT.map(c => ({ ...c, attivo: true })))
        .select()
      campionatiDB = nuoviCampionati || []
    }
    
    setCampionati(campionatiDB)
    
    const { data: eventiDB } = await supabase
      .from('eventi_calendario')
      .select('*')
      .order('data_inizio')
    
    setEventi(eventiDB || [])
    setLoading(false)
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
      const dataEvento = new Date(evento.data_inizio)
      return dataEvento.getFullYear() === anno && dataEvento.getMonth() === mese
    })
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Caricamento...</div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          ← Indietro
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>📅 Calendario Accrediti</div>
          <div style={{ fontSize: '11px', color: '#666' }}>Gare ed Eventi</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isAdmin && (
            <button onClick={() => setShowGestioneCampionati(true)} style={{ padding: '6px 12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              ⚙️ Campionati
            </button>
          )}
          <button onClick={() => setShowNuovoEvento(true)} style={{ padding: '6px 12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            + Nuovo
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={() => cambiaMese(-1)} style={{ padding: '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          ←
        </button>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {MESI_ITALIANO[meseCorrente.getMonth()]} {meseCorrente.getFullYear()}
        </div>
        <button onClick={() => cambiaMese(1)} style={{ padding: '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          →
        </button>
      </div>

      <div style={{ padding: '10px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px' }}>
          {campionati.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.colore }}></div>
              <span>{c.emoji} {c.nome}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#666' }}></div>
            <span>📅 Eventi</span>
          </div>
          <span style={{ marginLeft: '15px', color: '#666' }}>🟡 Da richiedere • 📨 Richiesto • ✅ Accettato</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 30px', overflow: 'hidden' }}>
        <CalendarioMensile 
          mese={meseCorrente} 
          eventi={getEventiDelMese()} 
          campionati={campionati}
          onEventoClick={(evento) => setEventoSelezionato(evento)}
        />
      </div>

      {showNuovoEvento && (
        <NuovoEventoModal 
          campionati={campionati} 
          onClose={() => setShowNuovoEvento(false)} 
          onSave={caricaDati}
          utenteCorrente={utenteCorrente}
        />
      )}
      
      {showGestioneCampionati && (
        <GestioneCampionatiModal 
          campionati={campionati} 
          onClose={() => setShowGestioneCampionati(false)} 
          onUpdate={caricaDati}
        />
      )}

      {eventoSelezionato && (
        <DettaglioEventoModal 
          evento={eventoSelezionato} 
          campionati={campionati}
          isAdmin={isAdmin}
          onClose={() => setEventoSelezionato(null)} 
          onUpdate={caricaDati}
        />
      )}
    </div>
  )
}

function CalendarioMensile({ mese, eventi, campionati, onEventoClick }) {
  const anno = mese.getFullYear()
  const meseNum = mese.getMonth()
  
  const primoGiorno = new Date(anno, meseNum, 1).getDay()
  const ultimoGiorno = new Date(anno, meseNum + 1, 0).getDate()
  const offset = primoGiorno === 0 ? 6 : primoGiorno - 1
  
  const giorni = []
  
  for (let i = 0; i < offset; i++) {
    giorni.push(<div key={`empty-${i}`} style={{ background: '#f9f9f9', borderRadius: '6px' }}></div>)
  }
  
  for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
    const dataCorrente = new Date(anno, meseNum, giorno)
    const eventiGiorno = eventi.filter(e => {
      const dataEvento = new Date(e.data_inizio)
      return dataEvento.getDate() === giorno
    })
    
    const isOggi = new Date().toDateString() === dataCorrente.toDateString()
    
    giorni.push(
      <GiornoCell 
        key={giorno} 
        giorno={giorno} 
        eventi={eventiGiorno} 
        campionati={campionati}
        isOggi={isOggi}
        onEventoClick={onEventoClick}
      />
    )
  }
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(g => (
          <div key={g} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>{g}</div>
        ))}
      </div>
      
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gap: '8px' }}>
        {giorni}
      </div>
    </div>
  )
}

function GiornoCell({ giorno, eventi, campionati, isOggi, onEventoClick }) {
  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '6px', 
      border: isOggi ? '2px solid #007AFF' : '1px solid #e0e0e0',
      padding: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '3px', color: isOggi ? '#007AFF' : '#000' }}>
        {giorno}
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {eventi.map(evento => {
          const campionato = campionati.find(c => c.id === evento.campionato_id)
          const colore = evento.tipo === 'gara' && campionato ? campionato.colore : (evento.colore_personalizzato || '#666')
          const emoji = evento.tipo === 'gara' && campionato ? campionato.emoji : '📅'
          
          // BADGE ACCREDITO PIÙ EVIDENTI
          let badge = null
          if (evento.accredito_status === 'da_richiedere') {
            badge = { icon: '🟡', text: 'DA RICHIEDERE', bg: '#FFD60A', color: '#000' }
          } else if (evento.accredito_status === 'richiesto') {
            badge = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
          } else if (evento.accredito_status === 'accettato') {
            badge = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
          } else if (evento.tipo === 'gara' && evento.accredito_status !== 'nessuno') {
            badge = { icon: '⭐', text: 'ACCREDITO', bg: '#007AFF', color: '#FFF' }
          }
          
          return (
            <div 
              key={evento.id}
              onClick={() => onEventoClick(evento)}
              title={evento.titolo}
              style={{ 
                padding: '3px 5px', 
                background: `${colore}15`, 
                borderLeft: `3px solid ${colore}`,
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                <span style={{ fontSize: '11px' }}>{emoji}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>
                  {evento.titolo}
                </span>
              </div>
              
              {badge && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px', 
                  padding: '2px 4px', 
                  background: badge.bg, 
                  color: badge.color,
                  borderRadius: '3px',
                  fontSize: '8px',
                  fontWeight: 'bold'
                }}>
                  <span style={{ fontSize: '9px' }}>{badge.icon}</span>
                  <span>{badge.text}</span>
                </div>
              )}
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
  const [salvando, setSalvando] = useState(false)

  async function salvaEvento() {
    if (!titolo || !dataInizio) {
      alert('❌ Compila almeno titolo e data inizio')
      return
    }
    
    if (tipo === 'gara' && !campionatoId) {
      alert('❌ Seleziona un campionato per le gare')
      return
    }
    
    setSalvando(true)
    
    const evento = {
      tipo,
      titolo,
      data_inizio: dataInizio,
      data_fine: dataFine || null,
      campionato_id: tipo === 'gara' ? campionatoId : null,
      accredito_status: accreditoStatus,
      note: note || null,
      colore_personalizzato: tipo === 'evento' ? colorePersonalizzato : null,
      creato_da: utenteCorrente.username
    }
    
    const { error } = await supabase.from('eventi_calendario').insert(evento)
    
    if (error) {
      console.error('Errore:', error)
      alert('❌ Errore durante il salvataggio')
    } else {
      onSave()
      onClose()
    }
    
    setSalvando(false)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>➕ Nuovo Evento</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Tipo</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setTipo('gara')} style={{ flex: 1, padding: '12px', background: tipo === 'gara' ? '#007AFF' : '#f0f0f0', color: tipo === 'gara' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                🏁 Gara
              </button>
              <button onClick={() => setTipo('evento')} style={{ flex: 1, padding: '12px', background: tipo === 'evento' ? '#007AFF' : '#f0f0f0', color: tipo === 'evento' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                📅 Evento
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo *</div>
            <input type="text" value={titolo} onChange={e => setTitolo(e.target.value)} placeholder={tipo === 'gara' ? 'es: GP Abu Dhabi' : 'es: Presentazione Scuderia'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          </div>

          {tipo === 'gara' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Campionato *</div>
              <select value={campionatoId} onChange={e => setCampionatoId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                <option value="">Seleziona campionato...</option>
                {campionati.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>
                ))}
              </select>
            </div>
          )}

          {tipo === 'evento' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Colore</div>
              <input type="color" value={colorePersonalizzato} onChange={e => setColorePersonalizzato(e.target.value)} style={{ width: '100%', height: '50px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Data Inizio *</div>
              <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Data Fine (opzionale)</div>
              <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Stato Accredito</div>
            <select value={accreditoStatus} onChange={e => setAccreditoStatus(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              <option value="nessuno">Nessuno</option>
              <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
              <option value="richiesto">📨 Richiesto</option>
              <option value="accettato">✅ Accettato</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note (opzionale)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Aggiungi dettagli..." style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Annulla
          </button>
          <button onClick={salvaEvento} disabled={salvando} style={{ padding: '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Salvataggio...' : '✅ Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GestioneCampionatiModal({ campionati, onClose, onUpdate }) {
  const [nuovoCampionato, setNuovoCampionato] = useState({ nome: '', emoji: '', colore: '#000000' })
  const [salvando, setSalvando] = useState(false)

  async function aggiungiCampionato() {
    if (!nuovoCampionato.nome) {
      alert('❌ Inserisci il nome del campionato')
      return
    }
    
    setSalvando(true)
    const { error } = await supabase.from('campionati').insert({ ...nuovoCampionato, attivo: true })
    
    if (error) {
      alert('❌ Errore durante l\'aggiunta')
    } else {
      setNuovoCampionato({ nome: '', emoji: '', colore: '#000000' })
      onUpdate()
    }
    setSalvando(false)
  }

  async function eliminaCampionato(id) {
    if (!confirm('Sicuro di voler eliminare questo campionato?')) return
    await supabase.from('campionati').delete().eq('id', id)
    onUpdate()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>⚙️ Gestione Campionati</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ marginBottom: '30px', padding: '20px', background: '#34C7591A', borderRadius: '10px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Aggiungi Campionato</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input type="text" placeholder="Nome (es: Formula 1)" value={nuovoCampionato.nome} onChange={e => setNuovoCampionato({...nuovoCampionato, nome: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <input type="text" placeholder="Emoji" value={nuovoCampionato.emoji} onChange={e => setNuovoCampionato({...nuovoCampionato, emoji: e.target.value})} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }} />
              <input type="color" value={nuovoCampionato.colore} onChange={e => setNuovoCampionato({...nuovoCampionato, colore: e.target.value})} style={{ width: '60px', height: '42px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
            </div>
            <button onClick={aggiungiCampionato} disabled={salvando} style={{ width: '100%', padding: '10px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Aggiunta...' : '+ Aggiungi'}
            </button>
          </div>

          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Campionati Attivi ({campionati.length})</div>
            {campionati.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: c.colore }}></div>
                <span style={{ fontSize: '18px' }}>{c.emoji}</span>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: '600' }}>{c.nome}</span>
                <button onClick={() => eliminaCampionato(c.id)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}


function DettaglioEventoModal({ evento, campionati, isAdmin, onClose, onUpdate }) {
  const [modalita, setModalita] = useState('visualizza')
  const [eventoEdit, setEventoEdit] = useState({...evento})
  const [salvando, setSalvando] = useState(false)

  const campionato = campionati.find(c => c.id === evento.campionato_id)

  async function salvaModifiche() {
    setSalvando(true)
    
    const { error } = await supabase
      .from('eventi_calendario')
      .update({
        titolo: eventoEdit.titolo,
        data_inizio: eventoEdit.data_inizio,
        data_fine: eventoEdit.data_fine,
        accredito_status: eventoEdit.accredito_status,
        note: eventoEdit.note,
        colore_personalizzato: eventoEdit.colore_personalizzato
      })
      .eq('id', evento.id)
    
    if (error) {
      console.error('Errore:', error)
      alert('❌ Errore durante il salvataggio')
    } else {
      onUpdate()
      onClose()
    }
    
    setSalvando(false)
  }

  async function eliminaEvento() {
    if (!confirm(`Sicuro di voler eliminare "${evento.titolo}"?`)) return
    
    const { error } = await supabase.from('eventi_calendario').delete().eq('id', evento.id)
    
    if (error) {
      alert('❌ Errore durante l\'eliminazione')
    } else {
      onUpdate()
      onClose()
    }
  }

  if (modalita === 'modifica') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
        <div style={{ background: 'white', borderRadius: '15px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>✏️ Modifica Evento</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo</div>
              <input type="text" value={eventoEdit.titolo} onChange={e => setEventoEdit({...eventoEdit, titolo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>

            {eventoEdit.tipo === 'evento' && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Colore</div>
                <input type="color" value={eventoEdit.colore_personalizzato || '#666666'} onChange={e => setEventoEdit({...eventoEdit, colore_personalizzato: e.target.value})} style={{ width: '100%', height: '50px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Data Inizio</div>
                <input type="date" value={eventoEdit.data_inizio} onChange={e => setEventoEdit({...eventoEdit, data_inizio: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Data Fine</div>
                <input type="date" value={eventoEdit.data_fine || ''} onChange={e => setEventoEdit({...eventoEdit, data_fine: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Stato Accredito</div>
              <select value={eventoEdit.accredito_status} onChange={e => setEventoEdit({...eventoEdit, accredito_status: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                <option value="nessuno">Nessuno</option>
                <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
                <option value="richiesto">📨 Richiesto</option>
                <option value="accettato">✅ Accettato</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note</div>
              <textarea value={eventoEdit.note || ''} onChange={e => setEventoEdit({...eventoEdit, note: e.target.value})} style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
            <button onClick={() => setModalita('visualizza')} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={salvaModifiche} disabled={salvando} style={{ padding: '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Salvataggio...' : '✅ Salva'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // BADGE ACCREDITO GRANDE
  let badgeGrande = null
  if (evento.accredito_status === 'da_richiedere') {
    badgeGrande = { icon: '🟡', text: 'DOVREMMO RICHIEDERLO', bg: '#FFD60A', color: '#000' }
  } else if (evento.accredito_status === 'richiesto') {
    badgeGrande = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
  } else if (evento.accredito_status === 'accettato') {
    badgeGrande = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '15px', width: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {evento.tipo === 'gara' ? '🏁' : '📅'} Dettagli
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>{evento.titolo}</div>
            {campionato && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: campionato.colore }}></div>
                <span style={{ fontSize: '16px' }}>{campionato.emoji} {campionato.nome}</span>
              </div>
            )}
            {evento.tipo === 'evento' && evento.colore_personalizzato && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: evento.colore_personalizzato }}></div>
                <span style={{ fontSize: '16px' }}>Evento personalizzato</span>
              </div>
            )}
          </div>

          {/* BADGE ACCREDITO GRANDE E EVIDENTE */}
          {badgeGrande && (
            <div style={{ 
              marginBottom: '20px',
              padding: '15px 20px',
              background: badgeGrande.bg,
              color: badgeGrande.color,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              <span style={{ fontSize: '32px' }}>{badgeGrande.icon}</span>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '2px' }}>STATO ACCREDITO</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{badgeGrande.text}</div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>📅 Data</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>
              {new Date(evento.data_inizio).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
              {evento.data_fine && ` - ${new Date(evento.data_fine).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`}
            </div>
          </div>

          {evento.note && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>📝 Note</div>
              <div style={{ fontSize: '14px', padding: '12px', background: '#f5f5f7', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                {evento.note}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          {isAdmin ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={eliminaEvento} style={{ flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                🗑️ Elimina
              </button>
              <button onClick={() => setModalita('modifica')} style={{ flex: 1, padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                ✏️ Modifica
              </button>
            </div>
          ) : (
            <button onClick={onClose} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

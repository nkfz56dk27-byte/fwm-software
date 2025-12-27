import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import CoppaSVG from "./assets/coppa.svg"
import FotoSVG from "./assets/foto.svg"
import DisponibilitàSVG from "./assets/disponibilità.svg"
import PressPNG from "./assets/press.png"
import CestinoSVG from "./assets/cestino.svg"
import CheckSVG from "./assets/check.svg"
import RitaglioImmagine from './RitaglioImmagine'
import CalendarioAccrediti from './CalendarioAccrediti'
import DisponibilitaWeekend from './DisponibilitaWeekend.jsx'
import GestioneCategorie from './GestioneCategorie.jsx'
import GestioneTemplateArticoli from './GestioneTemplateArticoli.jsx'

import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [showGestione, setShowGestione] = useState(false)
  const [showClassificheMenu, setShowClassificheMenu] = useState(false)
  const [showClassifica, setShowClassifica] = useState(false)
  const [classificaId, setClassificaId] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showRitaglioImmagine, setShowRitaglioImmagine] = useState(false)
  const [showCalendario, setShowCalendario] = useState(false)
  const [showDisponibilita, setShowDisponibilita] = useState(null) // null o { categoria }
  const [notificheNonLetteCalendario, setNotificheNonLetteCalendario] = useState(0)
  const [notificheNonLetteDisponibilita, setNotificheNonLetteDisponibilita] = useState(0)

  async function caricaNotificheCalendario(username) {
    try {
      const { data: notifiche } = await supabase.from('notifiche_calendario').select('id')
      const { data: lette } = await supabase.from('notifiche_lette').select('notifica_id').eq('username', username)
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      const nonLette = (notifiche || []).filter(n => !idsLette.has(n.id))
      setNotificheNonLetteCalendario(nonLette.length)
    } catch (e) {}
  }

  async function caricaNotificheDisponibilita(username) {
    try {
      const isAdmin = user?.ruolo === 'admin'
      
      // 1. Carica tutte le notifiche
      const { data: tutteNotifiche } = await supabase
        .from('notifiche_disponibilita')
        .select('id, weekend_id')
      
      let notificheFiltrate = tutteNotifiche || []
      
      // 2. Se NON admin: filtra per categorie
      if (!isAdmin) {
        // Carica categorie utente
        const { data: gruppiUtente } = await supabase
          .from('gruppi_redattori')
          .select('categoria_id')
          .eq('username', username)
        
        const categorieIds = (gruppiUtente || []).map(g => g.categoria_id).filter(Boolean)
        
        // Carica weekend di quelle categorie
        let queryWeekend = supabase.from('weekend').select('id')
        
        if (categorieIds.length > 0) {
          queryWeekend = queryWeekend.or(`categoria_id.in.(${categorieIds.join(',')}),categoria_id.is.null`)
        } else {
          queryWeekend = queryWeekend.is('categoria_id', null)
        }
        
        const { data: weekendConsentiti } = await queryWeekend
        const weekendIdsConsentiti = new Set((weekendConsentiti || []).map(w => w.id))
        
        // Filtra notifiche
        notificheFiltrate = notificheFiltrate.filter(n => 
          !n.weekend_id || weekendIdsConsentiti.has(n.weekend_id)
        )
      }
      
      // 3. Conta notifiche NON lette
      const { data: lette } = await supabase
        .from('notifiche_disponibilita_lette')
        .select('notifica_id')
        .eq('username', username)
      
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      const nonLette = notificheFiltrate.filter(n => !idsLette.has(n.id))
      
      setNotificheNonLetteDisponibilita(nonLette.length)
    } catch (e) {
      console.error('[HOME] Errore caricamento notifiche disponibilità:', e)
    }
  }

  useEffect(() => {
    if (user && user.username) {
      caricaNotificheCalendario(user.username)
      caricaNotificheDisponibilita(user.username)
      const interval = setInterval(() => {
        caricaNotificheCalendario(user.username)
        caricaNotificheDisponibilita(user.username)
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.from('utenti').select('*').eq('username', username).eq('password', password).limit(1)
      if (error || !data || data.length === 0) {
        setLoginError('Username o password non corretti')
        setLoading(false)
        return
      }
      setUser(data[0])
      setMustChangePassword(data[0].deve_cambiare_password)
      setLoading(false)
    } catch (err) {
      setLoginError('Errore di connessione')
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('La password deve essere di almeno 8 caratteri')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono')
      return
    }
    try {
      const { error } = await supabase.from('utenti').update({ password: newPassword, deve_cambiare_password: false }).eq('id', user.id)
      if (error) throw error
      setUser({ ...user, deve_cambiare_password: false })
      setMustChangePassword(false)
    } catch (err) {
      setPasswordError('Errore nel cambio password')
    }
  }

  const handleLogout = () => {
    setUser(null)
    setMustChangePassword(false)
    setUsername('')
    setPassword('')
    setShowGestione(false)
    setShowClassifica(false)
  }

  if (!user) {
    return <LoginView username={username} setUsername={setUsername} password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} loginError={loginError} loading={loading} handleLogin={handleLogin} />
  }

  if (mustChangePassword) {
    return <PasswordChangeView newPassword={newPassword} setNewPassword={setNewPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showNewPassword={showNewPassword} setShowNewPassword={setShowNewPassword} showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} passwordError={passwordError} handlePasswordChange={handlePasswordChange} />
  }

  if (showGestione) {
    return <GestioneUtentiView onClose={() => setShowGestione(false)} />
  }

  if (showClassificheMenu) {
    return <ClassificheMenuView user={user} onBack={() => setShowClassificheMenu(false)} onOpenClassifica={(id) => { setClassificaId(id); setShowClassifica(true); setShowClassificheMenu(false) }} />
  }

  if (showClassifica) {
    return <ClassificaView classificaId={classificaId} user={user} onBack={() => { setShowClassifica(false); setShowClassificheMenu(true); setClassificaId(null) }} />
  }

  // ← AGGIUNTO: Render condizionale RitaglioImmagine
  if (showRitaglioImmagine) {
    return <RitaglioImmagine onClose={() => setShowRitaglioImmagine(false)} />
  }

  if (showCalendario) {
    return <CalendarioAccrediti utenteCorrente={user} onClose={() => setShowCalendario(false)} onNotificheChange={() => user && user.username && caricaNotificheCalendario(user.username)} />
  }

  if (showDisponibilita) {
    return <DisponibilitaWeekend categoria={showDisponibilita.categoria} utenteCorrente={user} onClose={() => setShowDisponibilita(null)} onNotificheChange={() => user && user.username && caricaNotificheDisponibilita(user.username)} />
  }

  return <HomeView user={user} onLogout={handleLogout} onOpenGestione={() => setShowGestione(true)} onOpenClassificheMenu={() => setShowClassificheMenu(true)} onOpenRitaglio={() => setShowRitaglioImmagine(true)} onOpenCalendario={() => setShowCalendario(true)} onOpenDisponibilita={(categoria) => setShowDisponibilita({ categoria })} notificheNonLetteCalendario={notificheNonLetteCalendario} notificheNonLetteDisponibilita={notificheNonLetteDisponibilita} />
}
// ===== CLASSIFICA VIEW COMPLETA =====
function ClassificaView({ classificaId, user, onBack }) {
  const [classifica, setClassifica] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [showImpostazioni, setShowImpostazioni] = useState(false)
  const [showInserimentoGP, setShowInserimentoGP] = useState(false)
  const [showGrafico, setShowGrafico] = useState(false)
  const [gpSelezionato, setGpSelezionato] = useState(null)
  const [expandedGP, setExpandedGP] = useState({})

  const isAdmin = user.ruolo === 'admin'

  useEffect(() => {
    caricaClassifica()
  }, [classificaId])

  useEffect(() => {
    if (classifica) {
      document.title = `FWM - ${classifica.nome}`
    }
  }, [classifica])

  const caricaClassifica = async () => {
    try {
      const { data, error } = await supabase.from('classifiche').select('*').eq('id', classificaId).single()
      if (!error && data) {
        setClassifica(data)
        if (!data.piloti || data.piloti.length === 0) {
          setShowSetup(true)
        }
      }
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  const salvaClassifica = async (nuovaClassifica) => {
    try {
      const updateObj = {
        nome: nuovaClassifica.nome,
        gp: nuovaClassifica.gp || [],
        piloti: nuovaClassifica.piloti || [],
        costruttori: nuovaClassifica.costruttori || [],
        numero_gp_stagione: nuovaClassifica.numero_gp_stagione || nuovaClassifica.numeroGP || null,
        numero_sprint_stagione: nuovaClassifica.numero_sprint_stagione || nuovaClassifica.numeroSprint || null,
      }

      const { error } = await supabase.from('classifiche').update(updateObj).eq('id', classificaId)
      if (!error) {
        setClassifica(nuovaClassifica)
        setShowSetup(false)
        caricaClassifica()
      } else {
        console.error('Errore salvataggio classifica:', error)
        alert('❌ Errore durante il salvataggio della classifica')
      }
    } catch (err) {
      console.error('Errore salvataggio classifica:', err)
      alert('❌ Errore durante il salvataggio della classifica')
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Caricamento...</div>
  if (!classifica) return <div style={{ padding: '40px', textAlign: 'center' }}>Classifica non trovata</div>
  if (showSetup) return <SetupIniziale classifica={classifica} onSave={salvaClassifica} onBack={onBack} />
  if (showImpostazioni) return <ImpostazioniClassifica classifica={classifica} onClose={() => { setShowImpostazioni(false); caricaClassifica() }} onSave={salvaClassifica} />
  if (showInserimentoGP) return <InserimentoRisultatiGP classifica={classifica} gpPreselezionato={gpSelezionato} onClose={() => { setShowInserimentoGP(false); setGpSelezionato(null) }} onSave={salvaClassifica} />
  if (showGrafico) return <GraficoPronostico classifica={classifica} onClose={() => setShowGrafico(false)} />

  const pilotiOrdinati = classifica.piloti ? [...classifica.piloti].filter(p => p.attivo).sort((a, b) => b.punti - a.punti) : []
  const costruttoriOrdinati = classifica.costruttori ? [...classifica.costruttori].sort((a, b) => b.punti - a.punti) : []
  const gpCompletati = classifica.gp ? classifica.gp.filter(g => g.completato) : []
  const gpDaCompletare = classifica.gp ? classifica.gp.filter(g => !g.completato) : []

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#f5f5f7', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', padding: '20px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h1 style={{ fontSize: '34px', fontWeight: 'bold', margin: 0, flex: 1 }}>{classifica.nome}</h1>
          {isAdmin && (
            <button onClick={() => setShowImpostazioni(true)} style={{ width: '40px', height: '40px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
              <svg viewBox="0 0 24 24" fill="#000" style={{ width: '30px', height: '30px' }}>
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { const menu = e.currentTarget.nextSibling; menu.style.display = menu.style.display === 'block' ? 'none' : 'block' }} style={{ width: '50px', height: '50px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
              <svg viewBox="0 0 24 24" fill="#34C759" style={{ width: '40px', height: '40px' }}>
                <circle cx="12" cy="12" r="10" fill="#34C759"/>
                <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <div style={{ display: 'none', position: 'absolute', top: '100%', right: 0, background: 'white', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: '250px', zIndex: 1000, marginTop: '10px' }}>
              {gpDaCompletare.length === 0 ? (
                <div style={{ padding: '15px', color: '#999' }}>Nessun GP da completare</div>
              ) : (
                gpDaCompletare.map(gp => (
                  <div key={gp.id} onClick={() => { setGpSelezionato(gp); setShowInserimentoGP(true) }} style={{ padding: '15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                    {gp.tipo_weekend === 'sprintF1' ? '⚡️' : gp.tipo_weekend === 'f2' ? '🏎️' : '🏆'} {gp.nome}
                  </div>
                ))
              )}
              {isAdmin && (
                <>
                  <div style={{ borderTop: '2px solid #eee' }}></div>
                  <div onClick={() => { setGpSelezionato(null); setShowInserimentoGP(true) }} style={{ padding: '15px', cursor: 'pointer', color: '#007AFF', fontWeight: 'bold' }}>+ Aggiungi nuovo GP</div>
                </>
              )}
            </div>
          </div>
          <button onClick={() => setShowGrafico(true)} style={{ width: '40px', height: '40px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
            <svg viewBox="0 0 24 24" fill="#000" style={{ width: '30px', height: '30px' }}>
              <path d="M3 3v18h18M7 14l4-4 4 4 6-6"/>
            </svg>
          </button>
        </div>

       {/* GP COMPLETATI */}
{gpCompletati.length > 0 && (
  <div style={{ marginBottom: '20px' }}>
    <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '15px' }}>GP già inseriti</h2>

    {gpCompletati.map(gp => (
      <div
        key={gp.id}
        style={{
          background: 'white',
          borderRadius: '10px',
          marginBottom: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header GP cliccabile */}
        <div
          onClick={() => setExpandedGP(prev => ({ ...prev, [gp.id]: !prev[gp.id] }))}
          style={{
            padding: '15px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: '600', fontSize: '16px' }}>
            {gp.tipo_weekend === 'sprintF1' ? '⚡️' : gp.tipo_weekend === 'f2' ? '🏎️' : '🏆'} {gp.nome}
          </span>
          <span>{expandedGP[gp.id] ? '▲' : '▼'}</span>
        </div>

        {/* Contenuto gare espandibile */}
        {expandedGP[gp.id] &&
          gp.gare &&
          gp.gare
            .filter(g => g.completata)
            .map(gara => (
              <div
                key={gara.id}
                style={{
                  padding: '15px',
                  borderTop: gp.tipo_weekend === 'sprintF1' ? '1px solid #eee' : 'none', // solo Sprint
                  background: gp.tipo_weekend === 'sprintF1' ? '#f9f9f9' : 'white',       // solo Sprint
                }}
              >
                {/* Risultati piloti ordinati */}
                {Object.entries(gara.risultati || {})
                  .sort((a, b) => Number(a[1]) - Number(b[1]))
                  .map(([pilotaId, posizione]) => {
                    const pilota = classifica.piloti.find(p => String(p.id) === String(pilotaId));
                    if (!pilota) return null;

                    const puntiBase = calcolaPuntiPosizione(Number(posizione), gara.tipo_gara, classifica);
                    let desc = `${puntiBase} pts`;
                    if (classifica.punti_pole_attivo && gara.pole_id === pilotaId)
                      desc += ` +P${classifica.punti_pole_valore}`;
                    if (classifica.giro_veloce_attivo && gara.giro_veloce_id === pilotaId)
                      desc += ` +FL${classifica.giro_veloce_valore}`;

                    return (
                      <div
                        key={pilotaId}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}
                      >
                        <span>
                          {posizione}° {pilota.nome}
                        </span>
                        <span>{desc}</span>
                      </div>
                    );
                  })}
              </div>
            ))}
      </div>
    ))}
  </div>
)}

        {/* CLASSIFICA PILOTI */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '15px' }}>Classifica Piloti</h2>
          <div style={{ background: 'white', borderRadius: '10px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {pilotiOrdinati.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Nessun pilota inserito</div>
            ) : (
              pilotiOrdinati.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: i < pilotiOrdinati.length - 1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', minWidth: '30px' }}>{i + 1}</div>
                  <div style={{ width: '8px', height: '40px', background: p.colore || '#007AFF', borderRadius: '4px' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{p.nome}</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>{p.team}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{p.punti || 0}</div>
                    {i > 0 && <div style={{ fontSize: '14px', color: '#999' }}>+{pilotiOrdinati[0].punti - p.punti}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CLASSIFICA COSTRUTTORI */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '15px' }}>Classifica Costruttori</h2>
          <div style={{ background: 'white', borderRadius: '10px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {costruttoriOrdinati.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Nessun costruttore inserito</div>
            ) : (
              costruttoriOrdinati.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: i < costruttoriOrdinati.length - 1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', minWidth: '30px' }}>{i + 1}</div>
                  <div style={{ width: '8px', height: '40px', background: c.colore || '#007AFF', borderRadius: '4px' }}></div>
                  <div style={{ flex: 1, fontWeight: '600', fontSize: '16px' }}>{c.nome}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{c.punti || 0}</div>
                    {i > 0 && <div style={{ fontSize: '14px', color: '#999' }}>+{costruttoriOrdinati[0].punti - c.punti}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        BOTTONE INDIETRO CLASSIFICA

  <button
  onClick={onBack}
  style={{
    position: 'absolute',
    top: '20px',
    left: '20px',
    background: 'none',
    border: 'none',
    color: '#007AFF',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }}
>
  ← Indietro
</button>



      </div>
    </div>
  )
}

function calcolaPuntiPosizione(pos, tipoGara, classifica = null) {
  // Se è attivo il modificatore libero, usa l'array personalizzato
  if (classifica && classifica.usa_modificatore_libero && Array.isArray(classifica.modificatore_libero_punti)) {
    const arr = classifica.modificatore_libero_punti
    return pos <= arr.length ? (arr[pos - 1] || 0) : 0
  }

  const puntiStandard = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
  const puntiSprint = [8, 7, 6, 5, 4, 3, 2, 1]
  const puntiF2Feature = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
  const puntiF2Sprint = [10, 8, 6, 5, 4, 3, 2, 1]
  
  if (tipoGara === 'sprint' || tipoGara === 'sprintRace') {
    return pos <= puntiSprint.length ? puntiSprint[pos - 1] : 0
  } else if (tipoGara === 'featureRace') {
    return pos <= puntiF2Feature.length ? puntiF2Feature[pos - 1] : 0
  } else if (tipoGara === 'f2sprint') {
    return pos <= puntiF2Sprint.length ? puntiF2Sprint[pos - 1] : 0
  }
  return pos <= puntiStandard.length ? puntiStandard[pos - 1] : 0
}

function calcolaCombinazioniVittoria(pilota, classifica, gpRimanenti, sprintRimanenti) {
  const combinazioni = []
  const pilotiOrdinati = (classifica.piloti || []).filter(p => p.attivo).sort((a, b) => (b.punti || 0) - (a.punti || 0))
  if (pilotiOrdinati.length < 2) return []

  const leader = pilotiOrdinati[0]
  const secondo = pilotiOrdinati[1]

  // Calcola punti massimi
  const puntiDaGP = gpRimanenti * 25
  const puntiDaSprint = sprintRimanenti * 8
  let bonusPossibili = 0
  if (classifica.punti_pole_attivo) bonusPossibili += gpRimanenti * (classifica.punti_pole_valore || 3)
  if (classifica.giro_veloce_attivo) bonusPossibili += gpRimanenti * (classifica.giro_veloce_valore || 1)
  const puntiMassimi = (pilota.punti || 0) + puntiDaGP + puntiDaSprint + bonusPossibili

  // Se fuori matematicamente
  if (puntiMassimi < (leader.punti || 0) && String(pilota.id) !== String(leader.id)) {
    return []
  }

  // Se già campione
  if (String(pilota.id) === String(leader.id) && (pilota.punti || 0) > (secondo.punti || 0) + puntiDaGP + puntiDaSprint + bonusPossibili) {
    combinazioni.push('🏆 Già campione matematico!')
    return combinazioni
  }

  // Trova rivale
  const rivale = String(pilota.id) === String(leader.id) ? secondo : leader
  const differenzaPunti = (rivale.punti || 0) - (pilota.punti || 0)
  const puntiPerPosizione = (classifica && classifica.usa_modificatore_libero && Array.isArray(classifica.modificatore_libero_punti) && classifica.modificatore_libero_punti.length > 0)
    ? classifica.modificatore_libero_punti
    : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

  // Combinazione 1: Vittorie consecutive
  if (gpRimanenti > 0) {
    const vittorieNecessarie = Math.max(1, Math.ceil(differenzaPunti / 25))
    if (vittorieNecessarie <= gpRimanenti) {
      combinazioni.push(`${pilota.nome} vince ${vittorieNecessarie} gare + ${rivale.nome} fuori dal podio`)
    }
  }

  // Combinazioni 2-10: Varie posizioni
  let contatore = 0
  for (let posPilota = 1; posPilota <= 5 && contatore < 9; posPilota++) {
    const puntiPilotaPerGara = puntiPerPosizione[posPilota - 1]

    for (let posRivale = Math.max(posPilota + 1, 1); posRivale <= 10 && contatore < 9; posRivale++) {
      const puntiRivalePerGara = posRivale <= puntiPerPosizione.length ? puntiPerPosizione[posRivale - 1] : 0
      const differenzaPerGara = puntiPilotaPerGara - puntiRivalePerGara

      if (differenzaPerGara > 0) {
        const gareNecessarie = Math.ceil(Math.abs(differenzaPunti) / differenzaPerGara)

        if (gareNecessarie > 0 && gareNecessarie <= gpRimanenti) {
          const posizione = `${posPilota}°`
          const posizioneRivale = posRivale > 10 ? 'fuori dai punti' : `${posRivale}° o peggio`

          combinazioni.push(`${pilota.nome} ${posizione} + ${rivale.nome} ${posizioneRivale} per ${gareNecessarie} gare`)
          contatore++
        }
      }
    }
  }

  // Scenario prossimo GP: usa il primo GP non completato (in ordine nell'array), robusto verso tipi diversi di flag
  if (gpRimanenti > 0 && Array.isArray(classifica.gp)) {
    const prossimoIndex = classifica.gp.findIndex(g => !Boolean(g.completato))
    const gpCompletatiCount = classifica.gp.filter(g => Boolean(g.completato)).length
    const nomeGP = prossimoIndex !== -1 ? classifica.gp[prossimoIndex].nome : `GP #${gpCompletatiCount + 1}`

    for (let posPilota = 1; posPilota <= 5; posPilota++) {
      const puntiPilota = puntiPerPosizione[posPilota - 1]

      for (let posRivale = posPilota + 1; posRivale <= 10; posRivale++) {
        const puntiRivale = posRivale <= puntiPerPosizione.length ? puntiPerPosizione[posRivale - 1] : 0
        const puntiDopoGara = (pilota.punti || 0) + puntiPilota
        const puntiRivaleDopoGara = (rivale.punti || 0) + puntiRivale

        const gareDopoQuesta = gpRimanenti - 1
        const puntiMassimiRivaleFinali = puntiRivaleDopoGara + (gareDopoQuesta * 25)

        if (puntiDopoGara > puntiMassimiRivaleFinali) {
          const posizione = `${posPilota}°`
          const posizioneRivale = posRivale > 10 ? 'fuori punti' : `${posRivale}° o peggio`

          combinazioni.unshift(`🏁 A ${nomeGP}: ${pilota.nome} ${posizione} + ${rivale.nome} ${posizioneRivale} = CAMPIONE!`)
          return combinazioni.slice(0, 10)
        }
      }
    }
  }

  return combinazioni.slice(0, 10)
}

// ===== INSERIMENTO RISULTATI GP =====
function InserimentoRisultatiGP({ classifica, gpPreselezionato, onClose, onSave }) {
  const [step, setStep] = useState(gpPreselezionato ? 1 : 0)
  const [nomeGP, setNomeGP] = useState('')
  const [tipoWeekend, setTipoWeekend] = useState('standard')
  const [gp, setGp] = useState(gpPreselezionato ? {
    ...gpPreselezionato,
    gare: gpPreselezionato.gare && gpPreselezionato.gare.length > 0 ? gpPreselezionato.gare : 
          gpPreselezionato.tipo_weekend === 'standard' ? [{ id: Date.now(), tipo_gara: 'principale', risultati: {}, completata: false }] :
          gpPreselezionato.tipo_weekend === 'sprintF1' ? [{ id: Date.now(), tipo_gara: 'sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'principale', risultati: {}, completata: false }] :
          [{ id: Date.now(), tipo_gara: 'f2sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'featureRace', risultati: {}, completata: false }]
  } : null)
  const [garaCorrente, setGaraCorrente] = useState(0)
  const [risultati, setRisultati] = useState({})
  const [poleId, setPoleId] = useState(null)
  const [giroVeloceId, setGiroVeloceId] = useState(null)

  const aggiungiGP = () => {
    if (!nomeGP) return
    const nuovoGP = {
      id: Date.now(),
      nome: nomeGP,
      tipo_weekend: tipoWeekend,
      completato: false,
      gare: tipoWeekend === 'standard' ? [{ id: Date.now(), tipo_gara: 'principale', risultati: {}, completata: false }] : 
             tipoWeekend === 'sprintF1' ? [{ id: Date.now(), tipo_gara: 'sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'principale', risultati: {}, completata: false }] :
             [{ id: Date.now(), tipo_gara: 'f2sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'featureRace', risultati: {}, completata: false }]
    }
    setGp(nuovoGP)
    setStep(1)
  }

  const salvaRisultatiGara = () => {
    const gare = [...gp.gare]
    gare[garaCorrente] = {
      ...gare[garaCorrente],
      risultati,
      pole_id: poleId,
      giro_veloce_id: giroVeloceId,
      completata: true
    }
    
    const gpAggiornato = { ...gp, gare }
    
    if (garaCorrente < gp.gare.length - 1) {
      setGp(gpAggiornato)
      setGaraCorrente(garaCorrente + 1)
      setRisultati({})
      setPoleId(null)
      setGiroVeloceId(null)
    } else {
      const gpFinale = { ...gpAggiornato, completato: true }
      const nuoviGP = classifica.gp ? [...classifica.gp.filter(g => g.id !== gpFinale.id), gpFinale] : [gpFinale]
      
      const nuoviPiloti = [...classifica.piloti]
      const nuoviCostruttori = [...classifica.costruttori]
      
      // Calcola e assegna punti per ogni gara del GP
      gpFinale.gare.forEach(gara => {
        Object.entries(gara.risultati).forEach(([pilotaId, pos]) => {
          const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId))
          if (!pilota) {
            console.warn('Pilota non trovato:', pilotaId)
            return
          }
          
          let punti = calcolaPuntiPosizione(pos, gara.tipo_gara, classifica)
          if (classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId)) {
            punti += classifica.punti_pole_valore || 3
          }
          if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId)) {
            punti += classifica.giro_veloce_valore || 1
          }
          
          console.log(`${pilota.nome}: +${punti} pts (pos ${pos}, tipo ${gara.tipo_gara})`)
          
          pilota.punti = (pilota.punti || 0) + punti
          
          const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team)
          if (costruttore) {
            costruttore.punti = (costruttore.punti || 0) + punti
          } else {
            console.warn('Costruttore non trovato:', pilota.team)
          }
        })
      })
      
      nuoviPiloti.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((p, i) => {
        p.distacco = i === 0 ? 0 : (nuoviPiloti[0].punti || 0) - (p.punti || 0)
      })
      
      nuoviCostruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((c, i) => {
        c.distacco = i === 0 ? 0 : (nuoviCostruttori[0].punti || 0) - (c.punti || 0)
      })
      
      console.log('Salvando classifica aggiornata:', { piloti: nuoviPiloti, costruttori: nuoviCostruttori })
      
      onSave({ ...classifica, gp: nuoviGP, piloti: nuoviPiloti, costruttori: nuoviCostruttori })
      onClose()
    }
  }

  if (step === 0) {
    return (
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Indietro</button>
        <h1 style={{ fontSize: '28px', marginBottom: '30px', textAlign: 'center' }}>Aggiungi nuovo GP</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome GP</label>
          <input type="text" value={nomeGP} onChange={(e) => setNomeGP(e.target.value)} placeholder="es. Bahrain" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Tipo Weekend</label>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button onClick={() => setTipoWeekend('standard')} style={{ padding: '15px', background: tipoWeekend === 'standard' ? '#007AFF' : 'white', color: tipoWeekend === 'standard' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>🏆 Weekend Standard</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>Solo gara principale (25-18-15...)</div>
            </button>
            <button onClick={() => setTipoWeekend('sprintF1')} style={{ padding: '15px', background: tipoWeekend === 'sprintF1' ? '#007AFF' : 'white', color: tipoWeekend === 'sprintF1' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>⚡️ Weekend Sprint F1</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>Sprint sabato (8-7-6...) + GP domenica (25-18-15...)</div>
            </button>
            <button onClick={() => setTipoWeekend('f2')} style={{ padding: '15px', background: tipoWeekend === 'f2' ? '#007AFF' : 'white', color: tipoWeekend === 'f2' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>🏎️ Weekend Formula 2</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>Sprint Race (15-12-10...) + Feature Race (25-18-15...)</div>
            </button>
          </div>
        </div>

        <button onClick={aggiungiGP} disabled={!nomeGP} style={{ width: '100%', padding: '15px', background: nomeGP ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: nomeGP ? 'pointer' : 'not-allowed' }}>
          Avanti
        </button>
      </div>
    )
  }

  const garaAttuale = gp.gare[garaCorrente]
  const pilotiAttivi = classifica.piloti.filter(p => p.attivo)

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', maxHeight: '90vh', overflow: 'auto' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Annulla</button>
      
      <h1 style={{ fontSize: '28px', marginBottom: '10px', textAlign: 'center' }}>GP: {gp.nome}</h1>
      <h2 style={{ fontSize: '20px', marginBottom: '30px', textAlign: 'center', color: '#666' }}>
        {garaAttuale.tipo_gara === 'principale' ? '🏁 Gara Principale' :
         garaAttuale.tipo_gara === 'sprint' ? '⚡️ Sprint Race' :
         garaAttuale.tipo_gara === 'featureRace' ? '🏆 Feature Race' :
         '🏎️ Sprint Race'}
      </h2>

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px', fontWeight: '600' }}>Inserisci posizioni:</h3>
        {pilotiAttivi.map((pilota, i) => (
          <div key={pilota.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <div style={{ flex: 1, fontWeight: '600' }}>{pilota.nome}</div>
            <input type="number" min="1" max="20" value={risultati[pilota.id] || ''} onChange={(e) => setRisultati({ ...risultati, [pilota.id]: parseInt(e.target.value) || 0 })} placeholder="Pos" style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }} />
          </div>
        ))}
      </div>

      {classifica.punti_pole_attivo && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '10px', fontWeight: '600' }}>Pole Position:</h3>
          <select value={poleId || ''} onChange={(e) => setPoleId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <option value="">Nessuno</option>
            {pilotiAttivi.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      {classifica.giro_veloce_attivo && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '10px', fontWeight: '600' }}>Giro Veloce:</h3>
          <select value={giroVeloceId || ''} onChange={(e) => setGiroVeloceId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <option value="">Nessuno</option>
            {pilotiAttivi.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      <button onClick={salvaRisultatiGara} style={{ width: '100%', padding: '15px', background: '#34C759', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
        {garaCorrente < gp.gare.length - 1 ? 'Prossima Gara' : 'Salva GP'}
      </button>
    </div>
  )
}

// ===== IMPOSTAZIONI CLASSIFICA =====
function ImpostazioniClassifica({ classifica, onClose, onSave }) {
  const [dati, setDati] = useState(classifica)
  const [showCambiaPilota, setShowCambiaPilota] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [modificatoreRaw, setModificatoreRaw] = useState((classifica.modificatore_libero_punti || []).join(', '))

  const salva = async () => {
    setSalvando(true)
    try {
      const updateObj = {
        usa_sync_automatica: !!dati.usa_sync_automatica,
        url_sync: dati.url_sync || null,
        punti_pole_attivo: !!dati.punti_pole_attivo,
        punti_pole_valore: Number(dati.punti_pole_valore) || 0,
        giro_veloce_attivo: !!dati.giro_veloce_attivo,
        giro_veloce_valore: Number(dati.giro_veloce_valore) || 0,
        usa_sistema_fia: !!dati.usa_sistema_fia,
        usa_sprint: !!dati.usa_sprint,
        usa_modificatore_libero: !!dati.usa_modificatore_libero,
        modificatore_libero_numero: Number(dati.modificatore_libero_numero) || 0,
        modificatore_libero_punti: Array.isArray(dati.modificatore_libero_punti) ? dati.modificatore_libero_punti : []
      }

      const { error } = await supabase.from('classifiche').update(updateObj).eq('id', classifica.id)
      if (error) {
        console.error('Errore salvataggio impostazioni:', error)
        // Se l'errore è dovuto a colonne mancanti, riproviamo senza i campi del modificatore
        const msg = String(error.message || error.details || JSON.stringify(error))
        if (/modificatore_libero_punti|modificatore_libero_numero/.test(msg) || /column .* does not exist/.test(msg)) {
          const fallback = { ...updateObj }
          delete fallback.modificatore_libero_punti
          delete fallback.modificatore_libero_numero
          const { error: err2 } = await supabase.from('classifiche').update(fallback).eq('id', classifica.id)
          if (!err2) {
            setSaveSuccess(true)
            setSalvando(false)
            setTimeout(() => {
              onSave({ ...classifica, ...fallback })
              onClose()
            }, 1000)
            alert('⚠️ Alcuni campi (modificatore) non sono supportati dal DB: salvati gli altri valori. Esegui la migrazione SQL per aggiungerli.')
            return
          }
        }
        alert('❌ Errore durante il salvataggio delle impostazioni: ' + msg)
        setSalvando(false)
        return
      }
      // Mostra conferma visiva, poi chiudi/aggiorna
      setSaveSuccess(true)
      setSalvando(false)
      setTimeout(() => {
        onSave({ ...classifica, ...updateObj })
        onClose()
      }, 1000)
    } catch (err) {
      console.error('Errore salvataggio impostazioni:', err)
      alert('❌ Errore durante il salvataggio delle impostazioni')
      setSalvando(false)
    }
  }

  const cancellaDati = async () => {
  if (!confirm(
    '⚠️ ATTENZIONE!\n\nQuesta azione cancellerà TUTTO:\n' +
    '- Tutti i GP inseriti\n' +
    '- Tutti i piloti e costruttori\n' +
    '- Tutti i punti e distacchi\n\n' +
    'La classifica sarà completamente vuota. Continuare?'
  )) return;

  // Reset completo
  const reset = {
    gp: [],
    piloti: [],
    costruttori: []
  };

  const { error } = await supabase
    .from('classifiche')
    .update(reset)
    .eq('id', classifica.id);

  if (!error) {
    alert('✅ Classifica completamente resettata');
    
    // Aggiorna stato locale
    onSave(reset);

    // Torna alla home delle classifiche
    navigate('/home-classifiche'); // sostituisci con la tua route reale
  } else {
    alert('❌ Errore durante il reset della classifica');
  }
};


  if (showCambiaPilota) {
    return <CambiaPilotaView 
      classifica={dati} 
      onClose={() => setShowCambiaPilota(false)} 
      onSave={(nuovaClassifica) => { 
        setDati(nuovaClassifica)
        setShowCambiaPilota(false)
      }} 
    />
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
        <h1 style={{ fontSize: '28px', margin: 0 }}>Impostazioni: {classifica.nome}</h1>
        <div style={{ width: '100px' }}></div>
      </div>

      <div style={{ marginBottom: '30px', padding: '20px', background: '#f0f8ff', borderRadius: '10px' }}>
        <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🔄</span> Sincronizzazione Automatica
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <input type="checkbox" checked={dati.usa_sync_automatica || false} onChange={(e) => setDati({ ...dati, usa_sync_automatica: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span>Attiva sincronizzazione da URL</span>
        </label>
        {dati.usa_sync_automatica && (
          <input type="text" value={dati.url_sync || ''} onChange={(e) => setDati({ ...dati, url_sync: e.target.value })} placeholder="URL sincronizzazione" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <input type="checkbox" checked={dati.punti_pole_attivo || false} onChange={(e) => setDati({ ...dati, punti_pole_attivo: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span style={{ fontWeight: '600' }}>Punti Pole Position</span>
        </label>
        {dati.punti_pole_attivo && (
          <div style={{ marginLeft: '30px' }}>
            <label>Punti per Pole: </label>
            <input type="number" min="1" max="10" value={dati.punti_pole_valore || 3} onChange={(e) => setDati({ ...dati, punti_pole_valore: parseInt(e.target.value) })} style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '2px solid #007AFF', textAlign: 'center' }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <input type="checkbox" checked={dati.giro_veloce_attivo || false} onChange={(e) => setDati({ ...dati, giro_veloce_attivo: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span style={{ fontWeight: '600' }}>Punti Giro Veloce</span>
        </label>
        {dati.giro_veloce_attivo && (
          <div style={{ marginLeft: '30px' }}>
            <label>Punti Giro Veloce: </label>
            <input type="number" min="1" max="10" value={dati.giro_veloce_valore || 1} onChange={(e) => setDati({ ...dati, giro_veloce_valore: parseInt(e.target.value) })} style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '2px solid #007AFF', textAlign: 'center' }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <input type="checkbox" checked={dati.usa_sistema_fia || false} onChange={(e) => setDati({ ...dati, usa_sistema_fia: e.target.checked, usa_modificatore_libero: e.target.checked ? false : dati.usa_modificatore_libero })} style={{ width: '20px', height: '20px' }} />
          <span>Usa sistema FIA</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <input type="checkbox" checked={dati.usa_sprint || false} onChange={(e) => setDati({ ...dati, usa_sprint: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span>Usa sistema Sprint</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="checkbox" checked={dati.usa_modificatore_libero || false} onChange={(e) => setDati({ ...dati, usa_modificatore_libero: e.target.checked, usa_sistema_fia: e.target.checked ? false : dati.usa_sistema_fia })} style={{ width: '20px', height: '20px' }} />
          <span>Modificatore libero</span>
        </label>
          {dati.usa_modificatore_libero && (
            <div style={{ marginLeft: '30px', marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Numero posizioni a punti</label>
              <input type="number" min="1" max="50" value={dati.modificatore_libero_numero || 10} onChange={(e) => setDati({ ...dati, modificatore_libero_numero: Number(e.target.value) || 0 })} style={{ width: '120px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }} />

              <label style={{ display: 'block', marginTop: '12px', marginBottom: '8px', fontWeight: '600' }}>Punti per posizione (separatori: , ; spazio o -/–/—)</label>
            <textarea value={modificatoreRaw} onChange={(e) => {
              const text = e.target.value
              setModificatoreRaw(text)
              // accetta separatori: comma, semicolon, space, hyphen, en-dash, em-dash
              const parts = text.split(/[,;\s\-\u2013\u2014]+/).filter(p => p.trim().length > 0)
              const raw = parts.map(s => parseInt(s.trim())).filter(n => !Number.isNaN(n))
              setDati({ ...dati, modificatore_libero_punti: raw })
            }} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
          )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => setShowCambiaPilota(true)} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>
          Cambia Pilota
        </button>
        <button onClick={cancellaDati} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #FF3B30 0%, #D70015 100%)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          Cancella Dati
        </button>
      </div>

      <button onClick={salva} disabled={salvando} style={{ width: '100%', padding: '15px', background: salvando ? '#98c0ff' : '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: salvando ? 'not-allowed' : 'pointer' }}>
        {salvando ? 'Salvando...' : 'Salva Impostazioni'}
      </button>
    </div>
  )
}

function CambiaPilotaView({ classifica, onClose, onSave }) {
  const [pilota1, setPilota1] = useState('')
  const [pilota2, setPilota2] = useState('')
  const [usaNuovoPilota, setUsaNuovoPilota] = useState(false)
  const [nomePilota, setNomePilota] = useState('')
  const [salvando, setSalvando] = useState(false)

  const conferma = async () => {
    if (!pilota1) {
      alert('Seleziona il primo pilota')
      return
    }
    
    setSalvando(true)
    
    const nuoviPiloti = [...classifica.piloti]
    const idx1 = nuoviPiloti.findIndex(p => String(p.id) === String(pilota1))
    if (idx1 === -1) {
      setSalvando(false)
      return
    }
    
    if (usaNuovoPilota) {
      // CASO 1: NUOVO PILOTA SCRITTO A MANO
      if (!nomePilota) {
        alert('Inserisci il nome del nuovo pilota')
        setSalvando(false)
        return
      }
      
      // Primo pilota → INATTIVO (ma mantiene punti!)
      nuoviPiloti[idx1].attivo = false
      
      // Nuovo pilota → ATTIVO con stesso team/colore
      const nuovoPilotaObj = {
        id: Date.now().toString(),
        nome: nomePilota,
        team: nuoviPiloti[idx1].team,
        colore: nuoviPiloti[idx1].colore,
        punti: 0,
        distacco: 0,
        attivo: true  // ESPLICITAMENTE true
      }
      
      console.log('Creando nuovo pilota:', nuovoPilotaObj)
      console.log('Pilota sostituito:', nuoviPiloti[idx1])
      
      nuoviPiloti.push(nuovoPilotaObj)
      
      console.log('Lista piloti dopo aggiunta:', nuoviPiloti.map(p => ({ nome: p.nome, attivo: p.attivo })))
    } else {
      // CASO 2: PILOTA DALLA TENDINA
      if (!pilota2) {
        alert('Seleziona il secondo pilota')
        setSalvando(false)
        return
      }
      const idx2 = nuoviPiloti.findIndex(p => String(p.id) === String(pilota2))
      if (idx2 === -1) {
        setSalvando(false)
        return
      }
      
      // SCAMBIO TEAM (sempre)
      const tempTeam = nuoviPiloti[idx1].team
      const tempColore = nuoviPiloti[idx1].colore
      nuoviPiloti[idx1].team = nuoviPiloti[idx2].team
      nuoviPiloti[idx1].colore = nuoviPiloti[idx2].colore
      nuoviPiloti[idx2].team = tempTeam
      nuoviPiloti[idx2].colore = tempColore
      
      // LOGICA ATTIVO/INATTIVO
      if (nuoviPiloti[idx2].attivo) {
        // Secondo GIÀ ATTIVO → ENTRAMBI RIMANGONO ATTIVI (scambio semplice)
        // NON toccare .attivo
      } else {
        // Secondo INATTIVO → SOSTITUZIONE
        nuoviPiloti[idx2].attivo = true  // Inattivo diventa attivo
        nuoviPiloti[idx1].attivo = false // Attivo diventa inattivo (ma mantiene punti!)
      }
    }
    
    // Salva direttamente su Supabase
    const { error } = await supabase
      .from('classifiche')
      .update({ piloti: nuoviPiloti })
      .eq('id', classifica.id)
    
    setSalvando(false)
    
    if (error) {
      console.error('Errore salvataggio:', error)
      alert('❌ Errore durante il salvataggio')
      return
    }
    
    console.log('Salvato con successo su Supabase')
    console.log('Piloti salvati:', nuoviPiloti.map(p => ({ nome: p.nome, attivo: p.attivo })))
    
    // Aggiorna lo stato locale
    onSave({ ...classifica, piloti: nuoviPiloti })
    
    alert('✅ Pilota cambiato con successo!')
    onClose()
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '20px' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Indietro</button>
      <h1 style={{ fontSize: '28px', marginBottom: '30px' }}>Cambia Pilota</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Primo pilota (da sostituire):</label>
        <select value={pilota1} onChange={(e) => setPilota1(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <option value="">Seleziona</option>
          {classifica.piloti.filter(p => p.attivo).map(p => <option key={p.id} value={p.id}>{p.nome} ({p.team})</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="checkbox" checked={usaNuovoPilota} onChange={(e) => setUsaNuovoPilota(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          <span>Usa nuovo pilota</span>
        </label>
      </div>

      {usaNuovoPilota ? (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome nuovo pilota:</label>
          <input type="text" value={nomePilota} onChange={(e) => setNomePilota(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Secondo pilota:</label>
          <select value={pilota2} onChange={(e) => setPilota2(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <option value="">Seleziona</option>
            {classifica.piloti.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.team}) {p.attivo ? '✅' : '⚠️ INATTIVO'}</option>)}
          </select>
        </div>
      )}

      <button onClick={conferma} disabled={salvando} style={{ width: '100%', padding: '15px', background: salvando ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: salvando ? 'not-allowed' : 'pointer' }}>
        {salvando ? 'Salvando...' : 'Conferma'}
      </button>
    </div>
  )
}

// ===== GRAFICO PRONOSTICO =====
function GraficoPronostico({ classifica, onClose }) {
  const [tab, setTab] = useState(0)
  const [pilotaFissato, setPilotaFissato] = useState(null)
  
  const pilotiOrdinati = classifica.piloti ? classifica.piloti.filter(p => p.attivo).sort((a, b) => (b.punti || 0) - (a.punti || 0)) : []
  const costruttoriOrdinati = classifica.costruttori ? classifica.costruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)) : []
  
  const gpRimanenti = classifica.gp ? classifica.gp.filter(g => !g.completato).length : 0
  const sprintRimanenti = classifica.gp ? classifica.gp.filter(g => !g.completato && g.tipo_weekend === 'sprintF1').length : 0
  
  const puntiMassimiRimanenti = gpRimanenti * 25 + sprintRimanenti * 8

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#f5f5f7', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '20px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '1px 15px', marginBottom: '20px' }}>
        <button
  onClick={onClose}
  style={{
    background: 'none',
    border: 'none',
    color: '#007AFF',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '8px',
    padding: '10px 0',
    width: 'fit-content',
    // per spostarlo fuori dal bordo bianco:
    marginTop: '-11px', // negativo per salire sopra il bordo
    marginLeft: '-115px',
    marginBottom: '20px'
  }}
>
  ← Indietro
</button>

          <h1 style={{ fontSize: '34px', fontWeight: 'bold', margin: 0,  flex: 1 }}>Grafico Pronostico Campionato</h1>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => { setTab(0); setPilotaFissato(null) }} style={{ flex: 1, padding: '15px', background: tab === 0 ? '#007AFF' : 'white', color: tab === 0 ? 'white' : '#000', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Piloti</button>
          <button onClick={() => { setTab(1); setPilotaFissato(null) }} style={{ flex: 1, padding: '15px', background: tab === 1 ? '#007AFF' : 'white', color: tab === 1 ? 'white' : '#000', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Costruttori</button>
        </div>

        <div style={{ background: 'white', borderRadius: '15px', padding: '30px', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '60px' }}>
            <div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#007AFF' }}>{gpRimanenti}</div>
              <div style={{ fontSize: '16px', color: '#666' }}>GP rimanenti</div>
            </div>
            <div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#FF9500' }}>{sprintRimanenti}</div>
              <div style={{ fontSize: '16px', color: '#666' }}>Sprint rimanenti</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' }}>Andamento Punti Stagione</h2>
          {classifica.gp && classifica.gp.length > 0 ? (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg width={Math.max(800, classifica.gp.filter(g => g.completato).length * 100)} height="400" style={{ display: 'block' }}>
                {/* Griglia */}
                {[0, 25, 50, 75, 100, 125, 150, 175, 200].map(y => (
                  <g key={y}>
                    <line x1="50" y1={350 - y * 1.5} x2={Math.max(800, classifica.gp.filter(g => g.completato).length * 100)} y2={350 - y * 1.5} stroke="#e0e0e0" strokeWidth="1" />
                    <text x="10" y={355 - y * 1.5} fontSize="12" fill="#999">{y}</text>
                  </g>
                ))}
                
                {/* Linee piloti/costruttori */}
                {(tab === 0 ? pilotiOrdinati : costruttoriOrdinati).map((item, idx) => {
                  const gpCompletati = classifica.gp.filter(g => g.completato)
                  if (gpCompletati.length === 0) return null
                  
                  let puntiAccumulati = 0
                  const punti = [{ x: 50, y: 350, punti: 0 }]
                  
                  gpCompletati.forEach((gp, gpIdx) => {
                    let puntiGP = 0
                    
                    gp.gare?.forEach(gara => {
                      if (!gara.completata) return
                      
                      if (tab === 0) {
                        // PILOTI: calcolo normale
                        const risultato = gara.risultati?.[item.id]
                        if (!risultato) return
                        
                        let puntiGara = calcolaPuntiPosizione(risultato, gara.tipo_gara, classifica)
                        if (classifica.punti_pole_attivo && String(gara.pole_id) === String(item.id)) {
                          puntiGara += classifica.punti_pole_valore || 3
                        }
                        if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(item.id)) {
                          puntiGara += classifica.giro_veloce_valore || 1
                        }
                        puntiGP += puntiGara
                      } else {
                        // COSTRUTTORI: somma punti di tutti i piloti del team
                        Object.entries(gara.risultati || {}).forEach(([pilotaId, pos]) => {
                          const pilota = classifica.piloti.find(p => String(p.id) === String(pilotaId))
                          if (!pilota || pilota.team !== item.nome) return
                          
                          let puntiGara = calcolaPuntiPosizione(pos, gara.tipo_gara, classifica)
                          if (classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId)) {
                            puntiGara += classifica.punti_pole_valore || 3
                          }
                          if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId)) {
                            puntiGara += classifica.giro_veloce_valore || 1
                          }
                          puntiGP += puntiGara
                        })
                      }
                    })
                    
                    puntiAccumulati += puntiGP
                    const x = 50 + (gpIdx + 1) * 100
                    const y = 350 - puntiAccumulati * 1.5
                    punti.push({ x, y, punti: puntiAccumulati })
                  })
                  
                  // Calcola percentuale per determinare se fuori lotta
                  const lista = tab === 0 ? pilotiOrdinati : costruttoriOrdinati
                  const moltiplicatore = tab === 0 ? 1 : 2
                  const distacco = idx === 0 ? 0 : ((lista[0]?.punti || 0) - (item.punti || 0))
                  const possibile = distacco <= puntiMassimiRimanenti * moltiplicatore
                  const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / (puntiMassimiRimanenti * moltiplicatore)) * 100)) : 0
                  
                  const fuoriLotta = percentuale === 0 && idx > 0
                  const colore = fuoriLotta ? '#cccccc' : (item.colore || '#007AFF')
                  const isFissato = pilotaFissato && String(pilotaFissato) === String(item.id)
                  const opacity = pilotaFissato ? (isFissato ? 1 : 0.2) : (fuoriLotta ? 0.3 : 1)
                  const strokeWidth = isFissato ? 5 : 3
                  
                  return (
                    <g key={item.id}>
                      <polyline
                        points={punti.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={colore}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                      />
                      {punti.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={isFissato ? 7 : 5} fill={colore} opacity={opacity}>
                          <title>{item.nome}: {p.punti} pts</title>
                        </circle>
                      ))}
                    </g>
                  )
                })}
                
                {/* Etichette GP */}
                {classifica.gp.filter(g => g.completato).map((gp, idx) => (
                  <text key={gp.id} x={50 + (idx + 1) * 100} y="380" fontSize="10" fill="#666" textAnchor="middle" transform={`rotate(-45, ${50 + (idx + 1) * 100}, 380)`}>
                    {gp.nome}
                  </text>
                ))}
              </svg>
              
              {/* Legenda */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '10px' }}>
                {(tab === 0 ? pilotiOrdinati : costruttoriOrdinati).map((item, idx) => {
                  const lista = tab === 0 ? pilotiOrdinati : costruttoriOrdinati
                  const moltiplicatore = tab === 0 ? 1 : 2
                  const distacco = idx === 0 ? 0 : ((lista[0]?.punti || 0) - (item.punti || 0))
                  const possibile = distacco <= puntiMassimiRimanenti * moltiplicatore
                  const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / (puntiMassimiRimanenti * moltiplicatore)) * 100)) : 0
                  const fuoriLotta = percentuale === 0 && idx > 0
                  const isFissato = pilotaFissato && String(pilotaFissato) === String(item.id)
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setPilotaFissato(isFissato ? null : item.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        opacity: pilotaFissato ? (isFissato ? 1 : 0.4) : (fuoriLotta ? 0.5 : 1),
                        cursor: 'pointer',
                        padding: '8px',
                        background: isFissato ? '#e3f2fd' : 'transparent',
                        borderRadius: '8px',
                        border: isFissato ? '2px solid #007AFF' : '2px solid transparent'
                      }}
                    >
                      <div style={{ width: '20px', height: isFissato ? '6px' : '4px', background: item.colore || '#007AFF', borderRadius: '2px' }}></div>
                      <span style={{ fontSize: '14px', fontWeight: isFissato ? 'bold' : '500' }}>{item.nome}</span>
                      {fuoriLotta && <span style={{ fontSize: '12px', color: '#999' }}>(fuori lotta)</span>}
                      {isFissato && <span style={{ fontSize: '12px', color: '#007AFF' }}>📌</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Nessun GP inserito ancora</div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '15px', padding: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' }}>Analisi Possibilità di Vittoria</h2>
          {tab === 0 ? (
            pilotiOrdinati.map((p, i) => {
              const puntiRimanenti = puntiMassimiRimanenti
              const distacco = i === 0 ? 0 : (pilotiOrdinati[0]?.punti || 0) - (p.punti || 0)
              const possibile = distacco <= puntiRimanenti
              const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / puntiRimanenti) * 100)) : 0
              const combinazioni = calcolaCombinazioniVittoria(p, classifica, gpRimanenti, sprintRimanenti)
              
              return (
                <div key={p.id} style={{ padding: '20px', borderBottom: i < pilotiOrdinati.length - 1 ? '1px solid #eee' : 'none', opacity: possibile ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{p.nome}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#007AFF' }}>{p.punti || 0} pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Punti rimanenti:</span>
                    <span style={{ fontWeight: 'bold' }}>{puntiRimanenti}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Possibilità di vincere:</span>
                    <span style={{ fontWeight: 'bold', color: possibile ? '#34C759' : '#FF3B30' }}>
                      {possibile ? (i === 0 ? 'Leader' : `${percentuale}%`) : 'Fuori dalla lotta'}
                    </span>
                  </div>
                  {possibile && (
                    <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                      <div style={{ width: `${percentuale}%`, height: '100%', background: '#34C759' }}></div>
                    </div>
                  )}
                  
                  {/* COMBINAZIONI */}
                  {combinazioni.length > 0 && (
                    <div style={{ marginTop: '15px', padding: '15px', background: '#fff8e1', borderRadius: '8px', borderLeft: '4px solid #FF9500' }}>
                      <div style={{ fontWeight: 'bold', color: '#FF9500', marginBottom: '10px' }}>
                      Combinazioni per vincere il campionato:
                      </div>
                      {combinazioni.map((combo, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
                          <span style={{ color: '#FF9500' }}>•</span>
                          <span>{combo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            costruttoriOrdinati.map((c, i) => {
              const puntiRimanenti = puntiMassimiRimanenti * 2
              const distacco = i === 0 ? 0 : (costruttoriOrdinati[0]?.punti || 0) - (c.punti || 0)
              const possibile = distacco <= puntiRimanenti
              const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / puntiRimanenti) * 100)) : 0
              
              // Combinazioni costruttori (simili a piloti ma con 2 piloti per team)
              const combinazioniCostruttori = []
              if (possibile && gpRimanenti > 0) {
                const leader = costruttoriOrdinati[0]
                
                if (i === 0) {
                  // SONO IL LEADER
                  if (costruttoriOrdinati.length > 1) {
                    const secondo = costruttoriOrdinati[1]
                    const vantaggio = (c.punti || 0) - (secondo.punti || 0)
                    
                    if (vantaggio > puntiRimanenti) {
                      combinazioniCostruttori.push('🏆 Già campione matematico!')
                    } else {
                      // Combinazioni per mantenere la leadership
                      combinazioniCostruttori.push(`${c.nome} mantiene vantaggio con doppietta 1-2 in ${Math.ceil((puntiRimanenti - vantaggio) / 43)} gare`)
                      combinazioniCostruttori.push(`${c.nome} 1° + 3° in ${Math.ceil((puntiRimanenti - vantaggio) / 40)} gare garantisce titolo`)
                      combinazioniCostruttori.push(`Se ${secondo.nome} fa meno di ${vantaggio} punti, ${c.nome} è campione`)
                    }
                  } else {
                    combinazioniCostruttori.push('🏆 Unico costruttore in classifica!')
                  }
                } else {
                  // SONO INSEGUITORE
                  const rivale = leader
                  const diff = (rivale?.punti || 0) - (c.punti || 0)
                  
                  if (diff <= 0) {
                    combinazioniCostruttori.push('🏆 In vantaggio!')
                  } else {
                    const doppietteNecessarie = Math.ceil(diff / 43) // 25+18 = 43 (doppietta 1-2)
                    if (doppietteNecessarie <= gpRimanenti && doppietteNecessarie > 0) {
                      combinazioniCostruttori.push(`${c.nome} fa ${doppietteNecessarie} doppietta/e 1-2 + ${rivale.nome} fuori dal podio`)
                    }
                    
                    const gare1e3 = Math.ceil(diff / 40) // 25+15 = 40
                    if (gare1e3 <= gpRimanenti && gare1e3 > 0) {
                      combinazioniCostruttori.push(`${c.nome} 1° + 3° per ${gare1e3} gare + ${rivale.nome} 5° + 6° o peggio`)
                    }
                    
                    const gare2e3 = Math.ceil(diff / 33) // 18+15 = 33
                    if (gare2e3 <= gpRimanenti && gare2e3 > 0) {
                      combinazioniCostruttori.push(`${c.nome} 2° + 3° per ${gare2e3} gare + ${rivale.nome} fuori punti`)
                    }
                    
                    // Combinazione prossimo GP
                    if (gpRimanenti > 0) {
                      const prossimoGP = classifica.gp.find(g => !g.completato)?.nome || `GP #${classifica.gp.filter(g => g.completato).length + 1}`
                      const puntiDopoGP = (c.punti || 0) + 43 // doppietta
                      const puntiRivaleDopoGP = (rivale.punti || 0) // rivale fuori punti
                      const gareSuccessive = gpRimanenti - 1
                      const puntiMassimiRivale = puntiRivaleDopoGP + (gareSuccessive * 50) // 2 piloti x 25
                      
                      if (puntiDopoGP > puntiMassimiRivale) {
                        combinazioniCostruttori.push(`🏁 Al ${prossimoGP}: ${c.nome} doppietta 1-2 + ${rivale.nome} fuori punti = CAMPIONE!`)
                      }
                    }
                  }
                }
              }
              
              return (
                <div key={c.id} style={{ padding: '20px', borderBottom: i < costruttoriOrdinati.length - 1 ? '1px solid #eee' : 'none', opacity: possibile ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{c.nome}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#007AFF' }}>{c.punti || 0} pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Punti rimanenti:</span>
                    <span style={{ fontWeight: 'bold' }}>{puntiRimanenti}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Possibilità di vincere:</span>
                    <span style={{ fontWeight: 'bold', color: possibile ? '#34C759' : '#FF3B30' }}>
                      {possibile ? (i === 0 ? 'Leader' : `${percentuale}%`) : 'Fuori dalla lotta'}
                    </span>
                  </div>
                  {possibile && (
                    <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                      <div style={{ width: `${percentuale}%`, height: '100%', background: '#34C759' }}></div>
                    </div>
                  )}
                  
                  {/* COMBINAZIONI COSTRUTTORI */}
                  {combinazioniCostruttori.length > 0 && (
                    <div style={{ marginTop: '15px', padding: '15px', background: '#fff8e1', borderRadius: '8px', borderLeft: '4px solid #FF9500' }}>
                      <div style={{ fontWeight: 'bold', color: '#FF9500', marginBottom: '10px' }}>
                        📊 Combinazioni per vincere il campionato:
                      </div>
                      {combinazioniCostruttori.map((combo, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
                          <span style={{ color: '#FF9500' }}>•</span>
                          <span>{combo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ===== SETUP INIZIALE CON F2 =====
function SetupIniziale({ classifica, onSave, onBack }) {
  const [step, setStep] = useState(0)
  const [piloti, setPiloti] = useState([])
  const [costruttori, setCostruttori] = useState([])
  const [numeroGP, setNumeroGP] = useState(10)
  const [numeroSprint, setNumeroSprint] = useState(2)
  const [gp, setGp] = useState([])
  const [nomePilota, setNomePilota] = useState('')
  const [teamPilota, setTeamPilota] = useState('')
  const [colorePilota, setColorePilota] = useState('#0066FF')
  const [nomeGP, setNomeGP] = useState('')
  const [tipoWeekend, setTipoWeekend] = useState('standard')

  const aggiungiPilota = () => {
    if (!nomePilota || !teamPilota) return
    const nuovoPilota = { id: Date.now(), nome: nomePilota, team: teamPilota, colore: colorePilota, punti: 0, distacco: 0, attivo: true }
    setPiloti([...piloti, nuovoPilota])
    if (!costruttori.find(c => c.nome === teamPilota)) {
      setCostruttori([...costruttori, { id: Date.now() + 1, nome: teamPilota, colore: colorePilota, punti: 0, distacco: 0 }])
    }
    setNomePilota('')
    setTeamPilota('')
    setColorePilota('#0066FF')
  }

  const aggiungiGP = () => {
    if (!nomeGP) return
    const nuovoGP = { id: Date.now(), nome: nomeGP, tipo_weekend: tipoWeekend, completato: false, gare: [] }
    setGp([...gp, nuovoGP])
    setNomeGP('')
  }

  const confermaESalva = () => {
    onSave({ ...classifica, piloti, costruttori, gp, numero_gp_stagione: numeroGP, numero_sprint_stagione: numeroSprint })
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <button onClick={step === 0 ? onBack : () => setStep(step - 1)} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Indietro
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: step === i ? '#007AFF' : '#ddd' }} />)}
        </div>
      </div>

      {step === 0 && (
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '30px', textAlign: 'center' }}>Inserisci i piloti e i team in {classifica.nome}</h1>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome Pilota</label>
            <input type="text" value={nomePilota} onChange={(e) => setNomePilota(e.target.value)} placeholder="es. Max Verstappen" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Team</label>
            <input type="text" value={teamPilota} onChange={(e) => setTeamPilota(e.target.value)} placeholder="es. Red Bull Racing" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Colore</label>
            <input type="color" value={colorePilota} onChange={(e) => setColorePilota(e.target.value)} style={{ width: '100%', height: '50px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
          </div>
          <button onClick={aggiungiPilota} style={{ width: '100%', padding: '15px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>Aggiungi Pilota</button>
          {piloti.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Piloti: {piloti.length}</h3>
              {piloti.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', background: '#f8f8f8', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: p.colore }}></div>
                  <div><strong>{p.nome}</strong> - {p.team}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setStep(1)} disabled={piloti.length === 0} style={{ width: '100%', padding: '15px', background: piloti.length > 0 ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: piloti.length > 0 ? 'pointer' : 'not-allowed' }}>Avanti</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '30px', textAlign: 'center' }}>Configurazione Stagione</h1>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', background: '#f0f0f0', padding: '30px', borderRadius: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'center' }}>Numero GP:</label>
              <input type="number" value={numeroGP} onChange={(e) => setNumeroGP(parseInt(e.target.value))} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'center' }}>Numero Sprint:</label>
              <input type="number" value={numeroSprint} onChange={(e) => setNumeroSprint(parseInt(e.target.value))} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' }} />
            </div>
          </div>
          <button onClick={() => setStep(2)} style={{ width: '100%', padding: '15px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>Avanti</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '20px', textAlign: 'center' }}>Inserisci il calendario dei GP</h1>
          <p style={{ textAlign: 'center', color: '#FF9500', marginBottom: '30px', fontWeight: '600' }}>GP inseriti: {gp.length} / {numeroGP}</p>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome GP</label>
            <input type="text" value={nomeGP} onChange={(e) => setNomeGP(e.target.value)} placeholder="es. Bahrain" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Tipo Weekend:</label>
            <div style={{ display: 'grid', gap: '10px' }}>
              <button onClick={() => setTipoWeekend('standard')} style={{ padding: '15px', background: tipoWeekend === 'standard' ? '#007AFF' : 'white', color: tipoWeekend === 'standard' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold' }}>🏆 Weekend Standard</div>
              </button>
              <button onClick={() => setTipoWeekend('sprintF1')} style={{ padding: '15px', background: tipoWeekend === 'sprintF1' ? '#007AFF' : 'white', color: tipoWeekend === 'sprintF1' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold' }}>⚡️ Weekend Sprint F1</div>
              </button>
              <button onClick={() => setTipoWeekend('f2')} style={{ padding: '15px', background: tipoWeekend === 'f2' ? '#007AFF' : 'white', color: tipoWeekend === 'f2' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold' }}>🏎️ Weekend Formula 2</div>
              </button>
            </div>
          </div>
          <button onClick={aggiungiGP} disabled={gp.length >= numeroGP || !nomeGP} style={{ width: '100%', padding: '15px', background: gp.length < numeroGP && nomeGP ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: gp.length < numeroGP && nomeGP ? 'pointer' : 'not-allowed', marginBottom: '20px' }}>Aggiungi GP</button>
          {gp.length > 0 && (
            <div style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
              {gp.map((g, i) => (
                <div key={g.id} style={{ padding: '12px', background: '#f8f8f8', borderRadius: '8px', marginBottom: '8px' }}>
                  <strong>{i + 1}.</strong> {g.nome} {g.tipo_weekend === 'sprintF1' ? '⚡️' : g.tipo_weekend === 'f2' ? '🏎️' : '🏆'}
                </div>
              ))}
            </div>
          )}
          <button onClick={confermaESalva} disabled={gp.length < numeroGP} style={{ width: '100%', padding: '15px', background: gp.length === numeroGP ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: gp.length === numeroGP ? 'pointer' : 'not-allowed' }}>Conferma e continua</button>
        </div>
      )}
    </div>
  )
}

// ===== MENU CLASSIFICHE =====
function ClassificheMenuView({ user, onBack, onOpenClassifica }) {
  const [classifiche, setClassifiche] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAltreClassifiche, setShowAltreClassifiche] = useState(false)
  const [modalitaElimina, setModalitaElimina] = useState(false)
  const [showNuova, setShowNuova] = useState(false)

  const isAdmin = user.ruolo === 'admin'

  useEffect(() => {
    document.title = "FWM - Classifiche"
  }, [])

  useEffect(() => { caricaClassifiche() }, [])

  const caricaClassifiche = async () => {
    try {
      const { data, error } = await supabase.from('classifiche').select('*').order('nome')
      if (!error && data) setClassifiche(data)
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  const eliminaClassifica = async (id) => {
    if (!confirm('Eliminare questa classifica? Questa azione non può essere annullata.')) return
    const { error } = await supabase.from('classifiche').delete().eq('id', id)
    if (!error) {
      caricaClassifiche()
      setModalitaElimina(false)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Caricamento...</div>

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          Indietro
        </button>
  <button
  onClick={() => {
    if (modalitaElimina) {
      setModalitaElimina(false);
      setShowAltreClassifiche(false);
    } else {
      setShowAltreClassifiche(true);
      setModalitaElimina(true);
    }
  }}
  DISTANZA BOTTONE CESTINO DAL BORDO HOME CLASSIFICA
  style={{
    position: "fixed",
    right: "60px",      // 👈 aumenta questo valore = più a sinistra
    bottom: "720px",     // puoi regolarlo se serve
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "none",
    background: modalitaElimina ? "#34C759" : "#FF3B30",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
    zIndex: 1000
  }}
>
  {modalitaElimina ? (
    /* ✔️ V verde */
    <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
      <path d="M9 16.2l-3.5-3.5 1.4-1.4L9 13.4l8.1-8.1 1.4 1.4z" />
    </svg>
  ) : (
    /* 🗑️ Cestino bianco */
    <img
      src={CestinoSVG}
      alt="Cestino"
      style={{
        width: "24px",
        height: "24px",
        filter: "brightness(0) invert(1)"
      }}
    />
  )}
</button>

      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '40px' }}>
          {classifiche[0] && <button onClick={() => onOpenClassifica(classifiche[0].id)} style={{ width: '250px', height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>Formula 1</button>}
          {classifiche[1] && <button onClick={() => onOpenClassifica(classifiche[1].id)} style={{ width: '250px', height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>Formula E</button>}
        </div>
        <button onClick={() => setShowAltreClassifiche(!showAltreClassifiche)} style={{ width: '250px', height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
          {showAltreClassifiche ? 'Chiudi Altre Classifiche' : 'Altre Classifiche'}
        </button>
        {showAltreClassifiche && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '540px' }}>
            {classifiche.slice(2).map(c => (
              <div key={c.id} style={{ display: 'flex', gap: '10px' }}>
                {modalitaElimina && <button onClick={() => eliminaClassifica(c.id)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: '#FF3B30', color: 'white', fontSize: '24px', cursor: 'pointer' }}>−</button>}
                <button onClick={() => !modalitaElimina && onOpenClassifica(c.id)} style={{ flex: 1, height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: modalitaElimina ? 'default' : 'pointer', opacity: modalitaElimina ? 0.6 : 1, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>{c.nome}</button>
              </div>
            ))}
           <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
  {isAdmin && !modalitaElimina && (
    <button
      onClick={() => setShowNuova(true)}
      style={{
        width: '250px',
        height: '80px',
        background: '#34C759',
        color: 'white',
        border: 'none',
        borderRadius: '25px',
        fontSize: '24px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
      }}
    >
      Nuova Classifica
    </button>
  )}
</div>

          </div>
        )}
      </div>
      {showNuova && <NuovaClassificaModal onClose={() => setShowNuova(false)} onSave={() => { caricaClassifiche(); setShowNuova(false) }} />}
    </div>
  )
}

function NuovaClassificaModal({ onClose, onSave }) {
  const [nome, setNome] = useState('')
  const handleSave = async (e) => {
    e.preventDefault()
    if (!nome.trim()) return
    const { error } = await supabase.from('classifiche').insert([{ nome, piloti: [], gp: [], costruttori: [], is_f1_or_fe: false }])
    if (!error) onSave()
  }
  return (
    <div className="modal-container">
      <div className="modal-card" style={{ width: '450px' }}>
        <div className="modal-header">
          <h2>Crea nuova classifica</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nome classifica</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="form-input" placeholder="Es: Moto GP, Indycar..." required autoFocus />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-save">Salva</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/// ===== HOME VIEW =====
function HomeView({ user, onLogout, onOpenGestione, onOpenClassificheMenu, onOpenRitaglio, onOpenCalendario, onOpenDisponibilita, notificheNonLetteCalendario, notificheNonLetteDisponibilita }) {
  useEffect(() => {
    document.title = "FWM Software - Home"
  }, [])
  
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="header-left">
          {user.ruolo === 'admin' && (
            <button className="btn-header" onClick={onOpenGestione}>
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
              Gestione
            </button>
          )}
        </div>
        <div className="header-right">
          <button className="btn-header" onClick={onLogout}>
            {user.nome_completo}
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="home-title">
        <h1 className="title-main">FWM Software</h1>
      </div>

      <div className="home-cards-wrapper">
        {/* RIGA 1 - Classifiche + Ritaglio */}
        <div className="home-cards-row">
          <div className="home-card card-blue" onClick={onOpenClassificheMenu} style={{ cursor: 'pointer' }}>
            <div className="card-icon-wrapper">
              <img
                src={CoppaSVG}
                alt="Coppa"
                style={{ width: "80px", height: "60px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">CLASSIFICHE</h3>
            <p className="card-subtitle">
              {user.ruolo === 'admin' ? 'Gestisci campionati\ne classifiche' : 'Visualizza\nclassifiche'}
            </p>
          </div>

          <div className="home-card card-green" onClick={onOpenRitaglio} style={{ cursor: 'pointer' }}>
            <div className="card-icon-wrapper">
              <img
                src={FotoSVG}
                alt="Foto"
                style={{ width: "60px", height: "50px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">RITAGLIO FOTO</h3>
            <p className="card-subtitle">Ritaglia immagini<br />1200x729 px</p>
          </div>
        </div>

        {/* RIGA 2 - Disponibilità + Calendario */}
        <div className="home-cards-row">
          <div className="home-card card-purple" onClick={() => onOpenDisponibilita(null)} style={{ cursor: 'pointer', position: 'relative' }}>
            {notificheNonLetteDisponibilita > 0 && (
              <div style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#FF3B30',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(255,59,48,0.4)',
                zIndex: 10
              }}>
                {notificheNonLetteDisponibilita}
              </div>
            )}
            <div className="card-icon-wrapper">
              <img
                src={DisponibilitàSVG}
                alt="Disponibilità"
                style={{ width: "70px", height: "60px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">DISPONIBILITÀ WEEKEND</h3>
            <p className="card-subtitle">Eventi e Gare</p>
          </div>

          <div className="home-card card-yellow" onClick={onOpenCalendario} style={{ cursor: 'pointer', position: 'relative' }}>
            {notificheNonLetteCalendario > 0 && (
              <div style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#FF3B30',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(255,59,48,0.4)',
                zIndex: 10
              }}>
                {notificheNonLetteCalendario}
              </div>
            )}
            <div className="card-icon-wrapper">
              <img
                src={PressPNG}
                alt="Press"
                style={{ width: "58px", height: "60px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">CALENDARIO ACCREDITI</h3>
            <p className="card-subtitle">Eventi e Gare<br />per cui richiedere accredito</p>
          </div>
        </div>

        {/* RIGA 3 - Card Rosse */}
        <div className="home-cards-row">
          <div 
            className="home-card card-red" 
            onClick={() => window.open('https://www.formula1.it/admin/login.asp', '_blank')} 
            style={{ cursor: 'pointer' }}
          >
            <div className="card-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="white" style={{ width: "50px", height: "50px" }}>
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <h3 className="card-title">PANNELLO VIDA</h3>
            <p className="card-subtitle">Gestione articoli<br />e contenuti</p>
          </div>

          <div 
            className="home-card card-red" 
            onClick={() => window.open('https://fonti.formula1.it/login.asp', '_blank')} 
            style={{ cursor: 'pointer' }}
          >
            <div className="card-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="white" style={{ width: "50px", height: "50px" }}>
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
            </div>
            <h3 className="card-title">PANNELLO FONTI</h3>
            <p className="card-subtitle">Archivio fonti<br />e risorse</p>
          </div>
        </div>
      </div>

      <div className="home-footer">
        <p className="version-text">Versione 2.0</p>
      </div>
    </div>
  )
}

// ===== LOGIN =====
function LoginView({ username, setUsername, password, setPassword, showPassword, setShowPassword, loginError, loading, handleLogin }) {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="f1-icon">🏎️</div>
          <h1 className="login-title">FWM Software</h1>
          <p className="login-subtitle">Accedi al tuo account</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label"><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label"><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>Password</label>
            <div className="password-input-wrapper">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" required />
              <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
            </div>
          </div>
          {loginError && <div className="error-message">{loginError}</div>}
          <button type="submit" className="btn-login" disabled={loading}>{loading ? 'Accesso...' : 'Accedi'}</button>
        </form>
      </div>
    </div>
  )
}

function PasswordChangeView({ newPassword, setNewPassword, confirmPassword, setConfirmPassword, showNewPassword, setShowNewPassword, showConfirmPassword, setShowConfirmPassword, passwordError, handlePasswordChange }) {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="warning-icon">🔑</div>
          <h1 className="login-title">Cambio Password Obbligatorio</h1>
          <p className="login-subtitle">Per sicurezza, devi cambiare la password al primo accesso</p>
        </div>
        <form onSubmit={handlePasswordChange} className="login-form">
          <div className="form-group">
            <label className="form-label">Nuova Password</label>
            <div className="password-input-wrapper">
              <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input" placeholder="Minimo 8 caratteri" required />
              <button type="button" className="toggle-password" onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? '👁️' : '👁️‍🗨️'}</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Conferma Password</label>
            <div className="password-input-wrapper">
              <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input" placeholder="Ripeti la password" required />
              <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</button>
            </div>
          </div>
          {passwordError && <div className="error-message">{passwordError}</div>}
          <button type="submit" className="btn-login btn-green" disabled={newPassword.length < 8 || newPassword !== confirmPassword}>✅ Cambia e Continua</button>
        </form>
      </div>
    </div>
  )
}

// ===== GESTIONE UTENTI =====
function GestioneUtentiView({ onClose }) {
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNuovo, setShowNuovo] = useState(false)
  const [editUtente, setEditUtente] = useState(null)
  const [showCategorie, setShowCategorie] = useState(false)
  const [showTemplateArticoli, setShowTemplateArticoli] = useState(false)

  useEffect(() => {
    document.title = "FWM - Gestione Utenti"
  }, [])

  useEffect(() => { caricaUtenti() }, [])

  const caricaUtenti = async () => {
    try {
      const { data, error } = await supabase.from('utenti').select('*').order('username')
      if (!error && data) setUtenti(data)
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  const cambiaRuolo = async (utente) => {
    const nuovoRuolo = utente.ruolo === 'admin' ? 'redattore' : 'admin'
    const { error } = await supabase.from('utenti').update({ ruolo: nuovoRuolo }).eq('id', utente.id)
    if (!error) caricaUtenti()
  }

  const resetPassword = async (utente) => {
    if (!confirm(`Resettare la password di ${utente.username} a quella iniziale?`)) return
    const { error } = await supabase.from('utenti').update({ password: 'FWM2025APP!?!', deve_cambiare_password: true }).eq('id', utente.id)
    if (!error) caricaUtenti()
  }

  if (showNuovo) return <NuovoUtenteView onClose={() => setShowNuovo(false)} onSave={() => { caricaUtenti(); setShowNuovo(false) }} />
  if (editUtente) return <ModificaUtenteView utente={editUtente} onClose={() => setEditUtente(null)} onSave={() => { caricaUtenti(); setEditUtente(null) }} />
  if (showCategorie) return <GestioneCategorie onClose={() => setShowCategorie(false)} />
  if (showTemplateArticoli) return <GestioneTemplateArticoli onClose={() => setShowTemplateArticoli(false)} />

  return (
    <div className="gestione-container">
      <div className="gestione-header">
        <button className="btn-back" onClick={onClose}><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>Indietro</button>
        <h1 className="gestione-title">Gestione Utenti</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-nuovo" style={{ background: '#007AFF' }} onClick={() => setShowCategorie(true)}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
            Categorie
          </button>
          <button className="btn-nuovo" style={{ background: '#FF9500' }} onClick={() => setShowTemplateArticoli(true)}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            Template
          </button>
          <button className="btn-nuovo" onClick={() => setShowNuovo(true)}><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>Nuovo</button>
        </div>
      </div>
      <div className="divider"></div>
      <div className="gestione-content">
        {loading ? <div className="loading">Caricamento...</div> : (
          <div className="utenti-list">
            {utenti.map(utente => (
              <div key={utente.id} className="utente-row">
                <div className="utente-info">
                  <svg className="utente-icon" viewBox="0 0 24 24" fill="#007AFF"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-8 3-8 5v1h16v-1c0-2-2-5-8-5z"/></svg>
                  <div>
                    <div className="utente-nome">{utente.nome_completo}</div>
                    <div className="utente-username">@{utente.username}</div>
                  </div>
                </div>
                <div className="utente-ruolo">{utente.ruolo === 'admin' ? '🔑 Admin' : '✏️ Redattore'}</div>
                <div className="utente-password">
                  {utente.deve_cambiare_password ? (
                    <><svg className="status-icon" viewBox="0 0 24 24" fill="#FF9500"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>Password da cambiare</>
                  ) : (
                    <><svg className="status-icon" viewBox="0 0 24 24" fill="#34C759"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>Password impostata</>
                  )}
                </div>
                <div className="utente-actions">
                  <button className="btn-action btn-green" onClick={() => setEditUtente(utente)}><svg className="icon-small" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>Modifica</button>
                  <button className="btn-action btn-blue" onClick={() => cambiaRuolo(utente)}><svg className="icon-small" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>Cambia Ruolo</button>
                  <button className="btn-action btn-orange" onClick={() => resetPassword(utente)}><svg className="icon-small" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>Reset Password</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NuovoUtenteView({ onClose, onSave }) {
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [username, setUsername] = useState('')
  const [ruolo, setRuolo] = useState('redattore')
  const [error, setError] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!nomeCompleto || !username) {
      setError('Compila tutti i campi')
      return
    }
    try {
      const { error: insertError } = await supabase.from('utenti').insert([{ nome_completo: nomeCompleto, username: username, password: 'FWM2025APP!?!', ruolo: ruolo, deve_cambiare_password: true }])
      if (insertError) {
        setError('Errore: username già esistente')
        return
      }
      onSave()
    } catch (err) {
      setError('Errore durante il salvataggio')
    }
  }

  return (
    <div className="modal-container">
      <div className="modal-card">
        <div className="modal-header">
          <h2>➕ Nuovo Utente</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label">Ruolo</label>
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} className="form-input">
              <option value="redattore">Redattore</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-save">Salva</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModificaUtenteView({ utente, onClose, onSave }) {
  const [nomeCompleto, setNomeCompleto] = useState(utente.nome_completo)
  const [username, setUsername] = useState(utente.username)
  const [error, setError] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!nomeCompleto || !username) {
      setError('Compila tutti i campi')
      return
    }
    try {
      const { error: updateError } = await supabase.from('utenti').update({ nome_completo: nomeCompleto, username: username }).eq('id', utente.id)
      if (updateError) {
        setError('Errore durante il salvataggio')
        return
      }
      onSave()
    } catch (err) {
      setError('Errore durante il salvataggio')
    }
  }

  return (
    <div className="modal-container">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Modifica Utente</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="form-input" required />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-save">Salva</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App

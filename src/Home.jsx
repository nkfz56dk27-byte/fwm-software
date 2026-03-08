import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import CoppaSVG from "./assets/coppa.svg"
import FotoSVG from "./assets/foto.svg"
import DisponibilitàSVG from "./assets/disponibilità.svg"
import PressPNG from "./assets/press.png"
import CestinoSVG from "./assets/cestino.svg"
import CheckSVG from "./assets/check.svg"
import RitaglioImmagine from './RitaglioImmagine.jsx'
import CalendarioAccrediti from './CalendarioAccrediti'
import DisponibilitaWeekend from './DisponibilitaWeekend.jsx'
import GestioneCategorie from './GestioneCategorie.jsx'
import ProssimoEvento from './ProssimoEvento.jsx'
import { initializeOneSignal } from './src/onesignal.js'
import NotificationPrompt from './src/NotificationPrompt.jsx'
import './App.css'

function App() {
  // ✅ FIX 1: tutti gli useState dichiarati PRIMA degli useEffect che li usano
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [showGestione, setShowGestione] = useState(false)
  const [showClassificheMainMenu, setShowClassificheMainMenu] = useState(false)
  const [showClassificheMenu, setShowClassificheMenu] = useState(false)
  const [showClassifica, setShowClassifica] = useState(false)
  const [classificaId, setClassificaId] = useState(null)
  const [showNuovaPagina, setShowNuovaPagina] = useState(false)
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
  const [showDisponibilita, setShowDisponibilita] = useState(null)
  const [notificheNonLetteCalendario, setNotificheNonLetteCalendario] = useState(0)
  const [notificheNonLetteDisponibilita, setNotificheNonLetteDisponibilita] = useState(0)
  const [showNuovaSchermata, setShowNuovaSchermata] = useState(false)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const [showEnableNotificationsBtn, setShowEnableNotificationsBtn] = useState(false)

  // ✅ FIX 2: useEffect ora può accedere a user perché è dichiarato sopra
  useEffect(() => {
    if (user && user.username) {
      if (Notification && Notification.permission !== 'granted') {
        setShowEnableNotificationsBtn(true)
      }
    }
  }, [user])

  useEffect(() => {
    if (user && user.username) {
      const hasBeenAsked = localStorage.getItem('notificheAsked')
      if (!hasBeenAsked && Notification && Notification.permission === 'default') {
        setShowNotificationPrompt(true)
      }
    }
  }, [user])

  async function caricaNotificheCalendario(username) {
    try {
      const { data: notifiche } = await supabase.from('notifiche_calendario').select('id')
      const { data: lette } = await supabase.from('notifiche_lette').select('notifica_id').eq('username', username)
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      const nonLette = (notifiche || []).filter(n => !idsLette.has(n.id))
      setNotificheNonLetteCalendario(nonLette.length)
    } catch (e) {
      // errore silenzioso
    }
  }

  async function caricaNotificheDisponibilita(username) {
    try {
      const { data: notifiche } = await supabase.from('notifiche_disponibilita').select('id')
      const { data: lette } = await supabase.from('notifiche_disponibilita_lette').select('notifica_id').eq('username', username)
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      const nonLette = (notifiche || []).filter(n => !idsLette.has(n.id))
      setNotificheNonLetteDisponibilita(nonLette.length)
    } catch (e) {
      // errore silenzioso
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

  useEffect(() => {
    async function checkAndShowOneSignalPrompt() {
      if (user && user.username) {
        if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
          let isRegistered = false
          if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.PushSubscription) {
            const playerId = await window.OneSignal.User.PushSubscription.id
            isRegistered = !!playerId
          }
          if (!isRegistered && window.OneSignal && typeof window.OneSignal.showSlidedownPrompt === 'function') {
            window.OneSignal.showSlidedownPrompt()
          }
        }
      }
    }
    checkAndShowOneSignalPrompt()
  }, [user])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      })
      if (error || !data || !data.user) {
        setLoginError('Username o password non corretti')
        setLoading(false)
        return
      }
      const { data: utentiData, error: utentiError } = await supabase
        .from('utenti')
        .select('*')
        .eq('username', username)
        .limit(1)
      if (utentiError || !utentiData || utentiData.length === 0) {
        setLoginError('Utente non trovato')
        setLoading(false)
        return
      }
      setUser(utentiData[0])
      setMustChangePassword(utentiData[0].deve_cambiare_password)
      sessionStorage.setItem('username', username)
      localStorage.removeItem('notifichePrompted')
      setShowNotificationPrompt(true)
      setLoading(false)

      try {
        const { initializeOneSignal } = await import('./src/onesignal.js')
        await initializeOneSignal()
        if (window.OneSignal && typeof window.OneSignal.showSlidedownPrompt === 'function') {
          window.OneSignal.showSlidedownPrompt()
          await new Promise((resolve) => {
            const handler = async (isSubscribed) => {
              if (isSubscribed) {
                window.OneSignal.off && typeof window.OneSignal.off === 'function' && window.OneSignal.off('subscriptionChange', handler)
                resolve()
              }
            }
            const waitForOn = async () => {
              let tentativi = 0
              while (!(window.OneSignal && typeof window.OneSignal.on === 'function') && tentativi < 30) {
                await new Promise(r => setTimeout(r, 100))
                tentativi++
              }
              if (window.OneSignal && typeof window.OneSignal.on === 'function') {
                window.OneSignal.on('subscriptionChange', handler)
              } else {
                console.error('OneSignal.on non disponibile dopo 3 secondi!')
                resolve()
              }
            }
            waitForOn()
          })
        }
        import('./pushNotificationService').then(({ registraDispositivoNotifiche }) => {
          if (user && user.username) {
            registraDispositivoNotifiche(user.username)
          }
        })
      } catch (err) {
        console.error('Errore inizializzazione OneSignal dopo login:', err)
      }
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
    setShowClassificheMenu(false)
    setShowClassificheMainMenu(false)
    setShowNuovaPagina(false)
    localStorage.removeItem('notifichePrompted')
  }

  console.log('🔍 APP STATE:', { showClassificheMainMenu, showClassificheMenu, showClassifica, showNuovaPagina })

  if (!user) {
    return <LoginView username={username} setUsername={setUsername} password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} loginError={loginError} loading={loading} handleLogin={handleLogin} />
  }

  if (mustChangePassword) {
    return <PasswordChangeView newPassword={newPassword} setNewPassword={setNewPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showNewPassword={showNewPassword} setShowNewPassword={setShowNewPassword} showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} passwordError={passwordError} handlePasswordChange={handlePasswordChange} />
  }

  if (showGestione) {
    return <GestioneUtentiView onClose={() => setShowGestione(false)} />
  }

  if (showClassificheMainMenu) {
    return <ClassificheMainMenuView user={user} onBack={() => { setShowClassificheMainMenu(false); setShowClassificheMenu(false) }} onOpenClassificheMenu={() => { setShowClassificheMainMenu(false); setShowClassificheMenu(true) }} onOpenNuovaPagina={() => { setShowClassificheMainMenu(false); setShowNuovaPagina(true) }} />
  }

  if (showClassificheMenu) {
    return <ClassificheMenuView user={user} onBack={() => { setShowClassificheMenu(false); setShowClassificheMainMenu(true) }} onOpenClassifica={(id) => { setClassificaId(id); setShowClassifica(true); setShowClassificheMenu(false) }} />
  }

  if (showNuovaPagina) {
    return <NuovaPaginaView onClose={() => setShowNuovaPagina(false)} />
  }

  if (showClassifica) {
    return <ClassificaView classificaId={classificaId} user={user} onBack={() => { setShowClassifica(false); setShowClassificheMenu(true); setClassificaId(null) }} />
  }

  if (showRitaglioImmagine) {
    console.log('👁️ showRitaglioImmagine:', showRitaglioImmagine)
    return <RitaglioImmagine onClose={() => setShowRitaglioImmagine(false)} user={user} />
  }

  if (showCalendario) {
    return <CalendarioAccrediti utenteCorrente={user} onClose={() => setShowCalendario(false)} onNotificheChange={() => user && user.username && caricaNotificheCalendario(user.username)} />
  }

  if (showDisponibilita) {
    return <DisponibilitaWeekend categoria={showDisponibilita.categoria} utenteCorrente={user} onClose={() => setShowDisponibilita(null)} onNotificheChange={() => user && user.username && caricaNotificheDisponibilita(user.username)} />
  }

  if (showNuovaSchermata) {
    return <NuovaSchermataBianca onClose={() => setShowNuovaSchermata(false)} />
  }

  return (
    <>
      <HomeView user={user} onLogout={handleLogout} onOpenGestione={() => setShowGestione(true)} onOpenClassificheMainMenu={() => setShowClassificheMainMenu(true)} onOpenRitaglio={() => setShowRitaglioImmagine(true)} onOpenCalendario={() => setShowCalendario(true)} onOpenDisponibilita={(categoria) => setShowDisponibilita({ categoria })} notificheNonLetteCalendario={notificheNonLetteCalendario} notificheNonLetteDisponibilita={notificheNonLetteDisponibilita} onOpenNuovaSchermata={() => setShowNuovaSchermata(true)} />
    </>
  )
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
      console.log('📖 Caricando classificazione con ID:', classificaId)
      const { data, error } = await supabase.from('classifiche').select('*').eq('id', classificaId)
      console.log('📖 Dati ricevuti dal database:', data)
      console.log('📖 Errore:', error)

      if (!error && data && data.length > 0) {
        const classifica = data[0]
        console.log('📖 Classificazione caricata:', classifica.nome)
        setClassifica(classifica)

        if (!classifica.piloti || classifica.piloti.length === 0) {
          console.warn('⚠️ Piloti vuoti o mancanti, mostro setup')
          setShowSetup(true)
        } else {
          console.log('✅ Classificazione completa, nascondo setup')
          setShowSetup(false)
        }
      } else {
        console.error('❌ Errore caricaClassifica:', error)
      }
      setLoading(false)
    } catch (err) {
      console.error('❌ Exception in caricaClassifica:', err)
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

      console.log('💾 Salvando classificazione:', updateObj)
      const { error } = await supabase.from('classifiche').update(updateObj).eq('id', classificaId)
      if (!error) {
        console.log('✅ Classificazione salvata con successo')
        setClassifica(nuovaClassifica)
        setShowSetup(false)

        const { data: verifyData, error: verifyError } = await supabase
          .from('classifiche')
          .select('piloti, gp')
          .eq('id', classificaId)

        if (verifyError) {
          console.error('❌ Errore verifica salvataggio:', verifyError)
        } else if (verifyData && verifyData.length > 0) {
          console.log('✅ Dati verificati nel database - Piloti:', verifyData[0].piloti?.length, 'GP:', verifyData[0].gp?.length)
        }
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
              <div key={gp.id} style={{ background: 'white', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div
                  onClick={() => setExpandedGP(prev => ({ ...prev, [gp.id]: !prev[gp.id] }))}
                  style={{ padding: '15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                >
                  <span style={{ fontWeight: '600', fontSize: '16px' }}>
                    {gp.tipo_weekend === 'sprintF1' ? '⚡️' : gp.tipo_weekend === 'f2' ? '🏎️' : '🏆'} {gp.nome}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setGpSelezionato(gp); setShowInserimentoGP(true) }}
                      style={{ background: '#FF3B30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '5px 8px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                      title="Modifica risultati"
                    >
                      MODIFICA
                    </button>
                    <span>{expandedGP[gp.id] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expandedGP[gp.id] && gp.gare && gp.gare
                  .filter(g => g.completata)
                  .map(gara => (
                    <div key={gara.id} style={{ padding: '15px', borderTop: gp.tipo_weekend === 'sprintF1' ? '1px solid #eee' : 'none', background: gp.tipo_weekend === 'sprintF1' ? '#f9f9f9' : 'white' }}>
                      {Object.entries(gara.risultati || {})
                        .sort((a, b) => Number(a[1]) - Number(b[1]))
                        .filter(([pilotaId, posizione]) => {
                          const puntiBase = calcolaPuntiPosizione(Number(posizione), gara.tipo_gara, classifica)
                          return puntiBase > 0
                        })
                        .map(([pilotaId, posizione]) => {
                          const pilota = classifica.piloti.find(p => String(p.id) === String(pilotaId))
                          if (!pilota) return null
                          const puntiBase = calcolaPuntiPosizione(Number(posizione), gara.tipo_gara, classifica)
                          let desc = `${puntiBase} pts`
                          if (classifica.punti_pole_attivo && gara.pole_id === pilotaId) desc += ` +P${classifica.punti_pole_valore}`
                          if (classifica.giro_veloce_attivo && gara.giro_veloce_id === pilotaId) desc += ` +FL${classifica.giro_veloce_valore}`
                          return (
                            <div key={pilotaId} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                              <span>{posizione}° {pilota.nome}</span>
                              <span>{desc}</span>
                            </div>
                          )
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

        {/* ✅ FIX 3: era testo plain nel JSX, ora è un commento corretto */}
        {/* BOTTONE INDIETRO CLASSIFICA */}
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

  const puntiDaGP = gpRimanenti * 25
  const puntiDaSprint = sprintRimanenti * 8
  let bonusPossibili = 0
  if (classifica.punti_pole_attivo) bonusPossibili += gpRimanenti * (classifica.punti_pole_valore || 3)
  if (classifica.giro_veloce_attivo) bonusPossibili += gpRimanenti * (classifica.giro_veloce_valore || 1)
  const puntiMassimi = (pilota.punti || 0) + puntiDaGP + puntiDaSprint + bonusPossibili

  if (puntiMassimi < (leader.punti || 0) && String(pilota.id) !== String(leader.id)) {
    return []
  }

  if (String(pilota.id) === String(leader.id) && (pilota.punti || 0) > (secondo.punti || 0) + puntiDaGP + puntiDaSprint + bonusPossibili) {
    combinazioni.push('🏆 Già campione matematico!')
    return combinazioni
  }

  const rivale = String(pilota.id) === String(leader.id) ? secondo : leader
  const differenzaPunti = (rivale.punti || 0) - (pilota.punti || 0)
  const puntiPerPosizione = (classifica && classifica.usa_modificatore_libero && Array.isArray(classifica.modificatore_libero_punti) && classifica.modificatore_libero_punti.length > 0)
    ? classifica.modificatore_libero_punti
    : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

  if (gpRimanenti > 0) {
    const vittorieNecessarie = Math.max(1, Math.ceil(differenzaPunti / 25))
    if (vittorieNecessarie <= gpRimanenti) {
      combinazioni.push(`${pilota.nome} vince ${vittorieNecessarie} gare + ${rivale.nome} fuori dal podio`)
    }
  }

  let contatore = 0
  for (let posPilota = 1; posPilota <= 5 && contatore < 9; posPilota++) {
    const puntiPilotaPerGara = puntiPerPosizione[posPilota - 1]
    for (let posRivale = Math.max(posPilota + 1, 1); posRivale <= 10 && contatore < 9; posRivale++) {
      const puntiRivalePerGara = posRivale <= puntiPerPosizione.length ? puntiPerPosizione[posRivale - 1] : 0
      const differenzaPerGara = puntiPilotaPerGara - puntiRivalePerGara
      if (differenzaPerGara > 0) {
        const gareNecessarie = Math.ceil(Math.abs(differenzaPunti) / differenzaPerGara)
        if (gareNecessarie > 0 && gareNecessarie <= gpRimanenti) {
          combinazioni.push(`${pilota.nome} ${posPilota}° + ${rivale.nome} ${posRivale > 10 ? 'fuori dai punti' : `${posRivale}° o peggio`} per ${gareNecessarie} gare`)
          contatore++
        }
      }
    }
  }

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
          combinazioni.unshift(`🏁 A ${nomeGP}: ${pilota.nome} ${posPilota}° + ${rivale.nome} ${posRivale > 10 ? 'fuori punti' : `${posRivale}° o peggio`} = CAMPIONE!`)
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
  const [showGaraAccorciata, setShowGaraAccorciata] = useState(false)
  const [percentualeAccorciata, setPercentualeAccorciata] = useState(75)
  const [overrideNumPiloti, setOverrideNumPiloti] = useState(10)
  const [overridePunti, setOverridePunti] = useState('25,18,15,12,10,8,6,4,2,1')

  useEffect(() => {
    if (gpPreselezionato && gpPreselezionato.completato && gp && gp.gare[garaCorrente]) {
      const garaAttuale = gp.gare[garaCorrente]
      setRisultati(garaAttuale.risultati || {})
      setPoleId(garaAttuale.pole_id || null)
      setGiroVeloceId(garaAttuale.giro_veloce_id || null)
      console.log('Caricati risultati precedenti:', garaAttuale.risultati)
    }
  }, [gpPreselezionato, garaCorrente, gp])

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

  const calcolaPuntiAccorciati = (pos, percentuale) => {
    if (percentuale === 25) {
      const punti = [6, 4, 3, 2, 1]
      return pos <= punti.length ? punti[pos - 1] : 0
    } else if (percentuale === 50) {
      const punti = [13, 10, 8, 6, 5, 4, 3, 2, 1]
      return pos <= punti.length ? punti[pos - 1] : 0
    } else if (percentuale === 75) {
      const punti = [19, 14, 12, 10, 8, 6, 4, 3, 2, 1]
      return pos <= punti.length ? punti[pos - 1] : 0
    }
    return 0
  }

  // ✅ FIX 4: funzione garaNoNDispudata aggiunta (era chiamata nel JSX ma non definita)
  const garaNoNDispudata = () => {
    const gare = [...gp.gare]
    gare[garaCorrente] = {
      ...gare[garaCorrente],
      risultati: {},
      completata: true,
      non_disputata: true
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
      const nuoviGP = classifica.gp
        ? [...classifica.gp.filter(g => g.id !== gpFinale.id), gpFinale]
        : [gpFinale]
      onSave({ ...classifica, gp: nuoviGP, piloti: [...classifica.piloti], costruttori: [...classifica.costruttori] })
      onClose()
    }
  }

  const garaAccorciata = () => {
    const gare = [...gp.gare]
    gare[garaCorrente] = {
      ...gare[garaCorrente],
      risultati,
      pole_id: poleId,
      giro_veloce_id: giroVeloceId,
      completata: true,
      accorciata: true,
      percentuale_accorciata: percentualeAccorciata
    }
    const gpAggiornato = { ...gp, gare }

    if (garaCorrente < gp.gare.length - 1) {
      setGp(gpAggiornato)
      setGaraCorrente(garaCorrente + 1)
      setRisultati({})
      setPoleId(null)
      setGiroVeloceId(null)
      setShowGaraAccorciata(false)
    } else {
      const gpFinale = { ...gpAggiornato, completato: true }
      const nuoviGP = classifica.gp ? [...classifica.gp.filter(g => g.id !== gpFinale.id), gpFinale] : [gpFinale]
      const nuoviPiloti = [...classifica.piloti]
      const nuoviCostruttori = [...classifica.costruttori]

      if (gpPreselezionato && gpPreselezionato.completato) {
        gpPreselezionato.gare.forEach(garaVecchia => {
          if (!garaVecchia.completata || garaVecchia.non_disputata) return
          Object.entries(garaVecchia.risultati || {}).forEach(([pilotaId, pos]) => {
            const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId))
            if (!pilota) return
            let punti = garaVecchia.accorciata
              ? calcolaPuntiAccorciati(pos, garaVecchia.percentuale_accorciata)
              : calcolaPuntiPosizione(pos, garaVecchia.tipo_gara, classifica)
            if (classifica.punti_pole_attivo && String(garaVecchia.pole_id) === String(pilotaId)) punti += classifica.punti_pole_valore || 3
            if (classifica.giro_veloce_attivo && String(garaVecchia.giro_veloce_id) === String(pilotaId)) punti += classifica.giro_veloce_valore || 1
            pilota.punti = Math.max(0, (pilota.punti || 0) - punti)
            const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team)
            if (costruttore) costruttore.punti = Math.max(0, (costruttore.punti || 0) - punti)
          })
        })
      }

      gpFinale.gare.forEach(gara => {
        Object.entries(gara.risultati).forEach(([pilotaId, pos]) => {
          const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId))
          if (!pilota) return
          let punti = gara.accorciata
            ? calcolaPuntiAccorciati(pos, gara.percentuale_accorciata)
            : calcolaPuntiPosizione(pos, gara.tipo_gara, classifica)
          if (classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId)) punti += classifica.punti_pole_valore || 3
          if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId)) punti += classifica.giro_veloce_valore || 1
          pilota.punti = (pilota.punti || 0) + punti
          const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team)
          if (costruttore) costruttore.punti = (costruttore.punti || 0) + punti
        })
      })

      nuoviPiloti.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((p, i) => {
        p.distacco = i === 0 ? 0 : (nuoviPiloti[0].punti || 0) - (p.punti || 0)
      })
      nuoviCostruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((c, i) => {
        c.distacco = i === 0 ? 0 : (nuoviCostruttori[0].punti || 0) - (c.punti || 0)
      })

      onSave({ ...classifica, gp: nuoviGP, piloti: nuoviPiloti, costruttori: nuoviCostruttori })
      onClose()
    }
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

      if (gpPreselezionato && gpPreselezionato.completato) {
        console.log('MODIFICA: Sottraggo punti vecchi...')
        gpPreselezionato.gare.forEach(garaVecchia => {
          if (!garaVecchia.completata || garaVecchia.non_disputata) return
          Object.entries(garaVecchia.risultati || {}).forEach(([pilotaId, pos]) => {
            const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId))
            if (!pilota) return
            let punti = calcolaPuntiPosizione(pos, garaVecchia.tipo_gara, classifica)
            if (classifica.punti_pole_attivo && String(garaVecchia.pole_id) === String(pilotaId)) punti += classifica.punti_pole_valore || 3
            if (classifica.giro_veloce_attivo && String(garaVecchia.giro_veloce_id) === String(pilotaId)) punti += classifica.giro_veloce_valore || 1
            pilota.punti = Math.max(0, (pilota.punti || 0) - punti)
            const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team)
            if (costruttore) costruttore.punti = Math.max(0, (costruttore.punti || 0) - punti)
          })
        })
      }

      gpFinale.gare.forEach(gara => {
        Object.entries(gara.risultati).forEach(([pilotaId, pos]) => {
          const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId))
          if (!pilota) { console.warn('Pilota non trovato:', pilotaId); return }
          let punti = calcolaPuntiPosizione(pos, gara.tipo_gara, classifica)
          if (classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId)) punti += classifica.punti_pole_valore || 3
          if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId)) punti += classifica.giro_veloce_valore || 1
          console.log(`${pilota.nome}: +${punti} pts (pos ${pos}, tipo ${gara.tipo_gara})`)
          pilota.punti = (pilota.punti || 0) + punti
          const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team)
          if (costruttore) costruttore.punti = (costruttore.punti || 0) + punti
          else console.warn('Costruttore non trovato:', pilota.team)
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

  // ✅ FIX 5: return chiude con </> correttamente (prima chiudeva con </div>)
  // ✅ FIX 5b: rimossi step 1 e step 2 copiati per errore da SetupIniziale
  //            (usavano numeroGP, numeroSprint, confermaESalva non definiti qui)
  return (
    <>
      <div style={{ margin: '24px 0', padding: '16px', background: '#f3f4f6', borderRadius: '8px', border: '1px solid #ddd' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#e11d48', fontSize: '16px' }}>Override punti manuale (eccezionale)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 14 }}>
            Numero piloti che prendono punti:
            <input type="number" min="1" max={classifica?.piloti?.length || 99} value={overrideNumPiloti} onChange={e => setOverrideNumPiloti(Number(e.target.value))} style={{ marginLeft: 8, width: 60, padding: 4, fontSize: 14 }} />
          </label>
          <label style={{ fontSize: 14 }}>
            Punti per posizione (separati da virgola):
            <input type="text" value={overridePunti} onChange={e => setOverridePunti(e.target.value)} style={{ marginLeft: 8, width: 220, padding: 4, fontSize: 14 }} />
          </label>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Esempio: 25,18,15,12,10,8,6,4,2,1</div>
        </div>
      </div>

      {/* Step 0: Crea nuovo GP */}
      <div style={{ display: step === 0 ? 'block' : 'none', padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px' }}>
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

      {/* Step 1: Inserimento risultati gara */}
      {step === 1 && gp && (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Indietro</button>
          <h1 style={{ fontSize: '28px', marginBottom: '10px', textAlign: 'center' }}>{gp.nome}</h1>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
            {gp.gare[garaCorrente]?.tipo_gara === 'sprint' ? '⚡️ Sprint Race' :
             gp.gare[garaCorrente]?.tipo_gara === 'f2sprint' ? '🏎️ Sprint Race F2' :
             gp.gare[garaCorrente]?.tipo_gara === 'featureRace' ? '🏎️ Feature Race F2' :
             '🏆 Gara Principale'}
            {gp.gare.length > 1 ? ` (${garaCorrente + 1}/${gp.gare.length})` : ''}
          </p>

          {classifica.piloti && classifica.piloti.filter(p => p.attivo).map((pilota) => (
            <div key={pilota.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              <div style={{ width: '8px', height: '30px', background: pilota.colore || '#007AFF', borderRadius: '3px' }}></div>
              <div style={{ flex: 1, fontWeight: '600' }}>{pilota.nome}</div>
              <input
                type="number"
                min="1"
                max={classifica.piloti.length}
                placeholder="Pos."
                value={risultati[pilota.id] || ''}
                onChange={(e) => setRisultati(prev => ({ ...prev, [pilota.id]: e.target.value ? parseInt(e.target.value) : undefined }))}
                style={{ width: '70px', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '16px', textAlign: 'center' }}
              />
            </div>
          ))}

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <button onClick={salvaRisultatiGara} style={{ width: '100%', padding: '15px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
              {garaCorrente < gp.gare.length - 1 ? 'Avanti →' : '✅ Salva risultati'}
            </button>
            <button onClick={() => setShowGaraAccorciata(true)} style={{ width: '100%', padding: '12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '15px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              ⚠️ Gara accorciata
            </button>
            <button onClick={garaNoNDispudata} style={{ width: '100%', padding: '12px', background: '#8E8E93', color: 'white', border: 'none', borderRadius: '15px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              ❌ Gara non disputata
            </button>
          </div>

          {showGaraAccorciata && (
            <div style={{ marginTop: '20px', padding: '20px', background: '#FFF3CD', borderRadius: '10px', border: '1px solid #FF9500' }}>
              <h3 style={{ color: '#FF9500', marginBottom: '15px' }}>Percentuale completamento gara</h3>
              {[25, 50, 75].map(pct => (
                <button key={pct} onClick={() => setPercentualeAccorciata(pct)} style={{ margin: '5px', padding: '10px 20px', background: percentualeAccorciata === pct ? '#FF9500' : 'white', color: percentualeAccorciata === pct ? 'white' : '#FF9500', border: '2px solid #FF9500', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {pct}%
                </button>
              ))}
              <button onClick={garaAccorciata} style={{ display: 'block', width: '100%', marginTop: '15px', padding: '12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                Conferma gara accorciata al {percentualeAccorciata}%
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ===== MENU CLASSIFICHE =====
// ✅ FIX 6: rimosso codice GestioneUtentiView incollato per errore,
//           rimossa handlePasswordChangeAdmin (usava setActionLoading/caricaUtenti non definiti),
//           sostituito onClose con onBack coerente con le props
function ClassificheMenuView({ user, onBack, onOpenClassifica }) {
  const [classifiche, setClassifiche] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalitaElimina, setModalitaElimina] = useState(false)
  const [showNuova, setShowNuova] = useState(false)

  const isAdmin = user.ruolo === 'admin'

  useEffect(() => {
    document.title = "FWM - Classifiche"
  }, [])

  useEffect(() => { caricaClassifiche() }, [])

  const caricaClassifiche = async () => {
    try {
      const { data, error } = await supabase.from('classifiche').select('*')
      if (!error && data) {
        const ordinato = [...data].sort((a, b) => {
          if (a.nome < b.nome) return -1
          if (a.nome > b.nome) return 1
          return a.id - b.id
        })
        setClassifiche(ordinato)
      }
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  const eliminaClassifica = async (id) => {
    if (!confirm('Eliminare questa classifica? Questa azione non può essere annullata.')) return
    const { error } = await supabase.from('classifiche').delete().eq('id', id)
    if (error) {
      alert('Errore eliminazione: ' + JSON.stringify(error))
      console.error('Supabase error eliminaClassifica:', error)
    } else {
      caricaClassifiche()
      setModalitaElimina(false)
    }
  }

  const creaNuovaClassifica = async () => {
    const nome = prompt('Nome della nuova classifica:')
    if (!nome) return
    const { data, error } = await supabase.from('classifiche').insert([{ nome, piloti: [], costruttori: [], gp: [] }]).select()
    if (!error && data && data.length > 0) {
      caricaClassifiche()
    } else {
      alert('Errore creazione classifica: ' + JSON.stringify(error))
    }
  }

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#f5f5f7', padding: '20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', padding: '20px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, flex: 1 }}>Classifiche</h1>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setModalitaElimina(!modalitaElimina)}
                style={{ padding: '8px 16px', background: modalitaElimina ? '#FF3B30' : '#f0f0f0', color: modalitaElimina ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
              >
                {modalitaElimina ? '✕ Annulla' : '🗑️ Elimina'}
              </button>
              <button
                onClick={creaNuovaClassifica}
                style={{ padding: '8px 16px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
              >
                + Nuova
              </button>
            </div>
          )}
        </div>

        {/* Lista classifiche */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Caricamento...</div>
        ) : classifiche.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nessuna classifica trovata</div>
        ) : (
          classifiche.map(cl => (
            <div
              key={cl.id}
              onClick={() => !modalitaElimina && onOpenClassifica(cl.id)}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '18px 20px',
                marginBottom: '12px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                cursor: modalitaElimina ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                border: modalitaElimina ? '2px solid #FF3B30' : '2px solid transparent',
                transition: 'border 0.2s'
              }}
            >
              <div>
                <div style={{ fontWeight: '700', fontSize: '18px' }}>{cl.nome}</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '2px' }}>
                  {(cl.piloti || []).length} piloti · {(cl.gp || []).filter(g => g.completato).length} GP completati
                </div>
              </div>
              {modalitaElimina ? (
                <button
                  onClick={(e) => { e.stopPropagation(); eliminaClassifica(cl.id) }}
                  style={{ padding: '8px 14px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                >
                  Elimina
                </button>
              ) : (
                <span style={{ color: '#ccc', fontSize: '20px' }}>›</span>
              )}
            </div>
          ))
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

// ===== CLASSIFICHE MAIN MENU =====
function ClassificheMainMenuView({ user, onBack, onOpenClassificheMenu, onOpenNuovaPagina }) {
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="header-left">
          <button className="btn-header" onClick={onBack}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L10.83 12z"/>
            </svg>
            Indietro
          </button>
        </div>
        <div className="header-right"></div>
      </div>

      <div className="home-title">
        <h1 className="title-main">Classifiche</h1>
      </div>

      <div className="home-cards-wrapper">
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', paddingTop: '40px' }}>
          <div className="home-card card-blue" onClick={onOpenClassificheMenu} style={{ cursor: 'pointer', width: '300px' }}>
            <div className="card-icon-wrapper">
              <img src={CoppaSVG} alt="Classifiche" style={{ width: "80px", height: "60px", filter: "brightness(0) invert(1)" }} />
            </div>
            <h3 className="card-title">CLASSIFICHE</h3>
            <p className="card-subtitle">{user.ruolo === 'admin' ? 'Gestisci campionati\ne classifiche' : 'Visualizza\nclassifiche'}</p>
          </div>

          <div className="home-card card-green" onClick={onOpenNuovaPagina} style={{ cursor: 'pointer', width: '300px' }}>
            <div className="card-icon-wrapper">
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor" style={{ width: "80px", height: "60px" }}>
                <path d="M19 13h-6v6h-2v-6H5v-2h6V7h2v6h6v2z"/>
              </svg>
            </div>
            <h3 className="card-title">NUOVA OPZIONE</h3>
            <p className="card-subtitle">Accedi alla nuova<br />funzionalità</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== NUOVA PAGINA VIEW =====
function NuovaPaginaView({ onClose }) {
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="header-left">
          <button className="btn-header" onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L10.83 12z"/>
            </svg>
            Indietro
          </button>
        </div>
        <div className="header-right"></div>
      </div>
      <div className="home-title">
        <h1 className="title-main">Nuova Pagina</h1>
      </div>
      <div className="home-cards-wrapper">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>Questa è la nuova pagina che dobbiamo creare.</p>
          <p style={{ fontSize: '14px', color: '#999', marginTop: '20px' }}>Aggiungi qui il contenuto che desideri...</p>
        </div>
      </div>
    </div>
  )
}

// ===== NUOVA SCHERMATA BIANCA =====
function NuovaSchermataBianca({ onClose }) {
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="header-left">
          <button className="btn-header" onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L10.83 12z"/>
            </svg>
            Indietro
          </button>
        </div>
        <div className="header-right"></div>
      </div>
      <div className="home-title">
        <h1 className="title-main">Nuova Schermata</h1>
      </div>
      <div className="home-cards-wrapper">
        <div style={{ padding: '60px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>Schermata pronta per essere popolata 🎯</p>
          <p style={{ fontSize: '14px', color: '#999', marginTop: '20px' }}>Cosa vuoi aggiungere qui?</p>
        </div>
      </div>
      <div className="home-footer">
        <p className="version-text">Versione 2.0</p>
      </div>
    </div>
  )
}

export default App

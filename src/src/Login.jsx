import { useState } from 'react'
import { supabase } from './supabaseClient.js'
import { getFirebaseToken } from '../../firebaseMessaging'

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    console.log('[DEBUG LOGIN] Inizio handleLogin')

    try {
      // Verifica che localStorage sia disponibile
      if (typeof window !== 'undefined' && !window.localStorage) {
        throw new Error('LocalStorage non disponibile. Controlla le impostazioni di Safari.')
      }

      // 1. Cerca l'email associata all'username
      const { data: userData, error: userError } = await supabase
        .from('utenti')
        .select('email')
        .eq('username', username)
        .single()
      console.log('[DEBUG LOGIN] userData:', userData, 'userError:', userError)

      if (userError || !userData?.email) {
        setError('Username o password errati')
        setLoading(false)
        console.log('[DEBUG LOGIN] Errore lookup email')
        return
      }

      // 2. Login con Supabase Auth usando email trovata
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password
      })
      console.log('[DEBUG LOGIN] Risultato signInWithPassword:', { data, error })

      if (error) {
        console.error('Supabase Auth error:', error)
        if (error.message?.toLowerCase().includes('invalid login')) {
          setError('Username o password errati')
        } else {
          setError(`Errore: ${error.message || 'Errore durante il login'}`)
        }
        setLoading(false)
        return
      }

      if (!data?.user) {
        setError('Username o password errati')
        setLoading(false)
        console.log('[DEBUG LOGIN] Nessun user dopo signInWithPassword')
        return
      }

      // Salva l'username per tracking notifiche
      sessionStorage.setItem('username', username)
      console.log('[DEBUG LOGIN] Username salvato in sessionStorage')

      // Logga la sessione utente Supabase per debug
      const sessionResult = await supabase.auth.getSession();
      console.log('[DEBUG LOGIN] Supabase session dopo login:', sessionResult)

      // Chiama onLoginSuccess PRIMA di salvare il token, così la sessione è attiva
      onLoginSuccess(data.user)
      console.log('[DEBUG LOGIN] onLoginSuccess chiamato')

      // Attendi che la sessione sia valida prima di salvare il token
      const waitForSession = async () => {
        let tries = 0;
        let session = null;
        while (tries < 10) {
          const sessionResult = await supabase.auth.getSession();
          session = sessionResult?.data?.session;
          console.log(`[DEBUG LOGIN] Tentativo attesa sessione #${tries+1}:`, sessionResult)
          if (session && session.user && session.user.id) {
            break;
          }
          await new Promise(res => setTimeout(res, 300));
          tries++;
        }
        if (session && session.user && session.user.id) {
          console.log('[DEBUG LOGIN] Sessione valida trovata, salvo token')
          await getFirebaseToken(username);
        } else {
          console.warn('[DEBUG LOGIN] Nessuna sessione valida dopo il login, token NON salvato');
        }
      };
      waitForSession();
    } catch (err) {
      console.error('Login error:', err)
      if (err.message?.includes('localStorage')) {
        setError('LocalStorage non disponibile. Abilita i cookie di terze parti in Safari > Preferenze > Privacy.')
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Errore di rete. Verifica la connessione e le impostazioni CORS.')
      } else {
        setError('Errore di connessione. Riprova più tardi.')
      }
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '400px',
        maxWidth: '90%'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
          FWM Classifiche
        </h1>
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              marginBottom: '20px',
              color: '#c00'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: (loading || !username.trim() || !password.trim()) ? 0.6 : 1,
              pointerEvents: (loading || !username.trim() || !password.trim()) ? 'none' : 'auto'
            }}
          >
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login

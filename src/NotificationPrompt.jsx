import { useState } from 'react'
import { registraDispositivoNotifiche } from './pushNotificationService'
import { initializeNativeNotifications } from './nativeNotificationHandler'

export default function NotificationPrompt({ username, onClose }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleEnable = async () => {
    setLoading(true)
    setMessage('Richiedo autorizzazione...')

    try {
      // Richiedi il permesso per le notifiche
      if (!('Notification' in window)) {
        setMessage('❌ Le notifiche non sono supportate dal tuo browser')
        setLoading(false)
        return
      }

      if (Notification.permission === 'denied') {
        setMessage('❌ Hai già rifiutato le notifiche. Controlla le impostazioni del browser.')
        setLoading(false)
        return
      }

      // Inizializza le notifiche native (iOS/Android)
      setMessage('🔧 Configurazione notifiche per il tuo dispositivo...')
      const nativeInitSuccess = await initializeNativeNotifications(username)

      if (!nativeInitSuccess) {
        setMessage('⚠️ Notifiche non completamente supportate, continuo comunque...')
      }

      // Registra il dispositivo per ricevere notifiche via Supabase
      setMessage('✅ Registrazione dispositivo...')
      const success = await registraDispositivoNotifiche(username)

      if (success) {
        setMessage('✅ Dispositivo registrato! Riceverai notifiche push.')
        console.log('✅ Notifiche completamente configurate per:', username)
        
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setMessage('❌ Errore nella registrazione del dispositivo. Prova più tardi.')
      }
    } catch (error) {
      console.error('Errore:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
        zIndex: 1000,
        maxWidth: '400px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>🔔 Notifiche Push</h2>
      
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Attiva le notifiche per ricevere gli aggiornamenti quando non sei sull'app, anche in background.
      </p>

      {message && (
        <div
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: message.startsWith('✅') ? '#d4edda' : 
                              message.startsWith('❌') ? '#f8d7da' : '#e2e3e5',
            borderRadius: '5px',
            color: message.startsWith('✅') ? '#155724' : 
                   message.startsWith('❌') ? '#721c24' : '#383d41',
            fontSize: '14px'
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {loading ? '⏳ Caricamento...' : '✅ Abilita Notifiche'}
        </button>
        
        <button
          onClick={onClose}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontSize: '14px'
          }}
        >
          Più Tardi
        </button>
      </div>
    </div>
  )
}


import { useState } from 'react'
import { richiediPermessoNotifiche, setUserTags, getPlayerId } from './onesignal'
import { saveCurrentDevice, updatePlayerIdWhenReady } from './deviceManager'

export default function NotificationPrompt({ username, onClose }) {
  const [loading, setLoading] = useState(false)

  async function handleAccetta() {
    console.log('🚀 Inizio attivazione notifiche...')
    setLoading(true)
    
    try {
      // Richiedi permesso OneSignal (triggerà il prompt nativo)
      console.log('🔔 Richiesta permesso notifiche OneSignal...')
      const granted = await richiediPermessoNotifiche()
      
      if (granted) {
        console.log('✅ Permesso concesso!')
        
        // Aspetta 3 secondi per dare tempo a OneSignal di generare player_id
        console.log('⏳ Attendo generazione player_id...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Ottieni Player ID OneSignal
        console.log('🔍 Recupero Player ID OneSignal...')
        const playerId = await getPlayerId()
        console.log('📱 Player ID ottenuto:', playerId)
        
        // Salva dispositivo su Supabase (anche se player_id è null inizialmente)
        console.log('💾 Salvo dispositivo su Supabase...')
        const saved = await saveCurrentDevice(username, playerId)
        
        if (saved) {
          console.log('✅ Dispositivo salvato su Supabase!')
        }
        
        // SEMPRE avvia background update (importante per iOS)
        console.log('🔄 Avvio background check Player ID (30 secondi)...')
        updatePlayerIdWhenReady(username).then((updated) => {
          if (updated) {
            console.log('✅ Background: Player ID aggiornato!')
          } else {
            console.log('⚠️ Background: Player ID non disponibile dopo 30s')
          }
        })
        
        // Imposta tag OneSignal per targeting
        try {
          await setUserTags({ 
            username: username,
            ruolo: 'redattore'
          })
          console.log('✅ Tag OneSignal impostati per utente:', username)
        } catch (tagError) {
          console.log('ℹ️ Tag OneSignal non impostati:', tagError.message)
        }
        
        // Salva su localStorage
        localStorage.setItem('notificationPromptShown', 'true')
        
        console.log('✅ Attivazione completata!')
        
        // Chiudi il popup
        onClose()
      } else {
        console.warn('❌ Permesso notifiche negato')
        onClose()
      }
      
    } catch (error) {
      console.error('❌ Errore durante attivazione notifiche:', error)
      onClose()
    }
    
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'white',
      borderRadius: '15px',
      padding: '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxWidth: '350px',
      zIndex: 10000
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
        <div style={{ fontSize: '32px' }}>🔔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            Attiva le notifiche
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            Ricevi avvisi quando vengono creati nuovi eventi o modificati i pass disponibili, anche a sito chiuso.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleAccetta}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                background: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              {loading ? 'Attivazione...' : 'Attiva'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 15px',
                background: '#f0f0f0',
                color: '#666',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Dopo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

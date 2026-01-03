import { useState } from 'react'
import { richiediPermessoNotifiche, setUserTags, getPlayerId } from './onesignal'
import { saveCurrentDevice, updatePlayerIdWhenReady } from './deviceManager'

export default function NotificationPrompt({ username, onClose }) {
  const [loading, setLoading] = useState(false)

  async function handleAccetta() {
    console.log('🚀 Inizio attivazione notifiche...')
    setLoading(true)
    
    try {
      // Richiedi permesso OneSignal
      console.log('🔔 Richiesta permesso notifiche OneSignal...')
      const granted = await richiediPermessoNotifiche()
      
      if (granted) {
        console.log('✅ Permesso concesso!')
        
        // Ottieni Player ID OneSignal
        console.log('🔍 Recupero Player ID OneSignal...')
        const playerId = await getPlayerId()
        console.log('📱 Player ID ottenuto:', playerId)
        
        // Salva dispositivo su Supabase con player_id (anche se null)
        console.log('💾 Salvo dispositivo su Supabase...')
        const saved = await saveCurrentDevice(username, playerId)
        
        if (saved) {
          console.log('✅ Dispositivo salvato su Supabase!')
          
          // SEMPRE avvia background update per iOS/Safari
          console.log('🔄 Avvio background check Player ID...')
          updatePlayerIdWhenReady(username).then((updated) => {
            if (updated) {
              console.log('✅ Background: Player ID aggiornato!')
            } else {
              console.log('⚠️ Background: Player ID non disponibile')
            }
          })
        } else {
          console.warn('⚠️ Errore salvataggio dispositivo')
        }
        
        // Imposta tag OneSignal per targeting
        try {
          await setUserTags({ 
            username: username,
            ruolo: 'redattore'
          })
          console.log('✅ Tag OneSignal impostati per utente:', username)
        } catch (tagError) {
          console.error('❌ Errore impostazione tag OneSignal:', tagError)
        }
        
        // Salva su localStorage
        localStorage.setItem('notificationPromptShown', 'true')
        
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

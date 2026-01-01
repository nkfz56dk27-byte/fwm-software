import { useState } from 'react'
import { richiediPermessoNotifiche, setUserTags, getPlayerId } from './onesignal'
import { supabase } from './supabaseClient'

export default function NotificationPrompt({ username, onClose }) {
  const [loading, setLoading] = useState(false)

  async function handleAccetta() {
    console.log('🚀 Inizio attivazione notifiche...')
    setLoading(true)
    
    try {
      // Richiedi permesso OneSignal
      console.log('📤 Richiesta permesso notifiche...')
      const granted = await richiediPermessoNotifiche()
      console.log('📋 Risposta permesso:', granted)
      
      if (granted) {
        console.log('✅ Permesso concesso, impostazione tag...')
        // Imposta tag utente per targeting specifico
        await setUserTags({
          username: username,
          ruolo: 'redattore'
        })
        
        console.log('🏷️ Tag impostati, recupero Player ID...')
        // Ottieni il Player ID
        const playerId = await getPlayerId()
        console.log('🆔 Player ID:', playerId)
      
      if (playerId) {
        // Salva il Player ID su Supabase (opzionale, per tracking)
        try {
          await supabase.from('onesignal_subscriptions').upsert({
            username: username,
            player_id: playerId,
            device_info: navigator.userAgent,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'username'
          })
        } catch (err) {
          console.log('Info: tabella onesignal_subscriptions non presente')
        }
      }
      
      alert('✅ Notifiche push attivate! Riceverai avvisi anche a sito chiuso.')
    } else {
      alert('❌ Permesso notifiche negato. Puoi riattivarlo dalle impostazioni del browser.')
    }
    
    } catch (error) {
      console.error('❌ Errore durante attivazione notifiche:', error)
      alert('❌ Errore durante l\'attivazione: ' + error.message)
    }
    
    setLoading(false)
    onClose()
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

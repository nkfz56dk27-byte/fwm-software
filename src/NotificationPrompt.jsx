import { useState } from 'react'
import { richiediPermessoNotifiche, setUserTags, getPlayerId } from './onesignal'
import { supabase } from './supabaseClient'

export default function NotificationPrompt({ username, onClose }) {
  const [loading, setLoading] = useState(false)

  async function handleAccetta() {
    console.log('🚀 Inizio attivazione notifiche...')
    setLoading(true)
    
    try {
      // BYPASS ONE SIGNAL - usa Notification API diretta
      console.log('📤 Richiesta permesso notifiche dirette...')
      
      const permission = await Notification.requestPermission()
      console.log('📋 Risposta permesso:', permission)
      
      if (permission === 'granted') {
        console.log('✅ Permesso concesso!')
        
        // Salva su localStorage
        localStorage.setItem('notificationPromptShown', 'true')
        
        // Salva su Supabase per backup permanente
        try {
          await supabase.from('user_preferences').upsert({
            username: username,
            notifications_enabled: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'username'
          })
          console.log('✅ Salvato su Supabase')
        } catch (err) {
          console.log('Info: tabella user_preferences non presente o errore Supabase')
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

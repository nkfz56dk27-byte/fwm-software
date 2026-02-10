import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getDispositiviUtente, disabilitaNotifiche } from './pushNotificationService'

export default function GestioneDispositiviNotifiche({ username, onClose }) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [dispositivi, setDispositivi] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    caricaDispositivi()
  }, [username])

  const caricaDispositivi = async () => {
    try {
      setLoading(true)
      const devices = await getDispositiviUtente(username)
      setDispositivi(devices)
      console.log('📱 Dispositivi caricati:', devices)
    } catch (error) {
      console.error('❌ Errore caricamento dispositivi:', error)
      setMessage('❌ Errore nel caricamento dei dispositivi')
    } finally {
      setLoading(false)
    }
  }

  const disabilita = async (deviceId) => {
    if (!confirm('Disabilitare le notifiche su questo dispositivo?')) return

    try {
      const { error } = await supabase
        .from('push_devices')
        .update({ attivo: false })
        .eq('username', username)
        .eq('device_id', deviceId)

      if (error) throw error

      setMessage('✅ Dispositivo disabilitato')
      setTimeout(() => caricaDispositivi(), 1000)
    } catch (error) {
      console.error('❌ Errore disabilitazione:', error)
      setMessage('❌ Errore nella disabilitazione')
    }
  }

  const rimuovi = async (deviceId) => {
    if (!confirm('Rimuovere definitivamente questo dispositivo?')) return

    try {
      const { error } = await supabase
        .from('push_devices')
        .delete()
        .eq('username', username)
        .eq('device_id', deviceId)

      if (error) throw error

      setMessage('✅ Dispositivo rimosso')
      setTimeout(() => caricaDispositivi(), 1000)
    } catch (error) {
      console.error('❌ Errore rimozione:', error)
      setMessage('❌ Errore nella rimozione')
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
      {isMobile && (
        <button
          style={{ position: 'fixed', top: 10, right: 10, zIndex: 99999, background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 18px', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer' }}
          onClick={async () => {
            try {
              let playerId = null;
              if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.PushSubscription) {
                playerId = await window.OneSignal.User.PushSubscription.id;
                alert('[OneSignal] METODO 1 - User.PushSubscription.id: ' + playerId);
              }
              if (!playerId && window.OneSignal && window.OneSignal.User && window.OneSignal.User.onesignalId) {
                playerId = await window.OneSignal.User.onesignalId;
                alert('[OneSignal] METODO 2 - User.onesignalId: ' + playerId);
              }
              if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscriptionId === 'function') {
                playerId = await window.OneSignal.getSubscriptionId();
                alert('[OneSignal] METODO 3 - getSubscriptionId: ' + playerId);
              }
              if (!playerId && window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
                playerId = await window.OneSignal.getUserId();
                alert('[OneSignal] METODO 4 - getUserId: ' + playerId);
              }
              if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscription === 'function') {
                const subscription = await window.OneSignal.getSubscription();
                playerId = subscription?.id || null;
                alert('[OneSignal] METODO 5 - getSubscription: ' + (subscription?.id || JSON.stringify(subscription)));
              }
              if (playerId) {
                alert('✅ [OneSignal] Player ID ottenuto: ' + playerId);
              } else {
                alert('❌ [OneSignal] Player ID non disponibile dopo tutti i tentativi!');
              }
            } catch (error) {
              alert('❌ Errore recupero Player ID: ' + error);
            }
          }}
        >DEBUG Player ID OneSignal</button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📱 I Tuoi Dispositivi</h2>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          ✕ Chiudi
        </button>
      </div>

      {message && (
        <div
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: message.startsWith('✅') ? '#d4edda' : '#f8d7da',
            borderRadius: '5px',
            color: message.startsWith('✅') ? '#155724' : '#721c24'
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>⏳ Caricamento...</div>
      ) : dispositivi.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          📭 Nessun dispositivo registrato per le notifiche
        </div>
      ) : (
        <div>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Hai {dispositivi.length} dispositivo{dispositivi.length !== 1 ? 'i' : ''} con notifiche abilitate:
          </p>
          {dispositivi.map((device) => (
            <div
              key={device.device_id}
              style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>
                    {device.device_type === 'mobile' ? '📱' : device.device_type === 'tablet' ? '📖' : '🖥️'} {device.device_type.charAt(0).toUpperCase() + device.device_type.slice(1)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                    <strong>Browser:</strong> {device.browser_info ? device.browser_info.substring(0, 40) : 'Dispositivo sconosciuto'}...
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                    <strong>ID:</strong> {device.device_id.substring(0, 30)}...
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                    <strong>Ultimo accesso:</strong> {new Date(device.ultimo_accesso).toLocaleString('it-IT')}
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: device.attivo ? '#d4edda' : '#f8d7da',
                      color: device.attivo ? '#155724' : '#721c24'
                    }}>
                      {device.attivo ? '✅ Attivo' : '❌ Disabilitato'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  {device.attivo && (
                    <button
                      onClick={() => disabilita(device.device_id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ffc107',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ⏸️ Disabilita
                    </button>
                  )}
                  <button
                    onClick={() => rimuovi(device.device_id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🗑️ Rimuovi
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

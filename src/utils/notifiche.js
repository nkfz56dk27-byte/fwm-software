export async function inviaNotificaPush(messaggio) {
  // Se l'utente è SUL SITO (tab visibile) → NON inviare push
  if (!document.hidden) {
    console.log('✅ Utente sul sito - solo notifica interna')
    return
  }

  // Se l'utente NON è sul sito (tab nascosto/chiuso) → Invia push
  try {
    await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Key os_v2_app_skpw6vu2gvff7eamjz36rapithmhbxuxj3oed2uosta3aqfgyr45gwu6jq4r4dwxh2o3ahtlndft7lz42mvqlqb6ek2nstrnpd5o7ba'
      },
      body: JSON.stringify({
        app_id: '929f6f56-9a35-4a5f-900c-4e77e881e899',
        included_segments: ['All'],
        headings: { it: '🔔 FWM - Nuova Notifica' },
        contents: { it: messaggio },
        url: 'https://fwm-software.vercel.app'
      })
    })
    console.log('📱 Push notification inviata!')
  } catch (err) {
    console.error('⚠️ Errore invio push:', err)
  }
}
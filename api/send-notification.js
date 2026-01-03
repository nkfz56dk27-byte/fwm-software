// Vercel Serverless Function per inviare notifiche push OneSignal
// Endpoint: /api/send-notification

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '32bc9e36-a2ac-449c-a07c-70168b9b3e37'
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || 'os_v2_app_skpw6vu2gvff7eamjz36rapithmhbxuxj3oed2uosta3aqfgyr45gwu6jq4r4dwxh2o3ahtlndft7lz42mvqlqb6ek2nstrnpd5o7ba'

    console.log('📤 Backend: Ricevuta richiesta notifica')
    console.log('📤 Backend: Body:', JSON.stringify(req.body))

    // Invia a OneSignal
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        ...req.body
      })
    })

    const data = await response.json()
    
    console.log('📤 Backend: Risposta OneSignal:', data)

    if (response.ok) {
      return res.status(200).json({ success: true, data })
    } else {
      console.error('❌ Backend: Errore OneSignal:', data)
      return res.status(response.status).json({ success: false, error: data })
    }

  } catch (error) {
    console.error('❌ Backend: Errore:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}

// Test OneSignal configuration

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

async function testOneSignal() {
  console.log('🔍 Testando configurazione OneSignal...');
  
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.error('❌ Mancano le credenziali OneSignal');
    return;
  }
  
  console.log('✅ Credenziali OneSignal trovate');
  console.log('App ID:', ONESIGNAL_APP_ID.substring(0, 10) + '...');
  
  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['All'],
      headings: { it: '🧪 Test Notifica', en: '🧪 Test Notification' },
      contents: { it: 'Questo è un test di configurazione OneSignal', en: 'This is a OneSignal configuration test' },
      url: '/',
      chrome_web_icon: '/icona_notifiche.png',
      chrome_web_badge: '/icona_notifiche.png'
    };
    
    console.log('📤 Invio notifica di test...');
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Errore OneSignal:', JSON.stringify(data, null, 2));
      return;
    }
    
    console.log('✅ Notifica inviata con successo!');
    console.log('Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
  }
}

testOneSignal();

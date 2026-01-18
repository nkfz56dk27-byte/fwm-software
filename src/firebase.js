import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyDb3oiIZKryEp0vcoIw2Qem5By5KL7rM6s',
  authDomain: 'fwm-software.firebaseapp.com',
  projectId: 'fwm-software',
  storageBucket: 'fwm-software.firebasestorage.app',
  messagingSenderId: '432548991978',
  appId: '1:432548991978:web:f2ccacda120778d38e5893'
  // measurementId opzionale
}

const app = initializeApp(firebaseConfig)
const messaging = getMessaging(app)

export { messaging, getToken, onMessage }

// Richiedi permesso e ottieni token FCM
export async function richiediPermessoNotifiche() {
  try {
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn('❌ Permesso notifiche non concesso:', permission);
      return null;
    }
    // Ottieni il token FCM
    const token = await getToken(messaging, {
      vapidKey: 'BJGXWXkiYyFKydho7dfS3wr83G_z2FIHJ1tCzgUsWTcLeYQFPdrCVk55Hy1XtqOvVxtkEL6HvthoH52klD8L_yU'
    });
    console.log('✅ Token FCM:', token);
    return token;
  } catch (error) {
    console.error('❌ Errore richiesta permesso/token:', error);
    return null;
  }
}

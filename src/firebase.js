import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'


// Firebase Configuration per notifiche browser e mobile
const firebaseConfig = {
  apiKey: 'AIzaSyASYRYMo19ruUjkuootTVZGzm0ajjXqN70',
  authDomain: 'fwm-notifiche.firebaseapp.com',
  projectId: 'fwm-notifiche',
  storageBucket: 'fwm-notifiche.firebasestorage.app',
  messagingSenderId: '422434674992',
  appId: '1:422434674992:web:b0561219198dd62cacd0f5'
}

const app = initializeApp(firebaseConfig)
const messaging = getMessaging(app)

export { app, messaging, getToken, onMessage }

// Richiedi permesso e ottieni token FCM (browser)
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

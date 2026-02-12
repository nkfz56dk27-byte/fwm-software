// Deregistra tutti i vecchi service worker tranne OneSignal
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      if (!reg.active || !reg.active.scriptURL.includes('OneSignalSDKWorker.js')) {
        reg.unregister();
        console.log('Service worker rimosso:', reg.active && reg.active.scriptURL);
      }
    });
  });
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeOneSignal } from './src/onesignal.js'

// Inizializza Firebase
import './firebase'

// Importa le funzioni di test delle notifiche e esponile globalmente
import * as notificationTester from './notificationTester'
Object.assign(window, notificationTester)

initializeOneSignal();
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// La registrazione del Service Worker viene gestita da OneSignal

// Inizializza OneSignal PRIMA del login
// OneSignal viene inizializzato solo tramite initializeOneSignal() in App.jsx
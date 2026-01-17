import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registra il Service Worker per le notifiche push
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => {
      console.log('✅ Service Worker registrato:', reg)
    })
    .catch(err => {
      console.warn('⚠️ Service Worker registrazione fallita:', err)
    })
}

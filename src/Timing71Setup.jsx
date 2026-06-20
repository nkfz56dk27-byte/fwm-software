import { useState } from 'react'

const EXTENSION_INSTALL_URL = 'https://chromewebstore.google.com/detail/iaaeepalpcdjjbgghcjdjhclhdiamanp?utm_source=item-share-cb'

export default function Timing71Setup({ onClose }) {
  const [copied, setCopied] = useState(false)

  function copyInstallLink() {
    navigator.clipboard.writeText(EXTENSION_INSTALL_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = EXTENSION_INSTALL_URL
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'white',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
        >
          ← Indietro
        </button>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', color: '#111', marginBottom: '8px' }}>📡 Setup Timing71</h1>
        <p style={{ color: '#666', marginBottom: '24px', fontSize: '16px' }}>
          Questa sezione ora usa esclusivamente l'estensione Chrome privata.
        </p>

        <div style={{ background: '#f8faff', border: '2px solid #c7d7fd', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#1e3a8a' }}>
            Installa l'estensione
          </h2>
          <p style={{ margin: '0 0 18px 0', color: '#374151', fontSize: '14px', lineHeight: 1.5 }}>
            Clicca il bottone qui sotto per aprire la pagina privata di installazione.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href={EXTENSION_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#16a34a',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 'bold',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              🧩 Installa estensione
            </a>

            <button
              onClick={copyInstallLink}
              style={{
                background: copied ? '#16a34a' : '#2563eb',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 'bold'
              }}
            >
              {copied ? '✅ Link copiato' : '🔗 Copia link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useRef, useState } from 'react'

// Lista statica di immagini disponibili nella cartella public/foto-guida-funzioni
const FOTO_LIST = [
  'Screenshot 2026-03-04 alle 12.31.21 copia.png',
  'Screenshot 2026-03-04 alle 12.31.21.png',
  'Screenshot 2026-03-04 alle 22.51.14.png',
  'Screenshot 2026-03-09 alle 09.50.34.png',
  'Screenshot 2026-03-09 alle 09.50.48.png'
]


export default function FotoGuidaFunzioniSelector({ onSelect }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef()

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: '#1E40AF',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '10px 18px',
          fontWeight: 'bold',
          fontSize: 15,
          cursor: 'pointer',
          boxShadow: '0 1px 4px #0001',
        }}
      >
        Scegli una foto dalla libreria
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.35)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 28,
              minWidth: 320,
              maxWidth: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 2px 16px #0002',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute',
                top: 10,
                right: 14,
                background: 'none',
                border: 'none',
                fontSize: 22,
                color: '#64748B',
                cursor: 'pointer',
              }}
              title="Chiudi"
            >
              ×
            </button>
            <div style={{ fontWeight: 'bold', fontSize: 16, color: '#1E40AF', marginBottom: 18 }}>
              Scegli una foto
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
              {FOTO_LIST.length === 0 && (
                <span style={{ color: '#64748B', fontSize: 13 }}>Nessuna foto disponibile nella cartella <b>public/foto-guida-funzioni</b></span>
              )}
              {FOTO_LIST.map((file) => (
                <button
                  key={file}
                  onClick={() => {
                    onSelect(`/foto-guida-funzioni/${file}`)
                    setOpen(false)
                  }}
                  style={{ border: '1px solid #CBD5E1', borderRadius: 8, padding: 0, background: 'white', cursor: 'pointer' }}
                  title={file}
                >
                  <img src={`/foto-guida-funzioni/${file}`} alt={file} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

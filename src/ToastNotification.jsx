import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function ToastNotification({ notification, onClose }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    console.log('🎬 Toast montato, notifica:', notification?.titolo)
    const timer = setTimeout(() => {
      console.log('⏲️ Toast timeout - chiusura automatica')
      setIsVisible(false)
      if (onClose) onClose()
    }, 6000)

    return () => clearTimeout(timer)
  }, [onClose])

  if (!isVisible) {
    console.log('❌ Toast non visibile')
    return null
  }

  console.log('✅ Rendering toast:', notification?.titolo)

  const toastContent = (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#fff',
        border: '3px solid #4CAF50',
        borderRadius: '8px',
        padding: '16px 20px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        zIndex: 99999,
        maxWidth: '400px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(500px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: '#333' }}>
            {notification.titolo}
          </div>
          {notification.messaggio && (
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.4' }}>
              {notification.messaggio}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            console.log('🔘 Toast chiuso manualmente')
            setIsVisible(false)
            if (onClose) onClose()
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#999',
            padding: '0',
            height: '24px',
            width: '24px',
            minWidth: '24px',
            flexShrink: 0
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )

  return createPortal(toastContent, document.body)
}

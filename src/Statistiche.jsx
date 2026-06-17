import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Statistiche({ onClose, user, isMobile }) {
  const [loading, setLoading] = useState(true)
  const [statistiche, setStatistiche] = useState([])

  useEffect(() => {
    caricaStatistiche()
  }, [])

  const caricaStatistiche = async () => {
    try {
      setLoading(true)
      // Qui puoi aggiungere la logica per caricare le statistiche dal database
      // Per ora lascio vuoto
      setStatistiche([])
    } catch (error) {
      console.error('Errore caricamento statistiche:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundImage: 'url(/sfondo-fwm.jpg)', 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          background: 'rgba(0, 0, 0, 0.85)', 
          border: '2px solid rgba(51, 51, 51, 0.8)', 
          borderRadius: '12px', 
          padding: '20px',
          color: '#FFF',
          fontSize: '18px'
        }}>
          Caricamento statistiche...
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundImage: 'url(/sfondo-fwm.jpg)', 
      backgroundSize: 'cover', 
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ 
        position: 'absolute', 
        top: isMobile ? '80px' : '20px', 
        left: '20px', 
        display: 'flex', 
        justifyContent: 'flex-start', 
        alignItems: 'center', 
        zIndex: 100 
      }}>
        <button 
          onClick={onClose} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'none', 
            border: 'none', 
            color: '#007AFF', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            cursor: 'pointer' 
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
          Indietro
        </button>
      </div>

      <div style={{ 
        background: 'rgba(0, 0, 0, 0.85)', 
        border: '2px solid rgba(51, 51, 51, 0.8)', 
        borderRadius: '12px', 
        padding: '30px',
        maxWidth: '800px',
        width: '100%',
        color: '#FFF'
      }}>
        <h2 style={{ 
          fontSize: isMobile ? '24px' : '32px', 
          fontWeight: 'bold', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          STATISTICHE
        </h2>
        
        <div style={{ 
          fontSize: '16px', 
          textAlign: 'center', 
          color: '#AAA' 
        }}>
          Sezione statistiche in sviluppo...
        </div>
      </div>
    </div>
  )
}

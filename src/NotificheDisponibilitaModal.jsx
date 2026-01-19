import React from 'react'

export default function NotificheDisponibilitaModal({ notifiche, onClose, onSegnaLetta, onSegnaTutteLette, isMobile }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '600px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>📅 Notifiche Disponibilità Weekend</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '20px 30px' }}>
          {notifiche.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nessuna notifica</div> : 
            notifiche.map(n => {
              const coloreStile = '#34C759';
              const backgroundColor = n.letta ? '#f5f5f7' : '#34C75915';
              return (
                <div key={n.id} onClick={() => !n.letta && onSegnaLetta(n.id)} style={{ padding: '15px', background: backgroundColor, borderRadius: '10px', marginBottom: '10px', borderLeft: `4px solid ${n.letta ? '#ccc' : coloreStile}` }}>
                  <div style={{ fontSize: '14px', fontWeight: n.letta ? 'normal' : 'bold', color: n.letta ? '#999' : '#000' }}>{n.messaggio}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
              )
            })
          }
        </div>
        <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0' }}>
          <button onClick={onSegnaTutteLette} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Segna tutte come lette</button>
        </div>
      </div>
    </div>
  )
}

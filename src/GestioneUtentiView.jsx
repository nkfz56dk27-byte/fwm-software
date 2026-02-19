import React, { useState } from 'react';

export default function GestioneUtentiView({ onClose, isMobile, titoloMarginTop }) {
  // Dynamic offset for header/button area
  const [offset, setOffset] = useState(0);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '24px', display: 'flex', flexDirection: 'column', paddingTop: isMobile ? '130px' : '24px', marginTop: isMobile ? '90px' : 0 }}>
      {/* Spacer rimosso, riduzione spazio bianco sopra il titolo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '24px',
          gap: '16px',
          paddingTop: isMobile ? '0px' : 0
        }}
      >
        <button onClick={onClose} style={{ background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', padding: isMobile ? '4px 18px' : '10px 18px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Indietro</button>
        <button onClick={onClose} style={{ background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: isMobile ? '0px' : 0 }}>Indietro</button>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, marginTop: titoloMarginTop }}>Gestione Utenti</h1>
      </div>
      {/* Qui vanno i bottoni: Gestisci RSS, Categorie, Template, ecc. */}
      {/* ...resto della UI... */}

      {/* Bottone debug OneSignal a fondo pagina, sempre visibile */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', padding: '32px 0 0 0' }}>
        <button
          style={{ background: '#FF9500', color: 'white', border: '3px solid #fff', borderRadius: '12px', padding: '16px 22px', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 4px 16px rgba(0,0,0,0.13)', cursor: 'pointer', outline: '2px solid #007AFF' }}
          onClick={async () => {
            try {
              let playerId = null;
              if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.PushSubscription) {
                playerId = await window.OneSignal.User.PushSubscription.id;
                alert('[OneSignal] METODO 1 - User.PushSubscription.id: ' + playerId);
              }
              if (!playerId && window.OneSignal && window.OneSignal.User && window.OneSignal.User.onesignalId) {
                playerId = await window.OneSignal.User.onesignalId;
                alert('[OneSignal] METODO 2 - User.onesignalId: ' + playerId);
              }
              if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscriptionId === 'function') {
                playerId = await window.OneSignal.getSubscriptionId();
                alert('[OneSignal] METODO 3 - getSubscriptionId: ' + playerId);
              }
              if (!playerId && window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
                playerId = await window.OneSignal.getUserId();
                alert('[OneSignal] METODO 4 - getUserId: ' + playerId);
              }
              if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscription === 'function') {
                const subscription = await window.OneSignal.getSubscription();
                playerId = subscription?.id || null;
                alert('[OneSignal] METODO 5 - getSubscription: ' + (subscription?.id || JSON.stringify(subscription)));
              }
              if (playerId) {
                alert('✅ [OneSignal] Player ID ottenuto: ' + playerId);
              } else {
                alert('❌ [OneSignal] Player ID non disponibile dopo tutti i tentativi!');
              }
            } catch (error) {
              alert('❌ Errore recupero Player ID: ' + error);
            }
          }}
        >DEBUG Player ID OneSignal</button>
      </div>
    </div>
  );
}

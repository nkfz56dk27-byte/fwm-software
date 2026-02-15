import React, { useState } from 'react';

// Componente VersusModal: gestisce la logica e la UI del confronto
export default function VersusModal({ open, onClose, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd, backBtnPos }) {
          // Funzione per calcolare DNS, DNF, DSQ per un pilota
          function calcolaFlag(pilotaId, flag) {
            if (!open || !Array.isArray(open.gp)) return 0;
            let count = 0;
            open.gp.forEach(gp => {
              if (Array.isArray(gp.gare)) {
                gp.gare.forEach(gara => {
                  if (gara.risultati && typeof gara.risultati === 'object') {
                    Object.entries(gara.risultati).forEach(([id, info]) => {
                      if (String(id) === String(pilotaId) && info && info.flag === flag) count++;
                    });
                  }
                });
              }
            });
            return count;
          }
        // Funzione per calcolare le pole position per un pilota
        function calcolaPole(pilotaId) {
          if (!open || !Array.isArray(open.gp)) return 0;
          let count = 0;
          open.gp.forEach(gp => {
            if (Array.isArray(gp.gare)) {
              gp.gare.forEach(gara => {
                if (gara.pole_id && String(gara.pole_id) === String(pilotaId)) {
                  count++;
                }
              });
            }
          });
          return count;
        }

        // Funzione per calcolare i giri veloci per un pilota
        function calcolaGiriVeloci(pilotaId) {
          if (!open || !Array.isArray(open.gp)) return 0;
          let count = 0;
          open.gp.forEach(gp => {
            if (Array.isArray(gp.gare)) {
              gp.gare.forEach(gara => {
                if (gara.giro_veloce_id && String(gara.giro_veloce_id) === String(pilotaId)) {
                  count++;
                }
              });
            }
          });
          return count;
        }
      // Funzione per calcolare i podi (posizioni 1, 2, 3) per un pilota
      function calcolaPodi(pilotaId) {
        if (!open || !Array.isArray(open.gp)) return 0;
        let count = 0;
        open.gp.forEach(gp => {
          if (Array.isArray(gp.gare)) {
            gp.gare.forEach(gara => {
              // Se risultati è un oggetto {pilotaId: posizione}
              if (gara.risultati && typeof gara.risultati === 'object' && !Array.isArray(gara.risultati)) {
                Object.entries(gara.risultati).forEach(([id, posizione]) => {
                  if (String(id) === String(pilotaId) && Number(posizione) >= 1 && Number(posizione) <= 3) count++;
                });
              }
              // Se risultati è un array (fallback)
              else if (Array.isArray(gara.risultati)) {
                const podio = gara.risultati.find(r => String(r.pilota_id) === String(pilotaId) && r.posizione >= 1 && r.posizione <= 3);
                if (podio) count++;
              }
            });
          }
        });
        return count;
      }
    // Funzione per calcolare le vittorie (posizioni 1) per un pilota
    function calcolaVittorie(pilotaId) {
      if (!open || !Array.isArray(open.gp)) return 0;
      let count = 0;
      open.gp.forEach(gp => {
        if (Array.isArray(gp.gare)) {
          gp.gare.forEach(gara => {
            // Se risultati è un oggetto {pilotaId: posizione}
            if (gara.risultati && typeof gara.risultati === 'object' && !Array.isArray(gara.risultati)) {
              Object.entries(gara.risultati).forEach(([id, posizione]) => {
                if (String(id) === String(pilotaId) && Number(posizione) === 1) count++;
              });
            }
            // Se risultati è un array (fallback)
            else if (Array.isArray(gara.risultati)) {
              const vincitore = gara.risultati.find(r => r.posizione === 1);
              if (vincitore && String(vincitore.pilota_id) === String(pilotaId)) count++;
            }
          });
        }
      });
      return count;
    }
  const [pilotaA, setPilotaA] = useState('');
  const [pilotaB, setPilotaB] = useState('');
  // Trova i dati dei piloti selezionati (safe)
  const pilotiList = open && Array.isArray(open.piloti) ? open.piloti : [];
  const pilotaAData = pilotiList.find(p => String(p.id) === String(pilotaA)) || null;
  const pilotaBData = pilotiList.find(p => String(p.id) === String(pilotaB)) || null;

  // Se non open, non mostra nulla
  if (!open) return null;

  // Mobile detection
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'white',
        zIndex: 9999,
        overflow: 'auto',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Tasto indietro stile altre schermate */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', marginTop: 24, marginBottom: 0, paddingLeft: 24 }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#007AFF',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '44px',
            padding: '0',
          }}
        >
          <span style={{ fontSize: '22px', fontWeight: 'bold' }}>←</span> Indietro
        </button>
      </div>
      {/* Titolo centrato orizzontalmente */}
      <div style={{ width: '100%', marginTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 'bold', margin: 0, textAlign: 'center' }}>Head to Head</h2>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32, width: '100%', maxWidth: 350, alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold', fontSize: 18, textAlign: 'center', marginBottom: 4, width: '100%' }}>Pilota A</label>
              <select
                value={pilotaA}
                onChange={e => setPilotaA(e.target.value)}
                style={{ width: '100%', padding: 14, fontSize: 19, borderRadius: 8, border: '1px solid #007AFF', marginTop: 4, textAlign: 'center', background: '#f8f8f8', fontWeight: 600 }}
              >
                <option value="" style={{ fontSize: 17, textAlign: 'center', fontWeight: 500 }}>Seleziona pilota</option>
                {Array.isArray(open.piloti) && open.piloti.map(p => (
                  <option key={p.id} value={p.id} style={{ fontSize: 19, textAlign: 'center', fontWeight: 600 }}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold', fontSize: 18, textAlign: 'center', marginBottom: 4, width: '100%' }}>Pilota B</label>
              <select
                value={pilotaB}
                onChange={e => setPilotaB(e.target.value)}
                style={{ width: '100%', padding: 14, fontSize: 19, borderRadius: 8, border: '1px solid #007AFF', marginTop: 4, textAlign: 'center', background: '#f8f8f8', fontWeight: 600 }}
              >
                <option value="" style={{ fontSize: 17, textAlign: 'center', fontWeight: 500 }}>Seleziona pilota</option>
                {Array.isArray(open.piloti) && open.piloti.map(p => (
                  <option key={p.id} value={p.id} style={{ fontSize: 19, textAlign: 'center', fontWeight: 600 }}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 32, marginTop: 40, justifyContent: 'center', width: '100%', maxWidth: 700 }}>
            <div style={{ flex: 1, maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold', fontSize: 16, textAlign: 'center', marginBottom: 0 }}>Pilota A</label>
              <select
                value={pilotaA}
                onChange={e => setPilotaA(e.target.value)}
                style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #007AFF', marginTop: 8, textAlign: 'center' }}
              >
                <option value="">Seleziona pilota</option>
                {Array.isArray(open.piloti) && open.piloti.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold', fontSize: 16, textAlign: 'center', marginBottom: 0 }}>Pilota B</label>
              <select
                value={pilotaB}
                onChange={e => setPilotaB(e.target.value)}
                style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #007AFF', marginTop: 8, textAlign: 'center' }}
              >
                <option value="">Seleziona pilota</option>
                {Array.isArray(open.piloti) && open.piloti.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {/* Qui potrai aggiungere la logica di confronto */}

        {/* DATI PILOTI (sopra il grafico) */}
        <div style={{ display: 'flex', gap: 32, marginTop: 32, justifyContent: 'center', width: '100%', maxWidth: 700 }}>
          {/* Dati Pilota A */}
          <div style={{ flex: 1, maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {pilotaAData && (
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 'bold', color: '#007AFF' }}>
                <div>{pilotaAData.nome}</div>
                <div>Vittorie: {calcolaVittorie(pilotaAData.id)}</div>
                <div>Podi: {calcolaPodi(pilotaAData.id)}</div>
                <div>Pole: {calcolaPole(pilotaAData.id)}</div>
                <div>Giri veloci: {calcolaGiriVeloci(pilotaAData.id)}</div>
                <div>Punti: {pilotaAData.punti ?? '-'}</div>
                <div>DNS: {calcolaFlag(pilotaAData.id, 'DNS')}</div>
                <div>DNF: {calcolaFlag(pilotaAData.id, 'DNF')}</div>
                <div>DSQ: {calcolaFlag(pilotaAData.id, 'DSQ')}</div>
              </div>
            )}
          </div>
          {/* Dati Pilota B */}
          <div style={{ flex: 1, maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {pilotaBData && (
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 'bold', color: '#007AFF' }}>
                <div>{pilotaBData.nome}</div>
                <div>Vittorie: {calcolaVittorie(pilotaBData.id)}</div>
                <div>Podi: {calcolaPodi(pilotaBData.id)}</div>
                <div>Pole: {calcolaPole(pilotaBData.id)}</div>
                <div>Giri veloci: {calcolaGiriVeloci(pilotaBData.id)}</div>
                <div>Punti: {pilotaBData.punti ?? '-'}</div>
                <div>DNS: {calcolaFlag(pilotaBData.id, 'DNS')}</div>
                <div>DNF: {calcolaFlag(pilotaBData.id, 'DNF')}</div>
                <div>DSQ: {calcolaFlag(pilotaBData.id, 'DSQ')}</div>
              </div>
            )}
          </div>
        </div>

        {/* GRAFICO HEAD TO HEAD */}
        <div style={{ width: '100%', maxWidth: 900, margin: '40px auto 0', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          {(pilotaAData && pilotaBData && open.gp && open.gp.length > 0) ? (
            <div style={{ width: '100%', overflowX: 'auto', marginBottom: 48 }}>
              <svg width={Math.max(600, open.gp.filter(g => g.completato).length * 90)} height="320" style={{ display: 'block', margin: '0 auto' }}>
                {/* Griglia orizzontale */}
                {[0, 25, 50, 75, 100, 125, 150, 175, 200].map(y => (
                  <g key={y}>
                    <line x1="50" y1={270 - y * 1.2} x2={Math.max(600, open.gp.filter(g => g.completato).length * 90)} y2={270 - y * 1.2} stroke="#e0e0e0" strokeWidth="1" />
                    <text x="10" y={275 - y * 1.2} fontSize="11" fill="#999">{y}</text>
                  </g>
                ))}

                {/* Linee piloti */}
                {[pilotaAData, pilotaBData].map((item, idx) => {
                  const colore = item.colore || (idx === 0 ? '#007AFF' : '#FF9500');
                  let puntiAccumulati = 0;
                  const punti = [{ x: 50, y: 270, punti: 0 }];
                  const gpCompletati = open.gp.filter(g => g.completato);
                  gpCompletati.forEach((gp, gpIdx) => {
                    let puntiGP = 0;
                    if (Array.isArray(gp.gare)) {
                      gp.gare.forEach(gara => {
                        if (!gara.completata || gara.non_disputata) return;
                        const risultato = gara.risultati?.[item.id];
                        if (!risultato) return;
                        // Punti gara: se è un numero, usa direttamente, altrimenti cerca posizione
                        let puntiGara = 0;
                        if (typeof risultato === 'object' && risultato.punti != null) {
                          puntiGara = risultato.punti;
                        } else if (typeof risultato === 'number') {
                          puntiGara = risultato;
                        } else if (typeof risultato === 'object' && risultato.posizione != null) {
                          // fallback: calcola punti da posizione
                          puntiGara = 0;
                          if (risultato.posizione === 1) puntiGara = 25;
                          else if (risultato.posizione === 2) puntiGara = 18;
                          else if (risultato.posizione === 3) puntiGara = 15;
                          else if (risultato.posizione === 4) puntiGara = 12;
                          else if (risultato.posizione === 5) puntiGara = 10;
                          else if (risultato.posizione === 6) puntiGara = 8;
                          else if (risultato.posizione === 7) puntiGara = 6;
                          else if (risultato.posizione === 8) puntiGara = 4;
                          else if (risultato.posizione === 9) puntiGara = 2;
                          else if (risultato.posizione === 10) puntiGara = 1;
                        }
                        puntiGP += puntiGara;
                      });
                    }
                    puntiAccumulati += puntiGP;
                    const x = 50 + (gpIdx + 1) * 90;
                    const y = 270 - puntiAccumulati * 1.2;
                    punti.push({ x, y, punti: puntiAccumulati });
                  });
                  return (
                    <g key={item.id}>
                      <polyline
                        points={punti.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={colore}
                        strokeWidth={4}
                        opacity={1}
                      />
                      {punti.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={7} fill={colore} opacity={0.9}>
                          <title>{item.nome}: {p.punti} pts</title>
                        </circle>
                      ))}
                    </g>
                  );
                })}

                {/* Etichette GP */}
                {open.gp.filter(g => g.completato).map((gp, idx) => (
                  <text key={gp.id} x={50 + (idx + 1) * 90} y="300" fontSize="12" fill="#666" textAnchor="middle" transform={`rotate(-45, ${50 + (idx + 1) * 90}, 300)`}>
                    {gp.nome}
                  </text>
                ))}
              </svg>
              {/* Legenda */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '18px' }}>
                {[pilotaAData, pilotaBData].map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 22, height: 6, background: item.colore || (idx === 0 ? '#007AFF' : '#FF9500'), borderRadius: 3 }}></div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{item.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '30px' }}>Seleziona due piloti per vedere il grafico</div>
          )}
        </div>

        {/* Dati piloti duplicati sotto il grafico rimossi definitivamente */}
      </div>
    </div>
  );
}

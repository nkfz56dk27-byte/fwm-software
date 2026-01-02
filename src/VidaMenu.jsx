import React, { useState } from 'react';
import VidaPNG from "./assets/vida.png"
import TestoFormattato from './TestoFormattato';
import { elaboraTestoComeChatGPT } from './utils/textFormatter';

export default function VidaMenu({ onClose }) {
  console.log('VidaMenu renderizzato');
  
  const [showTextFormatter, setShowTextFormatter] = useState(false);
  
  // Detect mobile
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        width: '90vw',
        maxWidth: '800px',
        height: '80vh',
        maxHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 25px',
          borderBottom: '1px solid #e0e0e0',
          background: '#f8f9fa'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#007AFF',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              alignSelf: isMobile ? 'flex-start' : 'auto',
              minHeight: isMobile ? '44px' : 'auto',
              padding: isMobile ? '8px 0' : '0',
              textAlign: 'left'
            }}
          >
            ← Indietro
          </button>
          
          <div style={{ 
            textAlign: 'center',
            position: 'relative',
            left: isMobile ? '-24px' : '-24px',
            top: '0px',
            right: '0px',
            bottom: '0px',
            transform: 'none',
            margin: '0px',
            padding: '0px',
            width: 'auto',
            height: 'auto'
          }}>
            <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 'bold' }}>
          
            </div>
          </div>
          
          <div style={{ width: '80px' }}></div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '40px',
            width: '100%'
          }}>
            {/* Prima riga: Formula1.it e Blogformulae.it affiancati */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '40px',
              width: '100%'
            }}>
              {/* Prima Card VIDA */}
              <div 
                className="home-card card-red" 
                onClick={() => window.open('https://www.formula1.it/admin/login.asp', '_blank')} 
                style={{ 
                  cursor: 'pointer',
                  width: isMobile ? '100% !important' : '190px !important',
                  maxWidth: isMobile ? '100% !important' : '190px !important',
                  height: isMobile ? '135px !important' : '190px !important',
                  margin: '0 !important',
                  flexShrink: '0 !important',
                  flexGrow: '0 !important',
                  display: 'flex !important',
                  position: 'relative !important',
                  padding: isMobile ? '10px 6px !important' : '18px 12px !important',
                  gap: isMobile ? '6px !important' : '10px !important'
                }}
              >
                <div className="card-icon-wrapper" style={{ 
                  width: isMobile ? '50px !important' : '75px !important',
                  height: isMobile ? '50px !important' : '75px !important'
                }}>
                  <img src={VidaPNG} alt="Vida Logo" style={{ 
                    width: isMobile ? "32px !important" : "60px", 
                    height: isMobile ? "32px !important" : "60px", 
                    filter: "brightness(0) invert(1)", 
                    objectFit: "contain" 
                  }} />
                </div>
                <h3 className="card-title" style={{ fontSize: isMobile ? '11px !important' : 'auto', lineHeight: isMobile ? '1.1 !important' : 'auto' }}>Formula1.it</h3>
              </div>

              {/* Seconda Card VIDA (Blogformulae.it) */}
              <div 
                className="home-card card-red" 
                onClick={() => window.open('https://www.blogformulae.it/admin/login.asp', '_blank')} 
                style={{ 
                  cursor: 'pointer',
                  width: isMobile ? '100% !important' : '190px !important',
                  maxWidth: isMobile ? '100% !important' : '190px !important',
                  height: isMobile ? '135px !important' : '190px !important',
                  margin: '0 !important',
                  flexShrink: '0 !important',
                  flexGrow: '0 !important',
                  display: 'flex !important',
                  position: 'relative !important',
                  padding: isMobile ? '10px 6px !important' : '18px 12px !important',
                  gap: isMobile ? '6px !important' : '10px !important'
                }}
              >
                <div className="card-icon-wrapper" style={{ 
                  width: isMobile ? '50px !important' : '75px !important',
                  height: isMobile ? '50px !important' : '75px !important'
                }}>
                  <img src={VidaPNG} alt="Vida Logo" style={{ 
                    width: isMobile ? "32px !important" : "60px", 
                    height: isMobile ? "32px !important" : "60px", 
                    filter: "brightness(0) invert(1)", 
                    objectFit: "contain" 
                  }} />
                </div>
                <h3 className="card-title" style={{ fontSize: isMobile ? '11px !important' : 'auto', lineHeight: isMobile ? '1.1 !important' : 'auto' }}>Blogformulae.it</h3>
              </div>
            </div>

            {/* Seconda riga: Formattatore Testo centrato sotto */}
            <div 
              className="home-card card-red" 
              onClick={() => setShowTextFormatter(true)} 
              style={{ 
                cursor: 'pointer',
                width: isMobile ? '100% !important' : '190px !important',
                maxWidth: isMobile ? '100% !important' : '190px !important',
                height: isMobile ? '135px !important' : '190px !important',
                margin: '0 !important',
                flexShrink: '0 !important',
                flexGrow: '0 !important',
                display: 'flex !important',
                position: 'relative !important',
                padding: isMobile ? '10px 6px !important' : '18px 12px !important',
                gap: isMobile ? '6px !important' : '10px !important'
              }}
            >
              <div className="card-icon-wrapper" style={{ 
                width: isMobile ? '50px !important' : '75px !important',
                height: isMobile ? '50px !important' : '75px !important'
              }}>
                <svg width={isMobile ? "32" : "60"} height={isMobile ? "32" : "60"} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "brightness(0) invert(1)" }}>
                  <path d="M3 5h18M7 9h10M5 13h14M8 17h8M11 21h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="card-title" style={{ fontSize: isMobile ? '11px !important' : 'auto', lineHeight: isMobile ? '1.1 !important' : 'auto' }}>Formattatore Testo</h3>
            </div>
          </div>
        </div>
      </div>
      
      {/* Pannello Formattatore Testo */}
      {showTextFormatter && <TextFormatterPanel onClose={() => setShowTextFormatter(false)} />}
    </div>
  )
}

// Componente TextFormatterPanel inline
function TextFormatterPanel({ onClose }) {
  const [htmlInput, setHtmlInput] = useState('');
  const [mostraModifiche, setMostraModifiche] = useState(true);
  const [result, setResult] = useState(null);
  
  // Detect mobile
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

  const handleElabora = () => {
    if (!htmlInput.trim()) return;
    
    const elaborato = elaboraTestoComeChatGPT(htmlInput);
    setResult(elaborato);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.htmlElaborato);
      alert('HTML copiato negli appunti!');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        width: '95vw',
        maxWidth: '900px',
        height: '90vh',
        maxHeight: '700px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 25px',
          borderBottom: '1px solid #e0e0e0',
          background: '#f8f9fa'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#007AFF',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              alignSelf: isMobile ? 'flex-start' : 'auto',
              minHeight: isMobile ? '44px' : 'auto',
              padding: isMobile ? '8px 0' : '0',
              textAlign: 'left'
            }}
          >
            ← Indietro
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 'bold' }}>
              Formattatore Testo Automatico
            </div>
          </div>
          
          <div style={{ width: '80px' }}></div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: isMobile ? '20px' : '30px',
          overflowY: 'auto',
          background: '#f5f5f5'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Input Section */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>HTML da elaborare:</h3>
              <textarea
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                placeholder="Incolla qui il tuo HTML da formattare..."
                style={{ 
                  width: '100%', 
                  height: '150px', 
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
              />
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button
                  onClick={handleElabora}
                  disabled={!htmlInput.trim()}
                  style={{
                    background: htmlInput.trim() ? '#dc2626' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: htmlInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Elabora Testo
                </button>
                
                <button
                  onClick={() => setMostraModifiche(!mostraModifiche)}
                  style={{
                    background: mostraModifiche ? '#059669' : '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {mostraModifiche ? 'Nascondi' : 'Mostra'} Modifiche
                </button>
              </div>
            </div>

            {/* Result Section */}
            {result && (
              <div style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, color: '#333' }}>HTML Elaborato:</h3>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copia HTML
                  </button>
                </div>
                
                <div style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  padding: '15px',
                  background: '#fafafa',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  <TestoFormattato 
                    htmlInput={htmlInput} 
                    mostraModifiche={mostraModifiche}
                  />
                </div>
              </div>
            )}

            {/* Instructions */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Cosa fa questo strumento:</h3>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#666', lineHeight: '1.6' }}>
                <li>Corregge solo errori di sintassi e forme errate</li>
                <li>Divide paragrafi troppo lunghi</li>
                <li>Sistema frasi contorte con tono giornalistico</li>
                <li>Toglie tag strong dai header</li>
                <li>Mette in grassetto max 9 parole/frasi SEO</li>
                <li>Mette in corsivo le dichiarazioni tra virgolette</li>
                <li>Elimina paragrafi simili o ripetuti</li>
                <li>Rimuove paragrafi vuoti <p>&nbsp;</p></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

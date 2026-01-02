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
        width: isMobile ? '95vw' : '90vw',
        maxWidth: isMobile ? '95vw' : '700px',
        height: isMobile ? '85vh' : '80vh',
        maxHeight: isMobile ? '85vh' : '600px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div className="gestione-header" style={{ 
          background: '#f8f9fa',
          padding: isMobile ? '12px 15px' : '20px 30px'
        }}>
          <button className="btn-back" onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
            Indietro
          </button>
          <h1 className="gestione-title" style={{ visibility: 'hidden' }}>Menu Vida</h1>
          <div style={{ width: '80px' }}></div>
        </div>
        <div className="divider"></div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: isMobile ? '20px' : '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '15px' : '30px',
            width: '100%',
            maxWidth: '600px'
          }}>
            {/* Prima riga: Formula1.it e Blogformulae.it affiancati */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '8px' : '25px',
              width: '100%',
              maxWidth: '700px'
            }}>
              {/* Prima Card VIDA */}
              <div 
                className="home-card card-red" 
                onClick={() => window.open('https://www.formula1.it/admin/login.asp', '_blank')} 
                style={{ 
                  cursor: 'pointer',
                  width: isMobile ? '100% !important' : '190px',
                  maxWidth: isMobile ? '100% !important' : '190px',
                  height: isMobile ? '135px !important' : '190px',
                  margin: '0',
                  flexShrink: '0',
                  flexGrow: '0',
                  display: 'flex',
                  position: 'relative',
                  padding: isMobile ? '10px 6px' : '18px 12px',
                  gap: isMobile ? '6px' : '10px',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className="card-icon-wrapper" style={{ 
                  width: isMobile ? '50px' : '75px',
                  height: isMobile ? '50px' : '75px'
                }}>
                  <img src={VidaPNG} alt="Vida Logo" style={{ 
                    width: isMobile ? "32px" : "60px", 
                    height: isMobile ? "32px" : "60px", 
                    filter: "brightness(0) invert(1)", 
                    objectFit: "contain" 
                  }} />
                </div>
                <h3 className="card-title" style={{ fontSize: isMobile ? '12px' : '16px', lineHeight: isMobile ? '1.1' : '1.2' }}>Formula1.it</h3>
              </div>

              {/* Seconda Card VIDA (Blogformulae.it) */}
              <div 
                className="home-card card-red" 
                onClick={() => window.open('https://www.blogformulae.it/admin/login.asp', '_blank')} 
                style={{ 
                  cursor: 'pointer',
                  width: isMobile ? '100% !important' : '190px',
                  maxWidth: isMobile ? '100% !important' : '190px',
                  height: isMobile ? '135px !important' : '190px',
                  margin: '0',
                  flexShrink: '0',
                  flexGrow: '0',
                  display: 'flex',
                  position: 'relative',
                  padding: isMobile ? '10px 6px' : '18px 12px',
                  gap: isMobile ? '6px' : '10px',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className="card-icon-wrapper" style={{ 
                  width: isMobile ? '50px' : '75px',
                  height: isMobile ? '50px' : '75px'
                }}>
                  <img src={VidaPNG} alt="Vida Logo" style={{ 
                    width: isMobile ? "32px" : "60px", 
                    height: isMobile ? "32px" : "60px", 
                    filter: "brightness(0) invert(1)", 
                    objectFit: "contain" 
                  }} />
                </div>
                <h3 className="card-title" style={{ fontSize: isMobile ? '12px' : '16px', lineHeight: isMobile ? '1.1' : '1.2' }}>Blogformulae.it</h3>
              </div>
            </div>

            {/* Seconda riga: Formattatore Testo centrato sotto */}
            <div 
              className="home-card card-red" 
              onClick={() => setShowTextFormatter(true)} 
              style={{ 
                cursor: 'pointer',
                width: isMobile ? '100%' : '190px',
                maxWidth: isMobile ? '100%' : '190px',
                height: isMobile ? '135px' : '190px',
                margin: '0',
                flexShrink: '0',
                flexGrow: '0',
                display: 'flex',
                position: 'relative',
                padding: isMobile ? '10px 6px' : '18px 12px',
                gap: isMobile ? '6px' : '10px',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div className="card-icon-wrapper" style={{ 
                width: isMobile ? '50px' : '75px',
                height: isMobile ? '50px' : '75px'
              }}>
                <svg width={isMobile ? "32" : "60"} height={isMobile ? "32" : "60"} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "brightness(0) invert(1)" }}>
                  <path d="M3 5h18M7 9h10M5 13h14M8 17h8M11 21h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="card-title" style={{ fontSize: isMobile ? '12px' : '16px', lineHeight: isMobile ? '1.1' : '1.2' }}>Formattatore Testo</h3>
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
      zIndex: 10001
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
        <div className="gestione-header" style={{ 
          background: '#f8f9fa',
          padding: isMobile ? '12px 15px' : '20px 30px'
        }}>
          <button className="btn-back" onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
            Indietro
          </button>
          <h1 className="gestione-title">Formattatore Testo Automatico</h1>
          <div style={{ width: '80px' }}></div>
        </div>
        <div className="divider"></div>

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
                <li>Rimuove paragrafi vuoti &lt;p&gt;&amp;nbsp;&lt;/p&gt;</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

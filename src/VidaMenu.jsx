import React, { useState } from 'react';
import VidaPNG from "./assets/vida.png"
import TextFormatterPanel from "./TextFormatterPanel"

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
              fontSize: isMobile ? '14px' : '20px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '12px 20px',
              borderRadius: '8px',
              position: 'relative',
              left: '-12px',
              top: '0px',
              width: 'auto',
              height: 'auto',
              minWidth: '80px',
              minHeight: '40px',
              maxWidth: '200px',
              maxHeight: '60px',
              margin: '0px',
              transform: 'none',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start'
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
            gap: '60px',
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

            {/* Seconda Card VIDA (identica) */}
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

            {/* Terza Card VIDA - Formattatore Testo */}
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
      {showTextFormatter && (
        <TextFormatterPanel onClose={() => setShowTextFormatter(false)} />
      )}
    </div>
  )
}

import VidaPNG from "./assets/vida.png"

export default function VidaMenu({ onClose, onOpenCorrettoreArticoli }) {
  console.log('VidaMenu renderizzato');
  
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
              VIDA Menu
            </div>
          </div>
          
          <div style={{ width: '80px' }}></div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background: '#f5f5f5',
          overflowY: 'auto'
        }}>
          {/* Row per F1 e Blog */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '15px' : '40px',
            width: '100%',
            marginBottom: isMobile ? '20px' : '40px'
          }}>
            {/* Prima Card VIDA */}
            <div 
              className="home-card card-red" 
              onClick={() => window.open('https://www.formula1.it/admin/login.asp', '_blank')} 
              style={{ 
                cursor: 'pointer',
                width: isMobile ? '100px !important' : '190px !important',
                maxWidth: isMobile ? '100px !important' : '190px !important',
                height: isMobile ? '100px !important' : '190px !important',
                margin: '0 !important',
                flexShrink: '0 !important',
                flexGrow: '0 !important',
                display: 'flex !important',
                position: 'relative !important',
                padding: isMobile ? '8px 6px !important' : '18px 12px !important',
                gap: isMobile ? '4px !important' : '10px !important'
              }}
            >
              <div className="card-icon-wrapper" style={{ 
                width: isMobile ? '40px !important' : '75px !important',
                height: isMobile ? '40px !important' : '75px !important'
              }}>
                <img src={VidaPNG} alt="Vida Logo" style={{ 
                  width: isMobile ? "24px !important" : "60px", 
                  height: isMobile ? "24px !important" : "60px", 
                  filter: "brightness(0) invert(1)", 
                  objectFit: "contain" 
                }} />
              </div>
              <h3 className="card-title" style={{ fontSize: isMobile ? '10px !important' : 'auto', lineHeight: isMobile ? '1.1 !important' : 'auto' }}>Formula1.it</h3>
            </div>

            {/* Seconda Card VIDA */}
            <div 
              className="home-card card-red" 
              onClick={() => window.open('https://www.blogformulae.it/admin/login.asp', '_blank')} 
              style={{ 
                cursor: 'pointer',
                width: isMobile ? '100px !important' : '190px !important',
                maxWidth: isMobile ? '100px !important' : '190px !important',
                height: isMobile ? '100px !important' : '190px !important',
                margin: '0 !important',
                flexShrink: '0 !important',
                flexGrow: '0 !important',
                display: 'flex !important',
                position: 'relative !important',
                padding: isMobile ? '8px 6px !important' : '18px 12px !important',
                gap: isMobile ? '4px !important' : '10px !important'
              }}
            >
              <div className="card-icon-wrapper" style={{ 
                width: isMobile ? '40px !important' : '75px !important',
                height: isMobile ? '40px !important' : '75px !important'
              }}>
                <img src={VidaPNG} alt="Vida Logo" style={{ 
                  width: isMobile ? "24px !important" : "60px", 
                  height: isMobile ? "24px !important" : "60px", 
                  filter: "brightness(0) invert(1)", 
                  objectFit: "contain" 
                }} />
              </div>
              <h3 className="card-title" style={{ fontSize: isMobile ? '10px !important' : 'auto', lineHeight: isMobile ? '1.1 !important' : 'auto' }}>Blogformulae.it</h3>
            </div>
          </div>

          {/* Card Correttore Articoli centrata */}
          <div 
            className="home-card card-blue" 
            onClick={onOpenCorrettoreArticoli}
            style={{ 
              cursor: 'pointer',
              width: isMobile ? '100px !important' : '190px !important',
              maxWidth: isMobile ? '100px !important' : '190px !important',
              height: isMobile ? '100px !important' : '190px !important',
              margin: '0 auto !important',
              flexShrink: '0 !important',
              flexGrow: '0 !important',
              display: 'flex !important',
              position: 'relative !important',
              padding: isMobile ? '8px 6px !important' : '18px 12px !important',
              gap: isMobile ? '4px !important' : '10px !important',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important'
            }}
          >
            <div className="card-icon-wrapper" style={{ 
              width: isMobile ? '40px !important' : '75px !important',
              height: isMobile ? '40px !important' : '75px !important',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: isMobile ? '24px' : '40px' }}>✏️</span>
            </div>
            <h3 className="card-title" style={{ fontSize: isMobile ? '10px !important' : 'auto', lineHeight: isMobile ? '1.1 !important' : 'auto', color: 'white' }}>Correttore Articoli</h3>
          </div>
        </div>
      </div>
    </div>
  )
}

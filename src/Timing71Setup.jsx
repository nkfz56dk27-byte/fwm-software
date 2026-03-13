import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const SUPABASE_URL = 'https://vfflpwrneminmnzmmwtu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZmxwd3JuZW1pbm1uem1td3R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA4ODI2MiwiZXhwIjoyMDgxNjY0MjYyfQ.16krIVscaYIzhG3dgXyp4NSUIYiIQ9eBf8ra0knykH0'

export default function Timing71Setup({ onClose, user }) {
  const [userId, setUserId] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
  try {
    const u = JSON.parse(sessionStorage.getItem('user'))
    if (u?.id) setUserId(u.id)
  } catch(e) {}
}, [])

  // Genera il bookmarklet con l'userId reale dell'utente loggato — no localStorage needed
  function getBookmarkletCode() {
    const uid = userId || 'INSERISCI_TUO_USER_ID';
    return `javascript:(function(){
      var headers=[...document.querySelectorAll('table tr th')].map(th=>th.innerText.trim());
      var rows=[...document.querySelectorAll('table tr')].slice(1);
      var data=rows.map(tr=>{
        var cells=[...tr.querySelectorAll('td')];
        var obj={};
        headers.forEach((h,i)=>{obj[h]=cells[i]?cells[i].innerText.trim():'';});
        return obj;
      });
      if(!data.length){alert('Nessun dato trovato!');return;}
      var name=prompt('Nome sessione (es: Formula E Monaco Gara):',document.title||'Sessione');
      if(!name)return;
      fetch('${SUPABASE_URL}/rest/v1/timing71_import',{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':'${SUPABASE_KEY}','Authorization':'Bearer ${SUPABASE_KEY}','Prefer':'return=minimal'},
        body:JSON.stringify({user_id:'${uid}',session_name:name.trim(),data:data})
      }).then(function(r){
        if(r.ok){alert('\u2705 '+data.length+' righe salvate come "'+name.trim()+'"! Torna su FWM e clicca Sincronizza.');}
        else{r.text().then(function(t){alert('\u274C Errore: '+t);});}
      }).catch(function(e){alert('\u274C Errore di rete: '+e.message);});
    })();`
  }

  function copiaCodice() {
    const code = getBookmarkletCode()
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'white', display: 'flex', flexDirection: 'column',
      padding: '20px', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>
          ← Indietro
        </button>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', color: '#111', marginBottom: '8px' }}>📡 Setup Timing71</h1>
        <p style={{ color: '#666', marginBottom: '32px', fontSize: '16px' }}>
          Segui questi passi una volta sola — poi importi i dati in due click da qualsiasi sessione.
        </p>

        {!userId ? (
          <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '10px', color: '#991b1b', fontWeight: 600 }}>
            ❌ Devi essere loggato per usare questa funzione.
          </div>
        ) : (
          <>
            {/* Step 1 - Abilita barra */}
            <div style={{ background: '#f8faff', border: '2px solid #c7d7fd', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#2563eb', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>1</div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1e3a8a' }}>Abilita la barra dei segnalibri</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { browser: '🟡 Chrome / Edge', shortcut: 'Cmd ⌘ + Shift + B' },
                  { browser: '🔵 Safari', shortcut: 'Visualizza → Mostra barra dei preferiti' },
                  { browser: '🟠 Firefox', shortcut: 'Visualizza → Barre → Segnalibri' },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'white', borderRadius: '8px', fontSize: '14px' }}>
                    <span style={{ color: '#374151' }}>{b.browser}</span>
                    <code style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', color: '#111' }}>{b.shortcut}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 - Crea segnalibro */}
            <div style={{ background: '#f8faff', border: '2px solid #c7d7fd', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#2563eb', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>2</div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1e3a8a' }}>Crea il segnalibro</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  'Clicca "📋 Copia codice" qui sotto',
                  'Tasto destro sulla barra segnalibri → "Aggiungi pagina" (Chrome) o "Nuovo segnalibro" (Safari/Firefox)',
                  'Nome: 📋 Copia Timing71',
                  'URL / Indirizzo: incolla il codice copiato (Cmd ⌘ + V)',
                  'Clicca Salva ✅',
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 14px', background: 'white', borderRadius: '8px' }}>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
                    <span style={{ color: '#374151', fontSize: '14px', lineHeight: 1.5 }}>{step}</span>
                  </div>
                ))}
              </div>

              {/* Box codice + bottone copia */}
              <div style={{ background: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Il tuo codice personale:</span>
                  <button
                    onClick={copiaCodice}
                    style={{
                      background: copied ? '#16a34a' : '#2563eb',
                      color: 'white', border: 'none',
                      padding: '8px 18px', borderRadius: '6px',
                      cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                      transition: 'background 0.2s'
                    }}
                  >
                    {copied ? '✅ Copiato!' : '📋 Copia codice'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={getBookmarkletCode()}
                  style={{
                    width: '100%', height: '80px', fontFamily: 'monospace',
                    fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '6px',
                    padding: '8px', background: 'white', resize: 'none',
                    color: '#374151', boxSizing: 'border-box'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  🔒 Questo codice è personalizzato per il tuo account. Non condividerlo.
                </p>
              </div>
            </div>

            {/* Step 3 - Usa su Timing71 */}
            <div style={{ background: '#f8faff', border: '2px solid #c7d7fd', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#2563eb', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>3</div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1e3a8a' }}>Usa durante una sessione</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: '🏁', text: 'Apri la sessione su timing71.org' },
                  { icon: '📋', text: 'Clicca il segnalibro "Copia Timing71" nella barra' },
                  { icon: '✏️', text: 'Inserisci il nome (es: "Formula E Monaco Gara")' },
                  { icon: '✅', text: 'Conferma: "20 piloti salvati!"' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'white', borderRadius: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{s.icon}</span>
                    <span style={{ color: '#374151', fontSize: '14px' }}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4 - Sincronizza */}
            <div style={{ background: '#f8faff', border: '2px solid #c7d7fd', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#2563eb', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>4</div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1e3a8a' }}>Sincronizza in FWM</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: '📂', text: 'Apri un template in "Ordina Tabella Classifica"' },
                  { icon: '🔄', text: 'Clicca "Sincronizza Timing71"' },
                  { icon: '🎉', text: 'I dati appaiono automaticamente nella griglia!' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'white', borderRadius: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{s.icon}</span>
                    <span style={{ color: '#374151', fontSize: '14px' }}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: '#fefce8', borderRadius: '8px', border: '1px solid #fde047', fontSize: '13px', color: '#713f12' }}>
              🔒 I dati salvati sono visibili solo a te.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

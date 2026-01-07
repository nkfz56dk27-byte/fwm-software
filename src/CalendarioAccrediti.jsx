import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'

const CAMPIONATI_DEFAULT = [
  { id: 'f1', nome: 'Formula 1', colore: '#E10600', emoji: '🏎️', sigla: 'F1' },
  { id: 'f2', nome: 'Formula 2', colore: '#0090D0', emoji: '🏎️', sigla: 'F2' },
  { id: 'f3', nome: 'Formula 3', colore: '#FF6800', emoji: '🏎️', sigla: 'F3' },
  { id: 'motogp', nome: 'MotoGP', colore: '#D4145A', emoji: '🏍️', sigla: 'MOTOGP' },
  { id: 'wec', nome: 'WEC', colore: '#00A19C', emoji: '🏁', sigla: 'WEC' },
  { id: 'indycar', nome: 'IndyCar', colore: '#C8102E', emoji: '🏎️', sigla: 'INDYCAR' },
  { id: 'fe', nome: 'Formula E', colore: '#0098DB', emoji: '⚡', sigla: 'FE' }
]

const EMOJI_DISPONIBILI = [
  { value: '🏎️', label: '🏎️ Monoposto' },
  { value: '🏁', label: '🏁 Bandiera a scacchi' },
  { value: '🏍️', label: '🏍️ Moto' },
  { value: '🚗', label: '🚗 Auto sportiva' },
  { value: '⚡', label: '⚡ Fulmine' }
]

const MESI_ITALIANO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

// Componente per la gestione delle sessioni del weekend
function SessioniWeekendModal({ onClose, onSave, isMobile, eventoData, setProgrammazioneWeekend, zIndex = 10000 }) {
  const [sessioni, setSessioni] = useState([
    { nome_sessione: 'PL1', attiva: false, data_sessione: '', orario_sessione: '' },
    { nome_sessione: 'PL2', attiva: false, data_sessione: '', orario_sessione: '' },
    { nome_sessione: 'PL3', attiva: false, data_sessione: '', orario_sessione: '' },
    { nome_sessione: 'Qualifiche', attiva: false, data_sessione: '', orario_sessione: '' },
    { nome_sessione: 'Qualifica Sprint', attiva: false, data_sessione: '', orario_sessione: '' },
    { nome_sessione: 'Sprint Race', attiva: false, data_sessione: '', orario_sessione: '' },
    { nome_sessione: 'Feature Race', attiva: false, data_sessione: '', orario_sessione: '' },
    { nome_sessione: 'Gara', attiva: false, data_sessione: '', orario_sessione: '' }
  ]);

  const programmazioneRef = useRef(null);

  // Inizializza le sessioni con i dati esistenti quando il modal si apre
  useEffect(() => {
    console.log('SessioniWeekendModal - eventoData:', eventoData);
    console.log('SessioniWeekendModal - programmazioneRef:', programmazioneRef.current);
    console.log('SessioniWeekendModal - window.programmazioneEsistente:', window.programmazioneEsistente);
    
    // Prima controlla se ci sono sessioni complete dal database
    if (window.sessioniComplete && window.sessioniComplete.length > 0) {
      console.log('Uso sessioni complete dal database:', window.sessioniComplete);
      
      // Usa le sessioni complete dal database
      const sessioniDalDatabase = window.sessioniComplete.map(sessioneDB => {
        const sessioneCorrispondente = sessioni.find(s => s.nome_sessione === sessioneDB.nome_sessione);
        if (sessioneCorrispondente) {
          return {
            ...sessioneCorrispondente,
            attiva: true,
            data_sessione: sessioneDB.data_sessione,
            orario_sessione: sessioneDB.orario_sessione
          };
        }
        return null;
      }).filter(Boolean);
      
      console.log('Sessioni dal database:', sessioniDalDatabase);
      setSessioni(sessioniDalDatabase);
      
      // Pulisci le variabili globali
      window.sessioniComplete = null;
      return;
    }
    
    // Fallback: usa la stringa programmazione_esistente
    let programmazioneDaCaricare = null;
    if (window.programmazioneEsistente) {
      programmazioneDaCaricare = window.programmazioneEsistente;
      console.log('Uso programmazione esistente dall evento:', programmazioneDaCaricare);
    } else if (programmazioneRef.current) {
      programmazioneDaCaricare = programmazioneRef.current;
      console.log('Uso programmazione dal ref:', programmazioneDaCaricare);
    }
    
    // Carica i dati salvati solo se esiste programmazione
    if (programmazioneDaCaricare) {
      // Carica i dati salvati nelle sessioni
      console.log('Caricamento sessioni salvate...');
      console.log('Stringa da parsare:', programmazioneDaCaricare);
      
      // Controlla se è formato JSON (nuovo) o stringa (vecchio)
      let sessioniSalvate = [];
      
      try {
        // Prova a parsare come JSON (nuovo formato con giorni)
        const programmazionePerGiorno = JSON.parse(programmazioneDaCaricare);
        console.log('Formato JSON rilevato:', programmazionePerGiorno);
        
        // Converti l'oggetto JSON in array di sessioni
        sessioniSalvate = [];
        Object.entries(programmazionePerGiorno).forEach(([giorno, sessioniGiorno]) => {
          // Ordina le sessioni per orario prima di caricarle
          sessioniGiorno.sort((a, b) => {
            // Estrai i nomi delle sessioni
            const nomeA = a.split(':')[0].trim();
            const nomeB = b.split(':')[0].trim();
            
            // Trova le sessioni corrispondenti per ottenere il campionato
            const sessioneA = sessioni.find(s => s.nome_sessione === nomeA);
            const sessioneB = sessioni.find(s => s.nome_sessione === nomeB);
            
            // Definisci le priorità dei campionati in base all'ID
            const getCampionatoPriorita = (sessioneCorr) => {
              if (!sessioneCorr || !sessioneCorr.campionato_id) return 99;
              if (sessioneCorr.campionato_id === 'f1') return 1;
              if (sessioneCorr.campionato_id === 'f2') return 2;
              if (sessioneCorr.campionato_id === 'f3') return 3;
              return 99; // Altri campionati hanno priorità più bassa
            };
            
            const prioritaA = getCampionatoPriorita(sessioneA);
            const prioritaB = getCampionatoPriorita(sessioneB);
            
            // Se hanno priorità diverse, ordina per priorità
            if (prioritaA !== prioritaB) {
              return prioritaA - prioritaB;
            }
            
            // Se stessa priorità, ordina per orario
            const orarioA = a.match(/(\d{2}:\d{2})$/)[1];
            const orarioB = b.match(/(\d{2}:\d{2})$/)[1];
            return orarioA.localeCompare(orarioB);
          });
          
          sessioniGiorno.forEach(sessioneStr => {
            const [nome, orario] = sessioneStr.trim().split(':');
            const sessioneCorrispondente = sessioni.find(s => s.nome_sessione === nome.trim());
            if (sessioneCorrispondente) {
              // Trova il giorno corrispondente
              const giornoData = giorniWeekend.find(g => g.nome.toLowerCase().includes(giorno.toLowerCase()))?.data || eventoData.data_inizio;
              sessioniSalvate.push({
                ...sessioneCorrispondente,
                attiva: true,
                data_sessione: giornoData,
                orario_sessione: orario.trim()
              });
            }
          });
        });
      } catch (e) {
        // Se non è JSON, usa il vecchio parsing
        console.log('Formato stringa rilevato, uso parsing vecchio');
        sessioniSalvate = programmazioneDaCaricare.split(', ').map(item => {
          const [nome, giornoOrario] = item.trim().split(/:(.+)/);
          let giorno = '';
          let orario = '';
          
          if (giornoOrario && giornoOrario.includes('-')) {
            // Vecchio formato con giorni: "2026-01-16 12:00"
            [giorno, orario] = (giornoOrario || '').trim().split(/\s+/);
          } else {
            // Nuovo formato senza giorni: "12:00"
            orario = (giornoOrario || '').trim();
            giorno = '';
          }
          
          const sessioneCorrispondente = sessioni.find(s => s.nome_sessione === nome.trim());
          if (sessioneCorrispondente) {
            return {
              ...sessioneCorrispondente,
              attiva: true,
              data_sessione: giorno || eventoData.data_inizio,
              orario_sessione: orario || ''
            };
          }
          return {
            nome_sessione: nome.trim(),
            attiva: true,
            data_sessione: giorno || eventoData.data_inizio,
            orario_sessione: orario || ''
          };
        });
      }
      
      console.log('Sessioni caricate:', sessioniSalvate);
      
      // Riordina automaticamente le sessioni per priorità F1 > F2 > F3
      const sessioniRiordinate = [...sessioniSalvate].sort((a, b) => {
        // Se una sessione non ha campionato_id, mettila alla fine
        if (!a.campionato_id && b.campionato_id) return 1;
        if (a.campionato_id && !b.campionato_id) return -1;
        if (!a.campionato_id && !b.campionato_id) return 0;
        
        // Definisci le priorità dei campionati
        const getCampionatoPriorita = (campionatoId) => {
          if (campionatoId === 'f1') return 1;
          if (campionatoId === 'f2') return 2;
          if (campionatoId === 'f3') return 3;
          return 99;
        };
        
        const prioritaA = getCampionatoPriorita(a.campionato_id);
        const prioritaB = getCampionatoPriorita(b.campionato_id);
        
        // Se hanno priorità diverse, ordina per priorità
        if (prioritaA !== prioritaB) {
          return prioritaA - prioritaB;
        }
        
        // Se stessa priorità, ordina per nome sessione
        return a.nome_sessione.localeCompare(b.nome_sessione);
      });
      
      console.log('🔍 AUTO-RIORDINO - Sessioni riordinate:', sessioniRiordinate);
      setSessioni(sessioniRiordinate);
    } else {
      console.log('Nessuna programmazione salvata, uso sessioni correnti');
      
      // Per il Nuovo Evento, NON distribuire automaticamente le sessioni - lasciale senza giorno
      if (eventoData && sessioni.every(s => !s.data_sessione)) {
        console.log('Nuovo Evento - sessioni senza giorno preassegnato');
        // Non fare nulla, lascia le sessioni senza giorno
      }
    }
  }, [eventoData?.data_inizio]);

  // Genera la lista dei giorni del weekend dell'evento
  const getGiorniWeekend = () => {
    if (!eventoData?.data_inizio) return [];
    
    const giorni = [];
    const dataInizio = new Date(eventoData.data_inizio);
    const dataFine = eventoData?.data_fine ? new Date(eventoData.data_fine) : dataInizio;
    
    // Aggiungi tutti i giorni da data_inizio a data_fine
    for (let d = new Date(dataInizio); d <= dataFine; d.setDate(d.getDate() + 1)) {
      giorni.push({
        data: new Date(d).toISOString().split('T')[0],
        nome: new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
      });
    }
    
    return giorni;
  };

  const giorniWeekend = getGiorniWeekend();
  const usaTab = giorniWeekend.length <= 4;

  console.log('🔍 DEBUG - giorniWeekend:', giorniWeekend);
  console.log('🔍 DEBUG - usaTab:', usaTab);
  console.log('🔍 DEBUG - sessioni:', sessioni);
  console.log('🔍 DEBUG - sessioni attive:', sessioni.filter(s => s.attiva));

  // Raggruppa le sessioni per giorno
  const sessioniPerGiorno = giorniWeekend.map(giorno => ({
    giorno: giorno,
    sessioni: sessioni.filter(s => s.data_sessione === giorno.data)
  }));

  const toggleSessione = (index) => {
    const nuoveSessioni = [...sessioni];
    nuoveSessioni[index].attiva = !nuoveSessioni[index].attiva;
    if (!nuoveSessioni[index].attiva) {
      nuoveSessioni[index].data_sessione = '';
      nuoveSessioni[index].orario_sessione = '';
    } else {
      // Quando attivo, NON preselezionare nessun giorno
      nuoveSessioni[index].data_sessione = '';
      nuoveSessioni[index].orario_sessione = '';
    }
    setSessioni(nuoveSessioni);
  };

  const aggiornaSessione = (index, campo, valore) => {
    console.log('🔥 DEBUG AGGIORNA SESSIONE - Index:', index, 'Campo:', campo, 'Valore:', valore);
    const nuoveSessioni = [...sessioni];
    nuoveSessioni[index][campo] = valore;
    console.log('🔥 DEBUG AGGIORNA SESSIONE - Sessione aggiornata:', nuoveSessioni[index]);
    setSessioni(nuoveSessioni);
  };

  const aggiungiSessionePerGiorno = (giornoData) => {
    const nomeSessione = prompt(`Nome della nuova sessione per ${giorniWeekend.find(g => g.data === giornoData)?.nome}:`);
    if (nomeSessione && nomeSessione.trim()) {
      const nuovaSessione = {
        nome_sessione: nomeSessione.trim(),
        attiva: true,
        data_sessione: giornoData,
        orario_sessione: ''
      };
      const nuoveSessioni = [...sessioni, nuovaSessione];
      
      // Riordina tutte le sessioni per priorità e orario
      nuoveSessioni.sort((a, b) => {
        // Se una sessione non ha campionato_id, mettila alla fine
        if (!a.campionato_id && b.campionato_id) return 1;
        if (a.campionato_id && !b.campionato_id) return -1;
        if (!a.campionato_id && !b.campionato_id) return 0;
        
        // Definisci le priorità dei campionati
        const getCampionatoPriorita = (campionatoId) => {
          if (campionatoId === 'f1') return 1;
          if (campionatoId === 'f2') return 2;
          if (campionatoId === 'f3') return 3;
          return 99;
        };
        
        const prioritaA = getCampionatoPriorita(a.campionato_id);
        const prioritaB = getCampionatoPriorita(b.campionato_id);
        
        // Se hanno priorità diverse, ordina per priorità
        if (prioritaA !== prioritaB) {
          return prioritaA - prioritaB;
        }
        
        // Se stessa priorità, ordina per nome sessione
        return a.nome_sessione.localeCompare(b.nome_sessione);
      });
      
      setSessioni(nuoveSessioni);
    }
  };

  const salvaSessioni = () => {
    console.log('🔥 SALVA SESSIONI CLICCATO!');
    console.log('Sessioni complete:', sessioni);
    const sessioniAttive = sessioni.filter(s => s.attiva && s.data_sessione && s.orario_sessione);
    console.log('Sessioni attive con dati:', sessioniAttive);
    
    if (sessioniAttive.length === 0) {
      alert('Seleziona almeno una sessione e compila data e orario!');
      return;
    }
    
    // Salva le sessioni separate per giorno per visualizzazione calendario
    const programmazionePerGiorno = {};
    sessioniAttive.forEach(sessione => {
      console.log('🔥 DEBUG SALVATAGGIO - Sessione:', sessione);
      const giornoKey = giorniWeekend.find(g => g.data === sessione.data_sessione)?.nome.split(' ')[0] || 'sconosciuto';
      console.log('🔥 DEBUG SALVATAGGIO - Giorno trovato:', giornoKey, 'per data:', sessione.data_sessione);
      
      if (!programmazionePerGiorno[giornoKey]) {
        programmazionePerGiorno[giornoKey] = [];
      }
      programmazionePerGiorno[giornoKey].push(`${sessione.nome_sessione}: ${sessione.orario_sessione}`);
      console.log('🔥 DEBUG SALVATAGGIO - Aggiunto a', giornoKey, ':', `${sessione.nome_sessione}: ${sessione.orario_sessione}`);
    });
    
    // Ordina le sessioni per orario all'interno di ogni giorno
    Object.keys(programmazionePerGiorno).forEach(giorno => {
      console.log('🔍 DEBUG ORDINAMENTO - Sessioni da ordinare per giorno', giorno, ':', programmazionePerGiorno[giorno]);
      console.log('🔍 DEBUG ORDINAMENTO - Array sessioni disponibile:', sessioni);
      
      programmazionePerGiorno[giorno].sort((a, b) => {
        // Estrai i nomi delle sessioni
        const nomeA = a.split(':')[0].trim();
        const nomeB = b.split(':')[0].trim();
        
        // Trova le sessioni corrispondenti per ottenere il campionato
        const sessioneA = sessioni.find(s => s.nome_sessione === nomeA);
        const sessioneB = sessioni.find(s => s.nome_sessione === nomeB);
        
        console.log('🔍 DEBUG ORDINAMENTO - Confronto:', {
          nomeA, nomeB,
          campionatoA: sessioneA?.campionato_id,
          campionatoB: sessioneB?.campionato_id
        });
        
        // Definisci le priorità dei campionati in base all'ID
        const getCampionatoPriorita = (sessioneCorr) => {
          if (!sessioneCorr || !sessioneCorr.campionato_id) return 99;
          if (sessioneCorr.campionato_id === 'f1') return 1;
          if (sessioneCorr.campionato_id === 'f2') return 2;
          if (sessioneCorr.campionato_id === 'f3') return 3;
          return 99; // Altri campionati hanno priorità più bassa
        };
        
        const prioritaA = getCampionatoPriorita(sessioneA);
        const prioritaB = getCampionatoPriorita(sessioneB);
        
        console.log('🔍 DEBUG ORDINAMENTO - Priorità:', { prioritaA, prioritaB });
        
        // Se hanno priorità diverse, ordina per priorità
        if (prioritaA !== prioritaB) {
          return prioritaA - prioritaB;
        }
        
        // Se stessa priorità, ordina per orario
        const orarioA = a.match(/(\d{2}:\d{2})$/)[1];
        const orarioB = b.match(/(\d{2}:\d{2})$/)[1];
        return orarioA.localeCompare(orarioB);
      });
      
      console.log('🔍 DEBUG ORDINAMENTO - Sessioni ordinate per giorno', giorno, ':', programmazionePerGiorno[giorno]);
    });
    
    // Salva come stringa JSON per il database
    const programmazioneFormattata = JSON.stringify(programmazionePerGiorno);
    console.log('Programmazione per giorno:', programmazionePerGiorno);
    console.log('Programmazione formattata:', programmazioneFormattata);
    
    // Chiama direttamente setProgrammazioneWeekend
    if (setProgrammazioneWeekend) {
      setProgrammazioneWeekend(programmazioneFormattata);
      console.log('Programmazione aggiornata:', programmazioneFormattata);
    }
    
    // Salva nel ref persistente
    programmazioneRef.current = programmazioneFormattata;
    console.log('🔥 Programmazione salvata in ref persistente:', programmazioneRef.current);
    
    onSave(sessioniAttive, programmazioneFormattata);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIndex }}>
      <div style={{ background: 'white', borderRadius: '15px', width: isMobile ? '100vw' : '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>📋 Programmazione Weekend</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        </div>
        
        <div style={{ padding: '20px', fontSize: '14px', color: '#666', borderBottom: '1px solid #e0e0e0' }}>
          Seleziona le sessioni e scegli il giorno per ciascuna:
          {giorniWeekend.length > 0 && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
              Weekend: {giorniWeekend.map(g => g.nome).join(' - ')}
            </div>
          )}
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {sessioni.map((sessione, index) => (
            <div key={index} style={{ marginBottom: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '10px', border: sessione.attiva ? '2px solid #007AFF' : '1px solid #e9ecef' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={sessione.attiva}
                  onChange={() => toggleSessione(index)}
                  style={{ marginRight: '10px', width: '18px', height: '18px' }}
                />
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: sessione.attiva ? '#007AFF' : '#333' }}>
                  {sessione.nome_sessione}
                </div>
                {sessione.data_sessione && (
                  <span style={{ 
                    marginLeft: '10px', 
                    fontSize: '12px', 
                    color: '#666',
                    background: '#e8f4fd',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    {giorniWeekend.find(g => g.data === sessione.data_sessione)?.nome.split(' ')[0]}
                  </span>
                )}
              </div>
              
              {sessione.attiva && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#333', display: 'block', marginBottom: '5px', fontWeight: '600' }}>Giorno</label>
                    {usaTab ? (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {giorniWeekend.map((giorno, idx) => (
                          <button
                            key={idx}
                            onClick={() => aggiornaSessione(index, 'data_sessione', giorno.data)}
                            style={{
                              flex: 1,
                              padding: '8px 4px',
                              borderRadius: '5px',
                              border: sessione.data_sessione === giorno.data ? '2px solid #007AFF' : '1px solid #ddd',
                              background: sessione.data_sessione === giorno.data ? '#007AFF' : '#fff',
                              color: sessione.data_sessione === giorno.data ? '#fff' : '#333',
                              fontSize: '11px',
                              cursor: 'pointer',
                              textAlign: 'center',
                              fontWeight: '600'
                            }}
                          >
                            {giorno.nome.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <select
                        style={{ 
                          width: '100%', 
                          padding: '8px', 
                          borderRadius: '5px', 
                          border: '1px solid #ddd',
                          background: '#fff',
                          color: '#333',
                          fontSize: '14px'
                        }}
                        value={sessione.data_sessione}
                        onChange={(e) => aggiornaSessione(index, 'data_sessione', e.target.value)}
                      >
                        <option value="" style={{ background: '#fff', color: '#333' }}>Seleziona giorno</option>
                        {giorniWeekend.map((giorno, idx) => (
                          <option key={idx} value={giorno.data} style={{ background: '#fff', color: '#333' }}>
                            {giorno.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#333', display: 'block', marginBottom: '5px', fontWeight: '600' }}>Orario</label>
                    <input
                      type="time"
                      style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                      value={sessione.orario_sessione}
                      onChange={(e) => aggiornaSessione(index, 'orario_sessione', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #e0e0e0' }}>
          <button
            onClick={() => {
              const nomeSessione = prompt('Nome della nuova sessione:');
              if (nomeSessione && nomeSessione.trim()) {
                const nuovaSessione = {
                  nome_sessione: nomeSessione.trim(),
                  attiva: true,
                  data_sessione: eventoData?.data_inizio || '',
                  orario_sessione: ''
                };
                setSessioni([...sessioni, nuovaSessione]);
              }
            }}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '2px dashed #007AFF', 
              background: '#f0f8ff', 
              color: '#007AFF', 
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ➕ Aggiungi Sessione Personalizzata
          </button>
        </div>
        
        <div style={{ padding: '20px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '2px solid #000', background: '#fff', cursor: 'pointer' }}
          >
            Annulla
          </button>
          <button
            onClick={salvaSessioni}
            style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#34C759', color: '#fff', cursor: 'pointer' }}
          >
            Salva Programmazione
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarioAccrediti({ utenteCorrente, onClose, onNotificheChange }) {
  const [campionati, setCampionati] = useState([])
  const [eventi, setEventi] = useState([])
  const [sessioni, setSessioni] = useState([]) // NUOVO: sessioni del weekend
  const [prenotazioni, setPrenotazioni] = useState([])
  const [utenti, setUtenti] = useState([])
  const [notifiche, setNotifiche] = useState([])
  const [loading, setLoading] = useState(true)
  const [meseCorrente, setMeseCorrente] = useState(new Date())
  const [showNuovoEvento, setShowNuovoEvento] = useState(false)
  const [showGestioneCampionati, setShowGestioneCampionati] = useState(false)
  const [showNotifiche, setShowNotifiche] = useState(false)
  const [eventoSelezionato, setEventoSelezionato] = useState(null)
  const [showSessioniModal, setShowSessioniModal] = useState(false) // NUOVO: modal per sessioni
const [eventoDataSessioni, setEventoDataSessioni] = useState(null) // NUOVO: dati evento per sessioni
const [currentSetProgrammazioneWeekend, setCurrentSetProgrammazioneWeekend] = useState(null) // NUOVO: funzione corrente per aggiornare programmazione
const [programmazioneSalvata, setProgrammazioneSalvata] = useState(null) // NUOVO: programmazione salvata per persistenza
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000)
  
  const isAdmin = utenteCorrente?.ruolo === 'admin'
  const isMobile = windowWidth <= 768
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  useEffect(() => { 
    caricaDati() 
  }, [])
  
  async function caricaDati() {
    setLoading(true)
    
    // 1. Caricamento Campionati
    let { data: campionatiDB } = await supabase.from('campionati').select('*').eq('attivo', true).order('nome')
    if (!campionatiDB || campionatiDB.length === 0) {
      const { data: nuoviCampionati } = await supabase.from('campionati').insert(CAMPIONATI_DEFAULT.map(c => ({ ...c, attivo: true }))).select()
      campionatiDB = nuoviCampionati || []
    }
    setCampionati(campionatiDB)
    
    // 2. Caricamento Eventi
    const { data: eventiDB } = await supabase.from('eventi_calendario').select('*').order('data_inizio')
    setEventi(eventiDB || [])
    
    // 2.1 Caricamento Sessioni
    const { data: sessioniDB } = await supabase.from('sessioni_weekend').select('*').order('data_sessione, orario_sessione')
    setSessioni(sessioniDB || [])
    
    // 3. Caricamento Utenti
    const { data: utentiDB } = await supabase.from('utenti').select('username, nome, cognome')
    setUtenti(utentiDB || [])
    
    // 4. Caricamento Prenotazioni con protezione "null null"
    const { data: prenotazioniDB } = await supabase.from('prenotazioni_accrediti').select('*')
    
    const prenotazioniConNomi = (prenotazioniDB || []).map(p => {
      const utente = (utentiDB || []).find(u => u.username === p.username)
      
      // Fallback: se non troviamo nome/cognome, usiamo lo username
      let nomeVisualizzato = p.username 
      
      if (utente) {
        const n = utente.nome || ''
        const c = utente.cognome || ''
        const unito = `${n} ${c}`.trim()
        
        // Se la stringa unita non è vuota, usiamo il nome reale
        if (unito) {
          nomeVisualizzato = unito
        }
      }
      
      return { ...p, nome_completo: nomeVisualizzato }
    })
    
    setPrenotazioni(prenotazioniConNomi)
    
    // 5. Caricamento Notifiche e fine loading
    await caricaNotifiche()
    setLoading(false)
  }
  
  async function caricaNotifiche() {
    try {
      console.log('🔍 DEBUG CALENDARIO: Inizio caricaNotifiche')
      console.log('🔍 DEBUG CALENDARIO: utenteCorrente.username:', utenteCorrente?.username)
      
      const { data: tutteNotifiche } = await supabase.from('notifiche_calendario').select('*').order('created_at', { ascending: false }).limit(50)
      console.log('🔍 DEBUG CALENDARIO: notifiche totali caricate:', tutteNotifiche?.length || 0)
      
      const { data: lette } = await supabase.from('notifiche_lette').select('notifica_id').eq('username', utenteCorrente.username)
      console.log('🔍 DEBUG CALENDARIO: notifiche lette caricate:', lette?.length || 0)
      
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      console.log('🔍 DEBUG CALENDARIO: IDs lette:', Array.from(idsLette))
      
      const notificheConStato = (tutteNotifiche || []).map(n => ({ ...n, letta: idsLette.has(n.id) }))
      const nonLette = notificheConStato.filter(n => !n.letta)
      console.log('🔍 DEBUG CALENDARIO: notifiche non lette calcolate:', nonLette.length)
      
      setNotifiche(notificheConStato)
      
      // FORZA RICARICAMENTO DELLE NOTIFICHE NELLA HOME
      if (onNotificheChange) {
        console.log('🔄 DEBUG CALENDARIO: Chiamo onNotificheChange per aggiornare Home')
        onNotificheChange()
      }
      
      // AGGIUNTA: Forza ricaricamento anche via evento custom
      window.dispatchEvent(new CustomEvent('notificheAggiornate', { 
        detail: { 
          calendarioNonLette: nonLette.length 
        } 
      }))
      
      console.log('✅ DEBUG CALENDARIO: caricaNotifiche completato')
    } catch (err) {
      console.error('❌ Errore caricaNotifiche (CALENDARIO):', err)
    }
  }
  
  async function creaNotifica(tipo, messaggio, evento_id = null) {
    await supabase.from('notifiche_calendario').insert({ tipo, messaggio, evento_id })
    await caricaNotifiche()
  }
  
  async function segnaComeLetta(notificaId) {
    await supabase.from('notifiche_lette').insert({ username: utenteCorrente.username, notifica_id: notificaId })
    await caricaNotifiche()
  }
  
  async function segnaTutteComeLette() {
    try {
      console.log('🔍 DEBUG CALENDARIO: Inizio segnaTutteComeLette')
      console.log('🔍 DEBUG CALENDARIO: utenteCorrente.username:', utenteCorrente?.username)
      console.log('🔍 DEBUG CALENDARIO: notifiche totali:', notifiche.length)
      
      const nonLette = notifiche.filter(n => !n.letta)
      console.log('🔍 DEBUG CALENDARIO: notifiche non lette:', nonLette.length)
      
      for (const n of nonLette) {
        console.log('🔍 DEBUG CALENDARIO: Inserisco notifica ID:', n.id, 'per utente:', utenteCorrente.username)
        
        const { data, error } = await supabase.from('notifiche_lette').insert({ 
          username: utenteCorrente.username, 
          notifica_id: n.id 
        })
        
        if (error) {
          console.error('❌ Errore inserimento notifica letta (CALENDARIO):', error)
          // Controlla se è un errore di duplicato (ignora)
          if (error.code !== '23505' && error.status !== 409) { // 23505 = unique violation, 409 = conflict
            throw error
          } else {
            console.log('ℹ️ Notifica già marcata come letta (CALENDARIO), ignoro:', n.id)
          }
        } else {
          console.log('✅ Notifica marcata come letta (CALENDARIO):', n.id)
        }
      }
      
      console.log('🔄 DEBUG CALENDARIO: Ricarico notifiche...')
      await caricaNotifiche()
      console.log('✅ DEBUG CALENDARIO: segnaTutteComeLette completato')
      
    } catch (err) {
      console.error('❌ Errore segna tutte come lette (CALENDARIO):', err)
      alert('❌ Errore durante il salvataggio: ' + err.message)
    }
  }
  
  async function cancellaTutte() {
    try {
      const tutteNotifiche = notifiche
      for (const n of tutteNotifiche) {
        await supabase
          .from('notifiche_lette')
          .upsert({ 
            username: utenteCorrente.username, 
            notifica_id: n.id 
          }, { 
            onConflict: 'username,notifica_id',
            ignoreDuplicates: true 
          })
      }
      await caricaNotifiche()
      setShowNotifiche(false)
    } catch (err) {
      console.error('Errore cancella tutte:', err)
    }
  }
  
  function cambiaMese(offset) {
    setMeseCorrente(new Date(meseCorrente.getFullYear(), meseCorrente.getMonth() + offset))
  }
  
  function formatData(dataStr) {
    if (!dataStr) return ''
    const [anno, mese, giorno] = dataStr.split('-')
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 
                  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    return `${parseInt(giorno)} ${mesi[parseInt(mese) - 1]}`
  }
  
  function getEventiMese() {
    // Se è mobile, restituiamo tutti gli eventi per la lista stile "Agenda"
    if (isMobile) {
      return eventi; 
    }
    
    const anno = meseCorrente.getFullYear();
    const mese = meseCorrente.getMonth();
    
    // CORREZIONE 31 DICEMBRE: Costruzione manuale stringa YYYY-MM-DD
    const primoGiorno = `${anno}-${String(mese + 1).padStart(2, '0')}-01`;
    const ultimoG = new Date(anno, mese + 1, 0).getDate();
    const ultimoGiorno = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(ultimoG).padStart(2, '0')}`;
    
    return eventi.filter(e => {
      const inizio = e.data_inizio;
      const fine = e.data_fine || e.data_inizio;
      return (inizio <= ultimoGiorno && fine >= primoGiorno);
    });
  }
  
  const notificheNonLette = notifiche.filter(n => !n.letta).length;
  
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px', color: '#666' }}>Caricamento...</div>;
  
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', padding: isMobile ? '10px' : '15px 30px', background: 'white', borderBottom: '1px solid #e0e0e0', gap: isMobile ? '10px' : '0' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', cursor: 'pointer', alignSelf: isMobile ? 'flex-start' : 'auto', minHeight: isMobile ? '44px' : 'auto', padding: isMobile ? '8px 0' : '0', textAlign: 'left' }}>← Indietro</button>
        <div style={{ textAlign: 'center', order: isMobile ? -1 : 0, padding: isMobile ? '10px 0' : '0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Calendario Accrediti</div>
          <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#666' }}>Gare ed Eventi</div>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '10px' }}>
          <button onClick={() => setShowNotifiche(true)} style={{ position: 'relative', padding: isMobile ? '12px' : '6px 12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: isMobile ? '14px' : '13px', fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>
            🔔 Notifiche
            {notificheNonLette > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#FF3B30', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>{notificheNonLette}</span>}
          </button>
          {isAdmin && <button onClick={() => setShowGestioneCampionati(true)} style={{ padding: isMobile ? '12px' : '6px 12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', fontSize: isMobile ? '14px' : '13px', fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>Categorie</button>}
          <button onClick={() => setShowNuovoEvento(true)} style={{ padding: isMobile ? '12px' : '6px 12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', fontSize: isMobile ? '14px' : '13px', fontWeight: '600', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto' }}>Nuovo</button>
        </div>
      </div>
      
      {/* NAVIGAZIONE MESE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '10px' : '12px 30px', background: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <button onClick={() => cambiaMese(-1)} style={{ padding: isMobile ? '10px 16px' : '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: isMobile ? '16px' : '13px', minHeight: isMobile ? '44px' : 'auto' }}>←</button>
        <div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 'bold' }}>{MESI_ITALIANO[meseCorrente.getMonth()]} {meseCorrente.getFullYear()}</div>
        <button onClick={() => cambiaMese(1)} style={{ padding: isMobile ? '10px 16px' : '6px 14px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: isMobile ? '16px' : '13px', minHeight: isMobile ? '44px' : 'auto' }}>→</button>
      </div>
      
      {/* LEGENDA */}
      <div style={{ padding: isMobile ? '8px 10px' : '10px 30px', background: 'white', borderBottom: '1px solid #e0e0e0', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: '12px', fontSize: isMobile ? '10px' : '11px', minWidth: isMobile ? 'max-content' : 'auto' }}>
          {campionati.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.colore, flexShrink: 0 }}></div><span>{c.emoji} {c.nome}</span></div>)}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#666', flexShrink: 0 }}></div><span>Eventi</span></div>
        </div>
      </div>
      
      {/* CONTENUTO CALENDARIO */}
      <div style={{ flex: 1, padding: isMobile ? '10px' : '20px 30px', overflow: 'auto' }}>
        {isMobile ? (
          <ListaGiorniMobile mese={meseCorrente} eventi={getEventiMese()} campionati={campionati} prenotazioni={prenotazioni} notifiche={notifiche} onEventoClick={e => setEventoSelezionato(e)} isMobile={isMobile} />
        ) : (
          <CalendarioMensile mese={meseCorrente} eventi={getEventiMese()} campionati={campionati} prenotazioni={prenotazioni} notifiche={notifiche} onEventoClick={e => setEventoSelezionato(e)} isMobile={isMobile} />
        )}
      </div>
      
      {/* MODALI - RIPRISTINATI E COMPLETI */}
{showNuovoEvento && (
  <NuovoEventoModal 
    campionati={campionati} 
    onClose={() => setShowNuovoEvento(false)} 
    onSave={async (titolo, eventoId, dataInizio) => { 
      const dataFormattata = formatData(dataInizio);
      const username = utenteCorrente?.email?.split('@')[0] || utenteCorrente?.username || 'Utente';
      await creaNotifica('nuovo_evento', `Nuovo evento: ${titolo} il ${dataFormattata} creato da ${username}`, eventoId); 
      caricaDati(); 
    }} 
    utenteCorrente={utenteCorrente} 
    isMobile={isMobile} 
    onRefreshCampionati={caricaDati}
    onOpenSessioniModal={(eventoData, setProgrammazioneWeekend) => {
      setEventoDataSessioni(eventoData);
      setCurrentSetProgrammazioneWeekend(() => setProgrammazioneWeekend);
      setShowSessioniModal(true);
    }}
  />
)}
      {showSessioniModal && (
        <SessioniWeekendModal 
          onClose={() => setShowSessioniModal(false)} 
          onSave={(sessioni, programmazioneFormattata) => {
            console.log('Sessioni salvate:', sessioni);
            console.log('Programmazione formattata:', programmazioneFormattata);
            setShowSessioniModal(false);
          }}
          isMobile={isMobile}
          eventoData={eventoDataSessioni}
          setProgrammazioneWeekend={currentSetProgrammazioneWeekend}
          zIndex={30000}
        />
      )}
      {showGestioneCampionati && (
        <GestioneCampionatiModal 
          campionati={campionati} 
          onClose={() => setShowGestioneCampionati(false)} 
          onUpdate={caricaDati} 
          isMobile={isMobile} 
        />
      )}
      
      {showNotifiche && (
        <NotificheModal 
          notifiche={notifiche} 
          onClose={() => setShowNotifiche(false)} 
          onSegnaLetta={segnaComeLetta} 
          onSegnaTutteLette={segnaTutteComeLette} 
          onCancellaTutte={cancellaTutte} 
          isMobile={isMobile} 
        />
      )}
      
      {eventoSelezionato && (
        <DettaglioEventoModal 
          evento={eventoSelezionato} 
          campionati={campionati} 
          prenotazioni={prenotazioni} 
          utenti={utenti} 
          isAdmin={isAdmin} 
          utenteCorrente={utenteCorrente} 
          onClose={() => setEventoSelezionato(null)} 
          onUpdate={async (notificaMsg, tipoNotifica) => { 
            if (notificaMsg) { 
              let messaggioDaInviare = notificaMsg;
              // Per le notifiche di tipo 'nota', il messaggio contiene già la data
              if (tipoNotifica !== 'nota') {
                const dataFormattata = formatData(eventoSelezionato.data_inizio);
                messaggioDaInviare = `${notificaMsg} il ${dataFormattata}`;
              }
              await creaNotifica(tipoNotifica || 'modifica', messaggioDaInviare, eventoSelezionato.id); 
            } 
            caricaDati(); 
          }} 
          isMobile={isMobile}
          onOpenSessioniModal={(eventoData, setProgrammazioneWeekend) => {
      setEventoDataSessioni(eventoData);
      setCurrentSetProgrammazioneWeekend(() => setProgrammazioneWeekend);
      
      // DEBUG: Mostra la struttura completa dell'evento
      console.log('🔍 DEBUG - eventoSelezionato completo:', eventoSelezionato);
      console.log('🔍 DEBUG - eventoSelezionato.sessioni:', eventoSelezionato.sessioni);
      console.log('🔍 DEBUG - eventoSelezionato.programmazione_weekend:', eventoSelezionato.programmazione_weekend);
      
      // Se l'evento ha già programmazione_weekend, recupera le sessioni complete
      if (eventoSelezionato?.programmazione_weekend) {
        // Recupera le sessioni complete dell'evento dal database
        window.sessioniComplete = eventoSelezionato.sessioni || [];
        window.programmazioneEsistente = eventoSelezionato.programmazione_weekend;
        console.log('🔍 DEBUG - Impostate sessioniComplete:', window.sessioniComplete);
      }
      setShowSessioniModal(true);
    }} 
        />
      )}
      
      {/* SessioniWeekendModal per la modifica - renderizzato nel componente principale */}
      {showSessioniModal && eventoSelezionato && (
        <SessioniWeekendModal 
          onClose={() => setShowSessioniModal(false)} 
          onSave={(sessioni, programmazioneFormattata) => {
            console.log('Sessioni salvate in modifica:', sessioni);
            console.log('Programmazione formattata in modifica:', programmazioneFormattata);
            setShowSessioniModal(false);
          }}
          isMobile={isMobile}
          eventoData={eventoDataSessioni}
          setProgrammazioneWeekend={currentSetProgrammazioneWeekend}
          zIndex={30000}
        />
      )}
    </div>
  );
}

function ListaGiorniMobile({ mese, eventi, campionati, prenotazioni, notifiche, onEventoClick, isMobile }) {
  const anno = mese.getFullYear();
  const meseNum = mese.getMonth(); // 11 per Dicembre
  const ultimoGiornoMese = new Date(anno, meseNum + 1, 0).getDate();
  
  const oggi = new Date();
  const oggiStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;

  const tuttiIGiorni = [];

  for (let g = 1; g <= ultimoGiornoMese; g++) {
    // Costruiamo la data in modo esplicito (Mezzogiorno per sicurezza fuso)
    const dataGiorno = new Date(anno, meseNum, g, 12, 0, 0);
    
    // Formato YYYY-MM-DD esatto per il confronto con il DB
    const mStr = String(meseNum + 1).padStart(2, '0');
    const gStr = String(g).padStart(2, '0');
    const dataCorrenteStr = `${anno}-${mStr}-${gStr}`;
    
    const isOggi = dataCorrenteStr === oggiStr;
    const nomeGiorno = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][dataGiorno.getDay()];

    const eventiGiorno = eventi.filter(evento => {
      // Puliamo le stringhe da eventuali spazi
      const inizio = evento.data_inizio.trim();
      const fine = (evento.data_fine || evento.data_inizio).trim();
      
      // Confronto puramente testuale (il più affidabile per le date YYYY-MM-DD)
      return dataCorrenteStr >= inizio && dataCorrenteStr <= fine;
    });

    // Debug per il 31 Dicembre (lo vedrai nella console del browser F12)
    if (g === 31 && meseNum === 11) {
      console.log("DEBUG 31 DIC:", {
        dataCorrenteStr,
        eventiTrovati: eventiGiorno.length,
        tuttiEventiDB: eventi
      });
    }

    tuttiIGiorni.push({ 
      data: dataCorrenteStr, 
      giorno: g, 
      nomeGiorno, 
      isOggi, 
      eventi: eventiGiorno 
    });
  }

  // Funzione per ordinare gli eventi per priorità di campionato (F1 > F2 > F3 > altri)
  const ordinaEventi = (eventiArray) => {
    const priorità = { 'f1': 0, 'f2': 1, 'f3': 2 };
    return eventiArray.sort((a, b) => {
      const prioritàA = priorità[a.campionato_id] !== undefined ? priorità[a.campionato_id] : 999;
      const prioritàB = priorità[b.campionato_id] !== undefined ? priorità[b.campionato_id] : 999;
      return prioritàA - prioritàB;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '30px' }}>
      {tuttiIGiorni.map(({ data, giorno, nomeGiorno, isOggi, eventi: eventiGiorno }) => (
        <div key={data} style={{ 
          background: isOggi ? '#007AFF' : 'white', 
          borderRadius: '12px', 
          padding: '12px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          border: isOggi ? 'none' : '1px solid #eee'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: eventiGiorno.length > 0 ? '10px' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: isOggi ? 'rgba(255,255,255,0.8)' : '#999', marginRight: '8px' }}>
                  {nomeGiorno.toUpperCase()}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: isOggi ? 'white' : '#333' }}>
                  {giorno}
                </span>
              </div>
              {/* Mostra numero eventi solo su desktop quando ci sono più eventi */}
              {!isMobile && eventiGiorno.length > 1 && (
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '600', 
                  color: '#007AFF', 
                  background: '#E3F2FD', 
                  padding: '2px 6px', 
                  borderRadius: '12px',
                  border: '1px solid #007AFF20'
                }}>
                  {eventiGiorno.length} eventi
                </div>
              )}
            </div>
            {isOggi && <div style={{ fontSize: '10px', fontWeight: '800', color: 'white', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px' }}>OGGI</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ordinaEventi(eventiGiorno).map(evento => {
              const campionato = campionati.find(c => c.id === evento.campionato_id);
              const colore = evento.tipo === 'gara' && campionato ? campionato.colore : (evento.colore_personalizzato || '#666');
              
              // Conta le notifiche non lette per questo evento
              const notificheNonLetteEvento = notifiche.filter(n => !n.letta && n.evento_id === evento.id);
              const hasNotifiche = notificheNonLetteEvento.length > 0;
              
              return (
                <div key={evento.id} onClick={() => onEventoClick(evento)} style={{ 
                  padding: '10px', 
                  background: isOggi ? 'rgba(255,255,255,0.15)' : '#f8f9fa',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${colore}`,
                  cursor: 'pointer',
                  position: 'relative'
                }}>
                  {/* Badge notifiche rosso */}
                  {hasNotifiche && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: '#FF3B30',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      boxShadow: '0 2px 4px rgba(255, 59, 48, 0.4)'
                    }}>
                      📝
                    </div>
                  )}
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: isOggi ? 'white' : '#333' }}>
                    {evento.titolo}
                    {evento.orario && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 'normal', color: isOggi ? 'rgba(255,255,255,0.8)' : '#007AFF' }}>
                        {evento.orario}
                      </span>
                    )}
                    {evento.programmazione_weekend && (
                      <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 'normal', color: isOggi ? 'rgba(255,255,255,0.7)' : '#666' }}>
                        {(() => {
                          try {
                            // Prova a parsare come JSON (nuovo formato)
                            const programmazionePerGiorno = JSON.parse(evento.programmazione_weekend);
                            const nomeGiornoCard = nomeGiorno.toLowerCase();
                            const sessioniGiorno = programmazionePerGiorno[nomeGiornoCard] || [];
                            
                            // Filtra solo le sessioni che appartengono a questo evento
                            // Per ora, mostra tutte le sessioni del giorno (potremmo affinare dopo)
                            return sessioniGiorno.join(', ');
                          } catch (e) {
                            // Se non è JSON, usa il vecchio formato
                            return evento.programmazione_weekend;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarioMensile({ mese, eventi, campionati, prenotazioni, notifiche, onEventoClick, isMobile }) {
  const anno = mese.getFullYear(), meseNum = mese.getMonth()
  const primoGiorno = new Date(anno, meseNum, 1).getDay(), ultimoGiorno = new Date(anno, meseNum + 1, 0).getDate()
  const offset = primoGiorno === 0 ? 6 : primoGiorno - 1
  const giorni = []
  for (let i = 0; i < offset; i++) giorni.push(<div key={`empty-${i}`} style={{ background: '#f9f9f9', borderRadius: '6px' }}></div>)
  for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
    const dataStr = `${anno}-${String(meseNum + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
    const eventiGiorno = eventi.filter(e => dataStr >= e.data_inizio && dataStr <= (e.data_fine || e.data_inizio))
    const isOggi = new Date().toDateString() === new Date(anno, meseNum, giorno).toDateString()
    giorni.push(<GiornoCell key={giorno} giorno={giorno} eventi={eventiGiorno} campionati={campionati} prenotazioni={prenotazioni} notifiche={notifiche} isOggi={isOggi} onEventoClick={onEventoClick} isMobile={isMobile} mese={mese} />)
  }
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Intestazione Giorni */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '8px', 
        marginBottom: '15px' 
      }}>
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(g => (
          <div key={g} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>
            {g}
          </div>
        ))}
      </div>

      {/* Griglia Calendario - Questa è la parte che "alza" le celle */}
      <div style={{ 
        flex: 1, 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gridAutoRows: '120px', 
        gap: '5px', 
        paddingBottom: '10px', // Crea il vuoto in fondo
        alignContent: 'start'   // Impedisce alla griglia di allungarsi
      }}>
        {giorni}
      </div>
    </div>
  );
} // <--- QUESTA CHIUDE IL COMPONENTE CALENDARIOMENSILE

function GiornoCell({ giorno, eventi, campionati, prenotazioni, notifiche, isOggi, onEventoClick, isMobile, mese }) {
  // Funzione per ordinare gli eventi per priorità di campionato (F1 > F2 > F3 > altri)
  const ordinaEventi = (eventiArray) => {
    const priorità = { 'f1': 0, 'f2': 1, 'f3': 2 };
    return eventiArray.sort((a, b) => {
      const prioritàA = priorità[a.campionato_id] !== undefined ? priorità[a.campionato_id] : 999;
      const prioritàB = priorità[b.campionato_id] !== undefined ? priorità[b.campionato_id] : 999;
      return prioritàA - prioritàB;
    });
  };

  if (isMobile) {
    // Mantieni qui il tuo codice mobile esistente
  }

  return (
    <div style={{ background: 'white', borderRadius: '8px', border: isOggi ? '2px solid #007AFF' : '1px solid #e0e0e0', padding: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: isOggi ? '#007AFF' : '#000' }}>{giorno}</div>
        {/* Mostra numero eventi solo su desktop quando ci sono più eventi */}
        {!isMobile && eventi.length > 1 && (
          <div style={{ 
            fontSize: '11px', 
            fontWeight: '600', 
            color: '#ffffffff', 
            background: '#ff0000ff', 
            padding: '1px 4px', 
            borderRadius: '8px',
            border: '1px solid #007AFF20',
            lineHeight: '1'
          }}>
            {eventi.length} eventi in programma oggi
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {ordinaEventi(eventi).map(evento => {
          const campionato = campionati.find(c => c.id === evento.campionato_id);
          const colore = evento.tipo === 'gara' && campionato ? campionato.colore : (evento.colore_personalizzato || '#666');
          const emoji = evento.tipo === 'gara' && campionato ? campionato.emoji : '📅';
          const sigla = evento.tipo === 'gara' && campionato ? campionato.sigla : 'EVENTO';
          
          // Filtriamo le prenotazioni per questo specifico evento
          const prenotazioniEvento = prenotazioni.filter(p => p.evento_id === evento.id);
          const numPrenotati = prenotazioniEvento.length;
          const maxAccrediti = evento.max_accrediti || 0;

          // Gestione Badge Stato
          let badge = null;
          if (evento.accredito_status === 'da_richiedere') badge = { icon: '🟡', text: 'DA RICHIEDERE', bg: '#FFD60A', color: '#000' };
          else if (evento.accredito_status === 'richiesto') badge = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' };
          else if (evento.accredito_status === 'accettato') badge = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' };

          // Conta le notifiche non lette per questo evento
          const notificheNonLetteEvento = notifiche.filter(n => !n.letta && n.evento_id === evento.id);
          const hasNotifiche = notificheNonLetteEvento.length > 0;

          return (
            <div key={evento.id} onClick={() => onEventoClick(evento)} title={evento.titolo} style={{ 
              padding: '8px', 
              background: `${colore}10`, 
              borderLeft: `5px solid ${colore}`, 
              borderRadius: '6px', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              position: 'relative'
            }}>
              {/* Badge notifiche rosso */}
              {hasNotifiche && (
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  right: '3px',
                  background: '#FF3B30',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  boxShadow: '0 2px 4px rgba(255, 59, 48, 0.4)'
                }}>
                  📝
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                <span>{emoji}</span>
                <strong style={{ color: colore, letterSpacing: '0.5px' }}>{sigla}</strong>
              </div>
              
              <div style={{ fontSize: '13px', fontWeight: '800', lineHeight: '1', color: '#1a1a1a' }}>
                {evento.titolo.toUpperCase()}
              </div>
              
              {evento.orario && (
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#007AFF', marginTop: '3px' }}>
                  {evento.orario.split(':').slice(0, 2).join(':')}
                </div>
              )}
              
              {evento.programmazione_weekend && (
                <div style={{ fontSize: '10px', fontWeight: 'normal', color: '#333', marginTop: '2px', lineHeight: '1.3' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation() // Impedisce la propagazione alla card madre
                      e.preventDefault() // Blocca comportamenti di default
                      const currentExpanded = e.target.dataset.expanded === 'true';
                      e.target.dataset.expanded = !currentExpanded;
                      const detailsDiv = e.target.nextElementSibling;
                      detailsDiv.style.display = currentExpanded ? 'none' : 'block';
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation() // Blocca anche al mousedown
                      e.preventDefault()
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#007AFF', 
                      fontSize: '9px', 
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}
                    data-expanded="false"
                  >
                    ORARI SESSIONI  {evento.programmazione_weekend ? '▼' : '▶'}
                  </button>
                  <div style={{ display: 'none', marginTop: '4px' }}>
                    {(() => {
                      try {
                        // Prova a parsare come JSON (nuovo formato)
                        const programmazionePerGiorno = JSON.parse(evento.programmazione_weekend);
                        
                        // Estrai anno e mese corretti dal calendario
                        const anno = mese.getFullYear();
                        const meseNum = mese.getMonth();
                        
                        // Crea la data corretta per questo giorno del calendario
                        const dataCasella = new Date(anno, meseNum, giorno);
                        const nomeGiornoSettimana = dataCasella.toLocaleDateString('it-IT', { weekday: 'short' }).toLowerCase();
                        
                        console.log('🔍 DEBUG - Data casella:', dataCasella.toISOString().split('T')[0]);
                        console.log('🔍 DEBUG - Nome giorno settimana:', nomeGiornoSettimana);
                        console.log('🔍 DEBUG - Programmazione disponibile:', Object.keys(programmazionePerGiorno));
                        
                        // Cerca sessioni per questo giorno
                        let sessioniGiorno = [];
                        if (programmazionePerGiorno[nomeGiornoSettimana]) {
                          sessioniGiorno = programmazionePerGiorno[nomeGiornoSettimana];
                          console.log('🔍 DEBUG - Sessioni trovate per', nomeGiornoSettimana, ':', sessioniGiorno);
                        }
                        
                        if (sessioniGiorno.length > 0) {
                          // Mostra il nome del giorno in grassetto e le sessioni sotto
                          const nomeGiornoCompleto = dataCasella.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
                          return (
                            <div>
                              <div style={{ fontWeight: 'bold', color: '#007AFF', marginBottom: '2px', fontSize: '9px' }}>
                                {nomeGiornoCompleto}
                              </div>
                              <div style={{ paddingLeft: '12px', color: '#333', fontSize: '9px' }}>
                                {sessioniGiorno.map(s => {
                                  // Formato: "NomeSessione: HH:MM"
                                  const colonIndex = s.indexOf(':');
                                  if (colonIndex === -1) return s;
                                  
                                  const nomeSessione = s.substring(0, colonIndex).trim();
                                  const orarioCompleto = s.substring(colonIndex + 1).trim();
                                  return (
                                    <span key={s} style={{ marginRight: '8px', display: 'inline-block' }}>
                                      <span>{nomeSessione}</span>
                                      <span style={{ fontWeight: 'bold', color: '#000' }}> {orarioCompleto}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        
                        return null;
                      } catch (e) {
                        // Se non è JSON, usa il vecchio formato
                        return evento.programmazione_weekend;
                      }
                    })()}
                  </div>
                </div>
              )}
              
              {badge && (
                <div style={{ 
                  fontSize: '10px', 
                  padding: '2px 4px', 
                  background: badge.bg, 
                  color: badge.color, 
                  borderRadius: '4px', 
                  fontWeight: '900', 
                  textAlign: 'center',
                  marginTop: '2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  {badge.icon} {badge.text}
                </div>
              )}
              
              {maxAccrediti > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', padding: '0 2px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: maxAccrediti }, (_, i) => (
                      <span key={i} style={{ fontSize: '13px', filter: i < numPrenotati ? 'none' : 'grayscale(1)', opacity: i < numPrenotati ? 1 : 0.2 }}>
                        👤
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: numPrenotati >= maxAccrediti ? '#FF3B30' : '#444' }}>
                    {numPrenotati}/{maxAccrediti}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function NuovoEventoModal({ campionati, onClose, onSave, utenteCorrente, isMobile, onOpenSessioniModal }) {
  const [tipo, setTipo] = useState('gara');
  const [campionatoId, setCampionatoId] = useState(campionati[0]?.id || '');
  const [titolo, setTitolo] = useState('');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState(''); 
  const [orario, setOrario] = useState(''); // NUOVO: orario opzionale (formato HH:MM)
  const [programmazioneWeekend, setProgrammazioneWeekend] = useState(''); // NUOVO: programmazione weekend
  const [maxAccrediti, setMaxAccrediti] = useState(0);
  const [accreditoStatus, setAccreditoStatus] = useState('nessuno'); 
  const [note, setNote] = useState('');
  const [colorePersonalizzato, setColorePersonalizzato] = useState('#666666');
  const [salvando, setSalvando] = useState(false);

  const sInp = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ccc', marginTop: '5px', fontSize: '15px', color: '#000', fontWeight: '600', boxSizing: 'border-box' };
  const sLab = { fontSize: '12px', fontWeight: '900', color: '#000', marginTop: '18px', display: 'block', textTransform: 'uppercase' };

  async function salvaEvento() {
    if (!titolo || !dataInizio) return alert('Manca Titolo o Data');
    setSalvando(true);
    
    const nuovoEvento = { 
      tipo, 
      campionato_id: tipo === 'gara' ? campionatoId : null, 
      titolo, 
      data_inizio: dataInizio, 
      data_fine: dataFine || null,
      orario: orario || null, // NUOVO: orario opzionale (es: "14:30")
      programmazione_weekend: programmazioneWeekend || null, // NUOVO: programmazione weekend
      max_accrediti: parseInt(maxAccrediti) || 0, 
      accredito_status: accreditoStatus, 
      note, 
      colore_personalizzato: tipo === 'evento' ? colorePersonalizzato : null, 
      creato_da: utenteCorrente?.username || 'admin'
    };

    console.log('Evento da salvare:', nuovoEvento);

    try {
      const { data, error } = await supabase.from('eventi_calendario').insert([nuovoEvento]).select().single();
      if (error) throw error;
      
      await onSave(titolo, data?.id, dataInizio); 
      onClose();
    } catch (err) { 
      alert("Errore: " + err.message); 
    } finally { 
      setSalvando(false); 
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', borderRadius: '20px', width: isMobile ? '100vw' : '500px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ padding: '20px 30px', borderBottom: '2px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
          <b style={{ fontSize: '18px', color: '#000' }}>NUOVO INSERIMENTO</b>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '0 30px 30px 30px' }}>
          
          <div style={{ display: 'flex', background: '#eee', padding: '5px', borderRadius: '12px', margin: '20px 0' }}>
            <button onClick={() => setTipo('gara')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: tipo === 'gara' ? '#fff' : 'transparent', fontWeight: '900', color: '#000', cursor: 'pointer' }}>GARA</button>
            <button onClick={() => setTipo('evento')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: tipo === 'evento' ? '#fff' : 'transparent', fontWeight: '900', color: '#000', cursor: 'pointer' }}>EVENTO</button>
          </div>

          <label style={sLab}>TITOLO EVENTO</label>
          <input style={sInp} value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="es. GP MONACO" />

          {tipo === 'gara' ? (
            <div>
              <label style={sLab}>CATEGORIA</label>
              <select value={campionatoId} onChange={e => setCampionatoId(e.target.value)} style={sInp}>
                {campionati.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={sLab}>COLORE IDENTIFICATIVO</label>
              <input type="color" value={colorePersonalizzato} onChange={e => setColorePersonalizzato(e.target.value)} style={{ ...sInp, height: '50px', padding: '5px' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{flex:1}}><label style={sLab}>INIZIO</label><input type="date" style={sInp} value={dataInizio} onChange={e => setDataInizio(e.target.value)} /></div>
            <div style={{flex:1}}><label style={sLab}>FINE</label><input type="date" style={sInp} value={dataFine} onChange={e => setDataFine(e.target.value)} /></div>
          </div>

          <div style={{marginTop: '15px'}}>
            <label style={sLab}>ORARIO (Opzionale) - Fuso Italia</label>
            <input 
              type="time" 
              style={sInp} 
              value={orario} 
              onChange={e => setOrario(e.target.value)}
              placeholder="es: 14:30"
            />
            <div style={{fontSize: '11px', color: '#999', marginTop: '4px'}}>
              💡 Lascia vuoto se non conosci l'orario
            </div>
          </div>

          {tipo === 'gara' && (
            <div style={{marginTop: '15px'}}>
              <button
                type="button"
                onClick={() => {
                  const eventoData = {
                    data_inizio: dataInizio,
                    data_fine: dataFine
                  };
                  onOpenSessioniModal(eventoData, setProgrammazioneWeekend);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #ccc',
                  background: '#007AFF',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Programmazione Weekend
              </button>
              {programmazioneWeekend && (
                <div style={{fontSize: '11px', color: '#007AFF', marginTop: '4px'}}>
                  📋 Programmazione: {programmazioneWeekend}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '2px solid #f0f0f0' }}>
            <label style={sLab}>STATO BADGE</label>
            <select style={sInp} value={accreditoStatus} onChange={e => setAccreditoStatus(e.target.value)}>
              <option value="nessuno"></option> {/* Opzione bianca/vuota */}
              <option value="da_richiedere">🟡 DA RICHIEDERE</option>
              <option value="richiesto">📨 RICHIESTO</option>
              <option value="accettato">✅ ACCETTATO</option>
            </select>

            <label style={sLab}>MAX PASS</label>
            <input type="number" style={sInp} value={maxAccrediti} onChange={e => setMaxAccrediti(e.target.value)} />

            <label style={sLab}>NOTE</label>
            <textarea style={{ ...sInp, height: '60px', resize: 'none' }} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div style={{ padding: '20px 30px', borderTop: '2px solid #f0f0f0', display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '2px solid #000', background: '#fff', fontWeight: '900', cursor: 'pointer' }}>ANNULLA</button>
          <button onClick={salvaEvento} disabled={salvando} style={{ flex: 2, padding: '15px', borderRadius: '12px', border: 'none', background: '#34C759', color: '#fff', fontWeight: '900', cursor: 'pointer' }}>
            {salvando ? 'SALVANDO...' : 'CONFERMA'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GestioneCampionatiModal({ campionati, onClose, onUpdate, isMobile }) {
  const [edit, setEdit] = useState(null);
  const sInp = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', marginTop: '5px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' };
  const sLab = { fontSize: '11px', fontWeight: 'bold', color: '#666', letterSpacing: '0.5px', marginTop: '10px', display: 'block' };

  async function salva() {
    if (!edit.nome || !edit.sigla) return alert("Nome e Sigla sono obbligatori");
    
    // Payload mappato esattamente sulle tue colonne Supabase
    const payload = { 
      nome: edit.nome, 
      emoji: edit.emoji, 
      colore: edit.colore, 
      sigla: edit.sigla.toUpperCase().trim(),
      attivo: true // Forza il valore booleano
    };

    try {
      if (edit.id) {
        // UPDATE: Modifica categoria esistente
        const { error } = await supabase.from('campionati').update(payload).eq('id', edit.id);
        if (error) throw error;
      } else {
        // INSERT: Nuova categoria con ID generato pulito
        const newId = edit.sigla.toLowerCase().trim().replace(/\s+/g, '-');
        const { error } = await supabase.from('campionati').insert([{ ...payload, id: newId }]);
        if (error) throw error;
      }
      await onUpdate(); 
      setEdit(null);
    } catch (err) {
      alert("Errore Database: " + err.message);
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <b>Gestione Categorie</b>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '25px' }}>
          {edit ? (
            <div>
              <label style={sLab}>NOME CATEGORIA</label>
              <input style={sInp} value={edit.nome} onChange={e => setEdit({...edit, nome: e.target.value})} placeholder="Es. Formula 1" />
              
              <label style={sLab}>SIGLA (ID)</label>
              <input style={sInp} value={edit.sigla} onChange={e => setEdit({...edit, sigla: e.target.value})} placeholder="Es. F1" />
              
              <label style={sLab}>EMOJI</label>
              <select style={sInp} value={edit.emoji} onChange={e => setEdit({...edit, emoji: e.target.value})}>
                <option value="🏎️">🏎️ Monoposto</option>
                <option value="🏁">🏁 Bandiera</option>
                <option value="⚡️">⚡️ Elettrico</option>
                <option value="🏍️">🏍️ Moto</option>
                <option value="🚘">🚘 Auto / GT</option>
              </select>
              
              <label style={sLab}>COLORE IDENTIFICATIVO</label>
              <input type="color" style={{...sInp, height:'45px'}} value={edit.colore} onChange={e => setEdit({...edit, colore: e.target.value})} />
              
              <button onClick={salva} style={{ width:'100%', marginTop:'20px', padding:'12px', background:'#34C759', color:'white', border:'none', borderRadius:'10px', fontWeight:'bold', cursor:'pointer' }}>
                Salva Categoria
              </button>
              <button onClick={() => setEdit(null)} style={{ width:'100%', marginTop:'10px', padding:'12px', background:'none', border:'1px solid #ddd', borderRadius:'10px', cursor:'pointer' }}>
                Annulla
              </button>
            </div>
          ) : (
            <>
              {campionati.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f5f5f7', borderRadius: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: c.colore }}></div>
                  <div style={{ flex: 1, fontWeight:'600' }}>{c.emoji} {c.nome}</div>
                  <button onClick={() => setEdit(c)} style={{ padding: '8px 12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold' }}>Modifica</button>
                </div>
              ))}
              <button onClick={() => setEdit({ nome: '', sigla: '', emoji: '🏎️', colore: '#ff0000' })} style={{ width: '100%', marginTop: '15px', padding: '14px', background: '#34C759', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer' }}>
                + Nuova Categoria
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function DettaglioEventoModal({ evento, campionati, prenotazioni, utenti, isAdmin, utenteCorrente, onClose, onUpdate, isMobile, onOpenSessioniModal }) {
  const [modalita, setModalita] = useState('visualizza')
  const [edit, setEdit] = useState(evento)
  const [salvando, setSalvando] = useState(false)
  const [sessioniEvento, setSessioniEvento] = useState([]) // NUOVO: sessioni complete dell'evento

  // Carica le sessioni dell'evento quando il modal si apre
  useEffect(() => {
    if (evento?.id) {
      // Prova a recuperare le sessioni direttamente dall'evento
      if (evento.sessioni && Array.isArray(evento.sessioni)) {
        setSessioniEvento(evento.sessioni);
      } else {
        setSessioniEvento([]);
      }
    }
  }, [evento?.id]);
  const [showSessioniModal, setShowSessioniModal] = useState(false)
  const [eventoDataSessioni, setEventoDataSessioni] = useState(null)
  const [sessioniSetProgrammazioneWeekend, setSessioniSetProgrammazioneWeekend] = useState(null)
  
  const campionato = campionati.find(c => c.id === evento.campionato_id)
  const prenotazioniEvento = prenotazioni.filter(p => p.evento_id === evento.id)
  const numPrenotati = prenotazioniEvento.length
  const maxAccrediti = evento.max_accrediti || 0
  const postiDisponibili = maxAccrediti - numPrenotati
  const prenotatoCorrente = prenotazioniEvento.find(p => p.username === utenteCorrente.username)
  
  async function togglePrenotazione() {
    if (prenotatoCorrente) {
      await supabase.from('prenotazioni_accrediti').delete().eq('id', prenotatoCorrente.id)
      await onUpdate(`${utenteCorrente.username} ha annullato la prenotazione per ${evento.titolo}`)
    } else {
      await supabase.from('prenotazioni_accrediti').insert({ evento_id: evento.id, username: utenteCorrente.username })
      await onUpdate(`${utenteCorrente.username} si è prenotato per ${evento.titolo}`)
    }
  }
  
  async function elimina() {
    if (!confirm('Eliminare questo evento?')) return
    await supabase.from('eventi_calendario').delete().eq('id', evento.id); await onUpdate(null); onClose()
  }
  
  async function salva() {
    setSalvando(true)
    
    // Verifica se max_accrediti è cambiato
    const maxAccreditiCambiato = edit.max_accrediti !== evento.max_accrediti
    
    // Verifica se la nota è stata aggiunta o modificata
    const notaPrecedente = evento.note || ''
    const notaAttuale = edit.note || ''
    const notaCambiata = notaPrecedente !== notaAttuale
    
    await supabase.from('eventi_calendario').update({ 
      titolo: edit.titolo, 
      data_inizio: edit.data_inizio, 
      data_fine: edit.data_fine || null, 
      orario: edit.orario || null, // NUOVO: orario opzionale
      programmazione_weekend: edit.programmazione_weekend || null, // NUOVO: programmazione weekend
      max_accrediti: edit.max_accrediti || 0, 
      accredito_status: edit.accredito_status, 
      note: edit.note 
    }).eq('id', edit.id)
    
    // Se la nota è stata modificata/aggiunta, crea una notifica rossa
    if (notaCambiata) {
      const dataFormattata = new Date(edit.data_inizio).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
      const messaggioNotifica = `aggiunta nota a ${edit.titolo} in programma giorno ${dataFormattata} da ${utenteCorrente.username}`
      await onUpdate(messaggioNotifica, 'nota')
    } else {
      await onUpdate(`Evento ${edit.titolo} modificato`, 'modifica')
    }
    setSalvando(false); setModalita('visualizza')
  }
  
  if (modalita === 'modifica') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
        <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Modifica Evento</div>
            <button onClick={() => setModalita('visualizza')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
            <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titolo</div>
              <input type="text" value={edit.titolo} onChange={e => setEdit({...edit, titolo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Inizio</div>
                <input type="date" value={edit.data_inizio} onChange={e => setEdit({...edit, data_inizio: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Fine</div>
                <input type="date" value={edit.data_fine || ''} onChange={e => setEdit({...edit, data_fine: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Orario (Opzionale) - Fuso Italia</div>
              <input type="time" value={edit.orario || ''} onChange={e => setEdit({...edit, orario: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
              <div style={{fontSize: '11px', color: '#999', marginTop: '4px'}}>
                💡 Lascia vuoto se non conosci l'orario
              </div>
            </div>
            {edit.tipo === 'gara' && (
              <div style={{marginTop: '15px'}}>
                <button
                  type="button"
                  onClick={() => {
                    const eventoData = {
                      data_inizio: edit.data_inizio,
                      data_fine: edit.data_fine
                    };
                    onOpenSessioniModal(eventoData, (programmazione) => {
                      setEdit({...edit, programmazione_weekend: programmazione});
                    });
                    setEventoDataSessioni(eventoData);
                    // Passa anche le sessioni complete dell'evento
                    window.sessioniComplete = sessioniEvento;
                    setShowSessioniModal(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid #ccc',
                    background: '#007AFF',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Programmazione Weekend
                </button>
                {edit.programmazione_weekend && (
                  <div style={{fontSize: '11px', color: '#007AFF', marginTop: '4px'}}>
                    📋 Programmazione: {edit.programmazione_weekend}
                  </div>
                )}
              </div>
            )}
            {isAdmin && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Numero Pass Disponibili (0 = nessun limite)</div>
              <input type="number" min="0" value={edit.max_accrediti || 0} onChange={e => setEdit({...edit, max_accrediti: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }} />
            </div>}
            <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Accredito</div>
              <select value={edit.accredito_status} onChange={e => setEdit({...edit, accredito_status: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', cursor: 'pointer' }}>
                <option value="nessuno">Nessuno</option>
                <option value="da_richiedere">🟡 Dovremmo richiederlo</option>
                <option value="richiesto">📨 Richiesto</option>
                <option value="accettato">✅ Accettato</option>
              </select>
            </div>
            <div><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Note</div>
              <textarea value={edit.note || ''} onChange={e => setEdit({...edit, note: e.target.value})} style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', justifyContent: 'flex-end', padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0' }}>
            <button onClick={() => setModalita('visualizza')} style={{ padding: isMobile ? '14px' : '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>Annulla</button>
            <button onClick={salva} disabled={salvando} style={{ padding: isMobile ? '14px' : '10px 20px', background: salvando ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold', minHeight: isMobile ? '48px' : 'auto', fontSize: isMobile ? '15px' : '14px' }}>{salvando ? '...' : 'Salva'}</button>
          </div>
        </div>
      </div>
    )
  }
  
  let b = null
  if (evento.accredito_status === 'da_richiedere') b = { icon: '🟡', text: 'DOVREMMO RICHIEDERLO', bg: '#FFD60A', color: '#000' }
  else if (evento.accredito_status === 'richiesto') b = { icon: '📨', text: 'RICHIESTO', bg: '#FF9500', color: '#FFF' }
  else if (evento.accredito_status === 'accettato') b = { icon: '✅', text: 'ACCETTATO', bg: '#34C759', color: '#FFF' }
  
  const slots = Array.from({ length: maxAccrediti }, (_, i) => prenotazioniEvento[i] || null)
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '550px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>Dettagli</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '30px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>{evento.titolo}</div>
          {b && <div style={{ marginBottom: '20px', padding: '15px', background: b.bg, color: b.color, borderRadius: '10px', fontWeight: 'bold' }}>{b.icon} {b.text}</div>}
          <div style={{ marginBottom: '20px' }}>
            {new Date(evento.data_inizio).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
            {evento.data_fine && ` - ${new Date(evento.data_fine).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}`}
            {evento.orario && <span style={{ marginLeft: '10px', fontWeight: 'bold', color: '#007AFF' }}>{evento.orario.split(':').slice(0, 2).join(':')}</span>}
          </div>
          {maxAccrediti > 0 && <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f7', borderRadius: '10px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>👤 Pass ({numPrenotati}/{maxAccrediti})</div>
            {slots.map((p, i) => (
              <div key={i} style={{ padding: '8px', background: 'white', borderRadius: '6px', marginBottom: '6px', fontSize: '14px' }}>
                {p ? `👤 ${p.nome_completo}` : `Posto ${i+1} libero`}
              </div>
            ))}
            <button onClick={togglePrenotazione} style={{ width: '100%', marginTop: '10px', padding: '12px', background: prenotatoCorrente ? '#FF3B30' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              {prenotatoCorrente ? 'Annulla prenotazione' : 'Prenota pass'}
            </button>
          </div>}
          {evento.note && (
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', marginBottom: '8px' }}>Note:</div>
              <div style={{ fontSize: '14px', color: '#000', background: '#f0f0f0', padding: '12px', borderRadius: '8px' }}>{evento.note}</div>
            </div>
          )}
          {evento.programmazione_weekend && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '10px', border: '1px solid #ddd' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>Programmazione Weekend</div>
              {(() => {
                try {
                  const programmazionePerGiorno = JSON.parse(evento.programmazione_weekend);
                  return (
                    <div>
                      {Object.keys(programmazionePerGiorno).map(giornoKey => {
                        const sessioniGiorno = programmazionePerGiorno[giornoKey];
                        if (sessioniGiorno.length === 0) return null;
                        
                        // Converte la chiave (es. "sab") in nome completo (es. "sabato")
                        const nomiGiorni = {
                          'sab': 'sabato', 
                          'dom': 'domenica',
                          'lun': 'lunedì',
                          'mar': 'martedì',
                          'mer': 'mercoledì',
                          'gio': 'giovedì',
                          'ven': 'venerdì'
                        };
                        
                        const nomeGiornoCompleto = nomiGiorni[giornoKey] || giornoKey;
                        
                        return (
                          <div key={giornoKey} style={{ marginBottom: '8px' }}>
                            <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px', fontSize: '13px' }}>
                              {nomeGiornoCompleto.charAt(0).toUpperCase() + nomeGiornoCompleto.slice(1)}
                            </div>
                            <div style={{ paddingLeft: '12px', color: '#333', fontSize: '12px', lineHeight: '1.4' }}>
                              {sessioniGiorno.map(s => {
                                // Formato: "NomeSessione: HH:MM"
                                const colonIndex = s.indexOf(':');
                                if (colonIndex === -1) return s;
                                
                                const nomeSessione = s.substring(0, colonIndex).trim();
                                const orarioCompleto = s.substring(colonIndex + 1).trim();
                                return (
                                  <span key={s} style={{ marginRight: '8px', display: 'inline-block' }}>
                                    <span>{nomeSessione}</span>
                                    <span style={{ fontWeight: 'bold', color: '#000' }}> {orarioCompleto}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                } catch (e) {
                  // Se non è JSON, mostra il formato vecchio
                  return (
                    <div style={{ color: '#333', fontSize: '12px' }}>
                      {evento.programmazione_weekend}
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </div>
        <div style={{ padding: isMobile ? '15px' : '20px 30px', borderTop: '1px solid #e0e0e0' }}>
          {isAdmin ? <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={elimina} style={{ flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px' }}>Elimina</button>
            <button onClick={() => setModalita('modifica')} style={{ flex: 1, padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px' }}>Modifica</button>
          </div> : <button onClick={onClose} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px' }}>Chiudi</button>}
        </div>
      </div>
    </div>
  )
}

function NotificheModal({ notifiche, onClose, onSegnaLetta, onSegnaTutteLette, onCancellaTutte, isMobile }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: isMobile ? '0' : '20px' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '0' : '15px', width: isMobile ? '100vw' : '600px', maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 15px' : '20px 30px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>🔔 Notifiche</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '15px' : '20px 30px' }}>
          {notifiche.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Nessuna notifica</div> : 
            notifiche.map(n => {
              // Determina il colore in base al tipo di notifica
              const isNotaNota = n.tipo === 'nota';
              const coloreStile = isNotaNota ? '#FF3B30' : '#007AFF';
              const backgroundColor = isNotaNota ? '#FF3B3015' : '#007AFF15';
              
              return (
                <div key={n.id} onClick={() => !n.letta && onSegnaLetta(n.id)} style={{ padding: '15px', background: n.letta ? '#f5f5f7' : backgroundColor, borderRadius: '10px', marginBottom: '10px', borderLeft: `4px solid ${n.letta ? '#ccc' : coloreStile}` }}>
                  <div style={{ fontSize: '14px', fontWeight: n.letta ? 'normal' : 'bold', color: n.letta ? '#999' : (isNotaNota ? '#d32f2f' : '#000') }}>{n.messaggio}</div>
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

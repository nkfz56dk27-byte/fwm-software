import { useState } from 'react';

export default function CorrettoreArticoli({ onClose }) {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [errorReport, setErrorReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('input');

  // Dizionario di correzioni comuni in italiano
  const dizionarioCorrezioni = {
    // Errori comuni di ortografia
    'coregere': 'correggere',
    'coregge': 'corregge',
    'coreggi': 'correggi',
    'corege': 'corregge',
    'erori': 'errori',
    'eror': 'errore',
    'efori': 'errori',
    'efor': 'errore',
    'quto': 'questo',
    'queso': 'questo',
    'deto': 'detto',
    'detto': 'detto',
    
    // Accenti comuni (parole che hanno sempre accento)
    'pero': 'però',
    'piu': 'più',
    'perche': 'perché',
    'benche': 'benché',
    'affinche': 'affinché',
    'poiche': 'poiché',
    'giacche': 'giacché',
    'gia': 'già',
    'sara': 'sarà',
    'andra': 'andrà',
    'dovra': 'dovrà',
    'avra': 'avrà',
    'puo': 'può',
    'potrebbe': 'potrebbe',
    
    // Parole comuni
    'cosa': 'cosa',
    'quando': 'quando',
    'dove': 'dove',
    'quale': 'quale',
    'quali': 'quali',
    'questo': 'questo',
    'questa': 'questa',
    'questi': 'questi',
    'queste': 'queste',
    'quello': 'quello',
    'quella': 'quella',
    'quelli': 'quelli',
    'quelle': 'quelle',
    'corsivo': 'corsivo'
  };

  // Calcola distanza Levenshtein tra due stringhe
  const levenshteinDistance = (str1, str2) => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    return matrix[len2][len1];
  };

  // Trova la parola corretta più simile
  const trovaParolaSimile = (parolaErrata) => {
    const keysDizionario = Object.keys(dizionarioCorrezioni);
    let migliorMatch = null;
    let distanzaMinima = 2; // Solo per 1 carattere di differenza

    for (let chiave of keysDizionario) {
      const distanza = levenshteinDistance(parolaErrata.toLowerCase(), chiave.toLowerCase());
      if (distanza < distanzaMinima) {
        distanzaMinima = distanza;
        migliorMatch = {
          correzione: dizionarioCorrezioni[chiave],
          distanza: distanza
        };
      }
    }

    return migliorMatch;
  };

  const correggiTesto = async () => {
    if (!inputText.trim()) {
      alert('Inserisci un testo da correggere');
      return;
    }

    setLoading(true);
    try {
      console.log('Inizio correzione con fuzzy matching...');

      let correttedText = inputText;
      const report = [];

      // Splitta il testo in parole
      const parole = inputText.match(/\b\w+\b/g) || [];
      const paroleUniche = [...new Set(parole)];

      // Per ogni parola, cerca correzioni nel dizionario o tramite fuzzy match
      paroleUniche.forEach(parola => {
        const parolaLower = parola.toLowerCase();
        let correzione = null;

        // Primo: cerca exact match nel dizionario
        if (dizionarioCorrezioni[parolaLower]) {
          correzione = dizionarioCorrezioni[parolaLower];
        } else {
          // Secondo: cerca fuzzy match SOLO per parole lunghe >= 4 caratteri
          if (parola.length >= 4) {
            const simile = trovaParolaSimile(parola);
            if (simile && simile.distanza <= 2) {
              correzione = simile.correzione;
            }
          }
        }

        // Se trova una correzione, applicala
        if (correzione && correzione !== parolaLower) {
          const regex = new RegExp(`\\b${parola.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
          correttedText = correttedText.replace(regex, correzione);
          
          report.push({
            original: parola,
            suggestion: correzione,
            message: 'Errore di ortografia',
            type: 'Ortografia'
          });
        }
      });

      // Applica sempre le correzioni locali (spazi, punteggiatura)
      correttedText = applicaCorrezioniLocali(correttedText);
      
      // Traccia le formattazioni (virgolette in corsivo)
      const matchesItalic = [...correttedText.matchAll(/"([^"]*)"/g)];
      matchesItalic.forEach(match => {
        report.push({
          original: match[0],
          suggestion: `<em>${match[0]}</em>`,
          message: 'Formattazione corsivo',
          type: 'Formattazione'
        });
      });
      
      // Traccia i cognomi/nomi propri
      // Escludiamo città e parole comuni italiane
      const esclusioni = new Set(['Il', 'La', 'Lo', 'I', 'Le', 'Gli', 'Un', 'Una', 'Uno', 'Di', 'Da', 'De', 'Per', 'Con', 'Su', 'Tra', 'Fra', 'A', 'E', 'O', 'Che', 'Chi', 'Cosa', 'Quando', 'Dove', 'Come', 'Quale', 'Roma', 'Milano', 'Napoli', 'Torino', 'Genova', 'Venezia', 'Bologna', 'Firenze', 'Palermo', 'Catania', 'Messina', 'Italia', 'Europa', 'Mondo', 'USA', 'UK', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']);
      
      // Lista cognomi F1, FE e Motorsport (per riconoscimento specifico)
      const cognomiMotorsport = new Set(['Verstappen', 'Hamilton', 'Leclerc', 'Alonso', 'Sainz', 'Perez', 'Norris', 'Piastri', 'Ocon', 'Stroll', 'Albon', 'Gasly', 'Bottas', 'Zhou', 'Magnussen', 'Ricciardo', 'Schumacher', 'Tsunoda', 'Hartley', 'Wolff', 'Vasseur', 'Horner', 'Binotto', 'Brown', 'Krack', 'Mekies', 'Smedley', 'Stella', 'Ferrari', 'Mercedes', 'Aston', 'Martin', 'Red', 'Bull', 'Racing', 'McLaren', 'Alpine', 'Sauber', 'Haas', 'Williams', 'Kick', 'Toro', 'Rosso', 'Alfa', 'Romeo', 'Monza', 'Silverstone', 'Spa', 'Monaco', 'Suzuka', 'Budapest', 'Brazil', 'Baku', 'Singapore', 'Austin', 'Mexico', 'Vegas', 'Abu', 'Dhabi', 'Giovinazzi', 'Latifi', 'Senna', 'Prost', 'Häkkinen', 'Villeneuve', 'Hill', 'Mansell', 'Pique', 'Rosberg', 'Button', 'Räikkönen', 'Webber', 'Barrichello', 'Rubens', 'Massa', 'Hulkenberg', 'Grosjean', 'Gutierrez', 'Maldonado', 'Kobayashi', 'Chandok', 'Glock', 'Sutil', 'Liuzzi', 'Buemi', 'Abt', 'Vergne', 'Félix', 'Mortara', 'Bird', 'Lynn', 'D\'Ambrosio', 'Lotterer', 'Turvey', 'Vanthoor', 'Blomqvist', 'Gunther', 'Frijns', 'Cassidy', 'Dillmann', 'Heidfeld', 'Piquet', 'Fittipaldi', 'Lauda', 'Jones', 'Hunt', 'Andretti', 'Unser', 'Damon', 'Ralf', 'Michael']);
      
      // Pattern 1: Nome Cognome
      const cognomiRegex = /\b([A-Z][a-zàèéìòù]+)\s+([A-Z][a-zàèéìòù]+)\b/g;
      let matchCognome;
      const cognomiTrovati = new Set();
      
      while ((matchCognome = cognomiRegex.exec(correttedText)) !== null) {
        const cognome = matchCognome[2];
        if (!esclusioni.has(cognome) && !cognomiTrovati.has(cognome) && cognome.length < 15 && !report.some(r => r.original === cognome)) {
          cognomiTrovati.add(cognome);
          report.push({
            original: cognome,
            suggestion: `<strong>${cognome}</strong>`,
            message: 'Nome proprio/Cognome',
            type: 'Formattazione'
          });
        }
      }
      
      // Pattern 2: Cognomi singoli (parole maiuscole lunghe >= 4 caratteri) O cognomi motorsport
      // Ma SOLO se non sono all'inizio di frase
      const cognomiSingoliRegex = /\b([A-Z][a-zàèéìòù]{3,})\b/g;
      while ((matchCognome = cognomiSingoliRegex.exec(correttedText)) !== null) {
        const cognome = matchCognome[1];
        const offset = matchCognome.index;
        const prevChar = offset > 0 ? correttedText[offset - 1] : ' ';
        
        // Marcarlo SOLO se è nei motorsport O se è preceduto da minuscola (non inizio frase)
        if (!esclusioni.has(cognome) && !cognomiTrovati.has(cognome) && !report.some(r => r.original === cognome)) {
          if (cognomiMotorsport.has(cognome) || /[a-zàèéìòù0-9]/.test(prevChar)) {
            cognomiTrovati.add(cognome);
            report.push({
              original: cognome,
              suggestion: `<strong>${cognome}</strong>`,
              message: 'Nome proprio/Cognome',
              type: 'Formattazione'
            });
          }
        }
      }
      
      // Traccia le parole chiave che saranno messe in grassetto
      const keywords = ['importante', 'essenziale', 'fondamentale', 'principale', 'significativo', 'determinante', 'cruciale', 'vitale', 'strategico'];
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matchesKeyword = [...correttedText.matchAll(regex)];
        matchesKeyword.forEach(match => {
          report.push({
            original: match[0],
            suggestion: `<strong>${match[0]}</strong>`,
            message: 'Formattazione grassetto',
            type: 'Formattazione'
          });
        });
      });
      
      // Formatta il testo
      const textFormattato = formattaTesto(correttedText);
      
      setOutputText(textFormattato);
      setErrorReport(report);
      setActiveTab('output');
      
      if (report.length === 0) {
        alert('Testo corretto! Nessun errore trovato.');
      } else {
        console.log(`${report.length} errori corretti`);
      }

    } catch (error) {
      console.error('Errore durante la correzione:', error);
      alert('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const applicaCorrezioniLocali = (text) => {
    // Correggi spazi multipli
    text = text.replace(/  +/g, ' ');
    
    // Correggi spazi prima di punteggiatura
    text = text.replace(/ +([.,;:!?])/g, '$1');
    
    // Aggiungi spazio dopo punteggiatura se mancante
    text = text.replace(/([.,;:!?])([^ \n])/g, '$1 $2');
    
    // Rimuovi paragrafi vuoti
    text = text.replace(/<p><\/p>/g, '');
    
    // Correggi " e " basato su contesto intelligente
    // Lista di aggettivi/participi comuni che seguono il verbo
    const aggettivi = ['in', 'a', 'di', 'da', 'per', 'con', 'un', 'una', 'uno', 'il', 'la', 'lo', 'i', 'le', 'gli', 'bello', 'buono', 'grande', 'piccolo', 'nuovo', 'vecchio', 'facile', 'difficile', 'importante', 'giusto', 'sbagliato', 'vero', 'falso', 'corretto', 'scorretto', 'corsivo', 'grassetto', 'sottolineato', 'rosso', 'blu', 'nero', 'bianco', 'giallo', 'verde', 'blu', 'porpora', 'rosa', 'arancione', 'marrone', 'grigio', 'argento', 'oro', 'lungo', 'corto', 'alto', 'basso', 'stretto', 'largo', 'profondo', 'superficiale', 'veloce', 'lento', 'forte', 'debole', 'dolce', 'amaro', 'salato', 'acido', 'caldo', 'freddo', 'tiepido', 'secco', 'bagnato', 'umido', 'asciutto'];
    
    text = text.replace(/\b([a-zàèéìòù]+)\s+e\s+([a-zA-Zàèéìòù]+)/gi, (match, p1, p2) => {
      // Se la parola dopo "e" è un aggettivo/preposizione/articolo/participio, usa "è"
      if (aggettivi.includes(p2.toLowerCase())) {
        return `${p1} è ${p2}`;
      }
      // Altrimenti mantieni "e"
      return match;
    });
    
    return text;
  };

  const formattaTesto = (text) => {
    let formattato = text;
    
    // Lista di esclusioni
    const esclusioni = new Set(['Il', 'La', 'Lo', 'I', 'Le', 'Gli', 'Un', 'Una', 'Uno', 'Di', 'Da', 'De', 'Per', 'Con', 'Su', 'Tra', 'Fra', 'A', 'E', 'O', 'Che', 'Chi', 'Cosa', 'Quando', 'Dove', 'Come', 'Quale', 'Roma', 'Milano', 'Napoli', 'Torino', 'Genova', 'Venezia', 'Bologna', 'Firenze', 'Palermo', 'Catania', 'Messina', 'Italia', 'Europa', 'Mondo', 'USA', 'UK', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica', 'Compagnia', 'Società', 'Azienda', 'Organizzazione', 'Ministero', 'Repubblica', 'Università', 'Ospedale', 'Tribunale', 'Commissione', 'Governo', 'Parlamento']);
    
    // Lista cognomi F1, FE e Motorsport
    const cognomiMotorsport = new Set(['Verstappen', 'Hamilton', 'Leclerc', 'Alonso', 'Sainz', 'Perez', 'Norris', 'Piastri', 'Ocon', 'Stroll', 'Albon', 'Gasly', 'Bottas', 'Zhou', 'Magnussen', 'Ricciardo', 'Schumacher', 'Tsunoda', 'Hartley', 'Wolff', 'Vasseur', 'Horner', 'Binotto', 'Brown', 'Krack', 'Mekies', 'Smedley', 'Stella', 'Ferrari', 'Mercedes', 'Aston', 'Martin', 'Red', 'Bull', 'Racing', 'McLaren', 'Alpine', 'Sauber', 'Haas', 'Williams', 'Kick', 'Toro', 'Rosso', 'Alfa', 'Romeo', 'Monza', 'Silverstone', 'Spa', 'Monaco', 'Suzuka', 'Budapest', 'Brazil', 'Baku', 'Singapore', 'Austin', 'Mexico', 'Vegas', 'Abu', 'Dhabi', 'Giovinazzi', 'Latifi', 'Senna', 'Prost', 'Häkkinen', 'Villeneuve', 'Hill', 'Mansell', 'Pique', 'Rosberg', 'Button', 'Räikkönen', 'Webber', 'Barrichello', 'Rubens', 'Massa', 'Hulkenberg', 'Grosjean', 'Gutierrez', 'Maldonado', 'Kobayashi', 'Chandok', 'Glock', 'Sutil', 'Liuzzi', 'Buemi', 'Abt', 'Vergne', 'Félix', 'Mortara', 'Bird', 'Lynn', 'D\'Ambrosio', 'Lotterer', 'Turvey', 'Vanthoor', 'Blomqvist', 'Gunther', 'Frijns', 'Cassidy', 'Dillmann', 'Heidfeld', 'Piquet', 'Fittipaldi', 'Lauda', 'Jones', 'Hunt', 'Andretti', 'Unser', 'Damon', 'Ralf', 'Michael']);

    // Formatta virgolette in corsivo
    formattato = formattato.replace(/"([^"]*)"/g, '<em>"$1"</em>');

    // Metti in grassetto i cognomi: pattern "Nome Cognome"
    formattato = formattato.replace(/\b([A-Z][a-zàèéìòù]+)\s+([A-Z][a-zàèéìòù]+)\b/g, (match, p1, p2) => {
      if (!esclusioni.has(p2) && p2.length < 15) {
        return `${p1} <strong>${p2}</strong>`;
      }
      return match;
    });

    // Metti in grassetto i cognomi singoli (parole maiuscole lunghe >= 4 O nei motorsport)
    // Ma SOLO se sono nel motorsport o se sono preceduti da minuscola (non all'inizio frase)
    formattato = formattato.replace(/\b([A-Z][a-zàèéìòù]{3,})\b/g, (match, p1, offset, str) => {
      if (!esclusioni.has(match) && !match.includes('<strong>')) {
        // Se è nella lista motorsport, marcalo sempre
        if (cognomiMotorsport.has(match)) {
          return `<strong>${match}</strong>`;
        }
        // Se è una parola generica, marcala SOLO se non è all'inizio di frase
        // (controllando il carattere prima - deve essere una minuscola o numero)
        const prevChar = offset > 0 ? str[offset - 1] : ' ';
        if (/[a-zàèéìòù0-9]/.test(prevChar)) {
          return `<strong>${match}</strong>`;
        }
      }
      return match;
    });

    // Aggiungi grassetto per parole chiave importanti
    const keywords = ['importante', 'essenziale', 'fondamentale', 'principale', 'significativo', 'determinante', 'cruciale', 'vitale', 'strategico'];
    keywords.forEach((keyword, index) => {
      if (index < 9) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        formattato = formattato.replace(regex, (match) => {
          if (!match.includes('<strong>')) {
            return `<strong>${match}</strong>`;
          }
          return match;
        });
      }
    });

    // Dividi in paragrafi se il testo è lungo
    const paragraphs = [];
    const sentences = formattato.split(/([.!?]+)/);
    let currentParagraph = '';

    for (let i = 0; i < sentences.length; i += 2) {
      currentParagraph += sentences[i] + (sentences[i + 1] || '');
      
      if (currentParagraph.length > 300) {
        paragraphs.push(`<p>${currentParagraph.trim()}</p>`);
        currentParagraph = '';
      }
    }

    if (currentParagraph.trim()) {
      paragraphs.push(`<p>${currentParagraph.trim()}</p>`);
    }

    return paragraphs.length > 1 ? paragraphs.join('') : `<p>${formattato}</p>`;
  };

  const copiaRisultato = () => {
    const plainText = outputText.replace(/<[^>]*>/g, '');
    navigator.clipboard.writeText(plainText);
    alert('Testo copiato negli appunti!');
  };

  const downloadRisultato = () => {
    const plainText = outputText.replace(/<[^>]*>/g, '');
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(plainText)}`);
    element.setAttribute('download', 'articolo_corretto.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        overflowY: 'auto'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '900px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '24px' }}>✏️ Correttore Articoli</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.9 }}>Correzioni automatiche + dizionario italiano</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#f5f5f5'
          }}
        >
          <button
            onClick={() => setActiveTab('input')}
            style={{
              flex: 1,
              padding: '15px',
              border: 'none',
              backgroundColor: activeTab === 'input' ? 'white' : 'transparent',
              color: activeTab === 'input' ? '#667eea' : '#999',
              cursor: 'pointer',
              fontWeight: activeTab === 'input' ? 'bold' : 'normal',
              borderBottom: activeTab === 'input' ? '3px solid #667eea' : 'none'
            }}
          >
            📝 Testo Originale
          </button>
          <button
            onClick={() => setActiveTab('output')}
            style={{
              flex: 1,
              padding: '15px',
              border: 'none',
              backgroundColor: activeTab === 'output' ? 'white' : 'transparent',
              color: activeTab === 'output' ? '#667eea' : '#999',
              cursor: 'pointer',
              fontWeight: activeTab === 'output' ? 'bold' : 'normal',
              borderBottom: activeTab === 'output' ? '3px solid #667eea' : 'none'
            }}
          >
            ✅ Testo Corretto
          </button>
          <button
            onClick={() => setActiveTab('report')}
            style={{
              flex: 1,
              padding: '15px',
              border: 'none',
              backgroundColor: activeTab === 'report' ? 'white' : 'transparent',
              color: activeTab === 'report' ? '#667eea' : '#999',
              cursor: 'pointer',
              fontWeight: activeTab === 'report' ? 'bold' : 'normal',
              borderBottom: activeTab === 'report' ? '3px solid #667eea' : 'none'
            }}
          >
            📋 Errori Trovati ({errorReport.length})
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px'
          }}
        >
          {activeTab === 'input' && (
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Incolla qui il tuo articolo da correggere..."
              style={{
                width: '100%',
                height: '400px',
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />
          )}

          {activeTab === 'output' && (
            <div>
              {outputText ? (
                <div
                  style={{
                    backgroundColor: '#f9f9f9',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    lineHeight: '1.8',
                    fontSize: '14px'
                  }}
                  dangerouslySetInnerHTML={{ __html: outputText }}
                />
              ) : (
                <p style={{ color: '#999', textAlign: 'center', paddingTop: '50px' }}>
                  Nessun testo corretto ancora. Correggi un testo per vederlo qui.
                </p>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div>
              {errorReport.length > 0 ? (
                <div>
                  {errorReport.map((error, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: '#fef5e7',
                        padding: '15px',
                        marginBottom: '12px',
                        borderRadius: '8px',
                        borderLeft: '4px solid #f39c12'
                      }}
                    >
                      <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                        ❌ {error.original} → ✅ {error.suggestion}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>
                        <strong>Tipo:</strong> {error.type}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                        <strong>Motivo:</strong> {error.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999', textAlign: 'center', paddingTop: '50px' }}>
                  Nessun errore trovato o nessun testo corretto ancora.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#f5f5f5',
            justifyContent: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={correggiTesto}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            {loading ? '⏳ Correzione in corso...' : '🔍 Correggi Testo'}
          </button>

          {outputText && (
            <>
              <button
                onClick={copiaRisultato}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                📋 Copia Testo
              </button>

              <button
                onClick={downloadRisultato}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                ⬇️ Scarica TXT
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

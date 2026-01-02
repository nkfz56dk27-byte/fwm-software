import React, { useState } from 'react';
import { elaboraTestoComeChatGPT } from './utils/textFormatter';

/**
 * Componente che elabora il testo esattamente come il prompt ChatGPT
 * Restituisce HTML elaborato e elenco modifiche apportate
 */
function TestoFormattato({ htmlInput, className = "", mostraModifiche = false }) {
  const [risultato, setRisultato] = useState(null);
  
  if (!htmlInput) return null;
  
  // Elabora il testo solo se non è già stato fatto
  if (!risultato || risultato.htmlOriginale !== htmlInput) {
    const elaborato = elaboraTestoComeChatGPT(htmlInput);
    setRisultato({
      htmlOriginale: htmlInput,
      htmlElaborato: elaborato.htmlElaborato,
      modifiche: elaborato.modifiche
    });
  }
  
  if (!risultato) return null;
  
  return (
    <div className={`testo-formattato ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: risultato.htmlElaborato }} />
      
      {mostraModifiche && risultato.modifiche.length > 0 && (
        <div className="modifiche-apportate">
          <h4>Modifiche apportate:</h4>
          <ul>
            {risultato.modifiche.map((modifica, index) => (
              <li key={index}>{modifica}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TestoFormattato;

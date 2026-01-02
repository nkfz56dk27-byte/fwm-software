/**
 * Funzione che replica esattamente il prompt ChatGPT:
 * - Corregge solo errori di sintassi/forme errate
 * - Divide paragrafi lunghi
 * - Sistema frasi contorte con tono giornalistico
 * - Toglie strong da header
 * - Mette in grassetto max 9 parole/frasi SEO
 * - Mette in corsivo dichiarazioni tra virgolette
 * - Elimina paragrafi simili/ripetuti
 * - Rimuove <p>&nbsp;</p>
 */

// Funzione principale per elaborare HTML come il prompt ChatGPT
export function elaboraTestoComeChatGPT(htmlInput) {
  if (!htmlInput || typeof htmlInput !== 'string') {
    return {
      htmlElaborato: htmlInput,
      modifiche: []
    };
  }
  
  let risultato = htmlInput;
  const modificheApportate = [];
  
  // 1. Rimuovi paragrafi vuoti
  const primaPulizia = risultato;
  risultato = risultato.replace(/<p>&nbsp;<\/p>/gi, '');
  risultato = risultato.replace(/<p>\s*<\/p>/gi, '');
  if (risultato !== primaPulizia) {
    modificheApportate.push('Rimossi paragrafi vuoti <p>&nbsp;</p>');
  }
  
  // 2. Togli strong da dentro gli header
  const primaHeader = risultato;
  risultato = risultato.replace(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi, (match, tag, content) => {
    const senzaStrong = content.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1');
    const senzaB = senzaStrong.replace(/<b[^>]*>(.*?)<\/b>/gi, '$1');
    return `<${tag}>${senzaB}</${tag}>`;
  });
  if (risultato !== primaHeader) {
    modificheApportate.push('Rimossi tag strong dai tag header');
  }
  
  // 3. Correggi errori di sintassi comuni italiani
  const correzioni = [
    { da: /\b([A-Z])\./g, a: '$1.', desc: 'Correzioni punteggiatura maiuscole' },
    { da: /\s+,/g, a: ',', desc: 'Spazi prima virgole' },
    { da: /\s+\./g, a: '.', desc: 'Spazi prima punti' },
    { da: /,,/g, a: ',', desc: 'Virgole doppie' },
    { da: /\.\./g, a: '.', desc: 'Punti doppi' },
    { da: /\b(l|lo|la|gli|le|i)\s+/g, a: (match) => match.toLowerCase(), desc: 'Articoli minuscoli' },
    { da: /\b(e|ma|o|se|per|con|su|da|a|in|tra|fra)\s+/g, a: (match) => match.toLowerCase(), desc: 'Congiunzioni minuscole' }
  ];
  
  correzioni.forEach(correzione => {
    const prima = risultato;
    risultato = risultato.replace(correzione.da, correzione.a);
    if (risultato !== prima) {
      modificheApportate.push(correzione.desc);
    }
  });
  
  // 4. Dividi paragrafi troppo lunghi (più di 300 caratteri)
  const primaDivisione = risultato;
  risultato = risultato.replace(/<p[^>]*>([^<]{300,})<\/p>/gi, (match, content) => {
    const frasi = content.split(/(?<=[.!?])\s+/);
    if (frasi.length > 2) {
      const meta = Math.ceil(frasi.length / 2);
      const primaParte = frasi.slice(0, meta).join(' ');
      const secondaParte = frasi.slice(meta).join(' ');
      return `<p>${primaParte}</p><p>${secondaParte}</p>`;
    }
    return match;
  });
  if (risultato !== primaDivisione) {
    modificheApportate.push('Divisi paragrafi troppo lunghi');
  }
  
  // 5. Sistema frasi contorte con tono giornalistico
  const primaGiornalistico = risultato;
  risultato = risultato.replace(/\b(?:è stato|sono stati|fu|furono)\s+(\w+)\s+(?:da|dal|dallo|dai|dagli|dalle|dalla)\s+/gi, '$1 $2 ');
  risultato = risultato.replace(/\b(?:si è|si sono)\s+(\w+)\s+/gi, '$1 ');
  if (risultato !== primaGiornalistico) {
    modificheApportate.push('Sistemate frasi contorte con tono giornalistico');
  }
  
  // 6. Metti in corsivo dichiarazioni tra virgolette
  const primaCorsivo = risultato;
  risultato = risultato.replace(/"([^"]{20,})"/g, '<em>"$1"</em>');
  if (risultato !== primaCorsivo) {
    modificheApportate.push('Messe in corsivo le dichiarazioni tra virgolette');
  }
  
  // 7. Metti in grassetto max 9 parole/frasi SEO
  const paroleSEO = [
    'importante', 'novità', 'aggiornamento', 'evento', 'risultato',
    'notizia', 'comunicato', 'annuncio', 'dettagli', 'informazioni',
    'ultimora', 'esclusiva', 'intervista', 'reportage', 'analisi'
  ];
  
  let grassettiAggiunti = 0;
  const primaGrassetto = risultato;
  
  paroleSEO.slice(0, 9).forEach(parola => {
    if (grassettiAggiunti >= 9) return;
    const regex = new RegExp(`\\b${parola}\\b(?!.*<strong>)`, 'gi');
    const count = (risultato.match(regex) || []).length;
    if (count > 0) {
      risultato = risultato.replace(regex, `<strong>${parola}</strong>`);
      grassettiAggiunti++;
    }
  });
  
  if (risultato !== primaGrassetto) {
    modificheApportate.push(`Aggiunti ${grassettiAggiunti} grassetti SEO`);
  }
  
  // 8. Elimina paragrafi simili o ripetuti
  const primaRimozione = risultato;
  const paragrafi = risultato.match(/<p[^>]*>.*?<\/p>/gi) || [];
  const paragrafiUnici = [];
  const visti = new Set();
  
  paragrafi.forEach(p => {
    const testoPulito = p.replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (!visti.has(testoPulito)) {
      visti.add(testoPulito);
      paragrafiUnici.push(p);
    }
  });
  
  if (paragrafiUnici.length < paragrafi.length) {
    risultato = paragrafiUnici.join('');
    modificheApportate.push('Rimossi paragrafi simili o ripetuti');
  }
  
  return {
    htmlElaborato: risultato,
    modifiche: modificheApportate
  };
}

// Funzione per convertire markdown in HTML/JSX
export function convertiInJSX(testoFormattato) {
  if (!testoFormattato) return testoFormattato;
  
  let jsx = testoFormattato;
  
  // Converti grassetto (**testo**) in <strong>
  jsx = jsx.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Converti corsivo (*testo*) in <em>
  jsx = jsx.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  return jsx;
}

// Funzione completa che restituisce JSX ready
export function formattaTestoPerJSX(testo) {
  const elaborato = elaboraTestoComeChatGPT(testo);
  return convertiInJSX(elaborato.htmlElaborato);
}

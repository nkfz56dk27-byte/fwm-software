// Source Analyzer - Utilità per analizzare e classificare le fonti degli articoli
// Supporta italiano e inglese con analisi intelligente

// Pattern per rilevare citazioni di altre fonti nel testo
const CITATION_PATTERNS = {
  it: [
    /secondo\s+(?:quanto\s+)?(?:riportato\s+da\s+)?([a-zA-Z\s]+)/gi,
    /riportato\s+da\s+([a-zA-Z\s]+)/gi,
    /citato\s+da\s+([a-zA-Z\s]+)/gi,
    /fonte:\s*([a-zA-Z\s]+)/gi,
    /stando\s+a\s+([a-zA-Z\s]+)/gi,
    /come\s+riportato\s+da\s+([a-zA-Z\s]+)/gi
  ],
  en: [
    /according\s+to\s+([a-zA-Z\s]+)/gi,
    /reported\s+by\s+([a-zA-Z\s]+)/gi,
    /via\s+([a-zA-Z\s]+)/gi,
    /source:\s*([a-zA-Z\s]+)/gi,
    /citing\s+([a-zA-Z\s]+)/gi,
    /as\s+reported\s+by\s+([a-zA-Z\s]+)/gi,
    /per\s+([a-zA-Z\s]+)/gi
  ]
};

// Fonti note (per evitare false positives)
const KNOWN_SOURCES = [
  'sky sport', 'sky sports', 'motorsport.com', 'motorsport',
  'formula1.com', 'fia.com', 'f1tv',
  'corriere dello sport', 'gazzetta dello sport',
  'autosport', 'autocar', 'car and driver',
  'bbc sport', 'espn', 'the race', 'racing news',
  'gpblog', 'crash.net', 'planetf1'
];

// Dizionario di equivalenze italiano-inglese per F1
const KEYWORD_TRANSLATIONS = {
  // Parole generali F1
  'livrea': 'livery',
  'livery': 'livery',
  'presentazione': 'launch',
  'presentation': 'launch',
  'launch': 'launch',
  'lancio': 'launch',
  'rivela': 'reveal',
  'reveals': 'reveal',
  'reveal': 'reveal',
  'mostra': 'show',
  'shows': 'show',
  'show': 'show',
  'svela': 'unveil',
  'unveils': 'unveil',
  'unveil': 'unveil',
  'stagione': 'season',
  'season': 'season',
  'pilota': 'driver',
  'driver': 'driver',
  'drivers': 'driver',
  'team': 'team',
  'squadra': 'team',
  'macchina': 'car',
  'vettura': 'car',
  'car': 'car',
  'gara': 'race',
  'race': 'race',
  'circuito': 'circuit',
  'circuit': 'circuit',
  'pista': 'track',
  'track': 'track',
  'test': 'test',
  'prove': 'test',
  'testing': 'test',
  'campionato': 'championship',
  'championship': 'championship',
  'mondiale': 'championship',
  'vittoria': 'victory',
  'victory': 'victory',
  'podio': 'podium',
  'podium': 'podium',
  'pole': 'pole',
  'qualifiche': 'qualifying',
  'qualifying': 'qualifying',
  'motore': 'engine',
  'engine': 'engine',
  'power': 'power',
  'potenza': 'power',
  'aerodinamica': 'aerodynamic',
  'aerodynamic': 'aerodynamic',
  'aero': 'aero',
  'velocità': 'speed',
  'speed': 'speed',
  'performance': 'performance',
  'prestazione': 'performance',
  'prestazioni': 'performance',
  'regolamento': 'regulation',
  'regulations': 'regulation',
  'regulation': 'regulation',
  'regole': 'rule',
  'rules': 'rule',
  'rule': 'rule',
  'annuncio': 'announcement',
  'announcement': 'announcement',
  'announce': 'announce',
  'annuncia': 'announce',
  'announces': 'announce',
  'conferma': 'confirm',
  'confirms': 'confirm',
  'confirm': 'confirm',
  'confirmed': 'confirm',
  
  // Team F1 (già uguali ma li normalizziamo)
  'alpine': 'alpine',
  'ferrari': 'ferrari',
  'mercedes': 'mercedes',
  'redbull': 'redbull',
  'mclaren': 'mclaren',
  'aston': 'aston',
  'williams': 'williams',
  'haas': 'haas',
  'sauber': 'sauber',
  'racing': 'racing',
  'bull': 'bull',
  'martin': 'martin',
  
  // Anni e numeri (già uguali)
  '2024': '2024',
  '2025': '2025',
  '2026': '2026',
  '2027': '2027'
};

// Normalizza una parola usando il dizionario di traduzioni
function normalizeKeyword(word) {
  const lower = word.toLowerCase();
  return KEYWORD_TRANSLATIONS[lower] || lower;
}

// Estrae parole chiave importanti da un testo e le normalizza
function extractKeywords(text) {
  try {
    if (!text || typeof text !== 'string') return [];
    
    // Parole comuni da escludere
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
      'il', 'lo', 'la', 'le', 'i', 'gli', 'un', 'uno', 'una', 'dei', 'degli', 'delle', 'del',
      'e', 'o', 'ma', 'in', 'su', 'a', 'per', 'con', 'da', 'di', 'che', 'non', 'si',
      'è', 'sono', 'stato', 'stata', 'fatto', 'fatta', 'hanno', 'ha', 'avrà', 'avrebbe'
    ]);
    
    // Dividi il testo in parole significative
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
    
    // NORMALIZZA le parole usando il dizionario di traduzioni
    // Così "livery" e "livrea" diventano entrambi "livery"
    const normalizedWords = words.map(word => normalizeKeyword(word));
    
    return [...new Set(normalizedWords)]; // Rimuovi duplicati
  } catch (error) {
  // ...log rimosso...
    return [];
  }
}

// Trova articoli simili basati su contenuto
function findSimilarArticles(currentArticle, allArticles) {
  try {
    if (!currentArticle || !allArticles || allArticles.length === 0) return [];
    
    const currentText = `${currentArticle.title || ''} ${currentArticle.description || ''} ${currentArticle.content || ''}`;
    const currentKeywords = extractKeywords(currentText);
    
    if (currentKeywords.length === 0) return [];
    
  console.log(`🔍 Cerco articoli simili a: "${currentArticle.title}"`);
  console.log(`📝 Parole chiave normalizzate:`, currentKeywords.slice(0, 10).join(', '));
    
    const similarArticles = [];
    
    for (const other of allArticles) {
      // Salta se stesso
      if (other.id === currentArticle.id) continue;
      
      const otherText = `${other.title || ''} ${other.description || ''} ${other.content || ''}`;
      const otherKeywords = extractKeywords(otherText);
      
      // Conta parole chiave in comune (ora normalizzate!)
      const commonKeywords = currentKeywords.filter(keyword => 
        otherKeywords.includes(keyword)
      );
      
      // Soglia: almeno 3 parole chiave normalizzate in comune
      // Con la normalizzazione, "alpine livery 2026" ITA = "alpine livery 2026" ENG
      const similarityThreshold = 3;
      
      if (commonKeywords.length >= similarityThreshold) {
        similarArticles.push({
          article: other,
          similarity: commonKeywords.length,
          commonKeywords: commonKeywords
        });
  // ...log rimosso...
  // ...log rimosso...
      }
    }
    
    // Ordina per similarità decrescente
    similarArticles.sort((a, b) => b.similarity - a.similarity);
    
    // ...log rimosso...
    
    return similarArticles;
  } catch (error) {
    // ...log rimosso...
    return [];
  }
}

// Cerca citazioni di altre fonti nel testo
function findSourceCitations(text) {
  const citations = [];
  
  try {
    if (!text) return citations;
    
    // Cerca pattern italiani
    CITATION_PATTERNS.it.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          const source = match[1].trim().toLowerCase();
          // Verifica che sia una fonte nota
          const isKnownSource = KNOWN_SOURCES.some(known => 
            source.includes(known) || known.includes(source)
          );
          if (isKnownSource) {
            citations.push(source);
          }
        }
      });
    });
    
    // Cerca pattern inglesi
    CITATION_PATTERNS.en.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          const source = match[1].trim().toLowerCase();
          // Verifica che sia una fonte nota
          const isKnownSource = KNOWN_SOURCES.some(known => 
            source.includes(known) || known.includes(source)
          );
          if (isKnownSource) {
            citations.push(source);
          }
        }
      });
    });
    
    return [...new Set(citations)]; // Rimuovi duplicati
  } catch (error) {
  // ...log rimosso...
    return citations;
  }
}

// Analizza se un articolo è ESCLUSIVA
function analyzeExclusivity(article, sourceName, similarArticles) {
  try {
    const fullText = `${article.title || ''} ${article.description || ''} ${article.content || ''}`;
    
    // 1. Cerca citazioni esplicite di altre fonti
    const citations = findSourceCitations(fullText);
    
    if (citations.length > 0) {
  // ...log rimosso...
      return {
        isExclusive: false,
        reason: `Cita altre fonti: ${citations.join(', ')}`,
        citedSources: citations
      };
    }
    
    // 2. Cerca la parola "EXCLUSIVE" o "ESCLUSIVA"
    const hasExclusiveTag = /\b(exclusive|esclusiva)\b/gi.test(fullText);
    
    if (hasExclusiveTag) {
  // ...log rimosso...
      return {
        isExclusive: true,
        reason: 'Marcato come ESCLUSIVA',
        citedSources: []
      };
    }
    
    // 3. Verifica se altri hanno già pubblicato PRIMA lo stesso contenuto
    if (similarArticles && similarArticles.length > 0) {
      const currentDate = new Date(article.pub_date || new Date());
      
      const earlierArticles = similarArticles.filter(sim => {
        const otherDate = new Date(sim.article.pub_date || new Date());
        return otherDate < currentDate;
      });
      
      if (earlierArticles.length > 0) {
        const earliest = earlierArticles[0];
  // ...log rimosso...
        return {
          isExclusive: false,
          reason: `Altri hanno già pubblicato (${earliest.article.feedSource})`,
          citedSources: [earliest.article.feedSource]
        };
      }
    }
    
    // Se arriviamo qui, potrebbe essere esclusiva
  // ...log rimosso...
    return {
      isExclusive: true,
      reason: 'Contenuto originale (nessuna citazione)',
      citedSources: []
    };
    
  } catch (error) {
  // ...log rimosso...
    return {
      isExclusive: false,
      reason: 'Errore analisi',
      citedSources: []
    };
  }
}

// Analizza se un articolo è PRIMO a riportare
function analyzeFirstToReport(article, similarArticles) {
  try {
    if (!similarArticles || similarArticles.length === 0) {
  // ...log rimosso...
      return {
        isFirst: true,
        reason: 'Primo a riportare (nessun articolo simile)'
      };
    }
    
    const currentDate = new Date(article.pub_date || new Date());
    
    // Ordina gli articoli simili per data
    const sortedSimilar = [...similarArticles].sort((a, b) => {
      const dateA = new Date(a.article.pub_date || new Date());
      const dateB = new Date(b.article.pub_date || new Date());
      return dateA - dateB; // Dal più vecchio al più recente
    });
    
    const earliest = sortedSimilar[0];
    const earliestDate = new Date(earliest.article.pub_date || new Date());
    
    // ...log rimosso...
    // ...log rimosso...
    // ...log rimosso...
    
    // Verifica se questo articolo è il più vecchio
    if (currentDate <= earliestDate) {
      // ...log rimosso...
      return {
        isFirst: true,
        reason: `Primo a riportare (${currentDate.toLocaleString()})`
      };
    } else {
      // ...log rimosso...
      return {
        isFirst: false,
        reason: `${earliest.article.feedSource} ha pubblicato prima (${earliestDate.toLocaleString()})`
      };
    }
    
  } catch (error) {
  console.error('❌ Errore in analyzeFirstToReport:', error);
    return {
      isFirst: false,
      reason: 'Errore analisi'
    };
  }
}

// Funzione principale di analisi
export function analyzeSource(article, sourceName, allArticles = []) {
  // ...log rimosso...
  // ...log rimosso...
  
  if (!article || !sourceName) {
    return {
      isOriginal: false,
      confidence: 0,
      reason: 'Dati mancanti',
      attributedSources: [],
      markers: [],
      isExclusivity: false,
      isFirstToReport: false
    };
  }
  
  try {
    // 1. Trova articoli simili
    const similarArticles = findSimilarArticles(article, allArticles);
    
    // 2. Analizza ESCLUSIVA
    const exclusivityResult = analyzeExclusivity(article, sourceName, similarArticles);
    
    // 3. Analizza PRIMO
    const firstResult = analyzeFirstToReport(article, similarArticles);
    
    // 4. Costruisci risultato finale
    const result = {
      isOriginal: exclusivityResult.isExclusive,
      confidence: exclusivityResult.isExclusive ? 0.9 : 0.1,
      reason: exclusivityResult.reason,
      attributedSources: exclusivityResult.citedSources,
      markers: [],
      isExclusivity: exclusivityResult.isExclusive,
      isFirstToReport: firstResult.isFirst
    };
    
    // Aggiungi markers
    if (result.isExclusivity) result.markers.push('exclusivity');
    if (result.isFirstToReport) result.markers.push('first_to_report');
    
    // Combina reasons
    if (firstResult.isFirst) {
      result.reason += ` | ${firstResult.reason}`;
    } else if (!exclusivityResult.isExclusive) {
      result.reason += ` | ${firstResult.reason}`;
    }
    
    // ...log rimosso...
    
    return result;
    
  } catch (error) {
    // ...log rimosso...
    return {
      isOriginal: false,
      confidence: 0,
      reason: 'Errore analisi',
      attributedSources: [],
      markers: [],
      isExclusivity: false,
      isFirstToReport: false
    };
  }
}

// Funzione helper per ottenere una classe CSS basata sul risultato
export function getSourceClass(analysisResult) {
  if (analysisResult.isOriginal && analysisResult.confidence > 0.8) {
    return 'source-original-high';
  } else if (analysisResult.isOriginal) {
    return 'source-original-medium';
  } else {
    return 'source-secondary';
  }
}

// Funzione helper per ottenere l'etichetta da mostrare
export function getSourceLabel(analysisResult) {
  if (analysisResult.isExclusivity) {
    return '🎯 ESCLUSIVA';
  } else if (analysisResult.isFirstToReport) {
    return '🥇 PRIMO';
  } else if (analysisResult.isOriginal) {
    return '📰 ORIGINALE';
  } else {
    return '📋 RIPRESA';
  }
}

export default {
  analyzeSource,
  getSourceClass,
  getSourceLabel
};

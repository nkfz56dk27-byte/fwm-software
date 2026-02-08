// Source Analyzer - Versione semplificata per debug
export function analyzeSource(article, sourceName, allArticles = []) {
  console.log('🚀 analyzeSource SEMPLIFICATO chiamato per:', article?.title);
  
  if (!article || !sourceName) {
    return {
      isOriginal: false,
      confidence: 0,
      reason: 'Dati mancanti',
      language: 'en',
      attributedSources: [],
      markers: [],
      isExclusivity: false,
      isFirstToReport: false
    };
  }
  
  const { title = '', content = '', description = '', pub_date = '' } = article;
  const fullText = `${title || ''} ${description || ''} ${content || ''}`.toLowerCase();
  
  const result = {
    isOriginal: false,
    confidence: 0,
    reason: '',
    language: 'en',
    attributedSources: [],
    markers: [],
    isExclusivity: false,
    isFirstToReport: false
  };
  
  // TEST: Badge "PRIMO" per articoli con "alpine" nel titolo
  if (title.toLowerCase().includes('alpine')) {
    result.isFirstToReport = true;
    result.isOriginal = true;
    result.confidence = 0.9;
    result.reason = 'TEST - Badge PRIMO per articolo Alpine';
    console.log('🏆 TEST FORZATO: Badge PRIMO per articolo Alpine');
  }
  
  // TEST: Badge "ORIGINALE" per articoli con "exclusive"
  if (fullText.includes('exclusive')) {
    result.isOriginal = true;
    result.isExclusivity = true;
    result.confidence = 0.95;
    result.reason = result.reason || 'TEST - Badge ORIGINALE per articolo con exclusive';
    console.log('🎯 TEST FORZATO: Badge ORIGINALE per articolo con exclusive');
  }
  
  console.log('✅ Risultato analyzeSource semplificato:', {
    title,
    isOriginal: result.isOriginal,
    isFirstToReport: result.isFirstToReport,
    reason: result.reason
  });
  
  return result;
}

export function getSourceClass(analysisResult) {
  return 'source-test';
}

export function getSourceLabel(analysisResult) {
  return 'TEST';
}

export function detectLanguage(text) {
  return 'en';
}

export default {
  analyzeSource,
  getSourceClass,
  getSourceLabel,
  detectLanguage
};

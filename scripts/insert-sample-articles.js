import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vfflpwrneminmnzmmwtu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZmxwd3JuZW1pbm1uem1td3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODgyNjIsImV4cCI6MjA4MTY2NDI2Mn0.cRRwVLjMaYpuK_z2x-pp_yplZtW6aUz9W8bdbZ0LL4I'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const sampleArticles = [
  {
    title: 'F1. Ferrari SF-26, Gualtieri: "Rapporto di compressione sulle Power Unit? Ne discutiamo con la FIA"',
    link: 'https://www.automoto.it/formula1/f1-ferrari-sf-26-ne-discutiamo-con-la-fia.html',
    description: 'Il responsabile del progetto del nuovo propulsore Ferrari spiega il rapporto con la FIA.',
    pub_date: '2026-01-23T18:05:22.440Z',
    guid: '249875',
    feed_id: '3a5daa08-b266-489a-963e-796d8ad26338'
  },
  {
    title: 'F1. Il DT Ferrari Loïc Serra: "Con le nuove regole..."',
    link: 'https://www.automoto.it/formula1/f1-il-dt-ferrari-nuove-regole.html',
    description: "Secondo il responsabile dell'Area Tecnica della Scuderia, lo sviluppo della SF-26 sarà fondamentale.",
    pub_date: '2026-01-23T17:08:59.653Z',
    guid: '249885',
    feed_id: '3a5daa08-b266-489a-963e-796d8ad26338'
  }
]

async function insertArticles() {
  const { data, error } = await supabase.from('rss_articles').insert(sampleArticles)
  if (error) {
    console.error('INSERT error:', error)
    process.exit(2)
  }
  // ...log inserted articles rimosso...

  // Stampa tutti gli articoli
  const { data: allArticles, error: selectError } = await supabase.from('rss_articles').select('*').order('pub_date', { ascending: false }).limit(10)
  if (selectError) {
    console.error('SELECT error:', selectError)
    process.exit(3)
  }
  // ...log ultimi articoli rimosso...
  allArticles.forEach(a => {
    // ...log titolo articolo rimosso...
  })
}

insertArticles()

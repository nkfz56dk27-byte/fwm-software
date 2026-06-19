import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vfflpwrneminmnzmmwtu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZmxwd3JuZW1pbm1uem1td3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODgyNjIsImV4cCI6MjA4MTY2NDI2Mn0.cRRwVLjMaYpuK_z2x-pp_yplZtW6aUz9W8bdbZ0LL4I'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function insertSample() {
  const payload = {
    id: Date.now().toString(),
    nomeGP: 'Test GP',
    date: '1-3 Gen 2026',
    redattori: ['Test'],
    articoli: [],
    dataCreazione: new Date().toISOString(),
    conferme: [],
    modifiche: []
  }
  const rowId = Number(Date.now())
  const { data, error } = await supabase.from('disponibilita_weekend').insert([{ id: rowId, payload: JSON.stringify(payload), nome_gp: payload.nomeGP }])
  if (error) {
    console.error('INSERT error:', error)
    process.exit(2)
  }
  // ...log inserted rimosso...
}

insertSample()

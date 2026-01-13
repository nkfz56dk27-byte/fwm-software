import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vfflpwrneminmnzmmwtu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZmxwd3JuZW1pbm1uem1td3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODgyNjIsImV4cCI6MjA4MTY2NDI2Mn0.cRRwVLjMaYpuK_z2x-pp_yplZtW6aUz9W8bdbZ0LL4I'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function query(id) {
  const { data, error } = await supabase.from('disponibilita_weekend').select('*').eq('id', id)
  if (error) {
    console.error('Error querying:', error)
    process.exit(2)
  }
  console.log('Found rows:', data)
}

const id = Number(process.argv[2] || 0)
if (!id) { console.error('Usage: node query-weekend-by-id.js <id>'); process.exit(1) }
query(id)

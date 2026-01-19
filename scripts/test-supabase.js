import { createClient } from '@supabase/supabase-js'

// Valori presi da src/supabaseClient.js
const supabaseUrl = 'https://vfflpwrneminmnzmmwtu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZmxwd3JuZW1pbm1uem1td3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODgyNjIsImV4cCI6MjA4MTY2NDI2Mn0.cRRwVLjMaYpuK_z2x-pp_yplZtW6aUz9W8bdbZ0LL4I'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log('Testing Supabase connection...')
  try {
    const { data, error } = await supabase.from('disponibilita_weekend').select('*').limit(5)
    if (error) {
      console.error('Supabase returned error:', error)
      process.exit(2)
    }
    console.log('Success: fetched rows count =', (data && data.length) || 0)
    console.log(data)
    process.exit(0)
  } catch (e) {
    console.error('Connection failed:', e)
    process.exit(1)
  }
}

test()

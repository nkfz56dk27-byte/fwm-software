
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vfflpwrneminmnzmmwtu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZmxwd3JuZW1pbm1uem1td3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODgyNjIsImV4cCI6MjA4MTY2NDI2Mn0.cRRwVLjMaYpuK_z2x-pp_yplZtW6aUz9W8bdbZ0LL4I'

// Determina il comportamento: mobile usa localStorage, desktop NON persiste la sessione
const isMobileDevice = window.innerWidth <= 768

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isMobileDevice, // false su desktop, true su mobile
    storage: isMobileDevice ? window.localStorage : window.sessionStorage,
    storageKey: 'supabase.auth.token',
    detectSessionInUrl: true,
    flow: 'pkce'
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
})

// Espone supabase come variabile globale per debug da console browser
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

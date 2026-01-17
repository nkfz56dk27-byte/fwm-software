#!/usr/bin/env node

// Script per mandare notifiche via Supabase (senza Firebase service account)
// Usa: node scripts/send-notification-supabase.js

import { createClient } from '@supabase/supabase-js'

// Carica le variabili d'ambiente da .env o usa quelle hardcoded
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ihhuagtiyqidlsvwgkkf.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRORE: Manca la chiave di servizio Supabase')
  console.error('📝 Imposta la variabile di ambiente:')
  console.error('   export SUPABASE_SERVICE_ROLE_KEY="la-tua-chiave"')
  console.error('   node scripts/send-notification-supabase.js')
  process.exit(1)
}

// Crea il client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function sendTestNotification() {
  try {
    console.log('📤 Creando notifica di prova...')
    
    // Inserisci una notifica nella tabella push_notifications
    const { data, error } = await supabase
      .from('push_notifications')
      .insert([
        {
          title: '🔔 Notifica di Prova',
          body: 'Questa è una notifica di test da Supabase!',
          notification_type: 'test',
          target_all: true,
          created_at: new Date().toISOString(),
          status: 'pending'
        }
      ])
      .select()

    if (error) {
      console.error('❌ Errore nell\'inserimento:', error.message)
      process.exit(1)
    }

    console.log('✅ Notifica creata con successo!')
    console.log('🆔 Notification ID:', data[0].id)
    console.log('📱 Destinatari: Tutti gli utenti')
    console.log('\n💡 Controlla il Notification Center del tuo dispositivo')
    
  } catch (error) {
    console.error('❌ Errore:', error.message)
    process.exit(1)
  }
}

sendTestNotification()

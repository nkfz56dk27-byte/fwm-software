// API per notifiche push native bypassando OneSignal
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, body, url = '/', data = {} } = req.body;

  try {
    const supabase = getSupabaseClient();
    
    // 1. Trova tutti i dispositivi attivi
    const { data: devices, error: errDevices } = await supabase
      .from('push_devices')
      .select('*')
      .eq('attivo', true);
    
    if (errDevices) {
      throw new Error(`Errore dispositivi: ${errDevices.message}`);
    }
    
    console.log(`📱 Trovati ${devices?.length || 0} dispositivi attivi`);
    
    if (!devices || devices.length === 0) {
      return res.status(200).json({ 
        success: false, 
        message: 'Nessun dispositivo attivo trovato' 
      });
    }
    
    // 2. Inserisci notifica nella tabella per realtime delivery
    const notifications = devices.map(device => ({
      destinatario: device.username,
      titolo: title,
      messaggio: body,
      url: url,
      data: data,
      letta: false
    }));
    
    const { error: errInsert } = await supabase
      .from('notifiche_push')
      .insert(notifications);
    
    if (errInsert) {
      throw new Error(`Errore inserimento notifiche: ${errInsert.message}`);
    }
    
    console.log(`✅ Notifica inserita per ${devices.length} utenti`);
    
    // 3. Trigger realtime event per tutti i dispositivi
    devices.forEach(device => {
      // Il canale realtime è basato su username
      const channel = `notifications_${device.username}`;
      console.log(`📡 Canale realtime: ${channel}`);
    });
    
    return res.status(200).json({ 
      success: true, 
      message: `Notifica inviata a ${devices.length} dispositivi`,
      devicesCount: devices.length
    });
    
  } catch (error) {
    console.error('❌ Errore notifica nativa:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
// Gestione dispositivi e player_id OneSignal per notifiche per-dispositivo
import { supabase } from './supabaseClient'
import { getPlayerId } from './onesignal'

// Device ID corrente (generato una volta e salvato)
let currentDeviceId = null

/**
 * Genera un device ID unico e persistente
 * @returns {string}
 */
function generateDeviceId() {
  // Controlla se già esiste in localStorage
  let deviceId = localStorage.getItem('fwm_device_id')
  
  if (!deviceId) {
    // Genera nuovo ID basato su fingerprint del dispositivo
    const fingerprint = `${navigator.userAgent}-${screen.width}x${screen.height}-${navigator.language}`
    deviceId = btoa(fingerprint + Date.now()).substring(0, 32)
    localStorage.setItem('fwm_device_id', deviceId)
  }
  
  return deviceId
}

/**
 * Ottieni il device ID corrente
 * @returns {string}
 */
export function getCurrentDeviceId() {
  if (!currentDeviceId) {
    currentDeviceId = generateDeviceId()
  }
  return currentDeviceId
}

/**
 * Rileva il tipo di dispositivo
 * @returns {string} 'mobile', 'tablet', o 'desktop'
 */
export function getDeviceType() {
  const ua = navigator.userAgent.toLowerCase()
  
  if (/(iphone|ipod|android.*mobile)/i.test(ua)) {
    return 'mobile'
  } else if (/(ipad|android(?!.*mobile))/i.test(ua)) {
    return 'tablet'
  } else {
    return 'desktop'
  }
}

/**
 * Salva o aggiorna il dispositivo corrente su Supabase
 * @param {string} username - Username dell'utente
 * @param {string} playerId - Player ID OneSignal (opzionale)
 * @returns {Promise<boolean>}
 */
export async function saveCurrentDevice(username, playerId = null) {
  try {
    const deviceId = getCurrentDeviceId()
    const deviceType = getDeviceType()
    
    console.log('💾 Salvo dispositivo su Supabase:', {
      username,
      deviceId,
      deviceType,
      playerId
    })
    
    // Se playerId non fornito, prova a recuperarlo
    if (!playerId) {
      playerId = await getPlayerId()
    }
    
    const deviceData = {
      username: username,
      device_id: deviceId,
      device_type: deviceType,
      device_info: navigator.userAgent,
      player_id: playerId,
      notifications_enabled: true,
      last_active: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('user_preferences')
      .upsert(deviceData, {
        onConflict: 'device_id'
      })
    
    if (error) {
      console.error('❌ Errore salvataggio device:', error)
      return false
    }
    
    console.log('✅ Dispositivo salvato con successo!')
    return true
  } catch (error) {
    console.error('❌ Errore saveCurrentDevice:', error)
    return false
  }
}

/**
 * Aggiorna timestamp last_active del device corrente
 * @param {string} username
 */
export async function updateDeviceActivity(username) {
  try {
    const deviceId = getCurrentDeviceId()
    
    await supabase
      .from('user_preferences')
      .update({
        last_active: new Date().toISOString()
      })
      .eq('device_id', deviceId)
      .eq('username', username)
  } catch (error) {
    console.error('❌ Errore updateDeviceActivity:', error)
  }
}

/**
 * Ottieni tutti i dispositivi di un utente
 * @param {string} username
 * @returns {Promise<Array>}
 */
export async function getUserDevices(username) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('username', username)
      .eq('notifications_enabled', true)
    
    if (error) {
      console.error('❌ Errore getUserDevices:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('❌ Errore getUserDevices:', error)
    return []
  }
}

/**
 * Ottieni tutti i player_id di un utente ECCETTO il device corrente
 * @param {string} username
 * @returns {Promise<Array<string>>}
 */
export async function getOtherDevicePlayerIds(username) {
  try {
    const currentDeviceId = getCurrentDeviceId()
    const devices = await getUserDevices(username)
    
    // Filtra device corrente ed estrai player_id
    const playerIds = devices
      .filter(d => d.device_id !== currentDeviceId && d.player_id)
      .map(d => d.player_id)
    
    console.log('📱 Altri dispositivi trovati:', {
      total: devices.length,
      current: currentDeviceId,
      others: playerIds.length,
      playerIds
    })
    
    return playerIds
  } catch (error) {
    console.error('❌ Errore getOtherDevicePlayerIds:', error)
    return []
  }
}

/**
 * Ottieni tutti i player_id ECCETTO quelli dei dispositivi attivi
 * (usa insieme a tabTracker per escludere device che stanno guardando il sito)
 * @param {string} username
 * @param {boolean} excludeCurrent - Se true, esclude anche device corrente
 * @returns {Promise<Array<string>>}
 */
export async function getInactiveDevicePlayerIds(username, excludeCurrent = true) {
  try {
    const devices = await getUserDevices(username)
    const currentDeviceId = getCurrentDeviceId()
    
    // Considera "inattivo" un device che non ha fatto attività da 5+ minuti
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const playerIds = devices
      .filter(d => {
        // Escludi device corrente se richiesto
        if (excludeCurrent && d.device_id === currentDeviceId) return false
        
        // Includi solo device con player_id valido
        if (!d.player_id) return false
        
        // Includi solo device inattivi da 5+ minuti
        return !d.last_active || d.last_active < fiveMinutesAgo
      })
      .map(d => d.player_id)
    
    console.log('📱 Dispositivi inattivi:', {
      total: devices.length,
      inactive: playerIds.length,
      playerIds
    })
    
    return playerIds
  } catch (error) {
    console.error('❌ Errore getInactiveDevicePlayerIds:', error)
    return []
  }
}

/**
 * Ottieni player_id del device corrente
 * @returns {Promise<string|null>}
 */
export async function getCurrentPlayerId() {
  try {
    const deviceId = getCurrentDeviceId()
    
    const { data, error } = await supabase
      .from('user_preferences')
      .select('player_id')
      .eq('device_id', deviceId)
      .single()
    
    if (error || !data) return null
    
    return data.player_id
  } catch (error) {
    console.error('❌ Errore getCurrentPlayerId:', error)
    return null
  }
}

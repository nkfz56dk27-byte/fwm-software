// ===== SISTEMA NOTIFICHE PUSH SEMPLIFICATO =====

// Funzione per inviare notifiche quando i dati vengono aggiornati
export async function inviaNotificaAggiornamento(tipoDati, dettagli) {
  try {
    // Chiama il backend per invio notifiche
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tipoDati: tipoDati,
        dettagli: dettagli
      })
    })

    if (response.ok) {
      console.log('✅ Notifica inviata con successo')
    } else {
      console.log('⚠️ Errore invio notifica:', response.status)
    }
  } catch (error) {
    console.log('📤 Notifica in fallback - solo log')
  }
}

// Hook React per ascoltare aggiornamenti
export function useNotificheRealtime(tipoDati, callback) {
  useEffect(() => {
    // Ascolta cambiamenti in tempo reale su Supabase
    const channel = supabase
      .channel(`notifiche-${tipoDati}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: getTabellaFromTipo(tipoDati) 
        }, 
        (payload) => {
          console.log(`🔄 Cambiamento ${tipoDati}:`, payload)
          
          // Invia notifica push
          inviaNotificaAggiornamento(tipoDati, {
            autore: payload.new?.autore_modifica,
            note: payload.new?.note_modifica
          })
          
          // Callback locale per aggiornare UI
          if (callback) callback(payload)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tipoDati, callback])
}

// Mappa tipo dati → nome tabella
function getTabellaFromTipo(tipoDati) {
  const mapping = {
    'disponibilita': 'disponibilita_weekend',
    'calendario': 'calendario_accrediti',
    'classifiche': 'classifiche'
  }
  return mapping[tipoDati] || 'dati_generali'
}

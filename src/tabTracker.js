// Sistema di rilevamento tab VISIBILI
// Usa Broadcast Channel API per comunicare tra tutte le tab
// INVIA PUSH SOLO se NESSUNA tab è VISIBILE (utente non sta guardando il sito)

class TabTracker {
  constructor() {
    this.channel = null
    this.isAnyTabVisible = false
    this.myTabId = Math.random().toString(36).substring(7)
    this.visibleTabs = new Set() // Tab VISIBILI (non nascoste)
    this.heartbeatInterval = null
    
    this.init()
  }

  init() {
    try {
      // Crea canale broadcast
      this.channel = new BroadcastChannel('fwm-tabs')
      
      // Ascolta messaggi da altre tab
      this.channel.onmessage = (event) => {
        const { type, tabId, isVisible } = event.data
        
        if (type === 'ping') {
          // Altra tab è viva e comunica se è visibile
          if (isVisible) {
            this.visibleTabs.add(tabId)
          } else {
            this.visibleTabs.delete(tabId)
          }
          
          // Rispondi con pong
          this.channel.postMessage({ 
            type: 'pong', 
            tabId: this.myTabId,
            isVisible: !document.hidden  // Il mio stato di visibilità
          })
        } else if (type === 'pong') {
          // Risposta al nostro ping
          if (isVisible) {
            this.visibleTabs.add(tabId)
          } else {
            this.visibleTabs.delete(tabId)
          }
        } else if (type === 'closing') {
          // Tab si sta chiudendo
          this.visibleTabs.delete(tabId)
        } else if (type === 'visibility_changed') {
          // Una tab ha cambiato visibilità
          if (isVisible) {
            this.visibleTabs.add(tabId)
          } else {
            this.visibleTabs.delete(tabId)
          }
        }
        
        this.isAnyTabVisible = this.visibleTabs.size > 0
      }
      
      // Invia ping ogni 2 secondi con stato di visibilità
      this.heartbeatInterval = setInterval(() => {
        const isVisible = !document.hidden
        this.channel.postMessage({ 
          type: 'ping', 
          tabId: this.myTabId,
          isVisible: isVisible
        })
        
        // Aggiorna il mio stato
        if (isVisible) {
          this.visibleTabs.add(this.myTabId)
        } else {
          this.visibleTabs.delete(this.myTabId)
        }
        
        // Pulisci tab vecchie ogni 5 secondi
        const now = Date.now()
        if (!this.lastCleanup || now - this.lastCleanup > 5000) {
          // Reset e richiedi nuove risposte (mantieni solo questa tab se visibile)
          this.visibleTabs.clear()
          if (!document.hidden) {
            this.visibleTabs.add(this.myTabId)
          }
          this.lastCleanup = now
        }
        
        this.isAnyTabVisible = this.visibleTabs.size > 0
      }, 2000)
      
      // Quando la finestra si chiude, avvisa le altre tab
      window.addEventListener('beforeunload', () => {
        this.channel.postMessage({ type: 'closing', tabId: this.myTabId })
      })
      
      // IMPORTANTE: Quando la visibilità cambia, avvisa subito le altre tab
      document.addEventListener('visibilitychange', () => {
        const isVisible = !document.hidden
        
        console.log(`👁️ Tab ${this.myTabId} visibilità cambiata: ${isVisible ? 'VISIBILE' : 'NASCOSTA'}`)
        
        // Notifica IMMEDIATA alle altre tab
        this.channel.postMessage({ 
          type: 'visibility_changed', 
          tabId: this.myTabId,
          isVisible: isVisible
        })
        
        // Aggiorna stato locale
        if (isVisible) {
          this.visibleTabs.add(this.myTabId)
        } else {
          this.visibleTabs.delete(this.myTabId)
        }
        
        this.isAnyTabVisible = this.visibleTabs.size > 0
      })
      
      // Primo ping immediato
      const isVisible = !document.hidden
      this.channel.postMessage({ 
        type: 'ping', 
        tabId: this.myTabId,
        isVisible: isVisible
      })
      
      if (isVisible) {
        this.visibleTabs.add(this.myTabId)
      }
      
      console.log('✅ TabTracker inizializzato, ID:', this.myTabId, 'Visibile:', isVisible)
    } catch (error) {
      console.error('❌ Errore init TabTracker:', error)
      // Fallback: assumi sempre tab visibile per sicurezza
      this.isAnyTabVisible = true
    }
  }

  /**
   * Controlla se c'è ALMENO UNA tab VISIBILE del sito
   * @returns {boolean}
   */
  hasVisibleTabs() {
    return this.visibleTabs.size > 0
  }

  /**
   * Numero di tab VISIBILI
   * @returns {number}
   */
  getVisibleTabCount() {
    return this.visibleTabs.size
  }

  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    if (this.channel) {
      this.channel.postMessage({ type: 'closing', tabId: this.myTabId })
      this.channel.close()
    }
  }
}

// Istanza globale
let tabTracker = null

/**
 * Inizializza il tracker di tab (chiamare all'avvio app)
 */
export function initTabTracker() {
  if (!tabTracker) {
    tabTracker = new TabTracker()
  }
  return tabTracker
}

/**
 * Controlla se l'utente sta GUARDANDO il sito (almeno una tab VISIBILE)
 * @returns {boolean} true se almeno una tab è VISIBILE (in primo piano)
 */
export function isUserWatchingSite() {
  if (!tabTracker) {
    console.warn('⚠️ TabTracker non inizializzato, assumo utente sta guardando')
    return true // Per sicurezza, assumiamo che stia guardando
  }
  
  const hasVisibleTabs = tabTracker.hasVisibleTabs()
  const visibleCount = tabTracker.getVisibleTabCount()
  
  console.log(`👁️ Tab VISIBILI: ${visibleCount}, Utente sta guardando sito: ${hasVisibleTabs}`)
  
  return hasVisibleTabs
}

/**
 * Ottieni numero di tab VISIBILI
 * @returns {number}
 */
export function getVisibleTabsCount() {
  return tabTracker ? tabTracker.getVisibleTabCount() : 0
}

/**
 * Cleanup (opzionale, chiamare quando app si smonta)
 */
export function destroyTabTracker() {
  if (tabTracker) {
    tabTracker.destroy()
    tabTracker = null
  }
}

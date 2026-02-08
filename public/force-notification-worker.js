// Service Worker aggressivo per forzare notifiche con corpo

// Intercepta TUTTE le notifiche
self.addEventListener('push', function(event) {
    console.log('🔥 PUSH EVENT AGGRESSIVO:', event);
    
    if (event.data) {
        try {
            const data = event.data.json();
            console.log('🔥 DATI PUSH:', data);
            
            // Estrai il titolo e corpo in modo aggressivo
            let title = 'FWM';
            let body = 'Notifica da FWM';
            
            // Prova diverse fonti per il titolo
            if (data.headings && data.headings.it) title = data.headings.it;
            else if (data.title) title = data.title;
            else if (data.headings && data.headings.en) title = data.headings.en;
            
            // Prova diverse fonti per il corpo
            if (data.contents && data.contents.it) body = data.contents.it;
            else if (data.message) body = data.message;
            else if (data.body) body = data.body;
            else if (data.contents && data.contents.en) body = data.contents.en;
            
            console.log('🔥 TITOLO FORZATO:', title);
            console.log('🔥 CORPO FORZATO:', body);
            
            // Mostra la notifica con opzioni massime
            event.waitUntil(
                self.registration.showNotification(title, {
                    body: body,
                    icon: '/icona_notifiche.png',
                    badge: '/icona_notifiche.png',
                    tag: 'fwm-force',
                    requireInteraction: true,
                    silent: false,
                    vibrate: [200, 100, 200],
                    actions: [
                        {
                            action: 'open',
                            title: '📱 Apri App'
                        },
                        {
                            action: 'dismiss',
                            title: '❌ Chiudi'
                        }
                    ],
                    data: {
                        url: data.url || '/',
                        originalData: data
                    }
                })
            );
            
        } catch (error) {
            console.error('🔥 ERRORE PUSH:', error);
            // Fallback notifica semplice
            event.waitUntil(
                self.registration.showNotification('FWM', {
                    body: 'Hai una nuova notifica',
                    icon: '/icona_notifiche.png',
                    requireInteraction: true
                })
            );
        }
    }
});

// Handler per click
self.addEventListener('notificationclick', function(event) {
    console.log('🔥 CLICK NOTIFICA:', event);
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        const url = event.notification.data?.url || '/';
        event.waitUntil(clients.openWindow(url));
    }
});

// Intercepta anche showNotification dirette
const originalShowNotification = self.registration.showNotification;
self.registration.showNotification = function(title, options = {}) {
    console.log('🔥 INTERCETTATO showNotification:', title, options);
    
    // Forza il corpo se mancante
    if (!options.body) {
        options.body = options.contents?.it || options.message || 'Notifica FWM';
    }
    
    // Forza opzioni per visibilità
    options = {
        ...options,
        requireInteraction: true,
        silent: false,
        icon: options.icon || '/icona_notifiche.png',
        badge: options.badge || '/icona_notifiche.png'
    };
    
    console.log('🔥 OPZIONI FORZATE:', options);
    
    return originalShowNotification.call(this, title, options);
};

console.log('🔥 FORCE NOTIFICATION WORKER CARICATO');

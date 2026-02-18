# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Schedulazione Cron

La schedulazione degli endpoint cron (es. /api/rss-notification-cron, /api/processPushNotifications, /api/calendario-reminder) è gestita tramite https://console.cron-job.org e NON tramite Vercel Cron, per compatibilità con il piano Hobby. 

- Imposta i job su cron-job.org con la frequenza desiderata.
- Rimuovi o ignora la configurazione cron di Vercel.

### Reminder automatico eventi calendario

  - **URL:** https://fwm-software.vercel.app/api/calendario-reminder
  - **Orario:** ogni giorno alle 9:00
  - **Timezone:** Europe/Rome
  - **Espressione Cron:** `0 9 * * *`
  - **Stato:** deve essere attivo (non in pausa)

Questo garantisce l'invio automatico dei reminder ogni mattina.

Per modifiche o monitoraggio, accedi a cron-job.org e verifica lo stato del job.

=======
>>>>>>> de64933 (Commit iniziale: workspace fornito dall'utente)
### Reminder automatico eventi calendario

- Il cron job per i reminder è configurato su cron-job.org:
  - **URL:** https://fwm-software.vercel.app/api/calendario-reminder
  - **Orario:** ogni giorno alle 9:00
  - **Timezone:** Europe/Rome
  - **Espressione Cron:** `0 9 * * *`
  - **Stato:** deve essere attivo (non in pausa)

Questo garantisce l'invio automatico dei reminder ogni mattina.

Per modifiche o monitoraggio, accedi a cron-job.org e verifica lo stato del job.

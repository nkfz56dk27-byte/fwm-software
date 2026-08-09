import { createClient } from '@supabase/supabase-js'
import { getPenaltyScadutaNotification } from '../notificationTemplates.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inviaNotificaOneSignal({ titolo, messaggio, data }) {
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { en: titolo, it: titolo },
      contents: { en: messaggio, it: messaggio },
      data: data || {}
    })
  })
  return res.json()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
     return res.status(405).json({ error: 'Method Not Allowed' })
   }

  try {
    const oggi = new Date().toISOString().split('T')[0]

    const { data: infrazioniScadute, error: errInfrazioni } = await supabase
      .from('infrazioni')
      .select('*')
      .eq('data_scadenza', oggi)

    if (errInfrazioni) throw errInfrazioni

    if (!infrazioniScadute || infrazioniScadute.length === 0) {
      return res.status(200).json({ ok: true, inviate: 0 })
    }

    const { data: classificheStandard } = await supabase.from('classifiche').select('id, nome, piloti')
    const { data: classificheCustom } = await supabase.from('classifiche_custom').select('id, nome, piloti')
    const tutteLeClassifiche = [...(classificheStandard || []), ...(classificheCustom || [])]

    const risultati = []

    for (const infrazione of infrazioniScadute) {
      const campionato = tutteLeClassifiche.find(c => String(c.id) === String(infrazione.campionato_id))
      const categoriaNome = campionato?.nome || 'Categoria sconosciuta'
      const pilota = campionato?.piloti?.find(p => String(p.id) === String(infrazione.pilota_id))
      const pilotaNome = pilota?.nome || 'Pilota sconosciuto'

      const notifica = getPenaltyScadutaNotification({
        pilotaNome,
        categoriaNome,
        punti: infrazione.punti,
        motivo: infrazione.motivo
      })

      const esito = await inviaNotificaOneSignal({
        titolo: notifica.titolo,
        messaggio: notifica.messaggio,
        data: {
          tipo: notifica.tipo,
          infrazione_id: infrazione.id,
          pilota_id: infrazione.pilota_id,
          campionato_id: infrazione.campionato_id
        }
      })

      risultati.push({ infrazione_id: infrazione.id, pilotaNome, categoriaNome, esito })
    }

    return res.status(200).json({ ok: true, inviate: risultati.length, dettagli: risultati })
  } catch (err) {
    console.error('Errore penalty-scaduti-cron:', err)
    return res.status(500).json({ ok: false, error: String(err) })
  }
}
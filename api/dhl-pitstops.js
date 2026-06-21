const DHL_API_BASE = 'https://inmotion.dhl/api/f1-award-element-data'
const DHL_EVENT_DATASET_ID = 7375
const DHL_PITSTOP_DATASET_ID = 7373

const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripHtml = (value) => decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim()

const parsePitRowsFromHtmlTable = (tableHtml) => {
  if (!tableHtml || typeof tableHtml !== 'string') return []

  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
  const rows = []

  for (const rowMatch of tableHtml.matchAll(rowRegex)) {
    const rowContent = rowMatch?.[1] || ''
    const cells = Array.from(rowContent.matchAll(cellRegex)).map((m) => stripHtml(m?.[1] || ''))
    if (cells.length < 6) continue

    const stop = cells[0]
    const team = cells[1]
    const driverName = cells[2]
    const duration = cells[3]
    const lap = cells[4]
    const points = cells[5]

    if (!/^\d+$/.test(stop)) continue

    rows.push({
      driverId: String(driverName || '-').toLowerCase().replace(/\s+/g, '_'),
      driverName: String(driverName || '-'),
      team: String(team || ''),
      stop: String(stop),
      lap: String(lap || ''),
      time: '',
      duration: String(duration || ''),
      points: Number(points || 0),
      irregular: false,
      rawId: String(stop)
    })
  }

  const seen = new Set()
  return rows.filter((row) => {
    const key = `${row.driverName}|${row.team}|${row.lap}|${row.duration}|${row.stop}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const season = String(req.query?.season || new Date().getFullYear())

  try {
    const eventsResponse = await fetch(`${DHL_API_BASE}/${DHL_EVENT_DATASET_ID}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    })

    if (!eventsResponse.ok) {
      return res.status(eventsResponse.status).json({ error: 'DHL events not reachable' })
    }

    const eventsJson = await eventsResponse.json()
    const events = eventsJson?.data?.chart?.events || []

    if (!Array.isArray(events) || !events.length) {
      return res.status(200).json({ MRData: { RaceTable: { Races: [] }, total: '0' }, events: [] })
    }

    const payloads = await Promise.all(events.map(async (eventItem) => {
      const eventId = Number(eventItem?.id)
      if (!Number.isFinite(eventId)) return null

      try {
        const response = await fetch(`${DHL_API_BASE}/${DHL_PITSTOP_DATASET_ID}?event=${eventId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json,text/plain,*/*',
            'Referer': 'https://inmotion.dhl/en/formula-1/fastest-pit-stop-award'
          }
        })

        if (!response.ok) return null
        const json = await response.json()
        return {
          eventId,
          eventItem,
          data: json?.data || null,
          tableHtml: json?.htmlList?.table || ''
        }
      } catch {
        return null
      }
    }))

    const raceByName = new Map()

    payloads.filter(Boolean).forEach(({ eventId, eventItem, data, tableHtml }) => {
      const chart = data?.chart
      const tableRows = parsePitRowsFromHtmlTable(tableHtml)
      const hasChart = Array.isArray(chart) && chart.length > 0
      if (tableRows.length === 0 && !hasChart) return

      const raceName = String(
        data?.list_item_title ||
        eventItem?.short_title ||
        eventItem?.title ||
        eventItem?.abbr ||
        `Evento ${eventId}`
      ).trim()

      const eventDate = String(eventItem?.date?.date || '').split(' ')[0] || ''

      const pitRowsFromChart = hasChart
        ? chart.map((item, idx) => {
            const driverName = `${item?.firstName || ''} ${item?.lastName || ''}`.trim()
            const dateTime = String(item?.startTime?.date || '')
            const [, timePartRaw = ''] = dateTime.split(' ')
            const timePart = timePartRaw.split('.')[0] || ''

            return {
              driverId: String(item?.tla || item?.lastName || item?.driverNr || idx + 1),
              driverName: driverName || String(item?.tla || '-'),
              team: String(item?.team || ''),
              stop: String(item?.id || idx + 1),
              lap: item?.lap != null ? String(item.lap) : '',
              time: timePart,
              duration: item?.duration != null ? String(item.duration) : '',
              points: Number(item?.points || 0),
              irregular: !!item?.irregular,
              rawId: item?.id
            }
          })
        : []

      const pitRows = (tableRows.length > 0 ? tableRows : pitRowsFromChart)
        .sort((a, b) => {
          const da = Number(a?.duration)
          const db = Number(b?.duration)
          if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db
          return Number(a?.stop || 999) - Number(b?.stop || 999)
        })

      raceByName.set(raceName, {
        season,
        round: '0',
        raceName,
        date: eventDate,
        PitStops: pitRows,
        sourceId: eventId,
        event_id: eventId
      })
    })

    const races = Array.from(raceByName.values())
      .sort((a, b) => {
        const dateA = a?.date ? new Date(a.date).getTime() : 0
        const dateB = b?.date ? new Date(b.date).getTime() : 0
        if (dateA !== dateB) return dateA - dateB
        return Number(a?.sourceId || 0) - Number(b?.sourceId || 0)
      })
      .map((race, index) => ({ ...race, round: String(index + 1) }))

    return res.status(200).json({
      MRData: {
        RaceTable: { Races: races },
        total: String(races.length)
      },
      events: events.map(e => ({ id: e?.id, short_title: e?.short_title, title: e?.title }))
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch DHL pit stop data',
      details: error?.message || 'Unknown error'
    })
  }
}

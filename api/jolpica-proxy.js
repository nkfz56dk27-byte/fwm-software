const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1'
const CACHE_TTL_MS = 60 * 1000

// Cache in-memory (best effort per istanza serverless)
const memoryCache = globalThis.__jolpicaProxyCache || new Map()
globalThis.__jolpicaProxyCache = memoryCache

function getEndpointFromRequest(req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    return url.searchParams.get('endpoint') || ''
  } catch {
    return req.query?.endpoint || ''
  }
}

function isValidEndpoint(endpoint) {
  return typeof endpoint === 'string' && endpoint.startsWith('/') && endpoint.length < 512
}

function getEmptyResponse() {
  return { MRData: { RaceTable: { Races: [] }, total: '0' } }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const endpoint = getEndpointFromRequest(req)
  if (!isValidEndpoint(endpoint)) {
    res.status(400).json({ error: 'Missing or invalid endpoint parameter' })
    return
  }

  const cacheKey = endpoint
  const now = Date.now()
  const cached = memoryCache.get(cacheKey)

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    res.status(200).json(cached.data)
    return
  }

  const targetUrl = `${JOLPICA_BASE_URL}${endpoint}`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json'
      }
    })

    // 400/404/429 gestiti in modo safe per non rompere il client
    if ([400, 404, 429].includes(response.status)) {
      const fallbackData = cached?.data || getEmptyResponse()
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
      res.status(200).json(fallbackData)
      return
    }

    if (!response.ok) {
      const text = await response.text()
      res.status(response.status).json({ error: 'Upstream error', status: response.status, body: text.slice(0, 300) })
      return
    }

    const data = await response.json()
    memoryCache.set(cacheKey, { data, timestamp: now })

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    res.status(200).json(data)
  } catch (error) {
    if (cached?.data) {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
      res.status(200).json(cached.data)
      return
    }

    res.status(200).json(getEmptyResponse())
  }
}

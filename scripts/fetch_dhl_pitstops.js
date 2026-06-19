#!/usr/bin/env node

// Script minimale per scaricare i tempi "Fastest Pit Stop" da DHL
// Salva in data/dhl_pitstops_{season}.json e, se presente SUPABASE_SERVICE_ROLE, fa upsert in Supabase

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const cheerio = require('cheerio')

const seasonArg = process.argv[2] || 'current'
const season = seasonArg === 'current' ? new Date().getFullYear().toString() : seasonArg
const outDir = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `dhl_pitstops_${season}.json`)

const DHL_URL = 'https://inmotion.dhl/en/formula-1/fastest-pit-stop-award'

function parseTimeToSeconds(t) {
  if (!t || typeof t !== 'string') return null
  t = t.trim()
  // common formats: 1.92   1.92s   00:01.920   1:02.345
  const msecMatch = t.match(/(\d+):(\d{2}(?:\.\d+)?)/)
  if (msecMatch) {
    const mins = parseInt(msecMatch[1], 10)
    const secs = parseFloat(msecMatch[2].replace(',', '.'))
    return +(mins * 60 + secs)
  }
  const secMatch = t.match(/(\d+(?:[\.,]\d+)?)/)
  if (secMatch) return +secMatch[1].replace(',', '.')
  return null
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'node-fetch' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function parseMainPage(html) {
  const $ = cheerio.load(html)
  const items = []

  // Best-effort scraping: cerca tabelle o blocchi che contengono gare e tempi
  $('table').each((i, table) => {
    const headers = $(table).find('thead th').map((i, el) => $(el).text().trim()).get()
    $(table).find('tbody tr').each((j, tr) => {
      const cols = $(tr).find('td').map((k, td) => $(td).text().trim()).get()
      if (cols.length >= 2) {
        items.push({ headers, cols })
      }
    })
  })

  // fallback: cerca blocchi .article__content con righe contenenti "Fastest Pit Stop" e tempo
  if (items.length === 0) {
    $('*').each((i, el) => {
      const text = $(el).text().trim()
      if (text && /fastest pit stop/i.test(text)) {
        // prova a recuperare il paragrafo successivo
        const nxt = $(el).next().text().trim()
        if (nxt) items.push({ raw: text + ' ' + nxt })
      }
    })
  }

  return items
}

function normalizeItems(items) {
  const out = []
  for (const it of items) {
    if (it.cols) {
      // mappa colonne a fields basandosi su header potenziale
      const h = it.headers.map(h => h.toLowerCase())
      const row = {}
      for (let i = 0; i < it.cols.length; i++) {
        const key = h[i] || `col${i}`
        row[key] = it.cols[i]
      }
      // try to canonicalize obvious fields
      const canonical = Object.assign({}, row)
      // find possible time field
      const timeKey = Object.keys(canonical).find(k => /time|lap|pit|fastest|secs?|seconds?/i.test(k))
      if (timeKey) canonical.time_raw = canonical[timeKey]
      const eventKey = Object.keys(canonical).find(k => /event|race|grand prix|gp|round|venue/i.test(k))
      if (eventKey) canonical.event = canonical[eventKey]
      if (canonical.time_raw && !canonical.time_seconds) canonical.time_seconds = parseTimeToSeconds(canonical.time_raw)
      out.push(canonical)
    } else if (it.raw) {
      // try to extract time from raw text
      const timeMatch = it.raw.match(/(\d{1,2}:\d{2}\.\d+|\d+(?:[\.,]\d+)?)(?:s)?/)
      const time_raw = timeMatch ? timeMatch[0] : null
      const parsed = { raw: it.raw, time_raw }
      if (time_raw) parsed.time_seconds = parseTimeToSeconds(time_raw)
      out.push(parsed)
    }
  }
  return out
}

async function main() {
  console.log('Fetching DHL page...')
  const html = await fetchPage(DHL_URL)
  const items = parseMainPage(html)
  const normalized = normalizeItems(items)

  const result = {
    source: DHL_URL,
    season,
    generated_at: new Date().toISOString(),
    items: normalized
  }

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8')
  console.log('Saved', outFile)

  // If SUPABASE_SERVICE_ROLE present, upsert into Supabase table `dhl_pitstops`
  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE
  if (SUPA_URL && SUPA_KEY) {
    console.log('Detected Supabase service role key, attempting upsert...')
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(SUPA_URL, SUPA_KEY)

    // Transform normalized items into rows with canonical fields when possible
    const rows = normalized.map((it, idx) => {
      const obj = {
        season,
        event: it.event || it.col0 || it.col1 || null,
        time_raw: it.time_raw || it.time || it.col1 || it.col2 || null,
        time_seconds: typeof it.time_seconds !== 'undefined' ? it.time_seconds : null,
        raw: JSON.stringify(it),
        source: DHL_URL,
        fetched_at: new Date().toISOString()
      }
      return obj
    }).filter(r => r.event || r.time_raw || r.raw)

    // Upsert rows with minimal schema: id autogenerated
    const chunkSize = 50
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { data, error } = await supabase.from('dhl_pitstops').upsert(chunk)
      if (error) console.error('Supabase upsert error:', error.message || error)
      else console.log('Upserted chunk', i / chunkSize + 1)
    }

    console.log('Upsert complete')
  } else {
    console.log('Supabase service role key not provided; skipped upsert. To upsert set SUPABASE_URL and SUPABASE_SERVICE_ROLE env vars.')
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})

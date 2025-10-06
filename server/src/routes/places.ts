import express from 'express'
import fs from 'fs'
import readline from 'readline'
import https from 'https'
import { ENV } from '@/config/env'

const router = express.Router()

type City = {
  geonameid: string
  name: string
  asciiname: string
  lat: number
  lon: number
  feature_code: string
  country: string
  population: number
  timezone: string
  _name_lc: string
  _asciiname_lc: string
  _name_cmp: string
  _asciiname_cmp: string
  _rank: number
}

const REMOVE_CHARS = "’'`-–—_. \t"
const removeSet = new Set([...REMOVE_CHARS])

const FEATURE_RANK: Record<string, number> = {
  PPLC: 400,
  PPLA: 300,
  PPLA2: 250, PPLA3: 240, PPLA4: 230,
  PPL: 200,
  PPLQ: 150,
}

const ALIASES: Record<string, string[]> = {
  'moskva': ['moscow'],
  'moscow': ['moskva'],
  'sankt-peterburg': ['saint petersburg', 'st petersburg', 'saint-petersburg'],
  'ekaterinburg': ['yekaterinburg'],
  'nizhnij novgorod': ['nizhny novgorod'],
  'kiev': ['kyiv'],
  'nijni novgorod': ['nizhny novgorod'],
}

function norm(s: string | undefined | null): string {
  return (s ?? '').normalize('NFKC').trim().toLowerCase()
}

function simplify(s: string | undefined | null): string {
  const base = norm(s)
  if (!base) return ''
  let out = ''
  for (const ch of base) { if (!removeSet.has(ch)) out += ch }
  return out
}

const RU2LAT: Record<string, string> = {
  'а': 'a','б': 'b','в': 'v','г': 'g','д': 'd','е': 'e','ё': 'e','ж': 'zh','з': 'z','и': 'i','й': 'y',
  'к': 'k','л': 'l','м': 'm','н': 'n','о': 'o','п': 'p','р': 'r','с': 's','т': 't','у': 'u','ф': 'f',
  'х': 'kh','ц': 'ts','ч': 'ch','ш': 'sh','щ': 'shch','ъ': '','ы': 'y','ь': '','э': 'e','ю': 'yu','я': 'ya',
}
function ruToLat(input: string): string {
  const lc = input.toLowerCase(); let out = ''
  for (const ch of lc) out += RU2LAT[ch] ?? ch
  return out
}

function variantsFromQuery(qRaw: string): { vsNorm: Set<string>; vsSimpl: Set<string> } {
  const base = norm(qRaw)
  const vs = new Set<string>([base])
  try { vs.add(norm(ruToLat(qRaw))) } catch {}
  const extra = new Set<string>()
  for (const v of vs) { const a = ALIASES[v]; if (a) for (const s of a) extra.add(norm(s)) }
  for (const e of extra) vs.add(e)
  const vsSimpl = new Set<string>(); for (const v of vs) vsSimpl.add(simplify(v))
  return { vsNorm: vs, vsSimpl }
}

let cache: City[] | null = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 минут

function resolveCsvPath(): string {
  const fromEnv = process.env.PLACES_CSV_PATH
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv
  const candidates = [
    '/home/deploy/dev/client/public/places.csv',
    '/home/deploy/prod/client/public/places.csv',
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch {}
  }
  throw new Error('places.csv not found. Set PLACES_CSV_PATH to the CSV file path')
}

async function loadCsvOnce(): Promise<City[]> {
  const now = Date.now()
  if (cache && (now - cacheTime) < CACHE_TTL) return cache
  
  // Очищаем старый кэш
  if (cache) {
    cache = null
    if (global.gc) global.gc() // Принудительная сборка мусора
  }
  
  const csvPath = resolveCsvPath()
  const stream = fs.createReadStream(csvPath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let headerParsed = false
  let cols: string[] = []
  const out: City[] = []
  let lineCount = 0
  const MAX_LINES = 50000 // Ограничиваем количество строк для экономии памяти
  
  for await (const line of rl) {
    if (lineCount >= MAX_LINES) break // Ограничиваем количество строк
    lineCount++
    
    if (!headerParsed) { cols = line.split(','); headerParsed = true; continue }
    if (!line) continue
    const parts = line.split(',')
    const get = (name: string) => parts[cols.indexOf(name)] || ''
    const feature = (get('feature_code') || '').toUpperCase()
    if (!(feature in FEATURE_RANK)) continue
    const name = get('name'); const asciiname = get('asciiname') || name
    const country = get('country')
    const c: City = {
      geonameid: get('geonameid'),
      name,
      asciiname,
      lat: Number(get('lat') || '0') || 0,
      lon: Number(get('lon') || '0') || 0,
      feature_code: feature,
      country,
      population: Number(get('population') || '0') || 0,
      timezone: get('timezone'),
      _name_lc: norm(name),
      _asciiname_lc: norm(asciiname),
      _name_cmp: simplify(name),
      _asciiname_cmp: simplify(asciiname),
      _rank: FEATURE_RANK[feature] || 0,
    }
    out.push(c)
  }
  
  cache = out
  cacheTime = now
  return out
}

router.get('/places/search', async (req: express.Request, res: express.Response) => {
  try {
    const q = String(req.query.q || '').trim()
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12) || 12))
    const country = String(req.query.country || '').trim()
    
    // Ограничиваем длину запроса
    if (q.length > 100) return res.json({ ok: true, items: [] })
    if (!q || q.length < 2) return res.json({ ok: true, items: [] })
    
    const rows = await loadCsvOnce()
    const { vsNorm, vsSimpl } = variantsFromQuery(q)
    const hits: City[] = []
    let checkedCount = 0
    const MAX_CHECKS = 10000 // Ограничиваем количество проверок
    
    for (const r of rows) {
      if (checkedCount >= MAX_CHECKS) break
      checkedCount++
      
      if (country && r.country.toLowerCase() !== country.toLowerCase()) continue
      let ok = false
      for (const v of vsNorm) { 
        if (v && (r._name_lc.includes(v) || r._asciiname_lc.includes(v))) { 
          ok = true; break 
        } 
      }
      if (!ok) {
        for (const v of vsSimpl) { 
          if (v && (r._name_cmp.includes(v) || r._asciiname_cmp.includes(v))) { 
            ok = true; break 
          } 
        }
      }
      if (ok) {
        hits.push(r)
        if (hits.length >= limit * 2) break // Останавливаемся когда нашли достаточно
      }
    }
    
    hits.sort((a, b) => (b._rank - a._rank) || (b.population - a.population) || a.name.localeCompare(b.name))
    const items = hits.slice(0, limit).map(r => ({ id: r.geonameid, name: r.name, country: r.country, lat: r.lat, lon: r.lon }))
    return res.json({ ok: true, items })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ ok: false, message: 'places search failed' })
  }
})

// === DaData integration (dev only) ===
// Suggest cities by query
router.post('/dadata/suggest/city', async (req: express.Request, res: express.Response) => {
  try {
    const q = String(req.query.q || (req as any).body?.q || '').trim()
    const limit = Math.max(1, Math.min(20, Number(req.query.limit || (req as any).body?.limit || 12) || 12))
    if (!q || q.length < 2) return res.json({ ok: true, items: [] })

    const payload = JSON.stringify({ query: q, count: limit, locations: [{ country: 'Россия' }] })
    const options: https.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${ENV.DADATA_TOKEN}`,
        'X-Secret': ENV.DADATA_SECRET,
        'Content-Length': Buffer.byteLength(payload)
      }
    }
    const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'
    const items = await new Promise<any[]>((resolve, reject) => {
      const reqHttps = https.request(url, options, (r) => {
        const chunks: Buffer[] = []
        r.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        r.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
            const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : []
            const cities = suggestions
              .map((s: any) => s?.data)
              .filter((d: any) => d && (d.city || d.settlement) && d.country)
              .map((d: any) => ({
                id: String(d.fias_id || d.kladr_id || d.city_fias_id || d.geoname_id || d.city_kladr_id || d.settlement_fias_id || d.settlement_kladr_id || d.qc_geo || d.postal_code || (d.city ? (d.city + ':' + (d.region_code || d.region || '')) : '') || `geo_${Math.random().toString(36).substr(2, 9)}`),
                name: String(d.city || d.settlement || d.result || d.value || '').trim(),
                country: String(d.country || ''),
                region: String(d.region || d.region_with_type || ''),
                lat: Number(d.geo_lat || 0) || 0,
                lon: Number(d.geo_lon || 0) || 0,
              }))
            resolve(cities)
          } catch (e) { reject(e) }
        })
      })
      reqHttps.on('error', reject)
      reqHttps.write(payload)
      reqHttps.end()
    })
    return res.json({ ok: true, items })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ ok: false, message: 'dadata suggest failed' })
  }
})

// Reverse geocode by lat/lon (detect city)
router.get('/dadata/geolocate', async (req: express.Request, res: express.Response) => {
  try {
    const lat = Number(req.query.lat)
    const lon = Number(req.query.lon)
    if (!isFinite(lat) || !isFinite(lon)) return res.json({ ok: true, item: null })

    const payload = JSON.stringify({ lat, lon, radius_meters: 5000, count: 10 })
    const options: https.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${ENV.DADATA_TOKEN}`,
        'X-Secret': ENV.DADATA_SECRET,
        'Content-Length': Buffer.byteLength(payload)
      }
    }
    const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/geolocate/address'
    const item = await new Promise<any | null>((resolve, reject) => {
      const reqHttps = https.request(url, options, (r) => {
        const chunks: Buffer[] = []
        r.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        r.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
            const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : []
            const best = suggestions.map((s: any) => s?.data).find((d: any) => d && (d.city || d.settlement)) || null
            if (!best) return resolve(null)
            resolve({
              id: String(best.fias_id || best.kladr_id || best.city_fias_id || best.geoname_id || best.city_kladr_id || best.qc_geo || best.postal_code || (best.city ? (best.city + ':' + (best.region_code || best.region || '')) : '') || `geo_${Math.random().toString(36).substr(2, 9)}`),
              name: String(best.city || best.settlement || best.result || best.value || '').trim(),
              country: String(best.country || ''),
              region: String(best.region || best.region_with_type || ''),
              lat: Number(best.geo_lat || 0) || 0,
              lon: Number(best.geo_lon || 0) || 0,
            })
          } catch (e) { reject(e) }
        })
      })
      reqHttps.on('error', reject)
      reqHttps.write(payload)
      reqHttps.end()
    })
    return res.json({ ok: true, item })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return res.status(500).json({ ok: false, message: 'dadata geolocate failed' })
  }
})

export const placesRouter = router

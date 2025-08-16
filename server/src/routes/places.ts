import express from 'express'
import fs from 'fs'
import readline from 'readline'

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

async function loadCsvOnce(): Promise<City[]> {
  if (cache) return cache
  const path = '/home/deploy/dev/client/public/places.csv'
  const stream = fs.createReadStream(path, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let headerParsed = false
  let cols: string[] = []
  const out: City[] = []
  for await (const line of rl) {
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
  return out
}

router.get('/places/search', async (req: express.Request, res: express.Response) => {
  try {
    const q = String(req.query.q || '').trim()
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12) || 12))
    const country = String(req.query.country || '').trim()
    if (!q) return res.json({ ok: true, items: [] })
    const rows = await loadCsvOnce()
    const { vsNorm, vsSimpl } = variantsFromQuery(q)
    const hits: City[] = []
    for (const r of rows) {
      if (country && r.country.toLowerCase() !== country.toLowerCase()) continue
      let ok = false
      for (const v of vsNorm) { if (v && (r._name_lc.includes(v) || r._asciiname_lc.includes(v))) { ok = true; break } }
      if (!ok) for (const v of vsSimpl) { if (v && (r._name_cmp.includes(v) || r._asciiname_cmp.includes(v))) { ok = true; break } }
      if (ok) hits.push(r)
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

export const placesRouter = router



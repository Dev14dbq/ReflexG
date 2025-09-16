// Lightweight client-side city search over CSV placed in public/places.csv
// CSV header: geonameid,name,asciiname,lat,lon,feature_class,feature_code,country,admin1,admin2,population,timezone

export type CityRow = {
  geonameid: string
  name: string
  asciiname: string
  lat: number
  lon: number
  feature_code: string
  country: string
  population: number
  timezone: string
  // precomputed
  _name_lc: string
  _asciiname_lc: string
  _name_cmp: string
  _asciiname_cmp: string
  _rank: number
}

const REMOVE_CHARS = "’'`-–—_. \t"
const TRANS_TABLE = new Map<string, string>([...REMOVE_CHARS].map(c => [c, '']))

const FEATURE_RANK: Record<string, number> = {
  PPLC: 400, // country capital
  PPLA: 300, // region capital
  PPLA2: 250, PPLA3: 240, PPLA4: 230,
  PPL: 200,   // populated place
  PPLQ: 150,  // former
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
  for (const ch of base) {
    out += TRANS_TABLE.has(ch) ? '' : ch
  }
  return out
}

// RU -> LAT (basic)
const RU2LAT: Record<string, string> = {
  'а': 'a','б': 'b','в': 'v','г': 'g','д': 'd','е': 'e','ё': 'e','ж': 'zh','з': 'z','и': 'i','й': 'y',
  'к': 'k','л': 'l','м': 'm','н': 'n','о': 'o','п': 'p','р': 'r','с': 's','т': 't','у': 'u','ф': 'f',
  'х': 'kh','ц': 'ts','ч': 'ch','ш': 'sh','щ': 'shch','ъ': '','ы': 'y','ь': '','э': 'e','ю': 'yu','я': 'ya',
}

function ruToLat(input: string): string {
  const lc = input.toLowerCase()
  let out = ''
  for (const ch of lc) out += RU2LAT[ch] ?? ch
  return out
}

function variantsFromQuery(qRaw: string): { vsNorm: Set<string>; vsSimpl: Set<string> } {
  const base = norm(qRaw)
  const vs = new Set<string>([base])
  // RU->LAT
  try { vs.add(norm(ruToLat(qRaw))) } catch {}
  // aliases
  const extra = new Set<string>()
  for (const v of vs) {
    const aliases = ALIASES[v]
    if (aliases) for (const a of aliases) extra.add(norm(a))
  }
  for (const e of extra) vs.add(e)
  const vsSimpl = new Set<string>()
  for (const v of vs) vsSimpl.add(simplify(v))
  return { vsNorm: vs, vsSimpl }
}

export type CitySearchItem = { id: string; name: string; country: string; lat: number; lon: number }

export async function searchCities(query: string, limit = 12, country?: string): Promise<CitySearchItem[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  if (country) params.set('country', country)
  // пробуем /api, затем без /api
  let url = `/api/places/search?${params.toString()}`
  let resp = await fetch(url)
  if (!resp.ok && resp.status === 404) {
    url = `/places/search?${params.toString()}`
    resp = await fetch(url)
  }
  if (!resp.ok) return []
  const data = await resp.json().catch(() => ({})) as { ok?: boolean; items?: CitySearchItem[] }
  if (!data.ok || !data.items) return []
  return data.items
}



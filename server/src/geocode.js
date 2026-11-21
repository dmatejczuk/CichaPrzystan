// Place search through the public Nominatim API (OpenStreetMap).
// Usage policy: at most one request per second and an identifying User-Agent.
// https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'CichaPrzystan/1.0 (hackathon project)'
const MIN_INTERVAL_MS = 1100
const TIMEOUT_MS = 10_000
const MAX_RESULTS = 5
const CACHE_LIMIT = 500

const cache = new Map()
let queue = Promise.resolve()
let lastRequestAt = 0

export class GeocodeUnavailable extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Requests are serialized so that concurrent users never exceed the rate limit.
function throttled(task) {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    return task()
  })
  queue = run.catch(() => {})
  return run
}

function toPlace(item) {
  // Nominatim boundingbox: [south, north, west, east] as strings.
  const [south, north, west, east] = item.boundingbox.map(Number)
  return {
    name: item.name || item.display_name,
    display_name: item.display_name,
    type: item.addresstype ?? item.type,
    lat: Number(item.lat),
    lon: Number(item.lon),
    bbox: [west, south, east, north],
  }
}

async function request(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'pl',
    'accept-language': 'pl',
    limit: String(MAX_RESULTS),
  })
  let response
  try {
    response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    throw new GeocodeUnavailable(err.message)
  }
  if (!response.ok) throw new GeocodeUnavailable(`Nominatim responded with HTTP ${response.status}`)
  return (await response.json()).map(toPlace)
}

export async function searchPlaces(query) {
  const key = query.trim().toLowerCase()
  if (cache.has(key)) return cache.get(key)
  const places = await throttled(() => request(query.trim()))
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value)
  cache.set(key, places)
  return places
}

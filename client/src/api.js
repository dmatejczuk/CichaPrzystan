import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

const CODES = { 400: 'BAD_REQUEST', 404: 'NOT_FOUND', 500: 'INTERNAL_ERROR', 503: 'UNAVAILABLE' }

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (axios.isCancel(err)) return Promise.reject(err)
    if (err.response) {
      const { status, data } = err.response
      return Promise.reject(new ApiError(data?.error ?? err.message, { status, code: CODES[status] ?? 'UNKNOWN' }))
    }
    if (err.code === 'ECONNABORTED') return Promise.reject(new ApiError('request timed out', { code: 'TIMEOUT' }))
    return Promise.reject(new ApiError('server unreachable', { code: 'NETWORK_ERROR' }))
  },
)

export const isCancel = axios.isCancel

export const bboxFromBounds = (b) => [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]

export const featureToLatLng = (feature) => {
  const [lon, lat] = feature.geometry.coordinates
  return [lat, lon]
}

export const DEAD_ZONES_IMAGE_URL = `${BASE_URL}/dead-zones/dead_zones.png`

export const fetchCoverage = ({ lat, lon, operator, signal }) =>
  http.get('/api/coverage', { params: { lat, lon, ...(operator && { operator }) }, signal })

export const fetchStays = ({ bbox, noCoverageOnly = false, signal } = {}) =>
  http.get('/api/stays', {
    params: { ...(bbox && { bbox: bbox.join(',') }), ...(noCoverageOnly && { no_coverage_only: 'true' }) },
    signal,
  })

export const fetchStay = (id, { signal } = {}) => http.get(`/api/stays/${encodeURIComponent(id)}`, { signal })

export const fetchStaySummary = (id, { lang, signal } = {}) =>
  http.get(`/api/stays/${encodeURIComponent(id)}/summary`, { params: lang ? { lang } : undefined, signal, timeout: 60_000 })

export const fetchOperators = ({ signal } = {}) => http.get('/api/operators', { signal })

export const fetchHealth = ({ signal } = {}) => http.get('/api/health', { signal })

export const fetchDeadZonesMeta = ({ signal } = {}) => http.get('/dead-zones/dead_zones.json', { signal })

export const fetchRandomStay = ({ noCoverageOnly = false, signal } = {}) =>
  http.get('/api/stays/random', { params: { ...(noCoverageOnly && { no_coverage_only: 'true' }) }, signal })

export const fetchGeocode = (q, { signal } = {}) => http.get('/api/geocode', { params: { q }, signal })

const SEARCH_RADII_KM = [25, 50, 75, 100, 150, 200]
const MIN_RESULTS = 5
const MAX_RESULTS = 50

const KM_PER_DEGREE_LAT = 111.32

function bboxAround(lat, lon, km) {
  const dLat = km / KM_PER_DEGREE_LAT
  const dLon = km / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}

const unionBbox = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]

function websiteUrl({ name, city }) {
  const query = [name, city].filter(Boolean).join(' ')
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`
}

export function toPlace(feature) {
  const p = feature.properties
  const [lon, lat] = feature.geometry.coordinates
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    city: p.city ?? '',
    distanceKm: p.distance_to_coverage_m === null ? null : Math.round(p.distance_to_coverage_m / 100) / 10,
    direction: p.direction,
    hasCoverage: p.has_coverage,
    lat,
    lng: lon,
    website: p.website,
    phone: p.phone,
    websiteUrl: websiteUrl(p),
  }
}

async function placesAround(lat, lon, area = null) {
  let features = []
  for (const km of SEARCH_RADII_KM) {
    const around = bboxAround(lat, lon, km)
    ;({ features } = await fetchStays({ bbox: area ? unionBbox(area, around) : around, noCoverageOnly: true }))
    if (features.length >= MIN_RESULTS) break
  }
  return features.slice(0, MAX_RESULTS).map(toPlace)
}

export async function searchPlaces(query) {
  if (query.trim().length < 2) return []
  const [found] = await fetchGeocode(query.trim())
  if (!found) return []
  return placesAround(found.lat, found.lon, found.bbox)
}

export function fetchNearbyPlaces({ lat, lng }) {
  return placesAround(lat, lng)
}

export async function fetchRandomPlace() {
  return toPlace(await fetchRandomStay({ noCoverageOnly: true }))
}

export async function fetchPlaceDetails(id, { lang, signal } = {}) {
  const { summary, wikipedia, images } = await fetchStaySummary(id, { lang, signal })
  const photos = [wikipedia?.image, ...images.map((image) => image.image)].filter(Boolean)
  return { aiSummary: summary, photos }
}

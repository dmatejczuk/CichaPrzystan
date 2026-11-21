// All HTTP communication with the Express API. Protocol: docs/API.md
import axios from 'axios'

// Empty baseURL -> same origin, requests go through the Vite proxy (/api and /dead-zones -> server).
// Set VITE_API_URL=http://localhost:3000 to call the server directly (CORS is enabled there).
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
    this.status = status // HTTP status, 0 when there was no response
    // BAD_REQUEST | NOT_FOUND | INTERNAL_ERROR | UNAVAILABLE (503: data not generated / summary down)
    // | NETWORK_ERROR | TIMEOUT | UNKNOWN
    this.code = code
  }
}

// Server errors look like { "error": "message" }. Every failure becomes an ApiError;
// cancelled requests are passed through untouched (check isCancel(err) and ignore them).
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

// ---------- helpers ----------

/** Leaflet LatLngBounds -> bbox array [minLon, minLat, maxLon, maxLat]. */
export const bboxFromBounds = (b) => [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]

/** GeoJSON Feature (coordinates are [lon, lat]) -> Leaflet [lat, lon]. */
export const featureToLatLng = (feature) => {
  const [lon, lat] = feature.geometry.coordinates
  return [lat, lon]
}

/** URL of the dead zones PNG for <ImageOverlay url=... bounds={meta.bounds} />. */
export const DEAD_ZONES_IMAGE_URL = `${BASE_URL}/dead-zones/dead_zones.png`

// ---------- endpoints (see docs/API.md) ----------

/**
 * GET /api/coverage - coverage at a point.
 * @param {{lat:number, lon:number, operator?:string, signal?:AbortSignal}} p
 * @returns {Promise<{has_coverage:boolean, operators:string[], distance_to_coverage_m:number|null,
 *   direction:string|null, bearing:number|null, nearest_operator:string|null, note?:string}>}
 */
export const fetchCoverage = ({ lat, lon, operator, signal }) =>
  http.get('/api/coverage', { params: { lat, lon, ...(operator && { operator }) }, signal })

/**
 * GET /api/stays - stays in an area as GeoJSON FeatureCollection (max 1000, `total` = all matches).
 * Call after the map moves; pass a signal to cancel the previous request.
 * @param {{bbox?:number[], noCoverageOnly?:boolean, signal?:AbortSignal}} [p] bbox = [minLon,minLat,maxLon,maxLat]
 * @returns {Promise<{type:'FeatureCollection', total:number, features:Array<{type:'Feature',
 *   geometry:{type:'Point', coordinates:[number,number]},
 *   properties:{id:string, name:string|null, type:string, website:string|null, phone:string|null,
 *     has_coverage:boolean, operators:string[], distance_to_coverage_m:number|null,
 *     direction:string|null, note:string|null}}>}>}
 */
export const fetchStays = ({ bbox, noCoverageOnly = false, signal } = {}) =>
  http.get('/api/stays', {
    params: { ...(bbox && { bbox: bbox.join(',') }), ...(noCoverageOnly && { no_coverage_only: 'true' }) },
    signal,
  })

/** GET /api/stays/:id - one stay (a single Feature, same shape as an item of fetchStays().features). */
export const fetchStay = (id, { signal } = {}) => http.get(`/api/stays/${encodeURIComponent(id)}`, { signal })

/**
 * GET /api/stays/:id/summary - AI summary of one stay, for the click on a marker.
 * Slow (external research + AI), so the timeout is 60 s; cached by the server afterwards.
 * @returns {Promise<{id:string, summary:string,
 *   wikipedia:{title:string, description:string|null, extract:string|null, url:string|null, image:string|null}|null,
 *   images:Array<{title:string, image:string, page:string|null, author:string|null, license:string|null, license_url:string|null}>,
 *   osm_url:string|null, generated_at:string}>}
 */
export const fetchStaySummary = (id, { signal } = {}) =>
  http.get(`/api/stays/${encodeURIComponent(id)}/summary`, { signal, timeout: 60_000 })

/** GET /api/operators -> e.g. ["Orange","Play","Plus","T-Mobile"] */
export const fetchOperators = ({ signal } = {}) => http.get('/api/operators', { signal })

/** GET /api/health -> { status: 'ok' | 'missing data', towers: number, stays: number } */
export const fetchHealth = ({ signal } = {}) => http.get('/api/health', { signal })

/** GET /dead-zones/dead_zones.json -> { bounds:[[S,W],[N,E]], width, height, cell_size_m, ..., farthest_from_coverage:[...] } */
export const fetchDeadZonesMeta = ({ signal } = {}) => http.get('/dead-zones/dead_zones.json', { signal })

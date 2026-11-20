import { badRequest } from './errors.js'

// "minLon,minLat,maxLon,maxLat" -> [minLon, minLat, maxLon, maxLat]
export function parseBbox(raw) {
  if (typeof raw !== 'string' || raw === '') throw badRequest('Query param "bbox" is required: minLon,minLat,maxLon,maxLat')
  const parts = raw.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw badRequest('"bbox" must be 4 comma-separated numbers: minLon,minLat,maxLon,maxLat')
  }
  const [minLon, minLat, maxLon, maxLat] = parts
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) throw badRequest('"bbox" is out of range')
  if (minLon >= maxLon || minLat >= maxLat) throw badRequest('"bbox" must satisfy min < max')
  return parts
}

export function parseBool(raw) {
  return raw === 'true' || raw === '1'
}

export function parseList(raw) {
  if (typeof raw !== 'string' || raw === '') return null
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function parseLimit(raw, { def = 500, max = 2000 } = {}) {
  if (raw === undefined) return def
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > max) throw badRequest(`"limit" must be an integer 1..${max}`)
  return n
}

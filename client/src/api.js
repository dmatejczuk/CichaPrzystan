import axios from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status // 0 when there was no response
    this.code = code // BAD_REQUEST | NOT_FOUND | INTERNAL_ERROR | NETWORK_ERROR | TIMEOUT
  }
}

// Convert every axios failure into ApiError.
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (axios.isCancel(err)) return Promise.reject(err)
    if (err.response) {
      const e = err.response.data?.error
      return Promise.reject(new ApiError(e?.message ?? err.message, { status: err.response.status, code: e?.code ?? 'UNKNOWN' }))
    }
    if (err.code === 'ECONNABORTED') return Promise.reject(new ApiError('Request timed out', { code: 'TIMEOUT' }))
    return Promise.reject(new ApiError('Server unreachable', { code: 'NETWORK_ERROR' }))
  },
)

export const isCancel = axios.isCancel

// bbox array [minLon, minLat, maxLon, maxLat].
export const bboxFromBounds = (b) => [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]

export function fetchStays({ bbox, noCoverageOnly = false, types, limit, signal }) {
  return http.get('/api/stays', {
    params: {
      bbox: bbox.join(','),
      ...(noCoverageOnly && { no_coverage_only: 'true' }),
      ...(types?.length && { types: types.join(',') }),
      ...(limit && { limit }),
    },
    signal,
  })
}

export function fetchStaySummary(id, { signal } = {}) {
  return http.get(`/api/stays/${encodeURIComponent(id)}/summary`, { signal, timeout: 30_000 }) // summarising can be slow
}

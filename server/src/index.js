import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { corsMiddleware } from './cors.js'
import { createSummaryRouter } from './summary-routes.js'
import { checkSummarySetup } from './summary.js'
import { CoverageIndex } from './coverage.js'
import { StayStore } from './stays.js'
import { searchPlaces, GeocodeUnavailable } from './geocode.js'

const PORT = Number(process.env.PORT) || 3000
const DATA_DIR = path.resolve(
  process.env.DATA_DIR || fileURLToPath(new URL('../../data', import.meta.url)),
)
// Whitelist of files served from DATA_DIR.
const DEAD_ZONE_FILES = ['dead_zones.png', 'dead_zones.json']

function load(name, loader) {
  const started = Date.now()
  try {
    const value = loader()
    console.log(`loaded ${name} in ${Date.now() - started} ms`)
    return value
  } catch (err) {
    console.warn(`could not load ${name} from ${DATA_DIR}: ${err.message}`)
    console.warn('run the data pipeline first: docker compose run --rm pipeline')
    return null
  }
}

const coverage = load('towers_pl.json', () => CoverageIndex.fromFile(DATA_DIR))
const stays = load('stays_coverage.geojson', () => StayStore.fromFile(DATA_DIR))
checkSummarySetup()

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function requireData(value, file) {
  if (!value) throw new HttpError(503, `data not loaded: ${file} missing, run the data pipeline`)
  return value
}

function parseNumber(raw, name, min, max) {
  if (raw === undefined || raw === '') throw new HttpError(400, `missing parameter: ${name}`)
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new HttpError(400, `invalid parameter: ${name} must be a number between ${min} and ${max}`)
  }
  return value
}

function parseBoolean(raw, name) {
  if (raw === undefined || raw === '' || raw === 'false' || raw === '0') return false
  if (raw === 'true' || raw === '1') return true
  throw new HttpError(400, `invalid parameter: ${name} must be true or false`)
}

function parseBbox(raw) {
  if (raw === undefined || raw === '') return null
  const parts = String(raw).split(',').map(Number)
  const valid =
    parts.length === 4 &&
    parts.every(Number.isFinite) &&
    parts[0] <= parts[2] &&
    parts[1] <= parts[3]
  if (!valid) throw new HttpError(400, 'invalid parameter: bbox must be minLon,minLat,maxLon,maxLat')
  return parts
}

function parseOperator(raw, index) {
  if (raw === undefined || raw === '') return null
  const match = index.operators.find((op) => op.toLowerCase() === String(raw).toLowerCase())
  if (!match) {
    throw new HttpError(400, `unknown operator: ${raw} (expected one of: ${index.operators.join(', ')})`)
  }
  return match
}

const app = express()
app.use(corsMiddleware)

app.get('/api/health', (req, res) => {
  res.json({
    status: coverage && stays ? 'ok' : 'missing data',
    towers: coverage ? coverage.towers.length : 0,
    stays: stays ? stays.size : 0,
  })
})

app.get('/api/coverage', (req, res) => {
  const index = requireData(coverage, 'towers_pl.json')
  const lat = parseNumber(req.query.lat, 'lat', -90, 90)
  const lon = parseNumber(req.query.lon, 'lon', -180, 180)
  const operator = parseOperator(req.query.operator, index)
  res.json(index.check(lat, lon, operator))
})

app.get('/api/stays', (req, res) => {
  const store = requireData(stays, 'stays_coverage.geojson')
  res.json(
    store.find({
      bbox: parseBbox(req.query.bbox),
      noCoverageOnly: parseBoolean(req.query.no_coverage_only, 'no_coverage_only'),
    }),
  )
})

app.get('/api/stays/random', (req, res) => {
  const store = requireData(stays, 'stays_coverage.geojson')
  const stay = store.random({
    bbox: parseBbox(req.query.bbox),
    noCoverageOnly: parseBoolean(req.query.no_coverage_only, 'no_coverage_only'),
  })
  if (!stay) throw new HttpError(404, 'no stay matches the given filters')
  res.json(stay)
})

app.get('/api/stays/:id', (req, res) => {
  const store = requireData(stays, 'stays_coverage.geojson')
  const stay = store.get(req.params.id)
  if (!stay) throw new HttpError(404, `stay not found: ${req.params.id}`)
  res.json(stay)
})

app.use('/api/stays', createSummaryRouter(() => stays)) // GET /api/stays/:id/summary

app.get('/api/geocode', async (req, res, next) => {
  const query = String(req.query.q ?? '').trim()
  if (query.length < 2) return next(new HttpError(400, 'missing parameter: q (at least 2 characters)'))
  try {
    res.json(await searchPlaces(query))
  } catch (err) {
    next(err instanceof GeocodeUnavailable ? new HttpError(503, 'place search unavailable') : err)
  }
})

app.get('/api/operators', (req, res) => {
  res.json(requireData(coverage, 'towers_pl.json').operators)
})

app.get('/dead-zones/:file', (req, res, next) => {
  if (!DEAD_ZONE_FILES.includes(req.params.file)) return next()
  res.sendFile(req.params.file, { root: DATA_DIR, maxAge: '1h' }, (err) => {
    if (err && !res.headersSent) {
      next(new HttpError(err.status === 404 ? 404 : 500, `${req.params.file} not available, run the data pipeline`))
    }
  })
})

app.use((req, res) => {
  res.status(404).json({ error: 'not found' })
})

app.use((err, req, res, next) => {
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 && !(err instanceof HttpError) ? 'internal server error' : err.message })
})

app.listen(PORT, () => {
  console.log(`server listening on port ${PORT}, data dir: ${DATA_DIR}`)
})

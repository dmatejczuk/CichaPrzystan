import express from 'express'
import cors from 'cors'
import staysRouter from './routes/stays.js'
import { errorMiddleware } from './errors.js'

const PORT = Number(process.env.PORT) || 3000
const DATA_DIR = process.env.DATA_DIR || '../data'

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim()).filter(Boolean)

const app = express()
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  maxAge: 86400,
}))

app.get('/api/health', (req, res) => res.json({ status: 'ok', dataDir: DATA_DIR }))
app.use('/api/stays', staysRouter)

// TODO: GET /api/coverage, GET /api/operators, GET /dead-zones/*

app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }))
app.use(errorMiddleware)

app.listen(PORT, () => console.log(`server listening on port ${PORT} (CORS: ${ALLOWED_ORIGINS.join(', ')})`))

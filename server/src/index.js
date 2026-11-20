import express from 'express'
import cors from 'cors'

const PORT = Number(process.env.PORT) || 3000
const DATA_DIR = process.env.DATA_DIR || '../data'

const app = express()
app.use(cors())

app.get('/api/health', (req, res) => res.json({ status: 'ok', dataDir: DATA_DIR }))

// TODO: GET /api/coverage?lat&lon&operator
// TODO: GET /api/stays?bbox&no_coverage_only
// TODO: GET /api/stays/:id
// TODO: GET /api/operators
// TODO: GET /dead-zones/dead_zones.png and /dead-zones/dead_zones.json (only these two files)

app.use((req, res) => res.status(404).json({ error: 'not found' }))

app.listen(PORT, () => console.log(`server listening on port ${PORT}`))

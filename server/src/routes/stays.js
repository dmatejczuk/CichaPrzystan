import { Router } from 'express'
import { asyncHandler, notFound } from '../errors.js'
import { parseBbox, parseBool, parseLimit, parseList } from '../validation.js'
import { findStays, getStay } from '../stays.js'
import { getStaySummary } from '../summary.js'

const router = Router()

// GET /api/stays?bbox=minLon,minLat,maxLon,maxLat[&no_coverage_only=true][&types=a,b][&limit=500]
router.get('/', asyncHandler(async (req, res) => {
  const bbox = parseBbox(req.query.bbox)
  const noCoverageOnly = parseBool(req.query.no_coverage_only)
  const types = parseList(req.query.types)
  const limit = parseLimit(req.query.limit)

  const { stays, truncated } = await findStays({ bbox, noCoverageOnly, types, limit })
  res.json({ bbox, count: stays.length, truncated, stays })
}))

// GET /api/stays/:id/summary
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const { id } = req.params
  if (!(await getStay(id))) throw notFound(`Place "${id}" not found`)
  const summary = await getStaySummary(id)
  if (!summary) throw notFound(`No summary for place "${id}"`)
  res.json(summary)
}))

export default router

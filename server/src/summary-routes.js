import { Router } from 'express'
import { getStaySummary, SummaryUnavailable } from './summary.js'

export function createSummaryRouter(getStore) {
  const router = Router()

  // GET /api/stays/:id/summary
  router.get('/:id/summary', async (req, res, next) => {
    try {
      const store = getStore()
      if (!store) {
        return res.status(503).json({ error: 'data not loaded: stays_coverage.geojson missing, run the data pipeline' })
      }
      const stay = store.get(req.params.id)
      let language = store.get(req.params.lang) || "pl";
      if (!stay) return res.status(404).json({ error: `stay not found: ${req.params.id}` })
      res.json(await getStaySummary(stay, language))
    } catch (err) {
      if (err instanceof SummaryUnavailable) return res.status(503).json({ error: 'summary unavailable' })
      next(err)
    }
  })

  return router
}

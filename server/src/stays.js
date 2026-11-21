import fs from 'node:fs'
import path from 'node:path'

export const MAX_STAYS = 1000

// Sort by distance to coverage, descending; stays without tower data come last.
function compareStays(a, b) {
  const da = a.properties.distance_to_coverage_m ?? -1
  const db = b.properties.distance_to_coverage_m ?? -1
  return db - da
}

export class StayStore {
  constructor(features) {
    this.features = [...features].sort(compareStays)
    this.byId = new Map(this.features.map((f) => [f.properties.id, f]))
  }

  static fromFile(dataDir) {
    const geojson = JSON.parse(fs.readFileSync(path.join(dataDir, 'stays_coverage.geojson'), 'utf8'))
    return new StayStore(geojson.features)
  }

  get size() {
    return this.features.length
  }

  get(id) {
    return this.byId.get(id) ?? null
  }

  // bbox: [minLon, minLat, maxLon, maxLat], or null to skip spatial filtering.
  filter({ bbox = null, noCoverageOnly = false } = {}) {
    return this.features.filter((f) => {
      const [lon, lat] = f.geometry.coordinates
      if (bbox && (lon < bbox[0] || lat < bbox[1] || lon > bbox[2] || lat > bbox[3])) return false
      if (noCoverageOnly && (f.properties.has_coverage || f.properties.distance_to_coverage_m === null)) {
        return false
      }
      return true
    })
  }

  find({ limit = MAX_STAYS, ...criteria } = {}) {
    const matches = this.filter(criteria)
    return {
      type: 'FeatureCollection',
      total: matches.length,
      features: matches.slice(0, limit),
    }
  }

  random(criteria = {}) {
    const matches = this.filter(criteria)
    return matches.length ? matches[Math.floor(Math.random() * matches.length)] : null
  }
}

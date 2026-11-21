// Point coverage check. Each transmitter is a circle with its range; see
// data-pipeline/coverage.py for the model. Must stay consistent with that module.

import fs from 'node:fs'
import path from 'node:path'
import KDBush from 'kdbush'
import { around } from 'geokdbush'

const EARTH_RADIUS_M = 6_371_000
const SEARCH_RADIUS_M = 60_000
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const NO_TOWERS_NOTE = 'no towers within 60 km'
const RAD = Math.PI / 180

export function haversineM(lon1, lat1, lon2, lat2) {
  const dLat = (lat2 - lat1) * RAD
  const dLon = (lon2 - lon1) * RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(a, 1)))
}

// Initial bearing in degrees, clockwise from north.
export function bearingDeg(lon1, lat1, lon2, lat2) {
  const phi1 = lat1 * RAD
  const phi2 = lat2 * RAD
  const dLon = (lon2 - lon1) * RAD
  const y = Math.sin(dLon) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

export function directionCode(bearing) {
  return DIRECTIONS[Math.floor((bearing + 22.5) / 45) % 8]
}

function roundHalfEven(x) {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

function noTowers() {
  return {
    has_coverage: false,
    operators: [],
    distance_to_coverage_m: null,
    direction: null,
    bearing: null,
    nearest_operator: null,
    note: NO_TOWERS_NOTE,
  }
}

// Radio types of one site share a position; only the widest range matters.
function mergeSites(towers) {
  const sites = new Map()
  for (const t of towers) {
    const key = `${t.operator}|${t.lon}|${t.lat}`
    const site = sites.get(key)
    if (!site) sites.set(key, { operator: t.operator, lon: t.lon, lat: t.lat, range: t.range })
    else if (t.range > site.range) site.range = t.range
  }
  return [...sites.values()]
}

export class CoverageIndex {
  constructor(towers) {
    this.towerCount = towers.length
    towers = mergeSites(towers)
    this.towers = towers
    this.maxRange = towers.reduce((max, t) => Math.max(max, t.range), 0)
    this.operators = [...new Set(towers.map((t) => t.operator))].sort()
    this.index = new KDBush(towers.length)
    for (const t of towers) this.index.add(t.lon, t.lat)
    this.index.finish()
  }

  static fromFile(dataDir) {
    const towers = JSON.parse(fs.readFileSync(path.join(dataDir, 'towers_pl.json'), 'utf8'))
    return new CoverageIndex(towers)
  }

  hasOperator(operator) {
    return this.operators.includes(operator)
  }

  check(lat, lon, operator = null) {
    if (operator !== null && !this.hasOperator(operator)) {
      throw new Error(`unknown operator: ${operator}`)
    }

    const predicate = operator === null ? undefined : (id) => this.towers[id].operator === operator
    const [nearestId] = around(this.index, lon, lat, 1, (SEARCH_RADIUS_M / 1000) * 1.0001, predicate)
    if (nearestId === undefined) return noTowers()
    const nearest = this.towers[nearestId]
    const nearestMargin = haversineM(lon, lat, nearest.lon, nearest.lat) - nearest.range

    // Only transmitters with distance - range <= max(nearestMargin, 0) can cover the
    // point or be closer to coverage, and all of them lie within this radius.
    const radius = Math.min(Math.max(nearestMargin, 0) + this.maxRange, SEARCH_RADIUS_M)
    // Query slightly beyond the radius; the exact limit is enforced with haversineM below.
    const ids = around(this.index, lon, lat, Infinity, (radius / 1000) * 1.0001, predicate).sort((a, b) => a - b)

    const cells = []
    for (const id of ids) {
      const tower = this.towers[id]
      const distance = haversineM(lon, lat, tower.lon, tower.lat)
      if (distance <= SEARCH_RADIUS_M) cells.push({ tower, margin: distance - tower.range })
    }
    if (cells.length === 0) return noTowers()

    const covered = cells.filter((c) => c.margin <= 0)
    if (covered.length > 0) {
      return {
        has_coverage: true,
        operators: [...new Set(covered.map((c) => c.tower.operator))].sort(),
        distance_to_coverage_m: 0,
        direction: null,
        bearing: null,
        nearest_operator: null,
      }
    }

    let best = cells[0]
    for (const c of cells) if (c.margin < best.margin) best = c
    const bearing = bearingDeg(lon, lat, best.tower.lon, best.tower.lat)
    return {
      has_coverage: false,
      operators: [],
      distance_to_coverage_m: roundHalfEven(best.margin),
      direction: directionCode(bearing),
      bearing: roundHalfEven(bearing) % 360,
      nearest_operator: best.tower.operator,
    }
  }
}

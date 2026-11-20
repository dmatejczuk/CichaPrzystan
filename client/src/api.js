// All HTTP calls to the Express API live here.

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`)
  return res.json()
}

// TODO: fetchStays({ bbox, noCoverageOnly })
// TODO: fetchStay(id)
// TODO: fetchCoverage({ lat, lon, operator })
// TODO: fetchOperators()
// TODO: fetchDeadZonesMeta()

export { getJson }

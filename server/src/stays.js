// MOCK DATA for use only in testing in full build change to real data.

const MOCK = [
  { id: 'n1', name: 'Chatka Puchatka', type: 'alpine_hut', lat: 49.1, lon: 22.7, noCoverage: true, shortInfo: 'Mountain hut, no signal.' },
  { id: 'n2', name: 'Pole namiotowe Dolina', type: 'camp_site', lat: 49.25, lon: 22.45, noCoverage: true, shortInfo: 'Tent camp by the river.' },
  { id: 'n3', name: 'Pensjonat Kaskada', type: 'guest_house', lat: 49.3, lon: 22.3, noCoverage: false, shortInfo: 'Weak LTE only.' },
]

export async function loadStays(_dataDir) {}

export async function findStays({ bbox, noCoverageOnly, types, limit }) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const all = MOCK.filter(
    (s) =>
      s.lon >= minLon && s.lon <= maxLon && s.lat >= minLat && s.lat <= maxLat &&
      (!noCoverageOnly || s.noCoverage) &&
      (!types || types.includes(s.type)),
  )
  return { stays: all.slice(0, limit), truncated: all.length > limit }
}

export async function getStay(id) {
  return MOCK.find((s) => s.id === id) ?? null
}

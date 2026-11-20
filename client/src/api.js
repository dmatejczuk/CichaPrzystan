import { mockPlaces } from './data/mockPlaces.js'

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`)
  return res.json()
}

export async function searchPlaces(query) {
  const text = query.trim().toLowerCase()
  if (!text) return mockPlaces
  return mockPlaces.filter((place) => `${place.name} ${place.city}`.toLowerCase().includes(text))
}

export async function fetchNearbyPlaces() {
  return mockPlaces
}

export async function fetchRandomPlace() {
  return mockPlaces[Math.floor(Math.random() * mockPlaces.length)]
}

export { getJson }

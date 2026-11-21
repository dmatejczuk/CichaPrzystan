// Builds the response of GET /api/stays/:id/summary (docs/API.md).

const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map()
const inFlight = new Map()

const AI_ERROR_TEXT = 'Przepraszamy, podczas generowania podsumowania AI wystąpił błąd'

const OSM_TYPES = { n: 'node', w: 'way', r: 'relation' }

export class SummaryUnavailable extends Error {}

let ai = null
async function loadAi() {
  if (ai) return ai
  try {
    // Loaded lazily so that a missing prompt file only disables summaries, not the whole server.
    const groq = await import('./groq.api.js')
    const research = await import('./osm-research.api.js')
    ai = {
      summarise: groq.summarise,
      errorText: groq.error_message ?? AI_ERROR_TEXT,
      researchOsmObject: research.researchOsmObject,
    }
    if (typeof ai.summarise !== 'function' || typeof ai.researchOsmObject !== 'function') {
      ai = null
      throw new Error('summarise / researchOsmObject not exported')
    }
    return ai
  } catch (err) {
    console.error(`summary modules not available: ${err.message}`)
    throw new SummaryUnavailable(err.message)
  }
}

export async function checkSummarySetup() {
  await loadAi().catch(() => console.warn('summaries disabled: check groq.api.js, osm-research.api.js and system_prompt.txt in server/src'))
  if (!process.env.GROQ_API_KEY) console.warn('GROQ_API_KEY is not set, summaries will fail')
}

function toOsmObject(feature) {
  const { id, name, type, city, website, phone } = feature.properties
  const m = /^([nwr])(\d+)$/.exec(id)
  const [lon, lat] = feature.geometry.coordinates
  return {
    id: m ? m[2] : null,
    type: m ? OSM_TYPES[m[1]] : null,
    lat,
    lon,
    tags: {
      name: name ?? undefined,
      tourism: type,
      'addr:city': city ?? undefined,
      website: website ?? undefined,
      phone: phone ?? undefined,
    },
  }
}

async function generate(feature,language) {
  const { summarise, errorText, researchOsmObject } = await loadAi()
  if (!process.env.GROQ_API_KEY) throw new SummaryUnavailable('GROQ_API_KEY is not set')
  const p = feature.properties

  let research
  try {
    research = await researchOsmObject(toOsmObject(feature))
  } catch (err) {
    console.error(`research failed for ${p.id}: ${err.message}`)
    throw new SummaryUnavailable(err.message)
  }

  const text = await summarise(research.text, language)
  if (text === errorText) throw new SummaryUnavailable('AI generation failed')

  const { wikipedia, commons, osm } = research.data
  return {
    id: p.id,
    stay: feature,
    summary: text,
    wikipedia: wikipedia
      ? { title: wikipedia.title, description: wikipedia.description ?? null, extract: wikipedia.extract ?? null, url: wikipedia.url ?? null, image: wikipedia.image ?? null }
      : null,
    images: p.name
      ? commons.map((c) => ({ title: c.title, image: c.image, page: c.page, author: c.author, license: c.license, license_url: c.licenseUrl }))
      : [],
    osm_url: osm?.osmUrl ?? null,
    generated_at: new Date().toISOString(),
  }
}

export function getStaySummary(feature, language = 'pl') {
  const id = feature.properties.id
  const cacheKey = `${id}:${language}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.value)

  if (!inFlight.has(cacheKey)) {
    const job = generate(feature, language)
      .then((value) => {
        cache.set(cacheKey, { at: Date.now(), value })
        return value
      })
      .finally(() => inFlight.delete(cacheKey))
    inFlight.set(cacheKey, job)
  }
  return inFlight.get(cacheKey)
}

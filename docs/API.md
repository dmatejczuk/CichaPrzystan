# Backend API Reference

The backend is a read-only Express server listening on port **3000**. All endpoints use `GET`, take parameters in the query string and return JSON (except the PNG image). The source code is in [`server/src/`](../server/src).

| Environment | Base URL |
| --- | --- |
| Local / Docker | `http://localhost:3000` |
| From the frontend (Vite) | Relative paths `/api/...` and `/dead-zones/...`, proxied to the server |

Data is loaded into memory once at startup from the `data/` directory (`DATA_DIR` environment variable). It is produced by the data pipeline (`docker compose run --rm pipeline`). Without it the server still starts, but data endpoints return 503.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| [`GET /api/coverage`](#get-apicoverage) | Coverage at a given point |
| [`GET /api/stays`](#get-apistays) | Stays in an area, as GeoJSON |
| [`GET /api/stays/random`](#get-apistaysrandom) | A random stay |
| [`GET /api/stays/:id`](#get-apistaysid) | A single stay |
| [`GET /api/stays/:id/summary`](#get-apistaysidsummary) | Stay data plus AI summary, Wikipedia extract and photos |
| [`GET /api/geocode`](#get-apigeocode) | Find a town, region or voivodeship by name |
| [`GET /api/operators`](#get-apioperators) | List of mobile operators |
| [`GET /api/health`](#get-apihealth) | Server status and loaded data |
| [`GET /dead-zones/...`](#dead-zone-overlay) | Dead zone image and its bounds |

## Errors

Errors always have the form `{ "error": "..." }`.

| Status | When |
| --- | --- |
| 400 | Missing or invalid parameter, unknown operator |
| 404 | Stay, file or path not found |
| 503 | Data not generated (the pipeline has not been run), or the summary service is unavailable |
| 500 | Unexpected server error |

## GET /api/coverage

Checks mobile coverage at any point, computed on request. It uses the same logic as [`data-pipeline/coverage.py`](../data-pipeline/coverage.py): each transmitter is a circle with radius `range`, and every transmitter within 60 km is considered. Transmitters come from OpenCelliD measurements and the UKE list of base station permits (see [Data sources](#data-sources)).

| Parameter | Required | Description |
| --- | --- | --- |
| `lat` | yes | Latitude, -90 to 90 |
| `lon` | yes | Longitude, -180 to 180 |
| `operator` | no | One of the values from `/api/operators`, case-insensitive (`play` = `Play`). If omitted, all operators are considered. |

Example: `GET /api/coverage?lat=49.1&lon=22.7`

### Response fields

| Field | Type | Description |
| --- | --- | --- |
| `has_coverage` | boolean | Whether the point has coverage |
| `operators` | string[] | Operators with coverage, sorted alphabetically; empty when there is no coverage |
| `distance_to_coverage_m` | number \| null | Distance to the nearest coverage in meters; `0` when covered, `null` when there is no data |
| `direction` | string \| null | Direction to coverage: `N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW` |
| `bearing` | number \| null | Same direction in degrees, 0–359, 0 = north |
| `nearest_operator` | string \| null | Operator of the nearest coverage |
| `note` | string | Present only when there is no data: `"no towers within 60 km"` |

### Possible results

Covered:

```json
{ "has_coverage": true, "operators": ["Orange", "Play"], "distance_to_coverage_m": 0,
  "direction": null, "bearing": null, "nearest_operator": null }
```

No coverage; the nearest coverage is 5.4 km to the northwest:

```json
{ "has_coverage": false, "operators": [], "distance_to_coverage_m": 5390,
  "direction": "NW", "bearing": 314, "nearest_operator": "Orange" }
```

No data: there are no cells within 60 km. This is not the same as a dead zone:

```json
{ "has_coverage": false, "operators": [], "distance_to_coverage_m": null,
  "direction": null, "bearing": null, "nearest_operator": null,
  "note": "no towers within 60 km" }
```

Errors: 400 when `lat` or `lon` is missing or out of range, or the operator is unknown (the message lists the allowed values); 503 when `towers_pl.json` is missing.

## GET /api/stays

Returns stays as a GeoJSON `FeatureCollection`, at most 1000 per request. The frontend calls it after every map move (`moveend`) with the visible area as `bbox`.

| Parameter | Required | Description |
| --- | --- | --- |
| `bbox` | no | `minLon,minLat,maxLon,maxLat`, e.g. `22.0,49.0,23.0,49.5`. If omitted, the whole of Poland. |
| `no_coverage_only` | no | `true` / `1` returns only stays without coverage; `false` / `0` or omitted returns all |

Example: `GET /api/stays?bbox=22.0,49.0,23.0,49.5&no_coverage_only=true`

**Ordering:** stays farthest from coverage come first, then stays with coverage, then stays without tower data. If more than 1000 stays match, the 1000 farthest from coverage are returned and `total` gives the full number of matches.

```json
{
  "type": "FeatureCollection",
  "total": 75,
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [22.61, 49.07] },
      "properties": {
        "id": "n123456",
        "name": "Niedźwiedzia Dolina",
        "type": "chalet",
      "city": "Wetlina",
        "city": "Wetlina",
        "website": "https://example.com",
        "phone": "+48 600 000 000",
        "has_coverage": false,
        "operators": [],
        "distance_to_coverage_m": 11826,
        "direction": "NE",
        "note": null
      }
    }
  ]
}
```

> GeoJSON `coordinates` are `[lon, lat]`, the reverse of Leaflet's `[lat, lon]`.

### Stay fields (`properties`)

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | OSM identifier: `n` = node, `w` = way (building or area), `r` = relation, followed by the number |
| `name` | string \| null | Name from OSM; may be missing |
| `type` | string | Stay type, e.g. `chalet`, `hotel` (see [Value reference](#value-reference)) |
| `city` | string | Locality from the OSM address (`addr:city`, `addr:place`); when the stay has no address, the nearest settlement (city, town, village or hamlet) |
| `website` | string \| null | Website |
| `phone` | string \| null | Phone number |
| `has_coverage` | boolean | Whether the stay has coverage |
| `operators` | string[] | Operators with coverage |
| `distance_to_coverage_m` | number \| null | Distance to coverage in meters; `0` when covered, `null` when there is no data |
| `direction` | string \| null | Direction to coverage (see [Value reference](#value-reference)) |
| `note` | string \| null | `"no towers within 60 km"` when there is no data, otherwise `null` |

Errors: 400 for an invalid `bbox` (not 4 numbers, or min > max) or an invalid `no_coverage_only`; 503 when `stays_coverage.geojson` is missing.

## GET /api/stays/random

Returns one random stay as a single `Feature` (same shape as an item of `features` in `/api/stays`). Used by the "pick a random place" button.

| Parameter | Required | Description |
| --- | --- | --- |
| `bbox` | no | Limit the draw to an area, same format as in `/api/stays` |
| `no_coverage_only` | no | `true` / `1` draws only from stays without coverage |

Example: `GET /api/stays/random?no_coverage_only=true`

Errors: 400 for an invalid parameter; 404 `{ "error": "no stay matches the given filters" }`; 503 when `stays_coverage.geojson` is missing.

## GET /api/stays/:id

Returns a single stay, e.g. for the details card shown after clicking a marker. The path takes the `id` from the stays list (`properties.id`).

Example: `GET /api/stays/n26860235`

The response is a single `Feature` with the same shape as an item of `features` in `/api/stays`.

Errors: 404 `{ "error": "stay not found: xyz" }` when no stay has that `id`; 503 when `stays_coverage.geojson` is missing.

## GET /api/stays/:id/summary

Everything the details card needs after a click on a marker, in one request: the stay itself (location and coverage data from `stays_coverage.geojson`) and an AI-generated description with supporting material. The path takes the `id` from the stays list (`properties.id`). The optional `lang` query parameter selects the summary language: `pl` (default) or `en`. For example, `GET /api/stays/n26860235/summary?lang=en`. Other values return 400.

How it is built: the server takes the stay from the data above, collects public information about it (`osm-research.api.js`: OpenStreetMap data, the nearest locality from Nominatim reverse geocoding, Wikidata, Wikipedia) and sends it to Groq (`groq.api.js`, with the language-specific `system_prompt_pl.txt` or `system_prompt_en.txt` prompt). It needs the `GROQ_API_KEY` environment variable. Coverage data is not sent to the AI (the prompt forbids mentioning missing internet); it is returned separately in `stay`.

This is slow (several external requests, up to about a minute in the worst case), so the client timeout is 60 s. Results are cached in server memory for 1 hour per stay and language; failures are not cached.

Example: `GET /api/stays/n26860235/summary?lang=pl`

```json
{
  "id": "n26860235",
  "stay": {
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [22.61, 49.07] },
    "properties": {
      "id": "n26860235",
      "name": "Niedźwiedzia Dolina",
      "type": "chalet",
      "city": "Wetlina",
      "website": "https://example.com",
      "phone": null,
      "has_coverage": false,
      "operators": [],
      "distance_to_coverage_m": 11826,
      "direction": "NE",
      "note": null
    }
  },
  "summary": "Niedźwiedzia Dolina - domek w Bieszczadach\n\nPoznaj to miejsce\n...",
  "wikipedia": {
    "title": "Chatka Puchatka",
    "description": "schronisko w Bieszczadach",
    "extract": "Short article extract.",
    "url": "https://pl.wikipedia.org/wiki/Chatka_Puchatka",
    "image": "https://upload.wikimedia.org/..."
  },
  "images": [],
  "osm_url": "https://www.openstreetmap.org/node/26860235",
  "generated_at": "2026-11-21T01:04:01.416Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Same `id` as in the request |
| `stay` | object | The stay as a GeoJSON `Feature`, identical to `GET /api/stays/:id` (coordinates are `[lon, lat]`; `properties` hold name, type, website, phone and the coverage fields) |
| `summary` | string | Text in the requested language (`pl` or `en`), written by the AI according to the corresponding system prompt: a title, then short sections with headings (the place, what awaits guests, guests' opinions if any, practical information). Sections without data are skipped. The formatting is chosen by the model and may contain Markdown, so render it as Markdown or keep the line breaks (`white-space: pre-wrap`) |
| `wikipedia` | object \| null | Extract of a matching Wikipedia article (from the OSM `wikipedia` tag or Wikidata); `null` when none was found. Fields `description`, `extract`, `url`, `image` may be `null` |
| `images` | object[] | Reserved for Wikimedia Commons photos. The Commons search is currently disabled in `osm-research.api.js`, so the array is always empty; use `wikipedia.image` when present |
| `osm_url` | string \| null | Link to the object on openstreetmap.org |
| `generated_at` | string | ISO 8601 UTC time when the summary was generated |

Errors: 400 when `lang` is not `pl` or `en`; 404 `{ "error": "stay not found: xyz" }` when no stay has that `id`; 503 `{ "error": "summary unavailable" }` when the research or AI step fails (missing `GROQ_API_KEY` or a language-specific system prompt, Groq error; the server log has the reason); 503 `data not loaded` when the pipeline has not been run.

## GET /api/geocode

Finds places in Poland by name: towns, villages, regions, voivodeships. The server forwards the query to the public [Nominatim](https://nominatim.org) API (OpenStreetMap data), throttles it to one request per second as its usage policy requires and caches results in memory.

| Parameter | Required | Description |
| --- | --- | --- |
| `q` | yes | Place name, at least 2 characters, e.g. `Kraków`, `małopolskie`, `Ustrzyki Dolne` |

Example: `GET /api/geocode?q=Kraków`

```json
[
  {
    "name": "Kraków",
    "display_name": "Kraków, województwo małopolskie, Polska",
    "type": "administrative",
    "lat": 50.0469432,
    "lon": 19.9971534,
    "bbox": [19.7922355, 49.9676668, 20.2173455, 50.1261338]
  }
]
```

Up to 5 results, best match first; an empty array when nothing is found. `bbox` uses the same `[minLon, minLat, maxLon, maxLat]` order as `/api/stays`, so it can be passed on directly. `type` is the Nominatim address type, e.g. `city`, `town`, `village`, `state` (voivodeship).

Errors: 400 when `q` is missing or shorter than 2 characters; 503 `{ "error": "place search unavailable" }` when Nominatim cannot be reached.

## GET /api/operators

Takes no parameters and returns the operators present in the data, sorted alphabetically. Use these names for the `operator` parameter of `/api/coverage`.

```json
["Orange", "Play", "Plus", "T-Mobile"]
```

## GET /api/health

Reports whether the server is running and how much data it has loaded. Use it to check that the pipeline has been run.

```json
{ "status": "ok", "towers": 178808, "stays": 27316 }
```

When data is missing it returns `"status": "missing data"` with zero counts (status 200).

## Dead zone overlay

Two static files for the "show dead zones" map layer. These are the only files served from the data directory; any other path under `/dead-zones/` returns 404. Both files are cached for 1 hour.

| Path | Content |
| --- | --- |
| `GET /dead-zones/dead_zones.png` | PNG image, 2766 × 2607 px, one pixel ≈ 250 m. Transparent = coverage or outside Poland; purple = no coverage, darker the farther it is to coverage (fully dark from 3 km). |
| `GET /dead-zones/dead_zones.json` | Where to place the image on the map (`bounds`), plus statistics |

```json
{
  "image": "dead_zones.png",
  "bounds": [[48.989495, 14.07], [54.84, 24.151887]],
  "width": 2766,
  "height": 2607,
  "cell_size_m": 250,
  "max_color_distance_m": 3000,
  "cells_in_poland": 5068412,
  "cells_without_coverage": 73239,
  "share_without_coverage": 0.0145,
  "farthest_from_coverage": [
    { "lat": 49.00743, "lon": 22.88892, "distance_to_coverage_m": 10548 }
  ]
}
```

`bounds` is already in Leaflet format, `[[south, west], [north, east]]`, so it can be passed as is:

```jsx
<ImageOverlay url="/dead-zones/dead_zones.png" bounds={meta.bounds} opacity={0.8} />
```

The image is computed in the same projection as the map (Web Mercator), so no reprojection is needed. `farthest_from_coverage` lists the 10 places farthest from coverage, at least 10 km apart.

## Value reference

The API returns English codes; the Polish UI labels are defined in [`client/src/i18n.js`](../client/src/i18n.js).

### Directions (`direction`)

| Code | Meaning | Polish UI label |
| --- | --- | --- |
| `N` | north | na północ |
| `NE` | northeast | na północny wschód |
| `E` | east | na wschód |
| `SE` | southeast | na południowy wschód |
| `S` | south | na południe |
| `SW` | southwest | na południowy zachód |
| `W` | west | na zachód |
| `NW` | northwest | na północny zachód |

### Stay types (`type`)

| Code (OSM `tourism`) | Meaning | Polish UI label | Count |
| --- | --- | --- | --- |
| `guest_house` | Guest house | Pensjonat | 9787 |
| `chalet` | Chalet / cabin | Domek | 6686 |
| `hotel` | Hotel | Hotel | 6326 |
| `camp_site` | Campsite | Pole namiotowe | 1798 |
| `apartment` | Apartment | Apartament | 1278 |
| `hostel` | Hostel | Hostel | 1253 |
| `alpine_hut` | Mountain hut | Schronisko górskie | 127 |
| `wilderness_hut` | Wilderness hut | Chatka | 61 |

### Operators

`Orange`, `Play`, `Plus`, `T-Mobile`. The data model also has an `other` category for remaining networks, but it currently contains no cells.

## Frontend communication layer

All requests go through [`client/src/api.js`](../client/src/api.js) (axios). Components should not call axios directly.

| Function | Endpoint | Returns |
| --- | --- | --- |
| `fetchCoverage({ lat, lon, operator })` | `GET /api/coverage` | coverage object |
| `fetchStays({ bbox, noCoverageOnly })` | `GET /api/stays` | GeoJSON `FeatureCollection` |
| `fetchStay(id)` | `GET /api/stays/:id` | one `Feature` |
| `fetchRandomStay({ noCoverageOnly })` | `GET /api/stays/random` | one `Feature` |
| `fetchGeocode(q)` | `GET /api/geocode` | list of places with `bbox` |
| `fetchStaySummary(id, { lang })` | `GET /api/stays/:id/summary?lang=...` | stay + AI summary object in the requested language (`pl` or `en`, default `pl`) |
| `fetchOperators()` | `GET /api/operators` | `string[]` |
| `fetchHealth()` | `GET /api/health` | `{ status, towers, stays }` |
| `fetchDeadZonesMeta()` | `GET /dead-zones/dead_zones.json` | metadata with `bounds` |
| `DEAD_ZONES_IMAGE_URL` | `GET /dead-zones/dead_zones.png` | constant for `<ImageOverlay url=...>` |

The search panel uses higher-level functions that return ready-to-render place objects (`{ id, name, type, city, distanceKm, direction, lat, lng, website, phone, bookingUrl }`, built by `toPlace(feature)`; `distanceKm` is the distance to the nearest coverage):

| Function | Used by | What it does |
| --- | --- | --- |
| `searchPlaces(query)` | search field | `fetchGeocode`, then stays without coverage in the found area and around it |
| `fetchNearbyPlaces({ lat, lng })` | "Find in my area" | stays without coverage around the user's position |
| `fetchRandomPlace()` | "Pick a random place" | one random stay without coverage |
| `fetchPlaceDetails(id)` | details screen | `{ aiSummary, photos }` from the summary endpoint |

Search starts with a 25 km radius and widens it (50, 75, 100 km) until at least 5 stays are found, because coverage is dense around big cities. Results are capped at 50, quietest first.

Helpers: `bboxFromBounds(map.getBounds())` gives the `bbox` array `[minLon, minLat, maxLon, maxLat]`; `featureToLatLng(feature)` swaps GeoJSON `[lon, lat]` to Leaflet `[lat, lon]`.

- **Base URL:** relative by default (Vite proxies `/api` and `/dead-zones`). Set `VITE_API_URL=http://localhost:3000` to call the server directly.
- **Cancelling:** every function accepts `signal` (an `AbortSignal`). On `moveend`, abort the previous `fetchStays` and ignore its rejection with `isCancel(err)`.
- **Timeouts:** 10 s for every endpoint, 60 s for the summary.
- **Errors:** every failure is thrown as `ApiError` with `status` (0 if no response), `message` (the server's `error` text) and `code`: `BAD_REQUEST` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500), `UNAVAILABLE` (503), plus client-side `NETWORK_ERROR` and `TIMEOUT`.
- **CORS:** the server allows the origins listed in the `CORS_ORIGINS` environment variable (comma-separated, default `http://localhost:5173,http://127.0.0.1:5173`), methods `GET, OPTIONS`, headers `Content-Type, Accept`. Set it to the real frontend URL in production.

```js
import { fetchStays, fetchStaySummary, bboxFromBounds, featureToLatLng, isCancel } from './api.js'

let ctrl
map.on('moveend', async () => {
  ctrl?.abort()
  ctrl = new AbortController()
  try {
    const { features, total } = await fetchStays({ bbox: bboxFromBounds(map.getBounds()), noCoverageOnly: true, signal: ctrl.signal })
  } catch (err) {
    if (!isCancel(err)) console.error(err.code, err.message)
  }
})

// on marker click: one request gives the location data and the AI text
const { stay, summary, images, wikipedia } = await fetchStaySummary(feature.properties.id)
const position = featureToLatLng(stay)
```

Server side, the summary endpoint lives in `server/src/summary-routes.js` (route) and `server/src/summary.js` (combines `stays.js`, `osm-research.api.js` and `groq.api.js`); `server/src/cors.js` holds the CORS settings. They are connected in `index.js` (imports at the top, `app.use(corsMiddleware)` and the summary router).

## Running the server

0. Summaries only: put your Groq key in `.env` (`GROQ_API_KEY=...`, see `.env.example`). Without it, or without `server/src/system_prompt_pl.txt` and `server/src/system_prompt_en.txt`, everything else works and the summary endpoint returns 503.
1. Generate data (once, or after the input files change): `docker compose run --rm pipeline`
2. Whole application: `docker compose up`; the frontend runs at `http://localhost:5173` and the API at `http://localhost:3000`
3. Backend only, without Docker: `cd server`, `npm install`, `npm run dev`

Quick check: `http://localhost:3000/api/health` should return `"status": "ok"`.

## Data sources

Transmitters (`towers_pl.csv`, `towers_pl.json`) are built from two sources by `data-pipeline/prepare_towers.py`:

| Source | What it gives | Limitations |
| --- | --- | --- |
| [OpenCelliD](https://opencellid.org) | Cells measured by app users, with an estimated range per cell | Only cells seen recently, so whole towns can be missing (e.g. Brodnica, Bytów) |
| [UKE base station permits](https://bip.uke.gov.pl/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/stacje-gsm-umts-lte-5gnr-oraz-cdma,12,0.html) | Official list of licensed sites of Orange, T-Mobile, Play and Plus, one XLSX per band, updated monthly | A permit does not guarantee that the site is built; no ranges are published; Plus has only a few hundred entries |

UKE ranges are assumed per band: 6 km for 700–900 MHz, 3 km for 1800 MHz, 2.5 km for 2100 MHz, 1.5 km for 2600 MHz and 1 km for 3600 MHz. With both sources about 1.5% of Poland comes out without coverage; with OpenCelliD alone it was 29%.

The model ignores terrain, so coverage in deep mountain valleys may be overestimated and the UI should still describe it as "estimated coverage". The pipeline downloads the UKE lists into `data/uke/`; delete that folder to fetch the latest month.

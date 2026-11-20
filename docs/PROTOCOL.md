# Frontend <-> Backend protocol

Transport: HTTP/1.1, JSON, UTF-8. Client: axios (`client/src/api.js`). Server: Express (`server/src/`).
Base URL: `/api` (Vite proxy in dev) or `VITE_API_URL` (direct, CORS enabled).
Only `GET` is used. Every failure returns the error format from section 4.

Field naming: JSON in camelCase, query params in snake_case.

## 1. Flow

```
map moves / filters change
  Front --GET /api/stays?bbox=...-------------> Back
  Front <-- 200 { stays: [ {id,name,type,lat,lon,noCoverage,shortInfo} ] } --

user clicks a place
  Front --GET /api/stays/:id/summary----------> Back
  Front <-- 200 { summary, rating, opinions[], activities[] } --
```

## 2. Search places in an area

`GET /api/stays`

| query param        | required | format                              | example                     |
|--------------------|----------|-------------------------------------|-----------------------------|
| `bbox`             | yes      | `minLon,minLat,maxLon,maxLat` (WGS84; = Leaflet west,south,east,north) | `22.1,49.0,22.9,49.5` |
| `no_coverage_only` | no       | `true` / `1` (default: false)       | `true`                      |
| `types`            | no       | comma list of OSM tourism types     | `camp_site,chalet`          |
| `limit`            | no       | integer 1..2000 (default 500)       | `200`                       |

Response `200`:

```json
{
  "bbox": [22.1, 49.0, 22.9, 49.5],
  "count": 1,
  "truncated": false,
  "stays": [
    {
      "id": "n2",
      "name": "Pole namiotowe Dolina",
      "type": "camp_site",
      "lat": 49.25,
      "lon": 22.45,
      "noCoverage": true,
      "shortInfo": "Tent camp by the river."
    }
  ]
}
```

- `id`: string, stable, used in section 3. `type`: OSM `tourism=*` value (see `client/src/i18n.js`).
- `noCoverage`: true = no tower covers this point.
- `truncated`: true when more than `limit` places matched (front should ask for a smaller area).
- Empty area = `200` with `"stays": []` (not an error).

## 3. Details of one place

`GET /api/stays/:id/summary` (`:id` URL-encoded)

Response `200`:

```json
{
  "id": "n2",
  "summary": "Short text summary of the place.",
  "rating": { "average": 4.6, "count": 12 },
  "opinions": [
    { "author": "Anna", "rating": 5, "text": "Totally quiet.", "source": "google" }
  ],
  "activities": ["hiking", "stargazing"],
  "generatedAt": "2026-11-20T20:30:48.370Z"
}
```

- `rating` may be `null`, `opinions` / `activities` may be `[]`; `opinion.rating` may be `null`.
- `generatedAt`: ISO 8601 UTC.
- May be slow (summarisation) - client timeout is 30 s (list: 10 s).
- Errors: `404 NOT_FOUND` for unknown `id`.

## 4. Errors

Status != 2xx, body always:

```json
{ "error": { "code": "BAD_REQUEST", "message": "human readable text" } }
```

| HTTP | code             | when                                |
|------|------------------|-------------------------------------|
| 400  | `BAD_REQUEST`    | missing / malformed query param     |
| 404  | `NOT_FOUND`      | unknown route or place id           |
| 500  | `INTERNAL_ERROR` | unexpected server error             |

Client-only codes (no HTTP response): `NETWORK_ERROR`, `TIMEOUT`. Cancelled requests are not errors - check `isCancel(err)` and ignore.

## 5. CORS

Server allows origins from env `CORS_ORIGINS` (comma list, default `http://localhost:5173,http://127.0.0.1:5173`), methods `GET, OPTIONS`, headers `Content-Type, Accept`. Set it to the real frontend URL in production.

## 6. Usage example (frontend)

```js
import { fetchStays, fetchStaySummary, bboxFromBounds, isCancel } from './api.js'

// on map `moveend`; keep one AbortController and abort the previous request
const ctrl = new AbortController()
try {
  const { stays } = await fetchStays({ bbox: bboxFromBounds(map.getBounds()), noCoverageOnly: true, signal: ctrl.signal })
} catch (err) {
  if (!isCancel(err)) console.error(err.code, err.message)
}

// on marker click
const details = await fetchStaySummary(stay.id)
```

## 7. Who plugs in where

- `server/src/stays.js` - `findStays`, `getStay` (CSV logic; currently MOCK data).
- `server/src/summary.js` - `getStaySummary` (summarisation; currently MOCK).
- Keep the return shapes and the API contract does not change.

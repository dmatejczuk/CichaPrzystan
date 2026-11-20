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
| [`GET /api/stays/:id`](#get-apistaysid) | A single stay |
| [`GET /api/operators`](#get-apioperators) | List of mobile operators |
| [`GET /api/health`](#get-apihealth) | Server status and loaded data |
| [`GET /dead-zones/...`](#dead-zone-overlay) | Dead zone image and its bounds |

## Errors

Errors always have the form `{ "error": "..." }`.

| Status | When |
| --- | --- |
| 400 | Missing or invalid parameter, unknown operator |
| 404 | Stay, file or path not found |
| 503 | Data not generated (the pipeline has not been run) |
| 500 | Unexpected server error |

## GET /api/coverage

Checks mobile coverage at any point, computed on request. It uses the same logic as [`data-pipeline/coverage.py`](../data-pipeline/coverage.py): each cell is a circle with radius `range`, and the 64 nearest cells within 60 km are considered.

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
| `website` | string \| null | Website |
| `phone` | string \| null | Phone number |
| `has_coverage` | boolean | Whether the stay has coverage |
| `operators` | string[] | Operators with coverage |
| `distance_to_coverage_m` | number \| null | Distance to coverage in meters; `0` when covered, `null` when there is no data |
| `direction` | string \| null | Direction to coverage (see [Value reference](#value-reference)) |
| `note` | string \| null | `"no towers within 60 km"` when there is no data, otherwise `null` |

Errors: 400 for an invalid `bbox` (not 4 numbers, or min > max) or an invalid `no_coverage_only`; 503 when `stays_coverage.geojson` is missing.

## GET /api/stays/:id

Returns a single stay, e.g. for the details card shown after clicking a marker. The path takes the `id` from the stays list (`properties.id`).

Example: `GET /api/stays/n26860235`

The response is a single `Feature` with the same shape as an item of `features` in `/api/stays`.

Errors: 404 `{ "error": "stay not found: xyz" }` when no stay has that `id`; 503 when `stays_coverage.geojson` is missing.

## GET /api/operators

Takes no parameters and returns the operators present in the data, sorted alphabetically. Use these names for the `operator` parameter of `/api/coverage`.

```json
["Orange", "Play", "Plus", "T-Mobile"]
```

## GET /api/health

Reports whether the server is running and how much data it has loaded. Use it to check that the pipeline has been run.

```json
{ "status": "ok", "towers": 92914, "stays": 27348 }
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
  "cells_without_coverage": 1471361,
  "share_without_coverage": 0.2903,
  "farthest_from_coverage": [
    { "lat": 50.37026, "lon": 23.58875, "distance_to_coverage_m": 36604 }
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
| `guest_house` | Guest house | Pensjonat | 9799 |
| `chalet` | Chalet / cabin | Domek | 6687 |
| `hotel` | Hotel | Hotel | 6333 |
| `camp_site` | Campsite | Pole namiotowe | 1802 |
| `apartment` | Apartment | Apartament | 1281 |
| `hostel` | Hostel | Hostel | 1254 |
| `alpine_hut` | Mountain hut | Schronisko górskie | 129 |
| `wilderness_hut` | Wilderness hut | Chatka | 63 |

### Operators

`Orange`, `Play`, `Plus`, `T-Mobile`. The data model also has an `other` category for remaining networks, but it currently contains no cells.

## Running the server

1. Generate data (once, or after the input files change): `docker compose run --rm pipeline`
2. Whole application: `docker compose up`; the frontend runs at `http://localhost:5173` and the API at `http://localhost:3000`
3. Backend only, without Docker: `cd server`, `npm install`, `npm run dev`

Quick check: `http://localhost:3000/api/health` should return `"status": "ok"`.

## Data caveat

Coverage is based on OpenCelliD, a crowdsourced database. Where measurements are missing, the model reports no coverage, so the UI should describe it as "estimated coverage".

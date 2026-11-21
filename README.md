# Cicha Przystań

Map of accommodation in Poland located in places without mobile coverage.

## Structure

- `data/` – input files (`260.csv.gz`, `poland-latest.osm.pbf`) and generated outputs (git-ignored)
- `data-pipeline/` – Python data preparation (run once)
- `server/` – Express API (Node.js 22)
- `client/` – Vite + React frontend
- `docs/` – documentation ([API reference](docs/API.md))

## Quick start (Windows PowerShell)

```powershell
Copy-Item .env.example .env            # set OPENCELLID_TOKEN
docker compose run --rm pipeline       # builds data/ outputs
docker compose up                      # app on http://localhost:5173
```

## API (server, port 3000)

| Endpoint | Description |
|---|---|
| `GET /api/coverage?lat&lon&operator` | Coverage at a point (same logic as `data-pipeline/coverage.py`); `operator` optional |
| `GET /api/stays?bbox=minLon,minLat,maxLon,maxLat&no_coverage_only=true` | Stays as GeoJSON FeatureCollection, farthest from coverage first, max 1000 (`total` = all matches) |
| `GET /api/stays/random?no_coverage_only=true` | One random stay |
| `GET /api/stays/:id` | One stay (e.g. `n123`, `w456`) or 404 |
| `GET /api/stays/:id/summary` | AI description of a stay (needs `GROQ_API_KEY`) |
| `GET /api/geocode?q=Kraków` | Find a place by name (Nominatim) |
| `GET /api/operators` | Operators present in the tower data |
| `GET /api/health` | Status and number of loaded towers and stays |
| `GET /dead-zones/dead_zones.png`, `/dead-zones/dead_zones.json` | Dead zone overlay and its bounds |

Errors are JSON: `{ "error": "..." }` (400 bad parameters, 404 not found, 503 data not generated yet).

Parameters, response fields and examples for every endpoint: [docs/API.md](docs/API.md).

## License

Code: MIT, see [LICENSE](LICENSE).

Data (not stored in this repository, generated into `data/`):
- Map data © OpenStreetMap contributors, licensed under [ODbL](https://opendatacommons.org/licenses/odbl/).
  Derived files (`stays.geojson`, `stays_coverage.geojson`, `places.geojson`, `poland_border.geojson`) are also ODbL.
- Cell tower data: [OpenCelliD](https://opencellid.org), licensed under [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Derived files (`towers_pl.*`, `dead_zones.*`) are shared under the same license.

# Cicha Przystań

Map of accommodation in Poland located in places without mobile coverage.

## Structure

- `data/` – input files (`260.csv.gz`, `poland-latest.osm.pbf`) and generated outputs (git-ignored)
- `data-pipeline/` – Python data preparation (run once)
- `server/` – Express API (Node.js 22)
- `client/` – Vite + React frontend

## Quick start (Windows PowerShell)

```powershell
Copy-Item .env.example .env            # set OPENCELLID_TOKEN
docker compose run --rm pipeline       # builds data/ outputs
docker compose up                      # app on http://localhost:5173
```

## License

Code: MIT, see [LICENSE](LICENSE).

Data (not stored in this repository, generated into `data/`):
- Map data © OpenStreetMap contributors, licensed under [ODbL](https://opendatacommons.org/licenses/odbl/).
  Derived files (`stays.geojson`, `stays_coverage.geojson`, `poland_border.geojson`) are also ODbL.
- Cell tower data: [OpenCelliD](https://opencellid.org), licensed under [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Derived files (`towers_pl.*`, `dead_zones.*`) are shared under the same license.

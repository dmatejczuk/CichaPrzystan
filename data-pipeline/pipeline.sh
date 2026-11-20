#!/usr/bin/env bash
# Downloads missing inputs and runs data preparation steps 1-4.
set -euo pipefail
DATA_DIR="${DATA_DIR:-/data}"
cd "$(dirname "$0")"

# TODO: download 260.csv.gz (OPENCELLID_TOKEN) and poland-latest.osm.pbf if missing
# TODO: python prepare_towers.py
# TODO: osmium tags-filter -> stays.geojson, osmium getid r49715 -> poland_border.geojson
# TODO: python dead_zones.py
# TODO: python stays_coverage.py
echo "pipeline: not implemented yet (DATA_DIR=$DATA_DIR)"

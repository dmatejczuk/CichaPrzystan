#!/usr/bin/env bash
# Downloads missing inputs and runs data preparation steps 1-4.
# Usage (from repo root): docker compose run --rm pipeline
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
export DATA_DIR
cd "$(dirname "$0")"

TOWERS_GZ="$DATA_DIR/260.csv.gz"
OSM_PBF="$DATA_DIR/poland-latest.osm.pbf"
STAYS_GEOJSON="$DATA_DIR/stays.geojson"
BORDER_GEOJSON="$DATA_DIR/poland_border.geojson"
OPENCELLID_URL="https://opencellid.org/ocid/downloads?type=mcc&file=260.csv.gz"
GEOFABRIK_URL="https://download.geofabrik.de/europe/poland-latest.osm.pbf"
STAY_TYPES="guest_house,chalet,alpine_hut,wilderness_hut,camp_site,hostel,hotel,apartment"
POLAND_RELATION="r49715"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

log() { echo "[pipeline] $*"; }

# Rebuild target when it is missing or older than its source
needs_build() { [ ! -s "$1" ] || [ "$2" -nt "$1" ]; }

download_towers() {
  if [ -f "$TOWERS_GZ" ] && gzip -t "$TOWERS_GZ" 2>/dev/null; then
    return
  fi
  [ -f "$TOWERS_GZ" ] && log "$TOWERS_GZ is not a valid gzip file, downloading again"
  if [ -z "${OPENCELLID_TOKEN:-}" ]; then
    log "error: $TOWERS_GZ is missing and OPENCELLID_TOKEN is not set (see .env.example)"
    exit 1
  fi
  log "downloading towers from OpenCelliD"
  local tmp="$WORK_DIR/260.csv.gz"
  curl -fsSL --retry 3 -o "$tmp" "$OPENCELLID_URL&token=$OPENCELLID_TOKEN"
  # OpenCelliD answers errors (bad token, rate limit) with text/HTML instead of a file
  if ! gzip -t "$tmp" 2>/dev/null; then
    log "error: OpenCelliD returned an error instead of the file:"
    sed 's/<[^>]*>/ /g' "$tmp" | tr -s ' \r\n\t' ' ' | head -c 300
    echo
    exit 1
  fi
  mv "$tmp" "$TOWERS_GZ"
}

download_osm() {
  if [ -s "$OSM_PBF" ]; then
    return
  fi
  log "downloading $GEOFABRIK_URL (about 2 GB)"
  local tmp="$WORK_DIR/poland-latest.osm.pbf"
  curl -fL --retry 3 -o "$tmp" "$GEOFABRIK_URL"
  osmium fileinfo "$tmp" > /dev/null || { log "error: downloaded OSM file is not a valid PBF"; exit 1; }
  mv "$tmp" "$OSM_PBF"
}

extract_stays() {
  if ! needs_build "$STAYS_GEOJSON" "$OSM_PBF"; then
    log "stays.geojson is up to date"
    return
  fi
  log "extracting stays from OSM"
  osmium tags-filter "$OSM_PBF" "nwr/tourism=$STAY_TYPES" -o "$WORK_DIR/stays.osm.pbf" --overwrite
  osmium export "$WORK_DIR/stays.osm.pbf" --attributes=type,id -o "$STAYS_GEOJSON" --overwrite
}

extract_border() {
  if ! needs_build "$BORDER_GEOJSON" "$OSM_PBF"; then
    log "poland_border.geojson is up to date"
    return
  fi
  log "extracting Poland border ($POLAND_RELATION)"
  osmium getid --add-referenced "$OSM_PBF" "$POLAND_RELATION" -o "$WORK_DIR/border.osm.pbf" --overwrite
  osmium export "$WORK_DIR/border.osm.pbf" --geometry-types=polygon --attributes=type,id \
    -o "$WORK_DIR/border_all.geojson" --overwrite
  # The country relation includes territorial sea; its voivodeships (admin_level=4,
  # pulled in as subareas) end at the coastline, so keep only those.
  python - "$WORK_DIR/border_all.geojson" "$BORDER_GEOJSON" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    features = json.load(f)["features"]
land = [
    f for f in features
    if f["properties"].get("@type") == "relation"
    and f["properties"].get("boundary") == "administrative"
    and f["properties"].get("admin_level") == "4"
]
if len(land) != 16:
    sys.exit(f"expected 16 voivodeships in the border extract, found {len(land)}")
with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": land}, f, ensure_ascii=False, separators=(",", ":"))
print(f"[pipeline] border: {len(land)} voivodeships")
PY
}

run_step() {
  log "running $1"
  python -u "$1"
}

started=$SECONDS
download_towers
download_osm
run_step prepare_towers.py
extract_stays
extract_border
run_step dead_zones.py
run_step stays_coverage.py
log "done in $((SECONDS - started))s; outputs in $DATA_DIR"

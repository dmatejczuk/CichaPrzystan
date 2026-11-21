"""Prepare mobile network transmitters for Poland.

Combines two sources:
- OpenCelliD cells (crowdsourced measurements, with an estimated range per cell),
- UKE base station permits (official list of licensed sites, see UKE_BANDS below).

OpenCelliD alone leaves large gaps where nobody has measured recently, so the UKE list
fills in the sites it is missing. Writes towers_pl.csv (used by the pipeline) and
towers_pl.json (used by the server).
"""

import gzip
import json
import os
import re
import time
from pathlib import Path

import pandas as pd

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
INPUT_FILE = DATA_DIR / "260.csv.gz"
UKE_DIR = DATA_DIR / "uke"
OUTPUT_CSV = DATA_DIR / "towers_pl.csv"
OUTPUT_JSON = DATA_DIR / "towers_pl.json"

COLUMNS = [
    "radio", "mcc", "net", "area", "cell", "unit", "lon", "lat",
    "range", "samples", "changeable", "created", "updated", "averageSignal",
]
USED_COLUMNS = ["radio", "mcc", "net", "lon", "lat", "range", "samples"]

POLAND_MCC = 260
MIN_SAMPLES = 2
OPERATORS = {1: "Plus", 2: "T-Mobile", 3: "Orange", 6: "Play"}
OTHER_OPERATOR = "other"

# Default range per radio type, used when OpenCelliD reports range = 0.
DEFAULT_RANGE_M = {"GSM": 5000, "UMTS": 3000, "LTE": 4000, "NR": 1500}
FALLBACK_RANGE_M = 4000
MIN_RANGE_M = 300
MAX_RANGE_M = 15000

# Cells outside this bounding box are treated as having invalid coordinates.
VALID_BBOX = (13.0, 48.0, 25.0, 56.0)

CHUNK_SIZE = 500_000

# UKE lists used for public mobile networks, with the radio type and the assumed cell
# range in metres. UKE publishes no ranges, so they follow typical rural macro cells:
# low bands reach far, high bands only cover the area around the site.
UKE_BANDS = {
    "gsm900": ("GSM", 6000),
    "umts900": ("UMTS", 6000),
    "lte700": ("LTE", 6000),
    "lte800": ("LTE", 6000),
    "lte900": ("LTE", 6000),
    "5g700": ("NR", 6000),
    "5g900": ("NR", 6000),
    "gsm1800": ("GSM", 3000),
    "lte1800": ("LTE", 3000),
    "5g1800": ("NR", 3000),
    "umts2100": ("UMTS", 2500),
    "lte2100": ("LTE", 2500),
    "5g2100": ("NR", 2500),
    "lte2600": ("LTE", 1500),
    "5g2600": ("NR", 1500),
    "5g3600": ("NR", 1000),
}
UKE_OPERATORS = {
    "Polkomtel": "Plus",
    "T-Mobile": "T-Mobile",
    "Orange": "Orange",
    "P4 ": "Play",
}
DMS_PATTERN = re.compile(r"(\d+)[NSEW](\d+)'(\d+)")


def file_has_header(path):
    with gzip.open(path, "rt") as f:
        return f.readline().startswith("radio")


def clean_chunk(chunk):
    min_lon, min_lat, max_lon, max_lat = VALID_BBOX
    chunk = chunk[
        (chunk["mcc"] == POLAND_MCC)
        & (chunk["samples"] >= MIN_SAMPLES)
        & chunk["lon"].between(min_lon, max_lon)
        & chunk["lat"].between(min_lat, max_lat)
    ].copy()

    default_range = chunk["radio"].map(DEFAULT_RANGE_M).fillna(FALLBACK_RANGE_M)
    chunk["range"] = chunk["range"].where(chunk["range"] > 0, default_range)
    chunk["range"] = chunk["range"].clip(MIN_RANGE_M, MAX_RANGE_M).round().astype(int)

    chunk["operator"] = chunk["net"].map(OPERATORS).fillna(OTHER_OPERATOR)
    chunk["lon"] = chunk["lon"].round(5)
    chunk["lat"] = chunk["lat"].round(5)
    return chunk[["radio", "operator", "lon", "lat", "range"]]


def parse_dms(value):
    """Convert UKE coordinates such as 20E58'40" to decimal degrees."""
    match = DMS_PATTERN.match(str(value).strip())
    if not match:
        return None
    degrees, minutes, seconds = (int(part) for part in match.groups())
    return degrees + minutes / 60 + seconds / 3600


def uke_operator(name):
    for prefix, operator in UKE_OPERATORS.items():
        if str(name).startswith(prefix):
            return operator
    return None


def load_uke():
    """Sites from the UKE permit lists; one row per operator, site and radio type."""
    frames = []
    for band, (radio, range_m) in UKE_BANDS.items():
        path = UKE_DIR / f"{band}.xlsx"
        if not path.exists():
            print(f"prepare_towers: {path.name} missing, skipped")
            continue
        sheet = pd.read_excel(path)
        frames.append(pd.DataFrame({
            "radio": radio,
            "operator": sheet["Nazwa Operatora"].map(uke_operator),
            "lon": sheet["Dł geogr stacji"].map(parse_dms),
            "lat": sheet["Szer geogr stacji"].map(parse_dms),
            "range": range_m,
        }))
    if not frames:
        return pd.DataFrame(columns=["radio", "operator", "lon", "lat", "range"])

    sites = pd.concat(frames, ignore_index=True).dropna()
    min_lon, min_lat, max_lon, max_lat = VALID_BBOX
    sites = sites[sites["lon"].between(min_lon, max_lon) & sites["lat"].between(min_lat, max_lat)]
    sites["lon"] = sites["lon"].round(5)
    sites["lat"] = sites["lat"].round(5)
    # A site holds permits for several bands; keep the widest range per radio type.
    sites = sites.groupby(["operator", "lon", "lat", "radio"], as_index=False)["range"].max()
    return sites[["radio", "operator", "lon", "lat", "range"]]


def main():
    started = time.monotonic()
    if not INPUT_FILE.exists():
        raise SystemExit(f"missing input file: {INPUT_FILE}")

    reader = pd.read_csv(
        INPUT_FILE,
        header=0 if file_has_header(INPUT_FILE) else None,
        names=COLUMNS,
        usecols=USED_COLUMNS,
        chunksize=CHUNK_SIZE,
    )

    total_rows = 0
    parts = []
    for chunk in reader:
        total_rows += len(chunk)
        parts.append(clean_chunk(chunk))
    measured = pd.concat(parts, ignore_index=True)
    licensed = load_uke()
    towers = pd.concat([measured, licensed], ignore_index=True)

    towers.to_csv(OUTPUT_CSV, index=False)
    records = towers[["operator", "lon", "lat", "range"]].to_dict(orient="records")
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, separators=(",", ":"))

    print(f"prepare_towers: OpenCelliD {total_rows} rows read, {len(measured)} cells kept")
    print(f"prepare_towers: UKE {len(licensed)} site entries, "
          f"{licensed[['lon', 'lat']].drop_duplicates().shape[0]} unique sites")
    print(towers["operator"].value_counts().to_string())
    print(f"prepare_towers: wrote {OUTPUT_CSV.name}, {OUTPUT_JSON.name} in {time.monotonic() - started:.1f}s")


if __name__ == "__main__":
    main()

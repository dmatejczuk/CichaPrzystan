"""Clean OpenCelliD cells for Poland.

Writes towers_pl.csv (used by the pipeline) and towers_pl.json (used by the server).
"""

import gzip
import json
import os
import time
from pathlib import Path

import pandas as pd

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
INPUT_FILE = DATA_DIR / "260.csv.gz"
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
    towers = pd.concat(parts, ignore_index=True)

    towers.to_csv(OUTPUT_CSV, index=False)
    records = towers[["operator", "lon", "lat", "range"]].to_dict(orient="records")
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, separators=(",", ":"))

    print(f"prepare_towers: {total_rows} rows read, {len(towers)} cells kept")
    print(towers["operator"].value_counts().to_string())
    print(f"prepare_towers: wrote {OUTPUT_CSV.name}, {OUTPUT_JSON.name} in {time.monotonic() - started:.1f}s")


if __name__ == "__main__":
    main()

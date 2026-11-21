"""Compute coverage for every stay and write stays_coverage.geojson (point features only)."""

import json
import os
import time
from collections import Counter
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

from coverage import CoverageIndex, to_xyz
from dead_zones import BBOX, CELL_SIZE_M, Grid, load_border_areas, rasterize_border

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
STAYS_FILE = DATA_DIR / "stays.geojson"
TOWERS_FILE = DATA_DIR / "towers_pl.csv"
PLACES_FILE = DATA_DIR / "places.geojson"
OUTPUT_FILE = DATA_DIR / "stays_coverage.geojson"

STAY_TYPES = {
    "guest_house", "chalet", "alpine_hut", "wilderness_hut",
    "camp_site", "hostel", "hotel", "apartment",
}
OSM_TYPE_PREFIX = {"node": "n", "way": "w", "relation": "r"}


class PolandMask:
    def __init__(self):
        self.grid = Grid(BBOX, CELL_SIZE_M)
        mask = rasterize_border(self.grid, load_border_areas(DATA_DIR / "poland_border.geojson"))
        # Dilate by one cell to keep stays located directly on the coastline.
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        self.mask = grown

    def contains(self, lon, lat):
        row = int(np.floor(self.grid.row(lat)))
        col = int(np.floor(self.grid.col(lon)))
        return 0 <= row < self.grid.height and 0 <= col < self.grid.width and bool(self.mask[row, col])


class NearestPlace:
    """Name of the nearest settlement, used when a stay has no address."""

    def __init__(self, path):
        with open(path, encoding="utf-8") as f:
            features = [f for f in json.load(f)["features"] if f["properties"].get("name")]
        lon = np.array([f["geometry"]["coordinates"][0] for f in features])
        lat = np.array([f["geometry"]["coordinates"][1] for f in features])
        self.names = [f["properties"]["name"] for f in features]
        self.tree = cKDTree(to_xyz(lon, lat))

    def name(self, lon, lat):
        _, i = self.tree.query(to_xyz(np.array([lon]), np.array([lat]))[0])
        return self.names[i]


def iter_coordinates(coords):
    if coords and isinstance(coords[0], (int, float)):
        yield coords
    else:
        for part in coords:
            yield from iter_coordinates(part)


def representative_point(geometry):
    if geometry["type"] == "Point":
        lon, lat = geometry["coordinates"][:2]
        return lon, lat
    # Use unique vertices so the closing point of each ring is not counted twice.
    points = list({(p[0], p[1]) for p in iter_coordinates(geometry["coordinates"])})
    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return lon, lat


def first_tag(tags, *keys):
    for key in keys:
        value = tags.get(key)
        if value:
            return value
    return None


def main():
    started = time.monotonic()
    with open(STAYS_FILE, encoding="utf-8") as f:
        features = json.load(f)["features"]

    index = CoverageIndex.from_csv(TOWERS_FILE)
    poland = PolandMask()
    nearest_place = NearestPlace(PLACES_FILE)
    seen = set()
    outside = 0
    output = []
    for feature in features:
        tags = feature["properties"]
        stay_type = tags.get("tourism")
        if stay_type not in STAY_TYPES or not feature.get("geometry"):
            continue
        stay_id = f"{OSM_TYPE_PREFIX.get(tags.get('@type'), 'x')}{tags.get('@id')}"
        if stay_id in seen:
            continue
        seen.add(stay_id)

        lon, lat = representative_point(feature["geometry"])
        if not poland.contains(lon, lat):
            outside += 1
            continue
        result = index.check(lat, lon)
        output.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "id": stay_id,
                "name": tags.get("name"),
                "type": stay_type,
                "city": first_tag(tags, "addr:city", "addr:place") or nearest_place.name(lon, lat),
                "website": first_tag(tags, "website", "contact:website", "url"),
                "phone": first_tag(tags, "phone", "contact:phone", "contact:mobile"),
                "has_coverage": result["has_coverage"],
                "operators": result["operators"],
                "distance_to_coverage_m": result["distance_to_coverage_m"],
                "direction": result["direction"],
                "note": result.get("note"),
            },
        })

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": output}, f, ensure_ascii=False, separators=(",", ":"))

    no_coverage = [s for s in output if not s["properties"]["has_coverage"] and not s["properties"]["note"]]
    no_data = sum(1 for s in output if s["properties"]["note"])
    print(f"stays_coverage: skipped {outside} stays outside Poland")
    print(f"stays_coverage: {len(output)} stays, {len(no_coverage)} without coverage, {no_data} without tower data")
    print("stays_coverage: by type:", dict(Counter(s["properties"]["type"] for s in output).most_common()))
    farthest = sorted(no_coverage, key=lambda s: s["properties"]["distance_to_coverage_m"], reverse=True)[:5]
    for stay in farthest:
        p = stay["properties"]
        print(f"  {p['distance_to_coverage_m'] / 1000:.1f} km {p['direction']:>2}  {p['type']:<14} {p['name']}")
    print(f"stays_coverage: wrote {OUTPUT_FILE.name} in {time.monotonic() - started:.1f}s")


if __name__ == "__main__":
    main()

"""Step 4: coverage for every stay (guest house, hut, camp site, ...).

Input:  stays.geojson (osmium export of tourism=* objects), towers_pl.csv,
        poland_border.geojson (stays outside Poland are skipped)
Output: stays_coverage.geojson with Point features only; properties:
        id, name, type, website, phone, has_coverage, operators,
        distance_to_coverage_m, direction, note
"""

import json
import os
import time
from collections import Counter
from pathlib import Path

import numpy as np

from coverage import CoverageIndex
from dead_zones import BBOX, CELL_SIZE_M, Grid, load_border_areas, rasterize_border

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
STAYS_FILE = DATA_DIR / "stays.geojson"
TOWERS_FILE = DATA_DIR / "towers_pl.csv"
OUTPUT_FILE = DATA_DIR / "stays_coverage.geojson"

STAY_TYPES = {
    "guest_house", "chalet", "alpine_hut", "wilderness_hut",
    "camp_site", "hostel", "hotel", "apartment",
}
OSM_TYPE_PREFIX = {"node": "n", "way": "w", "relation": "r"}


class PolandMask:
    """Point-in-Poland test on the dead zone grid, grown by one cell for coastal stays."""

    def __init__(self):
        self.grid = Grid(BBOX, CELL_SIZE_M)
        mask = rasterize_border(self.grid, load_border_areas(DATA_DIR / "poland_border.geojson"))
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


def iter_coordinates(coords):
    """Yield every [lon, lat] pair from nested GeoJSON coordinates."""
    if coords and isinstance(coords[0], (int, float)):
        yield coords
    else:
        for part in coords:
            yield from iter_coordinates(part)


def representative_point(geometry):
    """Point as is; building or area -> mean of its vertices."""
    if geometry["type"] == "Point":
        lon, lat = geometry["coordinates"][:2]
        return lon, lat
    # Unique vertices, so the closing point of a ring is not counted twice
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

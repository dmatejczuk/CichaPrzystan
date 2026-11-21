"""Point coverage check based on cell transmitters (towers_pl.csv).

Each transmitter is a circle with its range. A point is covered when it lies inside any
circle within SEARCH_RADIUS_M; otherwise the distance to coverage is the smallest
(distance - range) over those transmitters.

The server implementation (server/src/coverage.js) must stay consistent with this module.
"""

import math

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

EARTH_RADIUS_M = 6_371_000
SEARCH_RADIUS_M = 60_000
DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
NO_TOWERS_NOTE = "no towers within 60 km"


def to_xyz(lon, lat):
    """Convert lon/lat in degrees to Cartesian coordinates on the unit sphere."""
    lon = np.radians(lon)
    lat = np.radians(lat)
    cos_lat = np.cos(lat)
    return np.stack([cos_lat * np.cos(lon), cos_lat * np.sin(lon), np.sin(lat)], axis=-1)


def haversine_m(lon1, lat1, lon2, lat2):
    lon1, lat1, lon2, lat2 = map(np.radians, (lon1, lat1, lon2, lat2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(np.minimum(a, 1.0)))


def bearing_deg(lon1, lat1, lon2, lat2):
    """Initial bearing in degrees, clockwise from north."""
    lon1, lat1, lon2, lat2 = map(math.radians, (lon1, lat1, lon2, lat2))
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def direction_code(bearing):
    return DIRECTIONS[int((bearing + 22.5) // 45) % 8]


def chord_for_distance(distance_m):
    return 2 * math.sin(distance_m / (2 * EARTH_RADIUS_M))


class CoverageIndex:
    def __init__(self, towers):
        # Radio types of one site share a position; only the widest range matters.
        towers = towers.groupby(["operator", "lon", "lat"], sort=False, as_index=False)["range"].max()
        self.operator = towers["operator"].to_numpy()
        self.lon = towers["lon"].to_numpy(dtype=float)
        self.lat = towers["lat"].to_numpy(dtype=float)
        self.range = towers["range"].to_numpy(dtype=float)
        self._xyz = to_xyz(self.lon, self.lat)
        self.max_range = float(self.range.max()) if len(self.range) else 0.0
        self._trees = {}

    @classmethod
    def from_csv(cls, path):
        return cls(pd.read_csv(path, usecols=["operator", "lon", "lat", "range"]))

    def operators(self):
        return sorted(set(self.operator))

    def _tree_for(self, operator):
        if operator not in self._trees:
            if operator is None:
                ids = np.arange(len(self.operator))
            else:
                ids = np.flatnonzero(self.operator == operator)
            self._trees[operator] = (ids, cKDTree(self._xyz[ids]) if len(ids) else None)
        return self._trees[operator]

    def check(self, lat, lon, operator=None):
        if operator is not None and operator not in set(self.operator):
            raise ValueError(f"unknown operator: {operator}")

        ids, tree = self._tree_for(operator)
        if tree is None:
            return self._no_towers()

        point = to_xyz(lon, lat)
        nearest_chord, nearest = tree.query(point, distance_upper_bound=chord_for_distance(SEARCH_RADIUS_M) * 1.0001)
        if not np.isfinite(nearest_chord):
            return self._no_towers()
        cell = ids[nearest]
        nearest_margin = haversine_m(lon, lat, self.lon[cell], self.lat[cell]) - self.range[cell]

        # Only transmitters with distance - range <= max(nearest_margin, 0) can cover the
        # point or be closer to coverage, and all of them lie within this radius.
        radius = min(max(nearest_margin, 0) + self.max_range, SEARCH_RADIUS_M)
        # Query slightly beyond the radius; the exact limit is enforced with haversine below.
        cells = ids[np.asarray(tree.query_ball_point(point, chord_for_distance(radius) * 1.0001), dtype=int)]
        cells.sort()

        distance = haversine_m(lon, lat, self.lon[cells], self.lat[cells])
        within = distance <= SEARCH_RADIUS_M
        cells, distance = cells[within], distance[within]
        if len(cells) == 0:
            return self._no_towers()

        margin = distance - self.range[cells]
        covered = margin <= 0
        if covered.any():
            return {
                "has_coverage": True,
                "operators": sorted(set(self.operator[cells[covered]])),
                "distance_to_coverage_m": 0,
                "direction": None,
                "bearing": None,
                "nearest_operator": None,
            }

        best = int(np.argmin(margin))
        cell = cells[best]
        bearing = bearing_deg(lon, lat, self.lon[cell], self.lat[cell])
        return {
            "has_coverage": False,
            "operators": [],
            "distance_to_coverage_m": int(round(margin[best])),
            "direction": direction_code(bearing),
            "bearing": int(round(bearing)) % 360,
            "nearest_operator": str(self.operator[cell]),
        }

    @staticmethod
    def _no_towers():
        return {
            "has_coverage": False,
            "operators": [],
            "distance_to_coverage_m": None,
            "direction": None,
            "bearing": None,
            "nearest_operator": None,
            "note": NO_TOWERS_NOTE,
        }


if __name__ == "__main__":
    import json
    import os
    import sys
    from pathlib import Path

    data_dir = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
    index = CoverageIndex.from_csv(data_dir / "towers_pl.csv")
    args = sys.argv[1:]
    if len(args) < 2:
        raise SystemExit("usage: python coverage.py LAT LON [OPERATOR]")
    print(json.dumps(index.check(float(args[0]), float(args[1]), args[2] if len(args) > 2 else None)))

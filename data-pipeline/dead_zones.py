"""Generate the dead zone overlay for Poland (dead_zones.png, dead_zones.json).

Coverage is computed by circle stamping on a ~250 m grid. Rows are evenly spaced in
Web Mercator, so the image aligns with Leaflet's ImageOverlay without reprojection.
"""

import json
import math
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree

from coverage import EARTH_RADIUS_M, to_xyz

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
TOWERS_FILE = DATA_DIR / "towers_pl.csv"
BORDER_FILE = DATA_DIR / "poland_border.geojson"
OUTPUT_PNG = DATA_DIR / "dead_zones.png"
OUTPUT_JSON = DATA_DIR / "dead_zones.json"

BBOX = (14.07, 48.99, 24.15, 54.84)  # min_lon, min_lat, max_lon, max_lat
CELL_SIZE_M = 250
MAST_ROUNDING = 4  # decimals; cells at the same rounded position form one mast
NEAREST_MASTS = 32
MAX_COLOR_DISTANCE_M = 3000
QUERY_CHUNK = 1_000_000
TOP_SPOTS = 10
TOP_SPOTS_MIN_SEPARATION_M = 10_000

LIGHT_PURPLE = np.array([196, 160, 235], dtype=np.float32)
DARK_PURPLE = np.array([64, 0, 110], dtype=np.float32)
MIN_ALPHA, MAX_ALPHA = 110, 210


def mercator_y(lat):
    return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


def inverse_mercator_y(y):
    return np.degrees(2 * np.arctan(np.exp(y)) - np.pi / 2)


class Grid:
    def __init__(self, bbox, cell_size_m):
        min_lon, min_lat, max_lon, max_lat = bbox
        mid_lat = math.radians((min_lat + max_lat) / 2)
        # Equal step in Mercator x and y gives square pixels.
        self.step = cell_size_m / (EARTH_RADIUS_M * math.cos(mid_lat))
        self.west = min_lon
        self.y_top = float(mercator_y(max_lat))
        self.width = math.ceil(math.radians(max_lon - min_lon) / self.step)
        self.height = math.ceil((self.y_top - float(mercator_y(min_lat))) / self.step)
        self.east = self.west + math.degrees(self.width * self.step)
        self.north = max_lat
        self.south = float(inverse_mercator_y(self.y_top - self.height * self.step))
        self.lon_centers = self.west + np.degrees((np.arange(self.width) + 0.5) * self.step)
        self.lat_centers = inverse_mercator_y(self.y_top - (np.arange(self.height) + 0.5) * self.step)

    def col(self, lon):
        return np.radians(np.asarray(lon) - self.west) / self.step

    def row(self, lat):
        return (self.y_top - mercator_y(np.asarray(lat))) / self.step


def load_masts():
    towers = pd.read_csv(TOWERS_FILE, usecols=["lon", "lat", "range"])
    towers["lon"] = towers["lon"].round(MAST_ROUNDING)
    towers["lat"] = towers["lat"].round(MAST_ROUNDING)
    return towers.groupby(["lon", "lat"], as_index=False)["range"].max()


def stamp_coverage(grid, masts):
    covered = np.zeros((grid.height, grid.width), dtype=bool)
    lat_rad = np.radians(grid.lat_centers)
    lon_rad = np.radians(grid.lon_centers)

    for lon, lat, radius in masts[["lon", "lat", "range"]].itertuples(index=False):
        dlat = math.degrees(radius / EARTH_RADIUS_M)
        dlon = dlat / math.cos(math.radians(lat))
        r0 = max(int(grid.row(lat + dlat)), 0)
        r1 = min(int(grid.row(lat - dlat)) + 2, grid.height)
        c0 = max(int(grid.col(lon - dlon)), 0)
        c1 = min(int(grid.col(lon + dlon)) + 2, grid.width)
        if r0 >= r1 or c0 >= c1:
            continue
        # Local equirectangular approximation; the error is negligible for ranges up to 15 km.
        dy = (lat_rad[r0:r1] - math.radians(lat)) * EARTH_RADIUS_M
        dx = (lon_rad[c0:c1] - math.radians(lon)) * EARTH_RADIUS_M * math.cos(math.radians(lat))
        inside = dy[:, None] ** 2 + dx[None, :] ** 2 <= radius ** 2
        covered[r0:r1, c0:c1] |= inside
    return covered


def load_border_areas(path=BORDER_FILE):
    """Load land polygons from poland_border.geojson.

    The file contains voivodeships rather than the country relation, because the latter
    also includes territorial waters.
    """
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    areas = []
    for feature in features:
        geometry = feature["geometry"]
        if geometry["type"] == "Polygon":
            areas.append([geometry["coordinates"]])
        elif geometry["type"] == "MultiPolygon":
            areas.append(geometry["coordinates"])
    if not areas:
        raise SystemExit(f"no polygons in {path}")
    return areas


def rasterize_border(grid, areas):
    def to_pixels(ring):
        ring = np.asarray(ring)
        cols = grid.col(ring[:, 0]) - 0.5
        rows = grid.row(ring[:, 1]) - 0.5
        return list(zip(cols.tolist(), rows.tolist()))

    result = np.zeros((grid.height, grid.width), dtype=bool)
    # Rasterize each area separately so that holes cannot remove neighbouring areas.
    for polygons in areas:
        mask = Image.new("L", (grid.width, grid.height), 0)
        draw = ImageDraw.Draw(mask)
        for polygon in polygons:
            draw.polygon(to_pixels(polygon[0]), fill=1)
        for polygon in polygons:
            for hole in polygon[1:]:
                draw.polygon(to_pixels(hole), fill=0)
        result |= np.asarray(mask, dtype=bool)
    return result


def distance_to_coverage(lon, lat, masts):
    tree = cKDTree(to_xyz(masts["lon"].to_numpy(), masts["lat"].to_numpy()))
    ranges = masts["range"].to_numpy(dtype=np.float64)
    k = min(NEAREST_MASTS, len(masts))
    result = np.empty(len(lon), dtype=np.float32)
    for start in range(0, len(lon), QUERY_CHUNK):
        end = start + QUERY_CHUNK
        chord, idx = tree.query(to_xyz(lon[start:end], lat[start:end]), k=k, workers=-1)
        chord, idx = chord.reshape(len(chord), -1), idx.reshape(len(idx), -1)
        distance = 2 * EARTH_RADIUS_M * np.arcsin(np.minimum(chord / 2, 1.0))
        result[start:end] = np.maximum((distance - ranges[idx]).min(axis=1), 0)
    return result


def render_png(grid, dead_rows, dead_cols, distance):
    rgba = np.zeros((grid.height, grid.width, 4), dtype=np.uint8)
    t = np.clip(distance / MAX_COLOR_DISTANCE_M, 0, 1)[:, None]
    rgba[dead_rows, dead_cols, :3] = (LIGHT_PURPLE + (DARK_PURPLE - LIGHT_PURPLE) * t).round().astype(np.uint8)
    rgba[dead_rows, dead_cols, 3] = (MIN_ALPHA + (MAX_ALPHA - MIN_ALPHA) * t[:, 0]).round().astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(OUTPUT_PNG, optimize=False, compress_level=6)


def farthest_spots(lon, lat, distance):
    order = np.argsort(distance)[::-1]
    spots = []
    for i in order:
        if len(spots) == TOP_SPOTS or distance[i] <= 0:
            break
        too_close = any(
            math.hypot((lon[i] - s["lon"]) * math.cos(math.radians(lat[i])), lat[i] - s["lat"])
            * math.radians(1) * EARTH_RADIUS_M < TOP_SPOTS_MIN_SEPARATION_M
            for s in spots
        )
        if not too_close:
            spots.append({
                "lat": round(float(lat[i]), 5),
                "lon": round(float(lon[i]), 5),
                "distance_to_coverage_m": int(round(float(distance[i]))),
            })
    return spots


def main():
    started = time.monotonic()

    def log(message):
        print(f"dead_zones: [{time.monotonic() - started:5.1f}s] {message}", flush=True)

    grid = Grid(BBOX, CELL_SIZE_M)
    log(f"grid {grid.width} x {grid.height} = {grid.width * grid.height:,} cells")

    masts = load_masts()
    covered = stamp_coverage(grid, masts)
    log(f"stamped {len(masts):,} masts")

    inside = rasterize_border(grid, load_border_areas())
    dead = inside & ~covered
    dead_rows, dead_cols = np.nonzero(dead)
    log(f"border rasterized; {inside.sum():,} cells in Poland, {len(dead_rows):,} without coverage")

    lon = grid.lon_centers[dead_cols]
    lat = grid.lat_centers[dead_rows]
    distance = distance_to_coverage(lon, lat, masts)
    log("distances to coverage computed")

    render_png(grid, dead_rows, dead_cols, distance)
    spots = farthest_spots(lon, lat, distance)

    summary = {
        "image": OUTPUT_PNG.name,
        # Leaflet LatLngBounds: [[south, west], [north, east]]
        "bounds": [[round(grid.south, 6), round(grid.west, 6)], [round(grid.north, 6), round(grid.east, 6)]],
        "width": grid.width,
        "height": grid.height,
        "cell_size_m": CELL_SIZE_M,
        "max_color_distance_m": MAX_COLOR_DISTANCE_M,
        "cells_in_poland": int(inside.sum()),
        "cells_without_coverage": int(len(dead_rows)),
        "share_without_coverage": round(len(dead_rows) / max(int(inside.sum()), 1), 4),
        "farthest_from_coverage": spots,
    }
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    log(f"wrote {OUTPUT_PNG.name}, {OUTPUT_JSON.name}")

    print(f"dead_zones: {summary['share_without_coverage']:.1%} of Poland without coverage")
    print("dead_zones: places farthest from coverage:")
    for rank, spot in enumerate(spots, 1):
        print(f"  {rank:2}. {spot['lat']:.5f}, {spot['lon']:.5f}  {spot['distance_to_coverage_m'] / 1000:.1f} km")


if __name__ == "__main__":
    main()

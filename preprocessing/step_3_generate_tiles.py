#!/usr/bin/env python3
"""
Step 3: Generate map tiles from GeoJSON files.

This script processes GeoJSON files into tile format with parallel processing
and detailed progress reporting.
"""

import argparse
import copy
import decimal
import json
import math
import os
import random
import shutil
import sys
import tempfile
import time
from collections import defaultdict
from multiprocessing import Pool
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    print("Error: tqdm is required for progress bars")
    print("Install with: pip install tqdm")
    sys.exit(1)

try:
    import ijson
except ImportError:
    print("Error: ijson is required for streaming JSON parsing")
    print("Install with: pip install ijson")
    sys.exit(1)

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required for config parsing")
    print("Install with: pip install PyYAML")
    sys.exit(1)


def decimal_default(o):
    """Handle decimal.Decimal values from ijson (more efficient than JSONEncoder subclass)."""
    if isinstance(o, decimal.Decimal):
        return float(o)
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


# Initial map center (Lombardsbrücke, Hamburg)
HAMBURG_CENTER_LAT = 53.5567
HAMBURG_CENTER_LON = 10.0061

# Railway type classifications (avoid recreating on every feature)
MAJOR_RAIL = frozenset(["rail"])
MEDIUM_RAIL = frozenset(["light_rail", "subway"])
MINOR_RAIL = frozenset(["tram", "monorail", "narrow_gauge", "preserved"])
ALL_RAIL_TYPES = frozenset(
    [
        "rail",
        "light_rail",
        "subway",
        "tram",
        "monorail",
        "narrow_gauge",
        "preserved",
        "construction",
        "planned",
        "proposed",
    ]
)

# Highway/road type classifications
MAJOR_HIGHWAYS = frozenset(
    ["motorway", "trunk", "primary"]
)  # Includes Bundesstraßen (B-roads)
SECONDARY_HIGHWAYS = frozenset(["secondary"])
TERTIARY_RESIDENTIAL_HIGHWAYS = frozenset(["tertiary", "residential", "unclassified"])

# Landuse type classifications
PARK_LANDUSE = frozenset(["grass", "meadow", "village_green", "recreation_ground"])
FARM_LANDUSE = frozenset(
    [
        "farmland",
        "orchard",
        "vineyard",
        "farmyard",
        "greenhouse_horticulture",
        "plant_nursery",
    ]
)

# Waterway type classifications
MAJOR_WATERWAYS = frozenset(["river", "canal"])

# ============================================================================
# TILESET CONFIGURATION
# ============================================================================


# Load tileset configuration from YAML
def load_tileset_config():
    """Load tileset configuration from tileset_config.yaml."""
    config_path = os.path.join(os.path.dirname(__file__), "..", "tileset_config.yaml")
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
    return config


# Global config (loaded at module level)
TILESET_CONFIG = load_tileset_config()
TILESETS = TILESET_CONFIG["tilesets"]
SIMPLIFICATION_SETTINGS = TILESET_CONFIG["simplification_settings"]

# Build tileset ID list
TILESET_IDS = [ts["id"] for ts in TILESETS]
TILESET_TILE_SIZES = {ts["id"]: ts["tile_size_meters"] for ts in TILESETS}

# Build coastline epsilon lookup per tileset (for simplifying ocean polygons)
TILESET_COASTLINE_EPSILON = {}
for _ts in TILESETS:
    for _fd in _ts["features"]:
        if _fd.get("name") == "coastline":
            _eps = _fd.get("simplification", {}).get("epsilon_m")
            if _eps:
                TILESET_COASTLINE_EPSILON[_ts["id"]] = _eps
            break


# ============================================================================
# TILESET-BASED PROCESSING FUNCTIONS
# ============================================================================


def feature_matches_tileset(feature, tileset_config, props, geom_type):
    """
    Check if a feature should be included in this tileset.

    Args:
        feature: GeoJSON feature
        tileset_config: Tileset dict from config
        props: Feature properties
        geom_type: Geometry type

    Returns:
        Matching feature config dict or None
    """
    for feature_def in tileset_config["features"]:
        osm_match = feature_def["osm_match"]

        # Check geometry type
        if geom_type not in osm_match["geometry"]:
            continue

        # Check tags
        tags = osm_match.get("tags", {})
        if not tags:
            continue

        # match_all: true → AND logic (all tags must match, e.g. boundaries)
        # default → OR logic (any tag match is sufficient)
        match_all = osm_match.get("match_all", False)
        if match_all:
            matches = True
            for tag_key, tag_values in tags.items():
                prop_value = props.get(tag_key)
                if not prop_value or (
                    tag_values != ["*"] and prop_value not in tag_values
                ):
                    matches = False
                    break
        else:
            matches = False
            for tag_key, tag_values in tags.items():
                prop_value = props.get(tag_key)
                if prop_value and (tag_values == ["*"] or prop_value in tag_values):
                    matches = True
                    break

        if not matches:
            continue

        # Check excluded tags
        tags_exclude = osm_match.get("tags_exclude", {})
        excluded = False
        for tag_key, tag_values in tags_exclude.items():
            prop_value = props.get(tag_key)
            if prop_value and prop_value in tag_values:
                excluded = True
                break

        if excluded:
            continue

        # Check area constraints (for polygons)
        if "min_area_km2" in osm_match or "max_area_km2" in osm_match:
            if "_area_km2" not in feature:
                # Calculate area
                bounds = get_feature_bounds(feature)
                if bounds:
                    width_deg = bounds["maxLon"] - bounds["minLon"]
                    height_deg = bounds["maxLat"] - bounds["minLat"]
                    # Approximate area in km² (1 deg ≈ 111km at equator)
                    area_km2 = (width_deg * 111) * (height_deg * 111)
                    feature["_area_km2"] = area_km2
                else:
                    continue

            area = feature["_area_km2"]
            if "min_area_km2" in osm_match and area < osm_match["min_area_km2"]:
                continue
            if "max_area_km2" in osm_match and area > osm_match["max_area_km2"]:
                continue

        # Check population constraints (for places)
        if "population_min" in osm_match or "population_max" in osm_match:
            pop = props.get("population", 0)
            try:
                pop = int(pop)
            except:
                pop = 0

            if "population_min" in osm_match and pop < osm_match["population_min"]:
                continue
            if "population_max" in osm_match and pop > osm_match["population_max"]:
                continue

        # Check requires_name flag
        if osm_match.get("requires_name", False):
            if not props.get("name"):
                continue

        # Feature matches this definition
        return feature_def

    return None


def simplify_feature_for_tileset(feature, tileset_id, feature_config):
    """
    Simplify feature geometry for specific tileset using config.

    Args:
        feature: GeoJSON feature
        tileset_id: Tileset ID (e.g., "t3")
        feature_config: Feature definition from config

    Returns:
        Modified feature with simplified geometry
    """
    from shapely.geometry import mapping, shape

    simplif = feature_config.get("simplification", {})

    # Check if simplification disabled for this feature in this tileset
    if simplif.get("disabled", False):
        return feature

    epsilon_m = simplif.get("epsilon_m")
    if not epsilon_m:
        return feature

    geom = feature.get("geometry")
    if not geom or geom["type"] == "Point":
        return feature

    try:
        shapely_geom = shape(geom)

        # Convert epsilon from meters to degrees (approximate)
        epsilon_deg = epsilon_m / 111000

        # Simplify with topology preservation
        simplified = shapely_geom.simplify(
            epsilon_deg, preserve_topology=SIMPLIFICATION_SETTINGS["preserve_topology"]
        )

        # Apply grid snapping if enabled
        if SIMPLIFICATION_SETTINGS.get("snap_to_grid", False):
            grid_divisor = SIMPLIFICATION_SETTINGS.get("snap_grid_divisor", 2)
            grid_size_m = epsilon_m / grid_divisor
            simplified = snap_to_grid(simplified, grid_size_m)

        feature["geometry"] = mapping(simplified)

    except Exception as e:
        # If simplification fails, keep original
        pass

    return feature


def clip_feature_to_tile(feature, tile_x, tile_y, tile_size_m, buffer_pct=0.02):
    """
    Clip feature geometry to tile bounds with a small buffer.

    Args:
        feature: GeoJSON feature (will be modified in place)
        tile_x: Tile X index
        tile_y: Tile Y index
        tile_size_m: Tile size in meters
        buffer_pct: Buffer as fraction of tile size (0.02 = 2%)

    Returns:
        Clipped feature, or None if geometry is empty after clipping
    """
    from shapely.geometry import box, mapping, shape

    geom = feature.get("geometry")
    if not geom or geom["type"] == "Point":
        return feature  # Points don't need clipping

    # Only clip polygon types — clipping LineStrings causes gaps at tile boundaries
    # where road/rail segments don't reconnect cleanly
    if geom["type"] in ("LineString", "MultiLineString"):
        return feature

    # Don't clip small structure polygons — they rarely span tiles,
    # and clipping creates artificial edges visible at tile boundaries
    props = feature.get("properties", {})
    if (
        props.get("building")
        or props.get("railway") == "platform"
        or props.get("public_transport") == "platform"
    ):
        return feature

    # Compute tile bounds in degrees
    lat_avg = tile_y * tile_size_m / 111320 + (tile_size_m / 111320 / 2)
    meters_per_deg_lon = 111320 * math.cos(math.radians(lat_avg))
    meters_per_deg_lat = 111320

    tile_width_deg = tile_size_m / meters_per_deg_lon
    tile_height_deg = tile_size_m / meters_per_deg_lat

    min_lon = tile_x * tile_width_deg
    min_lat = tile_y * tile_height_deg
    max_lon = min_lon + tile_width_deg
    max_lat = min_lat + tile_height_deg

    # Add buffer to avoid edge artifacts
    buf_lon = tile_width_deg * buffer_pct
    buf_lat = tile_height_deg * buffer_pct
    min_lon -= buf_lon
    min_lat -= buf_lat
    max_lon += buf_lon
    max_lat += buf_lat

    try:
        shapely_geom = shape(geom)

        # Skip clipping if feature is fully within the buffered tile
        gmin_lon, gmin_lat, gmax_lon, gmax_lat = shapely_geom.bounds
        if (
            gmin_lon >= min_lon
            and gmax_lon <= max_lon
            and gmin_lat >= min_lat
            and gmax_lat <= max_lat
        ):
            return feature

        tile_box = box(min_lon, min_lat, max_lon, max_lat)
        clipped = shapely_geom.intersection(tile_box)

        if clipped.is_empty:
            return None

        feature["geometry"] = mapping(clipped)
        return feature

    except Exception:
        # If clipping fails, return original
        return feature


def snap_to_grid(geom, grid_size_m):
    """
    Snap geometry coordinates to grid to prevent gaps between adjacent features.

    Args:
        geom: Shapely geometry
        grid_size_m: Grid size in meters

    Returns:
        Snapped Shapely geometry
    """
    from shapely.geometry import (
        LineString,
        MultiLineString,
        MultiPolygon,
        Point,
        Polygon,
    )

    # Convert grid size from meters to degrees (approximate)
    grid_deg = grid_size_m / 111000

    def snap_coords(coords):
        """Round coordinates to grid."""
        return [
            (round(x / grid_deg) * grid_deg, round(y / grid_deg) * grid_deg)
            for x, y in coords
        ]

    geom_type = geom.geom_type

    if geom_type == "Point":
        x, y = geom.coords[0]
        return Point(round(x / grid_deg) * grid_deg, round(y / grid_deg) * grid_deg)

    elif geom_type == "LineString":
        return LineString(snap_coords(geom.coords))

    elif geom_type == "Polygon":
        exterior = snap_coords(geom.exterior.coords)
        interiors = [snap_coords(interior.coords) for interior in geom.interiors]
        return Polygon(exterior, interiors)

    elif geom_type == "MultiLineString":
        return MultiLineString([snap_coords(line.coords) for line in geom.geoms])

    elif geom_type == "MultiPolygon":
        polys = []
        for poly in geom.geoms:
            exterior = snap_coords(poly.exterior.coords)
            interiors = [snap_coords(interior.coords) for interior in poly.interiors]
            polys.append(Polygon(exterior, interiors))
        return MultiPolygon(polys)

    return geom


def get_tiles_for_feature_in_tileset(feature, tileset_id, tile_size_m):
    """
    Get tile coordinates for a feature in a specific tileset.

    Uses custom tile size instead of Web Mercator zoom levels.

    Args:
        feature: GeoJSON feature
        tileset_id: Tileset ID
        tile_size_m: Tile size in meters

    Returns:
        List of (tileset_id, x, y) tuples
    """
    bounds = get_feature_bounds(feature)
    if not bounds:
        return []

    # Convert tile size to degrees (approximate at latitude 53°)
    lat_avg = (bounds["minLat"] + bounds["maxLat"]) / 2
    meters_per_deg_lon = 111320 * math.cos(math.radians(lat_avg))
    meters_per_deg_lat = 111320

    tile_width_deg = tile_size_m / meters_per_deg_lon
    tile_height_deg = tile_size_m / meters_per_deg_lat

    # Calculate tile indices
    # Use 0,0 as origin at lat=0, lon=0
    min_x = int(math.floor(bounds["minLon"] / tile_width_deg))
    max_x = int(math.floor(bounds["maxLon"] / tile_width_deg))
    min_y = int(math.floor(bounds["minLat"] / tile_height_deg))
    max_y = int(math.floor(bounds["maxLat"] / tile_height_deg))

    tiles = []
    for x in range(min_x, max_x + 1):
        for y in range(min_y, max_y + 1):
            tiles.append((tileset_id, x, y))

    return tiles


def get_feature_bounds(feature):
    """Get bounding box of a feature"""
    coords = feature["geometry"]["coordinates"]
    geom_type = feature["geometry"]["type"]

    lons, lats = [], []

    def process_coord(coord):
        lons.append(float(coord[0]))
        lats.append(float(coord[1]))

    if geom_type == "Point":
        process_coord(coords)
    elif geom_type == "LineString":
        for coord in coords:
            process_coord(coord)
    elif geom_type == "Polygon":
        for coord in coords[0]:
            process_coord(coord)
    elif geom_type == "MultiLineString":
        for line in coords:
            for coord in line:
                process_coord(coord)
    elif geom_type == "MultiPolygon":
        for polygon in coords:
            for coord in polygon[0]:
                process_coord(coord)

    if not lons:
        return None

    return {
        "minLon": min(lons),
        "maxLon": max(lons),
        "minLat": min(lats),
        "maxLat": max(lats),
    }


def classify_feature_importance(props, geom_type):
    """
    Classify feature by importance for progressive loading.
    Returns tuple: (min_zoom, importance_score)

    min_zoom: earliest zoom level to show this feature
    importance_score: for sorting within zoom level
    """

    # Cache commonly accessed properties
    highway = props.get("highway")
    railway = props.get("railway")
    waterway = props.get("waterway")
    natural = props.get("natural")
    landuse = props.get("landuse")
    building = props.get("building")
    leisure = props.get("leisure")

    # Remap construction roads to their target type for importance classification
    effective_highway = highway
    if effective_highway == "construction":
        construction = props.get("construction")
        if construction:
            effective_highway = construction

    # Coastlines (always visible for debugging/visualization)
    if natural == "coastline":
        return (0, 110)  # Z0-Z5, highest importance

    # Major water bodies (always visible)
    if natural == "water" or props.get("water") or waterway == "riverbank":
        return (0, 100)  # Z0-Z5, very important

    # Forests (always visible)
    if landuse == "forest" or natural == "wood":
        return (0, 90)  # Z0-Z5, very important

    # Major highways (motorway, trunk, primary - always visible)
    if effective_highway in MAJOR_HIGHWAYS:
        return (0, 80)  # Z0-Z5, very important

    # Railways (always visible)
    if railway and geom_type != "Point":
        if railway in ALL_RAIL_TYPES:
            return (0, 70)  # Z0-Z5, important

    # Railway stations and platforms
    if railway in ("station", "halt") or props.get("public_transport") == "station":
        return (6, 55)  # Visible at medium zoom
    if railway == "platform" or props.get("public_transport") == "platform":
        return (11, 35)  # Visible at closer zoom

    # Major rivers
    if waterway in MAJOR_WATERWAYS:
        return (6, 60)  # Z6-Z10

    # Secondary roads
    if effective_highway in SECONDARY_HIGHWAYS:
        return (6, 50)  # Z6-Z10

    # Parks and green spaces
    if leisure == "park" or landuse in PARK_LANDUSE or landuse in FARM_LANDUSE:
        return (6, 40)  # Z6-Z10

    # Tertiary and residential roads
    if effective_highway in TERTIARY_RESIDENTIAL_HIGHWAYS:
        return (11, 30)  # Z11-Z14

    # Aeroways
    aeroway = props.get("aeroway")
    if aeroway == "runway":
        return (0, 75)  # Always visible, high importance
    if aeroway == "taxiway":
        return (11, 35)  # Z11+
    if aeroway in ("apron", "helipad"):
        return (11, 30)  # Z11+

    # Buildings
    if building:
        return (11, 20)  # Z11-Z14

    # Small roads and paths
    if effective_highway:
        return (15, 10)  # Z15+

    # Place names (cities, towns, villages) - high importance
    if geom_type == "Point" and props.get("place") and props.get("name"):
        place_type = props.get("place")
        if place_type == "city":
            return (0, 95)  # Z0-Z5, very important (just below water/forests)
        elif place_type == "town":
            return (0, 85)  # Z0-Z5, very important
        elif place_type == "village":
            return (6, 55)  # Z6-Z10, important
        elif place_type in ["suburb", "borough", "quarter"]:
            return (11, 25)  # Z11-Z14
        else:
            return (15, 8)  # Z15+ for hamlets, localities

    # Named POIs
    if geom_type == "Point" and props.get("name"):
        if props.get("amenity") or props.get("shop") or props.get("tourism"):
            return (15, 5)  # Z15+

    # Skip everything else
    return (99, 0)  # Never show


def get_work_dir(pbf_path):
    """Get the working directory for a PBF file's intermediate artifacts.

    For 'data/hamburg-latest.osm.pbf', returns 'data/hamburg-latest/'.
    """
    folder_name = pbf_path.name.replace(".osm.pbf", "")
    return pbf_path.parent / folder_name


def get_pbf_bounds(pbf_file):
    """Extract bounding box from PBF file header using osmium.

    Returns dict with minLon, maxLon, minLat, maxLat or None if extraction fails.
    """
    import subprocess

    try:
        result = subprocess.run(
            ["osmium", "fileinfo", str(pbf_file)],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode == 0:
            # Look for line like: "    (7.967833,53.391826,10.331955,54.062613)"
            for line in result.stdout.split("\n"):
                line = line.strip()
                if line.startswith("(") and line.endswith(")"):
                    # Parse (minLon,minLat,maxLon,maxLat)
                    coords = line.strip("()").split(",")
                    if len(coords) == 4:
                        return {
                            "minLon": float(coords[0]),
                            "maxLon": float(coords[2]),
                            "minLat": float(coords[1]),
                            "maxLat": float(coords[3]),
                        }
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        pass

    return None


def compute_tile_bounds(tile_x, tile_y, tile_size_m):
    """Compute tile geographic bounds in degrees.

    Returns (min_lon, min_lat, max_lon, max_lat).
    """
    lat_avg = tile_y * tile_size_m / 111320 + (tile_size_m / 111320 / 2)
    meters_per_deg_lon = 111320 * math.cos(math.radians(lat_avg))
    meters_per_deg_lat = 111320

    tile_width_deg = tile_size_m / meters_per_deg_lon
    tile_height_deg = tile_size_m / meters_per_deg_lat

    min_lon = tile_x * tile_width_deg
    min_lat = tile_y * tile_height_deg
    max_lon = min_lon + tile_width_deg
    max_lat = min_lat + tile_height_deg

    return (min_lon, min_lat, max_lon, max_lat)


def boundary_parameter(lon, lat, bounds):
    """Convert a point on the tile boundary to a clockwise parameter t in [0, 4).

    Traversal: East edge south [0,1), South edge west [1,2),
               West edge north [2,3), North edge east [3,4).
    bounds = (min_lon, min_lat, max_lon, max_lat)

    Points must be snapped to the boundary first (one coordinate matches exactly).
    """
    min_lon, min_lat, max_lon, max_lat = bounds
    w = max_lon - min_lon
    h = max_lat - min_lat

    # After snap_to_boundary, exactly one coordinate matches a boundary value.
    # Check each edge by exact equality (assigned by snap, not computed).
    if lon == max_lon:  # East edge, going south
        return 0.0 + (max_lat - lat) / h
    if lat == min_lat:  # South edge, going west
        return 1.0 + (max_lon - lon) / w
    if lon == min_lon:  # West edge, going north
        return 2.0 + (lat - min_lat) / h
    if lat == max_lat:  # North edge, going east
        return 3.0 + (lon - min_lon) / w

    # Fallback for floating-point near-misses: pick nearest edge
    dists = [
        (abs(lon - max_lon), 0.0 + (max_lat - lat) / h),
        (abs(lat - min_lat), 1.0 + (max_lon - lon) / w),
        (abs(lon - min_lon), 2.0 + (lat - min_lat) / h),
        (abs(lat - max_lat), 3.0 + (lon - min_lon) / w),
    ]
    dists.sort(key=lambda x: x[0])
    return dists[0][1]


def get_corners_between(t_from, t_to, bounds):
    """Get tile corner coordinates to traverse clockwise from t_from to t_to.

    Corners at t=0: NE, t=1: SE, t=2: SW, t=3: NW.
    """
    min_lon, min_lat, max_lon, max_lat = bounds
    corners = [
        (0, (max_lon, max_lat)),  # NE
        (1, (max_lon, min_lat)),  # SE
        (2, (min_lon, min_lat)),  # SW
        (3, (min_lon, max_lat)),  # NW
    ]

    result = []
    # If exit and entry are at the same boundary position, no corners needed
    if abs(t_to - t_from) < 1e-9:
        return []

    # Walk clockwise from t_from to t_to, collecting corners in between
    if t_to <= t_from:
        t_to += 4  # Wrap around

    for corner_t, corner_coord in corners:
        ct = corner_t
        if ct <= t_from:
            ct += 4
        if t_from < ct < t_to:
            result.append(corner_coord)

    return result


def is_clockwise(coords):
    """Check if a ring of coordinates is clockwise using the shoelace formula."""
    area = 0
    n = len(coords)
    for i in range(n):
        x1, y1 = coords[i]
        x2, y2 = coords[(i + 1) % n]
        area += (x2 - x1) * (y2 + y1)
    return area > 0


def build_water_polygons_for_tile(coastline_features, tile_x, tile_y, tile_size_m):
    """Convert coastline LineStrings into water polygons for a tile.

    OSM convention: coastline has water on the right side (land masses clockwise).
    Algorithm: merge coastline segments, clip to tile, pair each exit with the
    next entry clockwise around the tile boundary, trace polygon rings.

    Returns list of water polygon GeoJSON features.
    """
    from shapely.geometry import Point, Polygon, box, mapping, shape
    from shapely.ops import linemerge

    bounds = compute_tile_bounds(tile_x, tile_y, tile_size_m)
    min_lon, min_lat, max_lon, max_lat = bounds
    tile_box = box(min_lon, min_lat, max_lon, max_lat)

    # Collect all coastline geometries, deduplicating by coordinate tuple
    # (overlapping regions can contribute identical coastline LineStrings)
    seen_coords = set()
    lines = []
    for feat in coastline_features:
        geom = feat.get("geometry", {})
        try:
            shp = shape(geom)
            geoms = [shp] if shp.geom_type == "LineString" else (
                list(shp.geoms) if shp.geom_type == "MultiLineString" else []
            )
            for line in geoms:
                key = tuple(line.coords)
                if key not in seen_coords:
                    seen_coords.add(key)
                    lines.append(line)
        except Exception:
            continue

    if not lines:
        return []

    # Merge segments sharing endpoints
    merged = linemerge(lines)
    if merged.geom_type == "LineString":
        merged_lines = [merged]
    elif merged.geom_type == "MultiLineString":
        merged_lines = list(merged.geoms)
    else:
        return []

    # Clip to tile boundary
    clipped_segments = []
    closed_rings = []

    for line in merged_lines:
        try:
            clipped = line.intersection(tile_box)
        except Exception:
            continue

        if clipped.is_empty:
            continue

        if clipped.geom_type == "LineString":
            parts = [clipped]
        elif clipped.geom_type == "MultiLineString":
            parts = list(clipped.geoms)
        else:
            continue

        for part in parts:
            coords = list(part.coords)
            if len(coords) < 2:
                continue

            # Check if it's a closed ring (island fully inside tile)
            first, last = coords[0], coords[-1]
            dist_sq = (first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2
            if dist_sq < 1e-16 and len(coords) >= 4:
                closed_rings.append(coords)
            else:
                clipped_segments.append(coords)

    if not clipped_segments and not closed_rings:
        return []

    def snap_to_boundary(lon, lat):
        """Snap a point to the nearest tile edge (sets one coord exactly)."""
        dists = [
            (abs(lon - max_lon), (max_lon, lat)),  # east
            (abs(lat - min_lat), (lon, min_lat)),   # south
            (abs(lon - min_lon), (min_lon, lat)),   # west
            (abs(lat - max_lat), (lon, max_lat)),   # north
        ]
        dists.sort(key=lambda x: x[0])
        return dists[0][1]

    # Snap segment endpoints to boundary
    snapped_segments = []
    for coords in clipped_segments:
        entry = snap_to_boundary(coords[0][0], coords[0][1])
        exit_pt = snap_to_boundary(coords[-1][0], coords[-1][1])
        snapped = [entry] + coords[1:-1] + [exit_pt]
        snapped_segments.append(snapped)

    # Build water polygons by pairing exits to entries clockwise.
    # Water is on the right side of coastline direction.
    # From each exit, walking clockwise along the boundary to the next entry
    # traces the water side.
    water_polygons = []

    if snapped_segments:
        # Build sorted event list of all entries and exits by boundary parameter
        events = []  # (t, type_order, seg_index)  type_order: 0=exit, 1=entry
        for i, seg in enumerate(snapped_segments):
            entry_t = boundary_parameter(seg[0][0], seg[0][1], bounds)
            exit_t = boundary_parameter(seg[-1][0], seg[-1][1], bounds)
            events.append((entry_t, 1, i))  # entry
            events.append((exit_t, 0, i))   # exit

        # Sort by t; exits before entries at same t
        events.sort()

        # Precompute: for each exit, find the next entry clockwise
        exit_to_next_entry = {}
        for j, (t, etype, idx) in enumerate(events):
            if etype == 0:  # exit
                for k in range(1, len(events) + 1):
                    next_j = (j + k) % len(events)
                    if events[next_j][1] == 1:  # entry
                        exit_to_next_entry[idx] = events[next_j][2]
                        break

        # Trace polygon rings by following the exit→entry chain
        used = set()
        for start_idx in range(len(snapped_segments)):
            if start_idx in used:
                continue

            ring = []
            seg_idx = start_idx

            for _ in range(len(snapped_segments) + 1):  # safety limit
                if seg_idx in used and seg_idx != start_idx:
                    break
                used.add(seg_idx)
                seg = snapped_segments[seg_idx]

                # Add this segment's coastline coordinates (entry → exit)
                ring.extend(seg)

                # Find the next segment via exit→entry pairing
                next_idx = exit_to_next_entry.get(seg_idx)
                if next_idx is None:
                    break

                # Add tile boundary corners from this exit to next entry
                exit_t = boundary_parameter(seg[-1][0], seg[-1][1], bounds)
                next_seg = snapped_segments[next_idx]
                entry_t = boundary_parameter(
                    next_seg[0][0], next_seg[0][1], bounds
                )
                corners = get_corners_between(exit_t, entry_t, bounds)
                ring.extend(corners)

                if next_idx == start_idx:
                    break

                seg_idx = next_idx

            if len(ring) >= 4:
                if ring[0] != ring[-1]:
                    ring.append(ring[0])

                # Validate: water must be on the RIGHT side of the coastline
                # direction. Check if a test point to the right of the first
                # segment's midpoint falls inside the traced polygon.
                is_water_side = True
                first_seg = snapped_segments[start_idx]
                mid = len(first_seg) // 2
                p1 = first_seg[mid]
                p2 = first_seg[min(mid + 1, len(first_seg) - 1)]
                dx, dy = p2[0] - p1[0], p2[1] - p1[1]
                seg_len = (dx * dx + dy * dy) ** 0.5
                if seg_len > 0:
                    # Right-side normal in lon/lat: rotate (dx,dy) 90° CW → (dy,-dx)
                    nx, ny = dy / seg_len, -dx / seg_len
                    offset = min(max_lon - min_lon, max_lat - min_lat) * 0.001
                    test_point = Point(p1[0] + nx * offset, p1[1] + ny * offset)
                    try:
                        ring_poly = Polygon(ring)
                        tile_area = (max_lon - min_lon) * (max_lat - min_lat)
                        ring_frac = ring_poly.area / tile_area if tile_area > 0 else 0
                        # Only invert large polygons (>30% of tile). Small ones
                        # are coastal inlets/channels where the test point can
                        # land outside the sliver due to boundary proximity.
                        if (ring_poly.is_valid and ring_frac > 0.3
                                and not ring_poly.contains(test_point)):
                            # Traced ring is on the land side — invert it
                            inverted = tile_box.difference(ring_poly)
                            if not inverted.is_empty:
                                if inverted.geom_type == "Polygon":
                                    water_polygons.append(list(inverted.exterior.coords))
                                elif inverted.geom_type == "MultiPolygon":
                                    for geom in inverted.geoms:
                                        water_polygons.append(list(geom.exterior.coords))
                                is_water_side = False
                    except Exception:
                        pass

                if is_water_side:
                    water_polygons.append(ring)

    # Handle closed rings (islands fully inside tile)
    # Clockwise ring = land (island in OSM convention) → hole in water
    # Counter-clockwise ring = enclosed water body
    island_holes = []
    for ring in closed_rings:
        if is_clockwise(ring):
            island_holes.append(ring)
        else:
            water_polygons.append(ring)

    # If we have island holes but no water polygons, the tile is mostly ocean
    if island_holes and not water_polygons:
        tile_ring = [
            (min_lon, max_lat), (max_lon, max_lat),
            (max_lon, min_lat), (min_lon, min_lat),
            (min_lon, max_lat),
        ]
        water_polygons.append(tile_ring)

    # Build GeoJSON features
    result_features = []
    assigned_holes = set()  # track which island holes got assigned

    for poly_coords in water_polygons:
        try:
            # Only attach island holes that fall inside this polygon
            relevant_holes = []
            if island_holes:
                poly_shell = Polygon(poly_coords)
                for i, hole in enumerate(island_holes):
                    # Use representative_point of the hole polygon for a robust
                    # containment check (first vertex may be on tile boundary
                    # where contains() returns False)
                    try:
                        hole_poly = Polygon(hole)
                        rep_pt = hole_poly.representative_point()
                    except Exception:
                        rep_pt = Point(hole[0][0], hole[0][1])
                    if poly_shell.contains(rep_pt) or poly_shell.intersects(Polygon(hole)):
                        relevant_holes.append(hole)
                        assigned_holes.add(i)

            if relevant_holes:
                poly = Polygon(poly_coords, relevant_holes)
            else:
                poly = Polygon(poly_coords)

            if poly.is_empty or not poly.is_valid:
                poly = poly.buffer(0)
                if poly.is_empty:
                    continue

            # Clip to tile bounds
            poly = poly.intersection(tile_box)
            if poly.is_empty:
                continue

            geom = mapping(poly)

            def _make_ocean_feature(g):
                return {
                    "type": "Feature",
                    "geometry": g,
                    "properties": {"natural": "water", "water": "ocean"},
                    "_render": {
                        "layer": "ocean_water",
                        "color": [80, 130, 210, 255],
                        "fill": True,
                        "minLOD": 0,
                    },
                }

            if geom["type"] == "MultiPolygon":
                for sub_coords in geom["coordinates"]:
                    result_features.append(_make_ocean_feature({
                        "type": "Polygon", "coordinates": sub_coords,
                    }))
            else:
                result_features.append(_make_ocean_feature(geom))

        except Exception:
            continue

    # Handle orphan island holes not contained by any water polygon.
    # This happens when mainland coastline segments create water polygons that
    # don't reach a distant island (e.g. Neuwerk in t3_22_240).
    # Fill the tile with ocean and cut out the island.
    if island_holes:
        orphan_holes = [h for i, h in enumerate(island_holes) if i not in assigned_holes]
        if orphan_holes:
            tile_ring = [
                (min_lon, max_lat), (max_lon, max_lat),
                (max_lon, min_lat), (min_lon, min_lat),
                (min_lon, max_lat),
            ]
            try:
                ocean_poly = Polygon(tile_ring, orphan_holes)
                if not ocean_poly.is_valid:
                    ocean_poly = ocean_poly.buffer(0)
                if not ocean_poly.is_empty:
                    ocean_poly = ocean_poly.intersection(tile_box)
                    if not ocean_poly.is_empty:
                        geom = mapping(ocean_poly)

                        def _make_ocean_feature2(g):
                            return {
                                "type": "Feature",
                                "geometry": g,
                                "properties": {"natural": "water", "water": "ocean"},
                                "_render": {
                                    "layer": "ocean_water",
                                    "color": [80, 130, 210, 255],
                                    "fill": True,
                                    "minLOD": 0,
                                },
                            }

                        if geom["type"] == "MultiPolygon":
                            for sub_coords in geom["coordinates"]:
                                result_features.append(_make_ocean_feature2({
                                    "type": "Polygon", "coordinates": sub_coords,
                                }))
                        else:
                            result_features.append(_make_ocean_feature2(geom))
            except Exception:
                pass

    return result_features


def finalize_tile(tile_jsonl_path, tile_json_path):
    """Read a .jsonl tile, deduplicate, sort by importance, compute _meta, write final .json.

    Converts coastline LineStrings into water polygons during finalization.
    """
    # Another parallel process may have already finalized this tile (border tiles)
    if not tile_jsonl_path.exists():
        if tile_json_path.exists():
            return tile_json_path.stat().st_size
        return 0

    # Extract tile coordinates from path: .../tileset_id/x/y.jsonl
    tile_y = int(tile_jsonl_path.stem)
    tile_x = int(tile_jsonl_path.parent.name)
    tileset_id = tile_jsonl_path.parent.parent.name
    tile_size_m = TILESET_TILE_SIZES.get(tileset_id, 50000)

    # Read all lines
    with open(tile_jsonl_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Deduplicate and sort by importance (descending)
    seen = set()
    entries = []  # (importance, feature_json_str)
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Extract importance prefix: "importance\t{json}"
        tab_idx = line.index("\t")
        importance = int(line[:tab_idx])
        feature_json = line[tab_idx + 1 :]
        if feature_json not in seen:
            seen.add(feature_json)
            entries.append((importance, feature_json))

    # Merge with existing .json tile if it exists (multi-region border tiles)
    if tile_json_path.exists():
        try:
            with open(tile_json_path, "r", encoding="utf-8") as f:
                existing_tile = json.load(f)
                for feat in existing_tile.get("features", []):
                    feat_str = json.dumps(feat, separators=(",", ":"))
                    if feat_str not in seen:
                        seen.add(feat_str)
                        # Use importance 5 (medium) for existing features without importance
                        entries.append((5, feat_str))
        except:
            pass

    # Sort by importance descending
    entries.sort(key=lambda e: e[0], reverse=True)

    # Separate coastline features from other features
    has_coastline = False
    has_land_features = False
    coastline_features = []
    non_coastline_entries = []

    for importance, feat_str in entries:
        try:
            feat = json.loads(feat_str)
            props = feat.get("properties", {})
            if props.get("natural") == "coastline":
                has_coastline = True
                coastline_features.append(feat)
                # Keep coastline in output (don't skip) for debugging
            natural = props.get("natural", "")
            landuse = props.get("landuse", "")
            is_water_related = (
                natural in ("water", "coastline", "wetland")
                or props.get("water")
                or props.get("waterway")
                or landuse in ("basin", "reservoir")
                or props.get("seamark:type")
                or props.get("maritime") == "yes"
                or (props.get("boundary") == "maritime")
            )
            if not is_water_related and (
                props.get("highway")
                or props.get("building")
                or landuse
                or props.get("railway")
                or props.get("amenity")
                or props.get("shop")
                or natural
            ):
                has_land_features = True
        except:
            pass
        non_coastline_entries.append((importance, feat_str))

    # Convert coastline LineStrings to water polygons
    feature_strings = []
    if coastline_features:
        try:
            water_polys = build_water_polygons_for_tile(
                coastline_features, tile_x, tile_y, tile_size_m
            )
            # Simplify ocean polygons using the tileset's coastline epsilon
            epsilon_m = TILESET_COASTLINE_EPSILON.get(tileset_id)
            if epsilon_m:
                from shapely.geometry import shape as _shape, mapping as _mapping
                epsilon_deg = epsilon_m / 111000
                for water_feat in water_polys:
                    try:
                        sg = _shape(water_feat["geometry"])
                        sg = sg.simplify(epsilon_deg, preserve_topology=True)
                        water_feat["geometry"] = _mapping(sg)
                    except Exception:
                        pass
            for water_feat in water_polys:
                feat_str = json.dumps(
                    water_feat, separators=(",", ":"), default=decimal_default
                )
                feature_strings.append(feat_str)
            # If coastline didn't produce any ocean polygons (e.g. coastline
            # assigned to tile but doesn't actually intersect it), don't
            # mark the tile as having coastline — it would get land background
            # with no ocean to paint over it.
            if not water_polys:
                has_coastline = False
        except Exception:
            pass

    # Add non-coastline features
    for _, feat_str in non_coastline_entries:
        feature_strings.append(feat_str)

    # Write final tile JSON
    tile_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(tile_json_path, "w", encoding="utf-8") as f:
        f.write('{"type":"FeatureCollection",')
        f.write('"_meta":{"hasCoastline":')
        f.write("true" if has_coastline else "false")
        f.write(',"hasLandFeatures":')
        f.write("true" if has_land_features else "false")
        f.write('},"features":[')
        f.write(",".join(feature_strings))
        f.write("]}")

    # Remove intermediate .jsonl
    tile_jsonl_path.unlink()

    return tile_json_path.stat().st_size


def split_geojson_into_tiles(
    geojson_file,
    output_dir,
    source_pbf_file=None,
    clip_to_tiles=False,
    clip_buffer_pct=0.02,
):
    """Split GeoJSON into tiles by streaming features directly to .jsonl files.

    Args:
        geojson_file: Path to GeoJSON file to process
        output_dir: Directory to write tiles to
        source_pbf_file: Path to source OSM PBF file (used for bounds extraction)
    """

    processing_keys = TILESET_IDS
    print(f"Generating tilesets: {processing_keys}")
    if clip_to_tiles:
        print(f"  Clipping enabled (buffer: {clip_buffer_pct * 100:.1f}% of tile size)")

    # Get bounds from PBF header
    if source_pbf_file and Path(source_pbf_file).suffix == ".pbf":
        actual_bounds = get_pbf_bounds(source_pbf_file)
        if not actual_bounds:
            raise ValueError(
                f"Could not extract bounds from PBF file {source_pbf_file}. "
                "Ensure osmium-tool is installed and the PBF file is valid."
            )
    else:
        raise ValueError(
            f"Must provide source_pbf_file. source_pbf_file={source_pbf_file}"
        )

    output_path = Path(output_dir)

    # Track all .jsonl files written per tileset for finalization
    tile_files_written = defaultdict(set)  # tileset_id -> set of (x, y)
    # Cache which directories have been created
    created_dirs = set()

    def append_to_tile(ts, x, y, line):
        """Append a line to a tile's .jsonl file."""
        tile_dir = output_path / str(ts) / str(x)
        dir_key = (ts, x)
        if dir_key not in created_dirs:
            tile_dir.mkdir(parents=True, exist_ok=True)
            created_dirs.add(dir_key)
        with open(tile_dir / f"{y}.jsonl", "a", encoding="utf-8") as fh:
            fh.write(line)

    # Pass 1: Stream features directly to .jsonl tile files
    stats = defaultdict(int)
    i = 0

    file_size = os.path.getsize(geojson_file)
    start_time = time.time()
    last_update = start_time
    last_count = 0
    update_interval = 1.2
    next_check_at = 75

    rate_history = []
    max_history = 5

    db_prefix = (
        Path(source_pbf_file).stem if source_pbf_file else Path(geojson_file).stem
    )

    with open(geojson_file, "rb") as f:
        for feature in ijson.items(f, "features.item"):
            i += 1

            # Progress reporting
            if i >= next_check_at:
                current_time = time.time()
                elapsed_since_last = current_time - last_update
                features_since_last = i - last_count

                rate_history.append((elapsed_since_last, features_since_last))
                if len(rate_history) > max_history:
                    rate_history.pop(0)

                total_elapsed = sum(s[0] for s in rate_history)
                total_features = sum(s[1] for s in rate_history)
                features_per_sec = (
                    total_features / total_elapsed if total_elapsed > 0 else 0
                )

                file_pos = f.tell()
                progress_pct = (file_pos / file_size * 100) if file_size > 0 else 0

                rate_str = (
                    f"{features_per_sec / 1000:.1f}k"
                    if features_per_sec >= 1000
                    else f"{features_per_sec:.0f}"
                )
                print(
                    f"\r  Processed: {i:,} features | {rate_str} features/sec | {progress_pct:.1f}% through file",
                    end="",
                    flush=True,
                )
                last_update = current_time
                last_count = i

                if features_per_sec > 0:
                    estimated_features = int(features_per_sec * update_interval)
                    estimated_features = max(1000, min(500000, estimated_features))
                else:
                    estimated_features = 10000
                next_check_at = i + estimated_features

            props = feature.get("properties", {})
            geom_type = feature["geometry"]["type"]

            # For each tileset, check if feature should be included
            for tileset_config in TILESETS:
                tileset_id = tileset_config["id"]
                tile_size_m = tileset_config["tile_size_meters"]

                feature_config = feature_matches_tileset(
                    feature, tileset_config, props, geom_type
                )
                if not feature_config:
                    continue

                tileset_feature = copy.deepcopy(feature)
                # Don't simplify coastlines — they need full precision for
                # ocean polygon construction in finalize_tile.
                # The resulting ocean polygons get simplified instead.
                if props.get("natural") != "coastline":
                    tileset_feature = simplify_feature_for_tileset(
                        tileset_feature, tileset_id, feature_config
                    )
                tileset_feature["_render"] = feature_config["render"]

                feature_tiles = get_tiles_for_feature_in_tileset(
                    tileset_feature, tileset_id, tile_size_m
                )

                _, importance = classify_feature_importance(props, geom_type)

                if clip_to_tiles and len(feature_tiles) > 1:
                    # Clip geometry to each tile's bounds individually
                    for tile_coords in feature_tiles:
                        ts, x, y = tile_coords
                        clipped = clip_feature_to_tile(
                            copy.deepcopy(tileset_feature),
                            x,
                            y,
                            tile_size_m,
                            clip_buffer_pct,
                        )
                        if clipped is None:
                            continue
                        clipped_json = json.dumps(
                            clipped,
                            separators=(",", ":"),
                            default=decimal_default,
                        )
                        append_to_tile(ts, x, y, f"{importance}\t{clipped_json}\n")
                        tile_files_written[ts].add((x, y))
                        stats[ts] += 1
                else:
                    # No clipping — serialize once, write to all tiles
                    feature_json = json.dumps(
                        tileset_feature,
                        separators=(",", ":"),
                        default=decimal_default,
                    )
                    for tile_coords in feature_tiles:
                        ts, x, y = tile_coords
                        append_to_tile(ts, x, y, f"{importance}\t{feature_json}\n")
                        tile_files_written[ts].add((x, y))
                        stats[ts] += 1

    print(
        f"\r  Processed {i:,} features in {time.time() - start_time:.0f}s ({db_prefix})"
        + " " * 40
    )

    # Pass 2: Finalize each .jsonl into .json (deduplicate, sort, add _meta)
    total_tiles = sum(len(tiles) for tiles in tile_files_written.values())
    tile_count = 0
    total_bytes = 0

    write_start = time.time()
    last_update = write_start
    last_tile_count = 0
    next_tile_check_at = 12
    tile_rate_history = []

    for tileset_id in processing_keys:
        for x, y in tile_files_written.get(tileset_id, set()):
            jsonl_path = output_path / str(tileset_id) / str(x) / f"{y}.jsonl"
            json_path = output_path / str(tileset_id) / str(x) / f"{y}.json"

            total_bytes += finalize_tile(jsonl_path, json_path)
            tile_count += 1

            # Progress reporting
            if tile_count >= next_tile_check_at:
                current_time = time.time()
                elapsed_since_last = current_time - last_update
                tiles_since_last = tile_count - last_tile_count

                tile_rate_history.append((elapsed_since_last, tiles_since_last))
                if len(tile_rate_history) > max_history:
                    tile_rate_history.pop(0)

                total_elapsed = sum(s[0] for s in tile_rate_history)
                total_written = sum(s[1] for s in tile_rate_history)
                tiles_per_sec = (
                    total_written / total_elapsed if total_elapsed > 0 else 0
                )
                progress_pct = (
                    (tile_count / total_tiles * 100) if total_tiles > 0 else 0
                )
                print(
                    f"\r  Finalizing: {tile_count:,}/{total_tiles:,} tiles | {tiles_per_sec:.0f} tiles/sec | {progress_pct:.1f}%",
                    end="",
                    flush=True,
                )
                last_update = current_time
                last_tile_count = tile_count

                if tiles_per_sec > 0:
                    estimated_tiles = int(tiles_per_sec * update_interval)
                    estimated_tiles = max(10, min(10000, estimated_tiles))
                else:
                    estimated_tiles = 100
                next_tile_check_at = tile_count + estimated_tiles

    write_elapsed = time.time() - write_start
    size_mb = total_bytes / (1024 * 1024)
    print(
        f"\r  Created {tile_count:,} tiles ({size_mb:.1f} MB) in {write_elapsed:.0f}s"
        + " " * 40
    )

    return {"bounds": actual_bounds, "total_bytes": total_bytes}


def process_geojson_to_tiles(args):
    """Process a single GeoJSON file into tiles."""
    geojson_file, output_dir, source_file, clip_to_tiles, clip_buffer_pct = args

    geojson_path = Path(geojson_file)
    source_path = Path(source_file) if source_file else geojson_path

    try:
        result = split_geojson_into_tiles(
            str(geojson_file),
            output_dir,
            source_pbf_file=str(source_path),
            clip_to_tiles=clip_to_tiles,
            clip_buffer_pct=clip_buffer_pct,
        )

        return {
            "name": geojson_path.name,
            "status": "success",
            "bounds": result["bounds"],
            "total_bytes": result["total_bytes"],
        }

    except Exception as e:
        import traceback

        return {
            "name": geojson_path.name,
            "status": "failed",
            "error": str(e) + "\n" + traceback.format_exc(),
        }


def _categorize_feature(feature):
    """Categorize a feature by its primary OSM tag for statistics."""
    props = feature.get("properties", {})
    # Priority order for primary tag detection
    for key in (
        "building",
        "highway",
        "railway",
        "waterway",
        "natural",
        "landuse",
        "leisure",
        "amenity",
        "shop",
        "boundary",
        "place",
        "aeroway",
        "public_transport",
        "man_made",
    ):
        val = props.get(key)
        if val:
            if key == "building" and val == "yes":
                return "building", "building"
            return key, f"{key}:{val}"
    return "unknown", "unknown"


def _count_coordinates(geometry):
    """Count total coordinate points in a geometry."""
    coords = geometry.get("coordinates", [])
    geom_type = geometry.get("type", "")

    if geom_type == "Point":
        return 1
    elif geom_type in ("LineString", "MultiPoint"):
        return len(coords)
    elif geom_type in ("Polygon", "MultiLineString"):
        return sum(len(ring) for ring in coords)
    elif geom_type == "MultiPolygon":
        return sum(len(ring) for polygon in coords for ring in polygon)
    return 0


def _format_size(num_bytes):
    """Format bytes as human-readable string."""
    if num_bytes >= 1024 * 1024 * 1024:
        return f"{num_bytes / (1024**3):.2f} GB"
    elif num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    elif num_bytes >= 1024:
        return f"{num_bytes / 1024:.0f} KB"
    return f"{num_bytes} B"


def compute_tile_statistics(tile_dir, output_file=None, max_sample=1000):
    """Compute per-tileset statistics by sampling tiles.

    Args:
        tile_dir: Path to generated tiles directory
        output_file: Path to write statistics report (default: tile_dir/statistics.md)
        max_sample: Max tiles to sample per tileset
    """
    tile_dir = Path(tile_dir)
    if output_file is None:
        output_file = tile_dir / "statistics.md"

    lines = []
    lines.append("# Tile Statistics")
    lines.append(f"")
    lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"Source: `{tile_dir}`")
    lines.append("")
    lines.append("## Methodology")
    lines.append("")
    lines.append(f"- Sampled up to {max_sample} random tiles per tileset")
    lines.append(
        "- For each sampled tile, parsed JSON and measured per-feature JSON size"
    )
    lines.append(
        "- Categorized features by primary OSM tag (building, highway:residential, etc.)"
    )
    lines.append("- Extrapolated to full tileset using sample ratio")
    lines.append(
        "- Coordinate counts reflect total vertices across all geometry rings/lines"
    )
    lines.append("")

    for tileset_id in sorted(
        d.name for d in tile_dir.iterdir() if d.is_dir() and d.name.startswith("t")
    ):
        tileset_path = tile_dir / tileset_id
        # Collect all tile files
        tile_files = list(tileset_path.rglob("*.json"))
        if not tile_files:
            continue

        total_tiles = len(tile_files)
        actual_disk_size = sum(f.stat().st_size for f in tile_files)

        # Sample
        if total_tiles <= max_sample:
            sampled = tile_files
        else:
            sampled = random.sample(tile_files, max_sample)

        sample_ratio = total_tiles / len(sampled)
        sample_pct = len(sampled) / total_tiles * 100

        # Collect stats per category
        group_stats = defaultdict(lambda: {"bytes": 0, "features": 0, "coords": 0})
        category_stats = defaultdict(lambda: {"bytes": 0, "features": 0, "coords": 0})

        for tile_file in sampled:
            try:
                with open(tile_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError):
                continue

            features = data.get("features", []) if isinstance(data, dict) else data
            for feat in features:
                feat_json = json.dumps(feat, separators=(",", ":"))
                feat_bytes = len(feat_json.encode("utf-8"))
                coord_count = _count_coordinates(feat.get("geometry", {}))
                group, category = _categorize_feature(feat)

                group_stats[group]["bytes"] += feat_bytes
                group_stats[group]["features"] += 1
                group_stats[group]["coords"] += coord_count

                category_stats[category]["bytes"] += feat_bytes
                category_stats[category]["features"] += 1
                category_stats[category]["coords"] += coord_count

        # Write tileset section
        lines.append(f"## {tileset_id.upper()}")
        lines.append("")
        lines.append(f"- **Tiles:** {total_tiles:,}")
        lines.append(f"- **Actual disk size:** {_format_size(actual_disk_size)}")
        lines.append(f"- **Sampled:** {len(sampled)} tiles ({sample_pct:.1f}%)")

        total_sampled_bytes = sum(s["bytes"] for s in group_stats.values())
        estimated_total = total_sampled_bytes * sample_ratio
        lines.append(
            f"- **Estimated feature data:** {_format_size(int(estimated_total))}"
        )
        lines.append("")

        # By group
        lines.append("### By group")
        lines.append("")
        lines.append("| Group | Est. Size | Features | Coordinates |")
        lines.append("|-------|----------|----------|-------------|")

        sorted_groups = sorted(
            group_stats.items(), key=lambda x: x[1]["bytes"], reverse=True
        )
        for group, stats in sorted_groups:
            est_size = _format_size(int(stats["bytes"] * sample_ratio))
            est_features = f"{int(stats['features'] * sample_ratio):,}"
            est_coords = f"{int(stats['coords'] * sample_ratio):,}"
            lines.append(f"| {group} | {est_size} | {est_features} | {est_coords} |")

        lines.append("")

        # Top categories
        lines.append("### Top categories")
        lines.append("")
        lines.append("| Category | Est. Size | Features | Coordinates | Avg bytes |")
        lines.append("|----------|----------|----------|-------------|-----------|")

        sorted_cats = sorted(
            category_stats.items(), key=lambda x: x[1]["bytes"], reverse=True
        )
        for category, stats in sorted_cats[:30]:
            est_size = _format_size(int(stats["bytes"] * sample_ratio))
            est_features = f"{int(stats['features'] * sample_ratio):,}"
            est_coords = f"{int(stats['coords'] * sample_ratio):,}"
            avg_bytes = stats["bytes"] // max(stats["features"], 1)
            lines.append(
                f"| {category} | {est_size} | {est_features} | {est_coords} | {avg_bytes} |"
            )

        lines.append("")

    report = "\n".join(lines)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"  ✓ Statistics written to {output_file}")
    return output_file


def main():
    parser = argparse.ArgumentParser(
        description="Generate map tiles from GeoJSON files",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "geojson_files",
        nargs="*",
        help="GeoJSON files to process (if not specified, processes all in data dir)",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent / "data",
        help="Directory containing GeoJSON files",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("public/tiles"),
        help="Output directory for tiles",
    )

    parser.add_argument(
        "-j",
        "--jobs",
        type=int,
        default=3,
        help="Number of parallel tile generation processes",
    )
    parser.add_argument(
        "--clip",
        action="store_true",
        default=True,
        help="Clip feature geometries to tile bounds (reduces size for large polygons)",
    )
    parser.add_argument(
        "--clip-buffer",
        type=float,
        default=0.02,
        help="Buffer around tile bounds for clipping (in percent of tile size, e.g. 0.02 = 2%%)",
    )

    args = parser.parse_args()

    # Find PBF files and check which ones need GeoJSON processing
    if args.geojson_files:
        # If specific files provided, use them directly
        geojson_files = [Path(f) for f in args.geojson_files]
        files_to_process = geojson_files
    else:
        # Find all OSM PBF files
        pbf_files = list(args.data_dir.glob("*-latest.osm.pbf"))

        if not pbf_files:
            print("Error: No OSM PBF files found")
            sys.exit(1)

        # Find GeoJSON files for each PBF
        files_to_process = []

        for pbf_file in pbf_files:
            work_dir = get_work_dir(pbf_file)
            geojson_file = work_dir / f"{pbf_file.stem}.geojson"
            if not geojson_file.exists():
                print(f"  ⚠ {pbf_file.name}: {geojson_file.name} not found")
                print("     Run 'just convert' first")
                sys.exit(1)
            files_to_process.append(geojson_file)

        # Sort files by size (largest first) for efficient border tile merging
        if files_to_process:
            files_to_process.sort(key=lambda f: f.stat().st_size, reverse=True)
            print(f"\nWill process {len(files_to_process)} GeoJSON file(s)")
            print("  Processing order (largest to smallest):")
            for gj in files_to_process:
                size_mb = gj.stat().st_size / (1024 * 1024)
                name = gj.stem.replace("-latest.osm", "").replace("-", " ").title()
                print(f"    • {name} ({size_mb:.0f} MB)")

        geojson_files = files_to_process

    print("=" * 70)
    print("Step 3: Generate Map Tiles")
    print("=" * 70)
    print()
    print("Configuration:")
    print(f"  Tilesets: {', '.join(TILESET_IDS)}")
    print(f"  Parallel jobs: {args.jobs}")
    print(f"  Output: {args.output_dir}")
    print()

    # Create temporary directory for building tiles
    # This ensures we start with a clean slate and don't merge with old data
    temp_tile_dir = Path(
        tempfile.mkdtemp(prefix="tiles_build_", dir=args.output_dir.parent)
    )

    all_results = []

    # Process OSM GeoJSON files
    if geojson_files:
        print(f"OSM Regions ({len(geojson_files)}):")
        for gj in geojson_files:
            size_mb = gj.stat().st_size / (1024 * 1024)
            region_name = gj.stem.replace("-latest.osm", "").replace("-", " ").title()
            print(f"  • {region_name} ({size_mb:.0f} MB)")
        print()

        # Find corresponding PBF files for fingerprinting
        tile_args = []
        for gj in geojson_files:
            # GeoJSON is at data/hamburg-latest/hamburg-latest.osm.geojson
            # PBF is at data/hamburg-latest.osm.pbf (one level up)
            pbf_file = gj.parent.parent / f"{gj.parent.name}.osm.pbf"
            source_file = str(pbf_file) if pbf_file.exists() else str(gj)
            tile_args.append(
                (
                    str(gj),
                    str(temp_tile_dir),
                    source_file,
                    args.clip,
                    args.clip_buffer,
                )
            )

        # Process in parallel with progress bar
        with Pool(min(args.jobs, len(tile_args))) as pool:
            results = list(
                tqdm(
                    pool.imap_unordered(process_geojson_to_tiles, tile_args),
                    total=len(tile_args),
                    desc="Processing regions",
                    unit="region",
                )
            )

        all_results.extend(results)

    # Merge bounds from all results
    merged_bounds = {
        "minLon": float("inf"),
        "maxLon": float("-inf"),
        "minLat": float("inf"),
        "maxLat": float("-inf"),
    }

    print()
    print("Processing Summary:")

    success_count = 0
    failed_sources = []

    for result in all_results:
        if result["status"] == "success":
            bounds = result["bounds"]
            # Don't include land polygon bounds in final merge - they're filtered to OSM bounds anyway
            # and before filtering they cover the entire world
            if bounds and "land" not in result["name"]:
                merged_bounds["minLon"] = min(merged_bounds["minLon"], bounds["minLon"])
                merged_bounds["maxLon"] = max(merged_bounds["maxLon"], bounds["maxLon"])
                merged_bounds["minLat"] = min(merged_bounds["minLat"], bounds["minLat"])
                merged_bounds["maxLat"] = max(merged_bounds["maxLat"], bounds["maxLat"])

            # Clean up names for display
            name = result["name"].replace(".geojson", "").replace("-latest.osm", "")
            tile_bytes = result.get("total_bytes", 0)
            if tile_bytes >= 1024 * 1024:
                size_str = f"{tile_bytes / (1024 * 1024):.1f} MB"
            elif tile_bytes >= 1024:
                size_str = f"{tile_bytes / 1024:.0f} KB"
            else:
                size_str = f"{tile_bytes} B"
            if "land" in name:
                print(f"  ✓ {name} ({size_str} tiles)")
            else:
                print(f"  ✓ {name.replace('-', ' ').title()} ({size_str} tiles)")
            success_count += 1
        else:
            name = result["name"].replace(".geojson", "").replace("-latest.osm", "")
            failed_sources.append(f"{name}: {result.get('error', 'unknown error')}")

    if failed_sources:
        for failure in failed_sources:
            print(f"  ✗ {failure}")

    # Write tile index
    if success_count > 0:
        tile_count = sum(
            len(list((temp_tile_dir / tileset_id).rglob("*.json")))
            for tileset_id in TILESET_IDS
        )

        # Check if we have valid merged bounds
        if merged_bounds["minLon"] == float("inf"):
            print()
            print("⚠ WARNING: No valid bounds in merged results!")
            print("  All processed sources returned no bounds data.")
            print()
            print("  Sources processed:")
            for result in all_results:
                name = result["name"].replace(".geojson", "").replace("-latest.osm", "")
                if result["status"] == "success":
                    bounds = result.get("bounds")
                    if bounds:
                        print(f"    • {name}: has bounds (excluded: {'land' in name})")
                    else:
                        print(f"    • {name}: NO BOUNDS")
                else:
                    print(f"    • {name}: failed")
            print()
            print("  Using fallback center coordinates for index.")
            # Use a small area around Hamburg as fallback
            merged_bounds = {
                "minLon": HAMBURG_CENTER_LON - 0.1,
                "maxLon": HAMBURG_CENTER_LON + 0.1,
                "minLat": HAMBURG_CENTER_LAT - 0.1,
                "maxLat": HAMBURG_CENTER_LAT + 0.1,
            }

        index_file = temp_tile_dir / "index.json"
        index_data = {
            "bounds": merged_bounds,
            "tilesets": TILESET_IDS,
            "tile_count": tile_count,
            "center": {
                "lon": HAMBURG_CENTER_LON,
                "lat": HAMBURG_CENTER_LAT,
            },
            "generated": int(time.time() * 1000),
        }

        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2)

        # Calculate total tile size
        grand_total_bytes = sum(
            r.get("total_bytes", 0) for r in all_results if r["status"] == "success"
        )
        if grand_total_bytes >= 1024 * 1024:
            total_size_str = f"{grand_total_bytes / (1024 * 1024):.1f} MB"
        else:
            total_size_str = f"{grand_total_bytes / 1024:.0f} KB"

        print()
        print("Finalizing tiles...")
        print(f"  ✓ Created index with {tile_count:,} tiles ({total_size_str})")
        print(
            f"  ✓ Bounds: {merged_bounds['minLat']:.2f}°N to {merged_bounds['maxLat']:.2f}°N, "
            f"{merged_bounds['minLon']:.2f}°E to {merged_bounds['maxLon']:.2f}°E"
        )

        # Compute tile statistics
        print()
        print("Computing tile statistics...")
        stats_start = time.time()
        compute_tile_statistics(temp_tile_dir)
        print(f"  Done in {time.time() - stats_start:.1f}s")

        # Move tiles from temp directory to final location atomically
        if args.output_dir.exists():
            shutil.rmtree(args.output_dir)

        shutil.move(str(temp_tile_dir), str(args.output_dir))
        print(f"  ✓ Moved to {args.output_dir}")
    else:
        # Clean up temp directory if nothing was created
        if temp_tile_dir.exists():
            shutil.rmtree(temp_tile_dir)

    print()
    print("=" * 70)
    if success_count == len(all_results):
        print(f"✓ Tile generation complete! Processed {success_count} source(s)")
    else:
        print(
            f"⚠ Tile generation completed with errors ({success_count}/{len(all_results)} sources)"
        )
    print("=" * 70)

    if success_count < len(all_results):
        sys.exit(1)


if __name__ == "__main__":
    main()

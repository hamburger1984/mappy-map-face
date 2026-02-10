#!/usr/bin/env python3
"""
Split GeoJSON into progressive tiles for efficient loading.

Tile system:
- Z0-Z5: Major features (motorways, railways, forests, large water)
- Z6-Z10: Secondary features (primary roads, parks, rivers)
- Z11-Z14: Detailed features (residential roads, buildings)
- Z15+: All details (paths, small POIs)

Tile grid uses Web Mercator (similar to OSM tiles)
Each tile: tiles/{zoom}/{x}/{y}.json.gz
"""

import decimal
import gzip
import json
import math
import os
import sqlite3
import sys
import tempfile
import time
from collections import defaultdict
from pathlib import Path

import ijson


class DecimalEncoder(json.JSONEncoder):
    """Handle decimal.Decimal values from ijson."""

    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return float(o)
        return super().default(o)


# Hamburg region bounds (~100km radius from city center)
MIN_LON = 8.48
MAX_LON = 11.50
MIN_LAT = 52.65

# POI category definitions (mirrors map_renderer.js POI_CATEGORIES)
POI_CATEGORIES = {
    "food_drink": {
        "color": {"r": 231, "g": 76, "b": 60, "a": 255},
        "amenity": {
            "restaurant",
            "fast_food",
            "cafe",
            "ice_cream",
            "food_court",
            "bbq",
        },
        "shop": {
            "bakery",
            "pastry",
            "deli",
            "confectionery",
            "butcher",
            "cheese",
            "seafood",
            "coffee",
            "tea",
            "wine",
            "beverages",
            "alcohol",
        },
    },
    "shopping": {
        "color": {"r": 155, "g": 89, "b": 182, "a": 255},
        "shop": {
            "hairdresser",
            "clothes",
            "kiosk",
            "supermarket",
            "convenience",
            "beauty",
            "jewelry",
            "florist",
            "chemist",
            "mobile_phone",
            "optician",
            "shoes",
            "furniture",
            "books",
            "bicycle",
            "car_repair",
            "tailor",
            "tattoo",
            "massage",
            "interior_decoration",
            "electronics",
            "hardware",
            "sports",
            "toys",
            "gift",
            "stationery",
            "pet",
            "photo",
            "music",
            "art",
            "bag",
            "fabric",
            "garden_centre",
            "hearing_aids",
            "travel_agency",
            "dry_cleaning",
            "laundry",
            "car",
            "car_parts",
            "tyres",
            "motorcycle",
        },
        "amenity": {"marketplace", "vending_machine"},
    },
    "health": {
        "color": {"r": 46, "g": 204, "b": 113, "a": 255},
        "amenity": {
            "doctors",
            "dentist",
            "pharmacy",
            "hospital",
            "clinic",
            "veterinary",
            "nursing_home",
        },
    },
    "tourism": {
        "color": {"r": 230, "g": 126, "b": 34, "a": 255},
        "tourism": {
            "artwork",
            "hotel",
            "museum",
            "viewpoint",
            "information",
            "attraction",
            "guest_house",
            "hostel",
            "gallery",
            "camp_site",
            "picnic_site",
            "zoo",
            "theme_park",
            "motel",
            "apartment",
        },
    },
    "historic": {
        "color": {"r": 139, "g": 69, "b": 19, "a": 255},
        "historic": {
            "memorial",
            "boundary_stone",
            "monument",
            "castle",
            "ruins",
            "archaeological_site",
            "building",
            "church",
            "manor",
            "city_gate",
            "wayside_cross",
            "wayside_shrine",
            "heritage",
            "milestone",
            "tomb",
            "technical_monument",
            "highwater_mark",
        },
    },
    "services": {
        "color": {"r": 52, "g": 152, "b": 219, "a": 255},
        "amenity": {
            "bank",
            "post_office",
            "library",
            "police",
            "fire_station",
            "townhall",
            "courthouse",
            "embassy",
            "community_centre",
            "social_facility",
            "place_of_worship",
            "cinema",
            "theatre",
            "arts_centre",
            "driving_school",
            "recycling",
            "post_box",
            "atm",
            "bureau_de_change",
            "toilets",
            "events_venue",
            "childcare",
        },
    },
    "transport": {
        "color": {"r": 26, "g": 188, "b": 156, "a": 255},
        "amenity": {
            "bicycle_rental",
            "parking",
            "parking_entrance",
            "fuel",
            "charging_station",
            "car_sharing",
            "taxi",
            "bus_station",
            "ferry_terminal",
            "car_rental",
            "boat_rental",
        },
    },
    "education": {
        "color": {"r": 243, "g": 156, "b": 18, "a": 255},
        "amenity": {
            "kindergarten",
            "school",
            "university",
            "college",
            "music_school",
            "language_school",
            "training",
        },
    },
    "nightlife": {
        "color": {"r": 233, "g": 30, "b": 144, "a": 255},
        "amenity": {
            "bar",
            "pub",
            "nightclub",
            "biergarten",
            "casino",
            "gambling",
            "hookah_lounge",
        },
    },
}

POI_AMENITY_PRIORITY = [
    "food_drink",
    "nightlife",
    "health",
    "education",
    "transport",
    "services",
]


def classify_poi(props):
    """Classify a POI into a category. Returns category ID or None."""
    amenity = props.get("amenity")
    shop = props.get("shop")
    tourism = props.get("tourism")
    historic = props.get("historic")

    if amenity:
        for cat_id in POI_AMENITY_PRIORITY:
            cat_def = POI_CATEGORIES[cat_id]
            if "amenity" in cat_def and amenity in cat_def["amenity"]:
                return cat_id
        if amenity in POI_CATEGORIES["shopping"].get("amenity", set()):
            return "shopping"
    if shop:
        for cat_id, cat_def in POI_CATEGORIES.items():
            if "shop" in cat_def and shop in cat_def["shop"]:
                return cat_id
        return "shopping"
    if tourism:
        return "tourism"
    if historic:
        return "historic"
    if amenity:
        return "services"
    return None


MAX_LAT = 54.45


def lon_to_tile_x(lon, zoom):
    """Convert longitude to tile X coordinate"""
    n = 2.0**zoom
    return int((lon + 180.0) / 360.0 * n)


def lat_to_tile_y(lat, zoom):
    """Convert latitude to tile Y coordinate"""
    n = 2.0**zoom
    lat_rad = math.radians(lat)
    return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)


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


def get_render_metadata(props, geom_type):
    """
    Compute rendering metadata for a feature.
    Returns dict with: color (RGBA), layer, minLOD, fill
    This is the build-time equivalent of map_renderer.js classifyFeature()
    """

    # Parks and green spaces
    if props.get("leisure") == "park" or props.get("landuse") in ["grass", "meadow"]:
        return {
            "layer": "natural_background",
            "color": {"r": 200, "g": 230, "b": 180, "a": 255},
            "minLOD": 1,
            "fill": True,
        }

    # Agricultural land
    if props.get("landuse") in ["farmland", "orchard", "vineyard"]:
        return {
            "layer": "natural_background",
            "color": {"r": 238, "g": 240, "b": 213, "a": 255},
            "minLOD": 1,
            "fill": True,
        }

    # Forests and woods
    if props.get("landuse") == "forest" or props.get("natural") == "wood":
        return {
            "layer": "forests",
            "color": {"r": 173, "g": 209, "b": 158, "a": 255},
            "minLOD": 0,
            "fill": True,
        }

    # Water bodies (including coastline for sea/ocean areas)
    if (
        props.get("natural") == "water"
        or props.get("water")
        or props.get("waterway") == "riverbank"
        or props.get("natural") == "coastline"
    ):
        return {
            "layer": "water_areas",
            "color": {"r": 170, "g": 211, "b": 223, "a": 255},
            "minLOD": 0,
            "fill": True,
        }

    # Rivers and streams as lines
    if props.get("waterway") and props.get("waterway") != "riverbank":
        importance = 1 if props.get("waterway") in ["river", "canal"] else 2
        return {
            "layer": "waterways",
            "color": {"r": 170, "g": 211, "b": 223, "a": 255},
            "minLOD": importance,
            "fill": False,
        }

    # Commercial/industrial areas
    if props.get("landuse") in ["commercial", "retail"]:
        return {
            "layer": "landuse_areas",
            "color": {"r": 243, "g": 233, "b": 234, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    if props.get("landuse") == "industrial":
        return {
            "layer": "landuse_areas",
            "color": {"r": 240, "g": 233, "b": 240, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Buildings
    if props.get("building"):
        return {
            "layer": "areas",
            "color": {"r": 218, "g": 208, "b": 200, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Remap construction roads to their target type for render metadata
    effective_highway = props.get("highway")
    if effective_highway == "construction" and props.get("construction"):
        effective_highway = props.get("construction")

    # Major highways
    if effective_highway in ["motorway", "trunk"]:
        return {
            "layer": "major_roads",
            "color": {"r": 233, "g": 115, "b": 103, "a": 255},
            "minLOD": 0,
            "fill": False,
            "name": props.get("name", ""),
            "name_priority": 1,  # Highest priority for labels
        }

    # Primary and secondary roads
    if effective_highway in ["primary", "secondary"]:
        priority = 2 if effective_highway == "primary" else 3
        return {
            "layer": "major_roads",
            "color": {"r": 252, "g": 214, "b": 164, "a": 255},
            "minLOD": 1,
            "fill": False,
            "name": props.get("name", ""),
            "name_priority": priority,
        }

    # Tertiary and residential roads
    if effective_highway in ["tertiary", "residential", "unclassified"]:
        priority = 4 if effective_highway == "tertiary" else 5
        return {
            "layer": "roads",
            "color": {"r": 255, "g": 255, "b": 255, "a": 255},
            "minLOD": 2,
            "fill": False,
            "name": props.get("name", ""),
            "name_priority": priority,
        }

    # Small roads and paths
    if effective_highway:
        return {
            "layer": "roads",
            "color": {"r": 220, "g": 220, "b": 220, "a": 255},
            "minLOD": 3,
            "fill": False,
            "name": props.get("name", ""),
            "name_priority": 6,  # Lowest priority
        }

    # Railways (only major rail lines at LOD 1, minor at LOD 2)
    if props.get("railway") and geom_type != "Point":
        major_rail = ["rail", "light_rail", "subway"]
        minor_rail = ["tram", "monorail", "narrow_gauge", "preserved"]

        if props.get("railway") in major_rail or not props.get("railway"):
            return {
                "layer": "railways",
                "color": {"r": 153, "g": 153, "b": 153, "a": 255},
                "minLOD": 1,  # Major rail visible at medium zoom
                "fill": False,
            }
        elif props.get("railway") in minor_rail:
            return {
                "layer": "railways",
                "color": {"r": 153, "g": 153, "b": 153, "a": 255},
                "minLOD": 2,  # Minor rail only at closer zoom
                "fill": False,
            }

    # Points of interest (only named with amenities at high zoom)
    if geom_type == "Point":
        if props.get("name") and (
            props.get("amenity")
            or props.get("shop")
            or props.get("tourism")
            or props.get("historic")
        ):
            poi_cat = classify_poi(props)
            if poi_cat and poi_cat in POI_CATEGORIES:
                color = POI_CATEGORIES[poi_cat]["color"]
            else:
                color = {"r": 100, "g": 100, "b": 100, "a": 255}
                poi_cat = "services"
            return {
                "layer": "points",
                "color": color,
                "minLOD": 3,
                "fill": False,
                "poiCategory": poi_cat,
            }
        # Skip all other points
        return None

    # Default: skip
    return None


def classify_feature_importance(props, geom_type):
    """
    Classify feature by importance for progressive loading.
    Returns tuple: (min_zoom, importance_score)

    min_zoom: earliest zoom level to show this feature
    importance_score: for sorting within zoom level
    """

    # Remap construction roads to their target type for importance classification
    effective_highway = props.get("highway")
    if effective_highway == "construction" and props.get("construction"):
        effective_highway = props.get("construction")

    # Major water bodies (always visible)
    if (
        props.get("natural") == "water"
        or props.get("water")
        or props.get("waterway") == "riverbank"
    ):
        return (0, 100)  # Z0-Z5, very important

    # Forests (always visible)
    if props.get("landuse") == "forest" or props.get("natural") == "wood":
        return (0, 90)  # Z0-Z5, very important

    # Major highways (always visible)
    if effective_highway in ["motorway", "trunk"]:
        return (0, 80)  # Z0-Z5, very important

    # Railways (always visible)
    if props.get("railway") and geom_type != "Point":
        track_types = [
            "rail",
            "light_rail",
            "subway",
            "tram",
            "monorail",
            "narrow_gauge",
            "preserved",
        ]
        if props.get("railway") in track_types:
            return (0, 70)  # Z0-Z5, important

    # Major rivers
    if props.get("waterway") in ["river", "canal"]:
        return (6, 60)  # Z6-Z10

    # Primary/secondary roads
    if effective_highway in ["primary", "secondary"]:
        return (6, 50)  # Z6-Z10

    # Parks and green spaces
    if props.get("leisure") == "park" or props.get("landuse") in [
        "grass",
        "meadow",
        "farmland",
    ]:
        return (6, 40)  # Z6-Z10

    # Tertiary and residential roads
    if effective_highway in ["tertiary", "residential", "unclassified"]:
        return (11, 30)  # Z11-Z14

    # Buildings
    if props.get("building"):
        return (11, 20)  # Z11-Z14

    # Small roads and paths
    if effective_highway:
        return (15, 10)  # Z15+

    # Named POIs
    if geom_type == "Point" and props.get("name"):
        if props.get("amenity") or props.get("shop") or props.get("tourism"):
            return (15, 5)  # Z15+

    # Skip everything else
    return (99, 0)  # Never show


def get_tiles_for_feature(feature, zoom):
    """Get all tiles that this feature intersects at given zoom level"""
    bounds = get_feature_bounds(feature)
    if not bounds:
        return []

    min_x = lon_to_tile_x(bounds["minLon"], zoom)
    max_x = lon_to_tile_x(bounds["maxLon"], zoom)
    min_y = lat_to_tile_y(bounds["maxLat"], zoom)  # Note: Y is inverted
    max_y = lat_to_tile_y(bounds["minLat"], zoom)

    tiles = []
    for x in range(min_x, max_x + 1):
        for y in range(min_y, max_y + 1):
            tiles.append((zoom, x, y))

    return tiles


def get_input_fingerprint(input_file):
    """Fast fingerprint using file size + mtime (avoids hashing 3+ GB)."""
    stat = Path(input_file).stat()
    return f"{stat.st_size}:{stat.st_mtime_ns}"


def open_zoom_db(db_dir, zoom, fingerprint=None):
    """Open (or create) a per-zoom SQLite database. Returns (conn, is_cached)."""
    db_path = db_dir / f"tile_build_z{zoom}.db"

    if db_path.exists():
        if fingerprint:
            try:
                conn = sqlite3.connect(str(db_path))
                row = conn.execute(
                    "SELECT value FROM metadata WHERE key='fingerprint'"
                ).fetchone()
                if row and row[0] == fingerprint:
                    return conn, True
                conn.close()
            except sqlite3.OperationalError:
                pass
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("PRAGMA page_size=8192")
    conn.execute("""
        CREATE TABLE tile_features (
            x INTEGER,
            y INTEGER,
            importance INTEGER,
            feature_json TEXT
        )
    """)
    conn.execute("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT)")
    return conn, False


def split_geojson_into_tiles(input_file, output_dir, zoom_levels):
    """Split GeoJSON into tiles using per-zoom SQLite databases."""

    db_dir = Path(input_file).parent
    fingerprint = get_input_fingerprint(input_file)

    # Open per-zoom databases, check which ones can be reused
    zoom_dbs = {}
    need_import = False
    for zoom in zoom_levels:
        conn, cached = open_zoom_db(db_dir, zoom, fingerprint)
        zoom_dbs[zoom] = conn
        if not cached:
            need_import = True

    if not need_import:
        print("Input file unchanged, reusing all cached databases.")
    else:
        # If any zoom needs rebuilding, rebuild all for consistency
        for zoom in zoom_levels:
            zoom_dbs[zoom].close()
            conn, _ = open_zoom_db(db_dir, zoom)
            zoom_dbs[zoom] = conn

        # Pass 1: Stream features into per-zoom SQLite databases
        print(f"Streaming features from {input_file}...")
        print("\nPass 1: Classifying and distributing features...")
        stats = defaultdict(int)
        i = 0
        batches = {zoom: [] for zoom in zoom_levels}
        BATCH_SIZE = 50000

        # Get file size for progress tracking
        file_size = os.path.getsize(input_file)
        start_time = time.time()
        last_update = start_time
        last_count = 0
        update_interval = 5.0  # seconds
        next_check_at = 10000  # Target iteration to check and update

        # Rolling window for rate calculation (keep last 5 samples)
        rate_history = []  # List of (elapsed_time, items_processed) tuples
        max_history = 5

        with open(input_file, "rb") as f:
            for feature in ijson.items(f, "features.item"):
                i += 1

                # Update at target iteration (adaptive based on processing rate)
                if i >= next_check_at:
                    current_time = time.time()
                    # Record this sample
                    elapsed_since_last = current_time - last_update
                    features_since_last = i - last_count

                    # Add to rolling window
                    rate_history.append((elapsed_since_last, features_since_last))
                    if len(rate_history) > max_history:
                        rate_history.pop(0)

                    # Calculate rate based on all samples in window
                    total_elapsed = sum(sample[0] for sample in rate_history)
                    total_features = sum(sample[1] for sample in rate_history)
                    features_per_sec = (
                        total_features / total_elapsed if total_elapsed > 0 else 0
                    )

                    # Get file position for progress percentage
                    file_pos = f.tell()
                    progress_pct = (file_pos / file_size * 100) if file_size > 0 else 0

                    # Format features/sec based on magnitude
                    if features_per_sec >= 1000:
                        rate_str = f"{features_per_sec / 1000:.1f}k"
                    else:
                        rate_str = f"{features_per_sec:.0f}"

                    # Print on same line with carriage return
                    print(
                        f"\r  Processed: {i:,} features | {rate_str} features/sec | {progress_pct:.1f}% through file",
                        end="",
                        flush=True,
                    )
                    last_update = current_time
                    last_count = i

                    # Calculate next target iteration based on current rate
                    # Target: update approximately every 5 seconds
                    if features_per_sec > 0:
                        estimated_features = int(features_per_sec * update_interval)
                        # Clamp between 1000 and 50000 to avoid too frequent or too rare checks
                        estimated_features = max(1000, min(50000, estimated_features))
                    else:
                        estimated_features = 10000
                    next_check_at = i + estimated_features

                props = feature.get("properties", {})
                geom_type = feature["geometry"]["type"]

                render_meta = get_render_metadata(props, geom_type)
                if render_meta is None:
                    stats["skipped"] += 1
                    continue

                feature["_render"] = render_meta

                min_lod = render_meta["minLOD"]
                _, importance = classify_feature_importance(props, geom_type)

                target_zooms = []
                if min_lod <= 1:
                    target_zooms.extend([8, 11, 14])
                elif min_lod == 2:
                    target_zooms.extend([11, 14])
                elif min_lod >= 3:
                    target_zooms.append(14)

                feature_json = json.dumps(
                    feature, separators=(",", ":"), cls=DecimalEncoder
                )

                for zoom in zoom_levels:
                    if zoom in target_zooms:
                        feature_tiles = get_tiles_for_feature(feature, zoom)
                        for tile_coords in feature_tiles:
                            _, x, y = tile_coords
                            batches[zoom].append((x, y, importance, feature_json))
                            stats[f"z{zoom}"] += 1

                # Flush each zoom's batch independently
                for zoom in zoom_levels:
                    if len(batches[zoom]) >= BATCH_SIZE:
                        zoom_dbs[zoom].executemany(
                            "INSERT INTO tile_features VALUES (?,?,?,?)", batches[zoom]
                        )
                        zoom_dbs[zoom].commit()
                        batches[zoom].clear()

        # Flush remaining batches
        for zoom in zoom_levels:
            if batches[zoom]:
                zoom_dbs[zoom].executemany(
                    "INSERT INTO tile_features VALUES (?,?,?,?)", batches[zoom]
                )
                zoom_dbs[zoom].commit()
                batches[zoom].clear()

        # Final progress line
        elapsed = time.time() - start_time
        features_per_sec = i / elapsed if elapsed > 0 else 0
        if features_per_sec >= 1000:
            rate_str = f"{features_per_sec / 1000:.1f}k"
        else:
            rate_str = f"{features_per_sec:.0f}"
        print(
            f"\r  Processed: {i:,} features | {rate_str} features/sec | 100.0% through file"
        )
        print(f"\nCompleted in {elapsed:.1f}s - Processed {i:,} features total.")
        print(f"Feature distribution:")
        print(f"  Skipped: {stats['skipped']}")
        for zoom in sorted(zoom_levels):
            print(f"  Z{zoom}: {stats[f'z{zoom}']} feature-tile pairs")

        # Create indexes and store fingerprint
        print("\nCreating database indexes...")
        for zoom in zoom_levels:
            conn = zoom_dbs[zoom]
            conn.execute("CREATE INDEX idx_tile ON tile_features (x, y)")
            conn.execute(
                "INSERT INTO metadata VALUES ('fingerprint', ?)", (fingerprint,)
            )
            conn.commit()

    # Pass 2: Write tiles from each zoom database
    print("\nPass 2: Writing tiles...")
    output_path = Path(output_dir)
    total_tiles = 0
    tile_count = 0

    for zoom in zoom_levels:
        total_tiles += (
            zoom_dbs[zoom]
            .execute("SELECT COUNT(DISTINCT x || '/' || y) FROM tile_features")
            .fetchone()[0]
        )

    write_start = time.time()
    last_update = write_start
    last_tile_count = 0
    update_interval = 5.0  # seconds
    next_tile_check_at = 100  # Target tile count to check and update

    # Rolling window for tile write rate calculation (keep last 5 samples)
    tile_rate_history = []  # List of (elapsed_time, tiles_written) tuples
    max_history = 5

    for zoom in zoom_levels:
        conn = zoom_dbs[zoom]
        cursor = conn.execute(
            "SELECT x, y, feature_json FROM tile_features ORDER BY x, y, importance DESC"
        )

        created_dirs = set()
        current_tile = None
        feature_jsons = []

        for x, y, feature_json in cursor:
            tile_key = (x, y)
            if tile_key != current_tile:
                if current_tile is not None:
                    cx, cy = current_tile
                    tile_dir = output_path / str(zoom) / str(cx)
                    if cx not in created_dirs:
                        tile_dir.mkdir(parents=True, exist_ok=True)
                        created_dirs.add(cx)
                    tile_file = tile_dir / f"{cy}.json"
                    with open(tile_file, "w", encoding="utf-8") as f:
                        f.write('{"type":"FeatureCollection","features":[')
                        f.write(",".join(feature_jsons))
                        f.write("]}")
                    tile_count += 1

                    # Update at target tile count (adaptive based on write rate)
                    if tile_count >= next_tile_check_at:
                        current_time = time.time()
                        # Record this sample
                        elapsed_since_last = current_time - last_update
                        tiles_since_last = tile_count - last_tile_count

                        # Add to rolling window
                        tile_rate_history.append((elapsed_since_last, tiles_since_last))
                        if len(tile_rate_history) > max_history:
                            tile_rate_history.pop(0)

                        # Calculate rate based on all samples in window
                        total_elapsed = sum(sample[0] for sample in tile_rate_history)
                        total_tiles_written = sum(
                            sample[1] for sample in tile_rate_history
                        )
                        tiles_per_sec = (
                            total_tiles_written / total_elapsed
                            if total_elapsed > 0
                            else 0
                        )
                        progress_pct = (
                            (tile_count / total_tiles * 100) if total_tiles > 0 else 0
                        )
                        print(
                            f"\r  Written: {tile_count:,}/{total_tiles:,} tiles | {tiles_per_sec:.0f} tiles/sec | {progress_pct:.1f}%",
                            end="",
                            flush=True,
                        )
                        last_update = current_time
                        last_tile_count = tile_count

                        # Calculate next target tile count based on current rate
                        # Target: update approximately every 5 seconds
                        if tiles_per_sec > 0:
                            estimated_tiles = int(tiles_per_sec * update_interval)
                            # Clamp between 10 and 1000 to avoid too frequent or too rare checks
                            estimated_tiles = max(10, min(1000, estimated_tiles))
                        else:
                            estimated_tiles = 100
                        next_tile_check_at = tile_count + estimated_tiles
                current_tile = tile_key
                feature_jsons = []
            feature_jsons.append(feature_json)

        # Write last tile for this zoom
        if current_tile is not None:
            cx, cy = current_tile
            tile_dir = output_path / str(zoom) / str(cx)
            if cx not in created_dirs:
                tile_dir.mkdir(parents=True, exist_ok=True)
                created_dirs.add(cx)
            tile_file = tile_dir / f"{cy}.json"
            with open(tile_file, "w", encoding="utf-8") as f:
                f.write('{"type":"FeatureCollection","features":[')
                f.write(",".join(feature_jsons))
                f.write("]}")
            tile_count += 1

        conn.close()

    # Final tile writing summary
    write_elapsed = time.time() - write_start
    tiles_per_sec = tile_count / write_elapsed if write_elapsed > 0 else 0
    print(
        f"\r  Written: {tile_count:,}/{total_tiles:,} tiles | {tiles_per_sec:.0f} tiles/sec | 100.0%"
    )
    print(f"\n✓ Created {tile_count} tiles in {output_dir} ({write_elapsed:.1f}s)")

    # Write tile index
    index_file = output_path / "index.json"
    index_data = {
        "bounds": {
            "minLon": MIN_LON,
            "maxLon": MAX_LON,
            "minLat": MIN_LAT,
            "maxLat": MAX_LAT,
        },
        "zoom_levels": sorted(zoom_levels),
        "tile_count": total_tiles,
        "center": {"lon": (MIN_LON + MAX_LON) / 2, "lat": (MIN_LAT + MAX_LAT) / 2},
    }
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2)

    print(f"✓ Created tile index: {index_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: ./split-tiles.py <input.geojson>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_dir = "public/tiles"

    # Use zoom levels 8, 11, 14
    # Z8: Major features (visible from far away)
    # Z11: Medium detail
    # Z14: High detail
    zoom_levels = [8, 11, 14]

    print("Hamburg OSM Tile Splitter")
    print("=" * 50)
    print(f"Input: {input_file}")
    print(f"Output: {output_dir}")
    print(f"Zoom levels: {zoom_levels}")
    print(f"Progressive loading:")
    print(f"  Z0-Z5 → Use Z8 tiles: Motorways, railways, forests, water")
    print(f"  Z6-Z10 → Use Z11 tiles: + Primary roads, parks, rivers")
    print(f"  Z11-Z14 → Use Z14 tiles: + Residential roads, buildings")
    print(f"  Z15+ → Use Z14 tiles: All details")
    print("=" * 50)
    print()

    split_geojson_into_tiles(input_file, output_dir, zoom_levels)
    print("\n✓ Done!")

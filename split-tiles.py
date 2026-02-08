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

import gzip
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

# Hamburg bounds
MIN_LON = 9.77
MAX_LON = 10.21
MIN_LAT = 53.415

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


MAX_LAT = 53.685


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
        lons.append(coord[0])
        lats.append(coord[1])

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

    # Water bodies
    if (
        props.get("natural") == "water"
        or props.get("water")
        or props.get("waterway") == "riverbank"
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
    if props.get("landuse") in ["commercial", "industrial", "retail"]:
        return {
            "layer": "areas",
            "color": {"r": 240, "g": 225, "b": 225, "a": 255},
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
        }

    # Primary and secondary roads
    if effective_highway in ["primary", "secondary"]:
        return {
            "layer": "major_roads",
            "color": {"r": 252, "g": 214, "b": 164, "a": 255},
            "minLOD": 1,
            "fill": False,
        }

    # Tertiary and residential roads
    if effective_highway in ["tertiary", "residential", "unclassified"]:
        return {
            "layer": "roads",
            "color": {"r": 255, "g": 255, "b": 255, "a": 255},
            "minLOD": 2,
            "fill": False,
        }

    # Small roads and paths
    if effective_highway:
        return {
            "layer": "roads",
            "color": {"r": 220, "g": 220, "b": 220, "a": 255},
            "minLOD": 3,
            "fill": False,
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


def split_geojson_into_tiles(input_file, output_dir, zoom_levels):
    """Split GeoJSON into tiles"""
    print(f"Loading {input_file}...")
    with open(input_file, "r") as f:
        data = json.load(f)

    features = data["features"]
    print(f"Loaded {len(features)} features")

    # Organize features by tile and zoom
    tiles = defaultdict(lambda: defaultdict(list))

    print("\nClassifying and distributing features...")
    stats = defaultdict(int)

    for i, feature in enumerate(features):
        if i % 10000 == 0:
            print(f"  Processed {i}/{len(features)} features...")

        props = feature.get("properties", {})
        geom_type = feature["geometry"]["type"]

        # Get rendering metadata and embed in feature
        render_meta = get_render_metadata(props, geom_type)
        if render_meta is None:
            stats["skipped"] += 1
            continue

        # Embed metadata in feature for client use
        feature["_render"] = render_meta

        # Use minLOD from metadata for tile distribution
        min_lod = render_meta["minLOD"]
        _, importance = classify_feature_importance(props, geom_type)

        # Map minLOD to appropriate tile zoom levels
        # Z8 (far view): LOD 0-1 only
        # Z11 (medium): LOD 0-2
        # Z14 (close): LOD 0-3 (all)
        target_zooms = []
        if min_lod <= 1:
            target_zooms.extend([8, 11, 14])  # Show in all zoom levels
        elif min_lod == 2:
            target_zooms.extend([11, 14])  # Show in medium and close views only
        elif min_lod >= 3:
            target_zooms.append(14)  # Show only in close view

        # Add to appropriate zoom levels only
        for zoom in zoom_levels:
            if zoom in target_zooms:
                feature_tiles = get_tiles_for_feature(feature, zoom)
                for tile_coords in feature_tiles:
                    z, x, y = tile_coords
                    tiles[tile_coords][importance].append(feature)
                    stats[f"z{z}"] += 1

    print(f"\nFeature distribution:")
    print(f"  Skipped: {stats['skipped']}")
    for zoom in sorted(zoom_levels):
        print(f"  Z{zoom}: {stats[f'z{zoom}']} feature-tile pairs")

    # Write tiles
    print("\nWriting tiles...")
    output_path = Path(output_dir)
    total_tiles = len(tiles)

    for i, (tile_coords, importance_groups) in enumerate(tiles.items()):
        if i % 100 == 0:
            print(f"  Writing tile {i}/{total_tiles}...")

        z, x, y = tile_coords
        tile_dir = output_path / str(z) / str(x)
        tile_dir.mkdir(parents=True, exist_ok=True)

        # Sort features by importance (higher first)
        sorted_features = []
        for importance in sorted(importance_groups.keys(), reverse=True):
            sorted_features.extend(importance_groups[importance])

        tile_geojson = {"type": "FeatureCollection", "features": sorted_features}

        # Write compressed GeoJSON
        tile_file = tile_dir / f"{y}.json.gz"
        with gzip.open(tile_file, "wt", encoding="utf-8") as f:
            json.dump(tile_geojson, f, separators=(",", ":"))

    print(f"\n✓ Created {total_tiles} tiles in {output_dir}")

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
    with open(index_file, "w") as f:
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

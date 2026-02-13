#!/usr/bin/env python3
"""
Step 3: Generate map tiles from GeoJSON files.

This script processes GeoJSON files into tile format with parallel processing
and detailed progress reporting.

Tile system:
- Z0-Z5: Major features (motorways, railways, forests, large water)
- Z6-Z10: Secondary features (primary roads, parks, rivers)
- Z11-Z14: Detailed features (residential roads, buildings)
- Z15+: All details (paths, small POIs)
"""

import argparse
import copy
import decimal
import json
import math
import os
import shutil
import sqlite3
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


# ============================================================================
# TILE GENERATION CORE (from split-tiles.py)
# ============================================================================

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
    ["rail", "light_rail", "subway", "tram", "monorail", "narrow_gauge", "preserved"]
)

# Geometry type checks
POLYGON_TYPES = frozenset(["Polygon", "MultiPolygon"])

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
COMMERCIAL_LANDUSE = frozenset(["commercial", "retail"])
CEMETERY_LANDUSE = frozenset(["cemetery"])
RAILWAY_LANDUSE = frozenset(["railway"])
CONSTRUCTION_LANDUSE = frozenset(["construction", "brownfield", "greenfield"])
MILITARY_LANDUSE = frozenset(["military"])
EDUCATION_LANDUSE = frozenset(["education"])
RELIGIOUS_LANDUSE = frozenset(["religious"])
ALLOTMENT_LANDUSE = frozenset(["allotments"])
WATER_LANDUSE = frozenset(["basin", "reservoir"])
QUARRY_LANDUSE = frozenset(["quarry", "landfill"])

# Waterway type classifications
MAJOR_WATERWAYS = frozenset(["river", "canal"])

# LOD to zoom level mappings (avoid recreating lists per feature)
LOD_0_ZOOMS = (3, 5, 8, 11, 14)  # Major features: all zoom levels
LOD_1_ZOOMS = (8, 11, 14)  # Secondary features: not in Z3/Z5
LOD_2_ZOOMS = (11, 14)  # Detail features: Z11 and Z14
LOD_3_ZOOMS = (14,)  # Very close detail: only Z14
LOD_4_ZOOMS = (14,)  # Very close detail: only Z14

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


def lon_to_tile_x(lon, zoom):
    """Convert longitude to tile X coordinate"""
    n = 2.0**zoom
    return int((lon + 180.0) / 360.0 * n)


def lat_to_tile_y(lat, zoom):
    """Convert latitude to tile Y coordinate"""
    n = 2.0**zoom
    lat_rad = math.radians(lat)
    return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)


def tile_to_lon(x, zoom):
    """Convert tile X coordinate to longitude"""
    n = 2.0**zoom
    return x / n * 360.0 - 180.0


def tile_to_lat(y, zoom):
    """Convert tile Y coordinate to latitude"""
    n = 2.0**zoom
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    return math.degrees(lat_rad)


def get_tile_bounds(x, y, zoom):
    """Get the lat/lon bounding box of a tile"""
    return {
        "minLon": tile_to_lon(x, zoom),
        "maxLon": tile_to_lon(x + 1, zoom),
        "minLat": tile_to_lat(y + 1, zoom),  # Y is inverted
        "maxLat": tile_to_lat(y, zoom),
    }


def feature_fully_contains_tile(feature_bounds, tile_bounds):
    """Check if a feature's bounding box completely contains a tile's bounding box"""
    return (
        feature_bounds["minLon"] <= tile_bounds["minLon"]
        and feature_bounds["maxLon"] >= tile_bounds["maxLon"]
        and feature_bounds["minLat"] <= tile_bounds["minLat"]
        and feature_bounds["maxLat"] >= tile_bounds["maxLat"]
    )


def count_coordinates(geom):
    """Count total coordinates in a geometry.

    Args:
        geom: GeoJSON geometry dict with 'type' and 'coordinates'

    Returns:
        int: Total number of coordinate pairs in the geometry
    """
    coords = geom["coordinates"]
    geom_type = geom["type"]

    if geom_type == "Point":
        return 1
    elif geom_type == "LineString":
        return len(coords)
    elif geom_type == "Polygon":
        return sum(len(ring) for ring in coords)
    elif geom_type == "MultiLineString":
        return sum(len(line) for line in coords)
    elif geom_type == "MultiPolygon":
        return sum(sum(len(ring) for ring in poly) for poly in coords)
    return 0


def simplify_feature_for_zoom(feature, zoom, min_lod):
    """Simplify feature geometry appropriate for zoom level using RDP algorithm.

    Uses the Ramer-Douglas-Peucker algorithm to reduce coordinate count while
    preserving visual fidelity at the target zoom level. Epsilon values are
    chosen based on the viewing scale at each zoom level.

    Args:
        feature: GeoJSON feature dict with geometry
        zoom: Target zoom level (3, 5, 8, 11, 14)
        min_lod: Minimum LOD this feature is visible at (affects simplification)

    Returns:
        Modified feature with simplified geometry (or original if simplification fails)
    """
    try:
        from shapely.geometry import mapping, shape
    except ImportError:
        # If shapely not installed, return original feature
        return feature

    geom = feature.get("geometry")
    if not geom:
        return feature

    geom_type = geom["type"]

    # Skip Points (no coordinates to simplify)
    if geom_type == "Point":
        return feature

    # Base epsilon values for zoom levels (more conservative than before)
    epsilon_map = {
        3: 0.003,  # ~300m - Continental view (was 0.01)
        5: 0.002,  # ~200m - Regional view (was 0.005)
        8: 0.0008,  # ~80m - City-wide view (was 0.001)
        11: 0.0002,  # ~20m - Neighborhood view
        14: 0.00005,  # ~5m - Street-level view
    }
    epsilon = epsilon_map.get(zoom, 0.0001)

    # Get feature properties for type-specific adjustments
    props = feature.get("properties", {})

    # Skip buildings - usually simple rectangles, simplification may distort
    if props.get("building"):
        return feature

    # Skip if geometry is already simple (< 5 vertices)
    coord_count = count_coordinates(geom)
    if coord_count < 5:
        return feature

    # Feature-type-specific epsilon scaling
    # Roads and coastlines need gentler simplification to preserve curves
    is_road = props.get("highway") is not None
    is_coastline = props.get("natural") == "coastline"
    is_waterway = props.get("waterway") is not None

    if is_road:
        # Roads: reduce epsilon by 60% to preserve curves
        epsilon *= 0.4
        # At highest detail (Z14), skip simplification for roads entirely
        # to preserve roundabouts and smooth curves
        if zoom == 14:
            return feature
    elif is_coastline:
        # Coastlines: reduce epsilon by 70% to preserve detail
        epsilon *= 0.3
        # At Z14, skip simplification to preserve coastal detail
        if zoom == 14:
            return feature
    elif is_waterway:
        # Rivers: reduce epsilon by 50% to preserve meandering
        epsilon *= 0.5
    elif props.get("landuse") == "forest" or props.get("natural") == "wood":
        # Forests: can be more aggressive (irregular boundaries less noticeable)
        epsilon *= 1.3
    elif props.get("natural") == "water" or props.get("water"):
        # Water bodies: moderate simplification
        epsilon *= 0.7

    # Additional scaling based on feature LOD (less aggressive than before)
    if min_lod == 0:  # Always visible (major features)
        epsilon *= 1.2  # Slightly more aggressive (was 1.5)
    elif min_lod >= 11:  # Only visible when zoomed in
        epsilon *= 0.7  # Preserve more detail (was 0.5)

    # Convert to Shapely, simplify, convert back
    try:
        shapely_geom = shape(geom)

        # Apply RDP simplification with topology preservation
        simplified = shapely_geom.simplify(epsilon, preserve_topology=True)

        # Only use simplified version if it actually reduced complexity
        # (at least 10% reduction in coordinate count)
        simplified_geojson = mapping(simplified)
        simplified_coords = count_coordinates(simplified_geojson)

        if simplified_coords < coord_count * 0.9:  # At least 10% reduction
            feature["geometry"] = simplified_geojson
            # Optionally track simplification stats
            # feature["_simplified"] = {
            #     "original": coord_count,
            #     "simplified": simplified_coords,
            #     "reduction": round((1 - simplified_coords / coord_count) * 100, 1)
            # }

    except Exception:
        # If simplification fails for any reason, keep original geometry
        # This handles edge cases like invalid geometries, self-intersections, etc.
        pass

    return feature


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

    # Cache commonly accessed properties to avoid repeated dict lookups
    landuse = props.get("landuse")
    natural = props.get("natural")
    waterway = props.get("waterway")
    building = props.get("building")
    highway = props.get("highway")
    railway = props.get("railway")
    leisure = props.get("leisure")

    is_polygon = geom_type in POLYGON_TYPES

    # Parks and green spaces (only polygons)
    if (leisure == "park" or landuse in PARK_LANDUSE) and is_polygon:
        return {
            "layer": "natural_background",
            "color": {"r": 200, "g": 230, "b": 180, "a": 255},
            "minLOD": 1,
            "fill": True,
        }

    # Agricultural land (only polygons)
    if landuse in FARM_LANDUSE and is_polygon:
        return {
            "layer": "natural_background",
            "color": {"r": 238, "g": 240, "b": 213, "a": 255},
            "minLOD": 1,
            "fill": True,
        }

    # Forests and woods (only polygons)
    if (landuse == "forest" or natural == "wood") and is_polygon:
        return {
            "layer": "forests",
            "color": {"r": 173, "g": 209, "b": 158, "a": 255},
            "minLOD": 0,
            "fill": True,
        }

    # Water bodies (only polygons - including coastline for sea/ocean areas)
    if (
        natural == "water"
        or props.get("water")
        or waterway == "riverbank"
        or natural == "coastline"
        or landuse in WATER_LANDUSE
    ) and is_polygon:
        return {
            "layer": "water_areas",
            "color": {"r": 170, "g": 211, "b": 223, "a": 255},
            "minLOD": 0,
            "fill": True,
        }

    # Rivers and streams as lines
    if waterway and waterway != "riverbank":
        importance = 1 if waterway in MAJOR_WATERWAYS else 2
        return {
            "layer": "waterways",
            "color": {"r": 170, "g": 211, "b": 223, "a": 255},
            "minLOD": importance,
            "fill": False,
        }

    # Cemeteries (subtle green-gray)
    if landuse in CEMETERY_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 205, "g": 220, "b": 200, "a": 255},
            "minLOD": 1,
            "fill": True,
        }

    # Allotments/community gardens (lighter green than parks)
    if landuse in ALLOTMENT_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 220, "g": 235, "b": 210, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Railway yards and infrastructure
    if landuse in RAILWAY_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 210, "g": 205, "b": 210, "a": 255},  # Light purple-gray
            "minLOD": 1,
            "fill": True,
        }

    # Construction, brownfield, greenfield (orange-brown tint)
    if landuse in CONSTRUCTION_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 235, "g": 220, "b": 200, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Military (red-brown)
    if landuse in MILITARY_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 235, "g": 215, "b": 215, "a": 255},  # Light red-brown
            "minLOD": 1,
            "fill": True,
        }

    # Education (yellow-tan)
    if landuse in EDUCATION_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 245, "g": 235, "b": 210, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Religious (light purple)
    if landuse in RELIGIOUS_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 225, "g": 220, "b": 230, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Quarries and landfills (gray-brown)
    if landuse in QUARRY_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 210, "g": 200, "b": 190, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Landuse areas (only polygons) - show at same LOD as tertiary roads
    if landuse == "residential" and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 224, "g": 224, "b": 224, "a": 255},  # Light gray
            "minLOD": 1,
            "fill": True,
        }

    if landuse in COMMERCIAL_LANDUSE and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 243, "g": 233, "b": 234, "a": 255},
            "minLOD": 1,
            "fill": True,
        }

    if landuse == "industrial" and is_polygon:
        return {
            "layer": "landuse_areas",
            "color": {"r": 240, "g": 233, "b": 240, "a": 255},
            "minLOD": 1,
            "fill": True,
        }

    # Buildings (only polygons - filter out LineString building outlines)
    if building and is_polygon:
        return {
            "layer": "areas",
            "color": {"r": 218, "g": 208, "b": 200, "a": 255},
            "minLOD": 2,
            "fill": True,
        }

    # Remap construction roads to their target type for render metadata
    effective_highway = highway
    if effective_highway == "construction":
        construction = props.get("construction")
        if construction:
            effective_highway = construction

    # Major highways (motorway, trunk, primary/Bundesstraßen)
    if effective_highway in MAJOR_HIGHWAYS:
        # Motorways/trunk get red-orange, primary/Bundesstraßen get orange-yellow
        if effective_highway in ["motorway", "trunk"]:
            color = {"r": 233, "g": 115, "b": 103, "a": 255}  # Red-orange
            priority = 1
        else:  # primary
            color = {"r": 252, "g": 214, "b": 164, "a": 255}  # Orange-yellow
            priority = 2
        return {
            "layer": "major_roads",
            "color": color,
            "minLOD": 0,  # All major highways visible at all zoom levels
            "fill": False,
            "name": props.get("name", ""),
            "name_priority": priority,
        }

    # Secondary roads
    if effective_highway in SECONDARY_HIGHWAYS:
        return {
            "layer": "major_roads",
            "color": {"r": 252, "g": 214, "b": 164, "a": 255},
            "minLOD": 1,
            "fill": False,
            "name": props.get("name", ""),
            "name_priority": 3,
        }

    # Tertiary and residential roads
    if effective_highway in TERTIARY_RESIDENTIAL_HIGHWAYS:
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

    # Coastline (for visualization and debugging)
    if natural == "coastline" and not is_polygon:
        return {
            "layer": "coastline",
            "color": {"r": 255, "g": 0, "b": 255, "a": 255},  # Magenta
            "minLOD": 0,
            "fill": False,
            "width": 3,
            "showDirection": True,  # Draw direction arrows
        }

    # Country borders (admin_level=2)
    if props.get("boundary") == "administrative" and props.get("admin_level") == "2":
        return {
            "layer": "boundaries",
            "color": {"r": 128, "g": 0, "b": 128, "a": 255},  # Purple
            "minLOD": 0,
            "fill": False,
        }

    # Railways (long distance/regional at LOD 0, subway/tram at LOD 2)
    if railway and geom_type != "Point":
        if railway in MAJOR_RAIL or not railway:
            return {
                "layer": "railways",
                "color": {"r": 153, "g": 153, "b": 153, "a": 255},
                "minLOD": 0,  # Long distance/regional rail visible at all zoom levels
                "fill": False,
            }
        elif railway in MEDIUM_RAIL:
            return {
                "layer": "railways",
                "color": {"r": 153, "g": 153, "b": 153, "a": 255},
                "minLOD": 1,  # Subway/light rail at medium zoom
                "fill": False,
            }
        elif railway in MINOR_RAIL:
            return {
                "layer": "railways",
                "color": {"r": 153, "g": 153, "b": 153, "a": 255},
                "minLOD": 2,  # Trams and minor rail only at closer zoom
                "fill": False,
            }

    # Place names (cities, towns, villages, suburbs, etc.) - rendered as labels
    if geom_type == "Point" and props.get("place") and props.get("name"):
        place_type = props.get("place")
        population = props.get("population")

        # Parse population if available (helps with prioritization)
        pop_value = 0
        if population:
            try:
                pop_value = int(population)
            except (ValueError, TypeError):
                pass

        # Classify place importance based on type and population
        # minLOD: 0 = always visible (>20km view), 1 = medium zoom (7.5-20km),
        #         2 = zoomed in (3-7.5km), 3 = more zoomed (1-3km), 4 = very zoomed (<1km)
        if place_type == "city":
            minLOD = 0  # Cities always visible
            priority = 1  # Highest priority
            font_size = 18
        elif place_type == "town":
            # Large towns (>50k) visible at all zooms, smaller towns at medium zoom
            if pop_value >= 50000:
                minLOD = 0
                priority = 2
            else:
                minLOD = 1
                priority = 3
            font_size = 16
        elif place_type == "village":
            # Large villages (>5k) at medium zoom, smaller at zoomed in
            if pop_value >= 5000:
                minLOD = 1
                priority = 4
            else:
                minLOD = 2
                priority = 5
            font_size = 14
        elif (
            place_type == "suburb" or place_type == "borough" or place_type == "quarter"
        ):
            minLOD = 2  # Suburbs/boroughs visible when zoomed in
            priority = 6
            font_size = 13
        elif place_type == "hamlet" or place_type == "neighbourhood":
            minLOD = 3  # Hamlets/neighborhoods at close zoom
            priority = 7
            font_size = 12
        elif place_type == "locality" or place_type == "isolated_dwelling":
            minLOD = 4  # Localities/isolated at very close zoom
            priority = 8
            font_size = 11
        else:
            # Unknown place type - show at close zoom
            minLOD = 3
            priority = 9
            font_size = 12

        return {
            "layer": "place_labels",
            "color": {"r": 0, "g": 0, "b": 0, "a": 255},  # Black text
            "minLOD": minLOD,
            "fill": False,
            "placeType": place_type,
            "placePriority": priority,
            "fontSize": font_size,
            "population": pop_value,
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


def open_zoom_db(db_dir, zoom, fingerprint=None, db_prefix="tile_build"):
    """Open (or create) a per-zoom SQLite database. Returns (conn, is_cached)."""
    db_path = db_dir / f"{db_prefix}_z{zoom}.db"

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
    conn.execute("PRAGMA cache_size=-64000")  # 64MB cache
    conn.execute("PRAGMA temp_store=MEMORY")
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


def split_geojson_into_tiles(
    geojson_file,
    output_dir,
    zoom_levels,
    source_pbf_file=None,
    db_prefix=None,
):
    """Split GeoJSON into tiles using per-zoom SQLite databases.

    Args:
        geojson_file: Path to temporary GeoJSON file to process
        output_dir: Directory to write tiles to
        zoom_levels: List of zoom levels to generate
        source_pbf_file: Path to source OSM PBF file (used for fingerprinting and bounds extraction)
        db_prefix: Optional prefix for database files (defaults to PBF filename or geojson filename)
    """

    # Determine database directory and fingerprint source
    if source_pbf_file:
        db_dir = Path(source_pbf_file).parent
        fingerprint = get_input_fingerprint(source_pbf_file)
    else:
        db_dir = Path(geojson_file).parent
        fingerprint = get_input_fingerprint(geojson_file)

    # Use PBF/GeoJSON filename (without extension) as db_prefix if not provided
    if db_prefix is None:
        db_prefix = (
            Path(source_pbf_file).stem if source_pbf_file else Path(geojson_file).stem
        )

    # Open per-zoom databases, check which ones can be reused
    zoom_dbs = {}
    need_import = False
    for zoom in zoom_levels:
        conn, cached = open_zoom_db(db_dir, zoom, fingerprint, db_prefix)
        zoom_dbs[zoom] = conn
        if not cached:
            need_import = True

    if not need_import:
        # Retrieve bounds from cached database metadata
        actual_bounds = None
        try:
            row = (
                zoom_dbs[zoom_levels[0]]
                .execute("SELECT value FROM metadata WHERE key='bounds'")
                .fetchone()
            )
            if row:
                actual_bounds = json.loads(row[0])
        except:
            pass

        # If bounds not in metadata (old database), get from PBF file
        if actual_bounds is None:
            if source_pbf_file and Path(source_pbf_file).suffix == ".pbf":
                actual_bounds = get_pbf_bounds(source_pbf_file)

            if actual_bounds:
                # Store bounds in metadata for future use
                bounds_json = json.dumps(actual_bounds)
                zoom_dbs[zoom_levels[0]].execute(
                    "INSERT OR REPLACE INTO metadata VALUES ('bounds', ?)",
                    (bounds_json,),
                )
                zoom_dbs[zoom_levels[0]].commit()
            else:
                raise ValueError(
                    f"Could not retrieve bounds from cached database or PBF file. "
                    f"source_pbf_file={source_pbf_file}"
                )
    else:
        # If any zoom needs rebuilding, rebuild all for consistency
        for zoom in zoom_levels:
            zoom_dbs[zoom].close()
            conn, _ = open_zoom_db(db_dir, zoom, db_prefix=db_prefix)
            zoom_dbs[zoom] = conn

        # Pass 1: Stream features into per-zoom SQLite databases
        stats = defaultdict(int)
        i = 0
        batches = {zoom: [] for zoom in zoom_levels}
        BATCH_SIZE = 50000

        # Get bounds from PBF header
        # Features may reference nodes outside the region for complete relations
        if source_pbf_file and Path(source_pbf_file).suffix == ".pbf":
            pbf_bounds = get_pbf_bounds(source_pbf_file)
            if not pbf_bounds:
                raise ValueError(
                    f"Could not extract bounds from PBF file {source_pbf_file}. "
                    "Ensure osmium-tool is installed and the PBF file is valid."
                )
            actual_bounds = pbf_bounds
        else:
            raise ValueError(
                f"Must provide source_pbf_file. source_pbf_file={source_pbf_file}"
            )

        # Get file size for progress tracking
        file_size = os.path.getsize(geojson_file)
        start_time = time.time()
        last_update = start_time
        last_count = 0
        update_interval = 1.2  # seconds
        next_check_at = 75  # Target iteration to check and update

        # Rolling window for rate calculation (keep last 5 samples)
        rate_history = []  # List of (elapsed_time, items_processed) tuples
        max_history = 5

        with open(geojson_file, "rb") as f:
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
                        # Clamp between 1000 and 500000 to avoid too frequent or too rare checks
                        estimated_features = max(1000, min(500000, estimated_features))
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

                # Get feature bounds only for tile assignment and optimization
                # Never use these to update the overall bounding box (use PBF bounds instead)
                feature_bounds = get_feature_bounds(feature)

                # Adjust minLOD based on feature size for better LOD filtering
                # Small features should have higher minLOD (only visible when zoomed in)
                min_lod = render_meta["minLOD"]
                layer = render_meta.get("layer")

                # Size-based LOD adjustment for forests and water bodies
                if layer in ["forests", "water_areas"] and feature_bounds:
                    # Calculate approximate area in square degrees
                    width = feature_bounds["maxLon"] - feature_bounds["minLon"]
                    height = feature_bounds["maxLat"] - feature_bounds["minLat"]
                    area = width * height

                    # Area thresholds (in square degrees, ~0.01 deg ≈ 1km at this latitude)
                    # Large features (>1km²): minLOD 0 (always visible)
                    # Medium features (0.01-1km²): minLOD 1 (visible from 7.5km+)
                    # Small features (<0.01km²): minLOD 2 (visible from 3km+)
                    if area < 0.0001:  # ~100m x 100m = 0.01km²
                        min_lod = max(min_lod, 2)  # Only show when zoomed in
                    elif area < 0.01:  # ~1km x 1km = 1km²
                        min_lod = max(min_lod, 1)  # Show at medium zoom
                    # else: keep original minLOD (usually 0 for large features)

                # Update the render metadata with adjusted minLOD
                render_meta["minLOD"] = min_lod
                _, importance = classify_feature_importance(props, geom_type)

                # Optimize tile assignments based on when features are actually rendered
                # Use pre-allocated tuples instead of creating lists
                if min_lod == 0:
                    target_zooms = LOD_0_ZOOMS
                elif min_lod == 1:
                    target_zooms = LOD_1_ZOOMS
                elif min_lod == 2:
                    target_zooms = LOD_2_ZOOMS
                elif min_lod == 3:
                    target_zooms = LOD_3_ZOOMS
                else:  # min_lod >= 4
                    target_zooms = LOD_4_ZOOMS

                # Simplify geometry per zoom level and serialize
                # Each zoom level gets appropriately simplified geometry
                for zoom in target_zooms:
                    # Create a copy of the feature and simplify for this zoom level
                    zoom_feature = copy.deepcopy(feature)
                    zoom_feature = simplify_feature_for_zoom(
                        zoom_feature, zoom, min_lod
                    )

                    # Serialize simplified feature for this zoom
                    feature_json = json.dumps(
                        zoom_feature, separators=(",", ":"), default=decimal_default
                    )

                    # Get tiles using simplified geometry
                    feature_tiles = get_tiles_for_feature(zoom_feature, zoom)
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

        # Final progress line (clear the line first)
        print(
            f"\r  Processed {i:,} features in {time.time() - start_time:.0f}s ({db_prefix})"
            + " " * 40
        )

        # Create indexes for fast reads in Pass 2

        # Store bounds in metadata for cache reuse
        bounds_json = json.dumps(actual_bounds)

        for zoom in zoom_levels:
            conn = zoom_dbs[zoom]
            conn.execute(
                "CREATE INDEX idx_tile ON tile_features (x, y, importance DESC)"
            )
            conn.execute(
                "INSERT INTO metadata VALUES ('fingerprint', ?)", (fingerprint,)
            )
            conn.execute("INSERT INTO metadata VALUES ('bounds', ?)", (bounds_json,))
            conn.commit()

    # Pass 2: Write tiles from each zoom database
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
    update_interval = 1.2  # seconds
    next_tile_check_at = 12  # Target tile count to check and update

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

                    # Merge with existing tile if it exists
                    existing_features = []
                    if tile_file.exists():
                        try:
                            with open(tile_file, "r", encoding="utf-8") as f:
                                existing_tile = json.load(f)
                                existing_features = [
                                    json.dumps(feat, separators=(",", ":"))
                                    for feat in existing_tile.get("features", [])
                                ]
                        except:
                            pass  # If read fails, just overwrite

                    # Combine existing and new features
                    all_features = existing_features + feature_jsons

                    with open(tile_file, "w", encoding="utf-8") as f:
                        f.write('{"type":"FeatureCollection","features":[')
                        f.write(",".join(all_features))
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
                            # Clamp between 10 and 10000 to avoid too frequent or too rare checks
                            estimated_tiles = max(10, min(10000, estimated_tiles))
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

            # Merge with existing tile if it exists
            existing_features = []
            if tile_file.exists():
                try:
                    with open(tile_file, "r", encoding="utf-8") as f:
                        existing_tile = json.load(f)
                        existing_features = [
                            json.dumps(feat, separators=(",", ":"))
                            for feat in existing_tile.get("features", [])
                        ]
                except:
                    pass  # If read fails, just overwrite

            # Combine and deduplicate features
            # Use a set to track seen features (by their JSON string)
            seen = set()
            all_features = []
            for feat_str in existing_features + feature_jsons:
                if feat_str not in seen:
                    seen.add(feat_str)
                    all_features.append(feat_str)

            # Analyze tile content for metadata and generate land polygon if needed
            has_coastline = False
            has_land_features = False
            coastline_features = []

            for feature_str in all_features:
                try:
                    feat = json.loads(feature_str)
                    props = feat.get("properties", {})

                    # Check for coastline
                    if props.get("natural") == "coastline":
                        has_coastline = True
                        coastline_features.append(feat)

                    # Check for land features
                    if (
                        props.get("highway")
                        or props.get("building")
                        or props.get("landuse")
                        or props.get("railway")
                        or props.get("amenity")
                        or props.get("shop")
                        or (
                            props.get("natural")
                            and props.get("natural") not in ["coastline", "water"]
                        )
                    ):
                        has_land_features = True
                except:
                    pass

            # Write tile with metadata
            with open(tile_file, "w", encoding="utf-8") as f:
                f.write('{"type":"FeatureCollection",')
                f.write('"_meta":{"hasCoastline":')
                f.write("true" if has_coastline else "false")
                f.write(',"hasLandFeatures":')
                f.write("true" if has_land_features else "false")
                f.write('},"features":[')
                f.write(",".join(all_features))
                f.write("]}")
            tile_count += 1

        conn.close()

    # Final tile writing summary (clear the line first)
    write_elapsed = time.time() - write_start
    print(f"\r  Created {tile_count:,} tiles in {write_elapsed:.0f}s" + " " * 60)

    # Return actual bounds from PBF file (never calculated from features)
    return actual_bounds


# ============================================================================
# STEP 3: TILE GENERATION ORCHESTRATION
# ============================================================================


def write_tiles_from_databases(db_dir, db_prefix, zoom_levels, output_dir):
    """Write tile JSON files from existing SQLite databases."""
    output_path = Path(output_dir)

    for zoom in zoom_levels:
        db_path = db_dir / f"{db_prefix}_z{zoom}.db"
        if not db_path.exists():
            continue

        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT x, y, feature_json FROM tile_features ORDER BY x, y, importance DESC"
        )

        created_dirs = set()
        current_tile = None
        feature_jsons = []
        tile_count = 0

        for x, y, feature_json in cursor:
            tile_key = (x, y)
            if tile_key != current_tile:
                if current_tile is not None:
                    # Write previous tile
                    cx, cy = current_tile
                    tile_dir = output_path / str(zoom) / str(cx)
                    if cx not in created_dirs:
                        tile_dir.mkdir(parents=True, exist_ok=True)
                        created_dirs.add(cx)
                    tile_file = tile_dir / f"{cy}.json"

                    # Merge with existing tile if it exists (for border tiles between regions)
                    existing_features = []
                    if tile_file.exists():
                        try:
                            with open(tile_file, "r", encoding="utf-8") as f:
                                existing_tile = json.load(f)
                                existing_features = [
                                    json.dumps(feat, separators=(",", ":"))
                                    for feat in existing_tile.get("features", [])
                                ]
                        except:
                            pass  # If read fails, just overwrite

                    # Combine and deduplicate features
                    seen = set()
                    merged_features = []
                    for feat_str in existing_features + feature_jsons:
                        if feat_str not in seen:
                            seen.add(feat_str)
                            merged_features.append(feat_str)

                    # Analyze tile content and generate land polygon if needed
                    has_coastline = False
                    has_land_features = False
                    coastline_features = []

                    for feature_str in merged_features:
                        try:
                            feat = json.loads(feature_str)
                            props = feat.get("properties", {})

                            if props.get("natural") == "coastline":
                                has_coastline = True
                                coastline_features.append(feat)

                            if (
                                props.get("highway")
                                or props.get("building")
                                or props.get("landuse")
                                or props.get("railway")
                                or props.get("amenity")
                                or props.get("shop")
                                or (
                                    props.get("natural")
                                    and props.get("natural")
                                    not in ["coastline", "water"]
                                )
                            ):
                                has_land_features = True

                            # Continue scanning to collect all coastline features
                        except:
                            pass

                    with open(tile_file, "w", encoding="utf-8") as f:
                        f.write('{"type":"FeatureCollection",')
                        f.write('"_meta":{"hasCoastline":')
                        f.write("true" if has_coastline else "false")
                        f.write(',"hasLandFeatures":')
                        f.write("true" if has_land_features else "false")
                        f.write('},"features":[')
                        f.write(",".join(merged_features))
                        f.write("]}")
                    tile_count += 1

                current_tile = tile_key
                feature_jsons = []
            feature_jsons.append(feature_json)

        # Write last tile
        if current_tile is not None:
            cx, cy = current_tile
            tile_dir = output_path / str(zoom) / str(cx)
            if cx not in created_dirs:
                tile_dir.mkdir(parents=True, exist_ok=True)
                created_dirs.add(cx)
            tile_file = tile_dir / f"{cy}.json"

            # Merge with existing tile if it exists (for border tiles between regions)
            existing_features = []
            if tile_file.exists():
                try:
                    with open(tile_file, "r", encoding="utf-8") as f:
                        existing_tile = json.load(f)
                        existing_features = [
                            json.dumps(feat, separators=(",", ":"))
                            for feat in existing_tile.get("features", [])
                        ]
                except:
                    pass  # If read fails, just overwrite

            # Combine and deduplicate features
            seen = set()
            merged_features = []
            for feat_str in existing_features + feature_jsons:
                if feat_str not in seen:
                    seen.add(feat_str)
                    merged_features.append(feat_str)

            # Analyze and write with metadata
            has_coastline = False
            has_land_features = False
            coastline_features = []

            for feature_str in merged_features:
                try:
                    feat = json.loads(feature_str)
                    props = feat.get("properties", {})

                    if props.get("natural") == "coastline":
                        has_coastline = True
                        coastline_features.append(feat)

                    if (
                        props.get("highway")
                        or props.get("building")
                        or props.get("landuse")
                        or props.get("railway")
                        or props.get("amenity")
                        or props.get("shop")
                        or (
                            props.get("natural")
                            and props.get("natural") not in ["coastline", "water"]
                        )
                    ):
                        has_land_features = True

                    # Continue scanning to collect all coastline features
                except:
                    pass

            with open(tile_file, "w", encoding="utf-8") as f:
                f.write('{"type":"FeatureCollection",')
                f.write('"_meta":{"hasCoastline":')
                f.write("true" if has_coastline else "false")
                f.write(',"hasLandFeatures":')
                f.write("true" if has_land_features else "false")
                f.write('},"features":[')
                f.write(",".join(merged_features))
                f.write("]}")
            tile_count += 1

        conn.close()
        print(f"  Z{zoom}: {tile_count:,} tiles")


def process_geojson_to_tiles(args):
    """Process a single GeoJSON file into tiles."""
    geojson_file, output_dir, zoom_levels, source_file = args

    geojson_path = Path(geojson_file)
    source_path = Path(source_file) if source_file else geojson_path

    try:
        bounds = split_geojson_into_tiles(
            str(geojson_file),
            output_dir,
            zoom_levels,
            source_pbf_file=str(source_path),
            db_prefix=geojson_path.stem,
        )

        return {"name": geojson_path.name, "status": "success", "bounds": bounds}

    except Exception as e:
        import traceback

        return {
            "name": geojson_path.name,
            "status": "failed",
            "error": str(e) + "\n" + traceback.format_exc(),
        }


def feature_intersects_bounds(feature, bbox):
    """Check if a feature intersects with the given bounding box."""
    coords = feature["geometry"]["coordinates"]
    geom_type = feature["geometry"]["type"]

    def coord_in_bbox(lon, lat):
        return (
            bbox["minLon"] <= lon <= bbox["maxLon"]
            and bbox["minLat"] <= lat <= bbox["maxLat"]
        )

    # Quick check: see if any coordinate is within the bbox
    if geom_type == "Point":
        return coord_in_bbox(coords[0], coords[1])
    elif geom_type == "LineString":
        return any(coord_in_bbox(c[0], c[1]) for c in coords)
    elif geom_type == "Polygon":
        # Check outer ring
        return any(coord_in_bbox(c[0], c[1]) for c in coords[0])
    elif geom_type == "MultiPolygon":
        # Check first ring of each polygon
        return any(coord_in_bbox(c[0], c[1]) for polygon in coords for c in polygon[0])
    elif geom_type == "MultiLineString":
        return any(coord_in_bbox(c[0], c[1]) for line in coords for c in line)

    return False


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
        "--zoom-levels",
        type=int,
        nargs="+",
        default=[3, 5, 8, 11, 14],
        help="Zoom levels to generate",
    )
    parser.add_argument(
        "-j",
        "--jobs",
        type=int,
        default=3,
        help="Number of parallel tile generation processes",
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

        # Check which PBF files have valid cached databases
        files_to_process = []
        cached_pbf_files = []

        for pbf_file in pbf_files:
            # Check if all zoom databases exist with matching fingerprint
            db_prefix = pbf_file.stem
            fingerprint = get_input_fingerprint(str(pbf_file))

            all_cached = True
            for zoom in args.zoom_levels:
                db_path = args.data_dir / f"{db_prefix}_z{zoom}.db"
                if not db_path.exists():
                    all_cached = False
                    break

                # Check fingerprint
                try:
                    import sqlite3

                    conn = sqlite3.connect(str(db_path))
                    row = conn.execute(
                        "SELECT value FROM metadata WHERE key='fingerprint'"
                    ).fetchone()
                    conn.close()

                    if not row or row[0] != fingerprint:
                        all_cached = False
                        break
                except:
                    all_cached = False
                    break

            if all_cached:
                cached_pbf_files.append(pbf_file)
                print(f"  ✓ {pbf_file.name}: databases cached, skipping GeoJSON")
            else:
                # Need GeoJSON for this file
                geojson_file = pbf_file.parent / f"{pbf_file.stem}.geojson"
                if not geojson_file.exists():
                    print(
                        f"  ⚠ {pbf_file.name}: needs processing but {geojson_file.name} not found"
                    )
                    print("     Run 'just convert' first")
                    sys.exit(1)
                files_to_process.append(geojson_file)

        # Sort files by size (largest first) for efficient border tile merging
        # Larger datasets should be processed first, smaller ones merge into them
        if files_to_process:
            files_to_process.sort(key=lambda f: f.stat().st_size, reverse=True)
            print(
                f"\nWill process {len(files_to_process)} GeoJSON file(s) (databases not cached)"
            )
            print("  Processing order (largest to smallest):")
            for gj in files_to_process:
                size_mb = gj.stat().st_size / (1024 * 1024)
                name = gj.stem.replace("-latest.osm", "").replace("-", " ").title()
                print(f"    • {name} ({size_mb:.0f} MB)")

        # Sort cached files by size as well
        if cached_pbf_files:
            cached_pbf_files.sort(key=lambda f: f.stat().st_size, reverse=True)

        geojson_files = files_to_process

    print("=" * 70)
    print("Step 3: Generate Map Tiles")
    print("=" * 70)
    print()
    print("Configuration:")
    print(f"  Zoom levels: {', '.join(map(str, args.zoom_levels))}")
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
            # GeoJSON files are named like "hamburg-latest.osm.geojson"
            # PBF files are named like "hamburg-latest.osm.pbf"
            # So we need to replace .geojson with .pbf, not append .osm.pbf to stem
            pbf_file = gj.with_suffix(".pbf")
            source_file = str(pbf_file) if pbf_file.exists() else str(gj)
            tile_args.append(
                (str(gj), str(temp_tile_dir), args.zoom_levels, source_file)
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

    # Process cached databases - write tiles from existing databases
    if cached_pbf_files:
        print(f"\nProcessing {len(cached_pbf_files)} cached database(s) into tiles:")
        for pbf_file in cached_pbf_files:
            region_name = (
                pbf_file.stem.replace("-latest.osm", "").replace("-", " ").title()
            )
            print(f"  • {region_name}")
        print()

        # Write tiles from each cached database
        for pbf_file in cached_pbf_files:
            db_prefix = pbf_file.stem
            output_path = Path(str(temp_tile_dir))

            # Get bounds from PBF for this region
            bounds = get_pbf_bounds(pbf_file)

            # Write tiles from the cached databases
            print(f"Writing tiles for {pbf_file.stem}...")
            write_tiles_from_databases(
                args.data_dir, db_prefix, args.zoom_levels, output_path
            )

            all_results.append(
                {
                    "name": f"{pbf_file.stem}.geojson",
                    "status": "success",
                    "bounds": bounds,
                }
            )

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
            if "land" in name:
                print(f"  ✓ {name}")
            else:
                print(f"  ✓ {name.replace('-', ' ').title()}")
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
            len(list((temp_tile_dir / str(z)).rglob("*.json")))
            for z in args.zoom_levels
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
            "zoom_levels": sorted(args.zoom_levels),
            "tile_count": tile_count,
            "center": {
                "lon": HAMBURG_CENTER_LON,
                "lat": HAMBURG_CENTER_LAT,
            },
            "generated": int(time.time() * 1000),
        }

        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2)

        print()
        print("Finalizing tiles...")
        print(f"  ✓ Created index with {tile_count:,} tiles")
        print(
            f"  ✓ Bounds: {merged_bounds['minLat']:.2f}°N to {merged_bounds['maxLat']:.2f}°N, "
            f"{merged_bounds['minLon']:.2f}°E to {merged_bounds['maxLon']:.2f}°E"
        )

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

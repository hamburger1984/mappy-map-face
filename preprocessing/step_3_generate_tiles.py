#!/usr/bin/env python3
"""
Step 3: Generate map tiles from GeoJSON files.

This script processes GeoJSON files into tile format with parallel processing
and detailed progress reporting.
"""

import argparse
import copy
import decimal
import gzip
import json
import math
import os
import random
import shutil
import sys
import tempfile
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import Pool
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    print("Error: tqdm is required for progress bars")
    print("Install with: pip install tqdm")
    sys.exit(1)

from progress import is_interactive


def _log(msg: str) -> None:
    if is_interactive():
        print(msg)
    else:
        print(f"[step_3] {msg}", flush=True)


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

try:
    import orjson
except ImportError:
    print("Error: orjson is required for fast JSON serialization")
    print("Install with: pip install orjson")
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
    """Load tileset configuration from tileset_config.yaml.

    The path can be overridden via the TILESET_CONFIG_PATH environment variable,
    which is how the NixOS module passes a custom or store-managed config file.
    """
    env_path = os.environ.get("TILESET_CONFIG_PATH")
    config_path = env_path if env_path else os.path.join(os.path.dirname(__file__), "..", "tileset_config.yaml")
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

# Build simplification epsilon lookup per tileset (read from first feature)
TILESET_EPSILON = {}
for _ts in TILESETS:
    for _fd in _ts["features"]:
        _eps = _fd.get("simplification", {}).get("epsilon_m")
        if _eps:
            TILESET_EPSILON[_ts["id"]] = _eps
            break


def tile_set_bounds(tiles):
    """Return the geographic bounding box covering all (ts, x, y) tiles.

    Used to compute the correct bbox for land polygon loading: derived from
    the actual tile extents rather than region feature bounds, so tiles that
    extend beyond the region's feature footprint still get complete land data.
    Returns None if tiles is empty.
    """
    b = {"minLon": float("inf"), "maxLon": float("-inf"),
         "minLat": float("inf"), "maxLat": float("-inf")}
    for ts, x, y in tiles:
        size = TILESET_TILE_SIZES.get(ts, 50000)
        mn_lon, mn_lat, mx_lon, mx_lat = compute_tile_bounds(x, y, size)
        b["minLon"] = min(b["minLon"], mn_lon)
        b["maxLon"] = max(b["maxLon"], mx_lon)
        b["minLat"] = min(b["minLat"], mn_lat)
        b["maxLat"] = max(b["maxLat"], mx_lat)
    return b if b["minLon"] != float("inf") else None


# ============================================================================
# LAND POLYGON DATA (pre-computed authoritative land polygons)
# ============================================================================

# Land background color (matches map_theme.js background.land)
LAND_BG_COLOR = [242, 239, 233, 255]


def load_land_polygons(data_dir: Path, bbox=None):
    """Load land polygon GeoJSON and build a Shapely STRtree for fast lookup.

    bbox: optional dict {minLon, minLat, maxLon, maxLat} to filter features.
    Returns (geoms, tree) or (None, None) if file not available.
    """
    try:
        from shapely.geometry import box, shape
        from shapely.strtree import STRtree
    except ImportError:
        return None, None

    geojson_path = data_dir / "global-land-polygons.geojson"
    if not geojson_path.exists():
        return None, None

    filter_box = None
    if bbox:
        filter_box = box(bbox["minLon"], bbox["minLat"], bbox["maxLon"], bbox["maxLat"])

    region_desc = (
        f"{bbox['minLon']:.1f},{bbox['minLat']:.1f} → {bbox['maxLon']:.1f},{bbox['maxLat']:.1f}"
        if bbox else "global"
    )
    print(f"  Loading land polygons ({region_desc})...")
    geoms = []
    try:
        # Stream with ijson to handle the large global file
        with open(geojson_path, "rb") as f:
            for feat in ijson.items(f, "features.item"):
                try:
                    geom = shape(feat["geometry"])
                    if filter_box is not None and not geom.intersects(filter_box):
                        continue
                    geoms.append(geom)
                except Exception:
                    continue
        tree = STRtree(geoms)
        print(f"  Loaded {len(geoms)} land polygons")
        return geoms, tree
    except Exception as e:
        print(f"  Warning: could not load land polygons: {e}")
        return None, None


# Limit processing to these regions (substring match on PBF filename).
# Set to None to process all regions found in data dir.
#ACTIVE_REGIONS = {"hamburg", "schleswig-holstein"}
ACTIVE_REGIONS = None

# Module-level land polygon index (lazy — initialized per worker via init_land_polygons)
_DATA_DIR = Path(__file__).parent / "data"
LAND_POLYGON_GEOMS = None
LAND_POLYGON_TREE = None


def init_land_polygons(data_dir: Path, bbox=None):
    """Initialize the land polygon index if not already loaded.

    Called once per worker process before tile finalization, filtered to bbox.
    """
    global LAND_POLYGON_GEOMS, LAND_POLYGON_TREE
    if LAND_POLYGON_TREE is not None:
        return
    LAND_POLYGON_GEOMS, LAND_POLYGON_TREE = load_land_polygons(data_dir, bbox)


# ============================================================================
# POI CLASSIFICATION (mirrors classifyPOI in map_renderer.js)
# ============================================================================

# POI amenity → category priority order (highest specificity first)
_POI_AMENITY_PRIORITY = [
    "cafe", "ice_cream", "bakery", "restaurant", "nightlife",
    "health", "education", "theatre", "cinema", "police", "bank", "library",
    "services", "transport", "toilets",
]

_POI_AMENITY_MAP = {
    "cafe": "cafe",
    "ice_cream": "ice_cream",
    "bakery": "bakery",
    "pastry": "bakery",
    "restaurant": "restaurant",
    "fast_food": "restaurant",
    "food_court": "restaurant",
    "bbq": "restaurant",
    "bar": "nightlife",
    "pub": "nightlife",
    "nightclub": "nightlife",
    "biergarten": "nightlife",
    "casino": "nightlife",
    "gambling": "nightlife",
    "hookah_lounge": "nightlife",
    "doctors": "health",
    "dentist": "health",
    "pharmacy": "health",
    "hospital": "health",
    "clinic": "health",
    "veterinary": "health",
    "nursing_home": "health",
    "theatre": "theatre",
    "cinema": "cinema",
    "police": "police",
    "bank": "bank",
    "atm": "bank",
    "bureau_de_change": "bank",
    "library": "library",
    "kindergarten": "education",
    "school": "education",
    "university": "education",
    "college": "education",
    "music_school": "education",
    "language_school": "education",
    "training": "education",
    "post_office": "services",
    "fire_station": "services",
    "townhall": "services",
    "courthouse": "services",
    "embassy": "services",
    "community_centre": "services",
    "social_facility": "services",
    "place_of_worship": "services",
    "arts_centre": "services",
    "driving_school": "services",
    "recycling": "services",
    "post_box": "services",
    "events_venue": "services",
    "childcare": "services",
    "bicycle_rental": "transport",
    "parking": "transport",
    "parking_entrance": "transport",
    "fuel": "transport",
    "charging_station": "transport",
    "car_sharing": "transport",
    "taxi": "transport",
    "bus_station": "transport",
    "ferry_terminal": "transport",
    "car_rental": "transport",
    "boat_rental": "transport",
    "toilets": "toilets",
    "public_bath": "swimming",
    "sauna": "swimming",
    "marketplace": "shopping",
    "vending_machine": "shopping",
}

_POI_SHOP_MAP = {
    "coffee": "cafe",
    "tea": "cafe",
    "deli": "restaurant",
    "confectionery": "restaurant",
    "butcher": "restaurant",
    "cheese": "restaurant",
    "seafood": "restaurant",
    "wine": "restaurant",
    "beverages": "restaurant",
    "alcohol": "restaurant",
    "bakery": "bakery",
    "pastry": "bakery",
    "ice_cream": "ice_cream",
    "supermarket": "supermarket",
    "convenience": "supermarket",
}

_POI_LEISURE_MAP = {
    "swimming_pool": "swimming",
    "sauna": "swimming",
    "spa": "swimming",
    "water_park": "swimming",
}


def _classify_poi(props):
    """Classify a POI feature to a category string (mirrors JS classifyPOI)."""
    amenity = props.get("amenity")
    shop = props.get("shop")
    tourism = props.get("tourism")
    historic = props.get("historic")
    leisure = props.get("leisure")
    sport = props.get("sport")

    if amenity:
        cat = _POI_AMENITY_MAP.get(amenity)
        if cat:
            return cat
        return "services"  # fallback for unrecognized amenity

    if shop:
        cat = _POI_SHOP_MAP.get(shop)
        if cat:
            return cat
        return "shopping"  # fallback for unrecognized shop

    if tourism:
        return "tourism"

    if historic:
        return "historic"

    if leisure:
        cat = _POI_LEISURE_MAP.get(leisure)
        if cat:
            return cat

    if sport == "table_tennis":
        return "recreation"

    return None


# ============================================================================
# RENDER AUGMENTATION (computes dynamic _render fields from OSM properties)
# ============================================================================

# Highway type → (themeKey, roadPriority, minLOD, lane_width, default_lanes)
_HIGHWAY_ATTRS = {
    "motorway":      ("roads.motorway",    7, 0, 3.5, 4),
    "trunk":         ("roads.motorway",    7, 0, 3.5, 4),
    "motorway_link": ("roads.motorway",    7, 0, 3.5, 2),
    "trunk_link":    ("roads.motorway",    7, 0, 3.5, 2),
    "primary":       ("roads.primary",     6, 0, 3.5, 2),
    "primary_link":  ("roads.primary",     6, 0, 3.5, 1),
    "secondary":     ("roads.secondary",   5, 1, 3.5, 2),
    "secondary_link":("roads.secondary",   5, 1, 3.5, 1),
    "tertiary":      ("roads.tertiary",    4, 1, 3.0, 2),
    "tertiary_link": ("roads.tertiary",    4, 1, 3.0, 1),
    "residential":   ("roads.residential", 3, 2, 3.0, 1.666),
    "unclassified":  ("roads.residential", 3, 2, 3.0, 1.666),
    "living_street": ("roads.residential", 3, 2, 3.0, 1.5),
    "service":       ("roads.service",     2, 2, 2.8, 1.1),
    "busway":        ("roads.service",     2, 2, 3.0, 1),
    "raceway":       ("roads.service",     2, 2, 8.0, 2),
    "bridleway":     ("roads.footway",     0, 2, 2.5, 1),
}

_SKIP_HIGHWAY_TYPES = {
    "street_lamp", "traffic_signals", "crossing", "stop",
    "give_way", "speed_camera", "turning_circle", "mini_roundabout",
    "motorway_junction", "bus_stop",
}


def augment_render_from_props(render, props, geom_type):
    """Augment _render with computed attributes derived from OSM properties.

    Called immediately after copying the YAML render config to _render.
    Modifies render dict in-place.
    """
    is_line = geom_type in ("LineString", "MultiLineString")
    is_poly = geom_type in ("Polygon", "MultiPolygon")
    is_point = geom_type == "Point"

    # ── Highway features ─────────────────────────────────────────────────────
    highway = props.get("highway")
    if highway:
        if is_point or highway in _SKIP_HIGHWAY_TYPES:
            render["layer"] = None
            return

        # Remap construction/planned/proposed to effective type
        effective_highway = highway
        is_construction = False
        for tag in ("construction", "planned", "proposed"):
            if highway == tag and props.get(tag):
                effective_highway = props[tag]
                is_construction = True
                break

        if is_construction:
            render["isConstruction"] = True

        # Tunnel/bridge detection
        try:
            layer_val = int(props.get("layer", 0) or 0)
        except (ValueError, TypeError):
            layer_val = 0
        is_tunnel = props.get("tunnel") in ("yes", "true") or layer_val < 0
        is_bridge = props.get("bridge") in ("yes", "true") or (layer_val > 0 and not is_tunnel)

        # Determine attributes per highway type
        lane_width = None
        default_lanes = 1.0

        if effective_highway in _HIGHWAY_ATTRS:
            theme_key, road_priority, min_lod, lane_width, default_lanes = _HIGHWAY_ATTRS[effective_highway]
            # Only set themeKey if not already set by YAML template
            if not render.get("themeKey"):
                render["themeKey"] = theme_key
                render["roadPriority"] = road_priority
                render["minLOD"] = min_lod
            # Always update realWidthMeters (computed from lane data)
            try:
                lanes = float(props.get("lanes") or default_lanes)
            except (ValueError, TypeError):
                lanes = default_lanes
            render["realWidthMeters"] = lanes * lane_width

        elif effective_highway == "track":
            grade_str = props.get("tracktype", "grade1") or "grade1"
            try:
                grade = int(grade_str.replace("grade", ""))
            except (ValueError, TypeError):
                grade = 1
            if not render.get("themeKey"):
                render["themeKey"] = "roads.track"
            render["fixedWidthPx"] = render.get("fixedWidthPx", 1.5)
            render["dashPatternKey"] = render.get("dashPatternKey", "track")
            render["casingKey"] = render.get("casingKey", "roads.casing")
            render["minLOD"] = 3 if grade >= 4 else 2
            render["roadPriority"] = 1 if grade >= 4 else 2

        elif effective_highway in ("path", "footway", "pedestrian", "steps", "corridor"):
            bicycle = props.get("bicycle", "")
            bicycle_designated = bicycle in ("designated", "yes")
            foot_implied = effective_highway in ("path", "footway", "pedestrian")
            foot_accessible = (
                props.get("foot") in ("designated", "yes")
                or (foot_implied and props.get("foot") != "no")
            )
            if bicycle_designated and foot_accessible:
                render["themeKey"] = "roads.cycleway"
                render["dualDashKey"] = "roads.footway"
            elif bicycle_designated:
                render["themeKey"] = "roads.cycleway"
            else:
                render["themeKey"] = "roads.footway"
            render["fixedWidthPx"] = 1.5
            render["roadPriority"] = 0
            render["minLOD"] = 2
            if effective_highway in ("path", "footway", "pedestrian"):
                render["dashPatternKey"] = "footway"
                render["casingKey"] = "roads.casing"

        elif effective_highway == "cycleway":
            foot_accessible = props.get("foot") in ("designated", "yes")
            render["themeKey"] = "roads.cycleway"
            if foot_accessible:
                render["dualDashKey"] = "roads.footway"
            render["fixedWidthPx"] = 1.5
            render["dashPatternKey"] = "cycleway"
            render["casingKey"] = "roads.casing"
            render["roadPriority"] = 1
            render["minLOD"] = 2

        else:
            # Unknown highway type — skip rendering
            render["layer"] = None
            return

        # bicycle_road / cyclestreet overlay flag
        if props.get("bicycle_road") == "yes" or props.get("cyclestreet") == "yes":
            render["isBicycleRoad"] = True

        # Layer routing (tunnel → tunnels, bridge → bridge_roads, surface → surface_roads)
        is_step = effective_highway == "steps"
        if is_tunnel:
            render["layer"] = "steps" if is_step else "tunnels"
            render["tunnel"] = True
        elif is_bridge:
            render["layer"] = "steps" if is_step else "bridge_roads"
            render["bridgeLayer"] = layer_val or 1
        else:
            render["layer"] = "steps" if is_step else "surface_roads"
        return

    # ── Waterway features ─────────────────────────────────────────────────────
    waterway = props.get("waterway")
    if waterway and waterway != "riverbank":
        if waterway in ("river", "canal"):
            render["width"] = 3
            render["minLOD"] = 0
        elif waterway == "stream":
            render["width"] = 2
            render["borderWidth"] = 0.5
            render["borderColorKey"] = "water.border"
            render["minLOD"] = 1
        else:  # ditch, drain, etc.
            render["width"] = 1.5
            render["borderWidth"] = 0.5
            render["borderColorKey"] = "water.border"
            render["minLOD"] = 2

        # Named waterways get a water label
        if props.get("name"):
            render["waterLabel"] = {
                "name": props["name"],
                "waterType": waterway,
            }

        # Tunnel routing
        try:
            layer_val_w = int(props.get("layer", 0) or 0)
        except (ValueError, TypeError):
            layer_val_w = 0
        if props.get("tunnel") in ("yes", "true") or layer_val_w < 0:
            render["layer"] = "tunnel_waterways"
            render["tunnel"] = True
        return

    # ── Railway features ──────────────────────────────────────────────────────
    railway = props.get("railway")
    if railway and not is_point:
        # Platform handling
        if railway == "platform" or props.get("public_transport") == "platform":
            try:
                level_val = float(str(props.get("level", "0")).split(";")[0])
            except (ValueError, TypeError):
                level_val = 0
            try:
                layer_val_p = int(props.get("layer", 0) or 0)
            except (ValueError, TypeError):
                layer_val_p = 0
            is_underground = (
                level_val < 0
                or props.get("tunnel") == "yes"
                or props.get("indoor") == "yes"
                or layer_val_p < 0
            )
            render["isPlatform"] = True
            if is_poly:
                render["themeKey"] = "platforms.fill"
                if not is_underground:
                    render["strokeThemeKey"] = "platforms.stroke"
            else:
                render["themeKey"] = "platforms.line"
            return

        _RAIL_TRACK_TYPES = {
            "rail", "light_rail", "subway", "tram", "monorail",
            "narrow_gauge", "preserved", "funicular", "miniature",
            "construction", "planned", "proposed",
        }
        if railway not in _RAIL_TRACK_TYPES:
            return

        # Remap construction/planned/proposed
        effective_railway = railway
        is_planned = False
        for tag in ("construction", "planned", "proposed"):
            if railway == tag and props.get(tag):
                effective_railway = props[tag]
                is_planned = True
                break
            elif railway == tag:
                effective_railway = "rail"
                is_planned = True

        if is_planned:
            render["isConstruction"] = True
            render["themeKey"] = "railways.construction"
        else:
            if not render.get("themeKey"):
                render["themeKey"] = "railways.rail"

        render["isRailway"] = True

        # Width and minLOD per railway sub-type
        if effective_railway in ("tram", "funicular", "miniature"):
            render["realWidthMeters"] = 6.0
            render.setdefault("minLOD", 2)
        elif effective_railway in ("light_rail", "subway"):
            render["realWidthMeters"] = 6.0
            render.setdefault("minLOD", 1)
        elif effective_railway == "narrow_gauge":
            render["realWidthMeters"] = 6.0
            render.setdefault("minLOD", 0)
        else:
            render["realWidthMeters"] = 8.0
            render.setdefault("minLOD", 0)

        # Tunnel/bridge routing
        try:
            layer_val_r = int(props.get("layer", 0) or 0)
        except (ValueError, TypeError):
            layer_val_r = 0
        is_tunnel_r = props.get("tunnel") in ("yes", "true") or layer_val_r < 0
        is_bridge_r = props.get("bridge") in ("yes", "true") or (layer_val_r > 0 and not is_tunnel_r)

        if is_tunnel_r:
            render["layer"] = "tunnels"
            render["tunnel"] = True
        elif is_bridge_r:
            render["layer"] = "bridge_railways"
            render["bridgeLayer"] = layer_val_r or 1
        # else keep surface_railways from YAML
        return

    # ── Railway station points → place labels ─────────────────────────────────
    if railway in ("station", "halt") and is_point and props.get("name"):
        station_type = props.get("station", "")
        is_minor = (
            railway == "halt"
            or station_type in ("subway", "light_rail", "tram", "monorail", "funicular", "miniature")
        )
        is_main = props.get("usage") == "main" or station_type == "main"
        render["layer"] = "place_labels"
        render["themeKey"] = "text.places"
        render["placeType"] = "station"
        render["placePriority"] = 6 if is_minor else (4 if is_main else 8)
        render["fontSize"] = 10 if is_minor else 11
        render["minLOD"] = 1
        if is_minor:
            render["maxViewWidth"] = 1500
        return

    # ── Aeroway features ──────────────────────────────────────────────────────
    if props.get("aeroway") and props["aeroway"] == "runway":
        render["isRunway"] = True
        render["runwayRef"] = props.get("ref")
        render["runwayLit"] = props.get("lit") == "yes"
        return

    # ── Building features ─────────────────────────────────────────────────────
    if props.get("building"):
        building_type = props.get("building", "yes")
        _BTYPE_MAP = {
            "commercial": "buildings.commercial",
            "retail": "buildings.commercial",
            "supermarket": "buildings.commercial",
            "industrial": "buildings.industrial",
            "warehouse": "buildings.industrial",
            "public": "buildings.public",
            "civic": "buildings.public",
            "government": "buildings.public",
            "church": "buildings.religious",
            "cathedral": "buildings.religious",
            "mosque": "buildings.religious",
            "temple": "buildings.religious",
            "synagogue": "buildings.religious",
            "school": "buildings.education",
            "university": "buildings.education",
            "college": "buildings.education",
            "kindergarten": "buildings.education",
        }
        if building_type in _BTYPE_MAP:
            render["themeKey"] = _BTYPE_MAP[building_type]
        # else keep "buildings.default" from YAML

        housenumber = props.get("addr:housenumber")
        if housenumber:
            render["houseNumber"] = {
                "number": housenumber,
                "street": props.get("addr:street"),
            }
        return

    # ── Named water areas → waterLabel ────────────────────────────────────────
    if (
        props.get("natural") == "water"
        or props.get("landuse") in ("basin", "reservoir")
    ) and props.get("name") and is_poly:
        render["waterLabel"] = {
            "name": props["name"],
            "waterType": props.get("water") or props.get("natural") or "water",
        }
        return

    # ── Wetland sub-type overrides ────────────────────────────────────────────
    if props.get("natural") == "wetland":
        wtype = props.get("wetland")
        if wtype == "tidalflat":
            render["pattern"] = "wetland_tidal"
            # patternOnly: true already from YAML — ocean background shows through
        elif wtype in ("marsh", "bog", "fen", "wet_meadow", "dambo"):
            # Waterlogged land: solid blue-green background + horizontal water-hint lines
            render["themeKey"] = "natural.wetlandMarsh"
            render["pattern"] = "wetland_marsh"
            render["patternOnly"] = False
        # saltmarsh, mangrove, swamp, reedbed, unspecified: patternOnly from YAML
        return

    # ── Agriculture: override themeKey by landuse value ───────────────────────
    if render.get("layer") == "natural_background" and props.get("landuse") in (
        "farmland", "farmyard", "orchard", "vineyard", "plant_nursery", "greenhouse_horticulture",
        "meadow", "grass", "flowerbed",
    ):
        _AGR_MAP = {
            "farmland": "agriculture.farmland",
            "farmyard": "agriculture.farmland",
            "greenhouse_horticulture": "agriculture.farmland",
            "plant_nursery": "agriculture.orchard",
            "orchard": "agriculture.orchard",
            "vineyard": "agriculture.vineyard",
            "meadow": "natural.meadow",
            "grass": "natural.grass",
            "flowerbed": "agriculture.flowerbed",
        }
        landuse = props["landuse"]
        if landuse in _AGR_MAP:
            render["themeKey"] = _AGR_MAP[landuse]
        return

    # ── Sports pitches: override themeKey by sport ────────────────────────────
    if render.get("layer") == "landuse_areas" and props.get("leisure") == "pitch":
        sport = props.get("sport", "")
        if sport in ("basketball", "skateboard", "multi"):
            render["themeKey"] = "recreation.pitchHard"
        elif sport in ("soccer", "field_hockey", "rugby", "american_football"):
            render["themeKey"] = "recreation.pitchBall"
        else:
            render["themeKey"] = "recreation.pitchTennis"
        return

    # ── Sports facilities: areaPoiCategory for swimming ───────────────────────
    if render.get("layer") == "landuse_areas" and props.get("leisure") in (
        "sports_centre", "sports_hall", "track", "stadium"
    ):
        sport = props.get("sport", "")
        if sport in ("swimming", "diving", "water_polo"):
            render["areaPoiCategory"] = "swimming"
        return

    # ── POI point features ────────────────────────────────────────────────────
    if is_point and render.get("layer") == "points":
        if render.get("poiCategory"):
            return  # Already classified (e.g. toilets, table_tennis from YAML)
        cat = _classify_poi(props)
        if cat:
            render["poiCategory"] = cat
        else:
            render["layer"] = None  # Skip unrecognized POIs
        return

    # ── Place labels: add population ──────────────────────────────────────────
    if render.get("layer") == "place_labels" and props.get("population"):
        try:
            render["population"] = int(props["population"])
        except (ValueError, TypeError):
            pass


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


def _clip_linestring_extend_outside(coords, min_lon, min_lat, max_lon, max_lat):
    """
    Clip a single LineString to a bbox, including the first vertex outside
    the tile on each crossing so lines visually connect across tile boundaries.

    Returns a list of coordinate-list segments (each with >= 2 points).
    Empty list means the line has no overlap with this tile.

    NOTE: This is used as a fallback when Shapely is unavailable. It misses
    "skip segments" where both endpoints of an edge are outside the tile but
    the edge itself crosses the tile — use Shapely intersection as the primary.
    """
    def inside(p):
        return min_lon <= p[0] <= max_lon and min_lat <= p[1] <= max_lat

    n = len(coords)
    if n < 2:
        return []

    flags = [inside(p) for p in coords]

    # Include a vertex if it is inside the tile, or if it is immediately
    # adjacent to an inside vertex (= the first outside point on each crossing).
    def should_include(i):
        if flags[i]:
            return True
        if i > 0 and flags[i - 1]:
            return True
        if i < n - 1 and flags[i + 1]:
            return True
        return False

    included = [should_include(i) for i in range(n)]

    # Group contiguous included vertices into segments
    segments = []
    seg = []
    for i in range(n):
        if included[i]:
            seg.append(coords[i])
        else:
            if len(seg) >= 2:
                segments.append(seg)
            seg = []
    if len(seg) >= 2:
        segments.append(seg)

    return segments


def _extract_linestring_coords(shapely_geom):
    """
    Extract coordinate lists from a Shapely geometry, keeping only
    LineString/MultiLineString parts and discarding Point artifacts
    (which occur when a line touches a tile corner).

    Returns a list of coordinate lists (each with >= 2 points).
    """
    from shapely.geometry import LineString, MultiLineString, GeometryCollection

    geom_type = shapely_geom.geom_type
    if geom_type == "LineString":
        coords = list(shapely_geom.coords)
        return [coords] if len(coords) >= 2 else []
    elif geom_type == "MultiLineString":
        result = []
        for line in shapely_geom.geoms:
            coords = list(line.coords)
            if len(coords) >= 2:
                result.append(coords)
        return result
    elif geom_type == "GeometryCollection":
        result = []
        for geom in shapely_geom.geoms:
            result.extend(_extract_linestring_coords(geom))
        return result
    return []  # Point or other non-line geometry


def clip_feature_to_tile(feature, tile_x, tile_y, tile_size_m, buffer_pct=0.02):
    """
    Clip feature geometry to tile bounds with a small buffer.

    For LineString / MultiLineString the first vertex outside the tile is
    included on each boundary crossing so lines connect cleanly across tiles.
    For Polygon / MultiPolygon Shapely intersection is used unchanged.

    Args:
        feature: GeoJSON feature (will be modified in place)
        tile_x: Tile X index
        tile_y: Tile Y index
        tile_size_m: Tile size in meters
        buffer_pct: Buffer as fraction of tile size (0.02 = 2%)

    Returns:
        Clipped feature, or None if geometry is empty after clipping
    """
    geom = feature.get("geometry")
    if not geom or geom["type"] == "Point":
        return feature  # Points don't need clipping

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

    exact_min_lon = tile_x * tile_width_deg
    exact_min_lat = tile_y * tile_height_deg
    exact_max_lon = exact_min_lon + tile_width_deg
    exact_max_lat = exact_min_lat + tile_height_deg

    # Buffered bounds for polygon clipping (avoids seam artifacts at tile edges)
    buf_lon = tile_width_deg * buffer_pct
    buf_lat = tile_height_deg * buffer_pct
    min_lon = exact_min_lon - buf_lon
    min_lat = exact_min_lat - buf_lat
    max_lon = exact_max_lon + buf_lon
    max_lat = exact_max_lat + buf_lat

    geom_type = geom["type"]

    # --- LineString / MultiLineString: Shapely with exact bounds ---
    # Using exact (unbuffered) tile bounds ensures adjacent tiles clip to the
    # same geographic line with no overlap, so borders connect cleanly without
    # double-rendering. This also correctly handles "skip segments" — long edges
    # that cross the tile diagonally with no vertex inside — which the vertex-based
    # approach misses whenever other parts of the same feature are inside the tile.
    if geom_type in ("LineString", "MultiLineString"):
        try:
            from shapely.geometry import box, shape

            shapely_geom = shape(geom)
            tile_box = box(exact_min_lon, exact_min_lat, exact_max_lon, exact_max_lat)
            clipped = shapely_geom.intersection(tile_box)
            if clipped.is_empty:
                return None
            clipped_lines = _extract_linestring_coords(clipped)
            if not clipped_lines:
                return None
            if len(clipped_lines) == 1:
                feature["geometry"] = {"type": "LineString", "coordinates": clipped_lines[0]}
            else:
                feature["geometry"] = {"type": "MultiLineString", "coordinates": clipped_lines}
            return feature
        except Exception:
            pass

        # Fallback: vertex-based clip with outside extension (no Shapely dependency)
        coords = geom.get("coordinates", [])
        raw_lines = [coords] if geom_type == "LineString" else coords
        clipped_lines = []
        for line in raw_lines:
            clipped_lines.extend(
                _clip_linestring_extend_outside(line, min_lon, min_lat, max_lon, max_lat)
            )
        if not clipped_lines:
            return None
        if len(clipped_lines) == 1:
            feature["geometry"] = {"type": "LineString", "coordinates": clipped_lines[0]}
        else:
            feature["geometry"] = {"type": "MultiLineString", "coordinates": clipped_lines}
        return feature

    # --- Polygon / MultiPolygon: Shapely intersection (unchanged) ---
    try:
        from shapely.geometry import box, mapping, shape

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

    tile_height_deg = tile_size_m / 111320

    min_y = int(math.floor(bounds["minLat"] / tile_height_deg))
    max_y = int(math.floor(bounds["maxLat"] / tile_height_deg))

    # For each tile row use that row's center latitude to compute tile_width_deg,
    # matching compute_tile_bounds() exactly so features land in consistent tiles.
    tiles = []
    for y in range(min_y, max_y + 1):
        tile_center_lat = (y + 0.5) * tile_height_deg
        tile_width_deg = tile_size_m / (111320 * math.cos(math.radians(tile_center_lat)))
        min_x = int(math.floor(bounds["minLon"] / tile_width_deg))
        max_x = int(math.floor(bounds["maxLon"] / tile_width_deg))
        for x in range(min_x, max_x + 1):
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

    # Parks, green spaces, and camping areas
    if (leisure in ("park", "camp_site")
            or props.get("tourism") in ("camp_site", "caravan_site")
            or landuse in PARK_LANDUSE or landuse in FARM_LANDUSE):
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


def bounds_overlap(a, b):
    """Return True if two bounds dicts (minLon/maxLon/minLat/maxLat) overlap."""
    return (
        a["minLon"] < b["maxLon"]
        and a["maxLon"] > b["minLon"]
        and a["minLat"] < b["maxLat"]
        and a["maxLat"] > b["minLat"]
    )


def tiles_in_bounds(bounds, tile_size_m):
    """Return list of (x, y) tile coordinates covering the given bounds.

    Uses the same coordinate math as get_tiles_for_feature_in_tileset().
    """
    th = tile_size_m / 111320
    min_y = int(math.floor(bounds["minLat"] / th))
    max_y = int(math.floor(bounds["maxLat"] / th))
    result = []
    for y in range(min_y, max_y + 1):
        tile_center_lat = (y + 0.5) * th
        tw = tile_size_m / (111320 * math.cos(math.radians(tile_center_lat)))
        min_x = int(math.floor(bounds["minLon"] / tw))
        max_x = int(math.floor(bounds["maxLon"] / tw))
        for x in range(min_x, max_x + 1):
            result.append((x, y))
    return result


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


def build_land_polygon_for_tile(tile_x, tile_y, tile_size_m, epsilon_m=None, water_geom_dicts=None):
    """Clip the global land polygon dataset to this tile's bounds.

    water_geom_dicts: list of GeoJSON geometry dicts for water bodies in this tile.
    These are subtracted from the land polygon to fix misalignment between the land
    polygon dataset and OSM water features (e.g. river polygons not reaching tile edge).

    Returns a GeoJSON feature with layer='base_land', or None for pure ocean.
    """
    if LAND_POLYGON_TREE is None:
        return None

    from shapely.geometry import box, mapping, shape
    from shapely.ops import unary_union

    bounds = compute_tile_bounds(tile_x, tile_y, tile_size_m)
    min_lon, min_lat, max_lon, max_lat = bounds
    tile_box = box(min_lon, min_lat, max_lon, max_lat)

    # Query index for candidate polygons intersecting tile
    candidates = LAND_POLYGON_TREE.query(tile_box)
    if len(candidates) == 0:
        return None  # Pure ocean tile

    # Get intersecting geometries
    intersecting = [LAND_POLYGON_GEOMS[i] for i in candidates
                    if LAND_POLYGON_GEOMS[i].intersects(tile_box)]
    if not intersecting:
        return None

    # Union all land polygons and clip to tile
    try:
        if len(intersecting) == 1:
            land = intersecting[0].intersection(tile_box)
        else:
            land = unary_union(intersecting).intersection(tile_box)
    except Exception:
        return None

    if land.is_empty:
        return None

    # Subtract OSM water body polygons to fix misalignment with land polygon dataset
    if water_geom_dicts:
        try:
            water_geoms = []
            for gd in water_geom_dicts:
                try:
                    water_geoms.append(shape(gd))
                except Exception:
                    continue
            if water_geoms:
                water_union = unary_union(water_geoms)
                land = land.difference(water_union)
        except Exception:
            pass  # If subtraction fails, keep original

    if land.is_empty:
        return None

    # Simplify if epsilon provided
    if epsilon_m:
        epsilon_deg = epsilon_m / 111000
        try:
            land = land.simplify(epsilon_deg, preserve_topology=True)
        except Exception:
            pass

    if land.is_empty:
        return None

    return {
        "type": "Feature",
        "geometry": mapping(land),
        "properties": {"base_land": True},
        "_render": {
            "layer": "base_land",
            "themeKey": "background.land",
            "fill": True,
            "minLOD": 0,
        },
    }


def finalize_tile(tile_jsonl_path, tile_json_path, existing_json_path=None, strip_srcs=None):
    """Read a .jsonl tile, deduplicate, sort by importance, compute _meta, write final .json.

    existing_json_path: path to an existing tile to merge features from (defaults to
    tile_json_path, which is the normal behaviour for full builds). In --add mode this
    points to the live output dir so old features from already-present regions are kept.
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
    _existing_source = existing_json_path if existing_json_path is not None else tile_json_path
    if _existing_source.exists():
        try:
            _open = gzip.open if str(_existing_source).endswith(".gz") else open
            with _open(_existing_source, "rt", encoding="utf-8") as f:
                existing_tile = json.load(f)
                for feat in existing_tile.get("features", []):
                    # Skip stale base_land features — they'll be regenerated fresh
                    if feat.get("properties", {}).get("base_land"):
                        continue
                    # Strip features belonging to regions being updated
                    if strip_srcs and feat.get("_render", {}).get("_src") in strip_srcs:
                        continue
                    feat_str = orjson.dumps(feat).decode()
                    if feat_str not in seen:
                        seen.add(feat_str)
                        # Use importance 5 (medium) for existing features without importance
                        entries.append((5, feat_str))
        except:
            pass

    # Sort by importance descending
    entries.sort(key=lambda e: e[0], reverse=True)

    has_land_features = False
    water_geom_dicts = []  # collect water polygon geometries to subtract from base_land

    for importance, feat_str in entries:
        try:
            feat = json.loads(feat_str)
            props = feat.get("properties", {})
            natural = props.get("natural", "")
            landuse = props.get("landuse", "")
            is_wetland_water = natural == "wetland"  # all wetlands removed from base_land
            is_water_related = (
                natural == "water"
                or is_wetland_water
                or props.get("water")
                or props.get("waterway")
                or landuse in ("basin", "reservoir")
                or props.get("seamark:type")
                or props.get("maritime") == "yes"
                or (props.get("boundary") == "maritime")
            )
            is_tunnel = props.get("tunnel") not in (None, "no", "false", "0")
            if not is_water_related and not is_tunnel and (
                props.get("highway")
                or props.get("building")
                or landuse
                or props.get("railway")
                or props.get("amenity")
                or props.get("shop")
                or natural
            ):
                has_land_features = True
            # Collect water body polygons to subtract from base_land
            if LAND_POLYGON_TREE is not None and is_water_related:
                geom_type = feat.get("geometry", {}).get("type", "")
                if geom_type in ("Polygon", "MultiPolygon"):
                    if (natural == "water"
                            or props.get("waterway") == "riverbank"
                            or landuse in ("basin", "reservoir")
                            or is_wetland_water):
                        water_geom_dicts.append(feat["geometry"])
        except:
            pass

    feature_strings = [feat_str for _, feat_str in entries]

    # Prepend base_land polygon (authoritative land area from land polygon dataset)
    has_base_land = False
    if LAND_POLYGON_TREE is not None:
        epsilon_m = TILESET_EPSILON.get(tileset_id)
        try:
            base_feat = build_land_polygon_for_tile(tile_x, tile_y, tile_size_m, epsilon_m, water_geom_dicts)
            if base_feat is not None:
                has_base_land = True
                has_land_features = True  # ensure land background fallback
                feature_strings.insert(0, orjson.dumps(base_feat, default=decimal_default).decode())
        except Exception:
            pass

    # Write final tile as gzip-compressed JSON
    tile_json_path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(tile_json_path, "wt", compresslevel=1, encoding="utf-8") as f:
        f.write('{"type":"FeatureCollection",')
        f.write('"_meta":{"hasLandFeatures":')
        f.write("true" if has_land_features else "false")
        f.write(',"hasBaseLand":')
        f.write("true" if has_base_land else "false")
        f.write(',"landPolygonsAvailable":')
        f.write("true" if LAND_POLYGON_TREE is not None else "false")
        f.write('},"features":[')
        f.write(",".join(feature_strings))
        f.write("]}")

    # Remove intermediate .jsonl
    tile_jsonl_path.unlink()

    return tile_json_path.stat().st_size


# ── Phase 1 parallel processing ─────────────────────────────────────────────

_PHASE1_BATCH_SIZE = 200    # features per worker batch
_PHASE1_MAX_IN_FLIGHT = 4   # max queued batches per worker before back-pressure drain

# LRU file handle cache — avoids open/close syscall on every tile append
_tile_handles: dict = {}
try:
    import resource as _resource
    _soft, _ = _resource.getrlimit(_resource.RLIMIT_NOFILE)
    # Reserve ~50 fds for Python internals, pools, etc.
    _MAX_OPEN_HANDLES = max(32, _soft - 50)
except Exception:
    _MAX_OPEN_HANDLES = 200


def _get_tile_handle(path: str):
    """Return a cached open file handle, evicting the oldest entry when full."""
    if path not in _tile_handles:
        if len(_tile_handles) >= _MAX_OPEN_HANDLES:
            oldest = next(iter(_tile_handles))
            _tile_handles.pop(oldest).close()
        _tile_handles[path] = open(path, "a", encoding="utf-8")
    return _tile_handles[path]


def _close_all_tile_handles():
    """Flush and close all cached tile file handles."""
    for h in _tile_handles.values():
        h.close()
    _tile_handles.clear()


def _process_feature_batch(args):
    """Worker: process a batch of features and return write tuples.

    Returns list of (ts, x, y, importance, json_str).
    Runs in a worker process — uses only module-level globals and pure functions.
    """
    batch, clip_to_tiles, clip_buffer_pct, region_short_name = args
    results = []
    for feature in batch:
        props = feature.get("properties", {})
        geom_type = feature["geometry"]["type"]
        for tileset_config in TILESETS:
            tileset_id = tileset_config["id"]
            tile_size_m = tileset_config["tile_size_meters"]
            feature_config = feature_matches_tileset(feature, tileset_config, props, geom_type)
            if not feature_config:
                continue
            tileset_feature = copy.deepcopy(feature)
            tileset_feature = simplify_feature_for_tileset(tileset_feature, tileset_id, feature_config)
            tileset_feature["_render"] = dict(feature_config["render"])
            augment_render_from_props(tileset_feature["_render"], props, geom_type)
            tileset_feature["_render"]["_src"] = region_short_name
            feature_tiles = get_tiles_for_feature_in_tileset(tileset_feature, tileset_id, tile_size_m)
            _, importance = classify_feature_importance(props, geom_type)
            if clip_to_tiles and len(feature_tiles) > 1:
                for tile_coords in feature_tiles:
                    ts, x, y = tile_coords
                    clipped = clip_feature_to_tile(
                        copy.deepcopy(tileset_feature), x, y, tile_size_m, clip_buffer_pct
                    )
                    if clipped is None:
                        continue
                    clipped_json = orjson.dumps(clipped, default=decimal_default).decode()
                    results.append((ts, x, y, importance, clipped_json))
            else:
                feature_json = orjson.dumps(tileset_feature, default=decimal_default).decode()
                for tile_coords in feature_tiles:
                    ts, x, y = tile_coords
                    results.append((ts, x, y, importance, feature_json))
    return results


# ─────────────────────────────────────────────────────────────────────────────


def split_geojson_into_tiles(
    geojson_file,
    output_dir,
    source_pbf_file=None,
    clip_to_tiles=False,
    clip_buffer_pct=0.02,
    defer_finalization=False,
    n_workers=1,
):
    """Split GeoJSON into tiles by streaming features directly to .jsonl files.

    Args:
        geojson_file: Path to GeoJSON file to process
        output_dir: Directory to write tiles to
        source_pbf_file: Path to source OSM PBF file (used for bounds extraction)
    """

    import multiprocessing as _mp
    if _mp.current_process().daemon:
        # We're inside a daemonic pool worker — nested process pools are forbidden.
        n_workers = 1

    processing_keys = TILESET_IDS
    region_name = Path(geojson_file).stem.replace(".osm", "")
    print(f"  [{region_name}] Generating tilesets: {processing_keys}")
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
        # No PBF available (e.g. deleted after conversion); bounds will be omitted.
        actual_bounds = None

    output_path = Path(output_dir)

    # Derive region short name for _src tagging (matches the key in regions.json)
    region_short_name = Path(geojson_file).name.replace(".geojson", "").replace("-latest.osm", "")

    # Track all .jsonl files written per tileset for finalization
    tile_files_written = defaultdict(set)  # tileset_id -> set of (x, y)
    # Cache which directories have been created
    created_dirs = set()

    def append_to_tile(ts, x, y, line):
        """Append a line to a tile's .jsonl file (uses cached file handle)."""
        tile_dir = output_path / str(ts) / str(x)
        dir_key = (ts, x)
        if dir_key not in created_dirs:
            tile_dir.mkdir(parents=True, exist_ok=True)
            created_dirs.add(dir_key)
        _get_tile_handle(str(tile_dir / f"{y}.jsonl")).write(line)

    def write_batch_results(results):
        """Write (ts, x, y, importance, json_str) tuples from a worker batch."""
        for ts, x, y, importance, json_str in results:
            append_to_tile(ts, x, y, f"{importance}\t{json_str}\n")
            tile_files_written[ts].add((x, y))
            stats[ts] += 1

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
    _last_logged_feature_pct = -10.0
    _last_log_time = start_time

    db_prefix = (
        Path(source_pbf_file).stem if source_pbf_file else Path(geojson_file).stem
    )

    _batch: list = []
    _futures: list = []

    with open(geojson_file, "rb") as f:
        _executor = ProcessPoolExecutor(max_workers=n_workers) if n_workers > 1 else None
        try:
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
                    if is_interactive():
                        print(
                            f"\r  Processed: {i:,} features | {rate_str} features/sec | {progress_pct:.1f}% through file",
                            end="",
                            flush=True,
                        )
                    elif (
                        progress_pct >= _last_logged_feature_pct + 10.0
                        or current_time - _last_log_time >= 60.0
                    ):
                        _log(f"{db_prefix}: {i:,} features ({progress_pct:.0f}%) @ {rate_str}/s")
                        _last_logged_feature_pct = progress_pct
                        _last_log_time = current_time
                    last_update = current_time
                    last_count = i

                    if features_per_sec > 0:
                        estimated_features = int(features_per_sec * update_interval)
                        estimated_features = max(1000, min(500000, estimated_features))
                    else:
                        estimated_features = 10000
                    next_check_at = i + estimated_features

                if _executor is not None:
                    # Parallel path: accumulate into batch, dispatch to worker pool
                    _batch.append(feature)
                    if len(_batch) >= _PHASE1_BATCH_SIZE:
                        _futures.append(_executor.submit(
                            _process_feature_batch,
                            (_batch, clip_to_tiles, clip_buffer_pct, region_short_name),
                        ))
                        _batch = []
                        # Back-pressure: drain oldest futures to bound memory
                        while len(_futures) > n_workers * _PHASE1_MAX_IN_FLIGHT:
                            write_batch_results(_futures.pop(0).result())
                else:
                    # Sequential path: process feature immediately (original logic)
                    props = feature.get("properties", {})
                    geom_type = feature["geometry"]["type"]

                    for tileset_config in TILESETS:
                        tileset_id = tileset_config["id"]
                        tile_size_m = tileset_config["tile_size_meters"]

                        feature_config = feature_matches_tileset(
                            feature, tileset_config, props, geom_type
                        )
                        if not feature_config:
                            continue

                        tileset_feature = copy.deepcopy(feature)
                        tileset_feature = simplify_feature_for_tileset(
                            tileset_feature, tileset_id, feature_config
                        )
                        tileset_feature["_render"] = dict(feature_config["render"])
                        augment_render_from_props(tileset_feature["_render"], props, geom_type)
                        tileset_feature["_render"]["_src"] = region_short_name

                        feature_tiles = get_tiles_for_feature_in_tileset(
                            tileset_feature, tileset_id, tile_size_m
                        )

                        _, importance = classify_feature_importance(props, geom_type)

                        if clip_to_tiles and len(feature_tiles) > 1:
                            for tile_coords in feature_tiles:
                                ts, x, y = tile_coords
                                clipped = clip_feature_to_tile(
                                    copy.deepcopy(tileset_feature),
                                    x, y, tile_size_m, clip_buffer_pct,
                                )
                                if clipped is None:
                                    continue
                                clipped_json = orjson.dumps(clipped, default=decimal_default).decode()
                                append_to_tile(ts, x, y, f"{importance}\t{clipped_json}\n")
                                tile_files_written[ts].add((x, y))
                                stats[ts] += 1
                        else:
                            feature_json = orjson.dumps(tileset_feature, default=decimal_default).decode()
                            for tile_coords in feature_tiles:
                                ts, x, y = tile_coords
                                append_to_tile(ts, x, y, f"{importance}\t{feature_json}\n")
                                tile_files_written[ts].add((x, y))
                                stats[ts] += 1

        finally:
            if _executor is not None:
                # Flush remaining partial batch, drain all in-flight futures
                if _batch:
                    _futures.append(_executor.submit(
                        _process_feature_batch,
                        (_batch, clip_to_tiles, clip_buffer_pct, region_short_name),
                    ))
                for fut in _futures:
                    write_batch_results(fut.result())
                _executor.shutdown(wait=True)
            _close_all_tile_handles()

    if is_interactive():
        print(
            f"\r  Processed {i:,} features in {time.time() - start_time:.0f}s ({db_prefix})"
            + " " * 40
        )
    else:
        _log(f"{db_prefix}: done — {i:,} features in {time.time() - start_time:.0f}s")

    # When defer_finalization=True, Phase 2 runs globally after all regions finish.
    # Return the written tile coordinates so the caller can finalize with merged bounds.
    if defer_finalization:
        return {"bounds": actual_bounds, "tile_files_written": tile_files_written}

    # Pass 2: Finalize each .jsonl into .json (deduplicate, sort, add _meta)
    # Initialize land polygon index filtered to the actual tile bounds, not the
    # region's feature bounds.  Using tile bounds prevents incomplete base_land
    # when a tile extends beyond the region's feature footprint (e.g. a maritime
    # boundary from region A lands in tiles whose full extent needs land polygons
    # from a neighbouring degree-cell that lies outside A's feature bbox).
    all_tiles = [(ts, x, y) for ts, coords in tile_files_written.items() for x, y in coords]
    expanded_land_bounds = tile_set_bounds(all_tiles)
    init_land_polygons(_DATA_DIR, expanded_land_bounds)

    total_tiles = sum(len(tiles) for tiles in tile_files_written.values())
    tile_count = 0
    total_bytes = 0

    write_start = time.time()
    last_update = write_start
    last_tile_count = 0
    next_tile_check_at = 12
    tile_rate_history = []
    _last_logged_tile_pct = -10.0
    _last_tile_log_time = write_start

    for tileset_id in processing_keys:
        for x, y in tile_files_written.get(tileset_id, set()):
            jsonl_path = output_path / str(tileset_id) / str(x) / f"{y}.jsonl"
            json_path = output_path / str(tileset_id) / str(x) / f"{y}.json.gz"

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
                if is_interactive():
                    print(
                        f"\r  Finalizing: {tile_count:,}/{total_tiles:,} tiles | {tiles_per_sec:.0f} tiles/sec | {progress_pct:.1f}%",
                        end="",
                        flush=True,
                    )
                elif (
                    progress_pct >= _last_logged_tile_pct + 10.0
                    or current_time - _last_tile_log_time >= 60.0
                ):
                    _log(f"finalizing: {tile_count:,}/{total_tiles:,} tiles ({progress_pct:.0f}%) @ {tiles_per_sec:.0f}/s")
                    _last_logged_tile_pct = progress_pct
                    _last_tile_log_time = current_time
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
    if is_interactive():
        print(
            f"\r  Created {tile_count:,} tiles ({size_mb:.1f} MB) in {write_elapsed:.0f}s"
            + " " * 40
        )
    else:
        _log(f"finalized {tile_count:,} tiles ({size_mb:.1f} MB) in {write_elapsed:.0f}s")

    return {"bounds": actual_bounds, "total_bytes": total_bytes}


def process_geojson_to_tiles(args):
    """Process a single GeoJSON file into tiles."""
    geojson_file, output_dir, source_file, clip_to_tiles, clip_buffer_pct, defer_finalization, active_tileset_ids, n_workers = args
    _apply_tileset_filter(active_tileset_ids)

    geojson_path = Path(geojson_file)

    try:
        result = split_geojson_into_tiles(
            str(geojson_file),
            output_dir,
            source_pbf_file=source_file,
            clip_to_tiles=clip_to_tiles,
            clip_buffer_pct=clip_buffer_pct,
            defer_finalization=defer_finalization,
            n_workers=n_workers,
        )

        return {
            "name": geojson_path.name,
            "geojson_path": str(geojson_path),
            "status": "success",
            "bounds": result["bounds"],
            "tile_files_written": result.get("tile_files_written", {}),
            "total_bytes": result.get("total_bytes", 0),
        }

    except Exception as e:
        import traceback

        return {
            "name": geojson_path.name,
            "status": "failed",
            "error": str(e) + "\n" + traceback.format_exc(),
        }


def _finalize_tile_worker(args):
    """Worker for Phase 2: finalize one tile. Land polygons initialized via Pool initializer."""
    jsonl_path, json_path, existing_json_path, strip_srcs = args
    existing = Path(existing_json_path) if existing_json_path else None
    return finalize_tile(Path(jsonl_path), Path(json_path), existing, strip_srcs=strip_srcs)


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
        tile_files = list(tileset_path.rglob("*.json.gz"))
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
                with gzip.open(tile_file, "rt", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError):
                continue

            features = data.get("features", []) if isinstance(data, dict) else data
            for feat in features:
                feat_bytes = len(orjson.dumps(feat))
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


def _apply_tileset_filter(tileset_ids):
    """Filter module-level TILESETS to only the specified IDs. Modifies globals in-place."""
    global TILESETS, TILESET_IDS, TILESET_TILE_SIZES, TILESET_EPSILON
    # Accept both space-separated and comma-separated lists (e.g. "t4,t5" or ["t4", "t5"])
    flat = []
    for item in tileset_ids:
        flat.extend(s.strip() for s in item.split(",") if s.strip())
    allowed = set(flat)
    all_ids = {ts["id"] for ts in TILESETS}
    unknown = allowed - all_ids
    if unknown:
        print(f"Error: Unknown tileset(s): {', '.join(sorted(unknown))}. "
              f"Available: {', '.join(sorted(all_ids))}")
        sys.exit(1)
    TILESETS = [ts for ts in TILESETS if ts["id"] in allowed]
    TILESET_IDS = [ts["id"] for ts in TILESETS]
    TILESET_TILE_SIZES = {ts["id"]: ts["tile_size_meters"] for ts in TILESETS}
    TILESET_EPSILON = {}
    for _ts in TILESETS:
        for _fd in _ts["features"]:
            _eps = _fd.get("simplification", {}).get("epsilon_m")
            if _eps:
                TILESET_EPSILON[_ts["id"]] = _eps
                break


def _write_regions_json(output_dir, all_results):
    """Write/update regions.json from a list of process_geojson_to_tiles results."""
    regions_path = output_dir / "regions.json"
    # Load existing if present (for --add merges)
    if regions_path.exists():
        try:
            with open(regions_path) as f:
                data = json.load(f)
        except Exception:
            data = {"version": 1, "regions": {}}
    else:
        data = {"version": 1, "regions": {}}

    for result in all_results:
        if result["status"] != "success":
            continue
        bounds = result.get("bounds")
        if not bounds or "land-polygon" in result["name"]:
            continue
        name = result["name"].replace(".geojson", "").replace("-latest.osm", "")
        geojson_path = result.get("geojson_path", "")
        mtime = 0.0
        if geojson_path and Path(geojson_path).exists():
            mtime = Path(geojson_path).stat().st_mtime
        data["regions"][name] = {
            "geojson": geojson_path,
            "bounds": bounds,
            "geojson_mtime": mtime,
        }

    with open(regions_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _write_region_tile_index(output_dir, region_name, tile_files_written):
    """Write a per-region tile index to regions/{region_name}.tiles.json.gz."""
    regions_dir = Path(output_dir) / "regions"
    regions_dir.mkdir(parents=True, exist_ok=True)
    index = {ts: [[x, y] for x, y in sorted(coords)] for ts, coords in tile_files_written.items()}
    out_path = regions_dir / f"{region_name}.tiles.json.gz"
    with gzip.open(out_path, "wt", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"))


def _load_region_tile_index(output_dir, region_name):
    """Load regions/{region_name}.tiles.json.gz. Returns dict[str, set[tuple]] or None."""
    out_path = Path(output_dir) / "regions" / f"{region_name}.tiles.json.gz"
    if not out_path.exists():
        return None
    try:
        with gzip.open(out_path, "rt", encoding="utf-8") as f:
            data = json.load(f)
        return {ts: {(int(x), int(y)) for x, y in coords} for ts, coords in data.items()}
    except Exception:
        return None


def _run_add_mode(args, geojson_files, regions_data):
    """Add/update regions into the live output dir without a full rebuild.

    geojson_files: list of Path objects to process
    regions_data: existing regions.json data dict (will be updated in-place and written)
    """
    print("=" * 70)
    print("Step 3: Add/Update Regions (incremental)")
    print("=" * 70)
    print()
    print(f"Processing {len(geojson_files)} GeoJSON file(s):")
    for gj in geojson_files:
        size_mb = gj.stat().st_size / (1024 * 1024)
        name = gj.stem.replace("-latest.osm", "").replace("-", " ").title()
        print(f"  • {name} ({size_mb:.0f} MB)")
    print()

    # Phase 1: stream features to a temporary directory
    temp_tile_dir = Path(tempfile.mkdtemp(prefix="tiles_add_", dir=args.output_dir.parent))
    try:
        tile_args = []
        for gj in geojson_files:
            _pbf_parent = gj.parent.parent / f"{gj.parent.name}.osm.pbf"
            _pbf_same = gj.parent / f"{gj.parent.name}.osm.pbf"
            pbf_file = _pbf_parent if _pbf_parent.exists() else (_pbf_same if _pbf_same.exists() else None)
            source_file = str(pbf_file) if pbf_file else None
            tile_args.append((
                str(gj),
                str(temp_tile_dir),
                source_file,
                args.clip,
                args.clip_buffer,
                True,  # defer_finalization
                TILESET_IDS,
                None,  # n_workers placeholder, filled below
            ))
        n_outer = min(args.jobs, len(tile_args))
        n_inner = max(1, args.jobs // n_outer)
        tile_args = [t[:-1] + (n_inner,) for t in tile_args]

        _log("Phase 1: Writing features...")
        if n_outer == 1:
            write_results = [process_geojson_to_tiles(tile_args[0])]
        else:
            with Pool(n_outer) as pool:
                write_results = list(
                    tqdm(
                        pool.imap_unordered(process_geojson_to_tiles, tile_args),
                        total=len(tile_args),
                        desc="Writing regions",
                        unit="region",
                        disable=not is_interactive(),
                    )
                )

        # Build tile file map: (ts, x, y) -> (jsonl in temp, json in LIVE dir)
        all_tile_files_written = {}
        for r in write_results:
            if r["status"] == "success":
                for ts, coords in r.get("tile_files_written", {}).items():
                    for x, y in coords:
                        key = (ts, x, y)
                        if key not in all_tile_files_written:
                            jsonl = str(temp_tile_dir / ts / str(x) / f"{y}.jsonl")
                            live_json = str(args.output_dir / ts / str(x) / f"{y}.json.gz")
                            all_tile_files_written[key] = (jsonl, live_json)

        # Use actual tile bounds for land polygon loading (not region feature bounds)
        expanded_merged_bounds = tile_set_bounds(all_tile_files_written.keys())

        # Phase 2: finalize tiles into the live output dir, merging with existing tiles
        _log(f"Phase 2: Finalizing {len(all_tile_files_written):,} tiles...")
        finalize_args = [
            (jsonl, live_json, live_json, None)
            for (ts, x, y), (jsonl, live_json) in all_tile_files_written.items()
        ]
        n_workers = min(args.jobs, max(len(finalize_args), 1))
        with Pool(n_workers, initializer=init_land_polygons, initargs=(_DATA_DIR, expanded_merged_bounds)) as pool:
            byte_counts = list(
                tqdm(
                    pool.imap_unordered(_finalize_tile_worker, finalize_args),
                    total=len(finalize_args),
                    desc="Finalizing tiles",
                    unit="tile",
                    disable=not is_interactive(),
                )
            )
        total_bytes = sum(b for b in byte_counts if b)

        # --- Update index.json ---
        index_path = args.output_dir / "index.json"
        if index_path.exists():
            try:
                with open(index_path) as f:
                    index_data = json.load(f)
                old_bounds = index_data.get("bounds", {
                    "minLon": float("inf"), "maxLon": float("-inf"),
                    "minLat": float("inf"), "maxLat": float("-inf"),
                })
            except Exception:
                old_bounds = {
                    "minLon": float("inf"), "maxLon": float("-inf"),
                    "minLat": float("inf"), "maxLat": float("-inf"),
                }
        else:
            old_bounds = {
                "minLon": float("inf"), "maxLon": float("-inf"),
                "minLat": float("inf"), "maxLat": float("-inf"),
            }

        new_bounds = dict(old_bounds)
        for r in write_results:
            if r["status"] == "success" and r.get("bounds") and "land-polygon" not in r["name"]:
                b = r["bounds"]
                new_bounds["minLon"] = min(new_bounds.get("minLon", float("inf")), b["minLon"])
                new_bounds["maxLon"] = max(new_bounds.get("maxLon", float("-inf")), b["maxLon"])
                new_bounds["minLat"] = min(new_bounds.get("minLat", float("inf")), b["minLat"])
                new_bounds["maxLat"] = max(new_bounds.get("maxLat", float("-inf")), b["maxLat"])

        all_config_tileset_ids = [ts["id"] for ts in TILESET_CONFIG["tilesets"]]
        tile_count = sum(
            len(list((args.output_dir / ts_id).rglob("*.json.gz")))
            for ts_id in all_config_tileset_ids
            if (args.output_dir / ts_id).exists()
        )
        index_data_new = {
            "bounds": new_bounds,
            "tilesets": all_config_tileset_ids,
            "tile_count": tile_count,
            "center": {"lon": HAMBURG_CENTER_LON, "lat": HAMBURG_CENTER_LAT},
            "generated": int(time.time() * 1000),
        }
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index_data_new, f, indent=2)
        print(f"  ✓ Updated index.json ({tile_count:,} tiles, {_format_size(total_bytes)})")

        # --- Update regions.json ---
        _write_regions_json(args.output_dir, write_results)
        print("  ✓ Updated regions.json")

        # --- Write per-region tile indices (enables zero-downtime --update) ---
        for r in write_results:
            if r["status"] == "success" and r.get("tile_files_written") and "land-polygon" not in r["name"]:
                rname = r["name"].replace(".geojson", "").replace("-latest.osm", "")
                _write_region_tile_index(args.output_dir, rname, r["tile_files_written"])
        print("  ✓ Updated region tile indices")

        # Summary
        success_count = sum(1 for r in write_results if r["status"] == "success")
        fail_count = len(write_results) - success_count
        print()
        for r in write_results:
            name = r["name"].replace(".geojson", "").replace("-latest.osm", "")
            if r["status"] == "success":
                print(f"  ✓ {name.replace('-', ' ').title()}")
            else:
                print(f"  ✗ {name}: {r.get('error', 'unknown error')}")
        if fail_count:
            sys.exit(1)

    finally:
        if temp_tile_dir.exists():
            shutil.rmtree(temp_tile_dir)


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
        default=max(1, (os.cpu_count() or 2) // 2),
        help="Number of parallel tile generation processes (default: half of CPU count)",
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
    parser.add_argument(
        "--add",
        nargs="+",
        metavar="GEOJSON",
        help="Add new region(s): process the given GeoJSON file(s) and merge into the live "
             "output dir without a full rebuild",
    )
    parser.add_argument(
        "--update",
        nargs="+",
        metavar="REGION",
        help="Update existing region(s) by name (as recorded in regions.json): delete affected "
             "tiles and re-process those regions plus any overlapping neighbors",
    )
    parser.add_argument(
        "--tilesets",
        nargs="+",
        metavar="TILESET_ID",
        help="Only generate tiles for the specified tileset IDs (e.g. --tilesets t2b). "
             "Modifier for --add / --update / full build.",
    )
    parser.add_argument(
        "--regen-tilesets",
        nargs="+",
        metavar="TILESET_ID",
        help="Delete and fully rebuild the specified tileset(s) from all regions in --data-dir. "
             "Safe to use when tileset config changes (clears stale tiles before rebuilding).",
    )

    args = parser.parse_args()

    # Let workers find land polygons in the user-specified data dir, not the
    # script's own directory (important on Nix where the script lives in the store).
    global _DATA_DIR
    _DATA_DIR = args.data_dir

    # --- --regen-tilesets: rebuild specific tilesets for all regions, then swap ---
    if args.regen_tilesets:
        _apply_tileset_filter(args.regen_tilesets)
        print(f"Regenerating tilesets: {TILESET_IDS}")
        print()

        # Find all region GeoJSONs in data-dir
        geojson_files = sorted(args.data_dir.glob("*/*.osm.geojson"))
        if not geojson_files:
            print(f"Error: No *.osm.geojson files found under {args.data_dir}/*/")
            sys.exit(1)

        regions_json_path = args.output_dir / "regions.json"
        if regions_json_path.exists():
            try:
                with open(regions_json_path) as f:
                    regions_data = json.load(f)
            except Exception:
                regions_data = {"version": 1, "regions": {}}
        else:
            regions_data = {"version": 1, "regions": {}}

        # Build into a staging dir so the live tilesets stay intact during the build
        staging_dir = args.output_dir.parent / f".regen_staging_{os.getpid()}"
        staging_dir.mkdir(parents=True, exist_ok=True)
        try:
            staging_args = argparse.Namespace(**vars(args))
            staging_args.output_dir = staging_dir
            _run_add_mode(staging_args, geojson_files, regions_data)

            # Atomically swap each tileset dir: rename live→old, staging→live, delete old
            print("\nSwapping tileset directories...")
            for ts_id in TILESET_IDS:
                live = args.output_dir / ts_id
                new = staging_dir / ts_id
                old = args.output_dir / f".old_{ts_id}"
                if not new.exists():
                    continue
                if live.exists():
                    os.rename(live, old)
                os.rename(new, live)
                if old.exists():
                    shutil.rmtree(old)
                print(f"  ✓ {ts_id}")
        finally:
            shutil.rmtree(staging_dir, ignore_errors=True)
        return

    # --- Apply --tilesets filter (modifier for --add / --update / full build) ---
    if args.tilesets:
        _apply_tileset_filter(args.tilesets)
        print(f"Generating only tilesets: {TILESET_IDS}")

    # --- Incremental modes (--add / --update) ---

    if args.update:
        regions_json_path = args.output_dir / "regions.json"
        if not regions_json_path.exists():
            print("Error: regions.json not found in output dir. Run a full build first.")
            sys.exit(1)
        with open(regions_json_path) as f:
            regions_data = json.load(f)
        regions = regions_data.get("regions", {})

        # Validate target regions and collect GeoJSON paths
        target_geojsons = []
        union_bounds = {
            "minLon": float("inf"), "maxLon": float("-inf"),
            "minLat": float("inf"), "maxLat": float("-inf"),
        }
        for name in args.update:
            if name not in regions:
                print(f"Error: Region '{name}' not found in regions.json")
                sys.exit(1)
            entry = regions[name]
            geojson_path = Path(entry["geojson"])
            if not geojson_path.exists():
                # Stored path may be stale (project moved). Try resolving under _DATA_DIR.
                candidate = _DATA_DIR / geojson_path.parent.name / geojson_path.name
                if candidate.exists():
                    geojson_path = candidate
            target_geojsons.append(geojson_path)
            b = entry["bounds"]
            union_bounds["minLon"] = min(union_bounds["minLon"], b["minLon"])
            union_bounds["maxLon"] = max(union_bounds["maxLon"], b["maxLon"])
            union_bounds["minLat"] = min(union_bounds["minLat"], b["minLat"])
            union_bounds["maxLat"] = max(union_bounds["maxLat"], b["maxLat"])

        target_names = set(args.update)

        # Check if all target regions have tile indices for zero-downtime update
        all_have_indices = all(
            _load_region_tile_index(args.output_dir, name) is not None
            for name in args.update
        )

        if not all_have_indices:
            # Fallback: delete-then-rebuild (no tile indices available yet)
            print("  Note: tile indices missing — using delete-then-rebuild fallback")
            neighbor_geojsons = []
            for name, entry in regions.items():
                if name in target_names:
                    continue
                if bounds_overlap(entry["bounds"], union_bounds):
                    neighbor_geojsons.append(Path(entry["geojson"]))
                    print(f"  Including overlapping neighbor: {name}")
            print(f"\nDeleting tiles in bounds of updated region(s)...")
            deleted = 0
            for ts_id, tile_size_m in TILESET_TILE_SIZES.items():
                for x, y in tiles_in_bounds(union_bounds, tile_size_m):
                    tile_path = args.output_dir / ts_id / str(x) / f"{y}.json.gz"
                    if tile_path.exists():
                        tile_path.unlink()
                        deleted += 1
            print(f"  Deleted {deleted:,} tiles")
            _run_add_mode(args, target_geojsons + neighbor_geojsons, regions_data)
            return

        # Zero-downtime update: stage → strip → merge → atomic swap
        print("=" * 70)
        print("Step 3: Update Regions (zero-downtime)")
        print("=" * 70)
        print()
        print(f"Updating {len(target_geojsons)} region(s): {', '.join(sorted(target_names))}")

        # Phase 0: Load existing tile indices to determine affected tiles
        print("\nPhase 0: Loading tile indices...")
        affected_tiles = set()  # set of (ts, x, y)
        for name in args.update:
            idx = _load_region_tile_index(args.output_dir, name)
            if idx:
                for ts, coords in idx.items():
                    for x, y in coords:
                        affected_tiles.add((ts, x, y))
        print(f"  {len(affected_tiles):,} tiles in existing indices")

        temp_tile_dir = Path(tempfile.mkdtemp(prefix="tiles_stage_", dir=args.output_dir.parent))
        staging_dir = Path(tempfile.mkdtemp(prefix="tiles_live_", dir=args.output_dir.parent))
        try:
            # Phase 1: Stream features to temp dir (deferred finalization)
            tile_args = []
            for gj in target_geojsons:
                _pbf_parent = gj.parent.parent / f"{gj.parent.name}.osm.pbf"
                _pbf_same = gj.parent / f"{gj.parent.name}.osm.pbf"
                pbf_file = _pbf_parent if _pbf_parent.exists() else (_pbf_same if _pbf_same.exists() else None)
                source_file = str(pbf_file) if pbf_file else None
                tile_args.append((
                    str(gj),
                    str(temp_tile_dir),
                    source_file,
                    args.clip,
                    args.clip_buffer,
                    True,  # defer_finalization
                    TILESET_IDS,
                    None,  # n_workers placeholder, filled below
                ))
            n_outer = min(args.jobs, len(tile_args))
            n_inner = max(1, args.jobs // n_outer)
            tile_args = [t[:-1] + (n_inner,) for t in tile_args]

            print("\nPhase 1: Writing features...")
            if n_outer == 1:
                write_results = [process_geojson_to_tiles(tile_args[0])]
            else:
                with Pool(n_outer) as pool:
                    write_results = list(
                        tqdm(
                            pool.imap_unordered(process_geojson_to_tiles, tile_args),
                            total=len(tile_args),
                            desc="Writing regions",
                            unit="region",
                        )
                    )

            # Expand affected_tiles with any new tiles from this build
            for r in write_results:
                if r["status"] == "success":
                    for ts, coords in r.get("tile_files_written", {}).items():
                        for x, y in coords:
                            affected_tiles.add((ts, x, y))

            # Use actual tile bounds for land polygon loading (not region feature bounds)
            expanded_merged_bounds = tile_set_bounds(affected_tiles)

            # Ensure every affected tile has a .jsonl (even empty) so finalize runs
            for ts, x, y in affected_tiles:
                jsonl = temp_tile_dir / ts / str(x) / f"{y}.jsonl"
                if not jsonl.exists():
                    jsonl.parent.mkdir(parents=True, exist_ok=True)
                    jsonl.touch()

            # Phase 2: Finalize to staging dir, stripping old region features
            strip_srcs = frozenset(target_names)
            finalize_args = []
            for ts, x, y in affected_tiles:
                jsonl = str(temp_tile_dir / ts / str(x) / f"{y}.jsonl")
                staging_json = str(staging_dir / ts / str(x) / f"{y}.json.gz")
                live_json = str(args.output_dir / ts / str(x) / f"{y}.json.gz")
                finalize_args.append((jsonl, staging_json, live_json, strip_srcs))

            print(f"\nPhase 2: Finalizing {len(finalize_args):,} tiles to staging...")
            n_workers = min(args.jobs, max(len(finalize_args), 1))
            with Pool(n_workers, initializer=init_land_polygons, initargs=(_DATA_DIR, expanded_merged_bounds)) as pool:
                byte_counts = list(
                    tqdm(
                        pool.imap_unordered(_finalize_tile_worker, finalize_args),
                        total=len(finalize_args),
                        desc="Finalizing tiles",
                        unit="tile",
                    )
                )
            total_bytes = sum(b for b in byte_counts if b)

            # Phase 3: Atomic swap staging → live
            print("\nPhase 3: Swapping tiles atomically...")
            swapped = 0
            for ts, x, y in affected_tiles:
                staging_json = staging_dir / ts / str(x) / f"{y}.json.gz"
                live_json = args.output_dir / ts / str(x) / f"{y}.json.gz"
                if staging_json.exists():
                    live_json.parent.mkdir(parents=True, exist_ok=True)
                    os.replace(str(staging_json), str(live_json))
                    swapped += 1
            print(f"  Swapped {swapped:,} tiles ({_format_size(total_bytes)})")

            # Update regions.json and per-region tile indices
            _write_regions_json(args.output_dir, write_results)
            for r in write_results:
                if r["status"] == "success" and r.get("tile_files_written") and "land-polygon" not in r["name"]:
                    rname = r["name"].replace(".geojson", "").replace("-latest.osm", "")
                    _write_region_tile_index(args.output_dir, rname, r["tile_files_written"])
            print("  ✓ Updated regions.json and tile indices")

            fail_count = sum(1 for r in write_results if r["status"] != "success")
            if fail_count:
                for r in write_results:
                    if r["status"] != "success":
                        print(f"  ✗ {r['name']}: {r.get('error', 'unknown error')}")
                sys.exit(1)

        finally:
            shutil.rmtree(temp_tile_dir, ignore_errors=True)
            shutil.rmtree(staging_dir, ignore_errors=True)

        return

    if args.add:
        regions_json_path = args.output_dir / "regions.json"
        if regions_json_path.exists():
            try:
                with open(regions_json_path) as f:
                    regions_data = json.load(f)
            except Exception:
                regions_data = {"version": 1, "regions": {}}
        else:
            regions_data = {"version": 1, "regions": {}}
        _run_add_mode(args, [Path(f) for f in args.add], regions_data)
        return

    # --- Full rebuild mode (existing behaviour below) ---

    # Find PBF files and check which ones need GeoJSON processing
    if args.geojson_files:
        # If specific files provided, use them directly
        geojson_files = [Path(f) for f in args.geojson_files]
        files_to_process = geojson_files
    else:
        # Find all OSM PBF files
        pbf_files = list(args.data_dir.glob("*-latest.osm.pbf"))
        if ACTIVE_REGIONS is not None:
            pbf_files = [
                f for f in pbf_files
                if any(r in f.name for r in ACTIVE_REGIONS)
            ]

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

    _log("Step 3: Generate Map Tiles")
    _log(f"  Tilesets: {', '.join(TILESET_IDS)}  jobs: {args.jobs}  output: {args.output_dir}")

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
            # PBF may be one level up (data/region.osm.pbf) or alongside the GeoJSON
            _pbf_parent = gj.parent.parent / f"{gj.parent.name}.osm.pbf"
            _pbf_same = gj.parent / f"{gj.parent.name}.osm.pbf"
            pbf_file = _pbf_parent if _pbf_parent.exists() else (_pbf_same if _pbf_same.exists() else None)
            source_file = str(pbf_file) if pbf_file else None
            tile_args.append(
                (
                    str(gj),
                    str(temp_tile_dir),
                    source_file,
                    args.clip,
                    args.clip_buffer,
                    True,  # defer_finalization — Phase 2 runs globally below
                    TILESET_IDS,
                    None,  # n_workers placeholder, filled below
                )
            )
        n_outer = min(args.jobs, len(tile_args))
        n_inner = max(1, args.jobs // n_outer)
        tile_args = [t[:-1] + (n_inner,) for t in tile_args]

        # Phase 1: stream all region features to .jsonl files (no finalization yet)
        _log("Phase 1: Writing features...")
        if n_outer == 1:
            write_results = [process_geojson_to_tiles(tile_args[0])]
        else:
            with Pool(n_outer) as pool:
                write_results = list(
                    tqdm(
                        pool.imap_unordered(process_geojson_to_tiles, tile_args),
                        total=len(tile_args),
                        desc="Writing regions",
                        unit="region",
                        disable=not is_interactive(),
                    )
                )

        all_tile_files_written = {}  # (ts, x, y) -> (jsonl_path, json_path)
        for r in write_results:
            if r["status"] == "success":
                for ts, coords in r.get("tile_files_written", {}).items():
                    for x, y in coords:
                        key = (ts, x, y)
                        if key not in all_tile_files_written:
                            all_tile_files_written[key] = (
                                str(temp_tile_dir / ts / str(x) / f"{y}.jsonl"),
                                str(temp_tile_dir / ts / str(x) / f"{y}.json.gz"),
                            )

        # Use actual tile bounds for land polygon loading (not region feature bounds)
        expanded_merged_bounds = tile_set_bounds(all_tile_files_written.keys())

        # Phase 2: finalize all tiles once, using the merged land polygon bounds
        _log(f"Phase 2: Finalizing {len(all_tile_files_written):,} tiles...")
        finalize_args = [
            (jsonl, json_, None, None)
            for jsonl, json_ in all_tile_files_written.values()
        ]
        total_finalize_bytes = 0
        n_workers = min(args.jobs, max(len(finalize_args), 1))
        with Pool(n_workers, initializer=init_land_polygons, initargs=(_DATA_DIR, expanded_merged_bounds)) as pool:
            byte_counts = list(
                tqdm(
                    pool.imap_unordered(_finalize_tile_worker, finalize_args),
                    total=len(finalize_args),
                    desc="Finalizing tiles",
                    unit="tile",
                    disable=not is_interactive(),
                )
            )
        total_finalize_bytes = sum(b for b in byte_counts if b)

        # Wrap write_results for the summary loop below, adding finalization bytes
        for r in write_results:
            r["total_bytes"] = total_finalize_bytes // max(len(write_results), 1)
        all_results.extend(write_results)

    # Merge bounds from all results
    merged_bounds = {
        "minLon": float("inf"),
        "maxLon": float("-inf"),
        "minLat": float("inf"),
        "maxLat": float("-inf"),
    }

    _log("Processing Summary:")

    success_count = 0
    failed_sources = []

    for result in all_results:
        if result["status"] == "success":
            bounds = result["bounds"]
            # Don't include land polygon bounds in final merge - they're filtered to OSM bounds anyway
            # and before filtering they cover the entire world
            if bounds and "land-polygon" not in result["name"]:
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
            _log(f"  {name.replace('-', ' ').title()} ({size_str} tiles)")
            success_count += 1
        else:
            name = result["name"].replace(".geojson", "").replace("-latest.osm", "")
            failed_sources.append(f"{name}: {result.get('error', 'unknown error')}")

    if failed_sources:
        for failure in failed_sources:
            _log(f"  FAILED {failure}")

    # Write tile index
    if success_count > 0:
        tile_count = sum(
            len(list((temp_tile_dir / tileset_id).rglob("*.json.gz")))
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
            "tilesets": [ts["id"] for ts in TILESET_CONFIG["tilesets"]],
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

        # Write regions.json so incremental builds can use it
        _write_regions_json(args.output_dir, all_results)
        print("  ✓ Wrote regions.json")
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

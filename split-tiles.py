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

import json
import gzip
import math
import os
import sys
from collections import defaultdict
from pathlib import Path

# Hamburg bounds
MIN_LON = 9.77
MAX_LON = 10.21
MIN_LAT = 53.415
MAX_LAT = 53.685

def lon_to_tile_x(lon, zoom):
    """Convert longitude to tile X coordinate"""
    n = 2.0 ** zoom
    return int((lon + 180.0) / 360.0 * n)

def lat_to_tile_y(lat, zoom):
    """Convert latitude to tile Y coordinate"""
    n = 2.0 ** zoom
    lat_rad = math.radians(lat)
    return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)

def get_feature_bounds(feature):
    """Get bounding box of a feature"""
    coords = feature['geometry']['coordinates']
    geom_type = feature['geometry']['type']

    lons, lats = [], []

    def process_coord(coord):
        lons.append(coord[0])
        lats.append(coord[1])

    if geom_type == 'Point':
        process_coord(coords)
    elif geom_type == 'LineString':
        for coord in coords:
            process_coord(coord)
    elif geom_type == 'Polygon':
        for coord in coords[0]:
            process_coord(coord)
    elif geom_type == 'MultiLineString':
        for line in coords:
            for coord in line:
                process_coord(coord)
    elif geom_type == 'MultiPolygon':
        for polygon in coords:
            for coord in polygon[0]:
                process_coord(coord)

    if not lons:
        return None

    return {
        'minLon': min(lons),
        'maxLon': max(lons),
        'minLat': min(lats),
        'maxLat': max(lats)
    }

def classify_feature_importance(props, geom_type):
    """
    Classify feature by importance for progressive loading.
    Returns tuple: (min_zoom, importance_score)

    min_zoom: earliest zoom level to show this feature
    importance_score: for sorting within zoom level
    """

    # Major water bodies (always visible)
    if props.get('natural') == 'water' or props.get('water') or props.get('waterway') == 'riverbank':
        return (0, 100)  # Z0-Z5, very important

    # Forests (always visible)
    if props.get('landuse') == 'forest' or props.get('natural') == 'wood':
        return (0, 90)  # Z0-Z5, very important

    # Major highways (always visible)
    if props.get('highway') in ['motorway', 'trunk']:
        return (0, 80)  # Z0-Z5, very important

    # Railways (always visible)
    if props.get('railway') and geom_type != 'Point':
        track_types = ['rail', 'light_rail', 'subway', 'tram', 'monorail', 'narrow_gauge', 'preserved']
        if props.get('railway') in track_types:
            return (0, 70)  # Z0-Z5, important

    # Major rivers
    if props.get('waterway') in ['river', 'canal']:
        return (6, 60)  # Z6-Z10

    # Primary/secondary roads
    if props.get('highway') in ['primary', 'secondary']:
        return (6, 50)  # Z6-Z10

    # Parks and green spaces
    if props.get('leisure') == 'park' or props.get('landuse') in ['grass', 'meadow', 'farmland']:
        return (6, 40)  # Z6-Z10

    # Tertiary and residential roads
    if props.get('highway') in ['tertiary', 'residential', 'unclassified']:
        return (11, 30)  # Z11-Z14

    # Buildings
    if props.get('building'):
        return (11, 20)  # Z11-Z14

    # Small roads and paths
    if props.get('highway'):
        return (15, 10)  # Z15+

    # Named POIs
    if geom_type == 'Point' and props.get('name'):
        if props.get('amenity') or props.get('shop') or props.get('tourism'):
            return (15, 5)  # Z15+

    # Skip everything else
    return (99, 0)  # Never show

def get_tiles_for_feature(feature, zoom):
    """Get all tiles that this feature intersects at given zoom level"""
    bounds = get_feature_bounds(feature)
    if not bounds:
        return []

    min_x = lon_to_tile_x(bounds['minLon'], zoom)
    max_x = lon_to_tile_x(bounds['maxLon'], zoom)
    min_y = lat_to_tile_y(bounds['maxLat'], zoom)  # Note: Y is inverted
    max_y = lat_to_tile_y(bounds['minLat'], zoom)

    tiles = []
    for x in range(min_x, max_x + 1):
        for y in range(min_y, max_y + 1):
            tiles.append((zoom, x, y))

    return tiles

def split_geojson_into_tiles(input_file, output_dir, zoom_levels):
    """Split GeoJSON into tiles"""
    print(f"Loading {input_file}...")
    with open(input_file, 'r') as f:
        data = json.load(f)

    features = data['features']
    print(f"Loaded {len(features)} features")

    # Organize features by tile and zoom
    tiles = defaultdict(lambda: defaultdict(list))

    print("\nClassifying and distributing features...")
    stats = defaultdict(int)

    for i, feature in enumerate(features):
        if i % 10000 == 0:
            print(f"  Processed {i}/{len(features)} features...")

        props = feature.get('properties', {})
        geom_type = feature['geometry']['type']

        min_zoom, importance = classify_feature_importance(props, geom_type)

        if min_zoom >= 99:
            stats['skipped'] += 1
            continue

        # Add to all relevant zoom levels
        for zoom in zoom_levels:
            if zoom >= min_zoom:
                feature_tiles = get_tiles_for_feature(feature, zoom)
                for tile_coords in feature_tiles:
                    z, x, y = tile_coords
                    tiles[tile_coords][importance].append(feature)
                    stats[f'z{z}'] += 1

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

        tile_geojson = {
            'type': 'FeatureCollection',
            'features': sorted_features
        }

        # Write compressed
        tile_file = tile_dir / f"{y}.json.gz"
        with gzip.open(tile_file, 'wt', encoding='utf-8') as f:
            json.dump(tile_geojson, f, separators=(',', ':'))

    print(f"\n✓ Created {total_tiles} tiles in {output_dir}")

    # Write tile index
    index_file = output_path / "index.json"
    index_data = {
        'bounds': {
            'minLon': MIN_LON,
            'maxLon': MAX_LON,
            'minLat': MIN_LAT,
            'maxLat': MAX_LAT
        },
        'zoom_levels': sorted(zoom_levels),
        'tile_count': total_tiles,
        'center': {
            'lon': (MIN_LON + MAX_LON) / 2,
            'lat': (MIN_LAT + MAX_LAT) / 2
        }
    }
    with open(index_file, 'w') as f:
        json.dump(index_data, f, indent=2)

    print(f"✓ Created tile index: {index_file}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: ./split-tiles.py <input.geojson>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_dir = 'public/tiles'

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

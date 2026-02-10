# Preprocessing Pipeline

This directory contains scripts for downloading OSM data and generating map tiles.

## Overview

The preprocessing pipeline converts OpenStreetMap data into optimized JSON tiles for the web map renderer.

**Pipeline steps:**
1. **Fetch** - Download OSM data for Hamburg region
2. **Convert** - Process OSM PBF → GeoJSON (via Overpass API/osmium)
3. **Split** - Generate zoom-level tiles from GeoJSON

## Scripts

### `fetch-data.sh`
Downloads and converts OSM data for the Hamburg region.

**Output:** `data/hamburg-region.geojson` (~3.3 GB)

```bash
cd preprocessing
./fetch-data.sh
```

### `split-tiles.py`
Splits GeoJSON into zoom-level tiles.

**Input:** `data/hamburg-region.geojson`  
**Output:** `../public/tiles/{z}/{x}/{y}.json`

**Dependencies:** `pip install ijson`

```bash
# From repo root (recommended via justfile)
just tiles

# Or manually
python preprocessing/split-tiles.py preprocessing/data/hamburg-region.geojson
```

**Features:**
- Streams features with `ijson` (constant memory usage, handles multi-GB files)
- Uses per-zoom-level SQLite databases as intermediate storage
- Caches databases with input file fingerprint — re-runs skip parsing if GeoJSON unchanged
- Classifies features by type (water, roads, railways, buildings, landuse)
- Assigns LOD (Level of Detail) for zoom-based visibility
- Generates tiles for zoom levels 8, 11, 14
- Output: Plain JSON (no gzip for fast browser parsing)

### `split_tiles.zig` *(Work in Progress)*
Zig implementation of tile splitter for faster processing.

**Status:** Compiles but slow on large files (needs streaming JSON parser)

```bash
zig build
./zig-out/bin/split-tiles data/hamburg-region.geojson
```

## Quick Start

Using just:

```bash
# Download OSM data
just data

# Generate tiles (Python)
just tiles

# Or generate tiles (Zig - faster but WIP)
just tiles-zig

# Do both
just all
```

## Tile Format

Each tile is a GeoJSON FeatureCollection:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [...] },
      "properties": {
        "highway": "primary",
        "name": "Hauptstraße",
        "render": {
          "layer": "highways",
          "color": [253, 191, 111, 255],
          "width": 3,
          "minLOD": 1
        }
      }
    }
  ]
}
```

## Performance Notes

- **Python version:** First run streams GeoJSON into SQLite, then writes tiles. Subsequent runs with unchanged input skip directly to tile writing.
- **Memory usage:** Constant — features are streamed, not loaded into memory
- **Tile count:** ~10,000-50,000 tiles depending on zoom levels
- **Tile size:** 500 bytes - 50 KB (plain JSON)
- **Total size:** ~100-500 MB for all tiles
- **Cache files:** `data/tile_build_z{8,11,14}.db` (auto-generated, gitignored)

## Why No Gzip?

Initial tests showed gzip **slowed down** tile loading:
- Decompression overhead > bandwidth savings for small tiles
- Browser must decompress on main thread
- Plain JSON is faster to parse

**Benchmark (typical tile):**
- Compressed: 331 bytes → ~20ms fetch + 50ms decompress = **70ms**
- Uncompressed: 498 bytes → ~25ms fetch + 5ms parse = **30ms**

Result: **2-3x faster** without compression for small tiles!

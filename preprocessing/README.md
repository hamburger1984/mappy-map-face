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

## Zoom Levels and LOD (Level of Detail)

The map uses a two-tier system for progressive rendering:

### Zoom Levels (Tile Size)

Determines the geographic area covered by each tile:

| Zoom | Usage | Tile Coverage | When Used |
|------|-------|---------------|-----------|
| **Z8** | Wide view | ~10-20km per tile | View width > 10km |
| **Z11** | Medium view | ~2-5km per tile | View width 1-10km |
| **Z14** | Close view | ~500m-1km per tile | View width < 1km |

**Tile selection:** When you view the map at 10km width, the renderer loads Z8 tiles. When you zoom to 5km, it switches to Z11 tiles.

### LOD (Level of Detail)

Determines which features are rendered based on view distance:

| LOD | View Width | Features Rendered | Examples |
|-----|------------|-------------------|----------|
| **0** | > 20km | Major features only | Motorways, large rivers, forests |
| **1** | 7.5-20km | + Secondary features | Primary roads, railways, parks |
| **2** | 3-7.5km | + Buildings & details | Residential roads, buildings |
| **3** | < 3km | All features | Paths, small POIs, all details |

### Feature LOD Assignment

Each feature is assigned a minimum LOD (`minLOD`) during preprocessing:

| Feature Type | minLOD | Visibility |
|--------------|--------|------------|
| **Major roads** (motorway, trunk) | 0 | Always visible |
| **Water bodies** (rivers, lakes) | 0 | Always visible |
| **Forests** | 0 | Always visible |
| **Primary/secondary roads** | 1 | Visible at 7.5km+ |
| **Railways** | 1 | Visible at 7.5km+ |
| **Parks, green spaces** | 1 | Visible at 7.5km+ |
| **Buildings** | 2 | Visible at 3km+ |
| **Residential roads** | 2 | Visible at 3km+ |
| **Paths, footways** | 3 | Visible only when very close |
| **Small POIs** | 3 | Visible only when very close |

### Tile Content Optimization

To minimize tile size and loading time, features are only included in zoom levels where they'll actually be rendered:

```
minLOD 0 (major features)     → Tiles: Z8, Z11, Z14
minLOD 1 (secondary features) → Tiles: Z11, Z14 (skip Z8)
minLOD 2 (buildings, detail)  → Tiles: Z14 only (skip Z8, Z11)
minLOD 3 (very close detail)  → Tiles: Z14 only
```

**Example:** When viewing at 10km width (LOD 1), the renderer:
1. Uses Z11 tiles (appropriate tile size for 10km)
2. Loads only minLOD 0-1 features (major + secondary)
3. Skips minLOD 2+ features (buildings not needed at this distance)

This optimization dramatically reduces:
- Network transfer (smaller tiles)
- Parsing time (less JSON to parse)
- Memory usage (fewer features in memory)
- Render time (fewer features to classify/cull)

### View Width → Zoom Level → LOD Mapping

| View Width | Zoom Level | LOD | Features Loaded |
|------------|------------|-----|-----------------|
| 50km | Z8 | 0 | Motorways, major water, forests |
| 15km | Z8 | 1 | + Primary roads, railways |
| 10km | Z11 | 1 | Same as above |
| 5km | Z11 | 2 | + Buildings, residential roads |
| 2km | Z14 | 2 | Same as above |
| 500m | Z14 | 3 | + Paths, small POIs |

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

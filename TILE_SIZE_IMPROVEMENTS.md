# Tile Size Analysis & Improvement Plan

Based on statistics from 3 datapoints (see `tile_statistics_baseline.md`).

## Current state (3 regions: HH, SH, MV)

| Tileset | Disk size | Tiles | Scaling problem |
|---------|-----------|-------|-----------------|
| T1 | 4.74 GB | 469,057 | LineString duplication — dominates total |
| T2 | 1.52 GB | 12,684 | Scales linearly, manageable |
| T3 | 190 MB | 180 | Fine |
| T4 | 28 MB | 56 | Fine |
| **Total** | **~6.5 GB** | | |

## The fundamental problem: T1 LineString duplication

T1 uses epsilon_m=0.05 (5cm) simplification and **no clipping for LineStrings** (disabled to avoid gaps at tunnel-surface transitions). A river or boundary crossing 500 tiles is stored at full resolution in every tile.

| Type | Est. T1 size | Avg bytes/feature | Why so large |
|------|-------------|-------------------|--------------|
| boundary:administrative | 813 MB | 1,976 | State/country borders cross entire map |
| waterway:river | 337 MB | 5,755 | Rivers span entire regions |
| natural:coastline | 297 MB | 7,072 | Long coastlines, full coords per tile |
| railway:rail | 155 MB | 1,967 | Rail lines span many tiles |
| waterway:stream | 126 MB | 1,499 | Streams span many tiles |
| boundary:maritime | 86 MB | 1,029 | Maritime borders along coast |

These 6 categories alone account for **~1.8 GB** of T1's 4.7 GB. Buildings (1 GB) and short roads scale linearly and are fine.

## Projected size for target area

Target: northern Germany + Denmark + Sweden (~4-5x more area, much more coastline)

| | Current (3 regions) | Projected (7-8 regions) |
|---|---|---|
| T1 | 4.7 GB | **15-25 GB** |
| T2 | 1.5 GB | 4-6 GB |
| T3 | 190 MB | 500-800 MB |
| T4 | 28 MB | 60-100 MB |
| **Total** | **6.5 GB** | **20-32 GB** |

Sweden has ~7,600 km of coastline vs MV's ~1,700 km. Denmark is almost entirely coastline.

---

## Improvements (ordered by expected impact)

### 1. Clip LineStrings to tile bounds with generous buffer

**Impact: 60-70% T1 reduction**
**Effort: medium**
**Affects: T1 primarily**

The current exemption for LineStrings was added because Shapely `intersection()` on LineStrings creates new endpoints at clip boundaries, causing visual gaps at tunnel-surface transitions where the geometry splits.

Better approaches:
- **Clip with generous buffer** (10-20% of tile size instead of 2%) for LineStrings — a 20% buffer on T1's 400m tiles = 80m, enough to cover most tunnel-surface transitions
- **Coordinate-array truncation** — walk the coordinate array, keep all points within tile+buffer, add interpolated entry/exit points. This avoids Shapely's topology issues and preserves the original segment structure
- **Selective clipping** — only clip features that span more than N tiles (e.g., >3). Short road segments that cross 1-2 tile boundaries don't need clipping

Boundaries alone would drop from ~800 MB to ~50 MB.

### 2. Increase T1 simplification for long linear features

**Impact: 20-30% on top of clipping**
**Effort: low (config change)**
**Affects: T1**

All T1 features currently use epsilon_m=0.05 (5cm). At T1's 100m-2km view range, boundaries and coastlines don't need centimeter precision.

Suggested per-feature overrides in `tileset_config.yaml`:

| Feature type | Current epsilon | Suggested epsilon | Rationale |
|-------------|----------------|-------------------|-----------|
| boundary:administrative | 0.05m | 1.0m | Invisible at 100m+ view |
| boundary:maritime | 0.05m | 1.0m | Same |
| natural:coastline | 0.05m | 0.5m | Slightly more visible |
| waterway:river | 0.05m | 0.3m | Preserve meandering |
| waterway:stream | 0.05m | 0.3m | Same |
| waterway:canal | 0.05m | 0.3m | Same |
| railway:rail | 0.05m | 0.3m | Preserve curves |
| roads | 0.05m | 0.05m | Keep — visible curves at close zoom |
| buildings | 0.05m | 0.05m | Keep — rectangles are sensitive |

### 3. Strip unnecessary properties from tiles

**Impact: 10-15% all tilesets**
**Effort: low**
**Affects: all tilesets**

Features carry all OSM properties. Most are unused by the renderer. Strip to only renderer-relevant tags during tile generation:

```
highway, railway, name, tunnel, bridge, layer, building, natural, landuse,
waterway, boundary, admin_level, place, population, amenity, shop, tourism,
historic, construction, planned, proposed, public_transport, leisure, aeroway,
water, bicycle_road, cyclestreet, tidal
```

Implementation: add a `strip_properties()` step in `split_geojson_into_tiles()` after `_render` is set, before serialization.

### 4. Coordinate quantization

**Impact: 15-25% all tilesets**
**Effort: low-medium**
**Affects: all tilesets, especially coordinate-heavy features**

Round coordinates to appropriate precision during serialization:
- T1 (400m tiles): 6 decimal places (~0.11m) is sufficient
- T2 (2500m tiles): 5 decimal places (~1.1m)
- T3 (25000m tiles): 4 decimal places (~11m)
- T4 (50000m tiles): 4 decimal places

Currently coordinates are stored as full float64 (e.g., `10.006123456789`). Truncating to 6 decimals saves 3-5 characters per coordinate × 2 (lon+lat) × millions of coordinates.

Implementation: custom JSON serializer that rounds coordinates, or post-process the coordinate arrays.

### 5. Compress tiles with gzip/brotli

**Impact: 70-85% transfer size reduction**
**Effort: low**
**Affects: all tilesets (transfer only, not disk)**

Serve `.json.gz` or `.json.br` files. JSON with repeated property keys and similar coordinate prefixes compresses very well. The browser handles decompression transparently with correct `Content-Encoding` header.

Options:
- Pre-compress during tile generation (save as `.json.gz` alongside `.json`)
- Let the web server compress on-the-fly (nginx `gzip_static`, Apache `mod_deflate`)
- For static hosting: pre-compress only

This doesn't reduce disk usage but dramatically reduces load times. Can be combined with all other approaches.

### 6. Binary tile format (future)

**Impact: 40-60% all tilesets**
**Effort: high**
**Affects: all tilesets**

JSON is inherently verbose (property keys repeated, coordinates as text). A compact binary format with:
- Indexed string table for property keys/values
- Fixed-point integer coordinates (quantized to tile precision)
- Varint-encoded coordinate deltas

Options: FlatGeobuf, protobuf/MVT, or a custom format. Requires renderer changes to decode. Best combined with compression (brotli on binary is extremely compact).

This is the nuclear option — likely only needed if the target area grows to all of Europe.

---

## Recommended implementation order

1. **LineString clipping with generous buffer** — biggest single win, addresses root cause
2. **Per-feature simplification in T1** — config-only change, quick follow-up
3. **Property stripping** — small code change, helps all tilesets
4. **Coordinate quantization** — moderate effort, good returns
5. **Gzip compression** — easy win for transfer size
6. **Binary format** — only if needed for continental scale

With improvements 1-4, the projected size for northern Germany + Denmark + Sweden should drop from 20-32 GB to approximately **5-10 GB**.

# Tile Size Analysis & Improvement Plan

Based on 4 datapoints (see `tile_statistics_baseline.md`).

## Growth across datapoints

| Tileset | DP1 (2 regions) | DP2/3 (3 regions) | DP4 (5 regions) | DP2→DP4 |
|---------|-----------------|-------------------|-----------------|---------|
| T1 | 2.73 GB / 308K tiles | 4.74 GB / 469K tiles | 14.85 GB / 1.006M tiles | **3.1x** |
| T2 | 1.23 GB / 8.5K tiles | 1.52 GB / 12.7K tiles | 5.73 GB / 50K tiles | **3.8x** |
| T3 | 140 MB / 120 tiles | 190 MB / 180 tiles | 710 MB / 606 tiles | **3.7x** |
| T4 | 22 MB / 36 tiles | 28 MB / 56 tiles | 82.5 MB / 177 tiles | **2.9x** |
| **Total** | **~4.1 GB** | **~6.5 GB** | **~21.4 GB** | **3.3x** |

Area roughly doubled (3→5 regions), but tile data grew 3-4x → **superlinear scaling confirms LineString duplication**.

## Changes applied between DP2/3 and DP4

1. **Tag matching fix** (`match_all` for boundaries) — reduced admin levels included from 5 (levels 2,4,6,7,8) to 3 (levels 2,4,6)
2. **Building/platform clipping exclusion** — prevents tile-edge artifacts, negligible size impact
3. **Area expansion** — added Niedersachsen + Denmark

## Effect of tag matching fix on boundaries

| | DP2/3 (3 regions) | DP4 (5 regions) | Per-region avg |
|---|---|---|---|
| T1 boundary:administrative | 813 MB | 447 MB | 89 MB (was 271 MB) |
| T1 boundary:maritime | 86 MB | (now separate) | — |
| T2 boundary:administrative | 33 MB | 196 MB | 39 MB (was 11 MB) |

T1 boundary size dropped from 813→447 MB despite adding 2 regions — the `match_all` fix eliminated admin levels 7/8 which were the bulk of the duplicate data. **Per-region boundary cost dropped 3x.** However, T2 boundary avg bytes jumped from 1277→7393, suggesting boundary LineString duplication is now the dominant T2 problem too.

## Current state (5 regions: HH, SH, MV, NI, DK)

| Tileset | Disk size | Tiles | Primary scaling problems |
|---------|-----------|-------|------------------------|
| T1 | 14.85 GB | 1,006,190 | Coastline (1.4 GB), rivers (1.25 GB), buildings (5.15 GB) |
| T2 | 5.73 GB | 49,977 | Buildings (4.08 GB), boundary duplication (238 MB) |
| T3 | 710 MB | 606 | Landuse (508 MB) — scales linearly, OK |
| T4 | 82.5 MB | 177 | Fine |
| **Total** | **~21.4 GB** | | |

## The two fundamental problems

### Problem 1: T1 LineString duplication (unchanged)

LineStrings are not clipped to tile bounds. A river or coastline crossing 500 tiles is stored at full resolution in every tile.

| Type | DP4 T1 size | Avg bytes/feature | Growth factor |
|------|------------|-------------------|---------------|
| natural:coastline | 1.39 GB | 8,404 | 4.7x from DP2/3 (Denmark!) |
| waterway:river | 1.25 GB | 6,121 | 3.7x (Elbe, Weser, Danish rivers) |
| boundary:administrative | 447 MB | 4,852 | 0.55x (match_all fix helped) |
| railway:rail | 394 MB | 1,473 | 2.5x |
| waterway:stream | 332 MB | 1,115 | 2.6x |
| waterway:canal | 176 MB | 2,040 | 4.4x |

These 6 categories = **4.0 GB** of T1's 14.85 GB. Coastline is now the #1 problem (Denmark has enormous coastline).

### Problem 2: Buildings dominate T1+T2

| Tileset | Building size | % of tileset |
|---------|-------------|-------------|
| T1 | 5.15 GB | 35% |
| T2 | 4.08 GB | 71% |

Buildings scale linearly (each building is in ~1 tile), so this is expected. But at 9.2 GB combined, property stripping and coordinate quantization would have significant absolute impact here.

## Projected size for target area

Target: add Sweden (~4x Denmark's coastline, large area)

| | Current (5 regions) | With Sweden (~7 regions) |
|---|---|---|
| T1 | 14.85 GB | **25-35 GB** |
| T2 | 5.73 GB | 9-12 GB |
| T3 | 710 MB | 1.0-1.5 GB |
| T4 | 82.5 MB | 120-180 MB |
| **Total** | **21.4 GB** | **35-49 GB** |

Sweden's 7,600 km of coastline would make the coastline problem catastrophic without clipping.

---

## Improvements (ordered by expected impact)

### 1. Clip LineStrings to tile bounds with generous buffer

**Impact: 60-70% T1 reduction (~9 GB saved)**
**Effort: medium**
**Affects: T1 primarily, also T2 boundaries**

The current exemption for LineStrings was added because Shapely `intersection()` creates new endpoints at clip boundaries, causing visual gaps at tunnel-surface transitions.

Better approaches:
- **Clip with generous buffer** (10-20% of tile size) — a 20% buffer on T1's 400m tiles = 80m, enough for tunnel-surface transitions
- **Coordinate-array truncation** — walk the coordinate array, keep points within tile+buffer, interpolate entry/exit points. Preserves original segment structure
- **Selective clipping** — only clip features spanning >3 tiles. Short road segments don't need clipping

Coastline alone would drop from 1.4 GB to ~100 MB. Rivers from 1.25 GB to ~80 MB.

### 2. Strip unnecessary properties from tiles

**Impact: 15-25% all tilesets (~4 GB saved)**
**Effort: low**
**Affects: all tilesets, especially buildings**

Features carry all OSM properties. Most are unused by the renderer. The `amenity` group at 93 MB in T1 and `shop` at 65 MB are almost entirely wasted properties on buildings.

Keep only renderer-relevant tags:
```
highway, railway, name, tunnel, bridge, layer, building, natural, landuse,
waterway, boundary, admin_level, maritime, place, population, amenity, shop,
tourism, historic, construction, planned, proposed, public_transport, leisure,
aeroway, water, bicycle_road, cyclestreet, tidal, sport, addr:housenumber,
addr:street
```

With 9.2 GB of buildings, even 15% savings = 1.4 GB from buildings alone.

### 3. Coordinate quantization

**Impact: 15-25% all tilesets (~3-4 GB saved)**
**Effort: low-medium**
**Affects: all tilesets, especially coordinate-heavy LineStrings**

Round coordinates to appropriate precision:
- T1 (400m tiles): 6 decimal places (~0.11m)
- T2 (2500m tiles): 5 decimal places (~1.1m)
- T3 (25km tiles): 4 decimal places (~11m)
- T4 (50km tiles): 4 decimal places

Coordinates are stored as full float64 (e.g., `10.006123456789`). Truncating to 6 decimals saves 3-5 chars per coordinate × 2 (lon+lat) × hundreds of millions of coordinates.

### 4. Increase T1 simplification for long linear features

**Impact: 10-20% on top of clipping**
**Effort: low (config change)**
**Affects: T1**

All T1 features use epsilon_m=0.05 (5cm). At T1's 100m-2km view range, coastlines and rivers don't need centimeter precision.

| Feature type | Current epsilon | Suggested epsilon |
|-------------|----------------|-------------------|
| boundary:administrative | 0.05m | 1.0m |
| maritime boundaries | 0.05m | 1.0m |
| natural:coastline | 0.05m | 0.5m |
| waterway:river/stream/canal | 0.05m | 0.3m |
| railway:rail | 0.05m | 0.3m |
| roads, buildings | 0.05m | 0.05m (keep) |

### 5. Compress tiles with gzip/brotli

**Impact: 70-85% transfer size reduction**
**Effort: low**
**Affects: transfer only, not disk**

Pre-compress as `.json.gz`. JSON with repeated property keys and similar coordinate prefixes compresses extremely well. Transparent browser decompression.

### 6. Binary tile format (future)

**Impact: 40-60% all tilesets**
**Effort: high**
**Affects: all tilesets**

FlatGeobuf, protobuf/MVT, or custom format. Only needed for continental scale.

---

## Recommended implementation order

1. **LineString clipping** — biggest single win, addresses root cause (~9 GB)
2. **Property stripping** — easy, helps all tilesets (~4 GB)
3. **Coordinate quantization** — moderate effort, good returns (~3 GB)
4. **T1 simplification overrides** — config-only change
5. **Gzip compression** — easy win for transfer
6. **Binary format** — only if needed

With improvements 1-4, projected size for 5 regions: **~8-12 GB** (down from 21.4 GB).
With improvements 1-4, projected size for 7 regions (+ Sweden): **~12-18 GB** (down from 35-49 GB).

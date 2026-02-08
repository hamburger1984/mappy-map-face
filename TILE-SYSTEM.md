# Progressive Tile System Architecture

## Overview

This project uses a **progressive tile-based loading system** for efficient map rendering. Instead of loading a monolithic 500MB GeoJSON file, the map loads only visible tiles with features sorted by importance.

## Key Benefits

1. **Fast initial load**: Major features (highways, railways, forests) load instantly
2. **Progressive enhancement**: Details stream in as tiles load
3. **Memory efficient**: Only visible tiles in memory (~10MB vs 500MB)
4. **Scalable**: Can extend from Hamburg to all of Europe
5. **Bandwidth efficient**: Load only what you see

## Tile Grid

Uses **Web Mercator** projection (same as Google Maps, OpenStreetMap):
- Standard tile coordinates: `{zoom}/{x}/{y}`
- Each tile covers a geographic area
- Higher zoom = smaller area, more tiles

### Zoom Levels

We use 3 zoom levels as "buckets":

- **Z8** (far away): Covers large area, few tiles
  - Used for renderer zoom 0-5
  - Contains: Motorways, railways, forests, large water bodies
  
- **Z11** (medium): Moderate coverage
  - Used for renderer zoom 6-10
  - Contains: Z8 features + primary roads, parks, rivers
  
- **Z14** (close up): Detailed coverage
  - Used for renderer zoom 11+
  - Contains: Z11 features + residential roads, buildings, all details

## Feature Classification

Features are classified by **importance** for progressive loading:

### Priority 100 (Always Load First)
- Large water bodies (lakes, reservoirs)
- Importance: Critical landmarks

### Priority 90
- Forests and wooded areas
- Importance: Major green spaces

### Priority 80
- Motorways and trunk roads
- Importance: Primary navigation

### Priority 70
- Railways (rail, light_rail, subway, tram)
- Importance: Major transit infrastructure

### Priority 60
- Major rivers and canals
- Importance: Significant water features

### Priority 50
- Primary and secondary roads
- Importance: Main road network

### Priority 40
- Parks, meadows, farmland
- Importance: Land use visualization

### Priority 30
- Tertiary and residential roads
- Importance: Local navigation

### Priority 20
- Buildings
- Importance: Urban detail

### Priority 10
- Small roads and paths
- Importance: Fine detail

### Priority 5
- Named POIs (shops, amenities)
- Importance: Optional detail

## File Structure

```
public/tiles/
├── index.json           # Metadata (bounds, zoom levels, center)
├── 8/                   # Zoom level 8 (far)
│   ├── 134/
│   │   ├── 81.json.gz
│   │   └── 82.json.gz
│   └── 135/
│       └── 81.json.gz
├── 11/                  # Zoom level 11 (medium)
│   ├── 1072/
│   │   ├── 652.json.gz
│   │   └── 653.json.gz
│   └── ...
└── 14/                  # Zoom level 14 (close)
    ├── 8576/
    │   ├── 5216.json.gz
    │   └── 5217.json.gz
    └── ...
```

## Data Flow

### 1. Preparation (split-tiles.py)

```
hamburg.geojson (500MB)
    ↓
Classify features by importance
    ↓
Calculate tile intersections for each feature
    ↓
Group by tile coordinates
    ↓
Sort by importance within tile
    ↓
Write compressed tiles (~10-100KB each)
```

### 2. Runtime Loading

```
User opens map at zoom level Z
    ↓
Determine which tile zoom to use (Z8/Z11/Z14)
    ↓
Calculate visible tiles from viewport
    ↓
Fetch visible tiles (in parallel)
    ↓
Decompress and parse
    ↓
Render features (high priority first)
    ↓
As user pans/zooms, fetch new tiles
```

## Tile Size Examples

For Hamburg (30km x 20km area):

- **Z8**: ~4-9 tiles (whole city visible)
  - Each tile: ~50-200 KB compressed
  - Total for viewport: ~500 KB
  
- **Z11**: ~16-36 tiles (city districts)
  - Each tile: ~100-500 KB compressed
  - Total for viewport: ~2-3 MB
  
- **Z14**: ~256+ tiles (neighborhoods)
  - Each tile: ~50-200 KB compressed
  - Total for viewport: ~5-10 MB (but only load visible)

Compare to monolithic: 500 MB → 73 MB gzipped → **Still 73 MB to load everything**

With tiles: **Only 500 KB - 10 MB** depending on zoom level!

## Scaling to Europe

The tile system is designed to scale:

1. **Process each region separately**:
   - Hamburg → ~1000 tiles
   - Germany → ~50,000 tiles
   - Europe → ~500,000 tiles

2. **Shared tile server**:
   - All tiles in one directory
   - Client fetches only what it needs
   - CDN-friendly (static files)

3. **Progressive enhancement**:
   - Z8: Entire Europe is ~100-500 tiles
   - Z14: Europe is 500k tiles, but user only sees ~50 at once
   - Fetch on-demand as user explores

4. **Storage**:
   - Hamburg: ~100 MB of tiles
   - Germany: ~2-5 GB of tiles
   - Europe: ~20-50 GB of tiles
   - Affordable on modern servers/CDN

## Implementation Status

### ✅ Completed
- Tile splitting algorithm
- Feature classification system
- Web Mercator tile coordinate calculation
- Gzip compression
- Priority sorting within tiles

### 🚧 In Progress
- Running tile split on Hamburg data
- Tile-based data fetching in renderer
- Viewport → tile calculation
- Tile caching

### 📋 Todo
- Progressive rendering (priority-based)
- Loading progress UI
- Tile prefetching for smooth panning
- Service Worker caching
- Multi-region support

## Usage

### Generate Tiles

```bash
# From GeoJSON
./split-tiles.py public/hamburg.geojson

# Output to public/tiles/
# Creates compressed tiles + index.json
```

### Tile Index

`public/tiles/index.json` contains:
```json
{
  "bounds": {
    "minLon": 9.77,
    "maxLon": 10.21,
    "minLat": 53.415,
    "maxLat": 53.685
  },
  "zoom_levels": [8, 11, 14],
  "tile_count": 1234,
  "center": {
    "lon": 9.99,
    "lat": 53.55
  }
}
```

## Technical Details

### Tile Coordinate Calculation

```javascript
// Lon → Tile X
function lonToTileX(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

// Lat → Tile Y (Web Mercator)
function latToTileY(lat, zoom) {
  const latRad = lat * Math.PI / 180;
  return Math.floor(
    (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * Math.pow(2, zoom)
  );
}
```

### Feature → Tile Assignment

Features can span multiple tiles:
- Calculate bounding box of feature
- Find all tiles that intersect bbox
- Include feature in all intersecting tiles
- Duplication is OK - keeps tiles self-contained

### Compression

- GeoJSON → gzip level 9
- Typical: 5-10x compression ratio
- Browser DecompressionStream for fast decompression

## Comparison: Before vs After

### Before (Monolithic)
```
Load time: 5-15 seconds (73 MB download)
Memory: 500 MB+ (full GeoJSON in RAM)
Initial render: 3-5 seconds (process all features)
Pan: Smooth (everything in memory)
Zoom: Smooth (everything in memory)
Scalability: Limited (can't load all of Europe)
```

### After (Tiled)
```
Load time: 100-500ms (first tiles only)
Memory: 10-50 MB (only visible tiles)
Initial render: <100ms (major features only)
Pan: Progressive (new tiles stream in)
Zoom: Progressive (higher detail streams in)
Scalability: Unlimited (load what you see)
```

## Future Enhancements

1. **Vector Tiles (MVT)**: Binary Protocol Buffer format (even smaller)
2. **Server-side rendering**: Generate tiles on-demand
3. **Tile versioning**: Update tiles without rebuilding all
4. **Spatial index**: R-tree for faster tile queries
5. **WebGL rendering**: GPU-accelerated for thousands of features

## References

- [OpenStreetMap Tile Standards](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
- [Mapbox Vector Tiles](https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/)
- [Web Mercator Projection](https://en.wikipedia.org/wiki/Web_Mercator_projection)

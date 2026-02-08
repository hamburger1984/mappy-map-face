# Hamburg OSM Renderer - Quick Start Guide

## Prerequisites

Install required tools:

```bash
# macOS
brew install zig osmium-tool

# Linux (Ubuntu/Debian)
sudo apt-get install zig osmium-tool python3
```

## Complete Setup (Fresh Start)

```bash
# 1. Build WASM module
just build

# 2. Download OSM data and generate tiles
just data

# 3. Start development server
just serve
```

Then open: http://localhost:8080

## Common Tasks

### Rebuild Everything
```bash
just all        # Build WASM + fetch data + generate tiles
```

### Regenerate Tiles Only
```bash
just tiles      # Use existing hamburg.geojson to create tiles
```

### Development Mode
```bash
just dev        # Build WASM + start server
```

### Clean Up
```bash
just clean      # Remove build artifacts only
just clean-all  # Remove everything (data + tiles + builds)
```

## What Gets Generated

After running `just data`, you'll have:

```
public/
├── hamburg.osm.pbf           # Full Hamburg OSM data (~50MB)
├── hamburg-center.osm.pbf    # City center extract (~47MB)
├── hamburg.geojson           # Uncompressed GeoJSON (~502MB)
├── hamburg.geojson.gz        # Compressed GeoJSON (~73MB)
└── tiles/                    # Progressive loading tiles (~89MB)
    ├── index.json            # Tile metadata
    ├── 8/                    # Zoom 8 (far view, 2 tiles)
    ├── 11/                   # Zoom 11 (medium, 16 tiles)
    └── 14/                   # Zoom 14 (close, 490 tiles)
```

## Map Controls

Once the map loads:

- **Zoom**: Use +/- buttons in top-right corner
- **Pan**: Click and drag the map
- **Zoom to point**: Double-click on a location
- **Feature info**: Hover over features to see details

## Performance Notes

### Initial Load
- **Before tiles**: 73MB download, 3-5 seconds
- **With tiles**: 4-10MB download, <1 second

### Zoom Levels
- **Far view** (zoom < 3): Loads Z8 tiles, shows major features (water, forests, railways, highways)
- **Medium view** (zoom 3-20): Loads Z11 tiles, adds secondary roads, parks, large buildings
- **Close view** (zoom > 20): Loads Z14 tiles, shows all details including small streets and all buildings

### Caching
- Tiles are cached in browser memory
- Panning at the same zoom level = instant (no network requests)
- Zooming loads new tiles only if not already cached

## Troubleshooting

### "WASM module not found"
```bash
just build
```

### "Failed to load map data"
```bash
just data
```

### "Tiles not loading"
Check browser console. If you see 404 errors for tiles:
```bash
just tiles
```

### "Map shows only outlines, no filled areas"
This was a bug in earlier versions. Make sure you have the latest code:
```bash
git pull
just build
```

### Polygons appearing as gray dots
This should be fixed now. The renderer uses `adjustedBounds` for proper coordinate transformation. If you still see this issue, check the browser console for errors.

## File Structure

```
osm-renderer/
├── src/
│   └── map_renderer.zig      # WASM rendering engine
├── public/
│   ├── index.html             # Main UI
│   ├── map_renderer.js        # JavaScript integration
│   ├── map_renderer.wasm      # Compiled WASM (generated)
│   └── tiles/                 # Tile system (generated)
├── build.zig                  # Zig build configuration
├── justfile                   # Command runner (like Makefile)
├── fetch-data.sh              # OSM data download script
├── split-tiles.py             # Tile generation script
└── start-server.sh            # Simple HTTP server
```

## Scaling Beyond Hamburg

To extend to other regions:

1. **Edit fetch-data.sh**: Change the bounding box and download URL
2. **Run data pipeline**: `just data` 
3. **Done**: The tile system automatically adapts

Example for Berlin:
```bash
# In fetch-data.sh, change:
# - Download URL to berlin-latest.osm.pbf
# - Bounding box to Berlin coordinates (52.5°N, 13.4°E)
# - Update centerLat/centerLon in map_renderer.js
```

The tile system scales to:
- **Single city**: ~500MB → 89MB tiles (current)
- **Country**: ~50GB → 8-12GB tiles
- **Continent**: ~500GB → 80-120GB tiles

Client performance remains constant (only loads 2-4 tiles per viewport).

## Advanced: Customizing Tile Generation

Edit `split-tiles.py` to adjust:

- **Zoom levels**: Change `TILE_ZOOMS = [8, 11, 14]`
- **Feature priorities**: Modify `classify_feature_importance()`
- **Tile bounds**: Update `TILE_BOUNDS` for different regions

Then regenerate:
```bash
just tiles
```

## Next Steps

- Customize map styling in `map_renderer.js` → `classifyFeature()`
- Add more zoom levels for larger/smaller scales
- Implement vector tiles (MVT) for even better compression
- Add CDN support for multi-region deployment
- Integrate search/geocoding functionality

## Support

See documentation:
- `TILE-SYSTEM.md` - Architecture details
- `TILE-IMPLEMENTATION.md` - Performance metrics
- `README.md` - Project overview

Check git log for recent changes:
```bash
git log --oneline
```

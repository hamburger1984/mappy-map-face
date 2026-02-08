# Quick Setup Guide

## First Time Setup

```bash
# 1. Build the WASM module and download OSM data
make all

# 2. Start the web server
make serve

# 3. Open http://localhost:8080 in your browser
```

That's it! The map should render automatically when the page loads.

## Individual Commands

```bash
make build    # Only compile Zig to WASM
make data     # Only download/process OSM data
make clean    # Remove build artifacts
make serve    # Start web server
make help     # Show all commands
```

## What Gets Downloaded

The `make data` command (or `./fetch-data.sh`) will:

1. Download Hamburg OSM extract from Geofabrik (~50 MB)
2. Extract city center area (9.95°-10.05° E, 53.53°-53.58° N)
3. Convert to GeoJSON format (~60 MB)

All data files are excluded from git (see `.gitignore`).

## Troubleshooting

### "osmium: command not found"

Install osmium-tool:
- **macOS**: `brew install osmium-tool`
- **Ubuntu/Debian**: `sudo apt-get install osmium-tool`

### "Zig version mismatch"

This project uses Zig 0.15.2. Check your version:
```bash
zig version
```

### Canvas stays blank after clicking "Render Map"

1. Check browser console for errors (F12)
2. Verify the GeoJSON file exists: `ls -lh public/hamburg.geojson`
3. Try running `make data` again to reprocess

### Port 8080 already in use

Kill existing server:
```bash
pkill -f "http.server 8080"
```

Or use a different port:
```bash
cd public && python3 -m http.server 8888
```

## File Structure After Build

```
osm-renderer/
├── src/
│   └── map_renderer.zig          # Source code
├── public/
│   ├── index.html                # Web interface
│   ├── map_renderer.js           # JS integration
│   ├── map_renderer.wasm         # Compiled (generated)
│   ├── hamburg.osm.pbf           # Downloaded data
│   ├── hamburg-center.osm.pbf    # Extracted area
│   └── hamburg.geojson           # Processed (generated)
└── zig-out/
    └── bin/
        └── map_renderer.wasm     # Build output
```

Files marked "(generated)" are created during build/data fetch and are not in git.

## Development Workflow

1. **Edit Zig code** (`src/map_renderer.zig`)
2. **Rebuild**: `make build`
3. **Reload browser** to see changes

No need to restart the server - just refresh the page!

## Customizing the Map Area

Edit `fetch-data.sh` and change the bounding box:

```bash
# Current: Hamburg city center
osmium extract -b 9.95,53.53,10.05,53.58 ...

# Example: Larger area
osmium extract -b 9.8,53.4,10.2,53.7 ...
```

Then run `make data` to regenerate.

## Performance Tips

- The renderer can handle 100,000+ features
- Larger bounding boxes = more data = longer render time
- GeoJSON is verbose; consider using smaller areas for testing
- WASM module is only 6-10 KB (very efficient!)

## Next Steps

- Experiment with different map areas
- Modify colors in `public/map_renderer.js` (search for "color = {")
- Add new feature types (parks, rivers, etc.)
- Export your rendered maps as PNG

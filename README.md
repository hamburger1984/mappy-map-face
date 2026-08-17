# OSM Map Renderer

A tile-based OpenStreetMap renderer with a Python preprocessing pipeline and an interactive JavaScript/Canvas2D viewer.

## Quick Start

```bash
# Set up Python environment
just setup

# Download OSM data and generate tiles
just all

# Start the map viewer
just serve
```

Then open http://localhost:8888.

## Prerequisites

- Python 3.10+
- [Just](https://just.systems) command runner
- [osmium-tool](https://osmcode.org/osmium-tool/) (for step 2)
- Node.js + npm (for tests only)

## Commands

| Command | Description |
|---------|-------------|
| `just setup` | Initialize Python venv and install dependencies |
| `just all` | Setup, download, and generate tiles for all regions |
| `just build` | Download, convert, and tile (skips fresh regions) |
| `just serve` | Start dev server at http://localhost:8888 |
| `just add-region <name>` | Download and tile a new region |
| `just update-region <name>` | Re-tile from cached GeoJSON |
| `just list-regions` | Show configured regions with build status |
| `just list-regions-remote [query]` | Browse Geofabrik regions |
| `just clean` | Remove generated tiles |

Run `just` with no arguments to see all available commands.

## Architecture

The project has two main parts:

1. **Preprocessing pipeline** (Python) -- Downloads OSM PBF data, converts to GeoJSON, and generates gzipped JSON tiles at multiple zoom levels.
2. **Rendering engine** (JavaScript) -- Interactive Canvas2D map with Web Workers for off-thread tile loading, LRU caching, and progressive rendering.

See [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) for detailed documentation.

### Tilesets

| Tileset | View Range | Purpose |
|---------|-----------|---------|
| t1 | 100m -- 2km | Detailed street view |
| t2 | 3km -- 7.5km | City view |
| t2b | 7.5km -- 20km | Wide city view |
| t3 | 20km -- 150km | Regional view |
| t4 | 150km -- 400km | Overview |
| t5 | 400km -- 750km | Continental |
| t6 | 750km -- 1000km | Ultra-wide |

### Key Files

```
preprocessing/
  step_1_download.py          # Downloads OSM PBF files
  step_2_convert_to_geojson.py # Converts PBF to GeoJSON
  step_3_generate_tiles.py    # Generates tiles with feature classification
  run_staggered.py            # Orchestrates full pipeline per region
  regions.json                # Configured regions to build

public/
  index.html                  # Map viewer interface
  map_renderer.js             # Canvas2D rendering engine
  map_theme.js                # Color and style definitions
  tile_worker.js              # Web Worker for tile loading
  tileset_config.json         # Generated tileset config (from YAML)

tileset_config.yaml           # Tileset feature definitions (source of truth)
```

## Testing

```bash
npm test                      # Run all Playwright tests
npm run test:headed           # Run tests with visible browser
npm run benchmark             # Run performance benchmarks
```

## NixOS

A NixOS module is available in `nix/module.nix`. See the flake for integration.

## License

See repository for license details.

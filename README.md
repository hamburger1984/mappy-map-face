# OpenStreetMap Renderer

A high-performance map renderer using OpenStreetMap data with Canvas2D rendering and progressive tile loading.

## Features

- **Progressive Tile Loading**: Map data split into tiles (Z8, Z11, Z14) for efficient loading at different zoom levels
- **Real OpenStreetMap Data**: Uses actual map data from Geofabrik for northern Germany and southern Denmark
- **Canvas2D Rendering**: Direct Canvas2D API for fast visualization with hardware acceleration
- **Level-of-Detail (LOD)**: Automatic feature culling based on zoom level for optimal performance
- **Feature-based Rendering**: Different map features (roads, buildings, water, forests, POIs) rendered with appropriate colors and styles
- **Interactive Navigation**: 
  - 🖱️ Mouse wheel to zoom in/out
  - 🤚 Click and drag to pan around the map
  - 📱 Touch gestures for mobile devices
  - 🔍 Zoom buttons and slider
- **Feature Inspection**:
  - Hover over features to see tooltips with details
  - Info panel displays comprehensive feature properties
  - Detect streets, buildings, water bodies, and points of interest
- **POI Categories**: Toggle visibility of 9 POI categories (Food & Drink, Shopping, Health, etc.)
- **Real-World Units**: Zoom displayed in actual distances (meters/kilometers), not abstract zoom factors
- **Export Capability**: Save rendered maps as PNG images

## Architecture

### Components

1. **Preprocessing Pipeline** (`preprocessing/`)
   - **fetch-data.sh**: Downloads OSM data for the covered regions
   - **split-tiles.py**: Processes GeoJSON → progressive tiles (Python)
   - **split_tiles.zig**: Alternative Zig implementation (WIP, faster)
   - Pre-classifies features with rendering metadata
   - Generates plain JSON tiles at zoom levels 8, 11, 14
   - Assigns features to appropriate zoom levels based on importance

2. **JavaScript Renderer** (`public/map_renderer.js`)
   - Progressive tile loading based on viewport
   - Canvas2D rendering with layered approach (water → land → roads → buildings → POIs)
   - Level-of-detail system for performance optimization
   - Feature hit detection for tooltips
   - Real-world coordinate system with view width in meters

3. **HTML Interface** (`public/index.html`)
   - Clean, modern UI with zoom controls
   - POI category toggles
   - Performance statistics display
   - Info panel for feature details

## Project Structure

```
osm-renderer/
├── preprocessing/          # Data processing pipeline
│   ├── fetch-data.sh       # OSM data download
│   ├── split-tiles.py      # Tile generation (Python)
│   ├── split_tiles.zig     # Tile generation (Zig, WIP)
│   └── README.md           # Preprocessing documentation
├── justfile                # Command runner recipes
├── build.zig               # Zig build configuration
├── public/                 # Web application
│   ├── index.html          # Web interface
│   ├── map_renderer.js     # Canvas2D renderer
│   └── tiles/              # Generated tile data
│       ├── 8/              # Z8: Major features (motorways, railways)
│       ├── 11/             # Z11: + Secondary roads, parks
│       └── 14/             # Z14: + All details (buildings, etc.)
```

## Quick Start

### Prerequisites

- Python 3.7+ (for tile generation, with `ijson` package: `pip install ijson`)
- osmium-tool (for processing OSM data)
  - macOS: `brew install osmium-tool`
  - Ubuntu/Debian: `apt-get install osmium-tool`
  - Windows: `conda install -c conda-forge osmium-tool` or download from [osmcode.org](https://osmcode.org/osmium-tool/)
- ogr2ogr (for OSM → GeoJSON conversion)
  - macOS: `brew install gdal`
  - Ubuntu/Debian: `apt-get install gdal-bin`
  - Windows: Included with [OSGeo4W](https://trac.osgeo.org/osgeo4w/) or `conda install -c conda-forge gdal`
- just (command runner, optional but recommended)
  - macOS: `brew install just`
  - Windows: `scoop install just` or download from [GitHub](https://github.com/casey/just/releases)
  - Linux: See [installation guide](https://github.com/casey/just#installation)

### Setup and Run

Using `just` (recommended):

```bash
# See all available commands
just

# One-command setup: download OSM data + generate tiles
just build

# Start the development server
just serve
```

The `just build` command:
- Downloads OSM files if missing or >30 days old (5 regions: Hamburg, Schleswig-Holstein, Mecklenburg-Vorpommern, NRW, Denmark)
- Skips tile rebuild if source files haven't changed (smart fingerprinting)
- Processes files in parallel (default: 3 workers)
- Generates tiles at zoom levels Z8, Z11, Z14

Advanced usage:

```bash
# Use more/fewer parallel workers
python preprocessing/build-tiles.py --jobs 5

# See all options
python preprocessing/build-tiles.py --help
```

Manual setup:

```bash
# Download OSM data
cd preprocessing
./fetch-data.sh  # or fetch-data.ps1 on Windows

# Build tiles (from repo root)
python preprocessing/build-tiles.py

# Start server
cd public && python3 -m http.server 8888
```

Then open your browser to: `http://localhost:8888`

### Interactive Controls

Once the map loads:
- **Zoom**: Scroll mouse wheel, or use +/- buttons and slider
- **Pan**: Click and drag
- **Inspect**: Hover over features to see tooltips and info panel
- **POI Toggle**: Click category buttons to show/hide POI types
- **Reset**: Click "Reset View" to return to initial 10km view
- **Export**: Save the current view as PNG

## How It Works

### Progressive Tile System

Map data is split into three zoom levels:

- **Z8** (Wide view, >10km): Motorways, primary roads, railways, forests, major water bodies
- **Z11** (Medium view, 1-10km): + Secondary/tertiary roads, parks, rivers
- **Z14** (Close view, <1km): + Residential roads, buildings, all details

Tiles are loaded dynamically based on the current viewport and zoom level.

### Level of Detail (LOD)

Features are assigned minimum LOD values:
- **LOD 0** (>20km view): Only major infrastructure (motorways, primary roads, rail, major water)
- **LOD 1** (7.5-20km): + Secondary features
- **LOD 2** (3-7.5km): + Most features
- **LOD 3** (<3km): All details (buildings, paths, small POIs)

### Rendering Pipeline

1. **Background**: Sea blue (areas without data show as sea)
2. **Layer Order** (bottom to top):
   - Natural background (parks, meadows)
   - Forests
   - Water areas (lakes, rivers)
   - Landuse areas (residential, commercial, industrial)
   - Buildings
   - Tunnels (semi-transparent)
   - Waterways (as lines)
   - Surface roads (with outlines, sorted by priority)
   - Surface railways (with detailed rail pattern when zoomed in)
   - POI points

### Real-World Coordinate System

The renderer uses actual distances rather than abstract zoom factors:
- View width specified in meters (e.g., 10,000m = 10km)
- Zoom levels: 100m (max zoom) to 200km (min zoom)
- UI displays: "10.0km wide" instead of "30x zoom"

### Feature Classification

Features are pre-classified during tile generation:
- **Highways**: Color-coded by type (motorway=orange, primary=yellow, etc.)
- **Railways**: Detailed pattern with gauge-accurate rail spacing when zoomed in
- **Buildings**: Light grey/tan
- **Water**: Blue
- **Forests**: Dark green
- **Parks/Nature**: Light green
- **POIs**: 9 categories with distinct colors and icon glyphs

## Performance

Key optimizations:

- **Tile-based Loading**: Only load data for visible area
- **LOD Culling**: Skip rendering features inappropriate for current zoom
- **Pre-classification**: Feature styling computed during tile generation
- **Plain JSON Tiles**: No compression overhead for fast browser parsing
- **Batch Rendering**: Features grouped by layer and rendered in optimized batches
- **Coordinate Transform Caching**: Reuse screen coordinate calculations

Typical rendering performance:
- ~1,000-10,000 features rendered in <200ms
- 1200x800 canvas with real OSM data
- Smooth pan/zoom interactions

## Data Coverage

Coverage includes:
- Hamburg, Germany
- Schleswig-Holstein, Germany
- Mecklenburg-Vorpommern, Germany
- Nordrhein-Westfalen, Germany
- Denmark
- Initial view centered on Hamburg (Lombardsbrücke)

## Future Enhancements

Potential improvements:

1. **Label Rendering**: Street names and place labels
2. **WebGL Backend**: For better performance with very large datasets
3. **Search Functionality**: Find streets, places, POIs
4. **Routing Visualization**: Display routes on the map
5. **Style Customization**: User-selectable map styles
6. **Real-time Updates**: Live OSM data integration
7. **Vector Tiles**: Switch to MVT format for even better performance

## Why Not WebAssembly?

This project initially used WebAssembly (Zig) for rendering, but evolved to pure JavaScript/Canvas2D because:

- **Canvas2D is hardware-accelerated**: Modern browsers provide excellent Canvas2D performance
- **Simpler architecture**: No need for WASM memory management and JS↔WASM communication overhead
- **Tile system is more important**: Progressive loading and LOD have bigger performance impact than WASM
- **Feature-rich APIs**: Canvas2D provides convenient APIs for paths, fills, transforms

**When WASM makes sense**:
- Complex computational geometry (polygon clipping, spatial queries)
- Pathfinding/routing algorithms
- Real-time data processing pipelines
- Physics simulations

For this rendering use case, the tile system + Canvas2D provides excellent performance without WASM complexity.

## License

This project uses OpenStreetMap data © OpenStreetMap contributors, available under the Open Database License (ODbL).

## Credits

- Map data: [Geofabrik](https://download.geofabrik.de/)
- OSM data: [OpenStreetMap](https://www.openstreetmap.org/)
- Processing: osmium-tool, ogr2ogr
- Rendering: HTML5 Canvas2D

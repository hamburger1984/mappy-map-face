# Hamburg OpenStreetMap Renderer

A high-performance map renderer using OpenStreetMap data with WebAssembly (compiled from Zig) for compute-intensive operations.

## Features

- **WebAssembly Performance**: Compute-intensive rendering operations (line drawing, pixel manipulation) are implemented in Zig and compiled to WASM
- **Real OpenStreetMap Data**: Uses actual map data from Geofabrik for Hamburg, Germany
- **Canvas Rendering**: Direct pixel manipulation on HTML5 Canvas for fast visualization
- **Feature-based Coloring**: Different map features (roads, buildings, water, forests) are rendered with appropriate colors
- **Interactive Navigation**: 
  - 🖱️ Mouse wheel to zoom in/out
  - 🤚 Click and drag to pan around the map
  - 📱 Touch gestures for mobile devices
- **Feature Inspection**:
  - Hover over features to see tooltips with details
  - Info panel displays comprehensive feature properties
  - Detect streets, buildings, water bodies, and points of interest
- **Export Capability**: Save rendered maps as PNG images

## Architecture

### Components

1. **Zig/WASM Module** (`src/map_renderer.zig`)
   - Canvas initialization and memory management
   - Bresenham's line drawing algorithm
   - Pixel manipulation and buffer management
   - Coordinate transformation (lat/lon to pixel space)
   - Polygon and polyline rendering

2. **JavaScript Integration** (`public/map_renderer.js`)
   - WASM module loading and initialization
   - GeoJSON data parsing
   - Feature classification and coloring
   - Memory management between JS and WASM
   - Canvas update and export functionality

3. **HTML Interface** (`public/index.html`)
   - Clean, modern UI
   - Interactive controls
   - Performance statistics display

## Project Structure

```
osm-renderer/
├── build.zig              # Zig build configuration
├── src/
│   └── map_renderer.zig   # WASM renderer implementation
├── public/
│   ├── index.html         # Web interface
│   ├── map_renderer.js    # JavaScript integration
│   ├── map_renderer.wasm  # Compiled WASM module
│   ├── hamburg.geojson    # Map data (GeoJSON format)
│   └── hamburg*.osm.pbf   # Original OSM data
└── zig-out/
    └── bin/
        └── map_renderer.wasm

```

## Quick Start

### Prerequisites

- Zig 0.15.2 or later
- osmium-tool (for processing OSM data)
  - macOS: `brew install osmium-tool`
  - Ubuntu/Debian: `apt-get install osmium-tool`
- curl (for downloading data)
- Python 3 (for local web server)
- just (command runner, optional but recommended)
  - macOS: `brew install just`
  - See: https://github.com/casey/just

### Setup and Run

Using `just` (recommended):

```bash
# See all available commands
just

# Build WASM and download data
just all

# Start the development server
just serve

# Or build and serve in one command
just dev
```

Using Zig build system:

```bash
# Build WASM (auto-copies to public/)
zig build

# Download and process OSM data
zig build data

# Start server manually
cd public && python3 -m http.server 8080
```

Using shell scripts:

```bash
# Build WASM
zig build -Doptimize=ReleaseSmall

# Download data
./fetch-data.sh

# Start server
./start-server.sh
```

Then open your browser to: `http://localhost:8080`

### Interactive Controls

Once the map loads:
- **Zoom**: Scroll mouse wheel
- **Pan**: Click and drag
- **Inspect**: Hover over features to see tooltips and info panel
- **Reset**: Click "Reset View" to return to default zoom/pan
- **Export**: Save the current view as PNG

## How It Works

### Coordinate Transformation

The renderer converts geographic coordinates (latitude/longitude) to pixel coordinates:

```zig
const x = (lon - min_lon) / (max_lon - min_lon) * canvas_width;
const y = canvas_height - ((lat - min_lat) / (max_lat - min_lat) * canvas_height);
```

### Line Rendering

Uses Bresenham's algorithm for efficient line drawing directly in WASM, avoiding JavaScript overhead for pixel-level operations.

### Memory Model

- JavaScript allocates WebAssembly memory (16-32 MB)
- Zig manages a pixel buffer for the canvas
- JavaScript reads the buffer and updates the HTML canvas via ImageData
- Coordinate arrays are passed from JS to WASM via shared memory

### Feature Classification

The renderer identifies and colors different map features:

- **Highways**: Orange-red for motorways, white for smaller roads
- **Buildings**: Beige
- **Water**: Blue
- **Forests**: Green
- **Railways**: Dark gray

## Performance

The WASM module provides significant performance benefits:

- **Direct pixel manipulation**: No JavaScript overhead for each pixel
- **Optimized algorithms**: Bresenham's algorithm compiled to native WASM
- **Bulk operations**: Entire ways and polygons processed in single WASM calls
- **Small binary**: ~6KB WASM module (with ReleaseSmall optimization)

Typical rendering performance:
- ~10,000+ features rendered in <1000ms (depending on complexity)
- 1200x800 canvas with real Hamburg OSM data

## Future Enhancements

Potential improvements:

1. **Zoom and Pan**: Interactive map navigation
2. **Label Rendering**: Street names and place labels
3. **More Efficient Polygon Fill**: Scanline algorithm for filled polygons
4. **Caching**: Tile-based rendering for better performance
5. **Style Customization**: User-selectable map styles
6. **WebGL Backend**: For even better performance with large datasets

## License

This project uses OpenStreetMap data © OpenStreetMap contributors, available under the Open Database License (ODbL).

## Credits

- Map data: [Geofabrik](https://download.geofabrik.de/)
- OSM data: [OpenStreetMap](https://www.openstreetmap.org/)
- Processing: osmium-tool
- Rendering: Zig + WebAssembly

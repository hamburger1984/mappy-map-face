# Hamburg OSM Map Renderer - justfile

# List all available commands
default:
    @just --list

# Build everything (WASM + fetch data)
all: build data

# Compile Zig code to WebAssembly
build:
    @echo "Building WebAssembly module..."
    zig build -Doptimize=ReleaseSmall
    cp zig-out/bin/map_renderer.wasm public/
    @echo "✓ WASM module built and copied to public/"

# Download and process OSM data (includes tile generation)
data:
    @echo "Fetching and processing OSM data..."
    ./fetch-data.sh

# Generate tiles from existing GeoJSON
tiles:
    @echo "Generating tiles from hamburg.geojson..."
    python3 split-tiles.py
    @echo "✓ Tiles generated in public/tiles/"

# Clean build artifacts
clean:
    @echo "Cleaning build artifacts..."
    rm -rf zig-out zig-cache .zig-cache
    @echo "✓ Build artifacts cleaned"

# Clean everything including downloaded data
clean-all: clean
    @echo "Cleaning OSM data files..."
    rm -f public/*.osm public/*.osm.pbf public/*.geojson public/*.geojson.gz
    rm -rf public/tiles
    @echo "✓ All generated files cleaned"

# Start local web server
serve:
    @echo "Starting web server on http://localhost:8888"
    @echo "Press Ctrl+C to stop"
    cd public && python3 -m http.server 8888

# Run in development mode (build + serve)
dev: build
    @echo "Development mode: WASM built, starting server..."
    @just serve

# Watch for changes and rebuild (requires watchexec)
watch:
    watchexec -e zig -w src "just build"

# Show project info
info:
    @echo "Hamburg OSM Map Renderer"
    @echo "======================="
    @echo ""
    @echo "Zig version:    $(zig version)"
    @echo "Repository:     $(git rev-parse --short HEAD 2>/dev/null || echo 'not a git repo')"
    @echo ""
    @echo "Files:"
    @ls -lh public/map_renderer.wasm 2>/dev/null || echo "  WASM not built (run: just build)"
    @ls -lh public/hamburg.geojson 2>/dev/null || echo "  Data not fetched (run: just data)"

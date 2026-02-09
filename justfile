# Hamburg OSM Map Renderer - justfile

# List all available commands
default:
    @just --list

# Build everything (fetch data and generate tiles)
all: data tiles

# Download and process OSM data
data:
    @echo "Fetching OSM data..."
    cd preprocessing && ./fetch-data.sh

# Generate tiles from existing GeoJSON (Python version)
tiles:
    @echo "Generating tiles from hamburg-region.geojson..."
    cd preprocessing && python3 split-tiles.py ../data/hamburg-region.geojson
    @echo "✓ Tiles generated in public/tiles/"

# Generate tiles using Zig (faster, but needs compilation)
tiles-zig:
    @echo "Building Zig tile splitter..."
    zig build
    @echo "Generating tiles from hamburg-region.geojson..."
    ./zig-out/bin/split-tiles data/hamburg-region.geojson
    @echo "✓ Tiles generated in public/tiles/"

# Clean generated tiles only
clean:
    @echo "Cleaning tiles..."
    rm -rf public/tiles
    @echo "✓ Tiles cleaned"

# Clean tiles and downloaded data
clean-data:
    @echo "Cleaning tiles and data..."
    rm -rf public/tiles data/*.geojson
    @echo "✓ Tiles and data cleaned"

# Clean everything including build artifacts
clean-all: clean-data
    @echo "Cleaning build artifacts..."
    rm -rf zig-out .zig-cache
    @echo "✓ All generated files cleaned"

# Start local web server
serve:
    @echo "Starting web server on http://localhost:8888"
    @echo "Press Ctrl+C to stop"
    cd public && python3 -m http.server 8888

# Run in development mode (serve directly)
dev:
    @echo "Starting development server..."
    @just serve

# Show project info
info:
    @echo "Hamburg OSM Map Renderer"
    @echo "======================="
    @echo ""
    @echo "Python:         $(python3 --version)"
    @echo "Zig:            $(zig version 2>/dev/null || echo 'not installed')"
    @echo "Repository:     $(git rev-parse --short HEAD 2>/dev/null || echo 'not a git repo')"
    @echo ""
    @echo "Data files:"
    @ls -lh data/hamburg-region.geojson 2>/dev/null || echo "  GeoJSON not created (run: just data)"
    @echo "Tile status:"
    @ls -d public/tiles 2>/dev/null && echo "  Tiles generated ✓" || echo "  Tiles not generated (run: just tiles)"

.PHONY: all build clean data serve help

all: build data

help:
	@echo "Hamburg OSM Map Renderer - Build Commands"
	@echo "=========================================="
	@echo ""
	@echo "  make build    - Compile Zig code to WebAssembly"
	@echo "  make data     - Download and process OSM data"
	@echo "  make serve    - Start local web server"
	@echo "  make clean    - Remove build artifacts"
	@echo "  make all      - Build WASM and fetch data"
	@echo ""

build:
	@echo "Building WebAssembly module..."
	zig build -Doptimize=ReleaseSmall
	cp zig-out/bin/map_renderer.wasm public/
	@echo "✓ WASM module built and copied to public/"

data:
	@echo "Fetching and processing OSM data..."
	./fetch-data.sh

clean:
	@echo "Cleaning build artifacts..."
	rm -rf zig-out zig-cache .zig-cache
	@echo "✓ Build artifacts cleaned"

serve:
	@echo "Starting web server on http://localhost:8080"
	@echo "Press Ctrl+C to stop"
	@cd public && python3 -m http.server 8080

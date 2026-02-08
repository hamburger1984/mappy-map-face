# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added (2026-02-08)

#### Interactive Features
- **Zoom functionality**: Mouse wheel to zoom in/out (0.5x - 10x range)
- **Pan functionality**: Click and drag to move around the map
- **Hover tooltips**: Display feature information on hover
  - Shows name, type, and relevant properties
  - Positioned near cursor with dark overlay
- **Info panel**: Detailed feature properties in side panel
  - Displays all OSM tags for hovered features
  - Clean, organized property display
- **Touch support**: Pinch to zoom and swipe to pan on mobile devices
- **Reset view**: Button to return to default zoom and pan position
- **Zoom indicator**: Real-time display of current zoom level

#### Technical Improvements
- **Hit detection**: Point-to-line-segment distance calculation for accurate hover detection
- **Feature tracking**: Store screen coordinates of rendered features for interaction
- **Viewport state**: Manage zoom level and pan offsets
- **Coordinate transformation**: Dynamic lat/lon to screen conversion based on viewport
- **Performance**: Efficient rendering with viewport culling

#### Build System
- **Replaced Makefile with justfile**: Modern, more readable command runner
  - `just` - List all commands
  - `just all` - Build WASM and fetch data
  - `just build` - Compile Zig to WASM
  - `just data` - Download and process OSM data
  - `just serve` - Start development server
  - `just dev` - Build and serve in one command
  - `just watch` - Auto-rebuild on file changes
  - `just clean` - Remove build artifacts
  - `just clean-all` - Remove everything including data
  - `just info` - Show project status
- **Enhanced build.zig**:
  - Auto-copy WASM to public/ directory
  - `zig build` - Compile and copy WASM
  - `zig build data` - Run data fetch script
  - No manual copy step needed

#### Documentation
- Updated README with interactive features
- Updated SETUP guide for new build system
- Added instructions for zoom/pan/hover interactions
- Documented both `just` and `zig build` workflows

### Changed
- HTML interface now includes info panel
- Canvas cursor changes during pan (grabbing)
- Enhanced UI with interactive instructions banner
- Reorganized layout to accommodate info panel

### Technical Details
- WASM module size: 1.7 KB (optimized)
- Supports 180,000+ features from Hamburg GeoJSON
- Render time: <1000ms typical
- Zoom range: 0.5x to 10.0x
- Mobile-friendly with touch gestures

## [0.1.0] - 2026-02-08

### Added
- Initial WebAssembly renderer compiled from Zig
- Static pixel buffer in WASM linear memory
- Bresenham's line drawing algorithm
- Direct pixel manipulation for fast rendering
- GeoJSON data parsing and processing
- Feature classification by OSM tags:
  - Highways (motorways, primary, secondary roads)
  - Buildings
  - Water bodies and waterways
  - Forests and green spaces
  - Railways
- Color-coded feature rendering
- HTML5 Canvas output
- Export to PNG functionality
- Automated data fetching script
- Build system with shell scripts
- Comprehensive documentation

### Technical Implementation
- Zig 0.15.2 compilation target: wasm32-freestanding
- Coordinate buffer for JS/WASM data passing
- Memory management with static buffers
- Hamburg city center coverage (9.95°-10.05° E, 53.53°-53.58° N)
- Data source: Geofabrik Hamburg extract

## Project Goals

This project demonstrates:
1. High-performance graphics with WebAssembly
2. Zig's suitability for WASM compilation
3. Interactive web mapping without external libraries
4. Direct memory manipulation between JS and WASM
5. Processing real-world OpenStreetMap data
6. Modern build tooling (just, zig build)

## Future Roadmap

Potential enhancements:
- [ ] Tile-based rendering for better performance with large areas
- [ ] Street name labels
- [ ] Search functionality for addresses and POIs
- [ ] Multiple map styles (dark mode, high contrast)
- [ ] WebGL backend for hardware acceleration
- [ ] Routing and navigation features
- [ ] Multiple city/region support
- [ ] Layer toggles (show/hide roads, buildings, etc.)
- [ ] Custom styling with configuration files

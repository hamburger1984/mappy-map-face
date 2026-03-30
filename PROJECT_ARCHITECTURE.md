# OSM Renderer Project Architecture

## System Overview

This project renders OpenStreetMap data in an interactive web interface using a two-part approach:
1. **Preprocessing Pipeline** (Python): Downloads, converts, and tiles OSM data
2. **Rendering Engine** (JavaScript): Displays tiles in an interactive canvas2D map with zoom, pan, and tooltips

## Technology Stack
- **Preprocessing**: Python 3 with multiprocessing, osmium, shapely, ijson, orjson
- **Rendering**: JavaScript ES6 with HTML5 Canvas2D, Web Workers for off-thread loading
- **Build System**: Justfile for orchestration
- **Styling**: CSS3 for UI components

## Data Flow
```
OSM PBF Files → GeoJSON Conversion → Tile Generation (t1-t6) →
HTTP Serving → Tile Worker (Web Worker) → Canvas2D Rendering
```

---

## Preprocessing Pipeline Details

### Step 1: Download (`step_1_download.py`)
Downloads OSM PBF files and land polygon data for map rendering.

**Features:**
- Parallel downloading with progress bars via `multiprocessing.Pool`
- Resume support for interrupted downloads using Range requests
- File age-based caching (default 30 days) to avoid redundant downloads
- Automatic extraction and conversion of land polygon shapefiles to GeoJSON
- Support for custom regions via command-line arguments

**Inputs:** Region names/URLs from `OSM_SOURCES` dictionary or custom arguments
**Outputs:** PBF files and land polygon GeoJSON in `preprocessing/data/`

### Step 2: Conversion (`step_2_convert_to_geojson.py`)
Converts OSM PBF files to GeoJSON format using the osmium tool.

**Features:**
- Parallel conversion of multiple PBF files
- Skip conversion if GeoJSON is newer than source PBF
- Configuration-based filtering via `osmium-export-config.json`
- Progress tracking with tqdm
- Error handling for missing osmium tool

**Inputs:** PBF files from `preprocessing/data/`
**Outputs:** GeoJSON files in region-specific subdirectories (e.g., `data/hamburg-latest/`)

### Step 3: Tile Generation (`step_3_generate_tiles.py`)
Processes GeoJSON into zoom-level-specific tiles with feature classification.

**Key Components:**

#### Tileset Configuration
Seven tilesets covering the full zoom range:
- **t1**: very wide view (city cluster overview)
- **t2**: regional overview
- **t2b**: intermediate regional
- **t3**: local area
- **t4**: neighbourhood
- **t5**: street level
- **t6**: building detail

Each tileset has a `view_range_meters` that the renderer uses to select the right tileset for the current viewport width.

#### Processing Pipeline
1. **Feature Classification**: Match OSM features to tileset definitions
2. **Simplification**: Apply tileset-specific geometry simplification
3. **Property Augmentation**: Compute render attributes from OSM tags
4. **Tile Assignment**: Determine which tiles each feature belongs to
5. **Importance Scoring**: Classify features for progressive loading
6. **Clipping**: Clip features to tile boundaries with buffer for seamless edges
7. **Land Polygon Integration**: Add authoritative coastline data
8. **Finalization**: Deduplicate, sort by importance, compress into gzipped JSON

**Optimizations:**
- Parallel feature processing with `ProcessPoolExecutor`
- LRU file handle cache to minimize open/close syscalls
- Batched processing to reduce overhead
- Geometry caching to avoid repeated Shapely conversions
- Early exits for simple geometries (points don't need clipping)

**Inputs:** GeoJSON files from step 2
**Outputs:** Tile hierarchy in `public/tiles/`:
```
public/tiles/
├── t1/           # widest view
├── t2/
├── t2b/
├── t3/
├── t4/
├── t5/
└── t6/           # most detailed
```

Each tile is a gzipped JSON file (`{x}/{y}.json.gz`) containing a GeoJSON FeatureCollection with pre-classified render metadata (`_render`, `_meta` fields).

---

## Rendering System Details

### Map Renderer (`public/map_renderer.js`)
Canvas2D-based interactive map with zoom, pan, and rich feature interaction.

**Core Features:**
- **Viewport Management**: Discrete logarithmic zoom levels (sqrt(2) progression)
- **Tile Loading**: Hierarchical tile system with Web Worker off-thread loading
- **Navigation**: Click-drag panning, mousewheel zooming, keyboard navigation
- **Search**: Feature search with typeahead and navigation
- **Tooltips**: Hover-based feature information display
- **Selection**: Click-to-select with visual highlighting
- **Overlays**: Debug grid, tile boundaries, search results

**Tile Loading:**
- **LRU Cache** (100 tiles max): in-memory Map; access order maintained by delete+re-insert. Eviction skips currently-visible tiles to prevent blink — only non-visible (oldest) tiles are evicted, with a fallback to oldest if all are visible.
- **Tile cache guard**: `loadTile()` returns immediately on cache hit, updating LRU order.
- **Progressive rendering**: `_startVisibleTileLoads()` fires fetches fire-and-forget; each tile arrival triggers `debouncedRender()` only if the tile is in `_visibleTileKeys`.
- **Ring prefetch**: after 400ms idle, surrounding tiles are loaded in the background (80ms apart) to make panning feel instant.
- **tileSetSig merge cache**: merge+dedup is skipped when the set of loaded visible tiles hasn't changed (keyed on sorted tile keys + LOD).
- **404 cache**: missing tiles stored in `sessionStorage` (keyed by tile generation timestamp) so they are never re-fetched in the same session.

**Performance Optimizations:**
- **Object Pools**: Reusable Point and coordinate array objects to reduce GC pressure
- **Offscreen Canvas**: Cache last rendered frame for fast panning
- **Base Canvas**: Prerendered base layer for fast hover re-rendering
- **Render Generation Counter**: Prevent stale async renders from overwriting newer ones
- **Debounced Rendering**: 50ms debounce for pan/zoom; 300ms for scroll-wheel zoom preview
- **Lazy Pattern Creation**: Cache CanvasPattern objects for textures
- **Glyph Cache**: Prerendered POI icons at multiple resolutions

**Layer System:**
Features are rendered in specific layers based on type:
- `base_land`: Authoritative land polygons from preprocessing
- `surface_roads`: Ground-level roads and paths
- `bridge_roads`: Elevated roads
- `tunnels`: Underground features
- `water`: Rivers, lakes, oceans
- `natural`: Forests, parks, wetlands
- `landuse`: Agricultural, residential, commercial areas
- `buildings`: All building footprints
- `railways`: Rail lines and stations
- `points`: POIs, places, and label points
- `boundaries`: Administrative and special boundaries

### Theme System (`public/map_theme.js`)
Centralized color and style definitions for consistent map appearance.

**Features:**
- **Multiple Themes**: Light (default) and dark themes with easy switching
- **Comprehensive Palettes**: Colors for all feature categories (water, land, roads, buildings, POIs, etc.)
- **Semantic Organization**: Colors grouped by feature type (background, water, natural, etc.)
- **Pattern Colors**: Special colors for texture patterns (scrub, wetland, forest, etc.)
- **Dash Patterns**: Line styles for different feature types (borders, tracks, etc.)
- **Helper Functions**: 
  - `getColor(category, subcategory)` - Retrieve color objects
  - `toRGBA()/toRGB()` - Convert to CSS color strings
  - `getColorByKey(themeKey)` - Resolve "category.subtheme" notation
  - `getDashPattern(key)` - Get dash array for line styling

**Usage in Renderer:**
```javascript
// Get color for primary roads
const color = getColor("roads", "primary");
// Convert to CSS string
const cssColor = toRGBA(color);
// Use in canvas context
ctx.strokeStyle = cssColor;
```

### Tile Worker (`public/tile_worker.js`)
Off-main-thread tile fetching and parsing to prevent UI blocking.

**Functionality:**
- Receives tile URL and key via `postMessage`
- Fetches tile with `fetch()` API
- Decompresses gzip using `DecompressionStream`
- Parses JSON and returns parsed data
- Reports fetch and parse timing metrics
- Handles errors gracefully with error reporting

**Usage in Renderer:**
```javascript
// Create worker
const worker = new Worker("tile_worker.js");
// Send request
worker.postMessage({ url: tileUrl, key: tileKey });
// Receive response
worker.onmessage = ({ data }) => {
  if (data.error) {
    // Handle error
  } else {
    // Use data.data (parsed tile JSON)
  }
};
```

---

## Performance Characteristics

### Preprocessing
- **CPU Intensive**: Geometry simplification, clipping, and classification
- **I/O Bound**: Large PBF/GeoJSON file reading/writing
- **Memory Usage**: Peak during GeoJSON processing (can exceed RAM for large regions)
- **Parallelization**: Embarrassingly parallel across regions and features
- **Current Bottlenecks**: 
  - Repeated GeoJSON↔Shapely conversions
  - Single-threaded land polygon loading
  - I/O saturation during download/conversion

### Rendering
- **Main Thread Limited**: Historically blocked by tile fetching/parsing (mitigated by workers)
- **GC Pressure**: Object creation in render loops
- **Canvas State Changes**: Frequent changes to stroke/fill styles, line widths, etc.
- **Feature Lookup**: Linear searches for search/hover interactions
- **Current Bottlenecks:**
  - Tile JSON parsing on main thread (partially solved by workers)
  - Inefficient feature clustering for POIs
  - Redundant canvas state restoration in drawing loops
  - Lack of spatial indexing for feature queries

---

## Improvement Roadmap

### Phase 1: Rendering Quick Wins (Current Focus)
1. Enhanced tile caching with LRU and predictive prefetching
2. Rendering pipeline optimization (dirty rectangles, batching)
3. Network and loading improvements (HTTP/2 prioritization, Service Workers)

### Phase 2: Medium-Term Rendering
1. WebGL migration path for complex features
2. Advanced spatial data structures (quadtrees, hash grids)
3. Adaptive quality system based on device capabilities

### Phase 3: Preprocessing Improvements
1. Vectorized processing with Apache Arrow/Parquet intermediates
2. GPU-accelerated geometric operations
3. Hierarchical tile storage formats (MBTiles)
4. Multi-resolution land polygon datasets

This approach prioritizes user-facing improvements first, establishing a performant rendering foundation that will maximize the value of subsequent preprocessing enhancements.
# Tileset System Implementation Guide

## Current Status

✅ **Completed:**
- Config export script (export_config.py)
- Tileset helper functions in step_3_generate_tiles.py
- --use-tilesets flag added

🚧 **In Progress:**
- Tile generation main loop updates
- Renderer updates

## Remaining Implementation Tasks

### Task 1: Update SQLite Database Setup (step_3_generate_tiles.py)

**Location:** `open_zoom_db()` function (line ~1398)

**Current code:**
```python
def open_zoom_db(db_dir, zoom, fingerprint=None, db_prefix="tile_build"):
    db_path = db_dir / f"{db_prefix}_z{zoom}.db"
    # ...
```

**New code needed:**
```python
def open_tileset_db(db_dir, tileset_id, fingerprint=None, db_prefix="tile_build"):
    """Open database for a specific tileset instead of zoom level."""
    db_path = db_dir / f"{db_prefix}_{tileset_id}.db"
    
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    
    # Create tables if they don't exist
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tiles (
            x INTEGER,
            y INTEGER,
            importance INTEGER,
            feature_json TEXT,
            PRIMARY KEY (x, y, importance, feature_json)
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    
    # Store fingerprint
    if fingerprint:
        conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
            ("fingerprint", fingerprint)
        )
    
    conn.commit()
    return conn
```

**Changes:**
1. Rename function from `open_zoom_db` to `open_tileset_db`
2. Change parameter from `zoom` to `tileset_id`
3. Change database filename from `_z{zoom}.db` to `_{tileset_id}.db`

---

### Task 2: Update Main Processing Loop (split_geojson_into_tiles)

**Location:** Lines ~1434-1630 in `split_geojson_into_tiles()` function

**Key section to modify:** Pass 1 - Feature Streaming (lines ~1500-1600)

**Current structure:**
```python
for feature in ijson.items(f, "features.item"):
    # Get render metadata
    render_meta = get_render_metadata(props, geom_type)
    
    # Determine target zooms based on minLOD
    if min_lod == 0:
        target_zooms = LOD_0_ZOOMS
    elif min_lod == 1:
        target_zooms = LOD_1_ZOOMS
    # ...
    
    # For each zoom level
    for zoom in target_zooms:
        simplified = simplify_feature_for_zoom(feature, zoom, min_lod)
        # ...
```

**New tileset-based structure:**
```python
# Check if using new tileset system
if use_tilesets:
    # TILESET-BASED PROCESSING
    for tileset_config in TILESETS:
        tileset_id = tileset_config["id"]
        tile_size_m = tileset_config["tile_size_meters"]
        
        # Check if feature matches any feature definition in this tileset
        feature_config = feature_matches_tileset(feature, tileset_config, props, geom_type)
        if not feature_config:
            continue  # Feature not included in this tileset
        
        # Simplify for this tileset
        tileset_feature = copy.deepcopy(feature)
        tileset_feature = simplify_feature_for_tileset(tileset_feature, tileset_id, feature_config)
        
        # Add render metadata from config
        tileset_feature["_render"] = feature_config["render"]
        
        # Get tiles for this tileset
        feature_tiles = get_tiles_for_feature_in_tileset(tileset_feature, tileset_id, tile_size_m)
        
        # Serialize and store
        feature_json = json.dumps(tileset_feature, separators=(",", ":"), default=decimal_default)
        
        for tile_coords in feature_tiles:
            ts_id, x, y = tile_coords
            batches[ts_id].append((x, y, importance, feature_json))

else:
    # LEGACY ZOOM-BASED PROCESSING (keep existing code)
    # ... existing code ...
```

**Key changes:**
1. Add `if use_tilesets:` conditional
2. Loop over `TILESETS` instead of `target_zooms`
3. Use `feature_matches_tileset()` instead of `get_render_metadata()`
4. Use `simplify_feature_for_tileset()` instead of `simplify_feature_for_zoom()`
5. Use `get_tiles_for_feature_in_tileset()` instead of `get_tiles_for_feature()`
6. Store in `batches[tileset_id]` instead of `batches[zoom]`

---

### Task 3: Update Database Initialization

**Location:** Lines ~1501-1530 in `split_geojson_into_tiles()`

**Current:**
```python
dbs = {}
batches = {zoom: [] for zoom in zoom_levels}

for zoom in zoom_levels:
    dbs[zoom] = open_zoom_db(db_dir, zoom, fingerprint, db_prefix)
```

**New:**
```python
if use_tilesets:
    dbs = {}
    batches = {ts["id"]: [] for ts in TILESETS}
    
    for tileset in TILESETS:
        tileset_id = tileset["id"]
        dbs[tileset_id] = open_tileset_db(db_dir, tileset_id, fingerprint, db_prefix)
else:
    # Legacy
    dbs = {}
    batches = {zoom: [] for zoom in zoom_levels}
    
    for zoom in zoom_levels:
        dbs[zoom] = open_zoom_db(db_dir, zoom, fingerprint, db_prefix)
```

---

### Task 4: Update Tile Writing Function

**Location:** `write_tiles_from_databases()` function (lines ~1913-2100)

**Current tile path:**
```python
tile_path = output_dir / str(zoom) / str(x)
tile_file = tile_path / f"{y}.json"
```

**New tile path:**
```python
if use_tilesets:
    tile_path = output_dir / tileset_id / str(x)
    tile_file = tile_path / f"{y}.json"
else:
    # Legacy
    tile_path = output_dir / str(zoom) / str(x)
    tile_file = tile_path / f"{y}.json"
```

**Changes:**
1. Add `use_tilesets` parameter to function signature
2. Change directory structure from `zoom/x/y.json` to `tileset_id/x/y.json`
3. Update all references to `zoom` to `tileset_id` when in tileset mode

---

### Task 5: Update Renderer (map_renderer.js)

**Location:** public/map_renderer.js

#### 5.1: Load Tileset Config

**Location:** `init()` method (line ~313)

**Add after canvas init:**
```javascript
// Load tileset configuration
const response = await fetch('tileset_config.json');
const config = await response.json();
this.tilesets = config.tilesets;

console.log(`[INIT] Loaded ${this.tilesets.length} tilesets`);
```

#### 5.2: Replace getZoomLevelForScale()

**Location:** Lines ~1149-1163

**Current:**
```javascript
getZoomLevelForScale() {
  if (this.viewWidthMeters >= 500000) return 3;
  if (this.viewWidthMeters >= 100000) return 5;
  if (this.viewWidthMeters >= 15000) return 8;
  if (this.viewWidthMeters >= 2000) return 11;
  return 14;
}
```

**New:**
```javascript
getTilesetForView() {
  // Find tileset whose view range contains current view width
  for (const tileset of this.tilesets) {
    const [min, max] = tileset.view_range_meters;
    if (this.viewWidthMeters >= min && this.viewWidthMeters <= max) {
      return tileset.id;
    }
  }
  
  // Fallback to closest tileset
  if (this.viewWidthMeters < 1000) return "t1";
  if (this.viewWidthMeters < 2000) return "t2";
  if (this.viewWidthMeters < 7000) return "t3";
  if (this.viewWidthMeters < 15000) return "t4";
  if (this.viewWidthMeters < 70000) return "t5";
  if (this.viewWidthMeters < 150000) return "t6";
  return "t7";
}
```

#### 5.3: Update getVisibleTiles()

**Location:** Lines ~1265-1280

**New:**
```javascript
getVisibleTiles(bounds) {
  const tilesetId = this.getTilesetForView();
  const tileset = this.tilesets.find(ts => ts.id === tilesetId);
  const tileSizeM = tileset.tile_size_meters;
  
  // Convert bounds to tile coordinates using custom tile size
  const lat_avg = (bounds.minLat + bounds.maxLat) / 2;
  const metersPerDegLon = 111320 * Math.cos(lat_avg * Math.PI / 180);
  const metersPerDegLat = 111320;
  
  const tileWidthDeg = tileSizeM / metersPerDegLon;
  const tileHeightDeg = tileSizeM / metersPerDegLat;
  
  const minX = Math.floor(bounds.minLon / tileWidthDeg);
  const maxX = Math.floor(bounds.maxLon / tileWidthDeg);
  const minY = Math.floor(bounds.minLat / tileHeightDeg);
  const maxY = Math.floor(bounds.maxLat / tileHeightDeg);
  
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ tileset: tilesetId, x, y });
    }
  }
  
  return tiles;
}
```

#### 5.4: Update loadTile()

**Location:** Line ~1297

**Change:**
```javascript
// OLD:
const response = await fetch(`tiles/${z}/${x}/${y}.json?v=${cacheBuster}`);

// NEW:
const response = await fetch(`tiles/${tileset}/${x}/${y}.json?v=${cacheBuster}`);
```

#### 5.5: Update getTileKey()

**Location:** getTileKey() method

**Change:**
```javascript
// OLD:
getTileKey(z, x, y) {
  return `${z}/${x}/${y}`;
}

// NEW:
getTileKey(tileset, x, y) {
  return `${tileset}/${x}/${y}`;
}
```

#### 5.6: Update All Method Calls

Update all calls to these methods throughout the file:
- `getZoomLevelForScale()` → `getTilesetForView()`
- Pass `tileset` instead of `z` to `loadTile()` and `getTileKey()`

---

## Testing Plan

### 1. Test Config Export
```bash
cd preprocessing
python export_config.py
# Verify: public/tileset_config.json exists
```

### 2. Test Tile Generation with Tilesets
```bash
cd preprocessing
python step_3_generate_tiles.py --use-tilesets

# Expected output:
# - Creates tiles/t1/, tiles/t2/, ... tiles/t7/ directories
# - Each tileset has different tile counts
# - Tiles contain appropriate features per config
```

### 3. Test Renderer
```bash
cd public
python -m http.server 8000
# Open http://localhost:8000

# Test at different zoom levels:
# - 500m: should load t1 tiles
# - 5km: should load t3 tiles
# - 100km: should load t6 tiles
```

### 4. Verify Feature Filtering

Check that t6 only contains 8 feature types:
```bash
cd public/tiles/t6
node -e "
const fs = require('fs');
const files = fs.readdirSync('0');
const data = JSON.parse(fs.readFileSync('0/' + files[0]));
const layers = new Set(data.features.map(f => f._render?.layer));
console.log('Layers in t6:', Array.from(layers));
console.log('Should be ~8 layers: coastline, water, forests, major_roads, railways, boundaries, labels');
"
```

---

## Code References

### Key Files:
- `preprocessing/step_3_generate_tiles.py` - Tile generation (lines to modify: 1434-1630, 1913-2100)
- `public/map_renderer.js` - Renderer (lines to modify: 313, 1149-1163, 1265-1280, 1297, getTileKey)
- `tileset_config.yaml` - Source of truth for tileset configuration
- `public/tileset_config.json` - Browser-friendly config (generated)

### Key Functions to Modify:
1. `split_geojson_into_tiles()` - Main processing loop
2. `write_tiles_from_databases()` - Tile writing
3. `open_zoom_db()` → `open_tileset_db()` - Database setup
4. Renderer: `getZoomLevelForScale()`, `getVisibleTiles()`, `loadTile()`, `getTileKey()`

### Helper Functions (Already Implemented):
- `feature_matches_tileset()` ✅
- `simplify_feature_for_tileset()` ✅
- `snap_to_grid()` ✅
- `get_tiles_for_feature_in_tileset()` ✅

---

## Estimated Lines of Code

- Tile generation changes: ~150 lines modified
- Renderer changes: ~80 lines modified
- Total: ~230 lines of code changes

## Time Estimate

- Tile generation updates: 1-2 hours
- Renderer updates: 30 minutes
- Testing and debugging: 1 hour
- **Total: 2.5-3.5 hours**

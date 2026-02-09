# Roadmap: Scaling to Europe

## Overview
Transform the Hamburg OSM renderer into a Europe-wide map system with search, optimized tiles, and full geographic coverage.

**Current State:** Hamburg region (~200km radius, ~3.3GB GeoJSON, ~50k tiles)
**Target State:** Europe-wide (country-by-country expansion, millions of tiles, search capability)

**Strategy:** Start with Hamburg, incrementally add features, then expand geographically.

---

## Phase 1: Optimize Core Rendering & Tiles (Foundation)

**Goal:** Make current system more efficient before scaling up data volume.

### 1.1 Optimize Tile Format (High Priority)
**Why:** Current tiles contain full GeoJSON with redundant data. Reduce size by 60-80%.

**Current tile structure:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [[10.0, 53.5], ...] },
      "properties": {
        "highway": "primary",
        "name": "Hauptstraße",
        "render": {
          "layer": "highways",
          "color": [253, 191, 111, 255],
          "width": 3,
          "minLOD": 1
        }
      }
    }
  ]
}
```

**Optimized tile structure (binary or compact JSON):**
```javascript
// Option A: Packed binary format (Protocol Buffers / FlatBuffers)
// Option B: Compact JSON with indexed properties
{
  "v": 1, // version
  "layers": {
    "highways": [
      // [type, coords_offset, coords_count, color_idx, width, name_idx]
      [1, 0, 50, 3, 3, 12],  // Line: primary road
      [1, 50, 30, 3, 3, 45]  // Line: secondary
    ],
    "water": [
      [2, 80, 200, 7, 0, 0]  // Polygon: lake
    ]
  },
  "coords": [10.0, 53.5, 10.01, 53.51, ...], // Flat array
  "names": ["Hauptstraße", "Nebenstraße", ...], // String table
  "colors": [[253,191,111,255], [170,211,223,255], ...] // Color table
}
```

**Benefits:**
- 60-80% size reduction (498 bytes → ~100-150 bytes per tile)
- Faster parsing (no duplicate strings, indexed lookups)
- Better compression (deduplicated data)

**Implementation Steps:**
1. **Design format** (decide: binary vs compact JSON)
   - Binary: Best compression, needs encoder/decoder
   - Compact JSON: Good compression, human-readable, simpler
2. **Update preprocessing/split-tiles.py** to generate new format
3. **Update map_renderer.js** to parse new format
4. **Benchmark** tile load times and sizes
5. **Migrate** existing Hamburg tiles

**Estimated Time:** 3-5 days
**Priority:** HIGH (foundational for scaling)

---

### 1.2 Render Sea/Ocean Coverage (Medium Priority)
**Why:** Currently ocean areas are white/background color. Need full water rendering.

**Challenge:** OSM coastlines are LineStrings, not closed polygons. Need to:
1. Either use a base water layer (entire map = water, render land on top)
2. Or clip water polygons from coastline data

**Approach: Base Water Layer**
```javascript
// In renderMap(), before rendering other features:
// 1. Fill entire canvas with water color
ctx.fillStyle = 'rgba(170, 211, 223, 1.0)'; // Ocean blue
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 2. Render land polygons on top (from OSM land polygons or inverted coastline)
// 3. Render all other features as normal
```

**Data Requirements:**
- Option A: Pre-process coastline → land polygons (complex)
- Option B: Render ocean base + existing land use polygons (simpler)
- Option C: Use external land polygon dataset (OSMCoastline project)

**Implementation Steps:**
1. **Choose approach** (recommend: Option B for Hamburg, then C for Europe)
2. **Update renderer** to fill ocean background
3. **Test** with Hamburg (North Sea + Baltic Sea coverage)
4. **Add to preprocessing** if using pre-processed land polygons

**Estimated Time:** 2-3 days
**Priority:** MEDIUM (visual completeness)

---

### 1.3 Render Country & State Borders (Medium Priority)
**Why:** Essential for European map - users need to see political boundaries.

**OSM Data:** `admin_level` tag
- `admin_level=2`: Country borders
- `admin_level=4`: State/province borders (e.g., German Bundesländer)

**Rendering Strategy:**
```javascript
// In classifyFeature():
if (props.boundary === 'administrative') {
  const adminLevel = parseInt(props.admin_level);
  if (adminLevel === 2) {
    return {
      layer: 'borders_country',
      color: [100, 100, 100, 255],
      width: 3,
      style: 'dashed', // NEW: line style
      minLOD: 0
    };
  }
  if (adminLevel === 4) {
    return {
      layer: 'borders_state',
      color: [150, 150, 150, 255],
      width: 2,
      style: 'dashed',
      minLOD: 1
    };
  }
}
```

**Implementation Steps:**
1. **Add border classification** in split-tiles.py
2. **Add dashed line rendering** to map_renderer.js
   ```javascript
   if (style === 'dashed') {
     ctx.setLineDash([10, 5]); // 10px dash, 5px gap
   }
   ```
3. **Add rendering layer** between land and roads
4. **Test** with Germany/Denmark border (north of Hamburg)

**Estimated Time:** 1-2 days
**Priority:** MEDIUM (important for Europe view)

---

### 1.4 Render Street Names (Critical)
**Why:** Core navigation feature - users need to identify streets.

**Challenge:** Text rendering on Canvas2D at arbitrary angles along curved paths.

**Approach: Text Along Path**
```javascript
// For each road LineString:
function renderStreetName(ctx, coords, name, screenCoords) {
  // 1. Calculate path length and text width
  const textWidth = ctx.measureText(name).width;
  const pathLength = calculatePathLength(screenCoords);
  
  // Skip if text too long for path
  if (textWidth > pathLength * 0.8) return;
  
  // 2. Find center point of path
  const centerIdx = Math.floor(screenCoords.length / 2);
  const centerPoint = screenCoords[centerIdx];
  
  // 3. Calculate angle at center
  const prev = screenCoords[centerIdx - 1];
  const next = screenCoords[centerIdx + 1];
  const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
  
  // 4. Render text at angle
  ctx.save();
  ctx.translate(centerPoint.x, centerPoint.y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(50, 50, 50, 1)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.font = '12px Arial';
  ctx.strokeText(name, 0, 0); // Halo
  ctx.fillText(name, 0, 0);   // Text
  ctx.restore();
}
```

**LOD Strategy:**
- LOD 0 (>20km): No street names
- LOD 1 (7.5-20km): Major roads only (motorways, primary)
- LOD 2 (3-7.5km): + Secondary roads
- LOD 3 (<3km): All named streets

**Collision Detection (Phase 2):**
- Track rendered label positions
- Skip overlapping labels
- Priority: larger roads first

**Implementation Steps:**
1. **Add basic text rendering** (center point, horizontal)
2. **Add angle calculation** and rotated text
3. **Add LOD filtering** (major roads first)
4. **Add text halo** (white outline for readability)
5. **Test performance** (text rendering is expensive)
6. **Add label collision detection** (Phase 2 if needed)

**Estimated Time:** 3-4 days
**Priority:** CRITICAL (core navigation feature)

---

## Phase 2: Geographic Expansion (Hamburg → Germany → Europe)

**Goal:** Make the codebase location-agnostic and support country-by-country data.

### 2.1 Make Configuration Location-Agnostic (High Priority)
**Why:** Currently hardcoded to Hamburg coordinates. Need to support any region.

**Current hardcoded values:**
```javascript
// In map_renderer.js
this.center = { lon: 10.0, lat: 53.55 }; // Hamburg
this.tileBounds = {
  minLon: 8.48, maxLon: 11.5,
  minLat: 52.65, maxLat: 54.45
}; // Hamburg region
```

**New configuration system:**
```javascript
// config/regions.json
{
  "hamburg": {
    "name": "Hamburg, Germany",
    "center": { "lon": 10.0, "lat": 53.55 },
    "bounds": {
      "minLon": 8.48, "maxLon": 11.5,
      "minLat": 52.65, "maxLat": 54.45
    },
    "defaultViewKm": 10,
    "tileSet": "hamburg-2024-02"
  },
  "germany": {
    "name": "Germany",
    "center": { "lon": 10.45, "lat": 51.16 },
    "bounds": {
      "minLon": 5.87, "maxLon": 15.04,
      "minLat": 47.27, "maxLat": 55.06
    },
    "defaultViewKm": 500,
    "tileSet": "germany-2024-02"
  },
  "europe": {
    "name": "Europe",
    "center": { "lon": 10.0, "lat": 50.0 },
    "bounds": {
      "minLon": -10.0, "maxLon": 40.0,
      "minLat": 35.0, "maxLat": 71.0
    },
    "defaultViewKm": 2000,
    "tileSet": "europe-2024-02"
  }
}
```

**Implementation Steps:**
1. **Create regions.json** config file
2. **Add region selector** to UI (dropdown or URL param)
3. **Load region config** on init
4. **Update tile fetching** to use region-specific paths
   ```javascript
   fetch(`tiles/${region.tileSet}/${z}/${x}/${y}.json`)
   ```
5. **Update preprocessing** to support region parameter
   ```bash
   just tiles --region=germany
   ```

**Estimated Time:** 2 days
**Priority:** HIGH (required for expansion)

---

### 2.2 Multi-Region Tile Generation (High Priority)
**Why:** Need to generate tiles for Germany, then other countries.

**Data Sources:**
- Hamburg: hamburg-region.geojson (3.3GB) ✓ Current
- Germany: germany-latest.osm.pbf (~3.5GB compressed, ~30GB uncompressed)
- Europe: europe-latest.osm.pbf (~30GB compressed, ~300GB uncompressed)

**Preprocessing Strategy:**
```bash
# preprocessing/fetch-data.sh updates:
#!/bin/bash
REGION=${1:-hamburg}

case $REGION in
  hamburg)
    URL="https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf"
    ;;
  germany)
    URL="https://download.geofabrik.de/europe/germany-latest.osm.pbf"
    ;;
  france)
    URL="https://download.geofabrik.de/europe/france-latest.osm.pbf"
    ;;
  europe)
    URL="https://download.geofabrik.de/europe-latest.osm.pbf"
    ;;
esac

echo "Downloading $REGION from Geofabrik..."
curl -L -o "data/$REGION.osm.pbf" "$URL"

# Convert to GeoJSON (streaming for large files)
osmium export -f geojson "data/$REGION.osm.pbf" -o "data/$REGION.geojson"
```

**Tile Organization:**
```
public/tiles/
├── hamburg-2024-02/
│   ├── 8/133/82.json
│   ├── 11/...
│   └── 14/...
├── germany-2024-02/
│   ├── 8/...
│   ├── 11/...
│   └── 14/...
└── index.json  # Lists available regions
```

**Implementation Steps:**
1. **Update fetch-data.sh** to support region parameter
2. **Update split-tiles.py** to:
   - Take region parameter
   - Output to `tiles/{region}-{date}/`
   - Handle larger files (streaming/chunking for Germany/Europe)
3. **Create tiles/index.json** listing available regions
4. **Test** with Germany dataset
5. **Document** process for adding new countries

**Estimated Time:** 3-4 days (including large file handling)
**Priority:** HIGH (geographic expansion)

---

### 2.3 Optimize Tile Generation Speed (Medium Priority)
**Why:** Germany will take hours with current Python script. Europe would take days.

**Current Performance:**
- Hamburg (3.3GB): ~5-10 minutes (Python)
- Germany (30GB estimated): ~1-2 hours (Python)
- Europe (300GB estimated): ~10-20 hours (Python)

**Optimization Strategies:**

**A. Parallelize Python (Quick Win)**
```python
# Use multiprocessing to process tiles in parallel
from multiprocessing import Pool

def process_tile_batch(tile_keys):
    # Process multiple tiles in one worker
    results = {}
    for key in tile_keys:
        results[key] = process_features_for_tile(key)
    return results

# Split tiles into batches
tile_batches = chunk_list(all_tile_keys, num_workers=8)

with Pool(8) as pool:
    results = pool.map(process_tile_batch, tile_batches)
```

**B. Streaming JSON Parser (Memory Optimization)**
```python
# Use ijson for streaming large GeoJSON
import ijson

with open('data/germany.geojson', 'rb') as f:
    features = ijson.items(f, 'features.item')
    for feature in features:
        # Process one feature at a time (low memory)
        classify_and_assign_to_tiles(feature)
```

**C. Complete Zig Implementation (Best Performance)**
- Fix streaming JSON parser in split_tiles.zig
- Expected: 5-10x faster than Python
- Germany: ~10-20 minutes
- Europe: ~2-4 hours

**Implementation Steps:**
1. **Quick win:** Add multiprocessing to Python version
2. **Memory fix:** Add streaming JSON parsing (ijson)
3. **Long term:** Complete Zig streaming parser
4. **Benchmark** each approach with Germany dataset

**Estimated Time:** 
- Parallel Python: 1-2 days
- Streaming parser: 2-3 days
- Zig completion: 5-7 days

**Priority:** MEDIUM (important for Europe, but workarounds exist)

---

## Phase 3: Search Functionality

**Goal:** Enable users to find places, streets, and features.

### 3.1 Build Search Index (High Priority)
**Why:** Need fast lookup of features by name, type, location.

**Search Index Structure (SQLite):**
```sql
-- Create search database during preprocessing
CREATE TABLE features (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'street', 'poi', 'city', 'building'
  category TEXT,        -- 'restaurant', 'shop', 'hotel', etc.
  lon REAL NOT NULL,
  lat REAL NOT NULL,
  region TEXT NOT NULL, -- 'hamburg', 'germany', etc.
  zoom_level INTEGER,   -- Min zoom level to show
  UNIQUE(name, lon, lat, type)
);

CREATE INDEX idx_name ON features(name COLLATE NOCASE);
CREATE INDEX idx_type ON features(type);
CREATE INDEX idx_category ON features(category);
CREATE INDEX idx_location ON features(lon, lat);
CREATE INDEX idx_region ON features(region);

-- Full-text search index
CREATE VIRTUAL TABLE features_fts USING fts5(
  name,
  content=features,
  content_rowid=id
);
```

**Data Population (during tile generation):**
```python
# In split-tiles.py, extract searchable features:
def extract_search_features(feature, region):
    props = feature['properties']
    geom = feature['geometry']
    
    # Extract center point
    if geom['type'] == 'Point':
        lon, lat = geom['coordinates']
    elif geom['type'] == 'LineString':
        # Use first point or center
        lon, lat = geom['coordinates'][0]
    elif geom['type'] == 'Polygon':
        # Calculate centroid
        lon, lat = calculate_centroid(geom['coordinates'])
    
    # Determine type
    if 'name' in props:
        if 'highway' in props:
            return {
                'name': props['name'],
                'type': 'street',
                'category': props['highway'],
                'lon': lon, 'lat': lat,
                'region': region
            }
        elif 'amenity' in props or 'shop' in props:
            return {
                'name': props['name'],
                'type': 'poi',
                'category': props.get('amenity') or props.get('shop'),
                'lon': lon, 'lat': lat,
                'region': region
            }
        elif 'place' in props:
            return {
                'name': props['name'],
                'type': 'place',
                'category': props['place'],  # city, town, village
                'lon': lon, 'lat': lat,
                'region': region
            }
```

**Search Index Location:**
```
public/
├── search/
│   ├── hamburg.db      # SQLite database (~10-50 MB)
│   ├── germany.db      # ~100-500 MB
│   └── europe.db       # ~1-3 GB
└── tiles/...
```

**Implementation Steps:**
1. **Add SQLite generation** to preprocessing/split-tiles.py
2. **Create search schema** and indexes
3. **Extract searchable features** during tile processing
4. **Optimize database** (VACUUM, ANALYZE)
5. **Test** database size and query performance

**Estimated Time:** 3-4 days
**Priority:** HIGH (foundation for search)

---

### 3.2 Text Search API (High Priority)
**Why:** Users need to search by name (e.g., "Hauptbahnhof", "Aldi", "Alster").

**Architecture: sql.js-httpvfs (Lazy Loading)**

This approach uses [sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs) to query SQLite databases via HTTP range requests **without downloading the entire file**.

**Benefits:**
- Load only needed data chunks (not entire DB)
- Works on static hosting / CDN
- Germany DB (500MB) → fetch only ~1-5MB for typical queries
- Faster initial load, lower bandwidth

**Setup:**
```javascript
// Using sql.js-httpvfs for lazy loading
import { createDbWorker } from "sql.js-httpvfs";

class SearchEngine {
  async init(region) {
    const workerUrl = new URL(
      "sql.js-httpvfs/dist/sqlite.worker.js",
      import.meta.url,
    );
    const wasmUrl = new URL(
      "sql.js-httpvfs/dist/sql-wasm.wasm",
      import.meta.url,
    );
    
    // Database will be fetched in chunks as needed
    this.worker = await createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: `search/${region}.db`,
            requestChunkSize: 4096, // 4KB chunks
          },
        },
      ],
      workerUrl.toString(),
      wasmUrl.toString(),
    );
  }
  
  async search(query, options = {}) {
    const { type, limit = 10, bounds } = options;
    
    let sql = `
      SELECT f.* FROM features_fts 
      JOIN features f ON features_fts.rowid = f.id
      WHERE features_fts.name MATCH ?
    `;
    
    const params = [query + '*']; // Prefix matching
    
    if (type) {
      sql += ' AND f.type = ?';
      params.push(type);
    }
    
    if (bounds) {
      sql += ' AND f.lon BETWEEN ? AND ? AND f.lat BETWEEN ? AND ?';
      params.push(bounds.minLon, bounds.maxLon, bounds.minLat, bounds.maxLat);
    }
    
    sql += ` ORDER BY LENGTH(f.name) ASC LIMIT ?`;
    params.push(limit);
    
    // Query via worker (fetches only needed chunks)
    const results = await this.worker.db.query(sql, params);
    return results;
  }
  
  async searchNearby(lon, lat, radiusKm, options = {}) {
    // Spatial search within radius
    const { type, category, limit = 20 } = options;
    
    // Approximate distance using Haversine formula
    const sql = `
      SELECT *,
        (6371 * acos(
          cos(radians(?)) * cos(radians(lat)) *
          cos(radians(lon) - radians(?)) +
          sin(radians(?)) * sin(radians(lat))
        )) AS distance
      FROM features
      WHERE distance < ?
      ${type ? 'AND type = ?' : ''}
      ${category ? 'AND category = ?' : ''}
      ORDER BY distance ASC
      LIMIT ?
    `;
    
    const params = [lat, lon, lat, radiusKm];
    if (type) params.push(type);
    if (category) params.push(category);
    params.push(limit);
    
    const results = await this.worker.db.query(sql, params);
    return results;
  }
}
```

**Why sql.js-httpvfs?**
- **Scales to Europe:** 500MB+ databases work fine (only fetch what's needed)
- **Static hosting:** No server needed, works on GitHub Pages/CDN
- **Fast queries:** Indexed queries fetch <5MB even from 500MB database
- **Lazy regions:** Load Germany DB only when user switches to Germany
```javascript
// Simple Express.js backend
const express = require('express');
const sqlite3 = require('sqlite3');

const app = express();
const dbs = {
  hamburg: new sqlite3.Database('public/search/hamburg.db'),
  germany: new sqlite3.Database('public/search/germany.db')
};

app.get('/api/search', (req, res) => {
  const { q, region = 'hamburg', type, limit = 10 } = req.query;
  
  const db = dbs[region];
  const sql = `
    SELECT f.* FROM features_fts 
    JOIN features f ON features_fts.rowid = f.id
    WHERE features_fts.name MATCH ?
    ${type ? 'AND f.type = ?' : ''}
    ORDER BY LENGTH(f.name) ASC LIMIT ?
  `;
  
  const params = [q + '*'];
  if (type) params.push(type);
  params.push(limit);
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ results: rows });
  });
});

app.listen(3000);
```

**UI Integration:**
```javascript
// Add search box to UI
<div class="search-container">
  <input type="text" id="search-input" placeholder="Search places, streets...">
  <div id="search-results"></div>
</div>

// Autocomplete with debounce
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const query = e.target.value;
    if (query.length < 2) return;
    
    const results = await searchEngine.search(query, { limit: 10 });
    displaySearchResults(results);
  }, 300);
});

function displaySearchResults(results) {
  const html = results.map(r => `
    <div class="result" onclick="jumpTo(${r.lon}, ${r.lat})">
      <strong>${r.name}</strong>
      <span class="type">${r.type}</span>
    </div>
  `).join('');
  document.getElementById('search-results').innerHTML = html;
}

function jumpTo(lon, lat) {
  renderer.center = { lon, lat };
  renderer.viewWidthMeters = 1000; // Zoom in
  renderer.renderMap();
}
```

**Implementation Steps:**
1. **Install sql.js-httpvfs** (`npm install sql.js-httpvfs`)
2. **Set up database worker** with lazy loading config
3. **Add search UI** (input box, results dropdown, autocomplete)
4. **Implement search queries** (text, spatial, category)
5. **Add "jump to location"** on result click
6. **Test** with Hamburg data (~10MB database)
7. **Verify HTTP range requests** work (check DevTools Network tab)
8. **Test with larger DB** (simulate Germany with subset)

**Database Optimization for sql.js-httpvfs:**
```sql
-- Important: Structure DB for range-request efficiency
-- Create indexes BEFORE data insertion
CREATE INDEX idx_name ON features(name COLLATE NOCASE);
CREATE INDEX idx_location ON features(lon, lat);

-- Use WITHOUT ROWID for compact storage
CREATE TABLE features (...) WITHOUT ROWID;

-- Run VACUUM to defragment
VACUUM;

-- Analyze for query planner
ANALYZE;
```

**Estimated Time:** 5-6 days (includes sql.js-httpvfs learning curve)
**Priority:** HIGH (core feature)

---

### 3.3 Spatial/Category Search (Medium Priority)
**Why:** "Find restaurants near me", "Show all parks in viewport", etc.

**Search Types:**

**A. Nearby Search (Point + Radius)**
```javascript
// Find all restaurants within 2km of location
const results = await searchEngine.searchNearby(
  10.0, 53.55,  // Hamburg Hauptbahnhof
  2.0,          // 2km radius
  { category: 'restaurant', limit: 20 }
);
```

**B. Viewport Search (Bounding Box)**
```javascript
// Find all features currently visible on map
const bounds = renderer.calculateBounds();
const results = await searchEngine.search('', {
  type: 'poi',
  bounds: {
    minLon: bounds.minLon,
    maxLon: bounds.maxLon,
    minLat: bounds.minLat,
    maxLat: bounds.maxLat
  }
});
```

**C. Category Filter UI**
```javascript
// Filter panel in UI
<div class="filters">
  <h3>Find nearby:</h3>
  <button onclick="findNearby('restaurant')">🍴 Restaurants</button>
  <button onclick="findNearby('hotel')">🏨 Hotels</button>
  <button onclick="findNearby('bank')">🏦 Banks</button>
  <button onclick="findNearby('hospital')">🏥 Hospitals</button>
</div>

function findNearby(category) {
  const { lon, lat } = renderer.center;
  const radiusKm = renderer.viewWidthMeters / 1000;
  
  searchEngine.searchNearby(lon, lat, radiusKm, { category })
    .then(results => {
      displaySearchResults(results);
      highlightOnMap(results);
    });
}

function highlightOnMap(results) {
  // Draw markers on map for search results
  results.forEach(r => {
    const screenPos = renderer.latLonToScreen(r.lat, r.lon);
    renderer.drawMarker(screenPos.x, screenPos.y, '📍');
  });
}
```

**Implementation Steps:**
1. **Add spatial search queries** to SearchEngine
2. **Add category filter UI** (buttons or dropdown)
3. **Add result highlighting** on map (markers/pins)
4. **Add "search in viewport"** button
5. **Test** performance with large result sets

**Estimated Time:** 2-3 days
**Priority:** MEDIUM (enhances usability)

---

## Phase 4: CDN & Caching Strategy

**Goal:** Optimize tile delivery and support cache invalidation.

### 4.1 Tile Versioning & Cache Headers (High Priority)
**Why:** Enable browser caching while allowing updates.

**Tile URL Versioning:**
```javascript
// Current: /tiles/8/133/82.json
// Versioned: /tiles/hamburg-2024-02-09/8/133/82.json

// In map_renderer.js:
const tileUrl = `tiles/${config.tileSet}/${z}/${x}/${y}.json`;

// When tiles update, change tileSet in regions.json:
{
  "hamburg": {
    "tileSet": "hamburg-2024-03-15"  // New version
  }
}
```

**HTTP Cache Headers:**
```javascript
// In server (or CDN config):
// For versioned tiles - cache forever (immutable)
Cache-Control: public, max-age=31536000, immutable

// For regions.json - short cache, check for updates
Cache-Control: public, max-age=3600, must-revalidate

// For search databases - cache but validate
Cache-Control: public, max-age=86400, must-revalidate
```

**Service Worker (Optional - Offline Support):**
```javascript
// sw.js - Cache tiles for offline use
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/tiles/')) {
    event.respondWith(
      caches.open('tiles-v1').then(cache => {
        return cache.match(event.request).then(response => {
          return response || fetch(event.request).then(fetchResponse => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

**Implementation Steps:**
1. **Add version to tile paths** (preprocessing + renderer)
2. **Add cache headers** to server (or document for CDN)
3. **Update regions.json** format to include tileSet version
4. **Test** cache behavior (browser DevTools)
5. **Document** update process for new snapshots

**Estimated Time:** 2 days
**Priority:** HIGH (performance + update strategy)

---

### 4.2 CDN Integration (Medium Priority)
**Why:** Faster tile delivery from edge locations worldwide.

**CDN Options:**
- **Cloudflare Pages** (free tier, 500GB/month)
- **Cloudflare R2** (object storage, cheap, global CDN)
- **AWS S3 + CloudFront**
- **Netlify** (free tier, good for static sites)

**Cloudflare R2 Setup (Recommended):**
```bash
# 1. Upload tiles to R2
wrangler r2 bucket create osm-tiles

# Upload tile directory
wrangler r2 object put osm-tiles/hamburg-2024-02/8/133/82.json \
  --file=public/tiles/hamburg-2024-02/8/133/82.json

# Bulk upload
rclone sync public/tiles/ r2:osm-tiles/

# 2. Configure public access
# In Cloudflare dashboard: Enable R2.dev subdomain
# URL: https://osm-tiles.account.r2.dev/hamburg-2024-02/8/133/82.json

# 3. Add custom domain (optional)
# tiles.yourdomain.com → R2 bucket

# 4. Set cache rules in Cloudflare
# Cache Everything rule for /tiles/*
# Edge TTL: 1 year for versioned paths
```

**Update Renderer:**
```javascript
// config/cdn.js
const CDN_BASE_URL = 'https://osm-tiles.account.r2.dev';
// OR: const CDN_BASE_URL = 'https://tiles.yourdomain.com';

// In map_renderer.js:
const tileUrl = `${CDN_BASE_URL}/${config.tileSet}/${z}/${x}/${y}.json`;
```

**Fallback Strategy:**
```javascript
async loadTile(z, x, y) {
  const cdnUrl = `${CDN_BASE}/${region}/${z}/${x}/${y}.json`;
  const localUrl = `tiles/${region}/${z}/${x}/${y}.json`;
  
  try {
    // Try CDN first
    const response = await fetch(cdnUrl);
    if (response.ok) return await response.json();
  } catch (e) {
    console.warn('CDN failed, trying local:', e);
  }
  
  // Fallback to local
  const response = await fetch(localUrl);
  return await response.json();
}
```

**Implementation Steps:**
1. **Choose CDN provider** (recommend: Cloudflare R2)
2. **Set up R2 bucket** and upload Hamburg tiles
3. **Add CDN_BASE_URL config** option
4. **Add fallback logic** (CDN → local)
5. **Test** from different geographic locations
6. **Document** upload process for new regions

**Estimated Time:** 2-3 days
**Priority:** MEDIUM (performance boost, not critical initially)

---

## Phase 5: Polish & Scale Testing

### 5.1 Performance Testing at Scale (High Priority)
**Why:** Ensure system handles Germany/Europe data volumes.

**Test Scenarios:**
1. **Tile Generation:**
   - Germany (30GB) → tiles (~500k-1M tiles)
   - Measure: Time, memory usage, output size
   - Target: <2 hours with optimized script

2. **Search Database:**
   - Germany POIs (~5-10M entries)
   - Test query performance (< 50ms for simple queries)
   - Test database size (<500MB compressed)

3. **Browser Performance:**
   - Viewport with 100k+ features
   - Test classification time (<200ms)
   - Test render time (<150ms)
   - Memory usage (<500MB)

4. **Network Performance:**
   - Load time for 10 tiles (should be <500ms)
   - Test with CDN vs local
   - Test on 3G connection

**Implementation Steps:**
1. **Generate Germany tiles** as test dataset
2. **Benchmark** all operations (document results)
3. **Identify bottlenecks** and optimize
4. **Add performance budgets** to CI
5. **Document** scaling characteristics

**Estimated Time:** 3-4 days
**Priority:** HIGH (validate scalability)

---

### 5.2 UI/UX Polish (Medium Priority)
**Why:** Professional appearance and usability.

**Improvements:**
1. **Loading States:**
   - Progress bar during tile generation
   - Skeleton screens during tile loading
   - Loading spinner for search

2. **Search UX:**
   - Keyboard navigation (arrow keys, enter)
   - Recent searches
   - Search history (localStorage)
   - Clear button

3. **Map Controls:**
   - Zoom to current location (geolocation API)
   - Reset view button
   - Fullscreen mode
   - Share location (URL params)

4. **Mobile Optimization:**
   - Touch gestures (pinch to zoom)
   - Mobile-friendly controls (larger buttons)
   - Responsive layout

5. **Accessibility:**
   - Keyboard navigation
   - Screen reader labels (ARIA)
   - High contrast mode

**Implementation Steps:**
1. **Add loading indicators** (progress, spinners)
2. **Improve search UI** (keyboard nav, history)
3. **Add map controls** (geolocation, share, fullscreen)
4. **Test on mobile** devices
5. **Add accessibility** features

**Estimated Time:** 4-5 days
**Priority:** MEDIUM (polish)

---

### 5.3 Documentation & Deployment (High Priority)
**Why:** Enable others to use/deploy the system.

**Documentation Needed:**
1. **Deployment Guide:**
   - Self-hosted setup (Docker, static hosting)
   - CDN configuration
   - Environment variables
   - Monitoring setup

2. **Data Update Process:**
   - Download new OSM data
   - Regenerate tiles
   - Upload to CDN
   - Update region config

3. **Development Guide:**
   - Local setup
   - Adding new regions
   - Modifying tile format
   - Contributing guidelines

4. **API Documentation:**
   - Search API endpoints
   - Query parameters
   - Response formats
   - Rate limits

**Docker Setup:**
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY public/ ./public/
COPY config/ ./config/

# Serve static files
RUN npm install -g serve
CMD ["serve", "-s", "public", "-l", "8080"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./public/tiles:/app/public/tiles:ro
    environment:
      - CDN_BASE_URL=${CDN_BASE_URL}
```

**Implementation Steps:**
1. **Write deployment guide** (README section)
2. **Create Dockerfile** and docker-compose.yml
3. **Document data update** process
4. **Write API docs** (if using server-side search)
5. **Add troubleshooting** section

**Estimated Time:** 2-3 days
**Priority:** HIGH (enablement)

---

## Summary: Recommended Order

Based on dependencies and impact, here's the recommended implementation order:

### Sprint 1: Foundation (2-3 weeks)
1. ✅ **1.1 Optimize Tile Format** (HIGH) - 5 days
   - Reduces size for all future work
2. ✅ **1.4 Render Street Names** (CRITICAL) - 4 days
   - Core navigation feature
3. ✅ **2.1 Make Config Location-Agnostic** (HIGH) - 2 days
   - Required for expansion

### Sprint 2: Visual Completeness (1-2 weeks)
4. ✅ **1.2 Render Sea/Ocean** (MEDIUM) - 3 days
5. ✅ **1.3 Render Borders** (MEDIUM) - 2 days

### Sprint 3: Geographic Expansion (2-3 weeks)
6. ✅ **2.2 Multi-Region Tile Generation** (HIGH) - 4 days
7. ✅ **1.3 Optimize Tile Generation** (MEDIUM) - 3 days
   - Parallel Python implementation
8. ✅ **5.1 Performance Testing (Germany)** (HIGH) - 4 days

### Sprint 4: Search Foundation (2 weeks)
9. ✅ **3.1 Build Search Index** (HIGH) - 4 days
10. ✅ **3.2 Text Search API** (HIGH) - 5 days

### Sprint 5: Search Enhancement (1 week)
11. ✅ **3.3 Spatial/Category Search** (MEDIUM) - 3 days

### Sprint 6: Production Ready (1-2 weeks)
12. ✅ **4.1 Tile Versioning** (HIGH) - 2 days
13. ✅ **4.2 CDN Integration** (MEDIUM) - 3 days
14. ✅ **5.3 Documentation** (HIGH) - 3 days

### Sprint 7: Polish (1 week)
15. ✅ **5.2 UI/UX Polish** (MEDIUM) - 5 days

---

## Total Estimates

- **Foundation + Visual:** 3-4 weeks
- **Geographic Expansion:** 2-3 weeks
- **Search Features:** 3 weeks
- **Production Ready:** 2 weeks
- **Polish:** 1 week

**Total: ~11-13 weeks (3 months)**

For faster progress, prioritize:
1. Street names (CRITICAL)
2. Tile format optimization (HIGH impact)
3. Search (HIGH user value)
4. Geographic expansion (GOAL)

---

## Decisions Made

1. **Tile Format:** ✅ Compact JSON
   - Good balance: 60-80% size reduction, human-readable, simpler than binary
   - No additional tooling needed, works directly in browser

2. **Search Architecture:** ✅ Client-side with sql.js-httpvfs
   - Lazy loads only needed data chunks via HTTP range requests
   - Works on static hosting / CDN (no backend needed)
   - Scales to large databases (Germany: 500MB → fetch only ~1-5MB per query)
   - Offline-capable with service worker caching

3. **Tile Generation:** ✅ Zig with streaming JSON parser
   - 5-10x faster than Python (critical for Europe dataset)
   - Complete the streaming parser implementation
   - Worth the investment for long-term scalability

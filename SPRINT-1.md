# Sprint 1: Street Names, Tile Optimization, Zig Streaming Parser

**Duration:** 2-3 weeks
**Order:** Street Names → Tile Format → Zig Streaming Parser

---

## Task 1: Render Street Names (CRITICAL)
**Duration:** 3-4 days
**Status:** 🔄 In Progress

### Goal
Render street names along road paths at appropriate zoom levels for navigation.

### Requirements
- Text follows road curves (rotated along path)
- LOD-based filtering (zoom-dependent visibility)
- Readable text (halo/outline for contrast)
- Performance: <100ms for visible streets

### Implementation Plan

#### Step 1.1: Add Street Name Data to Tiles (1 day)

**Modify preprocessing/split-tiles.py:**

```python
def classify_feature(feature):
    props = feature['properties']
    geom = feature['geometry']
    
    # Existing classification...
    if 'highway' in props:
        highway_type = props['highway']
        
        # Get street name (if exists)
        name = props.get('name', '')
        
        # Determine render properties
        if highway_type in ['motorway', 'motorway_link']:
            return {
                'layer': 'highways',
                'color': [233, 116, 81, 255],
                'width': 5,
                'minLOD': 0,
                'name': name,  # NEW: Include name
                'name_priority': 1  # NEW: High priority for motorways
            }
        elif highway_type in ['primary', 'primary_link']:
            return {
                'layer': 'highways',
                'color': [253, 191, 111, 255],
                'width': 4,
                'minLOD': 0,
                'name': name,
                'name_priority': 2  # Lower priority
            }
        elif highway_type in ['secondary', 'secondary_link']:
            return {
                'layer': 'roads',
                'color': [255, 217, 102, 255],
                'width': 3,
                'minLOD': 1,
                'name': name,
                'name_priority': 3
            }
        elif highway_type in ['tertiary', 'tertiary_link']:
            return {
                'layer': 'roads',
                'color': [255, 255, 255, 255],
                'width': 2,
                'minLOD': 2,
                'name': name,
                'name_priority': 4
            }
        # ... other road types
```

**Test:**
```bash
# Regenerate Hamburg tiles with street names
cd preprocessing
python3 split-tiles.py ../data/hamburg-region.geojson

# Check a tile has name property
cat ../public/tiles/11/1067/657.json | jq '.features[0].properties.render.name'
```

---

#### Step 1.2: Basic Text Rendering (1 day)

**Add to public/map_renderer.js:**

```javascript
// In renderMap(), after rendering roads layer:
renderStreetNames(ctx, visibleFeatures) {
  const lod = this.getLOD();
  
  // Filter roads with names based on LOD
  const namedRoads = visibleFeatures.filter(f => {
    const render = f.properties.render;
    if (!render || !render.name) return false;
    
    // LOD filtering for street names
    const namePriority = render.name_priority || 999;
    if (lod === 0) return namePriority <= 1; // Only motorways
    if (lod === 1) return namePriority <= 2; // + primary
    if (lod === 2) return namePriority <= 3; // + secondary
    return namePriority <= 4; // All named streets
  });
  
  // Sort by priority (render important roads first)
  namedRoads.sort((a, b) => {
    const aPri = a.properties.render.name_priority || 999;
    const bPri = b.properties.render.name_priority || 999;
    return aPri - bPri;
  });
  
  // Render each street name
  for (const feature of namedRoads) {
    this.renderStreetName(ctx, feature);
  }
}

renderStreetName(ctx, feature) {
  const name = feature.properties.render.name;
  const coords = feature.geometry.coordinates;
  
  // Convert to screen coordinates
  const screenCoords = coords.map(([lon, lat]) => 
    this.latLonToScreen(lat, lon)
  );
  
  // Skip if not enough points
  if (screenCoords.length < 2) return;
  
  // Calculate path length
  let pathLength = 0;
  for (let i = 1; i < screenCoords.length; i++) {
    const dx = screenCoords[i].x - screenCoords[i-1].x;
    const dy = screenCoords[i].y - screenCoords[i-1].y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }
  
  // Set font and measure text
  ctx.font = '12px Arial, sans-serif';
  const textWidth = ctx.measureText(name).width;
  
  // Skip if text too long for path (with some padding)
  if (textWidth > pathLength * 0.8) return;
  
  // Find center point of path
  const centerIdx = Math.floor(screenCoords.length / 2);
  const centerPoint = screenCoords[centerIdx];
  
  // Calculate angle at center (simple version - just use adjacent points)
  let angle = 0;
  if (centerIdx > 0 && centerIdx < screenCoords.length - 1) {
    const prev = screenCoords[centerIdx - 1];
    const next = screenCoords[centerIdx + 1];
    angle = Math.atan2(next.y - prev.y, next.x - prev.x);
    
    // Flip text if upside down
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      angle += Math.PI;
    }
  }
  
  // Render text at angle
  ctx.save();
  ctx.translate(centerPoint.x, centerPoint.y);
  ctx.rotate(angle);
  
  // Draw text with halo (outline) for readability
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(name, 0, 0);
  
  // Draw text
  ctx.fillStyle = 'rgba(50, 50, 50, 1)';
  ctx.fillText(name, 0, 0);
  
  ctx.restore();
}
```

**Add to renderMap() rendering sequence:**

```javascript
// After rendering all layers, render street names on top
this.renderStreetNames(ctx, classifiedFeatures);
```

**Test in browser:**
- Load map, zoom to LOD 2-3
- Should see street names on major roads
- Names should follow road direction
- Text should be readable (white halo)

---

#### Step 1.3: Improve Text Placement (1 day)

**Problems to solve:**
- Text may render off-screen
- Text may overlap with other labels
- Curved roads need better placement

**Enhanced placement algorithm:**

```javascript
renderStreetName(ctx, feature) {
  const name = feature.properties.render.name;
  const coords = feature.geometry.coordinates;
  
  // Convert to screen coordinates
  const screenCoords = coords.map(([lon, lat]) => 
    this.latLonToScreen(lat, lon)
  );
  
  // Skip if not enough points
  if (screenCoords.length < 2) return;
  
  // Calculate segments and find longest straight segment
  const segments = [];
  for (let i = 1; i < screenCoords.length; i++) {
    const dx = screenCoords[i].x - screenCoords[i-1].x;
    const dy = screenCoords[i].y - screenCoords[i-1].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    segments.push({
      start: screenCoords[i-1],
      end: screenCoords[i],
      length,
      angle
    });
  }
  
  // Find longest segment for text placement
  let bestSegment = segments[0];
  for (const seg of segments) {
    if (seg.length > bestSegment.length) {
      bestSegment = seg;
    }
  }
  
  // Set font and measure text
  ctx.font = '12px Arial, sans-serif';
  const textWidth = ctx.measureText(name).width;
  
  // Skip if text too long for best segment
  if (textWidth > bestSegment.length * 0.9) return;
  
  // Calculate center of best segment
  const centerX = (bestSegment.start.x + bestSegment.end.x) / 2;
  const centerY = (bestSegment.start.y + bestSegment.end.y) / 2;
  
  // Check if center is on screen (with margin)
  const margin = 50;
  if (centerX < -margin || centerX > this.canvas.width + margin ||
      centerY < -margin || centerY > this.canvas.height + margin) {
    return; // Off screen
  }
  
  // Get angle
  let angle = bestSegment.angle;
  
  // Flip text if upside down
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
    angle += Math.PI;
  }
  
  // Render text at angle
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  
  // Draw text with halo (outline) for readability
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(name, -textWidth / 2, 0); // Center align
  
  // Draw text
  ctx.fillStyle = 'rgba(50, 50, 50, 1)';
  ctx.fillText(name, -textWidth / 2, 0);
  
  ctx.restore();
}
```

**Test:**
- Text should render on longest straight segment
- Text should be center-aligned
- Off-screen labels should be skipped
- Text should not render upside-down

---

#### Step 1.4: Add Collision Detection (Optional - 1 day)

**Problem:** Labels may overlap each other.

**Solution:** Track rendered label bounding boxes and skip overlapping labels.

```javascript
// Add to constructor:
this._labelBounds = []; // Store rendered label bounding boxes

// In renderMap(), reset before rendering names:
this._labelBounds = [];

renderStreetName(ctx, feature) {
  // ... existing code to calculate position ...
  
  // Calculate bounding box for label
  const bbox = {
    x: centerX - textWidth / 2 - 5, // Padding
    y: centerY - 8, // Font height estimate
    width: textWidth + 10,
    height: 16
  };
  
  // Rotate bbox corners to check collision properly
  const corners = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x, y: bbox.y + bbox.height },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
  ];
  
  // Check collision with existing labels
  for (const existing of this._labelBounds) {
    if (this.bboxIntersects(bbox, existing)) {
      return; // Skip overlapping label
    }
  }
  
  // Render text (existing code)...
  
  // Store bounding box
  this._labelBounds.push(bbox);
}

bboxIntersects(a, b) {
  return !(a.x + a.width < b.x || 
           b.x + b.width < a.x ||
           a.y + a.height < b.y ||
           b.y + b.height < a.y);
}
```

**Test:**
- Zoom to busy area with many streets
- Labels should not overlap
- Important roads (lower priority number) render first

---

#### Step 1.5: Performance Optimization (0.5 days)

**Current issue:** Rendering thousands of street names may be slow.

**Optimizations:**

1. **Limit labels per frame:**
```javascript
renderStreetNames(ctx, visibleFeatures) {
  const lod = this.getLOD();
  const maxLabels = lod <= 1 ? 50 : lod === 2 ? 100 : 200;
  
  // ... filter and sort ...
  
  let renderedCount = 0;
  for (const feature of namedRoads) {
    if (renderedCount >= maxLabels) break;
    if (this.renderStreetName(ctx, feature)) {
      renderedCount++;
    }
  }
}
```

2. **Cache text measurements:**
```javascript
// In constructor:
this._textWidthCache = new Map();

// In renderStreetName:
let textWidth = this._textWidthCache.get(name);
if (!textWidth) {
  textWidth = ctx.measureText(name).width;
  this._textWidthCache.set(name, textWidth);
}
```

3. **Skip tiny segments:**
```javascript
// In segment calculation:
if (length < 10) continue; // Skip segments < 10 pixels
```

**Test:**
- Profile rendering with DevTools
- Street name rendering should be <50ms
- Frame rate should stay smooth during pan

---

### Testing Checklist

- [ ] Names appear on roads at appropriate zoom levels
- [ ] Text follows road direction (rotated correctly)
- [ ] Text is readable (white halo provides contrast)
- [ ] No upside-down text
- [ ] Labels don't render off-screen
- [ ] Important roads labeled first (motorways > primary > secondary)
- [ ] Performance: <50ms for label rendering
- [ ] No overlapping labels (if collision detection implemented)
- [ ] Text skips if too long for road segment

### Files Modified
- `preprocessing/split-tiles.py` - Add name and name_priority to render metadata
- `public/map_renderer.js` - Add renderStreetNames() and renderStreetName()

### Deliverables
1. Street names rendering on roads at zoom levels 1-3
2. Performance benchmarks documented
3. Hamburg tiles regenerated with name data

---

## Task 2: Optimize Tile Format (HIGH)
**Duration:** 3-5 days
**Status:** ⏳ Pending (after Task 1)

### Goal
Reduce tile size by 60-80% using compact JSON format.

### Current Tile Format (498 bytes typical)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[10.0, 53.5], [10.01, 53.51]]
      },
      "properties": {
        "highway": "primary",
        "name": "Hauptstraße",
        "render": {
          "layer": "highways",
          "color": [253, 191, 111, 255],
          "width": 3,
          "minLOD": 1,
          "name": "Hauptstraße",
          "name_priority": 2
        }
      }
    }
  ]
}
```

### Optimized Compact Format (~100-150 bytes)
```json
{
  "v": 1,
  "strings": ["Hauptstraße", "Nebenstraße"],
  "colors": [[253,191,111,255], [255,255,255,255]],
  "layers": {
    "highways": {
      "lines": [
        [0, 0, 3, 1, 2, 0],
        [2, 1, 3, 1, 2, 1]
      ]
    },
    "water": {
      "polygons": [
        [4, 3, 0, 0, 0, 0]
      ]
    }
  },
  "coords": [10.0, 53.5, 10.01, 53.51, 10.02, 53.52]
}
```

**Encoding:**
- `lines: [coord_start, coord_count, color_idx, width, lod, name_idx]`
- `polygons: [coord_start, coord_count, color_idx, 0, lod, name_idx]`
- All coordinates in flat array
- Strings and colors deduplicated in lookup tables

### Implementation Plan

#### Step 2.1: Design Compact Format Specification (0.5 days)

Create `preprocessing/TILE_FORMAT.md`:

```markdown
# Compact Tile Format v1

## Structure

{
  "v": 1,                    // Format version
  "strings": [...],          // String lookup table
  "colors": [...],           // Color lookup table [r,g,b,a]
  "layers": {
    "layer_name": {
      "lines": [...],        // LineString features
      "polygons": [...],     // Polygon features
      "points": [...]        // Point features
    }
  },
  "coords": [...]            // Flat coordinate array [lon, lat, lon, lat, ...]
}

## Feature Encoding

### Lines (LineString)
[coord_offset, coord_count, color_idx, width, lod, name_idx]
- coord_offset: Start index in coords array (÷2 for coordinate pairs)
- coord_count: Number of coordinate pairs
- color_idx: Index in colors array
- width: Line width in pixels
- lod: Minimum LOD level (0-3)
- name_idx: Index in strings array (0 = no name)

### Polygons
[coord_offset, coord_count, color_idx, 0, lod, name_idx]
- Same as lines, but width=0 for polygons

### Points
[coord_offset, category_idx, lod, name_idx]
- coord_offset: Index in coords array (÷2)
- category_idx: POI category (numeric ID)
- lod: Minimum LOD level
- name_idx: Index in strings array

## Size Reduction

Before: ~498 bytes (full GeoJSON)
After: ~100-150 bytes (compact)
Reduction: 70-80%
```

---

#### Step 2.2: Implement Encoder (2 days)

Update `preprocessing/split-tiles.py`:

```python
import json
from collections import defaultdict

class CompactTileEncoder:
    def __init__(self):
        self.strings = []
        self.string_map = {}
        self.colors = []
        self.color_map = {}
        self.coords = []
        self.coord_map = {}
        self.layers = defaultdict(lambda: {
            'lines': [],
            'polygons': [],
            'points': []
        })
    
    def add_string(self, s):
        if not s:
            return 0
        if s not in self.string_map:
            self.string_map[s] = len(self.strings)
            self.strings.append(s)
        return self.string_map[s]
    
    def add_color(self, color):
        key = tuple(color)
        if key not in self.color_map:
            self.color_map[key] = len(self.colors)
            self.colors.append(list(color))
        return self.color_map[key]
    
    def add_coords(self, coords):
        # Convert coordinates to flat array
        flat_coords = []
        for lon, lat in coords:
            flat_coords.extend([lon, lat])
        
        # Check if these exact coords exist (deduplication)
        key = tuple(flat_coords)
        if key in self.coord_map:
            return self.coord_map[key]
        
        # Add new coordinates
        offset = len(self.coords) // 2  # Coordinate pair offset
        self.coords.extend(flat_coords)
        self.coord_map[key] = (offset, len(coords))
        return (offset, len(coords))
    
    def encode_feature(self, feature):
        geom = feature['geometry']
        render = feature['properties'].get('render', {})
        
        layer = render.get('layer', 'unknown')
        color_idx = self.add_color(render.get('color', [128, 128, 128, 255]))
        width = render.get('width', 1)
        lod = render.get('minLOD', 0)
        name_idx = self.add_string(render.get('name', ''))
        
        if geom['type'] == 'LineString':
            coord_offset, coord_count = self.add_coords(geom['coordinates'])
            self.layers[layer]['lines'].append([
                coord_offset, coord_count, color_idx, width, lod, name_idx
            ])
        
        elif geom['type'] == 'Polygon':
            # Take outer ring only
            coord_offset, coord_count = self.add_coords(geom['coordinates'][0])
            self.layers[layer]['polygons'].append([
                coord_offset, coord_count, color_idx, 0, lod, name_idx
            ])
        
        elif geom['type'] == 'Point':
            coord_offset, _ = self.add_coords([geom['coordinates']])
            category = render.get('category', 0)
            self.layers[layer]['points'].append([
                coord_offset, category, lod, name_idx
            ])
    
    def encode_tile(self, features):
        for feature in features:
            self.encode_feature(feature)
        
        # Remove empty layers
        layers_clean = {}
        for layer_name, layer_data in self.layers.items():
            if layer_data['lines'] or layer_data['polygons'] or layer_data['points']:
                # Only include non-empty geometry types
                clean_layer = {}
                if layer_data['lines']:
                    clean_layer['lines'] = layer_data['lines']
                if layer_data['polygons']:
                    clean_layer['polygons'] = layer_data['polygons']
                if layer_data['points']:
                    clean_layer['points'] = layer_data['points']
                layers_clean[layer_name] = clean_layer
        
        return {
            'v': 1,
            'strings': self.strings,
            'colors': self.colors,
            'layers': layers_clean,
            'coords': self.coords
        }

# In main tile generation:
for tile_key, features in tiles.items():
    encoder = CompactTileEncoder()
    compact_tile = encoder.encode_tile(features)
    
    # Write compact tile
    tile_path = f"public/tiles/{tile_key.z}/{tile_key.x}/{tile_key.y}.json"
    with open(tile_path, 'w') as f:
        json.dump(compact_tile, f, separators=(',', ':'))  # Minified
```

**Test encoder:**
```python
# Test with sample feature
feature = {
    'geometry': {'type': 'LineString', 'coordinates': [[10.0, 53.5], [10.01, 53.51]]},
    'properties': {
        'render': {
            'layer': 'highways',
            'color': [253, 191, 111, 255],
            'width': 3,
            'minLOD': 1,
            'name': 'Hauptstraße'
        }
    }
}

encoder = CompactTileEncoder()
result = encoder.encode_tile([feature])
print(json.dumps(result, indent=2))
```

---

#### Step 2.3: Implement Decoder (2 days)

Update `public/map_renderer.js`:

```javascript
class CompactTileDecoder {
  decode(compactTile) {
    if (compactTile.v !== 1) {
      throw new Error(`Unsupported tile format version: ${compactTile.v}`);
    }
    
    const features = [];
    const { strings, colors, layers, coords } = compactTile;
    
    // Decode each layer
    for (const [layerName, layerData] of Object.entries(layers)) {
      // Decode lines
      if (layerData.lines) {
        for (const line of layerData.lines) {
          features.push(this.decodeLine(line, layerName, strings, colors, coords));
        }
      }
      
      // Decode polygons
      if (layerData.polygons) {
        for (const poly of layerData.polygons) {
          features.push(this.decodePolygon(poly, layerName, strings, colors, coords));
        }
      }
      
      // Decode points
      if (layerData.points) {
        for (const point of layerData.points) {
          features.push(this.decodePoint(point, layerName, strings, coords));
        }
      }
    }
    
    return features;
  }
  
  decodeLine(encoded, layerName, strings, colors, coords) {
    const [coordOffset, coordCount, colorIdx, width, lod, nameIdx] = encoded;
    
    // Extract coordinates
    const startIdx = coordOffset * 2;
    const endIdx = startIdx + (coordCount * 2);
    const flatCoords = coords.slice(startIdx, endIdx);
    
    // Convert flat array to coordinate pairs
    const coordinates = [];
    for (let i = 0; i < flatCoords.length; i += 2) {
      coordinates.push([flatCoords[i], flatCoords[i + 1]]);
    }
    
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties: {
        render: {
          layer: layerName,
          color: colors[colorIdx],
          width,
          minLOD: lod,
          name: strings[nameIdx] || ''
        }
      }
    };
  }
  
  decodePolygon(encoded, layerName, strings, colors, coords) {
    const [coordOffset, coordCount, colorIdx, _, lod, nameIdx] = encoded;
    
    // Extract coordinates (same as line)
    const startIdx = coordOffset * 2;
    const endIdx = startIdx + (coordCount * 2);
    const flatCoords = coords.slice(startIdx, endIdx);
    
    const coordinates = [];
    for (let i = 0; i < flatCoords.length; i += 2) {
      coordinates.push([flatCoords[i], flatCoords[i + 1]]);
    }
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]  // Outer ring only
      },
      properties: {
        render: {
          layer: layerName,
          color: colors[colorIdx],
          fill: true,
          minLOD: lod,
          name: strings[nameIdx] || ''
        }
      }
    };
  }
  
  decodePoint(encoded, layerName, strings, coords) {
    const [coordOffset, category, lod, nameIdx] = encoded;
    
    const startIdx = coordOffset * 2;
    const lon = coords[startIdx];
    const lat = coords[startIdx + 1];
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        render: {
          layer: layerName,
          category,
          minLOD: lod,
          name: strings[nameIdx] || ''
        }
      }
    };
  }
}

// In MapRenderer constructor:
this.tileDecoder = new CompactTileDecoder();

// In loadTile():
async loadTile(z, x, y) {
  // ... existing cache check ...
  
  const response = await fetch(`tiles/${z}/${x}/${y}.json`);
  const tileData = await response.json();
  
  // Check if compact format
  if (tileData.v === 1) {
    // Decode compact tile
    const features = this.tileDecoder.decode(tileData);
    const featureCollection = {
      type: 'FeatureCollection',
      features
    };
    this.tileCache.set(key, featureCollection);
    return featureCollection;
  } else {
    // Legacy format
    this.tileCache.set(key, tileData);
    return tileData;
  }
}
```

**Test decoder:**
- Load map with compact tiles
- Should render identically to legacy format
- Check DevTools Network tab for tile sizes

---

#### Step 2.4: Benchmark & Migrate (0.5 days)

**Benchmark script:**
```python
import os
import json
from pathlib import Path

# Compare tile sizes
old_tiles = Path("public/tiles-legacy")
new_tiles = Path("public/tiles")

old_total = 0
new_total = 0
tile_count = 0

for new_tile in new_tiles.rglob("*.json"):
    tile_count += 1
    new_size = new_tile.stat().st_size
    new_total += new_size
    
    # Find corresponding old tile
    rel_path = new_tile.relative_to(new_tiles)
    old_tile = old_tiles / rel_path
    if old_tile.exists():
        old_size = old_tile.stat().st_size
        old_total += old_size

print(f"Tiles compared: {tile_count}")
print(f"Old format total: {old_total / 1024 / 1024:.2f} MB")
print(f"New format total: {new_total / 1024 / 1024:.2f} MB")
print(f"Reduction: {(1 - new_total / old_total) * 100:.1f}%")
print(f"Average old tile: {old_total / tile_count:.0f} bytes")
print(f"Average new tile: {new_total / tile_count:.0f} bytes")
```

**Migration:**
1. Backup current tiles: `cp -r public/tiles public/tiles-backup`
2. Regenerate all tiles: `just tiles`
3. Run benchmark
4. Test in browser
5. If successful, remove backup

---

### Testing Checklist
- [ ] Compact tiles decode correctly
- [ ] Map renders identically to legacy format
- [ ] Tile size reduced by 60-80%
- [ ] Total tile directory size reduced significantly
- [ ] Parse time similar or faster (<5ms per tile)
- [ ] All geometry types work (lines, polygons, points)
- [ ] Street names preserved and render correctly

### Deliverables
1. Compact tile format encoder (Python)
2. Compact tile decoder (JavaScript)
3. Hamburg tiles regenerated in compact format
4. Size comparison benchmarks documented
5. Format specification document

---

## Task 3: Complete Zig Streaming JSON Parser (HIGH)
**Duration:** 5-7 days  
**Status:** ⏳ Pending (after Task 2)

### Goal
Complete the Zig tile splitter with streaming JSON parser to handle large files (Germany: 30GB, Europe: 300GB).

### Current State
- Basic Zig implementation exists in `preprocessing/split_tiles.zig`
- Compiles but has issues with large files
- Uses `std.json.parseFromSlice()` which loads entire file to memory

### Target State
- Streaming parser processes one feature at a time
- Memory usage stays constant (~100-500MB regardless of file size)
- 5-10x faster than Python (Germany: 30GB → ~10-20 minutes)

### Implementation Plan

#### Step 3.1: Research Zig Streaming JSON (1 day)

**Goals:**
- Understand Zig 0.15.2 JSON streaming APIs
- Find examples of streaming large files
- Determine best approach

**Key APIs to investigate:**
```zig
// Zig provides Scanner for streaming JSON
const std = @import("std");
const json = std.json;

// Scanner reads tokens incrementally
var scanner = json.Scanner.initStreaming(allocator, reader, .{});

// Can we use this to parse GeoJSON feature-by-feature?
```

**Research tasks:**
- Read Zig std.json.Scanner documentation
- Find GeoJSON streaming examples
- Prototype simple streaming feature parser

---

#### Step 3.2: Implement Streaming Feature Parser (2 days)

**Goal:** Parse GeoJSON one feature at a time without loading entire file.

**Approach:**

```zig
const std = @import("std");
const json = std.json;

const FeatureParser = struct {
    allocator: std.mem.Allocator,
    scanner: *json.Scanner,
    
    pub fn init(allocator: std.mem.Allocator, reader: anytype) !FeatureParser {
        const scanner = try allocator.create(json.Scanner);
        scanner.* = json.Scanner.initStreaming(allocator, reader, .{});
        
        return FeatureParser{
            .allocator = allocator,
            .scanner = scanner,
        };
    }
    
    pub fn deinit(self: *FeatureParser) void {
        self.scanner.deinit();
        self.allocator.destroy(self.scanner);
    }
    
    // Parse GeoJSON header (skip to features array)
    pub fn skipToFeatures(self: *FeatureParser) !void {
        // Expect: { "type": "FeatureCollection", "features": [
        
        // Read opening brace
        var token = try self.scanner.next();
        if (token != .object_begin) return error.InvalidGeoJSON;
        
        // Skip until we find "features" key
        while (true) {
            token = try self.scanner.next();
            
            if (token == .object_end) return error.NoFeatures;
            
            if (token == .string) {
                const key = token.string;
                if (std.mem.eql(u8, key, "features")) {
                    // Next token should be array_begin
                    token = try self.scanner.next();
                    if (token != .array_begin) return error.InvalidFeatures;
                    return; // Now positioned at start of features array
                } else {
                    // Skip this key's value
                    try self.skipValue();
                }
            }
        }
    }
    
    // Parse next feature from stream
    pub fn nextFeature(self: *FeatureParser) !?json.Value {
        const token = try self.scanner.peekNextTokenType();
        
        // Check if array ended
        if (token == .array_end) {
            _ = try self.scanner.next(); // Consume array_end
            return null; // No more features
        }
        
        // Parse feature object
        const feature = try json.innerParse(
            json.Value,
            self.allocator,
            self.scanner,
            .{}
        );
        
        return feature;
    }
    
    fn skipValue(self: *FeatureParser) !void {
        // Skip any JSON value (string, number, object, array, etc.)
        var depth: usize = 0;
        
        while (true) {
            const token = try self.scanner.next();
            
            switch (token) {
                .object_begin, .array_begin => depth += 1,
                .object_end, .array_end => {
                    if (depth == 0) return;
                    depth -= 1;
                },
                .string, .number, .true, .false, .null => {
                    if (depth == 0) return;
                },
                else => {},
            }
        }
    }
};

// Usage in main:
pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // Open file
    const file = try std.fs.cwd().openFile("data/hamburg-region.geojson", .{});
    defer file.close();
    
    // Create buffered reader
    var buffered_reader = std.io.bufferedReader(file.reader());
    const reader = buffered_reader.reader();
    
    // Create parser
    var parser = try FeatureParser.init(allocator, reader);
    defer parser.deinit();
    
    // Skip to features array
    try parser.skipToFeatures();
    
    var feature_count: usize = 0;
    
    // Process features one at a time
    while (try parser.nextFeature()) |feature| {
        defer feature.deinit(allocator); // Free feature after processing
        
        // Classify and assign to tiles
        try processFeature(feature, allocator);
        
        feature_count += 1;
        if (feature_count % 10000 == 0) {
            std.debug.print("Processed {d} features...\n", .{feature_count});
        }
    }
    
    std.debug.print("Total features: {d}\n", .{feature_count});
}
```

**Test:**
```bash
cd /Users/andreas/Source/better-than-dijkstra/osm-renderer
zig build
./zig-out/bin/split-tiles data/hamburg-region.geojson
```

Should output:
```
Processed 10000 features...
Processed 20000 features...
...
Total features: 500000
```

Memory usage should stay constant (~100-500MB).

---

#### Step 3.3: Integrate with Tile Generation (2 days)

**Goal:** Connect streaming parser to existing tile generation logic.

**Current issue:** `preprocessing/split_tiles.zig` has tile logic but loads entire file.

**Solution:** Replace file loading with streaming parser.

```zig
pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // Get input file from args
    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);
    
    if (args.len < 2) {
        std.debug.print("Usage: split-tiles <input.geojson>\n", .{});
        return error.MissingArgument;
    }
    
    const input_path = args[1];
    
    std.debug.print("Hamburg OSM Tile Splitter (Zig)\n", .{});
    std.debug.print("Input: {s}\n", .{input_path});
    
    // Open file
    const file = try std.fs.cwd().openFile(input_path, .{});
    defer file.close();
    
    // Buffered reader
    var buffered_reader = std.io.bufferedReader(file.reader());
    const reader = buffered_reader.reader();
    
    // Create streaming parser
    var parser = try FeatureParser.init(allocator, reader);
    defer parser.deinit();
    
    try parser.skipToFeatures();
    
    // Initialize tile storage
    var tiles = std.AutoHashMap(TileKey, std.ArrayList(json.Value)).init(allocator);
    defer {
        var iter = tiles.iterator();
        while (iter.next()) |entry| {
            entry.value_ptr.deinit(allocator);
        }
        tiles.deinit();
    }
    
    const zoom_levels = [_]u8{ 8, 11, 14 };
    
    var feature_count: usize = 0;
    var classified: usize = 0;
    var skipped: usize = 0;
    
    const start_time = std.time.milliTimestamp();
    
    // Process features one by one
    while (try parser.nextFeature()) |feature_val| {
        // Note: Don't defer deinit here - we're storing features in tiles
        
        feature_count += 1;
        
        // Progress indicator
        if (feature_count % 10000 == 0) {
            std.debug.print("Processed {d} features...\r", .{feature_count});
        }
        
        // Classify feature
        const render_meta = try classifyFeature(allocator, feature_val) orelse {
            skipped += 1;
            feature_val.deinit(allocator);
            continue;
        };
        
        classified += 1;
        
        // Get coordinates for tile assignment
        const geom = feature_val.object.get("geometry") orelse {
            feature_val.deinit(allocator);
            continue;
        };
        
        const coords = geom.object.get("coordinates") orelse {
            feature_val.deinit(allocator);
            continue;
        };
        
        // Extract first coordinate (simplified)
        const lon = coords.array.items[0].array.items[0].float;
        const lat = coords.array.items[0].array.items[1].float;
        
        // Assign to tiles at each zoom level
        for (zoom_levels) |zoom| {
            const tile_x = lon2tile(lon, zoom);
            const tile_y = lat2tile(lat, zoom);
            
            const key = TileKey{ .z = zoom, .x = tile_x, .y = tile_y };
            
            const result = try tiles.getOrPut(key);
            if (!result.found_existing) {
                result.value_ptr.* = .{};
            }
            
            // Clone feature for this tile
            const feature_clone = try cloneJsonValue(allocator, feature_val);
            try result.value_ptr.append(allocator, feature_clone);
        }
        
        // Free original feature
        feature_val.deinit(allocator);
    }
    
    const process_time = std.time.milliTimestamp() - start_time;
    
    std.debug.print("\nProcessed {d} features ({d} classified, {d} skipped) in {d}ms\n", 
        .{ feature_count, classified, skipped, process_time });
    
    // Write tiles (existing logic)...
    try writeTiles(allocator, &tiles);
}

// Helper to clone JSON values (needed for multi-zoom assignment)
fn cloneJsonValue(allocator: std.mem.Allocator, value: json.Value) !json.Value {
    // TODO: Implement deep clone
    // For now, this is a placeholder
    return value;
}
```

**Test:**
- Should process Hamburg (3.3GB) without loading entire file to memory
- Memory usage: constant ~100-500MB
- Speed: Should be 2-3x faster than Python already

---

#### Step 3.4: Optimize & Benchmark (1 day)

**Optimizations:**

1. **Parallel tile writing:**
```zig
// Write tiles in parallel while processing
const writer_thread = try std.Thread.spawn(.{}, tileWriter, .{&tiles});
defer writer_thread.join();
```

2. **Reuse allocations:**
```zig
// Use arena allocator for feature processing
var arena = std.heap.ArenaAllocator.init(allocator);
defer arena.deinit();

while (try parser.nextFeature()) |feature| {
    // Use arena for temporary allocations
    _ = arena.reset(.retain_capacity);
    const temp_allocator = arena.allocator();
    
    // Process with temp_allocator...
}
```

3. **Batch tile writes:**
```zig
// Write tiles in batches of 100
const batch_size = 100;
var tile_batch = std.ArrayList(TileKey).init(allocator);

// Write batch when full
if (tile_batch.items.len >= batch_size) {
    try flushTileBatch(&tile_batch, &tiles);
}
```

**Benchmark:**
```bash
# Time comparison
time python3 preprocessing/split-tiles.py data/hamburg-region.geojson
# Expected: ~5-10 minutes

time ./zig-out/bin/split-tiles data/hamburg-region.geojson  
# Target: <2 minutes (5-10x faster)
```

**Memory profiling:**
```bash
# Use valgrind or similar
/usr/bin/time -v ./zig-out/bin/split-tiles data/hamburg-region.geojson

# Check:
# - Maximum resident set size: <500MB
# - Should be constant regardless of file size
```

---

### Testing Checklist
- [ ] Streaming parser handles 3.3GB Hamburg file
- [ ] Memory usage stays <500MB throughout processing
- [ ] Tile generation completes successfully
- [ ] Output tiles identical to Python version
- [ ] Speed: 5-10x faster than Python
- [ ] Works with partial/corrupted GeoJSON (error handling)
- [ ] Progress indicator updates during processing

### Deliverables
1. Streaming JSON parser implementation
2. Integrated tile generation pipeline
3. Performance benchmarks (vs Python)
4. Memory usage documentation
5. Updated justfile with `just tiles-zig` command

---

## Sprint Success Criteria

✅ **Task 1 Complete:**
- Street names render on roads
- Text follows road curves
- LOD-based filtering works
- Performance <50ms

✅ **Task 2 Complete:**
- Compact tile format implemented
- 60-80% size reduction achieved
- Hamburg tiles migrated
- Rendering identical to legacy

✅ **Task 3 Complete:**
- Streaming parser implemented
- Memory usage <500MB constant
- 5-10x speed improvement
- Germany-ready tile generation

## Estimated Timeline

- **Week 1:** Task 1 (Street Names) - 4 days
- **Week 2:** Task 2 (Tile Format) - 4 days
- **Week 3:** Task 3 (Zig Streaming) - 5 days

**Total: ~13 days (2.5 weeks)**

With buffer: **3 weeks**

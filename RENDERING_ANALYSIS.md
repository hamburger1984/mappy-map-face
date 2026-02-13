# Rendering and Tile System Analysis

## LOD (Level of Detail) System

**View Width → LOD Mapping:**
| View Width | LOD | Description |
|------------|-----|-------------|
| > 20km | 0 | Very zoomed out (major features only) |
| 7.5-20km | 1 | Medium zoom (major + secondary features) |
| 3-7.5km | 2 | Zoomed in (most features) |
| 1-3km | 3 | More zoomed in (buildings, more roads) |
| < 1km | 4 | Very zoomed in (all details including POIs) |

## Tile Zoom Levels

**Current Thresholds (AFTER my latest change):**
| View Width | Tile Zoom | Tile Size | View/Tile Ratio |
|------------|-----------|-----------|-----------------|
| ≥ 500km | Z3 | ~3000km | 17% |
| 100-500km | Z5 | ~750km | 13-67% |
| 15-100km | Z8 | ~95km | 16-100% |
| 2-15km | Z11 | ~12km | 17-125% |
| < 2km | Z14 | ~1.5km | <133% |

**OLD Thresholds (before my change):**
| View Width | Tile Zoom | Tile Size | View/Tile Ratio | Issue |
|------------|-----------|-----------|-----------------|-------|
| ≥ 100km | Z3 | ~3000km | 3-30% | **At 150km: only 5% coverage → 95% waste** |
| 50-100km | Z5 | ~750km | 7-13% | |
| 7-50km | Z8 | ~95km | 7-53% | |
| 1-7km | Z11 | ~12km | 8-58% | |

## Feature Classification and Tile Inclusion

### Complete Feature Type Table

| Feature Type | Layer | minLOD (base) | Size Adjustment | Included in Tiles | Visible at LOD | Simplification |
|--------------|-------|---------------|-----------------|-------------------|----------------|----------------|
| **Forests** | forests | 0 | Yes: <0.01km²→2, <1km²→1 | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | Z3: ε×1.0, Z5: ε×1.0, Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Water bodies** | water_areas | 0 | Yes: <0.01km²→2, <1km²→1 | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | Z3: ε×1.0, Z5: ε×1.0, Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Major rivers** | waterways | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Minor rivers** | waterways | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Coastline** | coastline | 0 | No | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | Z3: ε×0.3, Z5: ε×0.3, Z8: ε×0.3, Z11: ε×0.3, Z14: none |
| **Major highways** (motorway, trunk, primary) | major_roads | 0 | No | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | Z3: ε×0.4, Z5: ε×0.4, Z8: ε×0.4, Z11: ε×0.4, Z14: none |
| **Secondary highways** | major_roads | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×0.4, Z11: ε×0.4, Z14: none |
| **Tertiary/residential** | roads | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×0.4, Z14: none |
| **Small roads/paths** | roads | 3 | No | Z14 | 3,4 | Z14: none |
| **Railways** (major) | railways | 0 | No | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | Z3: ε×1.0, Z5: ε×1.0, Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Railways** (subway/light rail) | railways | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Railways** (tram/minor) | railways | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Parks** | natural_background | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Agriculture** | natural_background | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Residential** | landuse_areas | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Commercial** | landuse_areas | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Industrial** | landuse_areas | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Cemeteries** | landuse_areas | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Military** | landuse_areas | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Railway yards** | landuse_areas | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Allotments** | landuse_areas | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Construction** | landuse_areas | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Education** | landuse_areas | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Religious** | landuse_areas | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Quarries** | landuse_areas | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Buildings** | areas | 2 | No | Z11,Z14 | 2,3,4 | Z11: ε×1.0, Z14: none |
| **Country borders** | boundaries | 0 | No | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | Z3: ε×1.0, Z5: ε×1.0, Z8: ε×1.0, Z11: ε×1.0, Z14: none |
| **Place: City** | place_labels | 0 | No | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | n/a (point) |
| **Place: Large town** (>50k) | place_labels | 0 | No | Z3,Z5,Z8,Z11,Z14 | 0,1,2,3,4 | n/a (point) |
| **Place: Small town** | place_labels | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | n/a (point) |
| **Place: Large village** (>5k) | place_labels | 1 | No | Z8,Z11,Z14 | 1,2,3,4 | n/a (point) |
| **Place: Small village** | place_labels | 2 | No | Z11,Z14 | 2,3,4 | n/a (point) |
| **Place: Suburb** | place_labels | 2 | No | Z11,Z14 | 2,3,4 | n/a (point) |
| **Place: Hamlet** | place_labels | 3 | No | Z14 | 3,4 | n/a (point) |
| **Place: Locality** | place_labels | 4 | No | Z14 | 4 | n/a (point) |
| **POIs** | poi_markers | 4 | No | Z14 | 4 | n/a (point) |

### Simplification Epsilon Values

| Zoom Level | Base Epsilon | Meters | Features Affected |
|------------|--------------|--------|-------------------|
| Z3 | 0.003° | ~300m | All geometry types |
| Z5 | 0.002° | ~200m | All geometry types |
| Z8 | 0.0008° | ~80m | All geometry types |
| Z11 | 0.0002° | ~20m | All geometry types |
| Z14 | 0.00005° | ~5m | **DISABLED for roads/coastlines** |

**Feature-type scaling factors:**
- Roads: ε × 0.4 (preserve curves)
- Coastlines: ε × 0.3 (preserve detail)
- Forests/water: ε × 1.0 (default)
- Railways: ε × 1.0 (default)

## Problem Analysis: 150km View

**Scenario:** User viewing at 150km zoom level

### Current State (after my tile threshold change):
1. **View width:** 150km
2. **LOD level:** 0 (show major features only)
3. **Tile zoom:** Z5 (each tile = ~750km)
4. **View/Tile ratio:** 150/750 = 20% coverage
5. **Expected waste:** ~80% of features outside viewport

### Old State (before my change):
1. **View width:** 150km
2. **LOD level:** 0
3. **Tile zoom:** Z3 (each tile = ~3000km)
4. **View/Tile ratio:** 150/3000 = 5% coverage
5. **Actual waste:** 95% of features outside viewport ✗

### What's in Z3 Tiles (old threshold):
- **Total features:** 1,082,615
- **All with minLOD:** 0
- **Breakdown:**
  - Forests: 525,689 (48.6%)
  - Water areas: 325,180 (30.0%)
  - Major roads: 138,392 (12.8%)
  - Railways: 89,207 (8.2%)
  - Coastline: 3,620 (0.3%)
  - Boundaries: 405 (0.0%)
  - Place labels: 122 (0.0%)

### Size-Based LOD Adjustment (my code change):

**For forests and water bodies:**
```python
if area < 0.0001:  # ~100m × 100m = 0.01km²
    minLOD = 2  # Only in Z11, Z14 (removed from Z3, Z5, Z8)
elif area < 0.01:  # ~1km × 1km = 1km²
    minLOD = 1  # Only in Z8, Z11, Z14 (removed from Z3, Z5)
else:
    minLOD = 0  # Keep in all tiles
```

**Expected impact after tile regeneration:**
- Small forests/ponds (<0.01km²): minLOD → 2 (excluded from Z3/Z5)
- Medium forests/lakes (0.01-1km²): minLOD → 1 (excluded from Z3)
- Large forests/water (>1km²): minLOD stays 0 (included in Z3)

**Estimated reduction:** If 80% of forests/water are <1km², then:
- Old Z3: 850k forests+water features
- New Z3: ~170k forests+water features (80% removed)
- **Total Z3 features: 1.08M → ~400k (63% reduction)**

## Recommendations

### Immediate Actions Required:

1. **Regenerate tiles** to apply size-based LOD filtering
   - Expected: Z3 tiles should drop from 1.08M to ~400k features
   - Should reduce data waste at 150km zoom

2. **Test new tile thresholds** (already applied to map_renderer.js)
   - 150km view should now use Z5 instead of Z3
   - Should further reduce waste from 95% to ~80%

### Future Optimizations:

1. **Add intermediate zoom levels**
   - Z4 (~1500km coverage) for 300-500km views
   - Z6-7 (~375km, ~190km) for 50-200km views
   - Would reduce waste at ultra-wide zoom levels

2. **More aggressive size filtering**
   - Current thresholds may still include too many small features
   - Consider raising to: <0.1km² → LOD 2, <5km² → LOD 1

3. **Pre-merge LOD filtering** (already implemented)
   - Filter features by minLOD during tile merge phase
   - Only process features that will actually be rendered
   - Should save classification time

4. **Consider separate tile sets per LOD**
   - Z3-LOD0, Z3-LOD1, etc.
   - Load only tiles with features for current LOD
   - More storage but better runtime performance

## Status of My Changes

### ✅ Completed:
1. Early LOD filtering in tile merge (map_renderer.js:1408)
2. Adjusted tile zoom thresholds (map_renderer.js:1157)
3. Size-based minLOD adjustment (step_3_generate_tiles.py:1334)

### ⏳ Pending:
1. Tile regeneration with size-based filtering
2. Performance testing at 150km zoom with new thresholds

### Expected Results After Both Changes:
- **150km zoom:**
  - Uses Z5 tiles (~750km) instead of Z3 (~3000km)
  - Z5 tiles contain fewer small features due to size filtering
  - Viewport culling waste: 95% → ~60-70%
  - Classification time: ~160ms → ~40-60ms (estimated)
  - Total render time: ~800ms → ~200-300ms (estimated)

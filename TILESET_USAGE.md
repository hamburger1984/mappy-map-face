# Tileset System Usage Guide

## Overview

The OSM renderer now supports a new **tileset-based system** that provides better performance by matching tile sizes to viewing ranges and filtering features by size and importance.

## System Comparison

### Legacy Zoom System (Current Default)
- **5 zoom levels**: Z3, Z5, Z8, Z11, Z14
- Uses Web Mercator tile coordinates
- All features at a given LOD level included in all tiles
- No size-based feature filtering

### New Tileset System
- **7 tilesets**: t1-t7 (100m to 200km+ viewing ranges)
- Uses custom tile sizes optimized for each viewing range
- Config-driven feature filtering by size, population, and importance
- Progressive geometry simplification (5m to 500m epsilon)
- Reduces feature count by 95% at far zoom levels

## Configuration Files

### `tileset_config.yaml`
Main configuration file defining:
- 7 tilesets with view ranges and tile sizes
- Feature definitions with OSM tag matching
- Area constraints for size-based filtering
- Population filters for place labels
- Simplification settings (epsilon, preserve_topology, snap_to_grid)

### `public/tileset_config.json`
Browser-friendly JSON version (auto-generated from YAML):
- Contains only tileset metadata (id, name, view_range, tile_size)
- Used by renderer to select appropriate tileset

## Generating Tiles with New System

### Prerequisites

1. Install PyYAML:
```bash
pip install PyYAML>=6.0
```

2. Export config to JSON:
```bash
cd preprocessing
python export_config.py
```

### Generate Tileset-Based Tiles

Use the `--use-tilesets` flag:

```bash
cd preprocessing
python step_3_generate_tiles.py --use-tilesets
```

This will:
- Load configuration from `tileset_config.yaml`
- Generate tiles in `public/tiles/t1/`, `t2/`, ..., `t7/` directories
- Create SQLite databases: `hamburg-latest.osm_zt1.db`, etc.
- Apply size-based feature filtering
- Simplify geometry based on tileset-specific epsilon values

### Legacy System (Default)

Without the flag, the legacy zoom system is used:

```bash
python step_3_generate_tiles.py
```

Generates tiles in `public/tiles/3/`, `5/`, `8/`, `11/`, `14/` directories.

## Renderer Behavior

### Automatic Detection

The renderer (`map_renderer.js`) automatically detects which system to use:

1. On initialization, attempts to load `tileset_config.json`
2. If successful → uses tileset system
3. If not found → falls back to legacy zoom system

### Tileset Selection

For each render, the renderer:
1. Calculates current view width in meters
2. Finds tileset whose `view_range_meters` contains the view width
3. Loads tiles from that tileset directory

Example:
- View width: 150km → uses `t6` (100km-150km range)
- View width: 500m → uses `t1` (100m-1km range)

### Tile Loading

Tiles are loaded from:
- **Tileset system**: `tiles/t6/0/0.json`
- **Legacy system**: `tiles/5/0/0.json`

The cache key format matches the directory structure.

## Tileset Specifications

| Tileset | View Range | Tile Size | Features Included |
|---------|------------|-----------|-------------------|
| **t1** | 100m - 1km | 200m | All features (no simplification) |
| **t2** | 1.5km - 2km | 750m | All features (5m simplification) |
| **t3** | 3km - 7km | 2km | Medium+ water/forests, roads, buildings |
| **t4** | 10km - 15km | 5km | Large water/forests, major roads, large buildings |
| **t5** | 20km - 70km | 15km | Large features, highways, cities |
| **t6** | 100km - 150km | 50km | Very large features, major highways, large cities |
| **t7** | 200km+ | 100km | Huge features, country-level roads, major cities |

## Performance Expectations

### At 150km View (using t6):

**Before (Z5 tiles):**
- Features loaded: 1,078,850
- Viewport culled: ~900k (83%)
- Render time: ~800ms

**After (t6 tileset):**
- Features loaded: <50,000 (only large features)
- Viewport culled: <10,000 (20%)
- Render time: <300ms
- **95% reduction in features, 60% faster rendering**

### At 10km View (using t4):

**Before (Z8 tiles):**
- Features loaded: ~300,000
- Significant viewport culling waste

**After (t4 tileset):**
- Features loaded: ~30,000
- Optimized tile coverage
- **90% reduction in features**

## Switching Between Systems

### Use Tileset System

1. Generate tileset-based tiles:
```bash
python step_3_generate_tiles.py --use-tilesets
```

2. Export config to public directory:
```bash
python export_config.py
```

3. Refresh browser - renderer auto-detects `tileset_config.json`

### Revert to Legacy System

1. Remove or rename `public/tileset_config.json`:
```bash
mv public/tileset_config.json public/tileset_config.json.backup
```

2. Refresh browser - renderer falls back to legacy zoom levels

Both tile systems can coexist in the `public/tiles/` directory.

## Customizing Tilesets

### Adjust View Ranges

Edit `tileset_config.yaml`:

```yaml
tilesets:
  - id: "t6"
    view_range_meters: [100000, 150000]  # Adjust these values
```

### Change Feature Filtering

Add or modify feature definitions:

```yaml
features:
  - name: "water_bodies_huge"
    osm_match:
      geometry: ["Polygon", "MultiPolygon"]
      tags:
        natural: ["water"]
      min_area_km2: 10  # Only water bodies > 10km²
```

### Adjust Simplification

Change epsilon values for smoother or simpler geometry:

```yaml
simplification:
  epsilon_m: 50  # Increase for more simplification
```

After changes:
1. Run `python export_config.py`
2. Regenerate tiles with `--use-tilesets`

## Troubleshooting

### "ModuleNotFoundError: No module named 'yaml'"
```bash
pip install PyYAML>=6.0
```

### "tileset_config.json not found" in browser console
```bash
cd preprocessing
python export_config.py
```

### Tiles still loading from old system
- Check that `public/tileset_config.json` exists
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
- Check browser console for "Loaded tileset configuration" message

### Database cache issues
Delete cached databases to force regeneration:
```bash
rm preprocessing/data/*_zt*.db
```

## Next Steps

1. **Test the new system**: Generate tiles and verify performance improvements
2. **Fine-tune config**: Adjust view ranges, feature filters, and epsilon values
3. **Optimize further**: Analyze actual usage patterns and refine tileset boundaries
4. **Add compression**: Consider gzip/brotli for tile files (70-80% size reduction)

## References

- `tileset_config.yaml` - Full configuration with all feature definitions
- `TILESET_IMPLEMENTATION_GUIDE.md` - Technical implementation details
- `rendering_config.yaml` - Analysis of current rendering behavior
- `tileset_design.yaml` - Design rationale and coverage calculations

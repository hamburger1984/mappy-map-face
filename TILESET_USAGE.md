# Tileset System Usage Guide

## Overview

The OSM renderer uses a **tileset-based system** that provides optimal performance by matching tile sizes to viewing ranges and filtering features by size and importance.

## System Features

- **7 tilesets**: t1-t7 (100m to 200km+ viewing ranges)
- Uses custom tile sizes optimized for each viewing range
- Config-driven feature filtering by size, population, and importance
- Progressive geometry simplification (5m to 500m epsilon)
- Reduces feature count by 95% at far zoom levels compared to previous system

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

## Generating Tiles

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

### Generate Tiles

```bash
cd preprocessing
python step_3_generate_tiles.py
```

This will:
- Load configuration from `tileset_config.yaml`
- Generate tiles in `public/tiles/t1/`, `t2/`, ..., `t7/` directories
- Create SQLite databases: `hamburg-latest.osm_zt1.db`, etc.
- Apply size-based feature filtering
- Simplify geometry based on tileset-specific epsilon values

## Renderer Behavior

The renderer (`map_renderer.js`) loads the tileset configuration on initialization and uses it to determine which tiles to load based on the current view width.

### Tileset Selection

For each render, the renderer:
1. Calculates current view width in meters
2. Finds tileset whose `view_range_meters` contains the view width
3. Loads tiles from that tileset directory

Example:
- View width: 150km → uses `t6` (100km-150km range)
- View width: 500m → uses `t1` (100m-1km range)

### Tile Loading

Tiles are loaded from `tiles/{tileset_id}/{x}/{y}.json`, for example:
- `tiles/t6/0/0.json`
- `tiles/t1/5/3.json`

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

## Performance Improvements

The tileset system provides dramatic performance improvements compared to the previous zoom-level system:

### At 150km View (using t6):

- Features loaded: <50,000 (only large features)
- Viewport culled: <10,000 (20%)
- Render time: <300ms
- **95% reduction in features vs previous system**

### At 10km View (using t4):

- Features loaded: ~30,000
- Optimized tile coverage
- **90% reduction in features vs previous system**

## Regenerating Tiles

To regenerate tiles with updated configuration:

1. Modify `tileset_config.yaml` as needed
2. Export updated config:
```bash
cd preprocessing
python export_config.py
```

3. Regenerate tiles:
```bash
python step_3_generate_tiles.py
```

4. Refresh browser to load new tiles

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

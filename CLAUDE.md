# Claude Instructions for OSM Renderer Project

## Critical Rules

### Long-Running Tasks
**NEVER start long-running tasks without asking the user first.**

Instead:
1. Tell the user what command to run
2. Ask them to run it and report the results back
3. Wait for their confirmation before proceeding

Examples of long-running tasks that require user approval:
- `python step_1_download.py` - Downloads OSM data
- `python step_2_convert.py` - Converts OSM data to GeoJSON
- `python step_3_generate_tiles.py` - Generates map tiles
- `python build_all.py` - Runs the full build pipeline
- Any preprocessing steps that process large datasets

### Example Interaction
❌ **Wrong**: Starting the task automatically
```
I'll regenerate the tiles now.
[Runs step_3_generate_tiles.py in background]
```

✅ **Correct**: Asking the user to run it
```
To see the coastline visualization, please run:

cd preprocessing
python step_3_generate_tiles.py

Let me know when it completes and I can help analyze the results.
```

## Project Structure

### Preprocessing Pipeline
1. `step_1_download.py` - Downloads OSM data for regions
2. `step_2_convert.py` - Converts to GeoJSON with feature classification
3. `step_3_generate_tiles.py` - Generates map tiles at zoom levels 8, 11, 14

### Key Files
- `preprocessing/step_3_generate_tiles.py` - Feature classification and tile generation
- `public/map_renderer.js` - Canvas-based map rendering
- `public/index.html` - Map viewer interface

## Technical Context

### Map System
- Tile-based rendering with zoom levels 8, 11, 14
- Web Mercator projection
- LOD (Level of Detail) system: 0 (always visible) through 4 (very zoomed in)
- SQLite database caching for tiles

### Feature Classification
Features are classified in `step_3_generate_tiles.py` with metadata:
- `layer` - Rendering layer (buildings, roads, water, landuse, etc.)
- `minLOD` - Minimum zoom level for visibility
- `color` - RGBA color
- `fill` - Whether to fill polygons
- `width` - Line width for ways

### Current Work
- Place name rendering with density control
- Coastline visualization with magenta lines and direction arrows
- Extended landuse type rendering (12 new types)
- Smart tile backgrounds (land/ocean/coastline specific colors)

## Workflow Preferences

1. Always ask before running preprocessing steps
2. Use git commits frequently for completed features
3. Test changes in the browser before committing
4. Keep solutions focused and avoid over-engineering

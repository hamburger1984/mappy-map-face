# Agent Instructions

## Critical Rules

### Long-Running Tasks
**NEVER start long-running tasks without asking the user first.**

Instead:
1. Tell the user what command to run
2. Ask them to run it and report the results back
3. Wait for their confirmation before proceeding

Examples of long-running tasks that require user approval:
- `just build` -- Downloads, converts, and tiles all regions
- `just download` -- Downloads OSM data
- `just convert` -- Converts PBF to GeoJSON
- `just tiles` -- Generates map tiles
- Any preprocessing step that processes large datasets

### Example Interaction
**Wrong**: Starting the task automatically
```
I'll regenerate the tiles now.
[Runs step_3_generate_tiles.py in background]
```

**Correct**: Asking the user to run it
```
To see the coastline visualization, please run:

just tiles

Let me know when it completes and I can help analyze the results.
```

## Project Structure

### Preprocessing Pipeline
1. `step_1_download.py` -- Downloads OSM data for regions
2. `step_2_convert_to_geojson.py` -- Converts to GeoJSON with feature classification
3. `step_3_generate_tiles.py` -- Generates map tiles at zoom levels (t1-t6)

### Key Files
- `preprocessing/step_3_generate_tiles.py` -- Feature classification and tile generation
- `public/map_renderer.js` -- Canvas-based map rendering
- `public/index.html` -- Map viewer interface
- `tileset_config.yaml` -- Tileset feature definitions (source of truth)

### Tile Storage
Tiles are gzipped JSON files at `public/tiles/t{1,2,3,4,5,6}/{x}/{y}.json.gz`.

## Technical Context

### Map System
- Tile-based rendering with zoom levels t1 through t6
- Web Mercator projection
- LOD (Level of Detail) system: 0 (always visible) through 4 (very zoomed in)

### Feature Classification
Features are classified in `step_3_generate_tiles.py` with metadata:
- `layer` -- Rendering layer (buildings, roads, water, landuse, etc.)
- `minLOD` -- Minimum zoom level for visibility
- `color` -- RGBA color
- `fill` -- Whether to fill polygons
- `width` -- Line width for ways

## Workflow Preferences

1. Always ask before running preprocessing steps
2. Use git commits frequently for completed features
3. Test changes in the browser before committing
4. Keep solutions focused and avoid over-engineering
5. Do NOT add "Co-Authored-By" lines to commit messages
6. After any renderer performance work, ask the user to run `npm run benchmark` and check for regressions vs baseline

## Communication Style

**Keep responses SHORT and concise:**
- Confirm completion in 1-2 sentences
- For significant changes, ask user to update documentation instead of explaining everything
- Avoid verbose summaries, bullet lists, or extensive code explanations
- Only provide details when explicitly asked

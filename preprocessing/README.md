# OSM Map Renderer - Preprocessing Scripts

This directory contains modular Python scripts for downloading OSM data and generating map tiles.

## Architecture Overview

The preprocessing pipeline is split into three independent steps:

```
Step 1: Download      Step 2: Convert       Step 3: Generate Tiles
┌─────────────┐      ┌──────────────┐      ┌────────────────────┐
│ OSM PBF     │──┐   │ PBF → GeoJSON│──┐   │ GeoJSON → Tiles    │
│ Land shapes │  │   │ (osmium)     │  │   │ (split-tiles.py)   │
│ Water shapes│  │   │              │  │   │                    │
└─────────────┘  │   └──────────────┘  │   │ • Classify features│
                 │                     │   │ • Generate tiles   │
                 └─────────────────────┘   │ • LOD system       │
                                           │ • SQLite caching   │
                                           └────────────────────┘
```

Each step can be run independently or all together using `build_all.py`.

## Scripts

### `build_all.py` - Main Entry Point
Orchestrates all three steps in sequence.

**Usage:**
```bash
# Run all steps
./build_all.py

# Run specific step only
./build_all.py --step 1  # Download only
./build_all.py --step 2  # Convert only
./build_all.py --step 3  # Generate tiles only

# Control parallelism
./build_all.py -j 4  # Use 4 parallel workers

# Skip land polygons (for testing)
./build_all.py --skip-land-polygons
```

### `step_1_download.py` - Download Data
Downloads OSM PBF files and land polygon shapefiles.

**Features:**
- Parallel downloads with progress bars (via `tqdm`)
- Age checking (re-downloads if >30 days old)
- Automatic shapefile to GeoJSON conversion (requires `ogr2ogr`)
- Partial download cleanup

**Data Sources:**
- OSM PBF: Geofabrik (Hamburg, Schleswig-Holstein, Denmark, etc.)
- Land polygons: OSM Data server (simplified and detailed)

**Usage:**
```bash
./step_1_download.py                    # Download all sources
./step_1_download.py -j 4               # Use 4 parallel downloads
./step_1_download.py --skip-land-polygons  # Skip land polygon download
```

**Requirements:**
- `curl` or Python's `urllib` (built-in)
- `ogr2ogr` (from GDAL) for shapefile conversion
  - macOS: `brew install gdal`
  - Linux: `apt-get install gdal-bin`
  - Windows: `conda install -c conda-forge gdal`

### `step_2_convert_to_geojson.py` - Convert PBF to GeoJSON
Converts downloaded OSM PBF files to GeoJSON format using `osmium`.

**Features:**
- Parallel conversion with progress bars
- Automatic config file detection (`osmium-export-config.json`)
- Error handling and reporting

**Usage:**
```bash
./step_2_convert_to_geojson.py          # Convert all PBF files in data/
./step_2_convert_to_geojson.py file.pbf # Convert specific file
./step_2_convert_to_geojson.py -j 4     # Use 4 parallel processes
```

**Requirements:**
- `osmium-tool` (https://osmcode.org/osmium-tool/)
  - macOS: `brew install osmium-tool`
  - Linux: `apt-get install osmium-tool`
  - Windows: Download from releases

### `step_3_generate_tiles.py` - Generate Map Tiles
Processes GeoJSON files into tile format with LOD system.

**Features:**
- Parallel tile generation with progress bars
- SQLite-based caching (avoids reprocessing unchanged files)
- Feature classification and rendering metadata
- Land polygon integration with layer tagging
- Automatic bounds calculation

**Usage:**
```bash
./step_3_generate_tiles.py              # Process all GeoJSON files
./step_3_generate_tiles.py file.geojson # Process specific file
./step_3_generate_tiles.py -j 4         # Use 4 parallel workers
./step_3_generate_tiles.py --zoom-levels 8 11 14  # Custom zoom levels
./step_3_generate_tiles.py --skip-land-polygons   # Skip land polygons
```

**Output:**
- Tiles: `public/tiles/{zoom}/{x}/{y}.json`
- Index: `public/tiles/index.json`

### Supporting Modules

**`split-tiles.py`** - Core tile generation logic
- Feature classification (`get_render_metadata`)
- Tile coordinate calculation
- SQLite database management
- Progress reporting for feature processing

**`tiles-from-osm.py`** - Legacy script (kept for compatibility)
- Direct PBF → Tiles conversion
- Use `build_all.py` instead for new workflows

## Progress Reporting

All scripts use **tqdm** for clean, informative progress bars:

```
OSM files: 100%|████████████████| 5/5 [02:15<00:00, 27.2s/file]
Land polygons: 100%|████████████| 2/2 [01:30<00:00, 45.1s/file]
Converting: 100%|█████████████| 5/5 [08:42<00:00, 104s/file]
Generating tiles: 100%|████████| 7/7 [15:23<00:00, 132s/file]
```

Progress bars show:
- Completion percentage
- Visual progress bar
- Item counts (current/total)
- Time elapsed and estimated time remaining
- Processing rate (items/second)

## Parallel Processing

Each step supports parallel processing via the `-j/--jobs` flag:

```bash
# Download 4 files simultaneously
./step_1_download.py -j 4

# Convert 3 files in parallel
./step_2_convert_to_geojson.py -j 3

# Generate tiles from 2 sources at once
./step_3_generate_tiles.py -j 2
```

**Recommendations:**
- **Downloads**: Limited by network bandwidth (3-4 workers typical)
- **Conversion**: CPU-bound (use number of CPU cores)
- **Tile generation**: Memory-intensive (limit to 2-3 workers for large datasets)

## Using the Justfile

The `justfile` provides convenient shortcuts:

```bash
# Run all steps
just build

# Individual steps
just download   # Step 1 only
just convert    # Step 2 only
just tiles      # Step 3 only

# Clean up
just clean          # Remove generated tiles
just clean-data     # Remove tiles + GeoJSON
just clean-all      # Remove everything including venv
```

## Data Directory Structure

```
preprocessing/data/
├── *.osm.pbf                           # OSM PBF files (downloaded)
├── *.geojson                           # Converted GeoJSON (temporary)
├── simplified-land-polygons.geojson    # Simplified land shapes
├── detailed-land-polygons.geojson      # Detailed land shapes
└── *_z*.db                             # SQLite tile cache databases
```

**Note:** GeoJSON files are temporary and can be deleted after tile generation. PBF files are kept for re-processing.

## Caching and Fingerprinting

The pipeline uses multiple levels of caching:

1. **Download cache**: Files are only re-downloaded if >30 days old
2. **SQLite database cache**: Per-zoom-level databases cache feature distribution
3. **File fingerprinting**: Changes detected via size + mtime (no expensive hashing)

This makes incremental builds very fast when only one region's data changes.

## Error Handling

Each script provides detailed error reporting:

```
✓ hamburg: 45.2 MB (newly downloaded)
✓ schleswig-holstein: 123.4 MB (5 days old)
✗ denmark: Download failed: Connection timeout
```

Failed downloads/conversions are reported but don't stop the entire pipeline.

## Dependencies

**Python packages** (install via `pip install -r requirements.txt`):
- `ijson>=3.2.0` - Streaming JSON parser
- `tqdm>=4.66.0` - Progress bars

**External tools**:
- `osmium-tool` - PBF to GeoJSON conversion
- `ogr2ogr` (GDAL) - Shapefile to GeoJSON conversion (optional, for land polygons)

## Troubleshooting

**"ogr2ogr not found"**
- Land polygon processing will be skipped
- Install GDAL to enable: `brew install gdal` (macOS)

**"osmium not found"**
- Step 2 will fail
- Install osmium-tool: `brew install osmium-tool` (macOS)

**"No module named 'tqdm'"**
- Run: `pip install -r requirements.txt`
- Or: `just setup`

**Slow tile generation**
- Reduce parallel workers: `-j 2` instead of `-j 4`
- Large OSM files (>500MB) require significant RAM per worker

**Partial downloads after interruption**
- Partial files (*.partial) are automatically cleaned up on next run
- Safe to interrupt and restart

## Development

**Adding a new data source:**
1. Add to `OSM_SOURCES` in `step_1_download.py`
2. Re-run `just download` or `just build`

**Modifying feature classification:**
1. Edit `get_render_metadata()` in `split-tiles.py`
2. Re-run `just tiles` to regenerate

**Changing zoom levels:**
```bash
./step_3_generate_tiles.py --zoom-levels 8 10 12 14
```

## References

- **Progress bar techniques**: https://bernsteinbear.com/blog/python-parallel-output/
- **tqdm documentation**: https://github.com/tqdm/tqdm
- **Parallel processing with tqdm**: https://leimao.github.io/blog/Python-tqdm-Multiprocessing/
- **p_tqdm wrapper**: https://github.com/swansonk14/p_tqdm

---

**Last updated**: 2026-02-11

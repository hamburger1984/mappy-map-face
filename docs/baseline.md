# Tile Statistics Baseline

Historical datapoints tracking tile count, disk size, and feature data size across tileset generations.

**Data:** `baseline.csv` — one row per (datapoint, tileset) with summary stats.

## Methodology

1. Run `just build` (or `just tiles`) to generate tiles
2. For each tileset (T1-T4), sample up to 1000 random tiles (or all if fewer)
3. For each sampled tile, parse JSON and measure per-feature JSON size
4. Categorize features by primary OSM tag (building, highway:residential, natural:water, etc.)
5. Extrapolate to full tileset using sample ratio
6. Record tile count, actual disk size, and estimated total feature data

Coordinate counts reflect total vertices across all geometry rings/lines.

## Generating a New Baseline

1. Build tiles for the regions you want to measure:
   ```bash
   just build
   ```
2. Run the tile statistics script:
   ```bash
   venv/bin/python scripts/tile_stats.py public/tiles/
   ```
   Options:
   - `--csv` — append summary to `docs/baseline.csv`
   - `--csv-only` — print CSV rows to stdout only
   - `--tilesets t2 t3` — only scan specific tilesets
   - `--regions "Hamburg, SH"` — region description for CSV
   - `--dp N` — datapoint number (auto-detected from existing CSV)
3. Add a note in the Changes section below about what changed since the last datapoint

## Datapoint Summary

| DP | Date | Regions | T1 Tiles | T1 Size | T2 Tiles | T2 Size | Notes |
|----|------|---------|----------|---------|----------|---------|-------|
| 1 | 2026-02-22 14:12 | Hamburg, SH | 308K | 2.7 GB | 9.2K | 1.6 GB | Initial baseline |
| 2 | 2026-03-03 04:42 | All (Europe+) | 1.7M | 27.4 GB | 49K | 17.9 GB | Full Europe regen |
| 3 | 2026-02-22 15:10 | Hamburg, SH, MV | 469K | 4.7 GB | 12.7K | 1.5 GB | Added MV region |
| 4 | 2026-02-22 19:40 | Hamburg, SH, MV | 469K | 4.7 GB | 12.7K | 1.5 GB | Reproducibility check |
| 5 | 2026-02-23 05:43 | Hamburg, SH, MV, NI, DK | 1.0M | 14.9 GB | 50K | 5.7 GB | Added NI + Denmark |
| 6 | 2026-03-01 09:19 | Hamburg, SH | 146K | 2.3 GB | 11.0K | 978 MB | base_land layer, sports, track in T2 |
| 7 | 2026-03-01 13:43 | Hamburg, SH, MV, NI | 648K | 9.3 GB | 33K | 4.2 GB | 4-region build |
| 8 | 2026-03-02 11:47 | Hamburg, SH | 141K | 2.4 GB | 10.9K | 1.2 GB | Theme key refactoring |

**Note:** Datapoints are not in chronological order — DP2 (full Europe) was recorded later but appears earlier in the original data. The CSV uses sequential DP numbers as assigned in the source file.

## Changes Between Datapoints

### DP1 → DP3 (2026-02-22): Added Mecklenburg-Vorpommern
- T1 tiles: 308K → 469K (+52%), T1 size: 2.7 → 4.7 GB
- Added construction/planned/proposed railways, code cleanup

### DP3 → DP4 (2026-02-22): Reproducibility check
- Same regions and code, regenerated to verify reproducibility
- Identical tile counts, minor size variance (expected from sampling)

### DP4 → DP5 (2026-02-23): Added Niedersachsen + Denmark
- T1 tiles: 469K → 1.0M, T1 size: 4.7 → 14.9 GB
- Fixed tag matching (match_all for boundaries), added state/district/maritime boundary types
- Excluded buildings/platforms from polygon clipping

### DP5 → DP6 (2026-03-01): base_land layer, sports, track in T2
- T1 tiles: 1.0M → 146K (5 regions → 2 regions, not directly comparable)
- Added authoritative land polygon backgrounds (base_land synthetic features)
- Added sports facilities (sports_pitch, sports_facility, miniature_golf) to T1/T2
- Added highway:track to T2 as dashed lines
- Added natural=sand, military crosshatch rendering

### DP6 → DP7 (2026-03-01): 4-region build
- T1 tiles: 146K → 648K (2 regions → 4 regions)
- Added Mecklenburg-Vorpommern and Niedersachsen

### DP7 → DP8 (2026-03-02): Theme key refactoring
- T1 tiles: 648K → 141K (4 regions → 2 regions)
- Replaced per-feature RGBA color arrays with theme key strings
- All dynamic render attributes now computed in Python via `augment_render_from_props()`
- Complete rewrite of `tileset_config.yaml`
- Compared to DP1 (same 2 regions): T1 tiles down 54%, building count halved, overall sizes down

## Tile Size Improvement Tracking

Compare T1 tile sizes across datapoints for the same region set:

**2-region (Hamburg + SH):**

| DP | T1 Tiles | T1 Size | T2 Size | Notes |
|----|----------|---------|---------|-------|
| 1 | 308,184 | 2.73 GB | 1.57 GB | Initial |
| 6 | 146,302 | 2.29 GB | 978 MB | base_land, sports |
| 8 | 141,397 | 2.35 GB | 1.19 GB | Theme key refactoring |

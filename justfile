# OSM Map Renderer - justfile
#
# Cross-platform build automation using Just (https://just.systems)
# Supports: Windows (PowerShell), Linux (bash), macOS (bash)
#
# Common commands:
#   just          - Show all available commands
#   just setup    - Initialize Python virtual environment and install dependencies
#   just all      - Download data and generate tiles
#   just build    - Download OSM data and generate tiles
#   just tiles    - Generate map tiles (Python)
#   just serve    - Start development web server
#   just info     - Show system and project information

# Show all available commands with descriptions
default:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" +
    "Write-Host 'OSM Map Renderer - Available Commands'; " +
    "Write-Host ''; " +
    "Write-Host 'SETUP & BUILD'; " +
    "Write-Host '  just setup                           Initialize Python venv and install dependencies'; " +
    "Write-Host '  just all                             Setup then download and tile all regions'; " +
    "Write-Host '  just build [gap=0] [max_tile_age=14]  Download, convert, tile all regions in regions.json'; " +
    "Write-Host '                                       Skips regions whose tiles are newer than PBF and < max_tile_age days'; " +
    "Write-Host '                                       Optional gap (seconds) between regions to reduce server load'; " +
    "Write-Host '  just download                        Step 1: Download OSM data for all regions in regions.json'; " +
    "Write-Host '  just convert                         Step 2: Convert downloaded PBF files to GeoJSON'; " +
    "Write-Host '  just tiles                           Step 3: Generate map tiles from GeoJSON'; " +
    "Write-Host ''; " +
    "Write-Host 'REGION MANAGEMENT'; " +
    "Write-Host '  just add-region <name> [url]         Download, convert and tile a new region'; " +
    "Write-Host '                                       Geofabrik URL is looked up automatically when omitted'; " +
    "Write-Host '                                       Example: just add-region hamburg'; " +
    "Write-Host '  just build-regions <region...>       Build specific regions only (subset of regions.json)'; " +
    "Write-Host '                                       Example: just build-regions hamburg berlin'; " +
    "Write-Host '  just list-regions                    List local regions from regions.json with build status'; " +
    "Write-Host '  just list-regions-remote [query]     Browse regions available on Geofabrik'; " +
    "Write-Host '                                       Example: just list-regions-remote germany'; " +
    "Write-Host ''; " +
    "Write-Host 'UPDATES (no re-download)'; " +
    "Write-Host '  just update-region <region...>       Re-tile region(s) from cached GeoJSON'; " +
    "Write-Host '                                       Use after tile config changes. Example: just update-region hamburg'; " +
    "Write-Host '  just update-region-tileset <r> <t>   Re-tile specific tileset(s) for specific region(s)'; " +
    "Write-Host '                                       Example: just update-region-tileset hamburg-latest t2b'; " +
    "Write-Host '  just regen-tileset <tileset...>      Regenerate tileset(s) for ALL regions (clears stale tiles)'; " +
    "Write-Host '                                       Example: just regen-tileset t2b t3'; " +
    "Write-Host ''; " +
    "Write-Host 'DEVELOPMENT'; " +
    "Write-Host '  just serve                           Start local web server at http://localhost:8888'; " +
    "Write-Host '  just info                            Show system info and project status'; " +
    "Write-Host ''; " +
    "Write-Host 'CLEANUP'; " +
    "Write-Host '  just clean                           Remove generated tiles'; " +
    "Write-Host '  just clean-data                      Remove tiles and downloaded data'; " +
    "Write-Host '  just clean-all                       Remove everything (tiles, data, venv)'\"" }
    else {
    "echo 'OSM Map Renderer - Available Commands' && " +
    "echo '' && " +
    "echo 'SETUP & BUILD' && " +
    "echo '  just setup                           Initialize Python venv and install dependencies' && " +
    "echo '  just all                             Setup then download and tile all regions' && " +
    "echo '  just build [gap=0] [max_tile_age=14]  Download, convert, tile all regions in regions.json' && " +
    "echo '                                       Skips regions whose tiles are newer than PBF and < max_tile_age days' && " +
    "echo '                                       Optional gap (seconds) between regions to reduce server load' && " +
    "echo '  just download                        Step 1: Download OSM data for all regions in regions.json' && " +
    "echo '  just convert                         Step 2: Convert downloaded PBF files to GeoJSON' && " +
    "echo '  just tiles                           Step 3: Generate map tiles from GeoJSON' && " +
    "echo '' && " +
    "echo 'REGION MANAGEMENT' && " +
    "echo '  just add-region <name> [url]         Download, convert and tile a new region' && " +
    "echo '                                       Geofabrik URL is looked up automatically when omitted' && " +
    "echo '                                       Example: just add-region hamburg' && " +
    "echo '  just build-regions <region...>       Build specific regions only (subset of regions.json)' && " +
    "echo '                                       Example: just build-regions hamburg berlin' && " +
    "echo '  just list-regions                    List local regions from regions.json with build status' && " +
    "echo '  just list-regions-remote [query]     Browse regions available on Geofabrik' && " +
    "echo '                                       Example: just list-regions-remote germany' && " +
    "echo '' && " +
    "echo 'UPDATES (no re-download)' && " +
    "echo '  just update-region <region...>       Re-tile region(s) from cached GeoJSON' && " +
    "echo '                                       Use after tile config changes. Example: just update-region hamburg' && " +
    "echo '  just update-region-tileset <r> <t>   Re-tile specific tileset(s) for specific region(s)' && " +
    "echo '                                       Example: just update-region-tileset hamburg-latest t2b' && " +
    "echo '  just regen-tileset <tileset...>      Regenerate tileset(s) for ALL regions (clears stale tiles)' && " +
    "echo '                                       Example: just regen-tileset t2b t3' && " +
    "echo '' && " +
    "echo 'DEVELOPMENT' && " +
    "echo '  just serve                           Start local web server at http://localhost:8888' && " +
    "echo '  just info                            Show system info and project status' && " +
    "echo '' && " +
    "echo 'CLEANUP' && " +
    "echo '  just clean                           Remove generated tiles' && " +
    "echo '  just clean-data                      Remove tiles and downloaded data' && " +
    "echo '  just clean-all                       Remove everything (tiles, data, venv)'"
    } }}

# Build everything (setup and build tiles with auto-download)
all: setup build

# Setup Python virtual environment and install dependencies
setup:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Setting up Python virtual environment...'; " + "if (-not (Test-Path venv)) { python -m venv venv }; " + "Write-Host 'Installing dependencies...'; " + "& venv/Scripts/pip install -q -r requirements.txt; " + "Write-Host 'Setup complete!'\"" } else { "echo 'Setting up Python virtual environment...' && " + "if [ ! -d venv ]; then python -m venv venv; fi && " + "echo 'Installing dependencies...' && " + "venv/bin/pip install -q -r requirements.txt && " + "echo 'Setup complete!'" } }}

# Build tiles using staggered per-region processing (downloads, converts, tiles one region at a time)
# Skips regions whose tiles are newer than the PBF file and younger than max_tile_age days (default: 14).
# Usage: just build
# Usage: just build 60        (wait 60s between regions)
# Usage: just build 0 7       (rebuild if tiles older than 7 days)
# Usage: just build 0 0       (always rebuild all regions)
build gap="0" max_tile_age="14": setup config-export
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/run_staggered.py' --tiles-dir '" + justfile_directory() + "/public/tiles' --gap-seconds " + gap + " --max-tile-age " + max_tile_age + "\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/run_staggered.py' --tiles-dir '" + justfile_directory() + "/public/tiles' --gap-seconds " + gap + " --max-tile-age " + max_tile_age } }}

config-export: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/export_config.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/export_config.py'" } }}

# Run only step 1: Download OSM data and land polygons (uses preprocessing/regions.json)
download: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_1_download.py' --regions-file '" + justfile_directory() + "/preprocessing/regions.json'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_1_download.py' --regions-file '" + justfile_directory() + "/preprocessing/regions.json'" } }}

# Run only step 2: Convert PBF to GeoJSON
convert: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_2_convert_to_geojson.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_2_convert_to_geojson.py'" } }}

# Run only step 3: Generate tiles from GeoJSON
tiles: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py'" } }}

# Download, convert, and add a single new region; appends it to preprocessing/regions.json
# URL is looked up from the Geofabrik index automatically when omitted.
# Usage: just add-region hamburg
# Usage: just add-region hamburg https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf
add-region name url="": setup config-export
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/run_staggered.py' --add-region " + name + (if url != "" { " --url " + url } else { "" }) + " --tiles-dir '" + justfile_directory() + "/public/tiles'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/run_staggered.py' --add-region " + name + (if url != "" { " --url " + url } else { "" }) + " --tiles-dir '" + justfile_directory() + "/public/tiles'" } }}

# List local regions from preprocessing/regions.json with their build status
list-regions:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/list_regions.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/list_regions.py'" } }}

# List available regions from Geofabrik (optionally filter by query)
# Usage: just list-regions-remote
# Usage: just list-regions-remote germany
list-regions-remote query="":
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/list_regions.py' --remote " + query + "\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/list_regions.py' --remote " + query } }}

# Build tiles for a subset of regions from regions.json (useful for validation)
# Usage: just build-regions hamburg schleswig-holstein
build-regions +regions: setup config-export
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/run_staggered.py' --only " + regions + " --tiles-dir '" + justfile_directory() + "/public/tiles'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/run_staggered.py' --only " + regions + " --tiles-dir '" + justfile_directory() + "/public/tiles'" } }}

# Re-tile one or more existing regions from their cached GeoJSON (no re-download/re-convert)
# Use when tileset config changed for specific regions. For data changes, use `just build`.
# Usage: just update-region hamburg
# Usage: just update-region hamburg schleswig-holstein
update-region +regions: setup config-export
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py' --update " + regions + "\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py' --update " + regions } }}

# Update one or more regions for specific tilesets only (no re-download or re-convert)
# Use when tileset config changed but underlying data is unchanged
# Usage: just update-region-tileset hamburg-latest t2b
# Usage: just update-region-tileset "hamburg-latest schleswig-holstein-latest" "t2b t3"
update-region-tileset regions tilesets: setup config-export
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py' --update " + regions + " --tilesets " + tilesets + "\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py' --update " + regions + " --tilesets " + tilesets } }}

# Regenerate specific tileset(s) for ALL existing regions (clears stale tiles first)
# Use when tileset config changes globally (e.g. added/removed features from a tileset)
# Usage: just regen-tileset t2b
# Usage: just regen-tileset t2b t3
regen-tileset +tilesets: setup config-export
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py' --regen-tilesets " + tilesets + "\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py' --regen-tilesets " + tilesets } }}

# Clean generated tiles only
clean:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Cleaning tiles...'; " + "if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }; " + "Write-Host 'Tiles cleaned'\"" } else { "echo 'Cleaning tiles...' && " + "rm -rf public/tiles && " + "echo 'Tiles cleaned'" } }}

# Clean tiles and downloaded data
clean-data:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Cleaning tiles and data...'; " + "if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }; " + "Get-ChildItem preprocessing/data/*.geojson -ErrorAction SilentlyContinue | Remove-Item -Force; " + "Write-Host 'Tiles and data cleaned'\"" } else { "echo 'Cleaning tiles and data...' && " + "rm -rf public/tiles && " + "rm -f preprocessing/data/*.geojson && " + "echo 'Tiles and data cleaned'" } }}

# Clean everything including build artifacts and virtual environment
clean-all: clean-data
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Cleaning build artifacts...'; " + "if (Test-Path venv) { Remove-Item -Recurse -Force venv }; " + "Write-Host 'All generated files cleaned'\"" } else { "echo 'Cleaning build artifacts...' && " + "rm -rf venv && " + "echo 'All generated files cleaned'" } }}

# Start local web server
serve:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Starting web server on http://localhost:8888'; " + "Write-Host 'Press Ctrl+C to stop'; " + "Set-Location public; python -m http.server 8888\"" } else { "echo 'Starting web server on http://localhost:8888' && " + "echo 'Press Ctrl+C to stop' && " + "cd public && python -m http.server 8888" } }}

# Run in development mode (serve directly)
dev:
    @just serve

# Show project info
info:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'OSM Map Renderer'; " + "Write-Host '================'; " + "Write-Host ''; " + "Write-Host 'OS:             Windows'; " + "Write-Host ('Python:         ' + $(python --version 2>&1)); " + "Write-Host ('Repository:     ' + $(try { git rev-parse --short HEAD 2>&1 } catch { 'not a git repo' })); " + "Write-Host ''; " + "Write-Host 'Python venv:'; " + "if (Test-Path venv) { Write-Host '  Virtual environment exists' } " + "else { Write-Host '  Not set up (run: just setup)' }; " + "Write-Host ''; " + "Write-Host 'Regions:'; " + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/list_regions.py' --tiles-dir '" + justfile_directory() + "/public/tiles'\"" } else { "echo 'OSM Map Renderer' && " + "echo '=================' && " + "echo '' && " + "echo 'OS:             " + os() + "' && " + "printf 'Python:         ' && (python --version 2>&1 || echo 'not installed') && " + "printf 'Repository:     ' && (git rev-parse --short HEAD 2>&1 || echo 'not a git repo') && " + "echo '' && " + "echo 'Python venv:' && " + "if [ -d venv ]; then echo '  Virtual environment exists'; " + "else echo '  Not set up (run: just setup)'; fi && " + "echo '' && " + "echo 'Regions:' && " + "venv/bin/python '" + justfile_directory() + "/preprocessing/list_regions.py' --tiles-dir '" + justfile_directory() + "/public/tiles'" } }}

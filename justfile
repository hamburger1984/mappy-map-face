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

# List all available commands
default:
    @just --list

# Build everything (setup and build tiles with auto-download)
all: setup build

# Setup Python virtual environment and install dependencies
setup:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Setting up Python virtual environment...'; " + "if (-not (Test-Path venv)) { python -m venv venv }; " + "Write-Host 'Installing dependencies...'; " + "& venv/Scripts/pip install -q -r requirements.txt; " + "Write-Host 'Setup complete!'\"" } else { "echo 'Setting up Python virtual environment...' && " + "if [ ! -d venv ]; then python -m venv venv; fi && " + "echo 'Installing dependencies...' && " + "venv/bin/pip install -q -r requirements.txt && " + "echo 'Setup complete!'" } }}

# Build tiles (downloads OSM if needed, converts to GeoJSON, generates tiles)
build: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/build_all.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/build_all.py'" } }}

# Run only step 1: Download OSM data and land polygons
download: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_1_download.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_1_download.py'" } }}

# Run only step 2: Convert PBF to GeoJSON
convert: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_2_convert_to_geojson.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_2_convert_to_geojson.py'" } }}

# Run only step 3: Generate tiles from GeoJSON
tiles: setup
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "& venv/Scripts/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py'\"" } else { "venv/bin/python '" + justfile_directory() + "/preprocessing/step_3_generate_tiles.py'" } }}

# Clean generated tiles only
clean:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Cleaning tiles...'; " + "if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }; " + "Write-Host 'Tiles cleaned'\"" } else { "echo 'Cleaning tiles...' && " + "rm -rf public/tiles && " + "echo 'Tiles cleaned'" } }}

# Clean tiles and downloaded data
clean-data:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Cleaning tiles and data...'; " + "if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }; " + "Get-ChildItem preprocessing/data/*.geojson -ErrorAction SilentlyContinue | Remove-Item -Force; " + "Write-Host 'Tiles and data cleaned'\"" } else { "echo 'Cleaning tiles and data...' && " + "rm -rf public/tiles && " + "rm -f preprocessing/data/*.geojson && " + "echo 'Tiles and data cleaned'" } }}

# Clean everything including build artifacts and virtual environment
clean-all: clean-data
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Cleaning build artifacts...'; " + "if (Test-Path zig-out) { Remove-Item -Recurse -Force zig-out }; " + "if (Test-Path .zig-cache) { Remove-Item -Recurse -Force .zig-cache }; " + "if (Test-Path venv) { Remove-Item -Recurse -Force venv }; " + "Write-Host 'All generated files cleaned'\"" } else { "echo 'Cleaning build artifacts...' && " + "rm -rf zig-out .zig-cache venv && " + "echo 'All generated files cleaned'" } }}

# Start local web server
serve:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'Starting web server on http://localhost:8888'; " + "Write-Host 'Press Ctrl+C to stop'; " + "Set-Location public; python -m http.server 8888\"" } else { "echo 'Starting web server on http://localhost:8888' && " + "echo 'Press Ctrl+C to stop' && " + "cd public && python -m http.server 8888" } }}

# Run in development mode (serve directly)
dev:
    @just serve

# Show project info
info:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"" + "Write-Host 'OSM Map Renderer'; " + "Write-Host '================'; " + "Write-Host ''; " + "Write-Host 'OS:             Windows'; " + "Write-Host ('Python:         ' + $(python --version 2>&1)); " + "Write-Host ('Zig:            ' + $(try { zig version 2>&1 } catch { 'not installed' })); " + "Write-Host ('Repository:     ' + $(try { git rev-parse --short HEAD 2>&1 } catch { 'not a git repo' })); " + "Write-Host ''; " + "Write-Host 'Python venv:'; " + "if (Test-Path venv) { Write-Host '  Virtual environment exists' } " + "else { Write-Host '  Not set up (run: just setup)' }; " + "Write-Host ''; " + "Write-Host 'Data files:'; " + "if (Test-Path preprocessing/data/hamburg-region.geojson) { " + "Get-Item preprocessing/data/hamburg-region.geojson | ForEach-Object { " + "Write-Host ('  ' + $_.Name + ' (' + '{0:N1} MB' -f ($_.Length / 1MB) + ')') } } " + "else { Write-Host '  GeoJSON not created (run: just data)' }; " + "Write-Host 'Tile status:'; " + "if (Test-Path public/tiles) { Write-Host '  Tiles generated' } " + "else { Write-Host '  Tiles not generated (run: just tiles)' }\"" } else { "echo 'OSM Map Renderer' && " + "echo '=================' && " + "echo '' && " + "echo 'OS:             " + os() + "' && " + "printf 'Python:         ' && (python --version 2>&1 || echo 'not installed') && " + "printf 'Zig:            ' && (zig version 2>&1 || echo 'not installed') && " + "printf 'Repository:     ' && (git rev-parse --short HEAD 2>&1 || echo 'not a git repo') && " + "echo '' && " + "echo 'Python venv:' && " + "if [ -d venv ]; then echo '  Virtual environment exists'; " + "else echo '  Not set up (run: just setup)'; fi && " + "echo '' && " + "echo 'Data files:' && " + "if [ -f preprocessing/data/hamburg-region.geojson ]; then " + "size=$(du -h preprocessing/data/hamburg-region.geojson | cut -f1); " + "echo \"  hamburg-region.geojson ($size)\"; " + "else echo '  GeoJSON not created (run: just data)'; fi && " + "echo 'Tile status:' && " + "if [ -d public/tiles ]; then echo '  Tiles generated'; " + "else echo '  Tiles not generated (run: just tiles)'; fi" } }}

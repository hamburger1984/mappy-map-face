# Hamburg OSM Map Renderer - justfile
#
# Cross-platform build automation using Just (https://just.systems)
# Supports: Windows (PowerShell), Linux (bash), macOS (bash)
#
# Common commands:
#   just          - Show all available commands
#   just all      - Download data and generate tiles
#   just data     - Download OSM data for Hamburg region
#   just tiles    - Generate map tiles (Python)
#   just serve    - Start development web server
#   just info     - Show system and project information

# List all available commands
default:
    @just --list

# Build everything (fetch data and generate tiles)
all: data tiles

# Download and process OSM data
data:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Fetching OSM data...'; & '" + justfile_directory() + "/preprocessing/fetch-data.ps1'\"" } else { "echo 'Fetching OSM data...' && bash '" + justfile_directory() + "/preprocessing/fetch-data.sh'" } }}

# Generate tiles from existing GeoJSON (Python version)
tiles:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Generating tiles from hamburg-region.geojson...'; python '" + justfile_directory() + "/preprocessing/split-tiles.py' '" + justfile_directory() + "/preprocessing/data/hamburg-region.geojson'; Write-Host 'Tiles generated in public/tiles/'\"" } else { "echo 'Generating tiles from hamburg-region.geojson...' && python '" + justfile_directory() + "/preprocessing/split-tiles.py' '" + justfile_directory() + "/preprocessing/data/hamburg-region.geojson' && echo 'Tiles generated in public/tiles/'" } }}

# Generate tiles using Zig (faster, but needs compilation)
tiles-zig:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Building Zig tile splitter...'; zig build; Write-Host 'Generating tiles...'; & './zig-out/bin/split-tiles.exe' 'data/hamburg-region.geojson'; Write-Host 'Tiles generated in public/tiles/'\"" } else { "echo 'Building Zig tile splitter...' && zig build && echo 'Generating tiles...' && ./zig-out/bin/split-tiles data/hamburg-region.geojson && echo 'Tiles generated in public/tiles/'" } }}

# Clean generated tiles only
clean:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Cleaning tiles...'; if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }; Write-Host 'Tiles cleaned'\"" } else { "echo 'Cleaning tiles...' && rm -rf public/tiles && echo 'Tiles cleaned'" } }}

# Clean tiles and downloaded data
clean-data:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Cleaning tiles and data...'; if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }; Get-ChildItem preprocessing/data/*.geojson -ErrorAction SilentlyContinue | Remove-Item -Force; Write-Host 'Tiles and data cleaned'\"" } else { "echo 'Cleaning tiles and data...' && rm -rf public/tiles && rm -f preprocessing/data/*.geojson && echo 'Tiles and data cleaned'" } }}

# Clean everything including build artifacts
clean-all: clean-data
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Cleaning build artifacts...'; if (Test-Path zig-out) { Remove-Item -Recurse -Force zig-out }; if (Test-Path .zig-cache) { Remove-Item -Recurse -Force .zig-cache }; Write-Host 'All generated files cleaned'\"" } else { "echo 'Cleaning build artifacts...' && rm -rf zig-out .zig-cache && echo 'All generated files cleaned'" } }}

# Start local web server
serve:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Starting web server on http://localhost:8888'; Write-Host 'Press Ctrl+C to stop'; Set-Location public; python -m http.server 8888\"" } else { "echo 'Starting web server on http://localhost:8888' && echo 'Press Ctrl+C to stop' && cd public && python -m http.server 8888" } }}

# Run in development mode (serve directly)
dev:
    @just serve

# Show project info
info:
    @{{ if os() == "windows" { "pwsh -NoProfile -Command \"Write-Host 'Hamburg OSM Map Renderer'; Write-Host '======================='; Write-Host ''; Write-Host 'OS:             Windows'; Write-Host ('Python:         ' + $(python --version 2>&1)); Write-Host ('Zig:            ' + $(try { zig version 2>&1 } catch { 'not installed' })); Write-Host ('Repository:     ' + $(try { git rev-parse --short HEAD 2>&1 } catch { 'not a git repo' })); Write-Host ''; Write-Host 'Data files:'; if (Test-Path preprocessing/data/hamburg-region.geojson) { Get-Item preprocessing/data/hamburg-region.geojson | ForEach-Object { Write-Host ('  ' + $_.Name + ' (' + '{0:N1} MB' -f ($_.Length / 1MB) + ')') } } else { Write-Host '  GeoJSON not created (run: just data)' }; Write-Host 'Tile status:'; if (Test-Path public/tiles) { Write-Host '  Tiles generated' } else { Write-Host '  Tiles not generated (run: just tiles)' }\"" } else { "echo 'Hamburg OSM Map Renderer' && echo '=======================' && echo '' && echo 'OS:             " + os() + "' && printf 'Python:         ' && (python --version 2>&1 || echo 'not installed') && printf 'Zig:            ' && (zig version 2>&1 || echo 'not installed') && printf 'Repository:     ' && (git rev-parse --short HEAD 2>&1 || echo 'not a git repo') && echo '' && echo 'Data files:' && if [ -f preprocessing/data/hamburg-region.geojson ]; then size=$(du -h preprocessing/data/hamburg-region.geojson | cut -f1); echo \"  hamburg-region.geojson ($size)\"; else echo '  GeoJSON not created (run: just data)'; fi && echo 'Tile status:' && if [ -d public/tiles ]; then echo '  Tiles generated'; else echo '  Tiles not generated (run: just tiles)'; fi" } }}

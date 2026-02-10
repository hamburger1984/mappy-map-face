# Hamburg OSM Map Renderer - justfile

set shell := ["pwsh", "-NoProfile", "-Command"]

# List all available commands
default:
    @just --list

# Build everything (fetch data and generate tiles)
all: data tiles

# Download and process OSM data
data:
    @Write-Host "Fetching OSM data..."
    & "{{justfile_directory()}}/preprocessing/fetch-data.ps1"

# Generate tiles from existing GeoJSON (Python version)
tiles:
    @Write-Host "Generating tiles from hamburg-region.geojson..."
    python "{{justfile_directory()}}/preprocessing/split-tiles.py" "{{justfile_directory()}}/preprocessing/data/hamburg-region.geojson"
    @Write-Host "Tiles generated in public/tiles/"

# Generate tiles using Zig (faster, but needs compilation)
tiles-zig:
    @Write-Host "Building Zig tile splitter..."
    zig build
    @Write-Host "Generating tiles from hamburg-region.geojson..."
    & "./zig-out/bin/split-tiles" data/hamburg-region.geojson
    @Write-Host "Tiles generated in public/tiles/"

# Clean generated tiles only
clean:
    @Write-Host "Cleaning tiles..."
    if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }
    @Write-Host "Tiles cleaned"

# Clean tiles and downloaded data
clean-data:
    @Write-Host "Cleaning tiles and data..."
    if (Test-Path public/tiles) { Remove-Item -Recurse -Force public/tiles }
    Get-ChildItem data/*.geojson -ErrorAction SilentlyContinue | Remove-Item -Force
    @Write-Host "Tiles and data cleaned"

# Clean everything including build artifacts
clean-all: clean-data
    @Write-Host "Cleaning build artifacts..."
    if (Test-Path zig-out) { Remove-Item -Recurse -Force zig-out }
    if (Test-Path .zig-cache) { Remove-Item -Recurse -Force .zig-cache }
    @Write-Host "All generated files cleaned"

# Start local web server
serve:
    @Write-Host "Starting web server on http://localhost:8888"
    @Write-Host "Press Ctrl+C to stop"
    Set-Location public; python -m http.server 8888

# Run in development mode (serve directly)
dev:
    @Write-Host "Starting development server..."
    @just serve

# Show project info
info:
    @Write-Host "Hamburg OSM Map Renderer"
    @Write-Host "======================="
    @Write-Host ""
    @Write-Host "Python:         $(python --version 2>&1)"
    @Write-Host "Zig:            $(try { zig version 2>&1 } catch { 'not installed' })"
    @Write-Host "Repository:     $(try { git rev-parse --short HEAD 2>&1 } catch { 'not a git repo' })"
    @Write-Host ""
    @Write-Host "Data files:"
    @if (Test-Path data/hamburg-region.geojson) { Get-Item data/hamburg-region.geojson | ForEach-Object { Write-Host ("  " + $_.Name + " (" + "{0:N1} MB" -f ($_.Length / 1MB) + ")") } } else { Write-Host "  GeoJSON not created (run: just data)" }
    @Write-Host "Tile status:"
    @if (Test-Path public/tiles) { Write-Host "  Tiles generated" } else { Write-Host "  Tiles not generated (run: just tiles)" }

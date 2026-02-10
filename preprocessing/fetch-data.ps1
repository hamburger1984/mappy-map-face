# Fetch and preprocess OpenStreetMap data for Hamburg region (100km radius)

$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$PublicDir = Join-Path $ScriptDir "public"
$DataDir = Join-Path $ScriptDir "data"

# Bounding box: ~100km radius around Hamburg (53.55N, 9.99E)
$Bbox = "8.48,52.65,11.50,54.45"

Write-Host "================================================"
Write-Host "Hamburg Region OSM Data Fetcher"
Write-Host "================================================"
Write-Host ""
Write-Host "Coverage: ~200km x 200km (100km radius from Hamburg)"
Write-Host "Bounding box: $Bbox"
Write-Host ""

# Activate conda if available and osmium isn't already on PATH
if (-not (Get-Command osmium -ErrorAction SilentlyContinue))
{
    $condaPaths = @(
        "$env:USERPROFILE\anaconda3"
        "$env:USERPROFILE\miniconda3"
        "C:\ProgramData\anaconda3"
        "C:\ProgramData\miniconda3"
    )
    foreach ($condaRoot in $condaPaths)
    {
        $condaHook = Join-Path $condaRoot "shell\condabin\conda-hook.ps1"
        if (Test-Path $condaHook)
        {
            Write-Host "Activating conda from $condaRoot..."
            & $condaHook
            conda activate base
            break
        }
    }
}

# Check for required tools
Write-Host "Checking for required tools..."

if (-not (Get-Command curl -ErrorAction SilentlyContinue))
{
    Write-Host "Error: curl is not installed"
    exit 1
}

if (-not (Get-Command osmium -ErrorAction SilentlyContinue))
{
    Write-Host "Error: osmium-tool is not installed"
    Write-Host "Install with: conda install -c conda-forge osmium-tool"
    Write-Host "           or: use WSL (wsl sudo apt-get install osmium-tool)"
    Write-Host "           or: brew install osmium-tool (macOS)"
    exit 1
}

Write-Host "All required tools found"
Write-Host ""

# Helper to format file size
function Format-FileSize($path)
{
    $size = (Get-Item $path).Length
    if ($size -ge 1GB)
    { return "{0:N1} GB" -f ($size / 1GB) 
    }
    if ($size -ge 1MB)
    { return "{0:N1} MB" -f ($size / 1MB) 
    }
    if ($size -ge 1KB)
    { return "{0:N1} KB" -f ($size / 1KB) 
    }
    return "$size B"
}

# Create directories
New-Item -ItemType Directory -Force -Path $PublicDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# Download state extracts from Geofabrik
$States = @(
    "hamburg"
    "schleswig-holstein"
    "niedersachsen"
    "mecklenburg-vorpommern"
)

foreach ($state in $States)
{
    $Pbf = Join-Path $DataDir "$state-latest.osm.pbf"
    if (Test-Path $Pbf)
    {
        $size = Format-FileSize $Pbf
        Write-Host "  $state extract already exists ($size). Delete to re-download."
    } else
    {
        Write-Host "  Downloading $state extract from Geofabrik..."
        curl.exe -L -o $Pbf "https://download.geofabrik.de/europe/germany/$state-latest.osm.pbf"
        $size = Format-FileSize $Pbf
        Write-Host "  Downloaded $state ($size)"
    }
}
Write-Host ""

# Merge state extracts
$Merged = Join-Path $DataDir "northern-germany.osm.pbf"
Write-Host "Merging state extracts..."
osmium merge `
(Join-Path $DataDir "hamburg-latest.osm.pbf") `
(Join-Path $DataDir "schleswig-holstein-latest.osm.pbf") `
(Join-Path $DataDir "niedersachsen-latest.osm.pbf") `
(Join-Path $DataDir "mecklenburg-vorpommern-latest.osm.pbf") `
    -o $Merged --overwrite
$size = Format-FileSize $Merged
Write-Host "Merged ($size)"
Write-Host ""

# Extract bounding box
$RegionPbf = Join-Path $DataDir "hamburg-region.osm.pbf"
Write-Host "Extracting region (bbox: $Bbox)..."
osmium extract -b $Bbox $Merged -o $RegionPbf --overwrite
$size = Format-FileSize $RegionPbf
Write-Host "Extracted region ($size)"
Write-Host ""

# Convert to GeoJSON
$RegionGeojson = Join-Path $DataDir "hamburg-region.geojson"
Write-Host "Converting to GeoJSON format..."
Write-Host "  (This may take a few minutes for the larger area)"
$exportConfig = Join-Path $ScriptDir "osmium-export-config.json"
if (Test-Path $exportConfig)
{
    osmium export $RegionPbf -o $RegionGeojson --overwrite --config=$exportConfig
} else
{
    osmium export $RegionPbf -o $RegionGeojson --overwrite
}
$size = Format-FileSize $RegionGeojson
Write-Host "Converted to GeoJSON ($size)"
Write-Host ""

# Generate tiles for progressive loading
Write-Host "================================================"
Write-Host "Generating tile system..."
Write-Host "================================================"
Write-Host ""
Write-Host "This will split the GeoJSON into Web Mercator tiles"
Write-Host "for progressive loading. This may take several minutes..."
Write-Host ""

# Find python command
$pythonCmd = $null
if (Get-Command python3 -ErrorAction SilentlyContinue)
{
    $pythonCmd = "python3"
} elseif (Get-Command python -ErrorAction SilentlyContinue)
{
    $pythonCmd = "python"
}

if ($pythonCmd)
{
    $splitScript = Join-Path $ScriptDir "split-tiles.py"
    & $pythonCmd $splitScript $RegionGeojson

    $tilesDir = Join-Path $PublicDir "tiles"
    if (Test-Path $tilesDir)
    {
        $tileCount = (Get-ChildItem -Path $tilesDir -Filter "*.json" -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
        $tileSize = "{0:N1} MB" -f ((Get-ChildItem -Path $tilesDir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB)
        Write-Host ""
        Write-Host "Generated $tileCount tiles (total: $tileSize)"
    }
} else
{
    Write-Host "Warning: python not found, skipping tile generation"
    Write-Host "  Tiles are needed for optimal performance with the web renderer"
}
Write-Host ""

Write-Host "================================================"
Write-Host "Data preparation complete!"
Write-Host "================================================"
Write-Host ""
Write-Host "Files created:"
Write-Host "  data/ directory:"
Write-Host "    - State PBF extracts (4 states)"
Write-Host "    - northern-germany.osm.pbf  (merged)"
Write-Host "    - hamburg-region.osm.pbf    (clipped to bbox)"
Write-Host "    - hamburg-region.geojson    (for tile generation)"
Write-Host "  public/tiles/                 (progressive loading tiles)"
Write-Host ""
Write-Host "You can now run: just serve"
Write-Host ""

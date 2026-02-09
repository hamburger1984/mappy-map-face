#!/bin/bash
# Fetch and preprocess OpenStreetMap data for Hamburg region (100km radius)

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/public"
DATA_DIR="$SCRIPT_DIR/data"

# Bounding box: ~100km radius around Hamburg (53.55N, 9.99E)
BBOX="8.48,52.65,11.50,54.45"

echo "================================================"
echo "Hamburg Region OSM Data Fetcher"
echo "================================================"
echo ""
echo "Coverage: ~200km x 200km (100km radius from Hamburg)"
echo "Bounding box: $BBOX"
echo ""

# Check for required tools
echo "Checking for required tools..."

if ! command -v curl &> /dev/null; then
    echo "Error: curl is not installed"
    exit 1
fi

if ! command -v osmium &> /dev/null; then
    echo "Error: osmium-tool is not installed"
    echo "Install with: brew install osmium-tool (macOS)"
    echo "           or: apt-get install osmium-tool (Linux)"
    exit 1
fi

echo "All required tools found"
echo ""

# Create directories
mkdir -p "$PUBLIC_DIR"
mkdir -p "$DATA_DIR"

# Download state extracts from Geofabrik
STATES=(
    "hamburg"
    "schleswig-holstein"
    "niedersachsen"
    "mecklenburg-vorpommern"
)

for state in "${STATES[@]}"; do
    PBF="$DATA_DIR/$state-latest.osm.pbf"
    if [ -f "$PBF" ]; then
        echo "  $state extract already exists ($(du -h "$PBF" | cut -f1)). Delete to re-download."
    else
        echo "  Downloading $state extract from Geofabrik..."
        curl -L -o "$PBF" \
            "https://download.geofabrik.de/europe/germany/$state-latest.osm.pbf"
        echo "  Downloaded $state ($(du -h "$PBF" | cut -f1))"
    fi
done
echo ""

# Merge state extracts
MERGED="$DATA_DIR/northern-germany.osm.pbf"
echo "Merging state extracts..."
osmium merge \
    "$DATA_DIR/hamburg-latest.osm.pbf" \
    "$DATA_DIR/schleswig-holstein-latest.osm.pbf" \
    "$DATA_DIR/niedersachsen-latest.osm.pbf" \
    "$DATA_DIR/mecklenburg-vorpommern-latest.osm.pbf" \
    -o "$MERGED" --overwrite
echo "Merged ($(du -h "$MERGED" | cut -f1))"
echo ""

# Extract bounding box
REGION_PBF="$DATA_DIR/hamburg-region.osm.pbf"
echo "Extracting region (bbox: $BBOX)..."
osmium extract -b "$BBOX" "$MERGED" -o "$REGION_PBF" --overwrite
echo "Extracted region ($(du -h "$REGION_PBF" | cut -f1))"
echo ""

# Convert to GeoJSON
REGION_GEOJSON="$DATA_DIR/hamburg-region.geojson"
echo "Converting to GeoJSON format..."
echo "  (This may take a few minutes for the larger area)"
osmium export "$REGION_PBF" -o "$REGION_GEOJSON" --overwrite \
    --config=osmium-export-config.json 2>/dev/null || \
    osmium export "$REGION_PBF" -o "$REGION_GEOJSON" --overwrite
echo "Converted to GeoJSON ($(du -h "$REGION_GEOJSON" | cut -f1))"
echo ""

# Generate tiles for progressive loading
echo "================================================"
echo "Generating tile system..."
echo "================================================"
echo ""
echo "This will split the GeoJSON into Web Mercator tiles"
echo "for progressive loading. This may take several minutes..."
echo ""

if command -v python3 &> /dev/null; then
    python3 "$SCRIPT_DIR/split-tiles.py" "$REGION_GEOJSON"
    TILE_COUNT=$(find "$PUBLIC_DIR/tiles" -name "*.json.gz" 2>/dev/null | wc -l | tr -d ' ')
    TILE_SIZE=$(du -sh "$PUBLIC_DIR/tiles" 2>/dev/null | cut -f1)
    echo ""
    echo "Generated $TILE_COUNT tiles (total: $TILE_SIZE)"
else
    echo "Warning: python3 not found, skipping tile generation"
    echo "  Tiles are needed for optimal performance with the web renderer"
fi
echo ""

echo "================================================"
echo "Data preparation complete!"
echo "================================================"
echo ""
echo "Files created:"
echo "  data/ directory:"
echo "    - State PBF extracts (4 states)"
echo "    - northern-germany.osm.pbf  (merged)"
echo "    - hamburg-region.osm.pbf    (clipped to bbox)"
echo "    - hamburg-region.geojson    (for tile generation)"
echo "  public/tiles/                 (progressive loading tiles)"
echo ""
echo "You can now run: just serve"
echo ""

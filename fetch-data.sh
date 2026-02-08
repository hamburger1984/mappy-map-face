#!/bin/bash
# Fetch and preprocess OpenStreetMap data for Hamburg

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/public"

echo "================================================"
echo "Hamburg OSM Data Fetcher"
echo "================================================"
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

echo "✓ All required tools found"
echo ""

# Create public directory if it doesn't exist
mkdir -p "$PUBLIC_DIR"

# Download Hamburg extract from Geofabrik
HAMBURG_PBF="$PUBLIC_DIR/hamburg.osm.pbf"
if [ -f "$HAMBURG_PBF" ]; then
    echo "Hamburg extract already exists. Delete it to re-download."
else
    echo "Downloading Hamburg extract from Geofabrik..."
    curl -L -o "$HAMBURG_PBF" \
        "https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf"
    echo "✓ Downloaded Hamburg extract ($(du -h "$HAMBURG_PBF" | cut -f1))"
fi
echo ""

# Extract city area (Hamburg center: 53.55°N, 9.99°E)
# ±15km range for data (user can pan around)
# Bounding box: lon ±0.22°, lat ±0.135°
HAMBURG_CENTER="$PUBLIC_DIR/hamburg-center.osm.pbf"
echo "Extracting Hamburg city area (bbox: 9.77,53.415,10.21,53.685)..."
echo "  Center: 53.55°N, 9.99°E"
echo "  Range: ~30km (±15km from center)"
osmium extract -b 9.77,53.415,10.21,53.685 "$HAMBURG_PBF" -o "$HAMBURG_CENTER" --overwrite
echo "✓ Extracted city center ($(du -h "$HAMBURG_CENTER" | cut -f1))"
echo ""

# Convert to GeoJSON with simplification
HAMBURG_GEOJSON="$PUBLIC_DIR/hamburg.geojson"
HAMBURG_GEOJSON_GZ="$PUBLIC_DIR/hamburg.geojson.gz"
echo "Converting to GeoJSON format (with geometry simplification)..."
osmium export "$HAMBURG_CENTER" -o "$HAMBURG_GEOJSON" --overwrite \
    --config=osmium-export-config.json 2>/dev/null || \
    osmium export "$HAMBURG_CENTER" -o "$HAMBURG_GEOJSON" --overwrite
echo "✓ Converted to GeoJSON ($(du -h "$HAMBURG_GEOJSON" | cut -f1))"
echo ""

# Gzip compression removed - no longer needed with tile-based progressive loading

# Generate tiles for progressive loading
echo "================================================"
echo "Generating tile system..."
echo "================================================"
echo ""
echo "This will split the GeoJSON into Web Mercator tiles"
echo "for progressive loading. This may take a minute..."
echo ""

if command -v python3 &> /dev/null; then
    python3 "$SCRIPT_DIR/split-tiles.py" "$HAMBURG_GEOJSON"
    TILE_COUNT=$(find "$PUBLIC_DIR/tiles" -name "*.json.gz" 2>/dev/null | wc -l | tr -d ' ')
    TILE_SIZE=$(du -sh "$PUBLIC_DIR/tiles" 2>/dev/null | cut -f1)
    echo ""
    echo "✓ Generated $TILE_COUNT tiles (total: $TILE_SIZE)"
else
    echo "⚠ Warning: python3 not found, skipping tile generation"
    echo "  Tiles are needed for optimal performance with the web renderer"
fi
echo ""

echo "================================================"
echo "Data preparation complete!"
echo "================================================"
echo ""
echo "Files created in $PUBLIC_DIR:"
echo "  - hamburg.osm.pbf         (full Hamburg extract)"
echo "  - hamburg-center.osm.pbf  (city center only)"
echo "  - hamburg.geojson         (for tile generation)"
echo "  - tiles/                  (progressive loading tiles)"
echo ""
echo "You can now run: ./start-server.sh"
echo ""

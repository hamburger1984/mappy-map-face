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

# Extract city center area
HAMBURG_CENTER="$PUBLIC_DIR/hamburg-center.osm.pbf"
echo "Extracting Hamburg city center (bbox: 9.95,53.53,10.05,53.58)..."
osmium extract -b 9.95,53.53,10.05,53.58 "$HAMBURG_PBF" -o "$HAMBURG_CENTER" --overwrite
echo "✓ Extracted city center ($(du -h "$HAMBURG_CENTER" | cut -f1))"
echo ""

# Convert to GeoJSON
HAMBURG_GEOJSON="$PUBLIC_DIR/hamburg.geojson"
echo "Converting to GeoJSON format..."
osmium export "$HAMBURG_CENTER" -o "$HAMBURG_GEOJSON" --overwrite
echo "✓ Converted to GeoJSON ($(du -h "$HAMBURG_GEOJSON" | cut -f1))"
echo ""

echo "================================================"
echo "Data preparation complete!"
echo "================================================"
echo ""
echo "Files created in $PUBLIC_DIR:"
echo "  - hamburg.osm.pbf         (full Hamburg extract)"
echo "  - hamburg-center.osm.pbf  (city center only)"
echo "  - hamburg.geojson         (ready for rendering)"
echo ""
echo "You can now run: ./start-server.sh"
echo ""

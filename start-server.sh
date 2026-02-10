#!/bin/bash
# Quick start script for the Hamburg OSM Renderer

echo "Starting Hamburg OSM Map Renderer..."
echo "=================================="
echo ""
echo "Server will be available at: http://localhost:8888"
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")/public" || exit 1

PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: python not found"
    exit 1
fi

$PYTHON_CMD -m http.server 8888

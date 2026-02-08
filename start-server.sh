#!/bin/bash
# Quick start script for the Hamburg OSM Renderer

echo "Starting Hamburg OSM Map Renderer..."
echo "=================================="
echo ""
echo "Server will be available at: http://localhost:8080"
echo "Press Ctrl+C to stop the server"
echo ""

cd public
python3 -m http.server 8080

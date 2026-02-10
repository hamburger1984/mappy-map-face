# Quick start script for the Hamburg OSM Renderer

Write-Host "Starting Hamburg OSM Map Renderer..."
Write-Host "=================================="
Write-Host ""
Write-Host "Server will be available at: http://localhost:8888"
Write-Host "Press Ctrl+C to stop the server"
Write-Host ""

Push-Location (Join-Path $PSScriptRoot "public")
try
{
    python -m http.server 8888
} finally
{
    Pop-Location
}

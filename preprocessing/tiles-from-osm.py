#!/usr/bin/env python3
"""
Generate tiles from OSM PBF files without merging.
Converts each PBF to temporary GeoJSON and processes into shared tile database.
"""

import importlib.util
import subprocess
import sys
import tempfile
from pathlib import Path

# Import split-tiles.py (with hyphen) as a module
spec = importlib.util.spec_from_file_location(
    "split_tiles", Path(__file__).parent / "split-tiles.py"
)
split_tiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(split_tiles)


def pbf_to_temp_geojson(pbf_file, bbox=None):
    """Convert OSM PBF to temporary GeoJSON file."""
    print(f"  Converting {Path(pbf_file).name} to GeoJSON...")

    temp_geojson = tempfile.NamedTemporaryFile(
        mode="w", suffix=".geojson", delete=False, encoding="utf-8"
    )
    temp_path = temp_geojson.name
    temp_geojson.close()

    cmd = ["osmium", "export", str(pbf_file), "-o", temp_path, "--overwrite"]

    # Check for export config
    config_file = Path(__file__).parent / "osmium-export-config.json"
    if config_file.exists():
        cmd.extend(["--config", str(config_file)])

    subprocess.run(cmd, check=True, capture_output=True)

    file_size = Path(temp_path).stat().st_size / (1024 * 1024)
    print(f"    → {file_size:.1f} MB GeoJSON")

    return temp_path


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  ./tiles-from-osm.py <file.osm.pbf> [file2.osm.pbf ...]")
        print("  ./tiles-from-osm.py --dir <directory>")
        print()
        print("Examples:")
        print("  ./tiles-from-osm.py data/hamburg-latest.osm.pbf")
        print("  ./tiles-from-osm.py --dir preprocessing/data")
        sys.exit(1)

    # Parse arguments
    pbf_files = []
    args = sys.argv[1:]

    if args[0] == "--dir":
        if len(args) < 2:
            print("Error: --dir requires directory path")
            sys.exit(1)
        directory = Path(args[1])
        if not directory.is_dir():
            print(f"Error: {directory} is not a directory")
            sys.exit(1)

        # Find all .osm.pbf files, skip intermediate/merged files
        for pbf in sorted(directory.glob("*.osm.pbf")):
            if any(
                skip in pbf.name
                for skip in ["northern-germany", "region", "merged", "clipped"]
            ):
                print(f"Skipping: {pbf.name} (intermediate file)")
                continue
            pbf_files.append(str(pbf))
    else:
        pbf_files = args

    if not pbf_files:
        print("Error: No OSM PBF files found")
        sys.exit(1)

    # Validate files
    for pbf in pbf_files:
        if not Path(pbf).exists():
            print(f"Error: File not found: {pbf}")
            sys.exit(1)

    output_dir = "public/tiles"
    zoom_levels = [8, 11, 14]

    print("=" * 70)
    print("OSM to Tiles (Direct Processing)")
    print("=" * 70)
    print(f"Input files: {len(pbf_files)}")
    for pbf in pbf_files:
        size_mb = Path(pbf).stat().st_size / (1024 * 1024)
        print(f"  - {Path(pbf).name} ({size_mb:.1f} MB)")
    print(f"Output: {output_dir}")
    print(f"Zoom levels: {zoom_levels}")
    print("=" * 70)
    print()

    # Process each PBF file, collecting bounds
    import json

    merged_bounds = {
        "minLon": float("inf"),
        "maxLon": float("-inf"),
        "minLat": float("inf"),
        "maxLat": float("-inf"),
    }

    for i, pbf_file in enumerate(pbf_files, 1):
        print(f"\n[{i}/{len(pbf_files)}] Processing {Path(pbf_file).name}")
        print("-" * 70)

        temp_geojson = None
        try:
            # Convert to temp GeoJSON
            temp_geojson = pbf_to_temp_geojson(pbf_file)

            # Process into tile databases (accumulates across files)
            file_bounds = split_tiles.split_geojson_into_tiles(
                temp_geojson, output_dir, zoom_levels
            )

            # Merge bounds
            merged_bounds["minLon"] = min(
                merged_bounds["minLon"], file_bounds["minLon"]
            )
            merged_bounds["maxLon"] = max(
                merged_bounds["maxLon"], file_bounds["maxLon"]
            )
            merged_bounds["minLat"] = min(
                merged_bounds["minLat"], file_bounds["minLat"]
            )
            merged_bounds["maxLat"] = max(
                merged_bounds["maxLat"], file_bounds["maxLat"]
            )

        finally:
            # Clean up temp file
            if temp_geojson:
                try:
                    Path(temp_geojson).unlink()
                    print(f"  ✓ Cleaned up temporary file")
                except:
                    pass

    # Write tile index with merged bounds
    index_file = Path(output_dir) / "index.json"
    tile_count = sum(
        len(list((Path(output_dir) / str(z)).rglob("*.json"))) for z in zoom_levels
    )

    index_data = {
        "bounds": merged_bounds,
        "zoom_levels": sorted(zoom_levels),
        "tile_count": tile_count,
        "center": {
            "lon": (merged_bounds["minLon"] + merged_bounds["maxLon"]) / 2,
            "lat": (merged_bounds["minLat"] + merged_bounds["maxLat"]) / 2,
        },
    }
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2)

    print()
    print("=" * 70)
    print("✓ All files processed into tiles")
    print(f"✓ Created tile index: {index_file}")
    print(
        f"  Bounds: {merged_bounds['minLon']:.2f}, {merged_bounds['minLat']:.2f} to {merged_bounds['maxLon']:.2f}, {merged_bounds['maxLat']:.2f}"
    )
    print("=" * 70)


if __name__ == "__main__":
    main()

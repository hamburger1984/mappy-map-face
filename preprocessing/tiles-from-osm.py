#!/usr/bin/env python3
"""
Generate tiles from OSM PBF files without merging.
Converts each PBF to GeoJSON and processes into tiles with merging support.

PARALLELIZATION:
- Each PBF → GeoJSON conversion is independent and can be parallelized
- Tile generation from each GeoJSON can also be parallelized (separate databases)
- Final tile writing supports merging, so files can be processed in parallel
- To parallelize: use multiprocessing.Pool to process PBF files concurrently
"""

import importlib.util
import subprocess
import sys
from multiprocessing import Pool, cpu_count
from pathlib import Path

# Import split-tiles.py (with hyphen) as a module
spec = importlib.util.spec_from_file_location(
    "split_tiles", Path(__file__).parent / "split-tiles.py"
)
split_tiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(split_tiles)


def pbf_to_geojson(pbf_file, bbox=None):
    """Convert OSM PBF to GeoJSON file in same directory as PBF."""
    print(f"  Converting {Path(pbf_file).name} to GeoJSON...")

    # Create GeoJSON file in same directory as PBF with same base name
    pbf_path = Path(pbf_file)
    geojson_path = pbf_path.parent / f"{pbf_path.stem}.geojson"
    temp_path = str(geojson_path)

    cmd = ["osmium", "export", str(pbf_file), "-o", temp_path, "--overwrite"]

    # Check for export config
    config_file = Path(__file__).parent / "osmium-export-config.json"
    if config_file.exists():
        cmd.extend(["--config", str(config_file)])

    subprocess.run(cmd, check=True, capture_output=True)

    file_size = Path(temp_path).stat().st_size / (1024 * 1024)
    print(f"    → {file_size:.1f} MB GeoJSON")

    return temp_path


def process_pbf_file(args):
    """Process a single PBF file. Used for parallel processing."""
    pbf_file, output_dir, zoom_levels = args

    print(f"\n[WORKER] Processing {Path(pbf_file).name}")
    print("-" * 70)

    # Convert to GeoJSON
    geojson_file = pbf_to_geojson(pbf_file)

    # Get source file prefix for database naming
    source_prefix = Path(pbf_file).stem

    try:
        # Process into tiles, using PBF file as source for fingerprinting
        file_bounds = split_tiles.split_geojson_into_tiles(
            geojson_file,
            output_dir,
            zoom_levels,
            source_pbf_file=pbf_file,
            db_prefix=source_prefix,
        )

        return file_bounds
    finally:
        # Clean up temporary GeoJSON file
        try:
            Path(geojson_file).unlink()
            print(f"  ✓ Cleaned up temporary GeoJSON file")
        except Exception as e:
            print(f"  Warning: Could not delete {geojson_file}: {e}")


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

    # Limit to 3 parallel workers to avoid memory issues with large OSM files
    num_workers = min(3, len(pbf_files))

    print("=" * 70)
    print("OSM to Tiles (Parallel Processing)")
    print("=" * 70)
    print(f"Input files: {len(pbf_files)}")
    for pbf in pbf_files:
        size_mb = Path(pbf).stat().st_size / (1024 * 1024)
        print(f"  - {Path(pbf).name} ({size_mb:.1f} MB)")
    print(f"Output: {output_dir}")
    print(f"Zoom levels: {zoom_levels}")
    print(f"Parallel workers: {num_workers}")
    print("=" * 70)
    print()

    # Process files in parallel, collecting bounds
    import json

    merged_bounds = {
        "minLon": float("inf"),
        "maxLon": float("-inf"),
        "minLat": float("inf"),
        "maxLat": float("-inf"),
    }

    # Prepare arguments for parallel processing
    worker_args = [(pbf, output_dir, zoom_levels) for pbf in pbf_files]

    # Process files in parallel
    print(f"Processing {len(pbf_files)} files using {num_workers} workers...")
    with Pool(num_workers) as pool:
        results = pool.map(process_pbf_file, worker_args)

    # Merge bounds from all results
    for file_bounds in results:
        merged_bounds["minLon"] = min(merged_bounds["minLon"], file_bounds["minLon"])
        merged_bounds["maxLon"] = max(merged_bounds["maxLon"], file_bounds["maxLon"])
        merged_bounds["minLat"] = min(merged_bounds["minLat"], file_bounds["minLat"])
        merged_bounds["maxLat"] = max(merged_bounds["maxLat"], file_bounds["maxLat"])

    # Write tile index with merged bounds
    index_file = Path(output_dir) / "index.json"
    tile_count = sum(
        len(list((Path(output_dir) / str(z)).rglob("*.json"))) for z in zoom_levels
    )

    import time

    index_data = {
        "bounds": merged_bounds,
        "zoom_levels": sorted(zoom_levels),
        "tile_count": tile_count,
        "center": {
            "lon": split_tiles.HAMBURG_CENTER_LON,
            "lat": split_tiles.HAMBURG_CENTER_LAT,
        },
        "generated": int(
            time.time() * 1000
        ),  # Timestamp in milliseconds for cache busting
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

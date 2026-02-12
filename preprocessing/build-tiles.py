#!/usr/bin/env python3
"""
Unified tile building workflow:
1. Download OSM files if missing or older than 1 month
2. Process OSM -> GeoJSON -> Database (with fingerprinting)
3. Generate tiles (with fingerprinting)
"""

import argparse
import importlib.util
import json
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

# Import split_tiles module
spec = importlib.util.spec_from_file_location(
    "split_tiles", Path(__file__).parent / "split-tiles.py"
)
split_tiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(split_tiles)

# Import tiles_from_osm module
spec2 = importlib.util.spec_from_file_location(
    "tiles_from_osm", Path(__file__).parent / "tiles-from-osm.py"
)
tiles_from_osm = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(tiles_from_osm)

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
OUTPUT_DIR = Path("public/tiles")


# Wrapper function for multiprocessing (must be defined at module level)
def _process_pbf_file_wrapper(args):
    """Wrapper for tiles_from_osm.process_pbf_file that can be pickled.

    Each worker process imports the module independently to avoid pickling issues.
    """
    # Import in worker process
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "tiles_from_osm", Path(__file__).parent / "tiles-from-osm.py"
    )
    tiles_from_osm_worker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tiles_from_osm_worker)

    return tiles_from_osm_worker.process_pbf_file(args)


# OSM files to download
OSM_SOURCES = {
    "hamburg": "https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf",
    "schleswig-holstein": "https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf",
    "mecklenburg-vorpommern": "https://download.geofabrik.de/europe/germany/mecklenburg-vorpommern-latest.osm.pbf",
    "nordrhein-westfalen": "https://download.geofabrik.de/europe/germany/nordrhein-westfalen-latest.osm.pbf",
    "denmark": "https://download.geofabrik.de/europe/denmark-latest.osm.pbf",
}

ZOOM_LEVELS = [8, 11, 14]
MAX_PARALLEL_WORKERS = 3  # Default parallelism level for downloads and processing


def check_file_age(file_path, max_age_days=30):
    """Check if file exists and is newer than max_age_days."""
    if not file_path.exists():
        return False

    file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
    age = datetime.now() - file_time
    return age < timedelta(days=max_age_days)


def download_single_file(args):
    """Download a single OSM file. Used for parallel downloads."""
    name, url, pbf_file, worker_id = args

    # Download to temporary file with .partial suffix
    temp_file = pbf_file.parent / f"{pbf_file.name}.partial"

    print(f"  [{name}] Starting download...")

    try:
        # Download with periodic progress updates
        with urllib.request.urlopen(url) as response:
            total_size = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 1024 * 1024  # 1MB chunks
            last_report = 0

            with open(temp_file, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)

                    # Report every 20%
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        report_threshold = int(percent / 20)
                        if report_threshold > last_report:
                            bar_width = 20
                            filled = int(bar_width * downloaded / total_size)
                            bar = "█" * filled + "░" * (bar_width - filled)
                            print(
                                f"  [{name}] {bar} {percent:5.1f}% ({downloaded / (1024 * 1024):6.1f} / {total_size / (1024 * 1024):6.1f} MB)"
                            )
                            last_report = report_threshold

        # Move temp file to final location (atomic operation)
        temp_file.rename(pbf_file)

        size_mb = pbf_file.stat().st_size / (1024 * 1024)
        print(f"  [{name}] ✓ Downloaded {size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"  [{name}] ✗ Download failed: {e}")
        if temp_file.exists():
            temp_file.unlink()  # Clean up partial download
        return False


def download_osm_files(max_workers=MAX_PARALLEL_WORKERS):
    """Download OSM files if missing or too old."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Clean up any leftover partial downloads
    for partial_file in DATA_DIR.glob("*.partial"):
        partial_file.unlink()

    print("=" * 70)
    print("Step 1: Checking OSM source files")
    print("=" * 70)
    print()

    downloads_needed = []

    for name, url in OSM_SOURCES.items():
        pbf_file = DATA_DIR / f"{name}-latest.osm.pbf"

        if pbf_file.exists():
            if check_file_age(pbf_file, max_age_days=30):
                size_mb = pbf_file.stat().st_size / (1024 * 1024)
                age_days = (
                    datetime.now() - datetime.fromtimestamp(pbf_file.stat().st_mtime)
                ).days
                print(f"  ✓ {name}: {size_mb:.1f} MB ({age_days} days old)")
            else:
                age_days = (
                    datetime.now() - datetime.fromtimestamp(pbf_file.stat().st_mtime)
                ).days
                print(f"  ⚠ {name}: {age_days} days old (>30 days) - will re-download")
                downloads_needed.append((name, url, pbf_file))
        else:
            print(f"  ✗ {name}: missing - will download")
            downloads_needed.append((name, url, pbf_file))

    if downloads_needed:
        print()
        print(f"Downloading {len(downloads_needed)} file(s)...")

        # Parallel downloads
        from multiprocessing import Pool

        num_workers = min(max_workers, len(downloads_needed))
        if num_workers > 1:
            print(f"Using {num_workers} parallel downloads...")
            print()

            # Add worker IDs to download arguments
            downloads_with_ids = [
                (name, url, pbf_file, i)
                for i, (name, url, pbf_file) in enumerate(downloads_needed)
            ]

            with Pool(num_workers) as pool:
                results = pool.map(download_single_file, downloads_with_ids)

            # Check if any downloads failed
            if not all(results):
                print("✗ One or more downloads failed")
                sys.exit(1)
        else:
            # Single download
            if not download_single_file((*downloads_needed[0], 0)):
                sys.exit(1)

    print()
    return [DATA_DIR / f"{name}-latest.osm.pbf" for name in OSM_SOURCES.keys()]


def load_tile_index():
    """Load existing tile index if it exists."""
    index_file = OUTPUT_DIR / "index.json"
    if index_file.exists():
        with open(index_file, "r") as f:
            return json.load(f)
    return None


def check_tiles_need_rebuild(pbf_files, existing_index):
    """Check if tiles need to be rebuilt based on source file changes."""
    if not existing_index:
        print("  No existing index.json - tiles need building")
        return True

    # Check if source files are listed in index
    if "source_files" not in existing_index:
        print("  Index missing source_files - tiles need rebuilding")
        return True

    # Check each source file
    indexed_sources = {s["name"]: s for s in existing_index.get("source_files", [])}

    for pbf_file in pbf_files:
        name = pbf_file.stem
        stat = pbf_file.stat()
        fingerprint = f"{stat.st_size}:{stat.st_mtime_ns}"

        if name not in indexed_sources:
            print(f"  Source file {name} not in index - tiles need rebuilding")
            return True

        if indexed_sources[name].get("fingerprint") != fingerprint:
            print(f"  Source file {name} changed - tiles need rebuilding")
            return True

    print("  All source files match index - tiles are up to date")
    return False


def build_tiles(pbf_files, max_workers=MAX_PARALLEL_WORKERS):
    """Build tiles from OSM files."""
    print("=" * 70)
    print("Step 2: Building tiles")
    print("=" * 70)
    print()

    # Check if rebuild needed
    existing_index = load_tile_index()
    if not check_tiles_need_rebuild(pbf_files, existing_index):
        print("✓ Tiles are up to date, skipping rebuild")
        return

    print(f"Processing {len(pbf_files)} OSM file(s)...")
    print()

    # Process files (this handles GeoJSON conversion, DB caching, tile generation)
    from multiprocessing import Pool

    num_workers = min(max_workers, len(pbf_files))
    worker_args = [(str(pbf), str(OUTPUT_DIR), ZOOM_LEVELS) for pbf in pbf_files]

    print(f"Using {num_workers} parallel workers...")
    with Pool(num_workers) as pool:
        results = pool.map(_process_pbf_file_wrapper, worker_args)

    # Merge bounds
    merged_bounds = {
        "minLon": float("inf"),
        "maxLon": float("-inf"),
        "minLat": float("inf"),
        "maxLat": float("-inf"),
    }

    for file_bounds in results:
        merged_bounds["minLon"] = min(merged_bounds["minLon"], file_bounds["minLon"])
        merged_bounds["maxLon"] = max(merged_bounds["maxLon"], file_bounds["maxLon"])
        merged_bounds["minLat"] = min(merged_bounds["minLat"], file_bounds["minLat"])
        merged_bounds["maxLat"] = max(merged_bounds["maxLat"], file_bounds["maxLat"])

    # Count tiles
    tile_count = sum(
        len(list((OUTPUT_DIR / str(z)).rglob("*.json"))) for z in ZOOM_LEVELS
    )

    # Create source file fingerprints for index
    source_files = []
    for pbf_file in pbf_files:
        stat = pbf_file.stat()
        source_files.append(
            {
                "name": pbf_file.stem,
                "fingerprint": f"{stat.st_size}:{stat.st_mtime_ns}",
                "size": stat.st_size,
                "modified": stat.st_mtime,
            }
        )

    # Write index.json
    index_file = OUTPUT_DIR / "index.json"
    index_data = {
        "bounds": merged_bounds,
        "zoom_levels": sorted(ZOOM_LEVELS),
        "tile_count": tile_count,
        "center": {
            "lon": split_tiles.HAMBURG_CENTER_LON,
            "lat": split_tiles.HAMBURG_CENTER_LAT,
        },
        "generated": int(time.time() * 1000),
        "source_files": source_files,
    }

    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2)

    print()
    print("=" * 70)
    print("✓ Tile building complete")
    print(f"  Generated: {tile_count} tiles")
    print(
        f"  Bounds: {merged_bounds['minLon']:.2f}, {merged_bounds['minLat']:.2f} to {merged_bounds['maxLon']:.2f}, {merged_bounds['maxLat']:.2f}"
    )
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Unified tile building workflow for OSM Map Renderer",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "-j",
        "--jobs",
        type=int,
        default=MAX_PARALLEL_WORKERS,
        help="Number of parallel workers for downloads and processing",
    )
    args = parser.parse_args()

    print()
    print("=" * 70)
    print("OSM Map Renderer - Unified Tile Builder")
    print("=" * 70)
    print()

    if args.jobs != MAX_PARALLEL_WORKERS:
        print(f"Using {args.jobs} parallel workers (override)")
        print()

    # Step 1: Download/check OSM files
    pbf_files = download_osm_files(max_workers=args.jobs)

    # Step 2: Build tiles (with caching at multiple levels)
    build_tiles(pbf_files, max_workers=args.jobs)

    print()
    print("✓ All done! Run 'just serve' to start the map viewer")
    print()


if __name__ == "__main__":
    main()

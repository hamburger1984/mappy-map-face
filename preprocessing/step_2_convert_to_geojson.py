#!/usr/bin/env python3
"""
Step 2: Convert OSM PBF files to GeoJSON format.

This script uses osmium to convert PBF files to GeoJSON.
Conversion can be parallelized across multiple files.
"""

import argparse
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    print("Error: tqdm is required for progress bars")
    print("Install with: pip install tqdm")
    sys.exit(1)


def convert_pbf_to_geojson(args):
    """Convert a single PBF file to GeoJSON."""
    pbf_file, config_file = args
    pbf_path = Path(pbf_file)
    geojson_path = pbf_path.parent / f"{pbf_path.stem}.geojson"

    # Check if GeoJSON exists and is newer than PBF (skip conversion)
    if geojson_path.exists():
        pbf_mtime = pbf_path.stat().st_mtime
        geojson_mtime = geojson_path.stat().st_mtime
        if geojson_mtime > pbf_mtime:
            size_mb = geojson_path.stat().st_size / (1024 * 1024)
            return {
                "name": pbf_path.name,
                "status": "cached",
                "size_mb": size_mb,
                "output": str(geojson_path),
            }

    # Check if osmium is available
    if not subprocess.run(["which", "osmium"], capture_output=True).returncode == 0:
        return {"name": pbf_path.name, "status": "failed", "error": "osmium not found"}

    try:
        cmd = [
            "osmium",
            "export",
            str(pbf_path),
            "-o",
            str(geojson_path),
            "--overwrite",
        ]

        if config_file and Path(config_file).exists():
            cmd.extend(["--config", str(config_file)])

        subprocess.run(cmd, check=True, capture_output=True)

        size_mb = geojson_path.stat().st_size / (1024 * 1024)
        return {
            "name": pbf_path.name,
            "status": "success",
            "size_mb": size_mb,
            "output": str(geojson_path),
        }

    except subprocess.CalledProcessError as e:
        return {
            "name": pbf_path.name,
            "status": "failed",
            "error": e.stderr.decode() if e.stderr else str(e),
        }
    except Exception as e:
        return {"name": pbf_path.name, "status": "failed", "error": str(e)}


def main():
    parser = argparse.ArgumentParser(
        description="Convert OSM PBF files to GeoJSON",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "pbf_files",
        nargs="*",
        help="PBF files to convert (if not specified, converts all in data dir)",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent / "data",
        help="Directory containing PBF files",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parent / "osmium-export-config.json",
        help="Osmium export configuration file",
    )
    parser.add_argument(
        "-j", "--jobs", type=int, default=3, help="Number of parallel conversions"
    )

    args = parser.parse_args()

    # Find PBF files
    if args.pbf_files:
        pbf_files = [Path(f) for f in args.pbf_files]
    else:
        pbf_files = list(args.data_dir.glob("*-latest.osm.pbf"))

    if not pbf_files:
        print("Error: No PBF files found")
        sys.exit(1)

    print("=" * 70)
    print("Step 2: Convert PBF to GeoJSON")
    print("=" * 70)
    print()
    print(f"Files to convert: {len(pbf_files)}")
    for pbf in pbf_files:
        size_mb = pbf.stat().st_size / (1024 * 1024)
        print(f"  - {pbf.name} ({size_mb:.1f} MB)")
    print()

    # Convert files in parallel
    conversion_args = [
        (str(pbf), args.config if args.config.exists() else None) for pbf in pbf_files
    ]

    with Pool(min(args.jobs, len(pbf_files))) as pool:
        results = list(
            tqdm(
                pool.imap_unordered(convert_pbf_to_geojson, conversion_args),
                total=len(conversion_args),
                desc="Converting",
                unit="file",
            )
        )

    # Print results
    print("\nConversion Results:")
    success_count = 0
    for result in sorted(results, key=lambda x: x["name"]):
        if result["status"] == "success":
            print(f"  ✓ {result['name']} → {result['size_mb']:.1f} MB GeoJSON")
            success_count += 1
        elif result["status"] == "cached":
            print(
                f"  ✓ {result['name']} → {result['size_mb']:.1f} MB GeoJSON (cached, up-to-date)"
            )
            success_count += 1
        else:
            print(f"  ✗ {result['name']}: {result.get('error', 'failed')}")

    print()
    print("=" * 70)
    print(f"✓ Converted {success_count}/{len(results)} files")
    print("=" * 70)

    if success_count < len(results):
        sys.exit(1)


if __name__ == "__main__":
    main()

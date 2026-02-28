#!/usr/bin/env python3
"""
Step 1: Download OSM data files and land polygons.

This script downloads:
- OSM PBF files from Geofabrik
- Land polygon shapefiles from OSM (simplified and detailed)

All downloads are parallelized with progress bars.
"""

import argparse
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from datetime import datetime, timedelta
from multiprocessing import Pool
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    print("Error: tqdm is required for progress bars")
    print("Install with: pip install tqdm")
    sys.exit(1)


# OSM data sources
OSM_SOURCES = {
    "hamburg": "https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf",
    "schleswig-holstein": "https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf",
    "mecklenburg-vorpommern": "https://download.geofabrik.de/europe/germany/mecklenburg-vorpommern-latest.osm.pbf",
    "niedersachsen": "https://download.geofabrik.de/europe/germany/niedersachsen-latest.osm.pbf",
    # "nordrhein-westfalen": "https://download.geofabrik.de/europe/germany/nordrhein-westfalen-latest.osm.pbf",
    "denmark": "https://download.geofabrik.de/europe/denmark-latest.osm.pbf",
    # "poland": "https://download.geofabrik.de/europe/poland-latest.osm.pbf",
    "sweden": "https://download.geofabrik.de/europe/sweden-latest.osm.pbf",
}


def check_file_age(file_path, max_age_days=30):
    """Check if file exists and is newer than max_age_days."""
    if not file_path.exists():
        return False
    file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
    age = datetime.now() - file_time
    return age < timedelta(days=max_age_days)


def format_file_age(file_path):
    """Format file age as human-readable string."""
    age = datetime.now() - datetime.fromtimestamp(file_path.stat().st_mtime)
    total_seconds = int(age.total_seconds())
    if total_seconds < 60:
        return f"{total_seconds}s old"
    if total_seconds < 3600:
        return f"{total_seconds // 60}m old"
    if age.days < 1:
        return f"{total_seconds // 3600}h old"
    return f"{age.days}d old"


def download_with_progress(url, output_path, desc):
    """Download a file with tqdm progress bar and resume support."""
    temp_file = output_path.parent / f"{output_path.name}.partial"
    meta_file = output_path.parent / f"{output_path.name}.partial.meta"

    # Check if we have a partial download with metadata
    resume_pos = 0
    saved_etag = None
    saved_last_modified = None

    if temp_file.exists() and meta_file.exists():
        resume_pos = temp_file.stat().st_size
        # Load metadata from previous download attempt
        try:
            with open(meta_file, "r") as f:
                for line in f:
                    key, value = line.strip().split(":", 1)
                    if key == "ETag":
                        saved_etag = value.strip()
                    elif key == "Last-Modified":
                        saved_last_modified = value.strip()
        except Exception:
            pass  # If metadata is corrupted, we'll start fresh
    elif temp_file.exists():
        # Partial file exists but no metadata - can't safely resume
        print("  → Found partial download without metadata, starting fresh")
        temp_file.unlink()

    try:
        # First, do a HEAD request to check ETag/Last-Modified
        head_req = urllib.request.Request(url, method="HEAD")
        current_etag = None
        current_last_modified = None
        try:
            with urllib.request.urlopen(head_req) as head_response:
                current_etag = head_response.headers.get("ETag")
                current_last_modified = head_response.headers.get("Last-Modified")

                # Validate if file hasn't changed
                if resume_pos > 0:
                    if current_etag and saved_etag and current_etag != saved_etag:
                        print("  → Remote file changed (ETag mismatch), starting fresh")
                        resume_pos = 0
                        temp_file.unlink()
                        meta_file.unlink()
                    elif (
                        current_last_modified
                        and saved_last_modified
                        and current_last_modified != saved_last_modified
                    ):
                        print(
                            "  → Remote file changed (Last-Modified mismatch), starting fresh"
                        )
                        resume_pos = 0
                        temp_file.unlink()
                        meta_file.unlink()
                    else:
                        print(f"  → Resuming from {resume_pos / (1024 * 1024):.1f} MB")
        except urllib.error.HTTPError:
            # Server doesn't support HEAD, proceed with GET
            pass

        # Create request with Range header for resume support
        req = urllib.request.Request(url)
        if resume_pos > 0:
            req.add_header("Range", f"bytes={resume_pos}-")

        with urllib.request.urlopen(req) as response:
            # Get ETag and Last-Modified from GET response if HEAD failed
            if current_etag is None:
                current_etag = response.headers.get("ETag")
            if current_last_modified is None:
                current_last_modified = response.headers.get("Last-Modified")

            # Check if server supports ranges
            if resume_pos > 0 and response.status != 206:
                print("  → Server doesn't support resume, starting from scratch")
                resume_pos = 0
                if temp_file.exists():
                    temp_file.unlink()
                if meta_file.exists():
                    meta_file.unlink()

            # Get total size
            if response.status == 206:
                # Partial content - parse Content-Range header
                content_range = response.headers.get("Content-Range", "")
                if content_range:
                    total_size = int(content_range.split("/")[-1])
                else:
                    total_size = (
                        int(response.headers.get("Content-Length", 0)) + resume_pos
                    )
            else:
                total_size = int(response.headers.get("Content-Length", 0))

            # Save metadata for future resume attempts
            with open(meta_file, "w") as f:
                if current_etag:
                    f.write(f"ETag: {current_etag}\n")
                if current_last_modified:
                    f.write(f"Last-Modified: {current_last_modified}\n")
                f.write(f"URL: {url}\n")
                f.write(f"Total-Size: {total_size}\n")

            # Open file in append mode if resuming, write mode otherwise
            mode = "ab" if resume_pos > 0 else "wb"
            with open(temp_file, mode) as f:
                with tqdm(
                    total=total_size,
                    initial=resume_pos,
                    unit="B",
                    unit_scale=True,
                    unit_divisor=1024,
                    desc=desc,
                    leave=False,
                ) as pbar:
                    while True:
                        chunk = response.read(1024 * 1024)  # 1MB chunks
                        if not chunk:
                            break
                        f.write(chunk)
                        pbar.update(len(chunk))

        # Verify file size matches expected
        actual_size = temp_file.stat().st_size
        if total_size > 0 and actual_size != total_size:
            raise Exception(f"Download incomplete: {actual_size} != {total_size}")

        # Download complete - move to final location and clean up metadata
        temp_file.rename(output_path)
        if meta_file.exists():
            meta_file.unlink()
        return True
    except Exception as e:
        # Keep partial file and metadata for resume
        print("  → Partial download saved for resume")
        raise e


def download_osm_file(args):
    """Download a single OSM PBF file."""
    name, url, data_dir = args
    pbf_file = data_dir / f"{name}-latest.osm.pbf"

    # Check if already up-to-date
    if pbf_file.exists() and check_file_age(pbf_file, max_age_days=30):
        size_mb = pbf_file.stat().st_size / (1024 * 1024)
        return {
            "name": name,
            "status": "cached",
            "size_mb": size_mb,
            "age": format_file_age(pbf_file),
        }

    try:
        download_with_progress(url, pbf_file, f"Downloading {name}")
        size_mb = pbf_file.stat().st_size / (1024 * 1024)
        return {"name": name, "status": "downloaded", "size_mb": size_mb}
    except Exception as e:
        return {"name": name, "status": "failed", "error": str(e)}


def download_and_convert_land_polygons(args):
    """Download and convert land polygon shapefile to GeoJSON."""
    name, url, data_dir = args
    output_file = data_dir / f"{name}-land-polygons.geojson"

    # Check if already up-to-date
    if output_file.exists() and check_file_age(output_file, max_age_days=30):
        size_mb = output_file.stat().st_size / (1024 * 1024)
        return {
            "name": name,
            "status": "cached",
            "size_mb": size_mb,
            "age": format_file_age(output_file),
        }

    # Check for ogr2ogr
    ogr2ogr_path = shutil.which("ogr2ogr")
    if not ogr2ogr_path:
        return {"name": name, "status": "skipped", "reason": "ogr2ogr not found"}

    zip_file = data_dir / f"{name}-land-polygons.zip"
    temp_dir = data_dir / f"{name}-land-temp"

    try:
        # Download
        download_with_progress(url, zip_file, f"Downloading {name} land polygons")

        # Extract
        temp_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(zip_file, "r") as zip_ref:
            zip_ref.extractall(temp_dir)

        # Find shapefile
        shp_files = list(temp_dir.rglob("*.shp"))
        if not shp_files:
            raise Exception("No .shp file found in archive")
        shp_path = shp_files[0]

        # Convert with reprojection to WGS84
        subprocess.run(
            [
                ogr2ogr_path,
                "-f",
                "GeoJSON",
                "-t_srs",
                "EPSG:4326",
                str(output_file),
                str(shp_path),
            ],
            check=True,
            capture_output=True,
        )

        # Cleanup
        shutil.rmtree(temp_dir)
        zip_file.unlink()

        size_mb = output_file.stat().st_size / (1024 * 1024)
        return {"name": name, "status": "downloaded", "size_mb": size_mb}

    except Exception as e:
        # Cleanup on error
        for path in [zip_file, temp_dir, output_file]:
            if path.exists():
                if path.is_dir():
                    shutil.rmtree(path)
                else:
                    path.unlink()
        return {"name": name, "status": "failed", "error": str(e)}


def main():
    parser = argparse.ArgumentParser(
        description="Download OSM data files and land polygons",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent / "data",
        help="Directory to store downloaded files",
    )
    parser.add_argument(
        "-j", "--jobs", type=int, default=3, help="Number of parallel downloads"
    )

    parser.add_argument(
        "--clean-partial",
        action="store_true",
        help="Delete partial downloads and start fresh",
    )

    args = parser.parse_args()
    args.data_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("Step 1: Download OSM Data")
    print("=" * 70)
    print()

    # Handle partial downloads
    partial_files = list(args.data_dir.glob("*.partial"))
    meta_files = list(args.data_dir.glob("*.partial.meta"))
    if args.clean_partial and (partial_files or meta_files):
        print(f"Cleaning {len(partial_files)} partial download(s)...")
        for partial in partial_files:
            partial.unlink()
        for meta in meta_files:
            meta.unlink()
        print()
    elif partial_files:
        print(
            f"Found {len(partial_files)} partial download(s) - will attempt to resume"
        )
        print()

    # Download OSM files
    print(f"Downloading OSM files ({len(OSM_SOURCES)} sources)...")
    osm_args = [(name, url, args.data_dir) for name, url in OSM_SOURCES.items()]

    with Pool(args.jobs) as pool:
        osm_results = list(
            tqdm(
                pool.imap_unordered(download_osm_file, osm_args),
                total=len(osm_args),
                desc="OSM files",
                unit="file",
            )
        )

    # Print OSM results
    print("\nOSM Files:")
    for result in sorted(osm_results, key=lambda x: x["name"]):
        if result["status"] == "cached":
            print(f"  ✓ {result['name']}: {result['size_mb']:.1f} MB ({result['age']})")
        elif result["status"] == "downloaded":
            print(
                f"  ✓ {result['name']}: {result['size_mb']:.1f} MB (newly downloaded)"
            )
        else:
            print(f"  ✗ {result['name']}: {result.get('error', 'failed')}")


if __name__ == "__main__":
    main()

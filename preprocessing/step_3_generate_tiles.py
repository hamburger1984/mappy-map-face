#!/usr/bin/env python3
"""
Step 3: Generate map tiles from GeoJSON files.

This script processes GeoJSON files into tile format with parallel processing
and detailed progress reporting.
"""

import argparse
import decimal
import importlib.util
import json
import shutil
import sys
import tempfile
import time
from multiprocessing import Pool
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    print("Error: tqdm is required for progress bars")
    print("Install with: pip install tqdm")
    sys.exit(1)

# Import split_tiles module
spec = importlib.util.spec_from_file_location(
    "split_tiles", Path(__file__).parent / "split-tiles.py"
)
split_tiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(split_tiles)


def decimal_default(o):
    """Handle decimal.Decimal values from ijson (more efficient than JSONEncoder subclass)."""
    if isinstance(o, decimal.Decimal):
        return float(o)
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


def process_geojson_to_tiles(args):
    """Process a single GeoJSON file into tiles."""
    geojson_file, output_dir, zoom_levels, source_file = args

    geojson_path = Path(geojson_file)
    source_path = Path(source_file) if source_file else geojson_path

    try:
        bounds = split_tiles.split_geojson_into_tiles(
            str(geojson_file),
            output_dir,
            zoom_levels,
            source_pbf_file=str(source_path),
            db_prefix=geojson_path.stem,
        )

        return {"name": geojson_path.name, "status": "success", "bounds": bounds}

    except Exception as e:
        return {"name": geojson_path.name, "status": "failed", "error": str(e)}


def feature_intersects_bounds(feature, bbox):
    """Check if a feature intersects with the given bounding box."""
    coords = feature["geometry"]["coordinates"]
    geom_type = feature["geometry"]["type"]

    def coord_in_bbox(lon, lat):
        return (
            bbox["minLon"] <= lon <= bbox["maxLon"]
            and bbox["minLat"] <= lat <= bbox["maxLat"]
        )

    # Quick check: see if any coordinate is within the bbox
    if geom_type == "Point":
        return coord_in_bbox(coords[0], coords[1])
    elif geom_type == "LineString":
        return any(coord_in_bbox(c[0], c[1]) for c in coords)
    elif geom_type == "Polygon":
        # Check outer ring
        return any(coord_in_bbox(c[0], c[1]) for c in coords[0])
    elif geom_type == "MultiPolygon":
        # Check first ring of each polygon
        return any(coord_in_bbox(c[0], c[1]) for polygon in coords for c in polygon[0])
    elif geom_type == "MultiLineString":
        return any(coord_in_bbox(c[0], c[1]) for line in coords for c in line)

    return False


def process_land_polygons(data_dir, output_dir, zoom_levels, osm_bounds=None):
    """Process land polygon files (simplified and detailed), optionally filtered to OSM bounds."""
    land_files = {
        "simplified": data_dir / "simplified-land-polygons.geojson",
        "detailed": data_dir / "detailed-land-polygons.geojson",
    }

    results = []

    # Add buffer to bounds to ensure we get land polygons slightly outside OSM data
    # This prevents rendering artifacts at the edges
    if osm_bounds:
        buffer = 0.5  # degrees (~55km at equator)
        filter_bbox = {
            "minLon": osm_bounds["minLon"] - buffer,
            "maxLon": osm_bounds["maxLon"] + buffer,
            "minLat": osm_bounds["minLat"] - buffer,
            "maxLat": osm_bounds["maxLat"] + buffer,
        }
        print(f"\nFiltering land polygons to bbox: {filter_bbox}")
    else:
        filter_bbox = None

    for land_type, land_file in land_files.items():
        if not land_file.exists():
            continue

        print(f"\nProcessing {land_type} land polygons...")

        # Tag features with layer_source property
        tagged_geojson = tempfile.NamedTemporaryFile(
            mode="w", suffix=".geojson", delete=False, dir=data_dir
        )

        try:
            # Use ijson for streaming to handle large files
            import ijson

            with open(land_file, "rb") as f:
                tagged_geojson.write('{"type":"FeatureCollection","features":[')
                first = True

                # Count features for progress
                feature_count = 0
                for _ in ijson.items(f, "features.item"):
                    feature_count += 1

                # Reset file position
                f.seek(0)

                # Process with progress bar
                filtered_count = 0
                with tqdm(
                    total=feature_count, desc=f"Filtering {land_type}", unit="feature"
                ) as pbar:
                    for feature in ijson.items(f, "features.item"):
                        # Filter by bounding box if provided
                        if filter_bbox and not feature_intersects_bounds(
                            feature, filter_bbox
                        ):
                            pbar.update(1)
                            continue

                        if not first:
                            tagged_geojson.write(",")
                        first = False

                        if "properties" not in feature:
                            feature["properties"] = {}
                        feature["properties"]["layer_source"] = (
                            f"land_polygons_{land_type}"
                        )

                        json.dump(feature, tagged_geojson, default=decimal_default)
                        filtered_count += 1
                        pbar.update(1)

                if filter_bbox:
                    print(
                        f"  → Kept {filtered_count}/{feature_count} features within bounds"
                    )

                tagged_geojson.write("]}")

            tagged_geojson.close()

            # Process into tiles
            bounds = split_tiles.split_geojson_into_tiles(
                tagged_geojson.name,
                output_dir,
                zoom_levels,
                source_pbf_file=str(land_file),
                db_prefix=f"land-{land_type}",
            )

            results.append(
                {"name": f"{land_type}-land", "status": "success", "bounds": bounds}
            )

        except Exception as e:
            results.append(
                {"name": f"{land_type}-land", "status": "failed", "error": str(e)}
            )

        finally:
            # Cleanup temporary file
            try:
                Path(tagged_geojson.name).unlink()
            except:
                pass

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Generate map tiles from GeoJSON files",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "geojson_files",
        nargs="*",
        help="GeoJSON files to process (if not specified, processes all in data dir)",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent / "data",
        help="Directory containing GeoJSON files",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("public/tiles"),
        help="Output directory for tiles",
    )
    parser.add_argument(
        "--zoom-levels",
        type=int,
        nargs="+",
        default=[8, 11, 14],
        help="Zoom levels to generate",
    )
    parser.add_argument(
        "-j",
        "--jobs",
        type=int,
        default=3,
        help="Number of parallel tile generation processes",
    )
    parser.add_argument(
        "--skip-land-polygons",
        action="store_true",
        help="Skip processing land polygons",
    )

    args = parser.parse_args()

    # Find PBF files and check which ones need GeoJSON processing
    if args.geojson_files:
        # If specific files provided, use them directly
        geojson_files = [Path(f) for f in args.geojson_files]
        files_to_process = geojson_files
    else:
        # Find all OSM PBF files
        pbf_files = list(args.data_dir.glob("*-latest.osm.pbf"))

        if not pbf_files and args.skip_land_polygons:
            print("Error: No OSM PBF files found")
            sys.exit(1)

        # Check which PBF files have valid cached databases
        files_to_process = []
        cached_pbf_files = []

        for pbf_file in pbf_files:
            # Check if all zoom databases exist with matching fingerprint
            db_prefix = pbf_file.stem
            fingerprint = split_tiles.get_input_fingerprint(str(pbf_file))

            all_cached = True
            for zoom in args.zoom_levels:
                db_path = args.data_dir / f"{db_prefix}_z{zoom}.db"
                if not db_path.exists():
                    all_cached = False
                    break

                # Check fingerprint
                try:
                    import sqlite3

                    conn = sqlite3.connect(str(db_path))
                    row = conn.execute(
                        "SELECT value FROM metadata WHERE key='fingerprint'"
                    ).fetchone()
                    conn.close()

                    if not row or row[0] != fingerprint:
                        all_cached = False
                        break
                except:
                    all_cached = False
                    break

            if all_cached:
                cached_pbf_files.append(pbf_file)
                print(f"  ✓ {pbf_file.name}: databases cached, skipping GeoJSON")
            else:
                # Need GeoJSON for this file
                geojson_file = pbf_file.parent / f"{pbf_file.stem}.geojson"
                if not geojson_file.exists():
                    print(
                        f"  ⚠ {pbf_file.name}: needs processing but {geojson_file.name} not found"
                    )
                    print(f"     Run 'just convert' first")
                    sys.exit(1)
                files_to_process.append(geojson_file)

        if files_to_process:
            print(
                f"\nWill process {len(files_to_process)} GeoJSON file(s) (databases not cached)"
            )

        geojson_files = files_to_process

    print("=" * 70)
    print("Step 3: Generate Map Tiles")
    print("=" * 70)
    print()
    print(f"Configuration:")
    print(f"  Zoom levels: {', '.join(map(str, args.zoom_levels))}")
    print(f"  Parallel jobs: {args.jobs}")
    print(f"  Output: {args.output_dir}")
    print()

    # Create temporary directory for building tiles
    # This ensures we start with a clean slate and don't merge with old data
    temp_tile_dir = Path(
        tempfile.mkdtemp(prefix="tiles_build_", dir=args.output_dir.parent)
    )

    all_results = []

    # Process OSM GeoJSON files
    if geojson_files:
        print(f"OSM Regions ({len(geojson_files)}):")
        for gj in geojson_files:
            size_mb = gj.stat().st_size / (1024 * 1024)
            region_name = gj.stem.replace("-latest.osm", "").replace("-", " ").title()
            print(f"  • {region_name} ({size_mb:.0f} MB)")
        print()

        # Find corresponding PBF files for fingerprinting
        tile_args = []
        for gj in geojson_files:
            pbf_file = gj.parent / f"{gj.stem}.osm.pbf"
            source_file = str(pbf_file) if pbf_file.exists() else str(gj)
            tile_args.append(
                (str(gj), str(temp_tile_dir), args.zoom_levels, source_file)
            )

        # Process in parallel with progress bar
        with Pool(min(args.jobs, len(tile_args))) as pool:
            results = list(
                tqdm(
                    pool.imap_unordered(process_geojson_to_tiles, tile_args),
                    total=len(tile_args),
                    desc="Processing regions",
                    unit="region",
                )
            )

        all_results.extend(results)

    # Calculate OSM bounds before processing land polygons
    osm_bounds = None
    if not args.skip_land_polygons and all_results:
        # Merge bounds from OSM results
        osm_bounds = {
            "minLon": float("inf"),
            "maxLon": float("-inf"),
            "minLat": float("inf"),
            "maxLat": float("-inf"),
        }
        for result in all_results:
            if result["status"] == "success" and "bounds" in result:
                bounds = result["bounds"]
                osm_bounds["minLon"] = min(osm_bounds["minLon"], bounds["minLon"])
                osm_bounds["maxLon"] = max(osm_bounds["maxLon"], bounds["maxLon"])
                osm_bounds["minLat"] = min(osm_bounds["minLat"], bounds["minLat"])
                osm_bounds["maxLat"] = max(osm_bounds["maxLat"], bounds["maxLat"])

        # Check if we found any valid bounds
        if osm_bounds["minLon"] == float("inf"):
            osm_bounds = None
        else:
            print()
            print("Map Coverage:")
            print(
                f"  {osm_bounds['minLat']:.2f}°N to {osm_bounds['maxLat']:.2f}°N, "
                f"{osm_bounds['minLon']:.2f}°E to {osm_bounds['maxLon']:.2f}°E"
            )

    # Process land polygons with OSM bounds filtering
    if not args.skip_land_polygons:
        land_results = process_land_polygons(
            args.data_dir, str(temp_tile_dir), args.zoom_levels, osm_bounds
        )
        all_results.extend(land_results)

    # Merge bounds from all results
    merged_bounds = {
        "minLon": float("inf"),
        "maxLon": float("-inf"),
        "minLat": float("inf"),
        "maxLat": float("-inf"),
    }

    print()
    print("Processing Summary:")

    success_count = 0
    failed_sources = []

    for result in all_results:
        if result["status"] == "success":
            bounds = result["bounds"]
            # Don't include land polygon bounds in final merge - they're filtered to OSM bounds anyway
            # and before filtering they cover the entire world
            if "land" not in result["name"]:
                merged_bounds["minLon"] = min(merged_bounds["minLon"], bounds["minLon"])
                merged_bounds["maxLon"] = max(merged_bounds["maxLon"], bounds["maxLon"])
                merged_bounds["minLat"] = min(merged_bounds["minLat"], bounds["minLat"])
                merged_bounds["maxLat"] = max(merged_bounds["maxLat"], bounds["maxLat"])

            # Clean up names for display
            name = result["name"].replace(".geojson", "").replace("-latest.osm", "")
            if "land" in name:
                print(f"  ✓ {name}")
            else:
                print(f"  ✓ {name.replace('-', ' ').title()}")
            success_count += 1
        else:
            name = result["name"].replace(".geojson", "").replace("-latest.osm", "")
            failed_sources.append(f"{name}: {result.get('error', 'unknown error')}")

    if failed_sources:
        for failure in failed_sources:
            print(f"  ✗ {failure}")

    # Write tile index
    if success_count > 0:
        tile_count = sum(
            len(list((temp_tile_dir / str(z)).rglob("*.json")))
            for z in args.zoom_levels
        )

        index_file = temp_tile_dir / "index.json"
        index_data = {
            "bounds": merged_bounds,
            "zoom_levels": sorted(args.zoom_levels),
            "tile_count": tile_count,
            "center": {
                "lon": split_tiles.HAMBURG_CENTER_LON,
                "lat": split_tiles.HAMBURG_CENTER_LAT,
            },
            "generated": int(time.time() * 1000),
        }

        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2)

        print()
        print("Finalizing tiles...")
        print(f"  ✓ Created index with {tile_count:,} tiles")
        print(
            f"  ✓ Bounds: {merged_bounds['minLat']:.2f}°N to {merged_bounds['maxLat']:.2f}°N, "
            f"{merged_bounds['minLon']:.2f}°E to {merged_bounds['maxLon']:.2f}°E"
        )

        # Move tiles from temp directory to final location atomically
        if args.output_dir.exists():
            shutil.rmtree(args.output_dir)

        shutil.move(str(temp_tile_dir), str(args.output_dir))
        print(f"  ✓ Moved to {args.output_dir}")
    else:
        # Clean up temp directory if nothing was created
        if temp_tile_dir.exists():
            shutil.rmtree(temp_tile_dir)

    print()
    print("=" * 70)
    if success_count == len(all_results):
        print(f"✓ Tile generation complete! Processed {success_count} source(s)")
    else:
        print(
            f"⚠ Tile generation completed with errors ({success_count}/{len(all_results)} sources)"
        )
    print("=" * 70)

    if success_count < len(all_results):
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Compute tile statistics by sampling tiles from a generated tileset.

Usage:
    venv/bin/python scripts/tile_stats.py public/tiles/
    venv/bin/python scripts/tile_stats.py public/tiles/ --csv       # append to docs/baseline.csv
    venv/bin/python scripts/tile_stats.py public/tiles/ --csv-only # CSV row to stdout only
    venv/bin/python scripts/tile_stats.py public/tiles/ --tilesets t2 t3  # only scan specific tilesets
"""

import argparse
import csv
import gzip
import json
import os
import random
import sys
import time
from collections import defaultdict
from pathlib import Path


def categorize_feature(feature):
    """Categorize a feature by its primary OSM tag for statistics."""
    props = feature.get("properties", {})
    for key in (
        "building", "highway", "railway", "waterway", "natural",
        "landuse", "leisure", "amenity", "shop", "boundary",
        "place", "aeroway", "public_transport", "man_made",
    ):
        val = props.get(key)
        if val:
            if key == "building" and val == "yes":
                return "building", "building"
            return key, f"{key}:{val}"
    return "unknown", "unknown"


def count_coordinates(geometry):
    """Count total coordinate points in a geometry."""
    coords = geometry.get("coordinates", [])
    geom_type = geometry.get("type", "")
    if geom_type == "Point":
        return 1
    elif geom_type in ("LineString", "MultiPoint"):
        return len(coords)
    elif geom_type in ("Polygon", "MultiLineString"):
        return sum(len(ring) for ring in coords)
    elif geom_type == "MultiPolygon":
        return sum(len(ring) for polygon in coords for ring in polygon)
    return 0


def format_size(num_bytes):
    """Format bytes as human-readable string."""
    if num_bytes >= 1024**3:
        return f"{num_bytes / 1024**3:.2f} GB"
    elif num_bytes >= 1024**2:
        return f"{num_bytes / 1024**2:.1f} MB"
    elif num_bytes >= 1024:
        return f"{num_bytes / 1024:.0f} KB"
    return f"{num_bytes} B"


def sample_tiles(tileset_path, max_sample=1000):
    """Reservoir-sample tile files from the tileset directory.

    For large tilesets, samples a subset of subdirectories, counts files in those,
    and extrapolates. Returns (sampled_paths, estimated_total_count, estimated_disk_bytes).
    """
    # Get subdirectory names
    subdirs = [entry.name for entry in os.scandir(tileset_path) if entry.is_dir()]

    if not subdirs:
        return [], 0, 0

    # For small tilesets, enumerate all directories
    if len(subdirs) <= 200:
        all_files = []
        total_tiles = 0
        total_disk = 0
        for name in subdirs:
            dirpath = os.path.join(tileset_path, name)
            for fn in os.listdir(dirpath):
                if fn.endswith(".json.gz"):
                    fpath = os.path.join(dirpath, fn)
                    total_tiles += 1
                    total_disk += os.path.getsize(fpath)
                    all_files.append(Path(fpath))

        if total_tiles <= max_sample:
            return all_files, total_tiles, total_disk
        sampled = random.sample(all_files, max_sample)
        return sampled, total_tiles, total_disk

    # Large tileset: sample ~50 directories, count their files, extrapolate total
    dir_sample_size = min(50, len(subdirs))
    sampled_dirs = random.sample(subdirs, dir_sample_size)

    dir_file_counts = {}
    dir_disk_sizes = {}
    for name in sampled_dirs:
        dirpath = os.path.join(tileset_path, name)
        gz_count = 0
        gz_bytes = 0
        for fn in os.listdir(dirpath):
            if fn.endswith(".json.gz"):
                gz_count += 1
                gz_bytes += os.path.getsize(os.path.join(dirpath, fn))
        dir_file_counts[name] = gz_count
        dir_disk_sizes[name] = gz_bytes

    avg_files_per_dir = sum(dir_file_counts.values()) / len(dir_file_counts)
    avg_disk_per_dir = sum(dir_disk_sizes.values()) / len(dir_disk_sizes)
    estimated_total = int(len(subdirs) * avg_files_per_dir)
    estimated_disk = int(len(subdirs) * avg_disk_per_dir)

    # Sample files from the sampled directories
    files_in_sampled = sum(dir_file_counts.values())
    sampled = []
    if files_in_sampled <= max_sample:
        for name in sampled_dirs:
            dirpath = os.path.join(tileset_path, name)
            for fn in os.listdir(dirpath):
                if fn.endswith(".json.gz"):
                    sampled.append(Path(dirpath) / fn)
    else:
        count = 0
        for name in sampled_dirs:
            dirpath = os.path.join(tileset_path, name)
            for fn in os.listdir(dirpath):
                if not fn.endswith(".json.gz"):
                    continue
                count += 1
                if len(sampled) < max_sample:
                    sampled.append(Path(dirpath) / fn)
                else:
                    j = random.randint(0, count - 1)
                    if j < max_sample:
                        sampled[j] = Path(dirpath) / fn

    return sampled, estimated_total, estimated_disk


def compute_stats(tile_dir, max_sample=1000, tilesets=None):
    """Compute per-tileset statistics by sampling tiles."""
    tile_dir = Path(tile_dir)
    results = []

    available = sorted(
        d.name for d in tile_dir.iterdir()
        if d.is_dir() and d.name.startswith("t")
    )
    if tilesets:
        available = [t for t in available if t in tilesets]

    for tileset_id in available:
        tileset_path = tile_dir / tileset_id
        t0 = time.time()
        sampled, total_tiles, actual_disk_size = sample_tiles(tileset_path, max_sample)
        enumerate_time = time.time() - t0

        if not sampled:
            continue

        sample_ratio = total_tiles / len(sampled)
        print(f"  {tileset_id.upper()}: {total_tiles:,} tiles ({enumerate_time:.1f}s enumerate, {format_size(actual_disk_size)} disk)", file=sys.stderr, end="", flush=True)

        group_stats = defaultdict(lambda: {"bytes": 0, "features": 0, "coords": 0})
        category_stats = defaultdict(lambda: {"bytes": 0, "features": 0, "coords": 0})

        t1 = time.time()
        for i, tile_file in enumerate(sampled):
            if (i + 1) % 500 == 0:
                print(f" {i+1}/{len(sampled)}", file=sys.stderr, end="", flush=True)
            try:
                with gzip.open(tile_file, "rt", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError):
                continue

            features = data.get("features", []) if isinstance(data, dict) else data
            for feat in features:
                feat_bytes = len(json.dumps(feat).encode("utf-8"))
                coord_count = count_coordinates(feat.get("geometry", {}))
                group, category = categorize_feature(feat)

                group_stats[group]["bytes"] += feat_bytes
                group_stats[group]["features"] += 1
                group_stats[group]["coords"] += coord_count

                category_stats[category]["bytes"] += feat_bytes
                category_stats[category]["features"] += 1
                category_stats[category]["coords"] += coord_count

        total_sampled_bytes = sum(s["bytes"] for s in group_stats.values())
        estimated_total = total_sampled_bytes * sample_ratio
        sample_time = time.time() - t1
        print(f" done in {sample_time:.1f}s ({format_size(int(estimated_total))})", file=sys.stderr)

        result = {
            "tileset": tileset_id.upper(),
            "tiles": total_tiles,
            "disk_mb": round(actual_disk_size / (1024 * 1024), 1),
            "sampled": len(sampled),
            "est_feature_mb": round(estimated_total / (1024 * 1024), 1),
            "groups": dict(sorted(group_stats.items(), key=lambda x: x[1]["bytes"], reverse=True)),
            "categories": dict(sorted(category_stats.items(), key=lambda x: x[1]["bytes"], reverse=True)),
            "sample_ratio": sample_ratio,
        }
        results.append(result)

    return results


def write_report(results, output_file=None):
    """Write a markdown statistics report."""
    lines = []
    lines.append("# Tile Statistics")
    lines.append("")
    lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")

    for r in results:
        lines.append(f"## {r['tileset']}")
        lines.append("")
        lines.append(f"- **Tiles:** {r['tiles']:,}")
        lines.append(f"- **Actual disk size:** {format_size(int(r['disk_mb'] * 1024 * 1024))}")
        lines.append(f"- **Sampled:** {r['sampled']}")
        lines.append(f"- **Estimated feature data:** {format_size(int(r['est_feature_mb'] * 1024 * 1024))}")
        lines.append("")

        lines.append("### By group")
        lines.append("")
        lines.append("| Group | Est. Size | Features | Coordinates |")
        lines.append("|-------|----------|----------|-------------|")
        for group, stats in r["groups"].items():
            est_size = format_size(int(stats["bytes"] * r["sample_ratio"]))
            est_features = f"{int(stats['features'] * r['sample_ratio']):,}"
            est_coords = f"{int(stats['coords'] * r['sample_ratio']):,}"
            lines.append(f"| {group} | {est_size} | {est_features} | {est_coords} |")
        lines.append("")

        lines.append("### Top categories")
        lines.append("")
        lines.append("| Category | Est. Size | Features | Coordinates | Avg bytes |")
        lines.append("|----------|----------|----------|-------------|-----------|")
        for category, stats in list(r["categories"].items())[:30]:
            est_size = format_size(int(stats["bytes"] * r["sample_ratio"]))
            est_features = f"{int(stats['features'] * r['sample_ratio']):,}"
            est_coords = f"{int(stats['coords'] * r['sample_ratio']):,}"
            avg_bytes = stats["bytes"] // max(stats["features"], 1)
            lines.append(f"| {category} | {est_size} | {est_features} | {est_coords} | {avg_bytes} |")
        lines.append("")

    report = "\n".join(lines)
    if output_file:
        Path(output_file).write_text(report, encoding="utf-8")
        print(f"Report written to {output_file}", file=sys.stderr)
    return report


def get_next_dp(csv_path):
    """Read baseline.csv and return the next datapoint number."""
    csv_path = Path(csv_path)
    if not csv_path.exists():
        return 1
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    if not rows:
        return 1
    return max(int(r["dp"]) for r in rows) + 1


def append_csv_row(csv_path, dp, date, regions, results):
    """Append one row per tileset to baseline.csv."""
    csv_path = Path(csv_path)
    write_header = not csv_path.exists() or csv_path.stat().st_size == 0

    with open(csv_path, "a", newline="") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["dp", "date", "regions", "tileset", "tiles", "disk_mb", "sampled", "est_feature_mb"])
        for r in results:
            writer.writerow([dp, date, regions, r["tileset"], r["tiles"], r["disk_mb"], r["sampled"], r["est_feature_mb"]])

    print(f"Appended {len(results)} rows to {csv_path} (dp={dp})", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Compute tile statistics")
    parser.add_argument("tile_dir", help="Path to tiles directory")
    parser.add_argument("--max-sample", type=int, default=1000, help="Max tiles to sample per tileset")
    parser.add_argument("--tilesets", nargs="+", help="Only scan these tilesets (e.g. t2 t3)")
    parser.add_argument("--csv", action="store_true", help="Append summary to docs/baseline.csv")
    parser.add_argument("--csv-only", action="store_true", help="Print CSV row to stdout, no report")
    parser.add_argument("--dp", type=int, help="Datapoint number (auto-detected if --csv)")
    parser.add_argument("--date", help="Date string (default: now)")
    parser.add_argument("--regions", help="Region description, e.g. 'Hamburg, SH'")
    parser.add_argument("--output", help="Write markdown report to file")
    args = parser.parse_args()

    results = compute_stats(args.tile_dir, max_sample=args.max_sample, tilesets=args.tilesets)

    if not results:
        print("No tilesets found.", file=sys.stderr)
        sys.exit(1)

    # CSV output
    if args.csv or args.csv_only:
        csv_path = Path(__file__).parent.parent / "docs" / "baseline.csv"
        dp = args.dp or get_next_dp(csv_path)
        date = args.date or time.strftime("%Y-%m-%d %H:%M")
        regions = args.regions or input("Region description: ").strip()

        if args.csv_only:
            for r in results:
                print(f'{dp},{date},"{regions}",{r["tileset"]},{r["tiles"]},{r["disk_mb"]},{r["sampled"]},{r["est_feature_mb"]}')
        else:
            append_csv_row(csv_path, dp, date, regions, results)

    # Markdown report
    if not args.csv_only:
        if args.output:
            write_report(results, args.output)
        else:
            write_report(results)


if __name__ == "__main__":
    main()

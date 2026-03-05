#!/usr/bin/env python3
"""
Staggered region build: process one region at a time in the order given.

Flow:
  1. Download global land polygons (once, shared across all regions).
  2. For each region in order:
       a. Download its PBF file (skipped if still fresh).
       b. Convert PBF → GeoJSON.
       c. Add or update tiles for that region only.
       d. Sleep `--gap-seconds` before the next region (optional).

This spreads network and CPU load over time and keeps the live tile set
incrementally up to date as each region finishes.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path


SCRIPTS_DIR = Path(__file__).parent


def run(script: Path, args: list[str], extra_env: dict | None = None) -> None:
    """Run a sibling preprocessing script, inheriting stdio."""
    env = {**os.environ, **(extra_env or {})}
    result = subprocess.run(
        [sys.executable, str(script), *args],
        env=env,
    )
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Staggered per-region OSM tile build",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--regions-file",
        type=Path,
        default=SCRIPTS_DIR / "regions.json",
        metavar="JSON",
        help="JSON file with a list of {\"name\": ..., \"url\": ...} region definitions "
             "(same format as step_1_download.py --regions-file). "
             "Defaults to regions.json in the same directory as this script.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent / "data",
        help="Directory for downloaded PBF files and intermediate GeoJSON data.",
    )
    parser.add_argument(
        "--tiles-dir",
        type=Path,
        default=Path("public/tiles"),
        metavar="DIR",
        help="Directory where tile JSON files are written.",
    )
    parser.add_argument(
        "--add-region",
        metavar="NAME",
        help="Download, convert, and add a single new region without processing all of "
             "regions.json. The region is appended to regions.json if not already listed. "
             "URL is looked up from the Geofabrik index when --url is omitted.",
    )
    parser.add_argument(
        "--url",
        metavar="URL",
        default=None,
        help="Explicit PBF download URL for --add-region (skips Geofabrik lookup).",
    )
    parser.add_argument(
        "--tileset-config",
        type=Path,
        default=None,
        metavar="YAML",
        help="Path to tileset_config.yaml.  Uses TILESET_CONFIG_PATH env var or "
             "the default relative path when omitted.",
    )
    parser.add_argument(
        "--land-polygon-url",
        type=str,
        default=None,
        metavar="URL",
        help="Override the default land polygon download URL.",
    )
    parser.add_argument(
        "--gap-seconds",
        type=int,
        default=0,
        metavar="N",
        help="Seconds to wait between finishing one region and starting the next.",
    )
    parser.add_argument(
        "-j", "--jobs",
        type=int,
        default=4,
        help="Parallel workers passed to conversion and tile generation steps.",
    )
    args = parser.parse_args()

    if args.add_region:
        # Single-region mode: bypass regions-file, process the one given region.
        name = args.add_region
        url  = args.url

        if not url:
            import geofabrik
            try:
                url, full_id = geofabrik.lookup_url(name)
                print(f"Resolved {name!r} → {full_id}")
                print(f"  URL: {url}")
            except ValueError as e:
                print(f"Error: {e}", file=sys.stderr)
                sys.exit(1)

        regions = [{"name": name, "url": url}]

        # Append to regions.json so future `just build` includes it.
        raw_name = name[: -len("-latest")] if name.endswith("-latest") else name
        if args.regions_file.exists():
            with open(args.regions_file) as f:
                existing = json.load(f)
            existing_raw = {
                r["name"][: -len("-latest")] if r["name"].endswith("-latest") else r["name"]
                for r in existing
            }
            if raw_name not in existing_raw:
                existing.append({"name": name, "url": url})
                with open(args.regions_file, "w") as f:
                    json.dump(existing, f, indent=2)
                print(f"Added {name!r} to {args.regions_file}")
    else:
        if not args.regions_file.exists():
            print(f"Error: regions file not found: {args.regions_file}")
            print("Create preprocessing/regions.json or pass --regions-file <path>.")
            sys.exit(1)

        with open(args.regions_file) as f:
            regions = json.load(f)

        if not regions:
            print("Error: regions file is empty.")
            sys.exit(1)

    # Extra environment for step_3 (tileset config path)
    step3_env = {}
    if args.tileset_config:
        step3_env["TILESET_CONFIG_PATH"] = str(args.tileset_config)

    # ── Step 0: land polygons (once) ─────────────────────────────────────────
    print("=" * 70)
    print("Staggered build: downloading shared land polygons")
    print("=" * 70)
    land_args = [
        "--land-polygons-only",
        "--data-dir", str(args.data_dir),
    ]
    if args.land_polygon_url:
        land_args += ["--land-polygon-url", args.land_polygon_url]
    run(SCRIPTS_DIR / "step_1_download.py", land_args)

    # ── Per-region loop ───────────────────────────────────────────────────────
    for i, region in enumerate(regions):
        name: str = region["name"]
        url: str  = region["url"]

        # Normalise: strip any trailing "-latest" the caller may have included
        raw_name = name[: -len("-latest")] if name.endswith("-latest") else name
        pbf_name = f"{raw_name}-latest"

        print()
        print("=" * 70)
        print(f"Region {i + 1}/{len(regions)}: {pbf_name}")
        print("=" * 70)

        # ── a) Download PBF ───────────────────────────────────────────────────
        run(SCRIPTS_DIR / "step_1_download.py", [
            "--add-region", name, url,
            "--data-dir", str(args.data_dir),
        ])

        # ── b) Convert PBF → GeoJSON ──────────────────────────────────────────
        pbf_path     = args.data_dir / f"{pbf_name}.osm.pbf"
        geojson_path = args.data_dir / pbf_name / f"{pbf_name}.osm.geojson"

        run(SCRIPTS_DIR / "step_2_convert_to_geojson.py", [
            str(pbf_path),
            "--data-dir", str(args.data_dir),
            "-j", str(args.jobs),
        ])

        # ── c) Generate / update tiles ────────────────────────────────────────
        # Use --update if the region already exists in regions.json (faster:
        # only affected tiles are deleted and rewritten).  Fall back to --add
        # on first run or if regions.json is missing.
        regions_json = args.tiles_dir / "regions.json"
        use_update = False
        if regions_json.exists():
            try:
                with open(regions_json) as f:
                    existing = json.load(f)
                use_update = raw_name in existing.get("regions", {})
            except Exception:
                pass

        if use_update:
            step3_args = ["--update", raw_name]
        else:
            step3_args = ["--add", str(geojson_path)]

        step3_args += [
            "--data-dir",   str(args.data_dir),
            "--output-dir", str(args.tiles_dir),
            "-j",           str(args.jobs),
        ]
        run(SCRIPTS_DIR / "step_3_generate_tiles.py", step3_args, extra_env=step3_env)

        # ── d) Gap before next region ─────────────────────────────────────────
        if args.gap_seconds > 0 and i < len(regions) - 1:
            next_name = regions[i + 1]["name"]
            print(f"\nSleeping {args.gap_seconds}s before {next_name}…")
            time.sleep(args.gap_seconds)

    print()
    print("=" * 70)
    print(f"Staggered build complete — {len(regions)} region(s) processed.")
    print("=" * 70)


if __name__ == "__main__":
    main()

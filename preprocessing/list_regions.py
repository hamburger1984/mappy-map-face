#!/usr/bin/env python3
"""
List OSM regions: local (with build status) or remote (from Geofabrik).

Usage:
  python list_regions.py               # local regions + PBF/GeoJSON/tile status
  python list_regions.py --remote      # all Geofabrik regions
  python list_regions.py --remote germany  # filter remote list by query
"""

import argparse
import json
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def list_local(data_dir: Path, tiles_dir: Path) -> None:
    regions_file = SCRIPTS_DIR / "regions.json"
    if not regions_file.exists():
        print("No preprocessing/regions.json found.")
        print("Run `just add-region <name>` to add your first region.")
        return

    with open(regions_file) as f:
        regions = json.load(f)

    if not regions:
        print("regions.json is empty.")
        return

    regions = sorted(regions, key=lambda r: r["name"].lower())

    # Load tiled-region manifest from the live tile output
    tiled: set[str] = set()
    tiles_manifest = tiles_dir / "regions.json"
    if tiles_manifest.exists():
        try:
            with open(tiles_manifest) as f:
                tiled = set(json.load(f).get("regions", {}).keys())
        except Exception:
            pass

    RED    = "\033[31m"
    ORANGE = "\033[33m"
    RESET  = "\033[0m"
    TEN_DAYS  = 10 * 24 * 3600
    FOUR_DAYS =  4 * 24 * 3600

    def check(path: Path) -> str:
        if not path.exists():
            return "·"
        age = time.time() - path.stat().st_mtime
        if age > TEN_DAYS:
            return f"{RED}✓{RESET}"
        if age > FOUR_DAYS:
            return f"{ORANGE}✓{RESET}"
        return "✓"

    def center(mark: str, width: int) -> str:
        """Center mark in field, ignoring invisible ANSI escape bytes."""
        visible = mark if "\033" not in mark else "✓"
        pad = width - len(visible)
        left = pad // 2
        right = pad - left
        return " " * left + mark + " " * right

    header = f"{'Region':<35} {'PBF':^5} {'GeoJSON':^7} {'Tiled':^5}"
    print(header)
    print("-" * len(header))

    for region in regions:
        name = region["name"]
        raw  = name[: -len("-latest")] if name.endswith("-latest") else name
        pbf  = f"{raw}-latest"

        pbf_mark     = check(data_dir / f"{pbf}.osm.pbf")
        geojson_mark = check(data_dir / pbf / f"{pbf}.osm.geojson")
        tiled_mark   = "✓" if raw in tiled else "·"

        print(
            f"{name:<35} "
            f"{center(pbf_mark, 5)} "
            f"{center(geojson_mark, 7)} "
            f"{center(tiled_mark, 5)}"
        )

    print(f"\n{len(regions)} region(s) in preprocessing/regions.json")


def list_remote(query: str | None = None) -> None:
    import geofabrik

    try:
        regions = geofabrik.all_regions()
    except Exception as e:
        print(f"Error fetching Geofabrik index: {e}", file=sys.stderr)
        sys.exit(1)

    if query:
        q = query.lower()
        regions = [r for r in regions if q in r["id"] or q in r["name"].lower()]

    if not regions:
        print(f"No regions found matching {query!r}.")
        return

    col = 55
    print(f"{'Geofabrik id':<{col}} Name")
    print("-" * (col + 30))
    for r in regions:
        print(f"{r['id']:<{col}} {r['name']}")

    print(f"\n{len(regions)} region(s) found")
    if not query:
        print("Tip: filter with `just list-regions-remote <query>`")
    print("Use the Geofabrik id (or just the last segment) with `just add-region`.")


def main() -> None:
    parser = argparse.ArgumentParser(description="List OSM regions")
    parser.add_argument(
        "--remote",
        action="store_true",
        help="List available Geofabrik regions instead of local ones",
    )
    parser.add_argument(
        "query",
        nargs="?",
        default=None,
        help="Filter query for --remote mode (substring match on id or name)",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=SCRIPTS_DIR / "data",
    )
    parser.add_argument(
        "--tiles-dir",
        type=Path,
        default=Path("public/tiles"),
    )
    args = parser.parse_args()

    if args.remote:
        list_remote(args.query)
    else:
        list_local(args.data_dir, args.tiles_dir)


if __name__ == "__main__":
    main()

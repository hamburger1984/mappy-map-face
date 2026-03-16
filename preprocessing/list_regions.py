#!/usr/bin/env python3
"""
List OSM regions: local (with build status) or remote (from Geofabrik).

Usage:
  python list_regions.py               # local regions + PBF/GeoJSON/tile status
  python list_regions.py --remote      # all Geofabrik regions
  python list_regions.py --remote germany  # filter remote list by query
"""

import argparse
import datetime
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

    def country_group(region: dict) -> str:
        """Extract country/group name from the Geofabrik URL.

        europe/germany/hamburg → 'germany'
        europe/denmark         → 'denmark'
        """
        from urllib.parse import urlparse
        parts = urlparse(region.get("url", "")).path.strip("/").split("/")
        # parts: ['europe', 'germany', 'hamburg-latest.osm.pbf']
        # or:    ['europe', 'denmark-latest.osm.pbf']
        # Remove filename (last element) and continent (first element)
        middle = parts[1:-1]
        if middle:
            return middle[-1]
        # No sub-country: the region is its own country; strip '-latest.osm.pbf'
        filename = parts[-1].replace("-latest.osm.pbf", "").replace("-latest.osm", "")
        return region.get("name", filename)

    regions = sorted(regions, key=lambda r: (country_group(r), r["name"].lower()))

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
    GREEN  = "\033[32m"
    ORANGE = "\033[33m"
    RESET  = "\033[0m"
    TEN_DAYS  = 10 * 24 * 3600
    FOUR_DAYS =  4 * 24 * 3600

    def age_str(seconds: float) -> str:
        if seconds < 3600:
            return f"{int(seconds // 60)}m"
        if seconds < 86400:
            return f"{int(seconds // 3600)}h"
        if seconds < 7 * 86400:
            return f"{int(seconds // 86400)}d"
        if seconds < 30 * 86400:
            return f"{int(seconds // (7 * 86400))}w"
        dt = datetime.datetime.fromtimestamp(time.time() - seconds)
        return dt.strftime("%-d %b")

    def check(path: Path) -> str:
        if not path.exists():
            return "·"
        age = time.time() - path.stat().st_mtime
        if age > TEN_DAYS:
            return f"{RED}✓{RESET}"
        if age > FOUR_DAYS:
            return f"{ORANGE}✓{RESET}"
        return "✓"

    def tiled_check(path: Path) -> str:
        if not path.exists():
            return "·"
        age = time.time() - path.stat().st_mtime
        label = age_str(age)
        if age > TEN_DAYS:
            return f"{RED}{label}{RESET}"
        if age > FOUR_DAYS:
            return f"{ORANGE}{label}{RESET}"
        return f"{GREEN}{label}{RESET}"

    def center(mark: str, width: int) -> str:
        """Center mark in field, ignoring invisible ANSI escape bytes."""
        # Strip ANSI to measure visible length
        import re
        visible = re.sub(r"\033\[[0-9;]*m", "", mark)
        pad = width - len(visible)
        left = pad // 2
        right = pad - left
        return " " * left + mark + " " * right

    # Pre-group regions so we know which countries have multiple entries
    from itertools import groupby
    grouped = {
        g: list(members)
        for g, members in groupby(regions, key=country_group)
    }

    def row(region: dict, indent: int) -> None:
        name = region["name"]
        raw  = name[: -len("-latest")] if name.endswith("-latest") else name
        pbf  = f"{raw}-latest"
        pbf_mark     = check(data_dir / f"{pbf}.osm.pbf")
        geojson_mark = check(data_dir / pbf / f"{pbf}.osm.geojson")
        tile_index   = tiles_dir / "regions" / f"{raw}.tiles.json.gz"
        tiled_mark   = tiled_check(tile_index) if raw in tiled else "·"
        pad = " " * indent
        print(
            f"{pad}{name:<{COL_WIDTH - indent}} "
            f"{center(pbf_mark, 5)} "
            f"{center(geojson_mark, 7)} "
            f"{center(tiled_mark, 8)}"
        )

    COL_WIDTH = 55
    header = f"{'Region':<{COL_WIDTH}} {'PBF':^5} {'GeoJSON':^7} {'Tiled':^8}"
    print(header)
    print("-" * len(header))

    first = True
    for group, members in grouped.items():
        # Single region whose name == country: flat line, no group header
        if len(members) == 1 and members[0]["name"] == group:
            if not first:
                print()
            row(members[0], indent=2)
        else:
            if not first:
                print()
            print(f"  [{group}]")
            for region in members:
                row(region, indent=4)
        first = False

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

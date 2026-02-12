#!/usr/bin/env python3
"""
Main script to run all preprocessing steps in sequence.

Steps:
1. Download OSM data and land polygons
2. Convert PBF files to GeoJSON
3. Generate map tiles

Each step can be run independently or all together.
"""

import argparse
import subprocess
import sys
from pathlib import Path


def run_step(script_name, args=None):
    """Run a preprocessing step script."""
    script_path = Path(__file__).parent / script_name
    cmd = [sys.executable, str(script_path)]
    if args:
        cmd.extend(args)

    result = subprocess.run(cmd)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(
        description="Run all preprocessing steps to build map tiles",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--step",
        type=int,
        choices=[1, 2, 3],
        help="Run only a specific step (1=download, 2=convert, 3=generate)",
    )
    parser.add_argument(
        "-j", "--jobs", type=int, default=3, help="Number of parallel workers"
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent / "data",
        help="Directory for data files",
    )

    args = parser.parse_args()

    # Determine which steps to run
    if args.step:
        steps = [args.step]
    else:
        steps = [1, 2, 3]

    print()
    print("=" * 70)
    print("OSM Map Renderer - Tile Builder")
    print("=" * 70)
    print(f"Running steps: {', '.join(map(str, steps))}")
    print(f"Parallel workers: {args.jobs}")
    print("=" * 70)
    print()

    success = True

    # Step 1: Download
    if 1 in steps:
        step_args = ["--data-dir", str(args.data_dir), "-j", str(args.jobs)]

        if not run_step("step_1_download.py", step_args):
            print("\n✗ Step 1 failed")
            success = False
            if len(steps) > 1:
                sys.exit(1)

    # Step 2: Convert
    if 2 in steps and success:
        step_args = ["--data-dir", str(args.data_dir), "-j", str(args.jobs)]

        if not run_step("step_2_convert_to_geojson.py", step_args):
            print("\n✗ Step 2 failed")
            success = False
            if len(steps) > 1:
                sys.exit(1)

    # Step 3: Generate tiles
    if 3 in steps and success:
        step_args = ["--data-dir", str(args.data_dir), "-j", str(args.jobs)]

        if not run_step("step_3_generate_tiles.py", step_args):
            print("\n✗ Step 3 failed")
            success = False

    if success:
        print()
        print("=" * 70)
        print("✓ All preprocessing steps completed successfully!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("  - Run 'just serve' to start the map viewer")
        print("  - Or run 'npm run dev' from the project root")
        print()
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Export tileset configuration from YAML to JSON for browser consumption.

This script reads tileset_config.yaml and extracts only the information
needed by the browser renderer, outputting a minimal JSON file.
"""

import json
import os

import yaml


def main():
    # Path to config files
    config_path = os.path.join(os.path.dirname(__file__), "..", "tileset_config.yaml")
    output_path = os.path.join(
        os.path.dirname(__file__), "..", "public", "tileset_config.json"
    )

    # Load YAML config
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    # Extract only what renderer needs
    renderer_config = {
        "tilesets": [
            {
                "id": ts["id"],
                "name": ts["name"],
                "view_range_meters": ts["view_range_meters"],
                "tile_size_meters": ts["tile_size_meters"],
            }
            for ts in config["tilesets"]
        ]
    }

    # Write JSON output
    with open(output_path, "w") as f:
        json.dump(renderer_config, f, indent=2)

    print(f"✓ Exported tileset config to {output_path}")
    print(f"  {len(renderer_config['tilesets'])} tilesets configured")

    # Print summary
    for ts in renderer_config["tilesets"]:
        view_min, view_max = ts["view_range_meters"]
        view_min_km = view_min / 1000
        view_max_km = view_max / 1000
        tile_km = ts["tile_size_meters"] / 1000
        print(
            f"  - {ts['id']}: {view_min_km:.1f}-{view_max_km:.0f}km view → {tile_km:.1f}km tiles"
        )


if __name__ == "__main__":
    main()

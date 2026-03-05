"""Geofabrik region index utilities — URL lookup and region listing."""

import json
import time
import urllib.request
from pathlib import Path

INDEX_URL = "https://download.geofabrik.de/index-v1-nogeom.json"
CACHE_FILE = Path(__file__).parent / ".geofabrik_cache.json"
CACHE_MAX_AGE_DAYS = 1


def fetch_index(use_cache: bool = True) -> dict:
    """Return the Geofabrik region index, using a local cache when fresh."""
    if use_cache and CACHE_FILE.exists():
        age_days = (time.time() - CACHE_FILE.stat().st_mtime) / 86400
        if age_days < CACHE_MAX_AGE_DAYS:
            with open(CACHE_FILE) as f:
                return json.load(f)

    print(f"Fetching Geofabrik index from {INDEX_URL} …")
    with urllib.request.urlopen(INDEX_URL, timeout=15) as resp:
        data = json.load(resp)

    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)

    return data


def all_regions(use_cache: bool = True) -> list[dict]:
    """Return all regions from the Geofabrik index, sorted by id."""
    data = fetch_index(use_cache)
    regions = []
    for feature in data["features"]:
        props = feature["properties"]
        urls = props.get("urls", {})
        pbf_url = urls.get("pbf")
        if not pbf_url:
            continue
        regions.append({
            "id":     props["id"],
            "name":   props["name"],
            "parent": props.get("parent", ""),
            "url":    pbf_url,
        })
    return sorted(regions, key=lambda r: r["id"])


def lookup_url(name: str, use_cache: bool = True) -> tuple[str, str]:
    """
    Find the PBF download URL for a region by its short name.

    Matches against the last segment of each region's id (e.g. "hamburg" matches
    "europe/germany/hamburg").  Returns (url, full_id) on unambiguous match;
    raises ValueError with suggestions on no match or multiple matches.
    """
    raw = name[: -len("-latest")] if name.endswith("-latest") else name
    raw_lower = raw.lower()

    regions = all_regions(use_cache)
    exact = [r for r in regions if r["id"].split("/")[-1] == raw_lower]

    if len(exact) == 1:
        return exact[0]["url"], exact[0]["id"]

    if len(exact) > 1:
        candidates = "\n".join(f"  {r['id']}" for r in exact)
        raise ValueError(
            f"Ambiguous name {name!r} — multiple regions match:\n{candidates}\n"
            f"Pass the full id (e.g. just add-region europe/germany/hamburg) or "
            f"provide the URL explicitly."
        )

    # Fall back to substring match for a helpful error
    fuzzy = [r for r in regions if raw_lower in r["id"]]
    hint = (
        "\nDid you mean one of:\n" + "\n".join(f"  {r['id']}" for r in fuzzy[:10])
        if fuzzy
        else ""
    )
    raise ValueError(f"No Geofabrik region found matching {name!r}.{hint}")

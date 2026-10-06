#!/usr/bin/env python3
"""
Staggered region build: process due regions one at a time, oldest first.

Flow:
  1. Take an exclusive lock so two runs never overlap.
  2. Download global land polygons (once, shared across all regions).
  3. Decide which regions are due: tiles missing or older than
     --max-tile-age, *and* something new to render since the last
     successful render (upstream extract version, tileset config, or a
     local PBF newer than the last render).  Fresh regions are skipped
     without any network access.
  4. Process due regions oldest-first: download PBF → convert → update
     tiles → record the rendered extract version in a state file.

A run stops cleanly when --time-budget / --max-regions is exhausted or
when SIGTERM/SIGINT arrives (systemctl stop, shutdown, Ctrl-C).  Nothing
is lost: the next run resumes where this one left off, because completed
regions are skipped by the freshness check.  A failing region is logged
and skipped instead of aborting the rest of the run.
"""

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

from progress import is_interactive


SCRIPTS_DIR = Path(__file__).parent

# Set by the signal handler, checked between regions and steps.
STOP_REQUESTED = False

# How long a terminating child gets to exit before it is SIGKILLed.
STOP_TIMEOUT = 20.0

STATE_SUFFIX = ".render-state.json"
LOCK_NAME = ".run_staggered.lock"

# Temporary directories left behind by an interrupted step_3 run.
STAGING_PREFIXES = (
    ".regen_staging_",
    "tiles_add_",
    "tiles_stage_",
    "tiles_live_",
    "tiles_build_",
)


class StopRequested(Exception):
    """Termination requested — abandon the current region and exit cleanly."""


class StepFailed(Exception):
    """A pipeline step exited non-zero."""

    def __init__(self, step: str, returncode: int):
        super().__init__(f"{step} exited with status {returncode}")
        self.step = step
        self.returncode = returncode


def _log(msg: str) -> None:
    if is_interactive():
        print(msg)
    else:
        print(f"[run_staggered] {msg}", flush=True)


# ── Signals / child process control ─────────────────────────────────────────

def _handle_signal(signum, frame) -> None:
    global STOP_REQUESTED
    if STOP_REQUESTED:
        # Second signal: don't wait for the graceful path.
        signal.signal(signum, signal.SIG_DFL)
        os.kill(os.getpid(), signum)
        return
    STOP_REQUESTED = True
    name = signal.Signals(signum).name
    _log(f"{name} received — finishing the current step, then stopping ({name} again to force)")


def _install_signal_handlers() -> None:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)


def _check_stop() -> None:
    if STOP_REQUESTED:
        raise StopRequested()


def _terminate(proc: subprocess.Popen) -> None:
    """SIGTERM the child's process group, escalating to SIGKILL."""
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=STOP_TIMEOUT)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()


def run(script: Path, args: list[str], extra_env: dict | None = None) -> None:
    """Run a sibling preprocessing script in its own process group.

    Waits up to one second at a time so a stop request can terminate the
    whole process group (including multiprocessing workers) promptly.
    """
    _check_stop()
    env = {**os.environ, **(extra_env or {})}
    proc = subprocess.Popen(
        [sys.executable, str(script), *args],
        env=env,
        start_new_session=True,
    )
    while True:
        try:
            returncode = proc.wait(timeout=1.0)
            break
        except subprocess.TimeoutExpired:
            if STOP_REQUESTED:
                _log(f"  stopping {script.name} ...")
                _terminate(proc)
                raise StopRequested()
    if returncode != 0:
        raise StepFailed(script.name, returncode)


def _sleep(seconds: float) -> None:
    """Sleep in short slices so stop requests are noticed."""
    deadline = time.monotonic() + seconds
    while True:
        _check_stop()
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        time.sleep(min(0.5, remaining))


# ── Locking ─────────────────────────────────────────────────────────────────

def acquire_lock(data_dir: Path):
    """Hold an exclusive flock for the lifetime of this run.

    Returns the open fd, or None when another run already holds the lock.
    """
    data_dir.mkdir(parents=True, exist_ok=True)
    lock_path = data_dir / LOCK_NAME
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(fd)
        return None
    os.ftruncate(fd, 0)
    os.write(fd, f"{os.getpid()}\n".encode())
    return fd


# ── Staging cleanup ─────────────────────────────────────────────────────────

def cleanup_staging(tiles_dir: Path, data_dir: Path) -> None:
    """Remove temp dirs/files left behind by an interrupted run."""
    removed = 0
    for parent in {tiles_dir.parent, data_dir}:
        if not parent.is_dir():
            continue
        for prefix in STAGING_PREFIXES:
            for path in parent.glob(prefix + "*"):
                if path.is_dir():
                    shutil.rmtree(path, ignore_errors=True)
                    removed += 1
        for pattern in ("*.partial.geojson", "*/*.partial.geojson"):
            for path in parent.glob(pattern):
                try:
                    path.unlink()
                    removed += 1
                except OSError:
                    pass
    if removed:
        _log(f"removed {removed} leftover temp item(s) from an interrupted run")


# ── Per-region state ────────────────────────────────────────────────────────

def tile_index_path(tiles_dir: Path, raw_name: str) -> Path:
    return tiles_dir / "regions" / f"{raw_name}.tiles.json.gz"


def load_state(data_dir: Path, raw_name: str) -> dict | None:
    path = data_dir / f"{raw_name}{STATE_SUFFIX}"
    try:
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def save_state(data_dir: Path, raw_name: str, extract: str, config_hash: str) -> None:
    """Atomically record what we just rendered (success marker)."""
    path = data_dir / f"{raw_name}{STATE_SUFFIX}"
    tmp = Path(str(path) + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(
            {
                "extract": extract,
                "config_hash": config_hash,
                "rendered_at": time.time(),
            },
            f,
            indent=2,
        )
    os.replace(tmp, path)


def read_src_version(pbf_path: Path) -> str | None:
    """Upstream version recorded by step_1 next to a downloaded PBF."""
    from step_1_download import read_src_version as _read  # local import: only needed when probing

    return _read(pbf_path)


def upstream_extract(url: str) -> str | None:
    """Cheap HEAD request → version identifier of the current upstream extract.

    Geofabrik serves `-latest.osm.pbf` as a redirect to a dated file
    (`hamburg-261004.osm.pbf`), which makes a great version identifier.
    Returns None when the probe fails (offline, server without HEAD, ...).
    """
    from step_1_download import probe_remote  # local import: only needed when probing

    probe = probe_remote(url)
    return probe["version"] if probe else None


def region_due(
    *,
    tile_index: Path,
    pbf_path: Path,
    max_age_days: int,
    state: dict | None,
    config_hash: str,
    probe,
    now: float | None = None,
) -> tuple[bool, str]:
    """Decide whether a region needs a rebuild, and say why.

    `probe` is a zero-argument callable returning the upstream extract
    version (or None); it is only called once the cheap age check says the
    region is old enough to consider, so fresh regions never hit the network.
    """
    now = time.time() if now is None else now

    if max_age_days <= 0:
        return True, f"--max-tile-age {max_age_days} forces a rebuild"

    if not tile_index.exists():
        return True, "no tiles yet"

    age_days = (now - tile_index.stat().st_mtime) / 86400
    if age_days < max_age_days:
        return False, f"tiles are {age_days:.1f}d old (< {max_age_days}d)"

    # Past the refresh interval — only rebuild when something actually changed.
    if state is None:
        return True, "no render record yet"

    if config_hash and state.get("config_hash") and state["config_hash"] != config_hash:
        return True, "tileset config changed since last render"

    if pbf_path.exists() and pbf_path.stat().st_mtime > state.get("rendered_at", 0) + 1:
        return True, "local PBF is newer than the last render"

    extract = probe()
    if extract is None:
        # Can't tell — behave like the old age-based policy.
        return True, "upstream version unknown (HEAD probe failed)"

    if not state.get("extract"):
        return True, "last render has no recorded upstream version"

    if state["extract"] != extract:
        return True, f"upstream extract changed ({state['extract']} → {extract})"

    return False, f"upstream extract unchanged since last render ({age_days:.1f}d old)"


# ── Per-region pipeline ─────────────────────────────────────────────────────

def process_region(
    args,
    *,
    name: str,
    url: str,
    raw_name: str,
    pbf_name: str,
    known_extract: str | None,
    config_hash: str,
    step3_env: dict,
) -> None:
    """Download, convert and render one region, then record success.

    Raises StepFailed / StopRequested; any other exception is treated as a
    per-region failure by the caller.
    """
    pbf_path     = args.data_dir / f"{pbf_name}.osm.pbf"
    geojson_path = args.data_dir / pbf_name / f"{pbf_name}.osm.geojson"
    tile_index   = tile_index_path(args.tiles_dir, raw_name)

    # ── a) Download PBF ───────────────────────────────────────────────────────
    run(SCRIPTS_DIR / "step_1_download.py", [
        "--add-region", name, url,
        "--data-dir", str(args.data_dir),
        "--max-file-age", str(args.max_tile_age),
    ])

    # Version we are about to render: prefer step_1's record, else our own probe.
    extract = known_extract or read_src_version(pbf_path) or upstream_extract(url) or ""

    # ── b) Convert PBF → GeoJSON ──────────────────────────────────────────────
    run(SCRIPTS_DIR / "step_2_convert_to_geojson.py", [
        str(pbf_path),
        "--data-dir", str(args.data_dir),
        "-j", str(args.jobs),
    ])

    # ── c) Generate / update tiles ────────────────────────────────────────────
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

    # ── d) Clean up GeoJSON (can be re-generated from PBF if needed) ──────────
    if geojson_path.exists():
        size_mb = geojson_path.stat().st_size / (1024 * 1024)
        geojson_path.unlink()
        _log(f"  Cleaned up GeoJSON ({size_mb:.0f} MB)")

    # ── e) Success marker: what we just rendered ──────────────────────────────
    save_state(args.data_dir, raw_name, extract, config_hash)
    if tile_index.exists():
        age = (time.time() - tile_index.stat().st_mtime) / 86400
        _log(f"  Rendered {pbf_name} (extract {extract or 'unknown'}, tiles {age:.1f}d)")


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    global STOP_TIMEOUT

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
        "--max-tile-age",
        type=int,
        default=14,
        metavar="DAYS",
        help="Minimum age in days before a region may be rebuilt. Regions older than "
             "this are rebuilt only when upstream data or the tileset config actually "
             "changed. Set to 0 to always rebuild.",
    )
    parser.add_argument(
        "--time-budget",
        type=int,
        default=0,
        metavar="SECONDS",
        help="Stop starting new regions once this many seconds have elapsed; remaining "
             "due regions are picked up by the next run. 0 = no budget.",
    )
    parser.add_argument(
        "--max-regions",
        type=int,
        default=0,
        metavar="N",
        help="Stop after processing N regions in this run. 0 = no limit.",
    )
    parser.add_argument(
        "--stop-timeout",
        type=float,
        default=20.0,
        metavar="SECONDS",
        help="Grace period for child processes to exit after a stop request.",
    )
    parser.add_argument(
        "-j", "--jobs",
        type=int,
        default=4,
        help="Parallel workers passed to conversion and tile generation steps.",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="NAME",
        help="Limit processing to these region names (subset of regions.json). "
             "Matches on the short name with or without the -latest suffix.",
    )
    args = parser.parse_args()

    STOP_TIMEOUT = max(1.0, float(args.stop_timeout))
    _install_signal_handlers()

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
            raw = re.sub(r"/\*.*?\*/", "", f.read(), flags=re.DOTALL)
        raw = re.sub(r",\s*([}\]])", r"\1", raw)  # strip trailing commas
        regions = [r for r in json.loads(raw) if r.get("enabled", True)]

        if not regions:
            print("Error: regions file is empty.")
            sys.exit(1)

        if args.only:
            only_raw = {
                n[: -len("-latest")] if n.endswith("-latest") else n
                for n in args.only
            }
            regions = [
                r for r in regions
                if (r["name"][: -len("-latest")] if r["name"].endswith("-latest") else r["name"])
                in only_raw
            ]
            if not regions:
                print(f"Error: none of {args.only} matched any region in {args.regions_file}.")
                sys.exit(1)

    # Extra environment for step_3 (tileset config path)
    step3_env = {}
    if args.tileset_config:
        step3_env["TILESET_CONFIG_PATH"] = str(args.tileset_config)

    config_hash = ""
    if args.tileset_config and Path(args.tileset_config).exists():
        config_hash = hashlib.sha256(Path(args.tileset_config).read_bytes()).hexdigest()[:32]

    # Only one build at a time (timer-driven and manual runs share the data dir).
    lock_fd = acquire_lock(args.data_dir)
    if lock_fd is None:
        _log("another build is already running — exiting.")
        sys.exit(0)

    failures: list[str] = []
    try:
        failures = build(args, regions, config_hash, step3_env)
    except StopRequested:
        cleanup_staging(args.tiles_dir, args.data_dir)
        _log("Stopped. Completed regions are up to date; the rest resume on the next run.")
        sys.exit(0)
    except StepFailed as e:
        cleanup_staging(args.tiles_dir, args.data_dir)
        _log(f"Fatal: {e}")
        sys.exit(1)

    if failures:
        _log(f"Finished with {len(failures)} failed region(s): {', '.join(failures)}")
        sys.exit(1)


def build(args, regions: list[dict], config_hash: str, step3_env: dict) -> list[str]:
    failures: list[str] = []
    started = time.monotonic()

    # Remove temp dirs/files left behind by an interrupted previous run.
    cleanup_staging(args.tiles_dir, args.data_dir)

    # ── Step 0: land polygons (once) ─────────────────────────────────────────
    _log("Staggered build: downloading shared land polygons")
    land_args = [
        "--land-polygons-only",
        "--data-dir", str(args.data_dir),
        "--max-file-age", str(args.max_tile_age),
    ]
    if args.land_polygon_url:
        land_args += ["--land-polygon-url", str(args.land_polygon_url)]
    run(SCRIPTS_DIR / "step_1_download.py", land_args)

    # ── Which regions are due? (oldest first, so runs stay balanced) ─────────
    candidates = []
    for i, region in enumerate(regions):
        _check_stop()
        name: str = region["name"]
        url: str  = region["url"]

        # Normalise: strip any trailing "-latest" the caller may have included
        raw_name = name[: -len("-latest")] if name.endswith("-latest") else name
        pbf_name = f"{raw_name}-latest"

        pbf_path   = args.data_dir / f"{pbf_name}.osm.pbf"
        tile_index = tile_index_path(args.tiles_dir, raw_name)

        # Probe lazily: region_due() only calls this once the age check says
        # the region is old enough to consider, and we keep the result so a
        # due region does not need a second HEAD later on.
        probed: list[str | None] = []

        def probe(u=url, out=probed) -> str | None:
            if not out:
                out.append(upstream_extract(u))
            return out[0]

        if args.add_region:
            due, reason = True, "explicitly requested (--add-region)"
        else:
            state = load_state(args.data_dir, raw_name)
            due, reason = region_due(
                tile_index=tile_index,
                pbf_path=pbf_path,
                max_age_days=args.max_tile_age,
                state=state,
                config_hash=config_hash,
                probe=probe,
            )

        status = "" if due else " — skipping"
        _log(f"  {pbf_name}: {reason}{status}")
        if due:
            mtime = tile_index.stat().st_mtime if tile_index.exists() else 0.0
            candidates.append({
                "region": region,
                "name": name,
                "url": url,
                "raw_name": raw_name,
                "pbf_name": pbf_name,
                "extract": probed[0] if probed else None,
                "sort_key": mtime,
            })

    candidates.sort(key=lambda c: c["sort_key"])
    total = len(candidates)

    budget = f", time budget {args.time_budget}s" if args.time_budget else ""
    limit  = f", max {args.max_regions} region(s)/run" if args.max_regions else ""
    _log(f"{total} region(s) due, oldest first{budget}{limit}")

    # ── Per-region loop ───────────────────────────────────────────────────────
    for index, item in enumerate(candidates, start=1):
        _check_stop()
        if args.max_regions and (index - 1) >= args.max_regions:
            _log(f"Reached --max-regions {args.max_regions} — {total - index + 1} due region(s) left for the next run.")
            break
        if args.time_budget and (time.monotonic() - started) > args.time_budget:
            _log(f"Reached --time-budget {args.time_budget}s — {total - index + 1} due region(s) left for the next run.")
            break

        raw_name = item["raw_name"]
        _log(f"Region {index}/{total}: {item['pbf_name']}")

        try:
            process_region(
                args,
                name=item["name"],
                url=item["url"],
                raw_name=raw_name,
                pbf_name=item["pbf_name"],
                known_extract=item.get("extract"),
                config_hash=config_hash,
                step3_env=step3_env,
            )
        except StopRequested:
            raise
        except StepFailed as e:
            failures.append(item["pbf_name"])
            _log(f"  FAILED {item['pbf_name']}: {e}")
            _log("  Continuing with the next region.")
        except Exception as e:  # noqa: BLE001 — one bad region must not abort the run
            failures.append(item["pbf_name"])
            _log(f"  FAILED {item['pbf_name']}: {type(e).__name__}: {e}")
            _log("  Continuing with the next region.")

        # ── Gap before next region ───────────────────────────────────────────
        if args.gap_seconds > 0 and index < total:
            _log(f"Sleeping {args.gap_seconds}s before the next region...")
            try:
                _sleep(args.gap_seconds)
            except StopRequested:
                raise

    elapsed = time.monotonic() - started
    _log(f"Staggered build done in {elapsed / 60:.1f} min — {len(candidates)} due, "
         f"{len(failures)} failed.")
    return failures


if __name__ == "__main__":
    main()

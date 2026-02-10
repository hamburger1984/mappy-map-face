#!/usr/bin/env python3
"""
Add optimized indices to existing tile databases.
Run this to upgrade databases without re-importing data.
"""

import sqlite3
import sys
from pathlib import Path


def reindex_database(db_path):
    """Drop old index and create optimized index."""
    print(f"Reindexing {db_path.name}...")

    conn = sqlite3.connect(str(db_path))

    # Drop old index if it exists
    try:
        conn.execute("DROP INDEX IF EXISTS idx_tile")
        print("  Dropped old index")
    except sqlite3.Error as e:
        print(f"  Warning dropping old index: {e}")

    # Create optimized index with importance DESC
    print("  Creating optimized index (x, y, importance DESC)...")
    conn.execute("CREATE INDEX idx_tile ON tile_features (x, y, importance DESC)")
    conn.commit()

    # Analyze for query planner
    print("  Running ANALYZE...")
    conn.execute("ANALYZE")
    conn.commit()

    conn.close()
    print(f"  ✓ {db_path.name} reindexed")


def main():
    preprocessing_dir = Path(__file__).parent
    data_dir = preprocessing_dir / "data"

    # Find all tile_*.db files in data subdirectory
    db_files = list(data_dir.glob("tile_*.db"))

    if not db_files:
        print("No tile_*.db files found in preprocessing directory")
        return 1

    print(f"Found {len(db_files)} database(s) to reindex:")
    for db_file in sorted(db_files):
        print(f"  - {db_file.name}")
    print()

    for db_file in sorted(db_files):
        try:
            reindex_database(db_file)
        except Exception as e:
            print(f"  ✗ Error reindexing {db_file.name}: {e}")
            return 1

    print(f"\n✓ Successfully reindexed {len(db_files)} database(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

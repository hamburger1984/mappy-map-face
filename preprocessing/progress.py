"""Shared helper for interactive vs. non-interactive (log-stream) output."""

import sys

# Evaluated once at import time so worker sub-processes pick up the right value.
INTERACTIVE = sys.stdout.isatty()


def is_interactive() -> bool:
    return INTERACTIVE

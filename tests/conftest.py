"""Pytest environment setup for SCFCA tests."""

from __future__ import annotations

import os


def _valid_bool(value: str | None) -> bool:
    return value is None or value.lower() in {"0", "1", "true", "false", "yes", "no", "on", "off"}


if not _valid_bool(os.environ.get("DEBUG")):
    os.environ["DEBUG"] = "false"

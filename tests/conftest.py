"""Pytest environment setup for SCFCA tests."""

from __future__ import annotations

import os

import pytest

from backend.auth.login_throttle import clear_login_throttle_state


def _valid_bool(value: str | None) -> bool:
    return value is None or value.lower() in {"0", "1", "true", "false", "yes", "no", "on", "off"}


if not _valid_bool(os.environ.get("DEBUG")):
    os.environ["DEBUG"] = "false"


@pytest.fixture(autouse=True)
def _clear_login_throttle_state():
    clear_login_throttle_state()
    yield
    clear_login_throttle_state()

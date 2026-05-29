"""In-memory login throttling for the SCFCA PoC.

This module intentionally scopes throttling to failed login attempts only.
It is process-local and suitable for tests/demo use, not distributed
production abuse protection.
"""

from __future__ import annotations

import time
from dataclasses import dataclass


MAX_FAILED_ATTEMPTS = 5
WINDOW_SECONDS = 5 * 60
THROTTLE_SECONDS = 5 * 60
THROTTLED_LOGIN_DETAIL = "Too many failed login attempts. Please try again later."


@dataclass
class _LoginThrottleEntry:
    failures: list[float]
    throttled_until: float | None = None


_state: dict[tuple[str, str], _LoginThrottleEntry] = {}


def _normalize_username(username: str | None) -> str:
    return (username or "").strip().casefold()


def _normalize_client_ip(client_ip: str | None) -> str:
    return (client_ip or "unknown").strip() or "unknown"


def _key(username: str | None, client_ip: str | None) -> tuple[str, str]:
    return (_normalize_username(username), _normalize_client_ip(client_ip))


def _current_time() -> float:
    return time.monotonic()


def is_login_throttled(username: str | None, client_ip: str | None, now: float | None = None) -> bool:
    current = _current_time() if now is None else now
    entry = _state.get(_key(username, client_ip))
    if entry is None or entry.throttled_until is None:
        return False
    if current >= entry.throttled_until:
        entry.throttled_until = None
        entry.failures = [failure for failure in entry.failures if current - failure <= WINDOW_SECONDS]
        if not entry.failures:
            _state.pop(_key(username, client_ip), None)
        return False
    return True


def record_failed_login(username: str | None, client_ip: str | None, now: float | None = None) -> None:
    current = _current_time() if now is None else now
    key = _key(username, client_ip)
    entry = _state.setdefault(key, _LoginThrottleEntry(failures=[]))
    entry.failures = [failure for failure in entry.failures if current - failure <= WINDOW_SECONDS]
    entry.failures.append(current)
    if len(entry.failures) >= MAX_FAILED_ATTEMPTS:
        entry.throttled_until = current + THROTTLE_SECONDS


def reset_login_throttle(username: str | None, client_ip: str | None) -> None:
    _state.pop(_key(username, client_ip), None)


def clear_login_throttle_state() -> None:
    _state.clear()

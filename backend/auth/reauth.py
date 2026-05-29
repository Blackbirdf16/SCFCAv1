"""Short-lived re-authentication tokens for sensitive admin actions.

The token is signed and process-stateless. It is intended for PoC-level
recent password confirmation, not production privileged access management.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from fastapi import Depends, Header, HTTPException, status

from backend.auth.dependencies import Principal, get_current_principal
from backend.auth.schemas import Role
from backend.core.config import settings


REAUTH_HEADER = "X-Reauth-Token"
REAUTH_TOKEN_SECONDS = 5 * 60
REAUTH_REQUIRED_DETAIL = "Recent administrator re-authentication required"


def _sign(value: str) -> str:
    return hmac.new(settings.secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def create_reauth_token(principal: Principal, now: float | None = None, lifetime_seconds: int = REAUTH_TOKEN_SECONDS) -> str:
    current = int(time.time() if now is None else now)
    payload = {
        "purpose": "reauth",
        "username": principal.username,
        "role": principal.role.value,
        "iat": current,
        "exp": current + lifetime_seconds,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("ascii")
    return f"{encoded}.{_sign(encoded)}"


def _read_reauth_token(value: str, now: float | None = None) -> dict:
    try:
        encoded, supplied_signature = value.rsplit(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REAUTH_REQUIRED_DETAIL) from exc

    expected_signature = _sign(encoded)
    if not hmac.compare_digest(supplied_signature, expected_signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REAUTH_REQUIRED_DETAIL)

    try:
        decoded = base64.urlsafe_b64decode(encoded.encode("ascii"))
        payload = json.loads(decoded)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REAUTH_REQUIRED_DETAIL) from exc

    current = int(time.time() if now is None else now)
    if payload.get("purpose") != "reauth" or int(payload.get("exp", 0)) < current:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REAUTH_REQUIRED_DETAIL)
    return payload


def require_recent_admin_reauth(
    x_reauth_token: str | None = Header(default=None),
    principal: Principal = Depends(get_current_principal),
) -> None:
    if principal.role != Role.administrator or not x_reauth_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REAUTH_REQUIRED_DETAIL)

    payload = _read_reauth_token(x_reauth_token)
    if payload.get("username") != principal.username or payload.get("role") != principal.role.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REAUTH_REQUIRED_DETAIL)

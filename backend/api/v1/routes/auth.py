"""Authentication endpoints for SCFCA backend (PoC).

Important: demo-safe only.
- Uses a fixed local demo credential map.
- Stores signed session metadata in an HttpOnly cookie.
- Never returns password or credential-like data.
"""

from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from backend.auth.csrf import CSRF_COOKIE, create_csrf_token, require_csrf
from backend.auth.dependencies import SESSION_COOKIE, Principal, create_session_cookie, get_current_principal
from backend.auth.login_throttle import (
    THROTTLED_LOGIN_DETAIL,
    is_login_throttled,
    record_failed_login,
    reset_login_throttle,
)
from backend.auth.reauth import REAUTH_TOKEN_SECONDS, create_reauth_token
from backend.auth.schemas import LoginRequest, ReauthRequest, Role
from backend.api.v1.routes.audit import record_audit_event
from backend.auth.service import authenticate_user

router = APIRouter()


@router.post("/login", summary="User login", tags=["auth"])
def login(payload: LoginRequest, response: Response, request: Request):
    username = (payload.username or "").strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required")

    if not (payload.password or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required")

    client_ip = request.client.host if request.client else None
    if is_login_throttled(username, client_ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=THROTTLED_LOGIN_DETAIL)

    user = authenticate_user(username, payload.password)
    if user is None:
        record_failed_login(username, client_ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # `user.role` is stored as an Enum(Role) in the DB; ensure compatibility
    user_role = Role(user.role.value) if hasattr(user.role, "value") else Role(user.role)
    if payload.role is not None and payload.role != user_role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role does not match credential")

    reset_login_throttle(username, client_ip)
    csrf_token = create_csrf_token()

    session_cookie = create_session_cookie(username, user_role)
    response.set_cookie(key=SESSION_COOKIE, value=session_cookie, httponly=True, samesite="lax")
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        httponly=False,
        samesite="lax",
    )

    record_audit_event(
        actor=username,
        role=user_role.value,
        action="login_event",
        description="User logged in to the SCFCA control panel.",
        entity_type="user",
        entity_id=username,
        source_ip=request.client.host if request.client else None,
        session_id=sha256(session_cookie.encode("utf-8")).hexdigest()[:12],
    )

    return {"username": username, "role": user_role.value, "csrfToken": csrf_token}


@router.post("/logout", summary="Logout", tags=["auth"])
def logout(response: Response, request: Request, principal: Principal = Depends(get_current_principal), _: None = Depends(require_csrf)):
    session_cookie = request.cookies.get(SESSION_COOKIE) or principal.username
    record_audit_event(
        actor=principal.username,
        role=principal.role.value,
        action="logout_event",
        description="User logged out of the SCFCA control panel.",
        entity_type="user",
        entity_id=principal.username,
        source_ip=request.client.host if request.client else None,
        session_id=sha256(session_cookie.encode("utf-8")).hexdigest()[:12],
    )
    response.delete_cookie(SESSION_COOKIE)
    response.delete_cookie(CSRF_COOKIE)
    return {"message": "Logged out"}


@router.get("/me", summary="Current principal", tags=["auth"])
def me(principal: Principal = Depends(get_current_principal)):
    return {"username": principal.username, "role": principal.role.value}


@router.post("/reauth", summary="Confirm password for sensitive administrative actions", tags=["auth"])
def reauth(
    payload: ReauthRequest,
    principal: Principal = Depends(get_current_principal),
    _: None = Depends(require_csrf),
):
    if not (payload.password or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required")

    user = authenticate_user(principal.username, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return {
        "reauthToken": create_reauth_token(principal),
        "expiresInSeconds": REAUTH_TOKEN_SECONDS,
    }

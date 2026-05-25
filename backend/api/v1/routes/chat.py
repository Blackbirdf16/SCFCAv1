"""Internal chat endpoints for SCFCA (PoC).

Implements a simple internal chat room intended for authenticated roles
(administrator, regular/case handler, auditor).

- Messages are stored in-memory (demo-safe).
- State-changing operations require CSRF.
- WebSocket is used to push new messages to connected clients.
"""

from __future__ import annotations

import asyncio
import secrets
import uuid
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from backend.auth.csrf import CSRF_COOKIE, require_csrf
from backend.auth.dependencies import SESSION_COOKIE, Principal, _read_session_cookie, get_current_principal
from backend.api.v1.routes.audit import record_audit_event

router = APIRouter()


class ChatMessage(BaseModel):
    id: str
    timestamp: str
    author: str
    role: str
    text: str


class ChatMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)


_MAX_MESSAGES = 500
_DEMO_MESSAGES: list[dict[str, Any]] = []


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections)

        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                for websocket in stale:
                    self._connections.discard(websocket)


manager = ConnectionManager()


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


@router.get("/messages", summary="List chat messages", tags=["chat"])
def list_messages(
    limit: int = 100,
    _: Principal = Depends(get_current_principal),
):
    safe_limit = max(1, min(int(limit), 250))
    return {"messages": _DEMO_MESSAGES[-safe_limit:]}


@router.post("/messages", summary="Post a chat message", tags=["chat"])
async def post_message(
    payload: ChatMessageCreate,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    __: None = Depends(require_csrf),
):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message text is required")

    message: dict[str, Any] = {
        "id": uuid.uuid4().hex,
        "timestamp": _utc_now_iso(),
        "author": principal.username,
        "role": principal.role.value,
        "text": text,
    }

    _DEMO_MESSAGES.append(message)
    if len(_DEMO_MESSAGES) > _MAX_MESSAGES:
        del _DEMO_MESSAGES[: len(_DEMO_MESSAGES) - _MAX_MESSAGES]

    session_cookie = request.cookies.get(SESSION_COOKIE) if request else None
    record_audit_event(
        actor=principal.username,
        role=principal.role.value,
        action="chat_message_posted",
        description=text[:240],
        entity_type="chat_message",
        entity_id=message["id"],
        result="sent",
        source_ip=request.client.host if request and request.client else None,
        session_id=sha256(session_cookie.encode("utf-8")).hexdigest()[:12] if session_cookie else None,
    )

    await manager.broadcast({"type": "message", "message": message})

    return {"message": message}


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    session_cookie = websocket.cookies.get(SESSION_COOKIE)
    if not session_cookie:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        principal = _read_session_cookie(session_cookie)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    csrf_cookie = websocket.cookies.get(CSRF_COOKIE)
    csrf_param = websocket.query_params.get("csrf")
    if not csrf_cookie or not csrf_param or not secrets.compare_digest(csrf_cookie, csrf_param):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "type": "init",
                "principal": {"username": principal.username, "role": principal.role.value},
                "messages": _DEMO_MESSAGES[-100:],
            }
        )

        # Keep the socket open; client doesn't need to send anything.
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except RuntimeError as exc:
        # Starlette raises this when receive() is called after disconnect.
        if 'Cannot call "receive" once a disconnect message has been received.' not in str(exc):
            raise
    finally:
        await manager.disconnect(websocket)

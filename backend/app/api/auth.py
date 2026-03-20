"""Supabase JWT authentication middleware — validates tokens on every request."""

from __future__ import annotations

from typing import Any

import jwt
import structlog
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config.settings import settings

logger = structlog.get_logger()

security = HTTPBearer(auto_error=False)


class AuthUser:
    """Authenticated user extracted from Supabase JWT."""

    __slots__ = ("id", "email", "role")

    def __init__(self, user_id: str, email: str, role: str = "authenticated"):
        self.id = user_id
        self.email = email
        self.role = role


def _decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a Supabase JWT. Raises on invalid/expired tokens."""
    jwt_secret = settings.supabase.jwt_secret
    if not jwt_secret:
        raise HTTPException(500, "Server auth not configured")

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["sub", "exp", "aud"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning("jwt_validation_failed", error=str(e))
        raise HTTPException(401, "Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser:
    """FastAPI dependency — extracts and validates the Supabase user from Bearer token."""
    if not credentials:
        raise HTTPException(401, "Not authenticated")

    payload = _decode_token(credentials.credentials)
    user_meta = payload.get("user_metadata", {})

    return AuthUser(
        user_id=payload["sub"],
        email=user_meta.get("email", payload.get("email", "")),
        role=payload.get("role", "authenticated"),
    )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser | None:
    """Same as get_current_user but returns None instead of 401 for unauthenticated."""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

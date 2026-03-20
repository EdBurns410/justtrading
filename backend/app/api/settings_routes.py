"""User settings API — encrypted API key management."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import AuthUser, get_current_user
from app.models.user_settings import UserSettings
from app.services.database import get_db
from app.services.encryption import decrypt_value, encrypt_value

router = APIRouter(prefix="/settings", tags=["settings"])


class ApiKeysUpdate(BaseModel):
    oanda_api_token: str | None = None
    oanda_account_id: str | None = None
    oanda_is_live: bool | None = None
    perigon_api_key: str | None = None
    finnhub_api_key: str | None = None


class ApiKeysResponse(BaseModel):
    oanda_api_token_set: bool
    oanda_account_id_set: bool
    oanda_is_live: bool
    perigon_api_key_set: bool
    finnhub_api_key_set: bool


def _mask(value: str) -> str:
    """Return masked version: first 4 chars + ****."""
    if not value or len(value) < 5:
        return "****"
    return value[:4] + "****" + value[-4:]


class ApiKeysMaskedResponse(BaseModel):
    oanda_api_token: str
    oanda_account_id: str
    oanda_is_live: bool
    perigon_api_key: str
    finnhub_api_key: str


@router.get("", response_model=ApiKeysMaskedResponse)
async def get_settings(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current API key settings (masked)."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        return ApiKeysMaskedResponse(
            oanda_api_token="",
            oanda_account_id="",
            oanda_is_live=False,
            perigon_api_key="",
            finnhub_api_key="",
        )

    return ApiKeysMaskedResponse(
        oanda_api_token=_mask(decrypt_value(settings.oanda_api_token_enc or "")),
        oanda_account_id=_mask(decrypt_value(settings.oanda_account_id_enc or "")),
        oanda_is_live=settings.oanda_is_live or False,
        perigon_api_key=_mask(decrypt_value(settings.perigon_api_key_enc or "")),
        finnhub_api_key=_mask(decrypt_value(settings.finnhub_api_key_enc or "")),
    )


@router.get("/status", response_model=ApiKeysResponse)
async def get_settings_status(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check which API keys are configured (no values returned)."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        return ApiKeysResponse(
            oanda_api_token_set=False,
            oanda_account_id_set=False,
            oanda_is_live=False,
            perigon_api_key_set=False,
            finnhub_api_key_set=False,
        )

    return ApiKeysResponse(
        oanda_api_token_set=bool(settings.oanda_api_token_enc),
        oanda_account_id_set=bool(settings.oanda_account_id_enc),
        oanda_is_live=settings.oanda_is_live or False,
        perigon_api_key_set=bool(settings.perigon_api_key_enc),
        finnhub_api_key_set=bool(settings.finnhub_api_key_enc),
    )


@router.put("", response_model=ApiKeysResponse)
async def update_settings(
    body: ApiKeysUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update API keys. Only non-null fields are updated."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)

    if body.oanda_api_token is not None:
        settings.oanda_api_token_enc = encrypt_value(body.oanda_api_token)
    if body.oanda_account_id is not None:
        settings.oanda_account_id_enc = encrypt_value(body.oanda_account_id)
    if body.oanda_is_live is not None:
        settings.oanda_is_live = body.oanda_is_live
    if body.perigon_api_key is not None:
        settings.perigon_api_key_enc = encrypt_value(body.perigon_api_key)
    if body.finnhub_api_key is not None:
        settings.finnhub_api_key_enc = encrypt_value(body.finnhub_api_key)

    return ApiKeysResponse(
        oanda_api_token_set=bool(settings.oanda_api_token_enc),
        oanda_account_id_set=bool(settings.oanda_account_id_enc),
        oanda_is_live=settings.oanda_is_live or False,
        perigon_api_key_set=bool(settings.perigon_api_key_enc),
        finnhub_api_key_set=bool(settings.finnhub_api_key_enc),
    )


@router.delete("")
async def clear_settings(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all stored API keys for the current user."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()
    if settings:
        await db.delete(settings)
    return {"status": "cleared"}

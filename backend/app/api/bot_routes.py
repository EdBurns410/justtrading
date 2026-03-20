"""Bot management API — create, configure, start/stop bots."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import AuthUser, get_current_user
from app.models.strategies import BotStage, StrategyBot
from app.services.database import get_db

router = APIRouter(prefix="/bots", tags=["bots"])


# ── Request / Response models ────────────────────────────────────────


class BotCreateRequest(BaseModel):
    bot_id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")
    name: str = Field(..., min_length=1, max_length=200)
    strategy_type: str = Field(..., min_length=1, max_length=50)
    version: str = Field(default="1.0.0", max_length=50)
    allowed_instruments: list[str] = Field(..., min_length=1)
    allowed_sessions: list[str] | None = None
    parameters: dict[str, Any] | None = None
    confidence_threshold: float | None = Field(default=0.7, ge=0.0, le=1.0)
    max_spread_pips: float | None = Field(default=3.0, ge=0.0)
    max_slippage_pips: float | None = Field(default=2.0, ge=0.0)
    max_concurrent_exposure: float | None = Field(default=2.0, ge=0.0)


class BotUpdateRequest(BaseModel):
    name: str | None = None
    version: str | None = None
    allowed_instruments: list[str] | None = None
    allowed_sessions: list[str] | None = None
    parameters: dict[str, Any] | None = None
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    max_spread_pips: float | None = Field(default=None, ge=0.0)
    max_slippage_pips: float | None = Field(default=None, ge=0.0)
    max_concurrent_exposure: float | None = Field(default=None, ge=0.0)
    stage: str | None = None


class BotDetailResponse(BaseModel):
    id: UUID
    bot_id: str
    name: str
    strategy_type: str
    version: str
    stage: str
    allowed_instruments: list[str]
    allowed_sessions: list[str] | None
    parameters: dict[str, Any] | None
    confidence_threshold: float | None
    max_spread_pips: float | None
    max_slippage_pips: float | None
    max_concurrent_exposure: float | None
    kill_switch_active: bool
    alerting_configured: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Instrument validation ────────────────────────────────────────────

VALID_INSTRUMENTS = {
    "EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CHF",
    "EUR_GBP", "EUR_JPY", "GBP_JPY", "AUD_JPY", "NZD_USD",
    "USD_CAD", "EUR_AUD", "EUR_CHF",
    "XAU_USD", "XAG_USD",  # Metals
    "BCO_USD", "WTICO_USD",  # Oil
}

VALID_STAGES = {s.value for s in BotStage}


def _validate_instruments(instruments: list[str]) -> None:
    invalid = [i for i in instruments if i not in VALID_INSTRUMENTS]
    if invalid:
        raise HTTPException(400, f"Invalid instruments: {', '.join(invalid)}")


# ── Routes ───────────────────────────────────────────────────────────


@router.post("", response_model=BotDetailResponse, status_code=201)
async def create_bot(
    body: BotCreateRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new strategy bot."""
    _validate_instruments(body.allowed_instruments)

    # Check for duplicate bot_id
    existing = await db.execute(
        select(StrategyBot).where(StrategyBot.bot_id == body.bot_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Bot '{body.bot_id}' already exists")

    bot = StrategyBot(
        bot_id=body.bot_id,
        name=body.name,
        strategy_type=body.strategy_type,
        version=body.version,
        stage=BotStage.RESEARCH.value,
        stage_entered_at=datetime.now(timezone.utc),
        allowed_instruments=body.allowed_instruments,
        allowed_sessions=body.allowed_sessions,
        parameters=body.parameters,
        confidence_threshold=body.confidence_threshold,
        max_spread_pips=body.max_spread_pips,
        max_slippage_pips=body.max_slippage_pips,
        max_concurrent_exposure=body.max_concurrent_exposure,
        kill_switch_active=False,
        alerting_configured=False,
    )
    db.add(bot)
    await db.flush()
    await db.refresh(bot)
    return bot


@router.put("/{bot_id}", response_model=BotDetailResponse)
async def update_bot(
    bot_id: str,
    body: BotUpdateRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing bot's configuration."""
    result = await db.execute(
        select(StrategyBot).where(StrategyBot.bot_id == bot_id)
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(404, "Bot not found")

    if body.name is not None:
        bot.name = body.name
    if body.version is not None:
        bot.version = body.version
    if body.allowed_instruments is not None:
        _validate_instruments(body.allowed_instruments)
        bot.allowed_instruments = body.allowed_instruments
    if body.allowed_sessions is not None:
        bot.allowed_sessions = body.allowed_sessions
    if body.parameters is not None:
        bot.parameters = body.parameters
    if body.confidence_threshold is not None:
        bot.confidence_threshold = body.confidence_threshold
    if body.max_spread_pips is not None:
        bot.max_spread_pips = body.max_spread_pips
    if body.max_slippage_pips is not None:
        bot.max_slippage_pips = body.max_slippage_pips
    if body.max_concurrent_exposure is not None:
        bot.max_concurrent_exposure = body.max_concurrent_exposure
    if body.stage is not None:
        if body.stage not in VALID_STAGES:
            raise HTTPException(400, f"Invalid stage: {body.stage}")
        bot.stage = body.stage
        bot.stage_entered_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(bot)
    return bot


@router.delete("/{bot_id}")
async def delete_bot(
    bot_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a bot (only if in research/retired stage)."""
    result = await db.execute(
        select(StrategyBot).where(StrategyBot.bot_id == bot_id)
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(404, "Bot not found")

    if bot.stage not in (BotStage.RESEARCH.value, BotStage.RETIRED.value):
        raise HTTPException(
            400, f"Cannot delete bot in '{bot.stage}' stage. Retire it first."
        )

    await db.delete(bot)
    return {"status": "deleted", "bot_id": bot_id}

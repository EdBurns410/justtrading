"""API routes — dashboard endpoints for the trading platform."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    BotStage,
    Decision,
    Event,
    Execution,
    Outcome,
    PromotionRecord,
    StrategyBot,
)
from app.services.database import get_db

router = APIRouter()


# ── Pydantic response models ──────────────────────────────────────────


class EventResponse(BaseModel):
    id: UUID
    source: str
    title: str
    event_type: str
    first_seen_at: datetime
    published_at: datetime | None
    ingested_at: datetime
    sentiment_score: float | None
    confidence_score: float | None
    affected_instruments: list[str] | None

    model_config = {"from_attributes": True}


class DecisionResponse(BaseModel):
    id: UUID
    bot_id: str
    action: str
    instrument: str | None
    confidence: float | None
    reason: str | None
    all_risk_checks_passed: bool
    decision_at: datetime

    model_config = {"from_attributes": True}


class ExecutionResponse(BaseModel):
    id: UUID
    instrument: str
    direction: str
    size: float
    fill_price: float | None
    stop_loss: float | None
    take_profit: float | None
    slippage: float | None
    status: str
    order_submitted_at: datetime

    model_config = {"from_attributes": True}


class OutcomeResponse(BaseModel):
    id: UUID
    realised_pnl: float
    realised_pnl_pips: float | None
    max_adverse_excursion: float | None
    max_favourable_excursion: float | None
    time_in_trade_seconds: int | None
    exit_reason: str
    reaction_time_seconds: float | None
    decision_latency_seconds: float | None
    execution_latency_seconds: float | None

    model_config = {"from_attributes": True}


class BotResponse(BaseModel):
    id: UUID
    bot_id: str
    name: str
    strategy_type: str
    version: str
    stage: str
    allowed_instruments: list[str]
    kill_switch_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PromotionResponse(BaseModel):
    id: UUID
    from_stage: str
    to_stage: str
    promoted_at: datetime
    all_gates_passed: bool
    total_trades: int | None
    win_rate: float | None
    profit_factor: float | None
    max_drawdown_pct: float | None

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_events: int
    total_decisions: int
    total_trades: int
    total_outcomes: int
    active_bots: int
    live_bots: int
    total_pnl: float
    win_rate: float


# ── Events ─────────────────────────────────────────────────────────────


@router.get("/events", response_model=list[EventResponse])
async def list_events(
    limit: int = Query(50, le=200),
    offset: int = 0,
    event_type: str | None = None,
    source: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Event).order_by(desc(Event.ingested_at)).offset(offset).limit(limit)
    if event_type:
        query = query.where(Event.event_type == event_type)
    if source:
        query = query.where(Event.source == source)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/events/{event_id}", response_model=EventResponse)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(404, "Event not found")
    return event


# ── Decisions ──────────────────────────────────────────────────────────


@router.get("/decisions", response_model=list[DecisionResponse])
async def list_decisions(
    limit: int = Query(50, le=200),
    offset: int = 0,
    bot_id: str | None = None,
    action: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Decision).order_by(desc(Decision.decision_at)).offset(offset).limit(limit)
    if bot_id:
        query = query.where(Decision.bot_id == bot_id)
    if action:
        query = query.where(Decision.action == action)
    result = await db.execute(query)
    return result.scalars().all()


# ── Executions ─────────────────────────────────────────────────────────


@router.get("/executions", response_model=list[ExecutionResponse])
async def list_executions(
    limit: int = Query(50, le=200),
    offset: int = 0,
    instrument: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Execution).order_by(desc(Execution.order_submitted_at)).offset(offset).limit(limit)
    )
    if instrument:
        query = query.where(Execution.instrument == instrument)
    if status:
        query = query.where(Execution.status == status)
    result = await db.execute(query)
    return result.scalars().all()


# ── Outcomes ───────────────────────────────────────────────────────────


@router.get("/outcomes", response_model=list[OutcomeResponse])
async def list_outcomes(
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Outcome).order_by(desc(Outcome.exit_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ── Bots / Strategies ─────────────────────────────────────────────────


@router.get("/bots", response_model=list[BotResponse])
async def list_bots(
    stage: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(StrategyBot).order_by(StrategyBot.bot_id)
    if stage:
        query = query.where(StrategyBot.stage == stage)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/bots/{bot_id}", response_model=BotResponse)
async def get_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StrategyBot).where(StrategyBot.bot_id == bot_id))
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(404, "Bot not found")
    return bot


@router.post("/bots/{bot_id}/kill-switch")
async def toggle_kill_switch(bot_id: str, active: bool, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StrategyBot).where(StrategyBot.bot_id == bot_id))
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(404, "Bot not found")
    bot.kill_switch_active = active
    return {"bot_id": bot_id, "kill_switch_active": active}


# ── Promotions ─────────────────────────────────────────────────────────


@router.get("/bots/{bot_id}/promotions", response_model=list[PromotionResponse])
async def list_promotions(bot_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PromotionRecord)
        .join(StrategyBot, PromotionRecord.bot_db_id == StrategyBot.id)
        .where(StrategyBot.bot_id == bot_id)
        .order_by(desc(PromotionRecord.promoted_at))
    )
    return result.scalars().all()


# ── Dashboard ──────────────────────────────────────────────────────────


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    events = (await db.execute(select(func.count(Event.id)))).scalar() or 0
    decisions = (await db.execute(select(func.count(Decision.id)))).scalar() or 0
    executions = (await db.execute(select(func.count(Execution.id)))).scalar() or 0
    outcomes_count = (await db.execute(select(func.count(Outcome.id)))).scalar() or 0

    bots_total = (await db.execute(select(func.count(StrategyBot.id)))).scalar() or 0
    bots_live = (
        await db.execute(
            select(func.count(StrategyBot.id)).where(StrategyBot.stage == BotStage.LIVE.value)
        )
    ).scalar() or 0

    total_pnl = (
        await db.execute(select(func.coalesce(func.sum(Outcome.realised_pnl), 0.0)))
    ).scalar() or 0.0

    wins = (
        await db.execute(
            select(func.count(Outcome.id)).where(Outcome.realised_pnl > 0)
        )
    ).scalar() or 0

    win_rate = (wins / outcomes_count * 100) if outcomes_count > 0 else 0.0

    return DashboardStats(
        total_events=events,
        total_decisions=decisions,
        total_trades=executions,
        total_outcomes=outcomes_count,
        active_bots=bots_total,
        live_bots=bots_live,
        total_pnl=total_pnl,
        win_rate=win_rate,
    )


@router.get("/dashboard/recent-trades")
async def recent_trades(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Execution, Decision)
        .outerjoin(Decision, Decision.execution_id == Execution.id)
        .order_by(desc(Execution.order_submitted_at))
        .limit(limit)
    )
    rows = result.all()
    trades = []
    for execution, decision in rows:
        trades.append({
            "id": str(execution.id),
            "instrument": execution.instrument,
            "direction": execution.direction,
            "size": execution.size,
            "fill_price": execution.fill_price,
            "status": execution.status,
            "submitted_at": execution.order_submitted_at.isoformat(),
            "bot_id": decision.bot_id if decision else None,
            "confidence": decision.confidence if decision else None,
            "reason": decision.reason if decision else None,
        })
    return trades

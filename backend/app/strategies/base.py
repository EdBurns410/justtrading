"""Base strategy bot framework — all bots inherit from this."""

from __future__ import annotations

import abc
import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import structlog

from app.models.events import Event
from app.models.strategies import BotStage

logger = structlog.get_logger()


class MarketSession(str, Enum):
    TOKYO = "tokyo"        # 00:00-09:00 UTC
    LONDON = "london"      # 07:00-16:00 UTC
    NEW_YORK = "new_york"  # 12:00-21:00 UTC
    SYDNEY = "sydney"      # 21:00-06:00 UTC
    OVERLAP_LN_NY = "overlap_london_ny"  # 12:00-16:00 UTC


class MarketRegime(str, Enum):
    LOW_VOL = "low_volatility"
    NORMAL = "normal"
    HIGH_VOL = "high_volatility"
    CRISIS = "crisis"
    TRENDING = "trending"
    RANGING = "ranging"


@dataclass
class TradeSignal:
    """Signal emitted by a strategy bot."""

    bot_id: str
    strategy_version: str
    instrument: str
    direction: str  # "LONG" or "SHORT"
    confidence: float
    reason: str
    event_id: str | None = None

    # Risk parameters
    size_units: float | None = None
    stop_loss_pips: float | None = None
    take_profit_pips: float | None = None
    max_spread_pips: float | None = None
    expected_holding_period: str | None = None

    # Context
    features_used: dict = field(default_factory=dict)
    market_regime: str | None = None
    invalidation_conditions: list[str] = field(default_factory=list)

    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class BotConfig:
    """Configuration for a strategy bot."""

    bot_id: str
    name: str
    strategy_type: str
    version: str

    allowed_instruments: list[str]
    allowed_sessions: list[str] = field(default_factory=lambda: ["london", "new_york"])
    allowed_event_types: list[str] = field(default_factory=list)

    # Thresholds
    confidence_threshold: float = 0.7
    max_spread_pips: float = 3.0
    max_slippage_pips: float = 2.0
    max_concurrent_exposure: int = 2

    # Invalidation
    invalidation_conditions: dict = field(default_factory=dict)

    # Parameters
    parameters: dict = field(default_factory=dict)


class BaseStrategyBot(abc.ABC):
    """Base class for all strategy bots."""

    def __init__(self, config: BotConfig):
        self.config = config
        self.stage = BotStage.RESEARCH
        self._running = False
        self._signal_callbacks: list = []
        self._events_processed = 0
        self._signals_generated = 0

    @property
    def bot_id(self) -> str:
        return self.config.bot_id

    def on_signal(self, callback):
        """Register a callback for trade signals."""
        self._signal_callbacks.append(callback)

    async def _emit_signal(self, signal: TradeSignal):
        """Emit a trade signal to all registered callbacks."""
        self._signals_generated += 1
        logger.info(
            "signal_generated",
            bot_id=self.bot_id,
            instrument=signal.instrument,
            direction=signal.direction,
            confidence=signal.confidence,
        )
        for cb in self._signal_callbacks:
            try:
                await cb(signal)
            except Exception:
                logger.exception("signal_callback_error", bot_id=self.bot_id)

    async def handle_event(self, event: Event):
        """Process an incoming event. Override in subclasses."""
        self._events_processed += 1

        # Check if bot should process this event
        if not self._should_process(event):
            return

        # Check session window
        if not self._in_allowed_session():
            return

        # Run the strategy logic
        signal = await self.evaluate(event)
        if signal and signal.confidence >= self.config.confidence_threshold:
            await self._emit_signal(signal)

    def _should_process(self, event: Event) -> bool:
        """Check if this event type is relevant to this bot."""
        if not self.config.allowed_event_types:
            return True
        return event.event_type in self.config.allowed_event_types

    def _in_allowed_session(self) -> bool:
        """Check if current time is in an allowed trading session."""
        now = datetime.now(timezone.utc)
        hour = now.hour

        session_hours = {
            "tokyo": (0, 9),
            "london": (7, 16),
            "new_york": (12, 21),
            "sydney": (21, 6),
            "overlap_london_ny": (12, 16),
        }

        for session_name in self.config.allowed_sessions:
            if session_name in session_hours:
                start, end = session_hours[session_name]
                if start <= end:
                    if start <= hour < end:
                        return True
                else:  # Wraps midnight
                    if hour >= start or hour < end:
                        return True

        return False

    @abc.abstractmethod
    async def evaluate(self, event: Event) -> TradeSignal | None:
        """Evaluate an event and optionally produce a trade signal."""

    async def start(self):
        self._running = True
        logger.info("bot_started", bot_id=self.bot_id, stage=self.stage.value)

    async def stop(self):
        self._running = False
        logger.info("bot_stopped", bot_id=self.bot_id)

    def get_status(self) -> dict:
        return {
            "bot_id": self.bot_id,
            "name": self.config.name,
            "stage": self.stage.value,
            "running": self._running,
            "events_processed": self._events_processed,
            "signals_generated": self._signals_generated,
            "config": {
                "instruments": self.config.allowed_instruments,
                "sessions": self.config.allowed_sessions,
                "confidence_threshold": self.config.confidence_threshold,
            },
        }

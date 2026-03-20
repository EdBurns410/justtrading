"""Decision records — every trading decision made by a strategy bot."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .events import Event
    from .executions import Execution


class Decision(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "decisions"

    # Links
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id"), nullable=True
    )
    execution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("executions.id"), nullable=True
    )

    # Strategy identification
    bot_id: Mapped[str] = mapped_column(String(100), nullable=False)
    strategy_version: Mapped[str] = mapped_column(String(50), nullable=False)

    # Features and context
    features_used: Mapped[dict | None] = mapped_column(JSONB)
    market_regime: Mapped[str | None] = mapped_column(String(50))
    market_regime_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    # Market conditions at decision time
    spread_snapshot: Mapped[float | None] = mapped_column(Float)
    slippage_estimate: Mapped[float | None] = mapped_column(Float)
    account_equity: Mapped[float | None] = mapped_column(Float)
    account_margin_used: Mapped[float | None] = mapped_column(Float)
    account_margin_available: Mapped[float | None] = mapped_column(Float)

    # Risk checks
    risk_checks: Mapped[dict | None] = mapped_column(JSONB)
    all_risk_checks_passed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Decision
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # BUY, SELL, HOLD, SKIP
    instrument: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float | None] = mapped_column(Float)
    reason: Mapped[str | None] = mapped_column(Text)
    expected_holding_period: Mapped[str | None] = mapped_column(String(50))

    # Timing
    decision_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    event: Mapped[Event | None] = relationship(back_populates="decisions")
    execution: Mapped[Execution | None] = relationship(back_populates="decision")

    __table_args__ = (
        Index("ix_decisions_bot", "bot_id", "decision_at"),
        Index("ix_decisions_event", "event_id"),
        Index("ix_decisions_action", "action", "decision_at"),
    )

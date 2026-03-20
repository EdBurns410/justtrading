"""Strategy and bot lifecycle models — tracks promotion pipeline state."""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, Boolean
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BotStage(str, Enum):
    RESEARCH = "research"
    BACKTEST = "backtest"
    PAPER_LIVE = "paper_live"
    SHADOW = "shadow"
    MICRO_LIVE = "micro_live"
    PROMOTION_GATE = "promotion_gate"
    LIVE = "live"
    PAUSED = "paused"
    RETIRED = "retired"


class StrategyBot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "strategy_bots"

    bot_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    strategy_type: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    version_hash: Mapped[str | None] = mapped_column(String(64))

    # Stage
    stage: Mapped[str] = mapped_column(String(30), default=BotStage.RESEARCH.value)
    stage_entered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Configuration
    allowed_instruments: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    allowed_sessions: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    parameters: Mapped[dict | None] = mapped_column(JSONB)

    # Risk
    max_spread_pips: Mapped[float | None] = mapped_column(Float)
    max_slippage_pips: Mapped[float | None] = mapped_column(Float)
    max_concurrent_exposure: Mapped[float | None] = mapped_column(Float)
    confidence_threshold: Mapped[float | None] = mapped_column(Float)
    invalidation_conditions: Mapped[dict | None] = mapped_column(JSONB)

    # Kill switch
    kill_switch_active: Mapped[bool] = mapped_column(Boolean, default=False)
    alerting_configured: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    promotion_records: Mapped[list["PromotionRecord"]] = relationship(back_populates="bot")

    __table_args__ = (
        Index("ix_bots_stage", "stage"),
        Index("ix_bots_type", "strategy_type"),
    )


class PromotionRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "promotion_records"

    bot_db_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("strategy_bots.id"), nullable=False
    )

    from_stage: Mapped[str] = mapped_column(String(30), nullable=False)
    to_stage: Mapped[str] = mapped_column(String(30), nullable=False)
    promoted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Gate results
    gate_results: Mapped[dict] = mapped_column(JSONB, nullable=False)
    all_gates_passed: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # Metrics at promotion
    total_trades: Mapped[int | None] = mapped_column(Integer)
    win_rate: Mapped[float | None] = mapped_column(Float)
    profit_factor: Mapped[float | None] = mapped_column(Float)
    max_drawdown_pct: Mapped[float | None] = mapped_column(Float)
    expectancy: Mapped[float | None] = mapped_column(Float)
    sharpe_ratio: Mapped[float | None] = mapped_column(Float)

    notes: Mapped[str | None] = mapped_column(Text)

    bot: Mapped[StrategyBot] = relationship(back_populates="promotion_records")

    __table_args__ = (Index("ix_promotions_bot", "bot_db_id", "promoted_at"),)

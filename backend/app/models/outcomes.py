"""Outcome records — realised results for every closed trade."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .executions import Execution


class Outcome(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "outcomes"

    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("executions.id"), nullable=False, unique=True
    )

    # P&L
    realised_pnl: Mapped[float] = mapped_column(Float, nullable=False)
    realised_pnl_pips: Mapped[float | None] = mapped_column(Float)
    commission: Mapped[float | None] = mapped_column(Float)
    financing: Mapped[float | None] = mapped_column(Float)

    # Excursions
    max_adverse_excursion: Mapped[float | None] = mapped_column(Float)
    max_adverse_excursion_pips: Mapped[float | None] = mapped_column(Float)
    max_favourable_excursion: Mapped[float | None] = mapped_column(Float)
    max_favourable_excursion_pips: Mapped[float | None] = mapped_column(Float)

    # Timing
    entry_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exit_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    time_in_trade_seconds: Mapped[int | None] = mapped_column(Integer)

    # Exit
    exit_reason: Mapped[str] = mapped_column(String(50), nullable=False)
    exit_price: Mapped[float] = mapped_column(Float, nullable=False)

    # Derived metrics (computed post-trade)
    reaction_time_seconds: Mapped[float | None] = mapped_column(Float)
    decision_latency_seconds: Mapped[float | None] = mapped_column(Float)
    execution_latency_seconds: Mapped[float | None] = mapped_column(Float)

    # Relationships
    execution: Mapped[Execution] = relationship(back_populates="outcome")

    __table_args__ = (
        Index("ix_outcomes_pnl", "realised_pnl"),
        Index("ix_outcomes_exit_reason", "exit_reason"),
    )

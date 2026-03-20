"""Execution records — every order sent to the broker."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .decisions import Decision
    from .outcomes import Outcome


class OrderStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class Execution(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "executions"

    # Order identification
    broker_order_id: Mapped[str | None] = mapped_column(String(100))
    broker_trade_id: Mapped[str | None] = mapped_column(String(100))

    # Timing
    order_submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    broker_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fill_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Order details
    instrument: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # LONG, SHORT
    size: Mapped[float] = mapped_column(Float, nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), default="MARKET")

    # Prices
    requested_price: Mapped[float | None] = mapped_column(Float)
    fill_price: Mapped[float | None] = mapped_column(Float)
    stop_loss: Mapped[float | None] = mapped_column(Float)
    take_profit: Mapped[float | None] = mapped_column(Float)

    # Execution quality
    slippage: Mapped[float | None] = mapped_column(Float)
    spread_at_entry: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default=OrderStatus.PENDING.value)

    # Raw broker response
    broker_response: Mapped[dict | None] = mapped_column(JSONB)

    # Relationships
    decision: Mapped[Decision | None] = relationship(back_populates="execution")
    outcome: Mapped[Outcome | None] = relationship(back_populates="execution")

    __table_args__ = (
        Index("ix_executions_instrument", "instrument", "order_submitted_at"),
        Index("ix_executions_broker_order", "broker_order_id"),
        Index("ix_executions_status", "status"),
    )

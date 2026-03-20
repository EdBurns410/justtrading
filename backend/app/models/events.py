"""Event records — every market event ingested by the platform."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .decisions import Decision


class EventSource(str, Enum):
    PERIGON = "perigon"
    FINNHUB = "finnhub"
    OANDA = "oanda"
    CALENDAR = "calendar"
    MANUAL = "manual"


class EventType(str, Enum):
    MACRO_RELEASE = "macro_release"
    CENTRAL_BANK = "central_bank"
    GEOPOLITICAL = "geopolitical"
    EARNINGS = "earnings"
    COMMODITY_SUPPLY = "commodity_supply"
    RISK_SENTIMENT = "risk_sentiment"
    PRICE_ACTION = "price_action"
    TECHNICAL = "technical"
    OTHER = "other"


class Event(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "events"

    # Source identification
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text)
    source_article_id: Mapped[str | None] = mapped_column(String(255))

    # Timestamps
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Content
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)

    # Classification
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    extracted_entities: Mapped[list | None] = mapped_column(JSONB)
    affected_instruments: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    # Scoring
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    credibility_score: Mapped[float | None] = mapped_column(Float)

    # Deduplication
    dedup_cluster_id: Mapped[str | None] = mapped_column(String(255))
    is_first_publication: Mapped[bool | None] = mapped_column(default=None)

    # Relationships
    decisions: Mapped[list[Decision]] = relationship(back_populates="event")

    __table_args__ = (
        Index("ix_events_source_article", "source", "source_article_id"),
        Index("ix_events_type_time", "event_type", "first_seen_at"),
        Index("ix_events_cluster", "dedup_cluster_id"),
        Index("ix_events_ingested", "ingested_at"),
    )

"""Base classes for event ingestion."""

from __future__ import annotations

import abc
import asyncio
from datetime import datetime, timezone
from typing import Any

import structlog

from app.models.events import Event, EventType

logger = structlog.get_logger()


class IngestedEvent:
    """Normalised event from any source before DB persistence."""

    def __init__(
        self,
        source: str,
        source_url: str | None,
        source_article_id: str | None,
        first_seen_at: datetime,
        published_at: datetime | None,
        title: str,
        summary: str | None = None,
        event_type: str = EventType.OTHER.value,
        extracted_entities: list | None = None,
        affected_instruments: list[str] | None = None,
        sentiment_score: float | None = None,
        confidence_score: float | None = None,
        credibility_score: float | None = None,
        dedup_cluster_id: str | None = None,
        is_first_publication: bool | None = None,
        raw_payload: dict | None = None,
    ):
        self.source = source
        self.source_url = source_url
        self.source_article_id = source_article_id
        self.first_seen_at = first_seen_at
        self.published_at = published_at
        self.title = title
        self.summary = summary
        self.event_type = event_type
        self.extracted_entities = extracted_entities
        self.affected_instruments = affected_instruments
        self.sentiment_score = sentiment_score
        self.confidence_score = confidence_score
        self.credibility_score = credibility_score
        self.dedup_cluster_id = dedup_cluster_id
        self.is_first_publication = is_first_publication
        self.raw_payload = raw_payload

    def to_db_event(self) -> Event:
        return Event(
            source=self.source,
            source_url=self.source_url,
            source_article_id=self.source_article_id,
            first_seen_at=self.first_seen_at,
            published_at=self.published_at,
            ingested_at=datetime.now(timezone.utc),
            title=self.title,
            summary=self.summary,
            event_type=self.event_type,
            extracted_entities=self.extracted_entities,
            affected_instruments=self.affected_instruments,
            sentiment_score=self.sentiment_score,
            confidence_score=self.confidence_score,
            credibility_score=self.credibility_score,
            dedup_cluster_id=self.dedup_cluster_id,
            is_first_publication=self.is_first_publication,
            raw_payload=self.raw_payload,
        )


class BaseIngester(abc.ABC):
    """Base class for all event ingesters."""

    def __init__(self, name: str):
        self.name = name
        self._running = False
        self._callbacks: list = []

    def on_event(self, callback):
        """Register a callback for new events."""
        self._callbacks.append(callback)

    async def _emit(self, event: IngestedEvent):
        """Emit an event to all registered callbacks."""
        for cb in self._callbacks:
            try:
                await cb(event)
            except Exception:
                logger.exception("callback_error", ingester=self.name)

    @abc.abstractmethod
    async def start(self):
        """Start ingesting events."""

    @abc.abstractmethod
    async def stop(self):
        """Stop ingesting events."""

    @abc.abstractmethod
    async def health_check(self) -> dict:
        """Return health status."""

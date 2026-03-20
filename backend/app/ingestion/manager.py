"""Ingestion manager — coordinates all event sources and persists events."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.base import BaseIngester, IngestedEvent
from app.ingestion.oanda_stream import OANDAAccountPoller, OANDAPriceStream, OANDATransactionStream
from app.ingestion.perigon import PerigonIngester
from app.ingestion.finnhub import FinnhubCalendarIngester, FinnhubNewsIngester
from app.services.database import async_session_factory

logger = structlog.get_logger()


class IngestionManager:
    """Manages all ingestion sources, dedup, and persistence."""

    def __init__(self, instruments: list[str] | None = None):
        self.instruments = instruments or [
            "EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD",
            "USD_CHF", "XAU_USD", "BCO_USD",
        ]

        # Core OANDA streams
        self.price_stream = OANDAPriceStream(self.instruments)
        self.transaction_stream = OANDATransactionStream()
        self.account_poller = OANDAAccountPoller()

        # News / events
        self.perigon = PerigonIngester()
        self.finnhub_news = FinnhubNewsIngester()
        self.finnhub_calendar = FinnhubCalendarIngester()

        # All ingesters
        self._ingesters: list[BaseIngester] = [
            self.price_stream,
            self.transaction_stream,
            self.account_poller,
            self.perigon,
            self.finnhub_news,
            self.finnhub_calendar,
        ]

        # Event callbacks (strategies subscribe here)
        self._event_callbacks: list = []

        # Stats
        self._events_ingested = 0
        self._events_persisted = 0

    def on_event(self, callback):
        """Register a callback that receives persisted Event objects."""
        self._event_callbacks.append(callback)

    async def start(self):
        """Start all ingestion sources."""
        # Register our handler on all ingesters
        for ingester in self._ingesters:
            ingester.on_event(self._handle_ingested_event)

        # Start all
        await asyncio.gather(*[i.start() for i in self._ingesters])
        logger.info("ingestion_manager_started", sources=len(self._ingesters))

    async def stop(self):
        """Stop all ingestion sources."""
        await asyncio.gather(*[i.stop() for i in self._ingesters])
        logger.info("ingestion_manager_stopped")

    async def _handle_ingested_event(self, ingested: IngestedEvent):
        """Process and persist an ingested event, then notify subscribers."""
        self._events_ingested += 1

        try:
            db_event = ingested.to_db_event()

            async with async_session_factory() as session:
                session.add(db_event)
                await session.commit()
                await session.refresh(db_event)
                self._events_persisted += 1

            # Notify strategy engines
            for cb in self._event_callbacks:
                try:
                    await cb(db_event)
                except Exception:
                    logger.exception("event_callback_error")

        except Exception:
            logger.exception("event_persistence_error", source=ingested.source)

    async def health_check(self) -> dict:
        checks = {}
        for ingester in self._ingesters:
            try:
                checks[ingester.name] = await ingester.health_check()
            except Exception as e:
                checks[ingester.name] = {"error": str(e)}

        return {
            "events_ingested": self._events_ingested,
            "events_persisted": self._events_persisted,
            "sources": checks,
        }

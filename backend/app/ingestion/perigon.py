"""Perigon news/events API ingestion — clustered event signals."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx
import structlog

from app.config.settings import settings
from app.ingestion.base import BaseIngester, IngestedEvent
from app.models.events import EventSource, EventType

logger = structlog.get_logger()

# Map Perigon categories to our event types
CATEGORY_MAP = {
    "Politics": EventType.GEOPOLITICAL.value,
    "Economics": EventType.MACRO_RELEASE.value,
    "Business": EventType.OTHER.value,
    "Finance": EventType.MACRO_RELEASE.value,
    "Energy": EventType.COMMODITY_SUPPLY.value,
    "War": EventType.GEOPOLITICAL.value,
    "Environment": EventType.COMMODITY_SUPPLY.value,
}

# Instruments affected by topic keywords
TOPIC_INSTRUMENT_MAP = {
    "oil": ["BCO_USD", "WTICO_USD"],
    "crude": ["BCO_USD", "WTICO_USD"],
    "opec": ["BCO_USD", "WTICO_USD"],
    "gold": ["XAU_USD"],
    "fed": ["EUR_USD", "USD_JPY", "GBP_USD", "XAU_USD"],
    "ecb": ["EUR_USD", "EUR_GBP"],
    "boj": ["USD_JPY", "EUR_JPY"],
    "boe": ["GBP_USD", "EUR_GBP"],
    "inflation": ["XAU_USD", "EUR_USD", "USD_JPY"],
    "cpi": ["XAU_USD", "EUR_USD", "USD_JPY"],
    "nfp": ["EUR_USD", "GBP_USD", "USD_JPY", "XAU_USD"],
    "employment": ["EUR_USD", "USD_JPY"],
    "sanctions": ["USD_JPY", "XAU_USD", "BCO_USD"],
    "tariff": ["EUR_USD", "USD_JPY", "AUD_USD"],
    "war": ["XAU_USD", "USD_JPY", "BCO_USD"],
    "missile": ["XAU_USD", "USD_JPY", "BCO_USD"],
}


class PerigonIngester(BaseIngester):
    """Polls Perigon API for clustered news events relevant to FX/commodities."""

    def __init__(self, poll_interval: float = 30.0, topics: list[str] | None = None):
        super().__init__("perigon")
        self.poll_interval = poll_interval
        self.topics = topics or [
            "central bank",
            "interest rate",
            "inflation",
            "CPI",
            "NFP",
            "employment",
            "GDP",
            "oil",
            "OPEC",
            "sanctions",
            "geopolitical",
            "war",
            "gold",
            "Federal Reserve",
            "ECB",
            "BOJ",
            "Bank of England",
        ]
        self._client: httpx.AsyncClient | None = None
        self._task: asyncio.Task | None = None
        self._seen_ids: set[str] = set()

    async def start(self):
        self._running = True
        self._client = httpx.AsyncClient(timeout=30.0)
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("perigon_ingester_started", topics=self.topics)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        if self._client:
            await self._client.aclose()

    async def _poll_loop(self):
        while self._running:
            try:
                await self._fetch_articles()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("perigon_poll_error")
            await asyncio.sleep(self.poll_interval)

    async def _fetch_articles(self):
        if not settings.perigon.api_key:
            return

        for topic in self.topics:
            try:
                resp = await self._client.get(
                    f"{settings.perigon.api_url}/all",
                    params={
                        "apiKey": settings.perigon.api_key,
                        "q": topic,
                        "sortBy": "date",
                        "size": 10,
                        "language": "en",
                    },
                )
                if resp.status_code != 200:
                    logger.warning("perigon_api_error", status=resp.status_code, topic=topic)
                    continue

                data = resp.json()
                for article in data.get("articles", []):
                    await self._process_article(article)

            except httpx.HTTPError:
                logger.exception("perigon_http_error", topic=topic)

    async def _process_article(self, article: dict):
        article_id = article.get("articleId") or article.get("url", "")
        if article_id in self._seen_ids:
            return
        self._seen_ids.add(article_id)

        # Keep seen set bounded
        if len(self._seen_ids) > 10000:
            self._seen_ids = set(list(self._seen_ids)[-5000:])

        now = datetime.now(timezone.utc)
        published_str = article.get("pubDate") or article.get("addDate")
        published_at = None
        if published_str:
            try:
                published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        # Classify
        event_type = EventType.OTHER.value
        categories = article.get("categories", [])
        for cat in categories:
            cat_name = cat.get("name", "") if isinstance(cat, dict) else str(cat)
            if cat_name in CATEGORY_MAP:
                event_type = CATEGORY_MAP[cat_name]
                break

        # Map affected instruments
        title = article.get("title", "")
        description = article.get("description", "") or ""
        text = f"{title} {description}".lower()
        instruments = set()
        for keyword, insts in TOPIC_INSTRUMENT_MAP.items():
            if keyword in text:
                instruments.update(insts)

        # Sentiment
        sentiment = article.get("sentiment")
        sentiment_score = None
        if sentiment and isinstance(sentiment, dict):
            sentiment_score = sentiment.get("score")

        # Cluster ID from Perigon
        cluster_id = article.get("clusterId")

        event = IngestedEvent(
            source=EventSource.PERIGON.value,
            source_url=article.get("url"),
            source_article_id=str(article_id),
            first_seen_at=now,
            published_at=published_at,
            title=title,
            summary=description[:500] if description else None,
            event_type=event_type,
            extracted_entities=article.get("entities"),
            affected_instruments=list(instruments) if instruments else None,
            sentiment_score=sentiment_score,
            confidence_score=None,
            credibility_score=article.get("sourceReliability"),
            dedup_cluster_id=str(cluster_id) if cluster_id else None,
            is_first_publication=None,
            raw_payload=article,
        )
        await self._emit(event)

    async def health_check(self) -> dict:
        return {
            "name": self.name,
            "running": self._running,
            "seen_articles": len(self._seen_ids),
            "topics_count": len(self.topics),
        }

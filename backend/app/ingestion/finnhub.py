"""Finnhub news sentiment and economic calendar ingestion."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta

import httpx
import structlog

from app.config.settings import settings
from app.ingestion.base import BaseIngester, IngestedEvent
from app.models.events import EventSource, EventType

logger = structlog.get_logger()


class FinnhubNewsIngester(BaseIngester):
    """Polls Finnhub for general and forex news with sentiment."""

    def __init__(self, poll_interval: float = 60.0, categories: list[str] | None = None):
        super().__init__("finnhub_news")
        self.poll_interval = poll_interval
        self.categories = categories or ["general", "forex"]
        self._client: httpx.AsyncClient | None = None
        self._task: asyncio.Task | None = None
        self._seen_ids: set[str] = set()

    async def start(self):
        self._running = True
        self._client = httpx.AsyncClient(timeout=30.0)
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("finnhub_news_started", categories=self.categories)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        if self._client:
            await self._client.aclose()

    async def _poll_loop(self):
        while self._running:
            try:
                await self._fetch_news()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("finnhub_news_poll_error")
            await asyncio.sleep(self.poll_interval)

    async def _fetch_news(self):
        if not settings.finnhub.api_key:
            return

        for category in self.categories:
            try:
                resp = await self._client.get(
                    f"{settings.finnhub.api_url}/news",
                    params={"category": category, "token": settings.finnhub.api_key},
                )
                if resp.status_code != 200:
                    logger.warning("finnhub_news_error", status=resp.status_code)
                    continue

                articles = resp.json()
                for article in articles:
                    await self._process_article(article)

            except httpx.HTTPError:
                logger.exception("finnhub_http_error", category=category)

    async def _process_article(self, article: dict):
        article_id = str(article.get("id", ""))
        if article_id in self._seen_ids:
            return
        self._seen_ids.add(article_id)

        if len(self._seen_ids) > 10000:
            self._seen_ids = set(list(self._seen_ids)[-5000:])

        now = datetime.now(timezone.utc)
        published_ts = article.get("datetime")
        published_at = (
            datetime.fromtimestamp(published_ts, tz=timezone.utc) if published_ts else None
        )

        event = IngestedEvent(
            source=EventSource.FINNHUB.value,
            source_url=article.get("url"),
            source_article_id=article_id,
            first_seen_at=now,
            published_at=published_at,
            title=article.get("headline", ""),
            summary=article.get("summary", "")[:500],
            event_type=EventType.OTHER.value,
            raw_payload=article,
        )
        await self._emit(event)

    async def health_check(self) -> dict:
        return {
            "name": self.name,
            "running": self._running,
            "seen_articles": len(self._seen_ids),
        }


class FinnhubCalendarIngester(BaseIngester):
    """Polls Finnhub economic calendar for scheduled macro releases."""

    def __init__(self, poll_interval: float = 300.0):
        super().__init__("finnhub_calendar")
        self.poll_interval = poll_interval
        self._client: httpx.AsyncClient | None = None
        self._task: asyncio.Task | None = None
        self._seen_ids: set[str] = set()

    async def start(self):
        self._running = True
        self._client = httpx.AsyncClient(timeout=30.0)
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("finnhub_calendar_started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        if self._client:
            await self._client.aclose()

    async def _poll_loop(self):
        while self._running:
            try:
                await self._fetch_calendar()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("finnhub_calendar_poll_error")
            await asyncio.sleep(self.poll_interval)

    async def _fetch_calendar(self):
        if not settings.finnhub.api_key:
            return

        today = datetime.now(timezone.utc).date()
        from_date = today.isoformat()
        to_date = (today + timedelta(days=7)).isoformat()

        try:
            resp = await self._client.get(
                f"{settings.finnhub.api_url}/calendar/economic",
                params={
                    "from": from_date,
                    "to": to_date,
                    "token": settings.finnhub.api_key,
                },
            )
            if resp.status_code != 200:
                logger.warning("finnhub_calendar_error", status=resp.status_code)
                return

            data = resp.json()
            for entry in data.get("economicCalendar", []):
                await self._process_entry(entry)

        except httpx.HTTPError:
            logger.exception("finnhub_calendar_http_error")

    async def _process_entry(self, entry: dict):
        event_id = f"{entry.get('event', '')}_{entry.get('time', '')}"
        if event_id in self._seen_ids:
            return
        self._seen_ids.add(event_id)

        if len(self._seen_ids) > 5000:
            self._seen_ids = set(list(self._seen_ids)[-2500:])

        now = datetime.now(timezone.utc)
        event_time_str = entry.get("time")
        published_at = None
        if event_time_str:
            try:
                published_at = datetime.fromisoformat(event_time_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        # Determine event type
        event_name = entry.get("event", "").lower()
        event_type = EventType.MACRO_RELEASE.value
        if any(kw in event_name for kw in ["rate decision", "interest rate", "monetary policy"]):
            event_type = EventType.CENTRAL_BANK.value

        title = entry.get("event", "Unknown Economic Event")
        country = entry.get("country", "")
        impact = entry.get("impact", "")

        event = IngestedEvent(
            source=EventSource.CALENDAR.value,
            source_url=None,
            source_article_id=event_id,
            first_seen_at=now,
            published_at=published_at,
            title=f"[{country}] {title}",
            summary=f"Impact: {impact}, Previous: {entry.get('prev')}, "
            f"Estimate: {entry.get('estimate')}, Actual: {entry.get('actual')}",
            event_type=event_type,
            confidence_score=1.0,
            credibility_score=1.0,
            raw_payload=entry,
        )
        await self._emit(event)

    async def health_check(self) -> dict:
        return {
            "name": self.name,
            "running": self._running,
            "seen_events": len(self._seen_ids),
        }

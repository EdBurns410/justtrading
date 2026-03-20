"""OANDA v20 price stream and transaction stream ingestion."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

import aiohttp
import structlog

from app.config.settings import settings
from app.ingestion.base import BaseIngester, IngestedEvent
from app.models.events import EventSource, EventType

logger = structlog.get_logger()


class OANDAPriceStream(BaseIngester):
    """Consumes OANDA v20 streaming prices for a set of instruments."""

    def __init__(self, instruments: list[str]):
        super().__init__("oanda_price_stream")
        self.instruments = instruments
        self._session: aiohttp.ClientSession | None = None
        self._task: asyncio.Task | None = None
        self._last_prices: dict[str, dict] = {}

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.oanda.api_token}",
            "Content-Type": "application/json",
        }

    async def start(self):
        self._running = True
        self._session = aiohttp.ClientSession()
        self._task = asyncio.create_task(self._stream_prices())
        logger.info("oanda_price_stream_started", instruments=self.instruments)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        if self._session:
            await self._session.close()
        logger.info("oanda_price_stream_stopped")

    async def _stream_prices(self):
        instruments_param = ",".join(self.instruments)
        url = (
            f"{settings.oanda.effective_stream_url}/v3/accounts/"
            f"{settings.oanda.account_id}/pricing/stream"
            f"?instruments={instruments_param}"
        )

        while self._running:
            try:
                async with self._session.get(url, headers=self._headers) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("oanda_stream_error", status=resp.status, body=body)
                        await asyncio.sleep(5)
                        continue

                    async for line in resp.content:
                        if not self._running:
                            break
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        if data.get("type") == "PRICE":
                            await self._handle_price(data)
                        elif data.get("type") == "HEARTBEAT":
                            pass

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("oanda_stream_reconnect")
                await asyncio.sleep(5)

    async def _handle_price(self, data: dict):
        instrument = data["instrument"]
        self._last_prices[instrument] = {
            "bid": float(data["bids"][0]["price"]) if data.get("bids") else None,
            "ask": float(data["asks"][0]["price"]) if data.get("asks") else None,
            "time": data.get("time"),
            "tradeable": data.get("tradeable", False),
            "spread": None,
        }
        price = self._last_prices[instrument]
        if price["bid"] and price["ask"]:
            price["spread"] = price["ask"] - price["bid"]

    def get_price(self, instrument: str) -> dict | None:
        return self._last_prices.get(instrument)

    def get_spread(self, instrument: str) -> float | None:
        price = self._last_prices.get(instrument)
        return price["spread"] if price else None

    async def health_check(self) -> dict:
        return {
            "name": self.name,
            "running": self._running,
            "instruments_tracked": len(self._last_prices),
            "instruments": list(self._last_prices.keys()),
        }


class OANDATransactionStream(BaseIngester):
    """Consumes OANDA v20 transaction stream for account events."""

    def __init__(self):
        super().__init__("oanda_transaction_stream")
        self._session: aiohttp.ClientSession | None = None
        self._task: asyncio.Task | None = None

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.oanda.api_token}",
            "Content-Type": "application/json",
        }

    async def start(self):
        self._running = True
        self._session = aiohttp.ClientSession()
        self._task = asyncio.create_task(self._stream_transactions())
        logger.info("oanda_transaction_stream_started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        if self._session:
            await self._session.close()

    async def _stream_transactions(self):
        url = (
            f"{settings.oanda.effective_stream_url}/v3/accounts/"
            f"{settings.oanda.account_id}/transactions/stream"
        )

        while self._running:
            try:
                async with self._session.get(url, headers=self._headers) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("oanda_txn_stream_error", status=resp.status, body=body)
                        await asyncio.sleep(5)
                        continue

                    async for line in resp.content:
                        if not self._running:
                            break
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        if data.get("type") == "HEARTBEAT":
                            continue

                        await self._handle_transaction(data)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("oanda_txn_stream_reconnect")
                await asyncio.sleep(5)

    async def _handle_transaction(self, data: dict):
        now = datetime.now(timezone.utc)
        event = IngestedEvent(
            source=EventSource.OANDA.value,
            source_url=None,
            source_article_id=data.get("id"),
            first_seen_at=now,
            published_at=None,
            title=f"OANDA Transaction: {data.get('type', 'UNKNOWN')}",
            summary=json.dumps(data),
            event_type=EventType.PRICE_ACTION.value,
            raw_payload=data,
        )
        await self._emit(event)

    async def health_check(self) -> dict:
        return {"name": self.name, "running": self._running}


class OANDAAccountPoller(BaseIngester):
    """Polls OANDA account state for equity/margin snapshots."""

    def __init__(self, poll_interval: float = 5.0):
        super().__init__("oanda_account_poller")
        self.poll_interval = poll_interval
        self._session: aiohttp.ClientSession | None = None
        self._task: asyncio.Task | None = None
        self.account_state: dict = {}

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.oanda.api_token}",
            "Content-Type": "application/json",
        }

    async def start(self):
        self._running = True
        self._session = aiohttp.ClientSession()
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("oanda_account_poller_started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        if self._session:
            await self._session.close()

    async def _poll_loop(self):
        while self._running:
            try:
                await self._fetch_account()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("oanda_account_poll_error")
            await asyncio.sleep(self.poll_interval)

    async def _fetch_account(self):
        url = (
            f"{settings.oanda.effective_api_url}/v3/accounts/"
            f"{settings.oanda.account_id}/summary"
        )
        async with self._session.get(url, headers=self._headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                account = data.get("account", {})
                self.account_state = {
                    "balance": float(account.get("balance", 0)),
                    "unrealized_pl": float(account.get("unrealizedPL", 0)),
                    "nav": float(account.get("NAV", 0)),
                    "margin_used": float(account.get("marginUsed", 0)),
                    "margin_available": float(account.get("marginAvailable", 0)),
                    "open_trade_count": int(account.get("openTradeCount", 0)),
                    "open_position_count": int(account.get("openPositionCount", 0)),
                    "pl": float(account.get("pl", 0)),
                    "financing": float(account.get("financing", 0)),
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                }

    async def health_check(self) -> dict:
        return {
            "name": self.name,
            "running": self._running,
            "has_state": bool(self.account_state),
        }

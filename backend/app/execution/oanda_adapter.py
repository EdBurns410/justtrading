"""OANDA v20 execution adapter — order management and trade lifecycle."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx
import structlog

from app.config.settings import settings
from app.models.executions import OrderStatus

logger = structlog.get_logger()


class OANDAExecutionAdapter:
    """Manages order submission, modification, and closure via OANDA v20 API."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.oanda.api_token}",
            "Content-Type": "application/json",
            "Accept-Datetime-Format": "RFC3339",
        }

    @property
    def _base_url(self) -> str:
        return f"{settings.oanda.effective_api_url}/v3/accounts/{settings.oanda.account_id}"

    async def start(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        logger.info("oanda_execution_adapter_started")

    async def stop(self):
        if self._client:
            await self._client.aclose()

    async def submit_market_order(
        self,
        instrument: str,
        units: float,
        stop_loss_price: float | None = None,
        take_profit_price: float | None = None,
        time_in_force: str = "FOK",
    ) -> dict:
        """Submit a market order to OANDA."""
        order_body: dict[str, Any] = {
            "order": {
                "type": "MARKET",
                "instrument": instrument,
                "units": str(units),
                "timeInForce": time_in_force,
                "positionFill": "DEFAULT",
            }
        }

        if stop_loss_price is not None:
            order_body["order"]["stopLossOnFill"] = {
                "price": f"{stop_loss_price:.5f}",
                "timeInForce": "GTC",
            }

        if take_profit_price is not None:
            order_body["order"]["takeProfitOnFill"] = {
                "price": f"{take_profit_price:.5f}",
                "timeInForce": "GTC",
            }

        submitted_at = datetime.now(timezone.utc)

        try:
            resp = await self._client.post(
                f"{self._base_url}/orders",
                json=order_body,
                headers=self._headers,
            )
            response_data = resp.json()

            if resp.status_code == 201:
                fill = response_data.get("orderFillTransaction", {})
                return {
                    "status": OrderStatus.FILLED.value,
                    "broker_order_id": fill.get("orderID"),
                    "broker_trade_id": fill.get("tradeOpened", {}).get("tradeID"),
                    "fill_price": float(fill.get("price", 0)),
                    "fill_at": fill.get("time"),
                    "units_filled": float(fill.get("units", 0)),
                    "submitted_at": submitted_at.isoformat(),
                    "raw_response": response_data,
                }
            else:
                reject = response_data.get("orderRejectTransaction", {})
                return {
                    "status": OrderStatus.REJECTED.value,
                    "reason": reject.get("rejectReason", "Unknown"),
                    "submitted_at": submitted_at.isoformat(),
                    "raw_response": response_data,
                }

        except httpx.HTTPError as e:
            logger.exception("oanda_order_error", instrument=instrument)
            return {
                "status": "error",
                "reason": str(e),
                "submitted_at": submitted_at.isoformat(),
            }

    async def close_trade(self, trade_id: str, units: str | None = None) -> dict:
        """Close an open trade."""
        body = {}
        if units:
            body["units"] = units

        try:
            resp = await self._client.put(
                f"{self._base_url}/trades/{trade_id}/close",
                json=body,
                headers=self._headers,
            )
            return resp.json()
        except httpx.HTTPError as e:
            logger.exception("oanda_close_error", trade_id=trade_id)
            return {"error": str(e)}

    async def modify_trade(
        self,
        trade_id: str,
        stop_loss: float | None = None,
        take_profit: float | None = None,
        trailing_stop_distance: float | None = None,
    ) -> dict:
        """Modify stop loss / take profit on an existing trade."""
        body: dict[str, Any] = {}
        if stop_loss is not None:
            body["stopLoss"] = {"price": f"{stop_loss:.5f}", "timeInForce": "GTC"}
        if take_profit is not None:
            body["takeProfit"] = {"price": f"{take_profit:.5f}", "timeInForce": "GTC"}
        if trailing_stop_distance is not None:
            body["trailingStopLoss"] = {"distance": f"{trailing_stop_distance:.5f}", "timeInForce": "GTC"}

        try:
            resp = await self._client.put(
                f"{self._base_url}/trades/{trade_id}/orders",
                json=body,
                headers=self._headers,
            )
            return resp.json()
        except httpx.HTTPError as e:
            logger.exception("oanda_modify_error", trade_id=trade_id)
            return {"error": str(e)}

    async def get_open_trades(self) -> list[dict]:
        """Get all open trades for the account."""
        try:
            resp = await self._client.get(
                f"{self._base_url}/openTrades",
                headers=self._headers,
            )
            data = resp.json()
            return data.get("trades", [])
        except httpx.HTTPError as e:
            logger.exception("oanda_open_trades_error")
            return []

    async def get_open_positions(self) -> list[dict]:
        """Get all open positions."""
        try:
            resp = await self._client.get(
                f"{self._base_url}/openPositions",
                headers=self._headers,
            )
            data = resp.json()
            return data.get("positions", [])
        except httpx.HTTPError as e:
            logger.exception("oanda_positions_error")
            return []

    async def get_account_summary(self) -> dict:
        """Get account summary."""
        try:
            resp = await self._client.get(
                f"{self._base_url}/summary",
                headers=self._headers,
            )
            data = resp.json()
            return data.get("account", {})
        except httpx.HTTPError as e:
            logger.exception("oanda_summary_error")
            return {}

    async def get_candles(
        self,
        instrument: str,
        granularity: str = "M5",
        count: int = 100,
    ) -> list[dict]:
        """Get historical candle data."""
        try:
            resp = await self._client.get(
                f"{settings.oanda.effective_api_url}/v3/instruments/{instrument}/candles",
                params={
                    "granularity": granularity,
                    "count": count,
                    "price": "MBA",
                },
                headers=self._headers,
            )
            data = resp.json()
            return data.get("candles", [])
        except httpx.HTTPError as e:
            logger.exception("oanda_candles_error", instrument=instrument)
            return []

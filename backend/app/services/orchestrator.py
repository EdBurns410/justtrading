"""Trade orchestrator — connects events, strategies, risk, and execution."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.execution.oanda_adapter import OANDAExecutionAdapter
from app.ingestion.manager import IngestionManager
from app.models.decisions import Decision
from app.models.events import Event
from app.models.executions import Execution, OrderStatus
from app.models.strategies import BotStage
from app.risk.engine import RiskAssessment, RiskEngine
from app.services.database import async_session_factory
from app.strategies.base import BaseStrategyBot, TradeSignal

logger = structlog.get_logger()


class TradeOrchestrator:
    """Coordinates the full event -> decision -> risk -> execution pipeline."""

    def __init__(
        self,
        ingestion: IngestionManager,
        execution: OANDAExecutionAdapter,
        risk_engine: RiskEngine,
        bots: list[BaseStrategyBot] | None = None,
    ):
        self.ingestion = ingestion
        self.execution = execution
        self.risk_engine = risk_engine
        self.bots: list[BaseStrategyBot] = bots or []

        # Stats
        self._signals_received = 0
        self._signals_approved = 0
        self._signals_rejected = 0
        self._orders_submitted = 0
        self._orders_filled = 0

    def add_bot(self, bot: BaseStrategyBot):
        """Register a strategy bot."""
        bot.on_signal(self._handle_signal)
        self.bots.append(bot)

    async def start(self):
        """Start the full pipeline."""
        # Connect ingestion events to all bots
        self.ingestion.on_event(self._route_event_to_bots)

        # Start execution adapter
        await self.execution.start()

        # Start all bots
        for bot in self.bots:
            bot.on_signal(self._handle_signal)
            await bot.start()

        # Start ingestion last (it triggers everything)
        await self.ingestion.start()

        logger.info(
            "orchestrator_started",
            bots=len(self.bots),
            bot_ids=[b.bot_id for b in self.bots],
        )

    async def stop(self):
        """Stop the full pipeline."""
        await self.ingestion.stop()
        for bot in self.bots:
            await bot.stop()
        await self.execution.stop()
        logger.info("orchestrator_stopped")

    async def _route_event_to_bots(self, event: Event):
        """Route a persisted event to all running bots."""
        tasks = []
        for bot in self.bots:
            if bot._running and bot.stage in (
                BotStage.PAPER_LIVE.value,
                BotStage.SHADOW.value,
                BotStage.MICRO_LIVE.value,
                BotStage.LIVE.value,
            ):
                tasks.append(bot.handle_event(event))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _handle_signal(self, signal: TradeSignal):
        """Process a trade signal: risk check -> decision record -> execution."""
        self._signals_received += 1

        # Run risk assessment
        assessment = await self.risk_engine.assess(signal)

        # Find the bot
        bot = next((b for b in self.bots if b.bot_id == signal.bot_id), None)
        is_live = bot and bot.stage == BotStage.LIVE.value

        # Persist the decision
        async with async_session_factory() as session:
            event_id = uuid.UUID(signal.event_id) if signal.event_id else None

            # Get account snapshot
            account = self.ingestion.account_poller.account_state
            price = self.ingestion.price_stream.get_price(signal.instrument) or {}

            decision = Decision(
                event_id=event_id,
                bot_id=signal.bot_id,
                strategy_version=signal.strategy_version,
                features_used=signal.features_used,
                market_regime=signal.market_regime,
                spread_snapshot=price.get("spread"),
                account_equity=account.get("nav"),
                account_margin_used=account.get("margin_used"),
                account_margin_available=account.get("margin_available"),
                risk_checks=assessment.to_dict(),
                all_risk_checks_passed=assessment.all_passed,
                action=signal.direction if assessment.approved else "SKIP",
                instrument=signal.instrument,
                confidence=signal.confidence,
                reason=signal.reason,
                expected_holding_period=signal.expected_holding_period,
                decision_at=datetime.now(timezone.utc),
            )

            session.add(decision)

            if assessment.approved and is_live:
                # Execute the trade
                self._signals_approved += 1
                execution_result = await self._execute_trade(signal, decision, session)
            elif assessment.approved and not is_live:
                # Paper trade - log but don't execute
                self._signals_approved += 1
                logger.info(
                    "paper_trade_signal",
                    bot_id=signal.bot_id,
                    instrument=signal.instrument,
                    direction=signal.direction,
                    stage=bot.stage if bot else "unknown",
                )
            else:
                self._signals_rejected += 1
                logger.info(
                    "signal_rejected_risk",
                    bot_id=signal.bot_id,
                    instrument=signal.instrument,
                    failed=[c.check_name for c in assessment.checks if not c.passed],
                )

            await session.commit()

    async def _execute_trade(
        self, signal: TradeSignal, decision: Decision, session: AsyncSession
    ) -> dict | None:
        """Execute a trade via OANDA."""
        self._orders_submitted += 1

        # Calculate position size (simplified — production needs proper sizing)
        units = signal.size_units or 1000  # Default micro lot
        if signal.direction == "SHORT":
            units = -abs(units)
        else:
            units = abs(units)

        # Calculate stop/tp prices from pips
        price_data = self.ingestion.price_stream.get_price(signal.instrument)
        stop_price = None
        tp_price = None

        if price_data:
            entry_price = price_data["ask"] if units > 0 else price_data["bid"]
            pip_size = 0.01 if "JPY" in signal.instrument else 0.0001

            if signal.stop_loss_pips and entry_price:
                if units > 0:
                    stop_price = entry_price - (signal.stop_loss_pips * pip_size)
                else:
                    stop_price = entry_price + (signal.stop_loss_pips * pip_size)

            if signal.take_profit_pips and entry_price:
                if units > 0:
                    tp_price = entry_price + (signal.take_profit_pips * pip_size)
                else:
                    tp_price = entry_price - (signal.take_profit_pips * pip_size)

        result = await self.execution.submit_market_order(
            instrument=signal.instrument,
            units=units,
            stop_loss_price=stop_price,
            take_profit_price=tp_price,
        )

        # Record execution
        execution = Execution(
            broker_order_id=result.get("broker_order_id"),
            broker_trade_id=result.get("broker_trade_id"),
            order_submitted_at=datetime.fromisoformat(result["submitted_at"]),
            fill_at=(
                datetime.fromisoformat(result["fill_at"])
                if result.get("fill_at")
                else None
            ),
            instrument=signal.instrument,
            direction=signal.direction,
            size=abs(units),
            order_type="MARKET",
            requested_price=price_data.get("ask") if price_data and units > 0 else (
                price_data.get("bid") if price_data else None
            ),
            fill_price=result.get("fill_price"),
            stop_loss=stop_price,
            take_profit=tp_price,
            slippage=None,
            spread_at_entry=price_data.get("spread") if price_data else None,
            status=result.get("status", OrderStatus.PENDING.value),
            broker_response=result.get("raw_response"),
        )

        # Compute slippage
        if execution.fill_price and execution.requested_price:
            execution.slippage = abs(execution.fill_price - execution.requested_price)

        session.add(execution)
        await session.flush()

        decision.execution_id = execution.id

        if result.get("status") == OrderStatus.FILLED.value:
            self._orders_filled += 1

        logger.info(
            "trade_executed",
            bot_id=signal.bot_id,
            instrument=signal.instrument,
            status=result.get("status"),
            fill_price=result.get("fill_price"),
        )

        return result

    def get_status(self) -> dict:
        return {
            "bots": [b.get_status() for b in self.bots],
            "signals_received": self._signals_received,
            "signals_approved": self._signals_approved,
            "signals_rejected": self._signals_rejected,
            "orders_submitted": self._orders_submitted,
            "orders_filled": self._orders_filled,
        }

"""Governance and promotion pipeline — manages bot lifecycle from research to live."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any

import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.strategies import BotStage, PromotionRecord, StrategyBot
from app.models.decisions import Decision
from app.models.executions import Execution
from app.models.outcomes import Outcome

logger = structlog.get_logger()


@dataclass
class GateResult:
    """Result of evaluating a single promotion gate."""

    gate_name: str
    passed: bool
    value: Any = None
    threshold: Any = None
    message: str = ""


@dataclass
class GateEvaluation:
    """Full evaluation of all gates for a stage transition."""

    from_stage: str
    to_stage: str
    gates: list[GateResult] = field(default_factory=list)

    @property
    def all_passed(self) -> bool:
        return all(g.passed for g in self.gates)

    def to_dict(self) -> dict:
        return {
            "from_stage": self.from_stage,
            "to_stage": self.to_stage,
            "all_passed": self.all_passed,
            "gates": {
                g.gate_name: {
                    "passed": g.passed,
                    "value": g.value,
                    "threshold": g.threshold,
                    "message": g.message,
                }
                for g in self.gates
            },
        }


# Stage transitions
STAGE_TRANSITIONS = {
    BotStage.RESEARCH.value: BotStage.BACKTEST.value,
    BotStage.BACKTEST.value: BotStage.PAPER_LIVE.value,
    BotStage.PAPER_LIVE.value: BotStage.SHADOW.value,
    BotStage.SHADOW.value: BotStage.PROMOTION_GATE.value,
    BotStage.PROMOTION_GATE.value: BotStage.LIVE.value,
}

# Gate requirements per transition
BACKTEST_GATES = {
    "min_trades": 50,
    "min_profit_factor": 1.3,
    "max_drawdown_pct": 15.0,
    "min_expectancy": 0.5,
    "min_win_rate": 0.35,
}

FORWARD_TEST_GATES = {
    "min_days": 14,
    "min_trades": 10,
    "max_risk_breaches": 0,
    "max_slippage_deviation_pct": 50.0,
    "min_rationale_completeness": 0.9,
    "max_performance_deviation_pct": 30.0,
}

LIVE_GATES = {
    "version_hash_required": True,
    "kill_switch_required": True,
    "alerting_required": True,
}


class PromotionPipeline:
    """Manages the promotion lifecycle for strategy bots."""

    async def evaluate_promotion(
        self, bot_id: str, session: AsyncSession
    ) -> GateEvaluation:
        """Evaluate whether a bot can be promoted to its next stage."""
        bot = await self._get_bot(bot_id, session)
        if not bot:
            return GateEvaluation(
                from_stage="unknown",
                to_stage="unknown",
                gates=[GateResult("bot_exists", False, message="Bot not found")],
            )

        current_stage = bot.stage
        next_stage = STAGE_TRANSITIONS.get(current_stage)
        if not next_stage:
            return GateEvaluation(
                from_stage=current_stage,
                to_stage="none",
                gates=[GateResult("has_next_stage", False, message="No next stage available")],
            )

        evaluation = GateEvaluation(from_stage=current_stage, to_stage=next_stage)

        if next_stage == BotStage.PAPER_LIVE.value:
            # Backtest gates
            await self._evaluate_backtest_gates(bot, evaluation, session)
        elif next_stage in (BotStage.SHADOW.value, BotStage.PROMOTION_GATE.value):
            # Forward test gates
            await self._evaluate_forward_test_gates(bot, evaluation, session)
        elif next_stage == BotStage.LIVE.value:
            # Live gates
            self._evaluate_live_gates(bot, evaluation)
        else:
            evaluation.gates.append(
                GateResult("manual_promotion", True, message="Manual promotion allowed")
            )

        return evaluation

    async def promote(
        self, bot_id: str, session: AsyncSession, force: bool = False
    ) -> PromotionRecord | None:
        """Attempt to promote a bot to its next stage."""
        evaluation = await self.evaluate_promotion(bot_id, session)

        if not evaluation.all_passed and not force:
            logger.warning(
                "promotion_blocked",
                bot_id=bot_id,
                failed_gates=[g.gate_name for g in evaluation.gates if not g.passed],
            )
            return None

        bot = await self._get_bot(bot_id, session)
        if not bot:
            return None

        # Fetch metrics for promotion record
        metrics = await self._compute_metrics(bot.bot_id, session)

        now = datetime.now(timezone.utc)
        record = PromotionRecord(
            bot_db_id=bot.id,
            from_stage=evaluation.from_stage,
            to_stage=evaluation.to_stage,
            promoted_at=now,
            gate_results=evaluation.to_dict(),
            all_gates_passed=evaluation.all_passed,
            total_trades=metrics.get("total_trades"),
            win_rate=metrics.get("win_rate"),
            profit_factor=metrics.get("profit_factor"),
            max_drawdown_pct=metrics.get("max_drawdown_pct"),
            expectancy=metrics.get("expectancy"),
            notes="Force promoted" if force else None,
        )

        bot.stage = evaluation.to_stage
        bot.stage_entered_at = now

        session.add(record)
        await session.flush()

        logger.info(
            "bot_promoted",
            bot_id=bot_id,
            from_stage=evaluation.from_stage,
            to_stage=evaluation.to_stage,
            forced=force,
        )

        return record

    async def _get_bot(self, bot_id: str, session: AsyncSession) -> StrategyBot | None:
        result = await session.execute(
            select(StrategyBot).where(StrategyBot.bot_id == bot_id)
        )
        return result.scalar_one_or_none()

    async def _evaluate_backtest_gates(
        self, bot: StrategyBot, evaluation: GateEvaluation, session: AsyncSession
    ):
        metrics = await self._compute_metrics(bot.bot_id, session)

        total_trades = metrics.get("total_trades", 0)
        evaluation.gates.append(GateResult(
            "min_trades", total_trades >= BACKTEST_GATES["min_trades"],
            value=total_trades, threshold=BACKTEST_GATES["min_trades"],
        ))

        pf = metrics.get("profit_factor", 0)
        evaluation.gates.append(GateResult(
            "min_profit_factor", pf >= BACKTEST_GATES["min_profit_factor"],
            value=pf, threshold=BACKTEST_GATES["min_profit_factor"],
        ))

        dd = metrics.get("max_drawdown_pct", 100)
        evaluation.gates.append(GateResult(
            "max_drawdown", dd <= BACKTEST_GATES["max_drawdown_pct"],
            value=dd, threshold=BACKTEST_GATES["max_drawdown_pct"],
        ))

        exp = metrics.get("expectancy", 0)
        evaluation.gates.append(GateResult(
            "min_expectancy", exp >= BACKTEST_GATES["min_expectancy"],
            value=exp, threshold=BACKTEST_GATES["min_expectancy"],
        ))

        wr = metrics.get("win_rate", 0)
        evaluation.gates.append(GateResult(
            "min_win_rate", wr >= BACKTEST_GATES["min_win_rate"],
            value=wr, threshold=BACKTEST_GATES["min_win_rate"],
        ))

    async def _evaluate_forward_test_gates(
        self, bot: StrategyBot, evaluation: GateEvaluation, session: AsyncSession
    ):
        # Check minimum days in stage
        if bot.stage_entered_at:
            days_in_stage = (datetime.now(timezone.utc) - bot.stage_entered_at).days
        else:
            days_in_stage = 0

        evaluation.gates.append(GateResult(
            "min_days", days_in_stage >= FORWARD_TEST_GATES["min_days"],
            value=days_in_stage, threshold=FORWARD_TEST_GATES["min_days"],
            message=f"{days_in_stage} days in stage",
        ))

        metrics = await self._compute_metrics(bot.bot_id, session)

        total = metrics.get("total_trades", 0)
        evaluation.gates.append(GateResult(
            "min_trades", total >= FORWARD_TEST_GATES["min_trades"],
            value=total, threshold=FORWARD_TEST_GATES["min_trades"],
        ))

        # Check risk breaches (decisions where risk checks failed)
        breach_count = await self._count_risk_breaches(bot.bot_id, session)
        evaluation.gates.append(GateResult(
            "no_risk_breaches", breach_count <= FORWARD_TEST_GATES["max_risk_breaches"],
            value=breach_count, threshold=FORWARD_TEST_GATES["max_risk_breaches"],
        ))

    def _evaluate_live_gates(self, bot: StrategyBot, evaluation: GateEvaluation):
        evaluation.gates.append(GateResult(
            "version_hash",
            bool(bot.version_hash),
            message="Version hash required for live deployment",
        ))
        evaluation.gates.append(GateResult(
            "kill_switch",
            bot.kill_switch_active is not None,
            message="Kill switch must be configured",
        ))
        evaluation.gates.append(GateResult(
            "alerting",
            bot.alerting_configured,
            message="Alerting must be configured",
        ))

    async def _compute_metrics(self, bot_id: str, session: AsyncSession) -> dict:
        """Compute aggregate metrics for a bot's trades."""
        # Get all outcomes for this bot's decisions
        result = await session.execute(
            select(Outcome)
            .join(Execution, Outcome.execution_id == Execution.id)
            .join(Decision, Decision.execution_id == Execution.id)
            .where(Decision.bot_id == bot_id)
        )
        outcomes = result.scalars().all()

        if not outcomes:
            return {"total_trades": 0}

        total = len(outcomes)
        wins = sum(1 for o in outcomes if o.realised_pnl > 0)
        losses = sum(1 for o in outcomes if o.realised_pnl <= 0)
        gross_profit = sum(o.realised_pnl for o in outcomes if o.realised_pnl > 0)
        gross_loss = abs(sum(o.realised_pnl for o in outcomes if o.realised_pnl <= 0))
        total_pnl = sum(o.realised_pnl for o in outcomes)

        # Running drawdown
        cumulative = 0.0
        peak = 0.0
        max_dd = 0.0
        for o in sorted(outcomes, key=lambda x: x.exit_at):
            cumulative += o.realised_pnl
            if cumulative > peak:
                peak = cumulative
            dd = peak - cumulative
            if dd > max_dd:
                max_dd = dd

        return {
            "total_trades": total,
            "wins": wins,
            "losses": losses,
            "win_rate": wins / total if total else 0,
            "profit_factor": gross_profit / gross_loss if gross_loss else float("inf"),
            "expectancy": total_pnl / total if total else 0,
            "total_pnl": total_pnl,
            "max_drawdown": max_dd,
            "max_drawdown_pct": (max_dd / peak * 100) if peak else 0,
        }

    async def _count_risk_breaches(self, bot_id: str, session: AsyncSession) -> int:
        result = await session.execute(
            select(func.count(Decision.id))
            .where(Decision.bot_id == bot_id)
            .where(Decision.all_risk_checks_passed == False)  # noqa: E712
        )
        return result.scalar() or 0

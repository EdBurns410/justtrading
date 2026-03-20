"""Risk management engine — pre-trade and portfolio-level risk checks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timezone
from typing import Any

import structlog

from app.config.settings import settings
from app.strategies.base import TradeSignal

logger = structlog.get_logger()


@dataclass
class RiskCheckResult:
    """Result of a single risk check."""

    check_name: str
    passed: bool
    value: Any = None
    threshold: Any = None
    message: str = ""


@dataclass
class RiskAssessment:
    """Full risk assessment for a trade signal."""

    signal: TradeSignal
    checks: list[RiskCheckResult]
    approved: bool = False
    assessed_at: datetime | None = None

    @property
    def all_passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> dict:
        return {
            "approved": self.approved,
            "all_passed": self.all_passed,
            "checks": {c.check_name: {"passed": c.passed, "value": c.value, "threshold": c.threshold, "message": c.message} for c in self.checks},
        }


class RiskEngine:
    """Pre-trade and portfolio-level risk management."""

    def __init__(
        self,
        account_state_fn=None,
        price_fn=None,
        open_positions_fn=None,
    ):
        self._get_account_state = account_state_fn
        self._get_price = price_fn
        self._get_open_positions = open_positions_fn
        self._daily_pnl: float = 0.0
        self._daily_pnl_date: str = ""
        self._risk_settings = settings.risk

    async def assess(self, signal: TradeSignal) -> RiskAssessment:
        """Run all risk checks against a trade signal."""
        checks: list[RiskCheckResult] = []

        account = self._get_account_state() if self._get_account_state else {}
        price = self._get_price(signal.instrument) if self._get_price else {}
        open_positions = self._get_open_positions() if self._get_open_positions else []

        checks.append(self._check_max_risk_per_trade(signal, account))
        checks.append(self._check_daily_loss(account))
        checks.append(self._check_spread(signal, price))
        checks.append(self._check_margin(account))
        checks.append(self._check_blocked_window())
        checks.append(self._check_max_exposure(signal, open_positions, account))
        checks.append(self._check_correlated_exposure(signal, open_positions, account))

        assessment = RiskAssessment(
            signal=signal,
            checks=checks,
            assessed_at=datetime.now(timezone.utc),
        )
        assessment.approved = assessment.all_passed

        log_fn = logger.info if assessment.approved else logger.warning
        log_fn(
            "risk_assessment",
            bot_id=signal.bot_id,
            instrument=signal.instrument,
            approved=assessment.approved,
            failed_checks=[c.check_name for c in checks if not c.passed],
        )

        return assessment

    def _check_max_risk_per_trade(self, signal: TradeSignal, account: dict) -> RiskCheckResult:
        """Ensure trade risk does not exceed max % of account equity."""
        equity = account.get("nav", 0)
        if not equity:
            return RiskCheckResult("max_risk_per_trade", False, message="No account equity data")

        max_risk = equity * (self._risk_settings.max_risk_per_trade_pct / 100)
        # Estimate risk from stop loss
        if signal.stop_loss_pips and signal.size_units:
            pip_value = self._estimate_pip_value(signal.instrument, signal.size_units)
            trade_risk = signal.stop_loss_pips * pip_value
        else:
            trade_risk = 0

        passed = trade_risk <= max_risk if trade_risk > 0 else True
        return RiskCheckResult(
            "max_risk_per_trade",
            passed,
            value=trade_risk,
            threshold=max_risk,
            message=f"Risk {trade_risk:.2f} vs max {max_risk:.2f}",
        )

    def _check_daily_loss(self, account: dict) -> RiskCheckResult:
        """Ensure daily P&L loss does not exceed threshold."""
        today = datetime.now(timezone.utc).date().isoformat()
        if self._daily_pnl_date != today:
            self._daily_pnl = 0.0
            self._daily_pnl_date = today

        equity = account.get("nav", 0)
        if not equity:
            return RiskCheckResult("daily_loss", False, message="No account equity data")

        max_loss = equity * (self._risk_settings.max_daily_loss_pct / 100)
        passed = abs(self._daily_pnl) < max_loss
        return RiskCheckResult(
            "daily_loss",
            passed,
            value=self._daily_pnl,
            threshold=-max_loss,
            message=f"Daily P&L {self._daily_pnl:.2f} vs max loss {-max_loss:.2f}",
        )

    def _check_spread(self, signal: TradeSignal, price: dict) -> RiskCheckResult:
        """Ensure spread is within acceptable range."""
        spread = price.get("spread")
        if spread is None:
            return RiskCheckResult("spread", False, message="No spread data available")

        max_spread = signal.max_spread_pips
        if max_spread is None:
            max_spread = self._risk_settings.max_spread_multiplier
        # Convert spread to approximate pips (for major pairs)
        spread_pips = spread * 10000 if spread < 1 else spread

        passed = spread_pips <= max_spread
        return RiskCheckResult(
            "spread",
            passed,
            value=spread_pips,
            threshold=max_spread,
            message=f"Spread {spread_pips:.1f} pips vs max {max_spread:.1f}",
        )

    def _check_margin(self, account: dict) -> RiskCheckResult:
        """Ensure margin available is above minimum threshold."""
        margin_available = account.get("margin_available", 0)
        margin_used = account.get("margin_used", 0)

        if margin_used == 0 and margin_available == 0:
            return RiskCheckResult("margin", False, message="No margin data")

        total = margin_available + margin_used
        if total == 0:
            return RiskCheckResult("margin", False, message="Zero total margin")

        margin_pct = (margin_available / total) * 100
        passed = margin_pct >= self._risk_settings.min_margin_pct
        return RiskCheckResult(
            "margin",
            passed,
            value=margin_pct,
            threshold=self._risk_settings.min_margin_pct,
            message=f"Margin available {margin_pct:.1f}% vs min {self._risk_settings.min_margin_pct}%",
        )

    def _check_blocked_window(self) -> RiskCheckResult:
        """Ensure we are not in a blocked trading window (e.g., rollover)."""
        now = datetime.now(timezone.utc).time()

        for window in self._risk_settings.blocked_windows:
            parts = window.split("-")
            if len(parts) != 2:
                continue
            start = time.fromisoformat(parts[0].strip())
            end = time.fromisoformat(parts[1].strip())

            if start <= end:
                if start <= now < end:
                    return RiskCheckResult(
                        "blocked_window", False,
                        value=now.isoformat(), threshold=window,
                        message=f"Currently in blocked window {window}",
                    )
            else:
                if now >= start or now < end:
                    return RiskCheckResult(
                        "blocked_window", False,
                        value=now.isoformat(), threshold=window,
                        message=f"Currently in blocked window {window}",
                    )

        return RiskCheckResult("blocked_window", True, message="Not in blocked window")

    def _check_max_exposure(
        self, signal: TradeSignal, positions: list, account: dict
    ) -> RiskCheckResult:
        """Ensure total open exposure does not exceed threshold."""
        equity = account.get("nav", 0)
        if not equity:
            return RiskCheckResult("max_exposure", True, message="No equity data, passing")

        # Count positions in same instrument
        same_instrument = sum(1 for p in positions if p.get("instrument") == signal.instrument)
        max_concurrent = getattr(signal, "max_concurrent", 2)

        passed = same_instrument < max_concurrent
        return RiskCheckResult(
            "max_exposure",
            passed,
            value=same_instrument,
            threshold=max_concurrent,
            message=f"{same_instrument} open in {signal.instrument} vs max {max_concurrent}",
        )

    def _check_correlated_exposure(
        self, signal: TradeSignal, positions: list, account: dict
    ) -> RiskCheckResult:
        """Check for excessive correlated exposure (e.g., USD-heavy)."""
        CORRELATION_GROUPS = {
            "USD_LONG": ["EUR_USD_SHORT", "GBP_USD_SHORT", "AUD_USD_SHORT", "USD_JPY_LONG", "USD_CHF_LONG"],
            "USD_SHORT": ["EUR_USD_LONG", "GBP_USD_LONG", "AUD_USD_LONG", "USD_JPY_SHORT", "USD_CHF_SHORT"],
            "RISK_OFF": ["XAU_USD_LONG", "USD_JPY_SHORT", "USD_CHF_SHORT"],
            "RISK_ON": ["AUD_USD_LONG", "EUR_USD_LONG"],
        }

        # Simplified: just check total open positions
        total_open = len(positions)
        max_open = int(settings.risk.max_open_exposure_pct)

        passed = total_open < max_open
        return RiskCheckResult(
            "correlated_exposure",
            passed,
            value=total_open,
            threshold=max_open,
            message=f"{total_open} open positions vs max {max_open}",
        )

    def _estimate_pip_value(self, instrument: str, units: float) -> float:
        """Rough pip value estimation for position sizing."""
        if "JPY" in instrument:
            return abs(units) * 0.01
        return abs(units) * 0.0001

    def update_daily_pnl(self, pnl: float):
        """Update running daily P&L tracker."""
        today = datetime.now(timezone.utc).date().isoformat()
        if self._daily_pnl_date != today:
            self._daily_pnl = 0.0
            self._daily_pnl_date = today
        self._daily_pnl += pnl

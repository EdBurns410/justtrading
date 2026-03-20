"""Macro FX Bot — V1 launch bot.

Trades scheduled macro releases and central bank events on a narrow
set of FX majors + gold. Rules-first, no ML, no free-form news.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from app.models.events import Event, EventType
from app.strategies.base import BaseStrategyBot, BotConfig, TradeSignal

logger = structlog.get_logger()

# Instrument reaction mappings for macro events
MACRO_INSTRUMENT_REACTIONS = {
    # US data: strong = USD up
    "US_CPI": {
        "beat": [("XAU_USD", "SHORT"), ("EUR_USD", "SHORT"), ("GBP_USD", "SHORT")],
        "miss": [("XAU_USD", "LONG"), ("EUR_USD", "LONG"), ("GBP_USD", "LONG")],
    },
    "US_NFP": {
        "beat": [("EUR_USD", "SHORT"), ("USD_JPY", "LONG"), ("XAU_USD", "SHORT")],
        "miss": [("EUR_USD", "LONG"), ("USD_JPY", "SHORT"), ("XAU_USD", "LONG")],
    },
    "US_GDP": {
        "beat": [("EUR_USD", "SHORT"), ("USD_JPY", "LONG")],
        "miss": [("EUR_USD", "LONG"), ("USD_JPY", "SHORT")],
    },
    "US_RATE_DECISION": {
        "hawkish": [("EUR_USD", "SHORT"), ("XAU_USD", "SHORT"), ("USD_JPY", "LONG")],
        "dovish": [("EUR_USD", "LONG"), ("XAU_USD", "LONG"), ("USD_JPY", "SHORT")],
    },
    # EU data
    "EU_CPI": {
        "beat": [("EUR_USD", "LONG"), ("EUR_GBP", "LONG")],
        "miss": [("EUR_USD", "SHORT"), ("EUR_GBP", "SHORT")],
    },
    "ECB_RATE_DECISION": {
        "hawkish": [("EUR_USD", "LONG"), ("EUR_GBP", "LONG")],
        "dovish": [("EUR_USD", "SHORT"), ("EUR_GBP", "SHORT")],
    },
    # UK data
    "UK_CPI": {
        "beat": [("GBP_USD", "LONG"), ("EUR_GBP", "SHORT")],
        "miss": [("GBP_USD", "SHORT"), ("EUR_GBP", "LONG")],
    },
    "BOE_RATE_DECISION": {
        "hawkish": [("GBP_USD", "LONG")],
        "dovish": [("GBP_USD", "SHORT")],
    },
    # Japan
    "BOJ_RATE_DECISION": {
        "hawkish": [("USD_JPY", "SHORT")],
        "dovish": [("USD_JPY", "LONG")],
    },
}

# Keywords to classify macro events
EVENT_CLASSIFIERS = {
    "US_CPI": ["us cpi", "consumer price index", "us inflation"],
    "US_NFP": ["nonfarm", "non-farm", "nfp", "us employment", "us payroll"],
    "US_GDP": ["us gdp", "gross domestic product"],
    "US_RATE_DECISION": ["federal reserve", "fomc", "fed rate", "fed decision"],
    "EU_CPI": ["euro area cpi", "eurozone cpi", "eu inflation", "euro inflation"],
    "ECB_RATE_DECISION": ["ecb rate", "ecb decision", "european central bank"],
    "UK_CPI": ["uk cpi", "british inflation", "uk inflation"],
    "BOE_RATE_DECISION": ["bank of england", "boe rate", "boe decision"],
    "BOJ_RATE_DECISION": ["bank of japan", "boj rate", "boj decision"],
}


def create_macro_fx_config() -> BotConfig:
    return BotConfig(
        bot_id="macro_fx_v1",
        name="Macro FX Bot V1",
        strategy_type="macro_fx",
        version="1.0.0",
        allowed_instruments=["EUR_USD", "GBP_USD", "USD_JPY", "XAU_USD", "EUR_GBP"],
        allowed_sessions=["london", "new_york", "overlap_london_ny"],
        allowed_event_types=[
            EventType.MACRO_RELEASE.value,
            EventType.CENTRAL_BANK.value,
        ],
        confidence_threshold=0.65,
        max_spread_pips=3.0,
        max_slippage_pips=2.0,
        max_concurrent_exposure=2,
        parameters={
            "default_stop_pips": 30,
            "default_tp_pips": 45,
            "expected_holding": "1h-4h",
            "min_credibility": 0.8,
        },
    )


class MacroFXBot(BaseStrategyBot):
    """V1 Macro FX bot — trades scheduled releases and central bank decisions."""

    def __init__(self, config: BotConfig | None = None):
        super().__init__(config or create_macro_fx_config())

    async def evaluate(self, event: Event) -> TradeSignal | None:
        """Evaluate a macro/central-bank event for a trade signal."""

        # Only process scheduled/credible events
        if event.credibility_score is not None and event.credibility_score < 0.8:
            logger.debug("low_credibility_skip", event_id=str(event.id))
            return None

        # Classify the event
        macro_type = self._classify_event(event)
        if not macro_type:
            return None

        # Determine beat/miss/hawkish/dovish from event data
        outcome = self._determine_outcome(event, macro_type)
        if not outcome:
            return None

        # Get reaction mapping
        reactions = MACRO_INSTRUMENT_REACTIONS.get(macro_type, {}).get(outcome, [])
        if not reactions:
            return None

        # Pick the best instrument (first one that's in allowed list)
        for instrument, direction in reactions:
            if instrument in self.config.allowed_instruments:
                confidence = self._calculate_confidence(event, macro_type, outcome)

                return TradeSignal(
                    bot_id=self.bot_id,
                    strategy_version=self.config.version,
                    instrument=instrument,
                    direction=direction,
                    confidence=confidence,
                    reason=f"{macro_type} {outcome}: {event.title}",
                    event_id=str(event.id) if event.id else None,
                    stop_loss_pips=self.config.parameters.get("default_stop_pips", 30),
                    take_profit_pips=self.config.parameters.get("default_tp_pips", 45),
                    max_spread_pips=self.config.max_spread_pips,
                    expected_holding_period=self.config.parameters.get("expected_holding", "1h-4h"),
                    features_used={
                        "macro_type": macro_type,
                        "outcome": outcome,
                        "event_type": event.event_type,
                        "credibility": event.credibility_score,
                    },
                )

        return None

    def _classify_event(self, event: Event) -> str | None:
        """Match event title/content to a known macro event type."""
        text = event.title.lower()
        if event.summary:
            text += " " + event.summary.lower()

        for macro_type, keywords in EVENT_CLASSIFIERS.items():
            if any(kw in text for kw in keywords):
                return macro_type

        return None

    def _determine_outcome(self, event: Event, macro_type: str) -> str | None:
        """Determine if the release was a beat/miss or hawkish/dovish."""
        payload = event.raw_payload or {}

        # For calendar events with actual vs estimate
        actual = payload.get("actual")
        estimate = payload.get("estimate")
        prev = payload.get("prev")

        if "RATE_DECISION" in macro_type:
            # For rate decisions, check if rate changed
            if actual is not None and estimate is not None:
                try:
                    actual_f = float(actual)
                    estimate_f = float(estimate)
                    if actual_f > estimate_f:
                        return "hawkish"
                    elif actual_f < estimate_f:
                        return "dovish"
                except (ValueError, TypeError):
                    pass

            # Fall back to sentiment
            if event.sentiment_score is not None:
                if event.sentiment_score > 0.2:
                    return "hawkish"
                elif event.sentiment_score < -0.2:
                    return "dovish"
            return None

        # For data releases (CPI, NFP, GDP)
        if actual is not None and estimate is not None:
            try:
                actual_f = float(actual)
                estimate_f = float(estimate)
                if actual_f > estimate_f:
                    return "beat"
                elif actual_f < estimate_f:
                    return "miss"
            except (ValueError, TypeError):
                pass

        # Fall back to sentiment for news-based events
        if event.sentiment_score is not None:
            if event.sentiment_score > 0.3:
                return "beat"
            elif event.sentiment_score < -0.3:
                return "miss"

        return None

    def _calculate_confidence(self, event: Event, macro_type: str, outcome: str) -> float:
        """Calculate confidence score based on event characteristics."""
        base_confidence = 0.5

        # Higher confidence for known scheduled events
        if event.source == "calendar":
            base_confidence += 0.15

        # Higher confidence if actual vs estimate is significant
        payload = event.raw_payload or {}
        actual = payload.get("actual")
        estimate = payload.get("estimate")
        if actual is not None and estimate is not None:
            try:
                surprise = abs(float(actual) - float(estimate))
                if estimate and float(estimate) != 0:
                    surprise_pct = surprise / abs(float(estimate))
                    if surprise_pct > 0.1:
                        base_confidence += 0.15
                    elif surprise_pct > 0.05:
                        base_confidence += 0.1
            except (ValueError, TypeError):
                pass

        # Higher confidence for first publication
        if event.is_first_publication:
            base_confidence += 0.05

        # Credibility boost
        if event.credibility_score and event.credibility_score > 0.9:
            base_confidence += 0.05

        return min(base_confidence, 0.95)

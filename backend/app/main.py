"""FastAPI application entry point."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.websocket import ws_router, broadcast_event
from app.config.settings import settings
from app.execution.oanda_adapter import OANDAExecutionAdapter
from app.ingestion.manager import IngestionManager
from app.risk.engine import RiskEngine
from app.services.orchestrator import TradeOrchestrator
from app.strategies.macro_fx_bot import MacroFXBot

logger = structlog.get_logger()

# Global orchestrator reference
orchestrator: TradeOrchestrator | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    global orchestrator

    logger.info("starting_justtrading", environment=settings.environment)

    # Initialise components
    ingestion = IngestionManager()
    execution = OANDAExecutionAdapter()

    risk_engine = RiskEngine(
        account_state_fn=lambda: ingestion.account_poller.account_state,
        price_fn=lambda inst: ingestion.price_stream.get_price(inst) or {},
        open_positions_fn=lambda: [],  # Will be connected to execution adapter
    )

    orchestrator = TradeOrchestrator(
        ingestion=ingestion,
        execution=execution,
        risk_engine=risk_engine,
    )

    # Register V1 bot
    macro_bot = MacroFXBot()
    orchestrator.add_bot(macro_bot)

    # Connect real-time WebSocket broadcasts
    async def on_event_broadcast(event):
        await broadcast_event("new_event", {
            "id": str(event.id),
            "title": event.title,
            "source": event.source,
            "event_type": event.event_type,
        })

    ingestion.on_event(on_event_broadcast)

    # Start if API keys are configured
    if settings.oanda.api_token:
        await orchestrator.start()
    else:
        logger.warning("oanda_not_configured", message="Set OANDA_API_TOKEN to enable trading")

    yield

    # Shutdown
    if orchestrator:
        await orchestrator.stop()


app = FastAPI(
    title="JustTrading",
    description="Event-driven trading platform with OANDA connectivity",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(ws_router, prefix="/api")


@app.get("/health")
async def health():
    """Health check endpoint."""
    health_data = {"status": "ok", "environment": settings.environment}
    if orchestrator:
        health_data["orchestrator"] = orchestrator.get_status()
        health_data["ingestion"] = await orchestrator.ingestion.health_check()
    return health_data

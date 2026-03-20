from pydantic_settings import BaseSettings
from pydantic import Field


class OANDASettings(BaseSettings):
    """OANDA API configuration."""

    model_config = {"env_prefix": "OANDA_"}

    api_url: str = "https://api-fxpractice.oanda.com"
    stream_url: str = "https://stream-fxpractice.oanda.com"
    api_token: str = ""
    account_id: str = ""
    is_live: bool = False

    @property
    def effective_api_url(self) -> str:
        if self.is_live:
            return "https://api-fxtrade.oanda.com"
        return self.api_url

    @property
    def effective_stream_url(self) -> str:
        if self.is_live:
            return "https://stream-fxtrade.oanda.com"
        return self.stream_url


class PerigonSettings(BaseSettings):
    """Perigon news/events API configuration."""

    model_config = {"env_prefix": "PERIGON_"}

    api_key: str = ""
    api_url: str = "https://api.goperigon.com/v1"


class FinnhubSettings(BaseSettings):
    """Finnhub API configuration."""

    model_config = {"env_prefix": "FINNHUB_"}

    api_key: str = ""
    api_url: str = "https://finnhub.io/api/v1"
    ws_url: str = "wss://ws.finnhub.io"


class DatabaseSettings(BaseSettings):
    """Database configuration."""

    model_config = {"env_prefix": "DB_"}

    host: str = "localhost"
    port: int = 5432
    name: str = "justtrading"
    user: str = "justtrading"
    password: str = ""

    @property
    def async_url(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"

    @property
    def sync_url(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


class RedisSettings(BaseSettings):
    """Redis configuration."""

    model_config = {"env_prefix": "REDIS_"}

    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: str = ""

    @property
    def url(self) -> str:
        auth = f":{self.password}@" if self.password else ""
        return f"redis://{auth}{self.host}:{self.port}/{self.db}"


class RiskSettings(BaseSettings):
    """Global risk parameters."""

    model_config = {"env_prefix": "RISK_"}

    max_risk_per_trade_pct: float = 1.0
    max_daily_loss_pct: float = 3.0
    max_open_exposure_pct: float = 10.0
    max_correlated_exposure_pct: float = 5.0
    max_spread_multiplier: float = 3.0
    max_slippage_pips: float = 2.0
    blocked_windows: list[str] = Field(default_factory=lambda: ["22:00-23:00"])
    min_margin_pct: float = 50.0


class SupabaseSettings(BaseSettings):
    """Supabase authentication configuration."""

    model_config = {"env_prefix": "SUPABASE_"}

    url: str = ""
    anon_key: str = ""
    jwt_secret: str = ""


class EncryptionSettings(BaseSettings):
    """Encryption settings for API key storage."""

    model_config = {"env_prefix": "ENCRYPTION_"}

    key: str = ""  # Fernet key for encrypting stored API keys


class Settings(BaseSettings):
    """Application settings."""

    model_config = {"env_prefix": "APP_"}

    name: str = "JustTrading"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"

    oanda: OANDASettings = Field(default_factory=OANDASettings)
    perigon: PerigonSettings = Field(default_factory=PerigonSettings)
    finnhub: FinnhubSettings = Field(default_factory=FinnhubSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    risk: RiskSettings = Field(default_factory=RiskSettings)
    supabase: SupabaseSettings = Field(default_factory=SupabaseSettings)
    encryption: EncryptionSettings = Field(default_factory=EncryptionSettings)


settings = Settings()

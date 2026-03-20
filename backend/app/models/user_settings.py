"""User settings — encrypted per-user API key storage."""

from __future__ import annotations

from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserSettings(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_settings"

    # Supabase user ID
    user_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    # Encrypted API keys (Fernet-encrypted, stored as base64 text)
    oanda_api_token_enc: Mapped[str | None] = mapped_column(Text)
    oanda_account_id_enc: Mapped[str | None] = mapped_column(Text)
    oanda_is_live: Mapped[bool | None] = mapped_column(default=False)

    perigon_api_key_enc: Mapped[str | None] = mapped_column(Text)
    finnhub_api_key_enc: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_user_settings_user_id", "user_id"),
    )

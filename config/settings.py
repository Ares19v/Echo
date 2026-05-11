"""
Echo – AI Healthcare Voice Agent
Central configuration module using Pydantic Settings.
All sensitive values are loaded from environment variables.
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class HMSProvider(str, Enum):
    """Supported Hospital Management System back-ends."""
    MOCK = "mock"
    EKA_CARE = "eka_care"


class Environment(str, Enum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"


class Settings(BaseSettings):
    """
    Application-wide settings.
    Every value can be overridden by a matching environment variable
    (case-insensitive).  See .env.example for the full reference.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── General ────────────────────────────────────────────────────────────
    APP_NAME: str = "Echo"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # ─── API Server ─────────────────────────────────────────────────────────
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_SECRET_KEY: str = Field(
        default="change-me-in-production-use-openssl-rand-hex-32",
        description="Secret key for JWT signing and CSRF protection.",
    )
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ─── HMS / EHR ──────────────────────────────────────────────────────────
    HMS_PROVIDER: HMSProvider = HMSProvider.MOCK
    # Eka Care (only used when HMS_PROVIDER=eka_care)
    EKA_CLIENT_ID: Optional[str] = None
    EKA_CLIENT_SECRET: Optional[str] = None
    EKA_BASE_URL: str = "https://api.eka.care"

    # ─── LiveKit ────────────────────────────────────────────────────────────
    LIVEKIT_URL: Optional[str] = None
    LIVEKIT_API_KEY: Optional[str] = None
    LIVEKIT_API_SECRET: Optional[str] = None

    # ─── Sarvam AI ──────────────────────────────────────────────────────────
    SARVAM_API_KEY: Optional[str] = None
    SARVAM_BASE_URL: str = "https://api.sarvam.ai"
    SARVAM_STT_MODEL: str = "saarika:v2"
    SARVAM_TTS_MODEL: str = "bulbul:v2"     # upgrade to v3 when funded
    SARVAM_TTS_SPEED: float = 0.92          # slightly slower for medical context
    SARVAM_DEFAULT_VOICE: str = "meera"     # warm, professional Indian female voice

    # ─── Gemini (LLM) ───────────────────────────────────────────────────────
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TEMPERATURE: float = 0.3         # low temp for consistent clinical replies
    GEMINI_MAX_TOKENS: int = 512

    # ─── Exotel (Telephony) ──────────────────────────────────────────────────
    EXOTEL_API_KEY: Optional[str] = None
    EXOTEL_API_TOKEN: Optional[str] = None
    EXOTEL_SID: Optional[str] = None
    EXOTEL_VIRTUAL_NUMBER: Optional[str] = None
    EXOTEL_BASE_URL: str = "https://api.exotel.com/v1"

    # ─── Database ───────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://echo:echo@localhost:5432/echo"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # ─── Redis ──────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    SESSION_TTL_SECONDS: int = 3600         # 1 hour per call session

    # ─── Data Retention (DPDP Act compliance) ───────────────────────────────
    AUDIO_RETENTION_DAYS: int = 7
    TRANSCRIPT_RETENTION_DAYS: int = 365

    # ─── Voice Agent Behaviour ──────────────────────────────────────────────
    DEFAULT_LANGUAGE: str = "en-IN"
    SUPPORTED_LANGUAGES: list[str] = ["en-IN", "hi-IN", "mr-IN"]
    VAD_SILENCE_THRESHOLD_MS: int = 800     # default silence before agent responds
    VAD_ELDERLY_THRESHOLD_MS: int = 1200    # longer pause allowance for elderly
    MAX_CLARIFICATION_ATTEMPTS: int = 3     # turns before graceful escalation
    EMERGENCY_ESCALATION_TIMEOUT_MS: int = 10_000

    # ─── Admin Dashboard ─────────────────────────────────────────────────────
    DASHBOARD_ADMIN_KEY: str = Field(
        default="change-me-admin-key",
        description="Static API key for the admin dashboard. Rotate regularly.",
    )

    @field_validator("LOG_LEVEL")
    @classmethod
    def _validate_log_level(cls, v: str) -> str:
        valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid:
            raise ValueError(f"LOG_LEVEL must be one of {valid}")
        return v.upper()

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == Environment.PRODUCTION

    @property
    def is_mock_hms(self) -> bool:
        return self.HMS_PROVIDER == HMSProvider.MOCK

    @property
    def sarvam_ready(self) -> bool:
        return bool(self.SARVAM_API_KEY)

    @property
    def gemini_ready(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    @property
    def livekit_ready(self) -> bool:
        return all([self.LIVEKIT_URL, self.LIVEKIT_API_KEY, self.LIVEKIT_API_SECRET])

    @property
    def exotel_ready(self) -> bool:
        return all([self.EXOTEL_API_KEY, self.EXOTEL_API_TOKEN, self.EXOTEL_SID])


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings singleton."""
    return Settings()

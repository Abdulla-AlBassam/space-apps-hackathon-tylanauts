import os
from dataclasses import dataclass, field
from pathlib import Path

_DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "health.db"


def _env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name) or default


@dataclass(frozen=True)
class Settings:
    # Postgres connection string. Vercel's Neon integration sets DATABASE_URL; unset means local SQLite.
    database_url: str | None = field(default_factory=lambda: _env("DATABASE_URL") or _env("POSTGRES_URL"))
    db_path: str = field(default_factory=lambda: _env("HEALTH_DB_PATH", str(_DEFAULT_DB)))
    # Comma-separated frontend origins allowed to call the API ("*" = any, fine for local dev).
    cors_origins: list[str] = field(default_factory=lambda: _env("CORS_ORIGINS", "*").split(","))
    max_payload_bytes: int = field(default_factory=lambda: int(_env("MAX_PAYLOAD_BYTES", "5000000")))
    # Shared secret senders must put in the X-Api-Key header to ingest. Unset = no check (local dev).
    ingest_api_key: str | None = field(default_factory=lambda: _env("INGEST_API_KEY"))

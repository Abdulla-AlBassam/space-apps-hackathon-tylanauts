import os
from dataclasses import dataclass, field
from pathlib import Path

_DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "health.db"


@dataclass(frozen=True)
class Settings:
    db_path: str = os.environ.get("HEALTH_DB_PATH", str(_DEFAULT_DB))
    # Comma-separated list of frontend origins allowed to call the API ("*" = any, fine for local dev).
    cors_origins: list[str] = field(default_factory=lambda: os.environ.get("CORS_ORIGINS", "*").split(","))
    max_payload_bytes: int = int(os.environ.get("MAX_PAYLOAD_BYTES", 5_000_000))

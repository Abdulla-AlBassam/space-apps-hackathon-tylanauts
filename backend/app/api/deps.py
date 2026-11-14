import secrets

from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader

from app.config import Settings
from app.pipeline.ingest import IngestionService
from app.storage.base import Repository

_api_key_header = APIKeyHeader(
    name="X-Api-Key", auto_error=False, description="Shared key for sending data (ask the backend owner)."
)


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_ingestion_service(request: Request) -> IngestionService:
    return request.app.state.ingestion


def require_ingest_key(
    provided: str | None = Depends(_api_key_header), settings: Settings = Depends(get_settings)
) -> None:
    if settings.ingest_api_key is None:
        return
    if provided is None or not secrets.compare_digest(provided, settings.ingest_api_key):
        raise HTTPException(401, "missing or wrong X-Api-Key header")

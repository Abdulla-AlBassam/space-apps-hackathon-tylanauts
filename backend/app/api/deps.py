from fastapi import Request

from app.config import Settings
from app.pipeline.ingest import IngestionService
from app.storage.base import Repository


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_ingestion_service(request: Request) -> IngestionService:
    return request.app.state.ingestion

"""Builds the app. Run locally with:  .venv/bin/uvicorn app.main:app --reload

Vercel serves the module-level `app` below.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.adapters.base import load_adapters
from app.api.routes import catalog, data_points, ingest
from app.config import Settings
from app.pipeline.ingest import IngestionService
from app.storage import create_repository

API_VERSION = "0.2.0"


def _operation_id(route: APIRoute) -> str:
    # Short ids ("ingest", "query_data_points") instead of FastAPI's long generated ones,
    # so client code generated from openapi.json is readable.
    return route.name


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    if os.environ.get("VERCEL") and not settings.database_url:
        raise RuntimeError("DATABASE_URL is not set. On Vercel, connect a Postgres database to the project.")
    load_adapters()
    repository = create_repository(settings)

    app = FastAPI(
        title="Siryius Health Data API",
        version=API_VERSION,
        description=(
            "Collects health readings from many devices and inputs and stores them as "
            "IEEE 1752.1 / Open mHealth data points. Sending data needs the X-Api-Key header "
            "when the server has a key set; reading does not."
        ),
        generate_unique_id_function=_operation_id,
    )
    app.state.settings = settings
    app.state.repository = repository
    app.state.ingestion = IngestionService(repository)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

    @app.get("/health", tags=["system"], summary="Is the server up, and which storage it uses")
    def health():
        return {"status": "ok", "storage": repository.kind, "version": API_VERSION}

    for module in (catalog, ingest, data_points):
        app.include_router(module.router, prefix="/api/v1")
    return app


app = create_app()

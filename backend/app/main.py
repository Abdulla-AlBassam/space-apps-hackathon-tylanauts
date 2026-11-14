"""App factory. Run with:  .venv/bin/uvicorn app.main:create_app --factory --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.base import load_adapters
from app.api.routes import catalog, data_points, ingest
from app.config import Settings
from app.pipeline.ingest import IngestionService
from app.storage.sqlite import SQLiteRepository


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    load_adapters()
    repository = SQLiteRepository(settings.db_path)

    app = FastAPI(
        title="Astronaut Health Data API",
        version="0.1.0",
        description="Collects health readings from many devices and stores them as IEEE 1752.1 / Open mHealth data points.",
    )
    app.state.settings = settings
    app.state.repository = repository
    app.state.ingestion = IngestionService(repository)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

    @app.get("/health", tags=["system"], summary="Liveness check")
    def health():
        return {"status": "ok"}

    for module in (catalog, ingest, data_points):
        app.include_router(module.router, prefix="/api/v1")
    return app

"""Storage and API tests run once per backend: always SQLite, and Postgres too when
TEST_DATABASE_URL is set (its tables are wiped before each test, so use a throwaway database)."""

import os

import pytest
from fastapi.testclient import TestClient

from app.adapters.base import load_adapters
from app.config import Settings
from app.main import create_app
from app.pipeline.ingest import IngestionService
from app.storage import create_repository

load_adapters()

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
BACKENDS = ["sqlite", "postgres"] if TEST_DATABASE_URL else ["sqlite"]


def _wipe_postgres(url: str) -> None:
    import psycopg

    with psycopg.connect(url) as db:
        db.execute("DROP TABLE IF EXISTS data_points, ingestions")


@pytest.fixture(params=BACKENDS)
def settings(request, tmp_path):
    if request.param == "postgres":
        _wipe_postgres(TEST_DATABASE_URL)
        return Settings(database_url=TEST_DATABASE_URL, cors_origins=["*"], ingest_api_key=None)
    return Settings(database_url=None, db_path=str(tmp_path / "test.db"), cors_origins=["*"], ingest_api_key=None)


@pytest.fixture
def repository(settings):
    return create_repository(settings)


@pytest.fixture
def service(repository):
    return IngestionService(repository)


@pytest.fixture
def client(settings):
    return TestClient(create_app(settings))

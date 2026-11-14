import pytest
from fastapi.testclient import TestClient

from app.adapters.base import load_adapters
from app.config import Settings
from app.main import create_app
from app.pipeline.ingest import IngestionService
from app.storage.sqlite import SQLiteRepository

load_adapters()


@pytest.fixture
def repository(tmp_path):
    return SQLiteRepository(tmp_path / "test.db")


@pytest.fixture
def service(repository):
    return IngestionService(repository)


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(Settings(db_path=str(tmp_path / "api.db"), cors_origins=["*"])))

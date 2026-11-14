from app.config import Settings
from app.storage.base import Repository


def create_repository(settings: Settings) -> Repository:
    """Postgres when DATABASE_URL is set, otherwise a local SQLite file."""
    if settings.database_url:
        from app.storage.postgres import PostgresRepository

        return PostgresRepository(settings.database_url)
    from app.storage.sqlite import SQLiteRepository

    return SQLiteRepository(settings.db_path)

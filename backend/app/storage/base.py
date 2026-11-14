from datetime import datetime
from typing import Protocol

from app.domain.models import DataPointRecord, IngestionReport


class Repository(Protocol):
    """Everything the rest of the app needs from storage. Swap SQLite for Postgres by implementing this."""

    def existing_uuids(self, uuids: list[str]) -> set[str]: ...

    def save_ingestion(self, report: IngestionReport, raw_payload: str, records: list[DataPointRecord]) -> None:
        """Store the ingestion log and its new data points in one transaction (all or nothing)."""
        ...

    def get_ingestion(self, ingestion_id: str) -> IngestionReport | None: ...

    def query_data_points(
        self,
        subject_id: str,
        metric: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[DataPointRecord]: ...

    def list_subjects(self) -> list[str]: ...

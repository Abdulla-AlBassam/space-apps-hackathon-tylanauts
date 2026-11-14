from datetime import datetime
from typing import Protocol

from app.domain.models import DataPointRecord, IngestionReport, Stats


class Repository(Protocol):
    """Everything the rest of the app needs from storage. Implemented by SQLite and Postgres."""

    kind: str

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
        newest_first: bool = False,
    ) -> list[DataPointRecord]: ...

    def list_subjects(self) -> list[str]: ...

    def list_ingestions(self, limit: int = 50, subject_id: str | None = None) -> list[IngestionReport]:
        """Most recent first."""
        ...

    def stats(self) -> Stats: ...

    # Live device simulator. Its readings use device ids starting with a prefix (e.g. "sim-").
    def load_sim_state(self, key: str) -> dict | None: ...

    def save_sim_state(self, key: str, state: dict) -> None: ...

    def prune_simulated(self, device_prefix: str, cutoff: datetime) -> int:
        """Delete simulated readings older than cutoff, and their uploads. Returns readings deleted."""
        ...

    def count_simulated(self, device_prefix: str) -> int: ...

    def storage_bytes(self) -> int | None:
        """Size of the whole database, if the storage can tell."""
        ...

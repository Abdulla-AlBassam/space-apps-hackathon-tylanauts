import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.domain.models import DataPointRecord, IngestionReport

_SCHEMA = """
CREATE TABLE IF NOT EXISTS ingestions (
    id           TEXT PRIMARY KEY,
    adapter_id   TEXT NOT NULL,
    subject_id   TEXT NOT NULL,
    received_at  TEXT NOT NULL,
    raw_payload  TEXT NOT NULL,   -- kept so data can be re-processed when an adapter improves
    report       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS data_points (
    uuid            TEXT PRIMARY KEY,
    subject_id      TEXT NOT NULL,
    metric          TEXT NOT NULL,
    device_id       TEXT,
    adapter_id      TEXT NOT NULL,
    ingestion_id    TEXT NOT NULL REFERENCES ingestions(id),
    effective_start TEXT NOT NULL,
    effective_end   TEXT,
    "values"        TEXT NOT NULL,
    data_point      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_points_subject_metric_time
    ON data_points (subject_id, metric, effective_start);
"""


def _db_time(dt: datetime) -> str:
    # Fixed-width UTC text so string order == time order.
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class SQLiteRepository:
    def __init__(self, path: str | Path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.executescript(_SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def existing_uuids(self, uuids: list[str]) -> set[str]:
        if not uuids:
            return set()
        with self._connect() as db:
            rows = db.execute(
                f"SELECT uuid FROM data_points WHERE uuid IN ({','.join('?' * len(uuids))})", uuids
            ).fetchall()
        return {row["uuid"] for row in rows}

    def save_ingestion(self, report: IngestionReport, raw_payload: str, records: list[DataPointRecord]) -> None:
        with self._connect() as db:
            db.execute(
                "INSERT INTO ingestions VALUES (?, ?, ?, ?, ?, ?)",
                (
                    report.ingestion_id,
                    report.adapter_id,
                    report.subject_id,
                    _db_time(report.received_at),
                    raw_payload,
                    report.model_dump_json(),
                ),
            )
            db.executemany(
                "INSERT OR IGNORE INTO data_points VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        r.uuid,
                        r.subject_id,
                        r.metric,
                        r.device_id,
                        r.adapter_id,
                        r.ingestion_id,
                        _db_time(r.effective_start),
                        _db_time(r.effective_end) if r.effective_end else None,
                        json.dumps(r.values),
                        json.dumps(r.data_point),
                    )
                    for r in records
                ],
            )

    def get_ingestion(self, ingestion_id: str) -> IngestionReport | None:
        with self._connect() as db:
            row = db.execute("SELECT report FROM ingestions WHERE id = ?", (ingestion_id,)).fetchone()
        return IngestionReport.model_validate_json(row["report"]) if row else None

    def query_data_points(
        self,
        subject_id: str,
        metric: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[DataPointRecord]:
        sql, params = "SELECT * FROM data_points WHERE subject_id = ?", [subject_id]
        if metric:
            sql += " AND metric = ?"
            params.append(metric)
        if start:
            sql += " AND effective_start >= ?"
            params.append(_db_time(start))
        if end:
            sql += " AND effective_start < ?"
            params.append(_db_time(end))
        sql += " ORDER BY effective_start LIMIT ?"
        params.append(limit)
        with self._connect() as db:
            rows = db.execute(sql, params).fetchall()
        return [
            DataPointRecord(
                uuid=row["uuid"],
                subject_id=row["subject_id"],
                metric=row["metric"],
                device_id=row["device_id"],
                adapter_id=row["adapter_id"],
                ingestion_id=row["ingestion_id"],
                effective_start=row["effective_start"],
                effective_end=row["effective_end"],
                values=json.loads(row["values"]),
                data_point=json.loads(row["data_point"]),
            )
            for row in rows
        ]

    def list_subjects(self) -> list[str]:
        with self._connect() as db:
            rows = db.execute("SELECT DISTINCT subject_id FROM data_points ORDER BY subject_id").fetchall()
        return [row["subject_id"] for row in rows]

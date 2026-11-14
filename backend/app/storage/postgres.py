"""Postgres storage, used when DATABASE_URL is set (e.g. Neon through Vercel)."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.domain.models import DataPointRecord, IngestionReport

SCHEMA = """
CREATE TABLE IF NOT EXISTS ingestions (
    id           TEXT PRIMARY KEY,
    adapter_id   TEXT NOT NULL,
    subject_id   TEXT NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL,
    raw_payload  TEXT NOT NULL,
    report       JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS data_points (
    uuid            TEXT PRIMARY KEY,
    subject_id      TEXT NOT NULL,
    metric          TEXT NOT NULL,
    device_id       TEXT,
    adapter_id      TEXT NOT NULL,
    ingestion_id    TEXT NOT NULL REFERENCES ingestions(id),
    effective_start TIMESTAMPTZ NOT NULL,
    effective_end   TIMESTAMPTZ,
    "values"        JSONB NOT NULL,
    data_point      JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_points_subject_metric_time
    ON data_points (subject_id, metric, effective_start);
"""


class PostgresRepository:
    kind = "postgres"

    def __init__(self, url: str):
        self.url = url
        with self._connect() as db:
            db.execute(SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[psycopg.Connection]:
        # prepare_threshold=None: poolers like Neon's (PgBouncer, transaction mode) can't keep
        # server-side prepared statements between requests.
        with psycopg.connect(self.url, row_factory=dict_row, prepare_threshold=None) as db:
            yield db

    def existing_uuids(self, uuids: list[str]) -> set[str]:
        if not uuids:
            return set()
        with self._connect() as db:
            rows = db.execute("SELECT uuid FROM data_points WHERE uuid = ANY(%s)", (uuids,)).fetchall()
        return {row["uuid"] for row in rows}

    def save_ingestion(self, report: IngestionReport, raw_payload: str, records: list[DataPointRecord]) -> None:
        with self._connect() as db, db.transaction():
            db.execute(
                "INSERT INTO ingestions VALUES (%s, %s, %s, %s, %s, %s)",
                (
                    report.ingestion_id,
                    report.adapter_id,
                    report.subject_id,
                    report.received_at,
                    raw_payload,
                    Jsonb(report.model_dump(mode="json")),
                ),
            )
            with db.cursor() as cursor:
                cursor.executemany(
                    "INSERT INTO data_points VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "ON CONFLICT (uuid) DO NOTHING",
                    [
                        (
                            r.uuid,
                            r.subject_id,
                            r.metric,
                            r.device_id,
                            r.adapter_id,
                            r.ingestion_id,
                            r.effective_start,
                            r.effective_end,
                            Jsonb(r.values),
                            Jsonb(r.data_point),
                        )
                        for r in records
                    ],
                )

    def get_ingestion(self, ingestion_id: str) -> IngestionReport | None:
        with self._connect() as db:
            row = db.execute("SELECT report FROM ingestions WHERE id = %s", (ingestion_id,)).fetchone()
        return IngestionReport.model_validate(row["report"]) if row else None

    def query_data_points(
        self,
        subject_id: str,
        metric: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[DataPointRecord]:
        sql, params = "SELECT * FROM data_points WHERE subject_id = %s", [subject_id]
        if metric:
            sql += " AND metric = %s"
            params.append(metric)
        if start:
            sql += " AND effective_start >= %s"
            params.append(start)
        if end:
            sql += " AND effective_start < %s"
            params.append(end)
        sql += " ORDER BY effective_start, uuid LIMIT %s"
        params.append(limit)
        with self._connect() as db:
            rows = db.execute(sql, params).fetchall()
        for row in rows:
            # Postgres returns times in the server's timezone; the API always speaks UTC.
            row["effective_start"] = row["effective_start"].astimezone(timezone.utc)
            if row["effective_end"]:
                row["effective_end"] = row["effective_end"].astimezone(timezone.utc)
        return [DataPointRecord.model_validate(row) for row in rows]

    def list_subjects(self) -> list[str]:
        with self._connect() as db:
            rows = db.execute("SELECT DISTINCT subject_id FROM data_points ORDER BY subject_id").fetchall()
        return [row["subject_id"] for row in rows]

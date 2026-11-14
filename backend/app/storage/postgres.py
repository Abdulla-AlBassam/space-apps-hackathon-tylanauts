"""Postgres storage, used when DATABASE_URL is set (e.g. Neon through Vercel)."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.domain.models import CoverageRow, DataPointRecord, IngestionReport, Stats

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
CREATE TABLE IF NOT EXISTS sim_state (
    key   TEXT PRIMARY KEY,
    state JSONB NOT NULL
);
"""


class PostgresRepository:
    kind = "postgres"

    def __init__(self, url: str):
        self.url = url
        # Reuses connections while the server stays warm instead of opening one per query.
        # prepare_threshold=None: poolers like Neon's (PgBouncer, transaction mode) can't keep
        # server-side prepared statements between requests.
        self.pool = ConnectionPool(
            url,
            min_size=0,
            max_size=4,
            max_idle=60,
            check=ConnectionPool.check_connection,
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
            open=True,
        )
        with self._connect() as db:
            db.execute(SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[psycopg.Connection]:
        with self.pool.connection() as db:
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
        newest_first: bool = False,
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
        sql += f" ORDER BY effective_start {'DESC' if newest_first else 'ASC'}, uuid LIMIT %s"
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

    def list_ingestions(self, limit: int = 50, subject_id: str | None = None) -> list[IngestionReport]:
        sql, params = "SELECT report FROM ingestions", []
        if subject_id:
            sql += " WHERE subject_id = %s"
            params.append(subject_id)
        sql += " ORDER BY received_at DESC LIMIT %s"
        params.append(limit)
        with self._connect() as db:
            rows = db.execute(sql, params).fetchall()
        return [IngestionReport.model_validate(row["report"]) for row in rows]

    def stats(self) -> Stats:
        with self._connect() as db:
            points = db.execute("SELECT COUNT(*) AS n FROM data_points").fetchone()["n"]
            ingestions = db.execute("SELECT COUNT(*) AS n FROM ingestions").fetchone()["n"]
            rows = db.execute(
                "SELECT subject_id, metric, COUNT(*) AS count, MIN(effective_start) AS first, "
                "MAX(COALESCE(effective_end, effective_start)) AS last "
                "FROM data_points GROUP BY subject_id, metric ORDER BY subject_id, metric"
            ).fetchall()
        coverage = [
            CoverageRow(**{**r, "first": r["first"].astimezone(timezone.utc), "last": r["last"].astimezone(timezone.utc)})
            for r in rows
        ]
        return Stats(data_points=points, ingestions=ingestions, coverage=coverage)

    def load_sim_state(self, key: str) -> dict | None:
        with self._connect() as db:
            row = db.execute("SELECT state FROM sim_state WHERE key = %s", (key,)).fetchone()
        return row["state"] if row else None

    def save_sim_state(self, key: str, state: dict) -> None:
        with self._connect() as db:
            db.execute(
                "INSERT INTO sim_state (key, state) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET state = excluded.state",
                (key, Jsonb(state)),
            )

    def prune_simulated(self, device_prefix: str, cutoff: datetime) -> int:
        like = device_prefix.replace("%", "") + "%"
        with self._connect() as db, db.transaction():
            deleted = db.execute(
                "DELETE FROM data_points WHERE device_id LIKE %s AND COALESCE(effective_end, effective_start) < %s", (like, cutoff)
            ).rowcount
            db.execute(
                "DELETE FROM ingestions i WHERE i.report->>'device_id' LIKE %s AND i.received_at < %s "
                "AND NOT EXISTS (SELECT 1 FROM data_points p WHERE p.ingestion_id = i.id)",
                (like, cutoff),
            )
        return deleted

    def count_simulated(self, device_prefix: str) -> int:
        with self._connect() as db:
            row = db.execute(
                "SELECT COUNT(*) AS n FROM data_points WHERE device_id LIKE %s", (device_prefix.replace("%", "") + "%",)
            ).fetchone()
        return row["n"]

    def storage_bytes(self) -> int | None:
        with self._connect() as db:
            row = db.execute("SELECT pg_database_size(current_database()) AS n").fetchone()
        return row["n"]

"""Stage 2: build the standard IEEE 1752.1 / Open mHealth data point."""

import uuid
from datetime import datetime, timezone

from app.pipeline.normalize import NormalizedMeasurement

# Fixed namespace so the same reading always gets the same uuid (re-uploads become duplicates).
_UUID_NAMESPACE = uuid.UUID("6f1c2a5e-3b7d-4e8a-9c1f-2d4b6a8e0f13")


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def data_point_uuid(n: NormalizedMeasurement, subject_id: str, device_id: str | None) -> str:
    if n.source_record_id:
        identity = f"src|{n.source_record_id}"
    else:
        values = ",".join(f"{k}={v}" for k, v in sorted(n.values.items()))
        identity = f"val|{iso(n.start)}|{iso(n.end) if n.end else ''}|{values}"
    key = f"{subject_id}|{device_id or ''}|{n.metric.id}|{identity}"
    return str(uuid.uuid5(_UUID_NAMESPACE, key))


def build_data_point(n: NormalizedMeasurement, point_uuid: str, received_at: datetime) -> dict:
    metric = n.metric
    body: dict = {
        c.body_key: {"value": n.values[c.name], "unit": metric.canonical_unit} for c in metric.components
    }
    if n.end is None:
        body["effective_time_frame"] = {"date_time": iso(n.start)}
    else:
        body["effective_time_frame"] = {
            "time_interval": {"start_date_time": iso(n.start), "end_date_time": iso(n.end)}
        }
    body.update(n.extras)
    return {
        "header": {
            "uuid": point_uuid,
            "schema_id": metric.schema_id.as_dict(),
            "source_creation_date_time": iso(n.created_at or received_at),
            "modality": n.modality,
        },
        "body": body,
    }

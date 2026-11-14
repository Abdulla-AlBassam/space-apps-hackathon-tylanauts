import json
from datetime import datetime, timedelta

from pydantic import ValidationError

from app.adapters.base import Adapter, PayloadError, describe, register
from app.domain.metrics import METRICS_BY_SCHEMA
from app.domain.models import Measurement, RecordError

_SECONDS = {"ms": 0.001, "sec": 1, "s": 1, "min": 60, "h": 3600, "d": 86400}


def _duration(d: dict) -> timedelta:
    return timedelta(seconds=float(d["value"]) * _SECONDS[d["unit"]])


def _time_frame(frame: dict) -> dict:
    if "date_time" in frame:
        return {"time": frame["date_time"]}
    interval = frame["time_interval"]
    start, end = interval.get("start_date_time"), interval.get("end_date_time")
    if start and not end:
        end = datetime.fromisoformat(start) + _duration(interval["duration"])
    if end and not start:
        start = datetime.fromisoformat(end) - _duration(interval["duration"])
    return {"start": start, "end": end}


@register
class OpenMHealthAdapter(Adapter):
    id = "open-mhealth"
    name = "Open mHealth / IEEE 1752.1 data points"
    description = (
        "Data points already in the standard format, from devices or apps that speak it natively. "
        "Accepts one data point, a list, or {\"data_points\": [...]}. They are re-normalised and re-checked "
        "like any other input."
    )
    example = json.dumps(
        [
            {
                "header": {
                    "uuid": "0b4f0c4e-8f6a-4bb4-9f73-0c5f7c0e9a11",
                    "schema_id": {"namespace": "omh", "name": "heart-rate", "version": "3.0"},
                    "source_creation_date_time": "2026-11-14T09:00:05Z",
                    "modality": "sensed",
                },
                "body": {
                    "heart_rate": {"value": 64, "unit": "beats/min"},
                    "effective_time_frame": {"date_time": "2026-11-14T09:00:00Z"},
                    "temporal_relationship_to_physical_activity": "at rest",
                },
            },
            {
                "header": {
                    "uuid": "5d0a3c55-1f0e-4b1e-8c2a-7e9b6d4f3a20",
                    "schema_id": {"namespace": "omh", "name": "sleep-duration", "version": "2.0"},
                    "source_creation_date_time": "2026-11-14T05:31:00Z",
                },
                "body": {
                    "sleep_duration": {"value": 412, "unit": "min"},
                    "effective_time_frame": {
                        "time_interval": {
                            "start_date_time": "2026-11-13T22:30:00Z",
                            "duration": {"value": 7, "unit": "h"},
                        }
                    },
                },
            },
        ],
        indent=2,
    )

    def parse(self, payload: str):
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            raise PayloadError(f"not valid JSON: {e}") from None
        if isinstance(data, dict):
            data = data.get("data_points", [data])
        if not isinstance(data, list):
            raise PayloadError("expected a data point, a list of them, or {\"data_points\": [...]}")
        for i, point in enumerate(data):
            ref = f"data_points[{i}]"
            try:
                yield self._to_measurement(point, ref)
            except (KeyError, TypeError, ValueError) as e:
                reason = describe(e) if isinstance(e, ValidationError) else f"malformed data point ({e!r})"
                yield RecordError(ref=ref, reason=reason)

    def _to_measurement(self, point: dict, ref: str) -> Measurement | RecordError:
        header, body = point["header"], point["body"]
        sid = header["schema_id"]
        metric = METRICS_BY_SCHEMA.get((sid["namespace"], sid["name"]))
        if metric is None:
            return RecordError(ref=ref, reason=f"unsupported schema {sid['namespace']}:{sid['name']}")
        if sid["version"].split(".")[0] != metric.schema_id.version.split(".")[0]:
            return RecordError(
                ref=ref, reason=f"{sid['name']} version {sid['version']} not supported (use {metric.schema_id.version})"
            )
        parts = {c.name: body[c.body_key] for c in metric.components}
        units = {p["unit"] for p in parts.values()}
        if len(units) != 1:
            return RecordError(ref=ref, reason=f"components use different units: {sorted(units)}")
        values = {name: p["value"] for name, p in parts.items()}
        core = {c.body_key for c in metric.components} | {"effective_time_frame"}
        return Measurement(
            metric=metric.id,
            value=values["value"] if not metric.is_composite else values,
            unit=units.pop(),
            modality=header.get("modality", "sensed"),
            source_record_id=header["uuid"],
            created_at=header.get("source_creation_date_time"),
            extras={k: v for k, v in body.items() if k not in core},
            ref=ref,
            **_time_frame(body["effective_time_frame"]),
        )

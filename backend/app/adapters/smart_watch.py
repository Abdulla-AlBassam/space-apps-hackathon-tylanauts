import json

from pydantic import BaseModel, ValidationError

from app.adapters.base import Adapter, PayloadError, describe, register
from app.domain.models import Measurement, RecordError


class _Reading(BaseModel):
    ts: str
    hr_bpm: float | None = None
    spo2_pct: float | None = None
    moving: bool = False


class _Message(BaseModel):
    device_id: str
    model: str = ""
    battery_pct: int | None = None
    readings: list[_Reading]


@register
class SmartWatchAdapter(Adapter):
    id = "smart-watch"
    name = "Smart watch (simulated)"
    description = (
        "A wrist watch's sync message: device id, battery, and timestamped readings of heart rate and "
        "blood oxygen. A made-up format for the demo's simulated watches."
    )
    example = json.dumps(
        {
            "device_id": "sim-watch-01",
            "model": "Siryius Band",
            "battery_pct": 64,
            "readings": [
                {"ts": "2026-11-14T06:00:00Z", "hr_bpm": 58, "spo2_pct": 97.6, "moving": False},
                {"ts": "2026-11-14T06:00:10Z", "hr_bpm": 59, "spo2_pct": 97.4, "moving": False},
            ],
        },
        indent=2,
    )

    def parse(self, payload: str):
        try:
            message = _Message.model_validate_json(payload)
        except ValidationError as e:
            raise PayloadError(f"not a smart watch message: {describe(e)}") from None
        for i, r in enumerate(message.readings):
            for metric, value, unit in (("heart-rate", r.hr_bpm, "beats/min"), ("oxygen-saturation", r.spo2_pct, "%")):
                if value is None:
                    continue
                ref = f"readings[{i}] / {metric}"
                try:
                    yield Measurement(
                        metric=metric,
                        value=value,
                        unit=unit,
                        time=r.ts,
                        source_record_id=f"{message.device_id}:{r.ts}:{metric}",
                        ref=ref,
                    )
                except ValidationError as e:
                    yield RecordError(ref=ref, reason=describe(e))

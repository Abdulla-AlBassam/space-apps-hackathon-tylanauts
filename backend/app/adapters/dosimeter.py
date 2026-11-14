import json

from pydantic import BaseModel, ValidationError

from app.adapters.base import Adapter, PayloadError, describe, register
from app.domain.models import Measurement, RecordError


class _Window(BaseModel):
    start: str
    end: str
    dose_usv: float


class _Message(BaseModel):
    badge_id: str
    windows: list[_Window]


@register
class DosimeterAdapter(Adapter):
    id = "dosimeter"
    name = "Personal radiation badge (simulated)"
    description = (
        "A personal dosimeter's report: dose equivalent in microsieverts (µSv) over time windows. "
        "Stored as mSv. A made-up format for the demo's simulated badges."
    )
    example = json.dumps(
        {
            "badge_id": "sim-badge-01",
            "windows": [{"start": "2026-11-13T06:00:00Z", "end": "2026-11-14T06:00:00Z", "dose_usv": 452}],
        },
        indent=2,
    )

    def parse(self, payload: str):
        try:
            message = _Message.model_validate_json(payload)
        except ValidationError as e:
            raise PayloadError(f"not a dosimeter message: {describe(e)}") from None
        for i, w in enumerate(message.windows):
            try:
                yield Measurement(
                    metric="radiation-dose",
                    value=w.dose_usv,
                    unit="uSv",
                    start=w.start,
                    end=w.end,
                    source_record_id=f"{message.badge_id}:{w.end}",
                    ref=f"windows[{i}]",
                )
            except ValidationError as e:
                yield RecordError(ref=f"windows[{i}]", reason=describe(e))

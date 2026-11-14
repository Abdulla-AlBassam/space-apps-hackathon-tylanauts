import json

from pydantic import ValidationError

from app.adapters.base import Adapter, PayloadError, describe, register
from app.domain.models import Measurement, RecordError


@register
class ManualEntryAdapter(Adapter):
    id = "manual-entry"
    name = "Manual entry"
    description = (
        "Readings typed in by the astronaut or sent by a frontend form, one entry per reading. "
        "Entries are self-reported unless they say otherwise."
    )
    example = json.dumps(
        {
            "entries": [
                {"metric": "heart-rate", "value": 62, "unit": "bpm", "time": "2026-11-14T07:30:00Z"},
                {
                    "metric": "blood-pressure",
                    "value": {"systolic": 118, "diastolic": 76},
                    "unit": "mmHg",
                    "time": "2026-11-14T07:32:00Z",
                    "modality": "sensed",
                },
                {"metric": "body-temperature", "value": 98.4, "unit": "F", "time": "2026-11-14T07:35:00Z"},
                {
                    "metric": "sleep-duration",
                    "value": 6.5,
                    "unit": "hours",
                    "start": "2026-11-13T22:30:00Z",
                    "end": "2026-11-14T05:30:00Z",
                },
                {
                    "metric": "mood",
                    "value": 3,
                    "time": "2026-11-14T07:40:00Z",
                    "extras": {"note": "Slept badly, a bit foggy"},
                },
            ]
        },
        indent=2,
    )

    def parse(self, payload: str):
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            raise PayloadError(f"not valid JSON: {e}") from None
        entries = data.get("entries") if isinstance(data, dict) else None
        if not isinstance(entries, list):
            raise PayloadError('expected {"entries": [...]}')
        for i, entry in enumerate(entries):
            ref = f"entries[{i}]"
            if not isinstance(entry, dict):
                yield RecordError(ref=ref, reason="entry must be an object")
                continue
            try:
                yield Measurement.model_validate({"modality": "self-reported", **entry, "ref": ref})
            except ValidationError as e:
                yield RecordError(ref=ref, reason=describe(e))

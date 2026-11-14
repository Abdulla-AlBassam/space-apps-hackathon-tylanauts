import json

from pydantic import BaseModel, ValidationError

from app.adapters.base import Adapter, PayloadError, describe, register
from app.domain.models import AdapterWarning, Measurement, RecordError


class _Device(BaseModel):
    model: str
    serial: str


class _Session(BaseModel):
    id: str


class _Export(BaseModel):
    device: _Device
    session: _Session
    samples: list[dict]


# Sample field -> (metric, unit). SpO2 arrives as a 0-1 fraction on this device.
_CHANNELS = {
    "hr": ("heart-rate", "beats/min"),
    "br": ("respiratory-rate", "breaths/min"),
    "spo2": ("oxygen-saturation", "fraction"),
    "hrv_rmssd": ("heart-rate-variability", "ms"),
}


@register
class SmartShirtAdapter(Adapter):
    id = "smart-shirt"
    name = "Smart shirt session export (simulated)"
    description = (
        "A simulated session export from a Bio-Monitor/Astroskin-style smart shirt: device info, a session "
        "id and timestamped samples. The format is our own stand-in, modelled on the signals that system "
        "records, not the vendor's real file format."
    )
    example = json.dumps(
        {
            "device": {"model": "Astroskin-sim", "serial": "AS-0042"},
            "session": {"id": "S-1187"},
            "samples": [
                {"t": "2026-11-14T06:00:00Z", "hr": 57, "br": 12, "spo2": 0.98, "hrv_rmssd": 61,
                 "sys": 115, "dia": 73, "skin_temp_c": 33.1},
                {"t": "2026-11-14T06:05:00Z", "hr": 59, "br": 13, "spo2": 0.97, "hrv_rmssd": 58,
                 "skin_temp_c": 33.3},
            ],
        },
        indent=2,
    )

    def parse(self, payload: str):
        try:
            export = _Export.model_validate_json(payload)
        except ValidationError as e:
            raise PayloadError(f"not a smart shirt export: {describe(e)}") from None

        if any("skin_temp_c" in s for s in export.samples):
            yield AdapterWarning(message="skin_temp_c not stored: skin temperature is not core body temperature")
        prefix = f"{export.device.serial}:{export.session.id}"
        for i, sample in enumerate(export.samples):
            ref = f"samples[{i}]"
            t = sample.get("t")
            if not t:
                yield RecordError(ref=ref, reason="sample has no 't' timestamp")
                continue
            readings: list[tuple[str, float | dict[str, float], str]] = [
                (metric, sample[field], unit) for field, (metric, unit) in _CHANNELS.items() if field in sample
            ]
            if "sys" in sample or "dia" in sample:
                readings.append(
                    ("blood-pressure", {"systolic": sample.get("sys"), "diastolic": sample.get("dia")}, "mmHg")
                )
            for metric, value, unit in readings:
                try:
                    yield Measurement(
                        metric=metric,
                        value=value,
                        unit=unit,
                        time=t,
                        source_record_id=f"{prefix}:{t}:{metric}",
                        ref=f"{ref} / {metric}",
                    )
                except ValidationError as e:
                    yield RecordError(ref=f"{ref} / {metric}", reason=describe(e))

import csv
import io
import re
from datetime import datetime

from app.adapters.base import Adapter, PayloadError, register
from app.domain.models import AdapterWarning, Measurement, RecordError

TIME_COLUMNS = {"timestamp", "time", "date_time", "datetime", "measured_at"}

# Column name (after clean-up) -> (metric, component, unit). Extend this to recognise more exports.
COLUMNS: dict[str, tuple[str, str, str]] = {
    **dict.fromkeys(["heart_rate", "heart_rate_bpm", "hr", "hr_bpm", "pulse"], ("heart-rate", "value", "beats/min")),
    **dict.fromkeys(["systolic", "sys", "systolic_mmhg", "bp_systolic"], ("blood-pressure", "systolic", "mmHg")),
    **dict.fromkeys(["diastolic", "dia", "diastolic_mmhg", "bp_diastolic"], ("blood-pressure", "diastolic", "mmHg")),
    **dict.fromkeys(["temperature_c", "temp_c", "body_temp_c", "body_temperature"], ("body-temperature", "value", "C")),
    **dict.fromkeys(["temperature_f", "temp_f", "body_temp_f"], ("body-temperature", "value", "F")),
    **dict.fromkeys(["glucose", "blood_glucose", "glucose_mg_dl"], ("blood-glucose", "value", "mg/dL")),
    **dict.fromkeys(["glucose_mmol_l", "blood_glucose_mmol_l"], ("blood-glucose", "value", "mmol/L")),
    **dict.fromkeys(["spo2", "spo2_pct", "oxygen_saturation"], ("oxygen-saturation", "value", "%")),
    **dict.fromkeys(["respiratory_rate", "breathing_rate", "breaths_min"], ("respiratory-rate", "value", "breaths/min")),
    **dict.fromkeys(["hrv", "hrv_ms", "hrv_rmssd", "rmssd"], ("heart-rate-variability", "value", "ms")),
    **dict.fromkeys(["mood", "mood_score"], ("mood", "value", "score")),
    **dict.fromkeys(["radiation_usv", "dose_usv"], ("radiation-dose", "value", "uSv")),
    **dict.fromkeys(["radiation_msv", "dose_msv"], ("radiation-dose", "value", "mSv")),
}


def clean_header(name: str) -> str:
    """'Heart Rate (bpm)' -> 'heart_rate_bpm', 'SpO2 (%)' -> 'spo2'."""
    return re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")


@register
class CsvTableAdapter(Adapter):
    id = "csv-table"
    name = "CSV table"
    description = (
        "A spreadsheet-style export: one row per moment in time, a timestamp column, and one column per "
        "metric. Common column names are recognised automatically; unknown columns are reported, not guessed."
    )
    content_type = "text/csv"
    example = (
        "timestamp,Heart Rate (bpm),systolic,diastolic,SpO2 (%),temp_f,breathing_rate,cabin_co2_ppm\n"
        "2026-11-14T06:00:00Z,58,116,74,98,97.9,13,2400\n"
        "2026-11-14T12:00:00Z,71,121,79,97,98.6,15,2600\n"
        "2026-11-14T18:00:00Z,66,,,97,98.2,14,2550\n"
    )

    def parse(self, payload: str):
        reader = csv.DictReader(io.StringIO(payload.strip()))
        if not reader.fieldnames:
            raise PayloadError("CSV is empty or has no header row")
        headers = {h: clean_header(h) for h in reader.fieldnames}
        time_column = next((h for h, c in headers.items() if c in TIME_COLUMNS), None)
        if time_column is None:
            raise PayloadError(f"no timestamp column found (expected one of: {', '.join(sorted(TIME_COLUMNS))})")
        mapped = {h: COLUMNS[c] for h, c in headers.items() if c in COLUMNS}
        if unknown := [h for h in reader.fieldnames if h != time_column and h not in mapped]:
            yield AdapterWarning(message=f"ignored unrecognised columns: {', '.join(unknown)}")
        if not mapped:
            raise PayloadError("no recognised metric columns")

        for row_number, row in enumerate(reader, start=2):
            ref = f"row {row_number}"
            try:
                time = datetime.fromisoformat(row[time_column].strip())
            except (ValueError, AttributeError):
                yield RecordError(ref=ref, reason=f"unreadable timestamp '{row[time_column]}'")
                continue

            grouped: dict[tuple[str, str], dict[str, float]] = {}
            for header, (metric, component, unit) in mapped.items():
                cell = (row.get(header) or "").strip()
                if not cell:
                    continue
                try:
                    grouped.setdefault((metric, unit), {})[component] = float(cell)
                except ValueError:
                    yield RecordError(ref=f"{ref} / {header}", reason=f"'{cell}' is not a number")

            for (metric, unit), parts in grouped.items():
                value = parts["value"] if list(parts) == ["value"] else parts
                yield Measurement(metric=metric, value=value, unit=unit, time=time, ref=f"{ref} / {metric}")

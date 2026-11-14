"""Stage 1: turn an adapter's Measurement into canonical units, with sanity checks."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.domain.metrics import METRICS, MetricDefinition
from app.domain.models import Measurement, Modality
from app.domain.units import UnitError, convert


class NormalizationError(ValueError):
    pass


@dataclass
class NormalizedMeasurement:
    metric: MetricDefinition
    values: dict[str, float]
    start: datetime
    end: datetime | None
    modality: Modality
    source_record_id: str | None
    created_at: datetime | None
    extras: dict[str, Any]
    warnings: list[str] = field(default_factory=list)


def _as_utc(dt: datetime, label: str, warnings: list[str]) -> datetime:
    if dt.tzinfo is None:
        warnings.append(f"{label} had no timezone; assumed UTC")
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _raw_values(m: Measurement, metric: MetricDefinition) -> dict[str, float]:
    names = [c.name for c in metric.components]
    if not metric.is_composite:
        if isinstance(m.value, dict):
            raise NormalizationError(f"{metric.id} takes a single number, not {m.value}")
        return {"value": m.value}
    if not isinstance(m.value, dict) or set(m.value) != set(names):
        raise NormalizationError(f"{metric.id} needs exactly these values: {', '.join(names)}")
    return m.value


def normalize(m: Measurement) -> NormalizedMeasurement:
    metric = METRICS.get(m.metric)
    if metric is None:
        raise NormalizationError(f"unknown metric '{m.metric}' (known: {', '.join(METRICS)})")

    raw_values = _raw_values(m, metric)
    values: dict[str, float] = {}
    for component in metric.components:
        raw = raw_values[component.name]
        try:
            value = convert(raw, m.unit, metric.canonical_unit) if m.unit else raw
        except UnitError as e:
            raise NormalizationError(f"{metric.id}: {e}") from None
        if not component.min <= value <= component.max:
            name = component.body_key.replace("_", " ")
            raise NormalizationError(
                f"{name} {value} {metric.canonical_unit} is outside the possible range "
                f"{component.min:g}-{component.max:g} (likely a typo, wrong unit or sensor fault)"
            )
        values[component.name] = value

    if metric.check and (problem := metric.check(values)):
        raise NormalizationError(f"{metric.id}: {problem}")

    warnings: list[str] = []
    if m.start or m.end:
        if not (m.start and m.end):
            raise NormalizationError("a time period needs both start and end")
        start, end = _as_utc(m.start, "start", warnings), _as_utc(m.end, "end", warnings)
        if end <= start:
            raise NormalizationError("end must be after start")
    elif m.time:
        start, end = _as_utc(m.time, "time", warnings), None
    else:
        raise NormalizationError("missing time (give 'time', or 'start' and 'end')")
    if metric.requires_interval and end is None:
        raise NormalizationError(f"{metric.id} covers a period: give 'start' and 'end' instead of 'time'")

    core_keys = {c.body_key for c in metric.components} | {"effective_time_frame"}
    if clash := core_keys & set(m.extras):
        raise NormalizationError(f"extras may not override core fields: {', '.join(sorted(clash))}")

    created_at = _as_utc(m.created_at, "created_at", warnings) if m.created_at else None
    return NormalizedMeasurement(
        metric=metric,
        values=values,
        start=start,
        end=end,
        modality=m.modality,
        source_record_id=m.source_record_id,
        created_at=created_at,
        extras=m.extras,
        warnings=warnings,
    )

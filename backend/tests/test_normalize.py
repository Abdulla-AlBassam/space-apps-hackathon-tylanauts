import pytest

from app.domain.models import Measurement
from app.pipeline.normalize import NormalizationError, normalize

T = "2026-11-14T08:00:00Z"


def test_converts_to_canonical_unit():
    n = normalize(Measurement(metric="body-temperature", value=98.6, unit="F", time=T))
    assert n.values == {"value": 37.0}


def test_missing_unit_means_canonical():
    assert normalize(Measurement(metric="heart-rate", value=60, time=T)).values == {"value": 60}


@pytest.mark.parametrize(
    ("measurement", "message"),
    [
        (Measurement(metric="heart-rate", value=620, time=T), "outside the possible range"),
        (Measurement(metric="heart-rate", value=60, unit="mmHg", time=T), "cannot convert"),
        (Measurement(metric="steps", value=10, time=T), "unknown metric"),
        (Measurement(metric="blood-pressure", value=120, time=T), "needs exactly these values"),
        (Measurement(metric="blood-pressure", value={"systolic": 70, "diastolic": 110}, time=T), "systolic must be higher"),
        (Measurement(metric="heart-rate", value={"value": 60}, time=T), "single number"),
        (Measurement(metric="sleep-duration", value=7, unit="h", time=T), "covers a period"),
        (Measurement(metric="sleep-duration", value=7, start=T, end="2026-11-14T07:00:00Z"), "end must be after start"),
        (Measurement(metric="heart-rate", value=60), "missing time"),
        (Measurement(metric="heart-rate", value=60, time=T, extras={"heart_rate": 1}), "may not override"),
    ],
)
def test_rejections(measurement, message):
    with pytest.raises(NormalizationError, match=message):
        normalize(measurement)


def test_naive_time_assumed_utc_with_warning():
    n = normalize(Measurement(metric="heart-rate", value=60, time="2026-11-14T08:00:00"))
    assert n.start.utcoffset().total_seconds() == 0
    assert any("assumed UTC" in w for w in n.warnings)


def test_offset_time_converted_to_utc():
    n = normalize(Measurement(metric="heart-rate", value=60, time="2026-11-14T11:00:00+03:00"))
    assert n.start.isoformat() == "2026-11-14T08:00:00+00:00"

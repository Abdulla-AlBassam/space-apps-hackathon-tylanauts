import pytest

from app.domain.units import UnitError, canonical_unit_name, convert


@pytest.mark.parametrize("spelling", ["bpm", "BPM", " beats per minute ", "beats/min"])
def test_heart_rate_spellings(spelling):
    assert canonical_unit_name(spelling) == "beats/min"


@pytest.mark.parametrize(
    ("value", "unit", "target", "expected"),
    [
        (98.6, "°F", "C", 37.0),
        (310.15, "K", "C", 37.0),
        (5.5, "mmol/l", "mg/dL", 99.088),
        (16, "kPa", "mmHg", 120.0099),
        (0.97, "fraction", "%", 97.0),
        (450, "minutes", "h", 7.5),
        (480, "µSv", "mSv", 0.48),
        (62, "bpm", "beats/min", 62),
    ],
)
def test_conversions(value, unit, target, expected):
    assert convert(value, unit, target) == pytest.approx(expected)


def test_unknown_unit():
    with pytest.raises(UnitError, match="unknown unit"):
        convert(1, "furlongs", "h")


def test_impossible_conversion():
    with pytest.raises(UnitError, match="cannot convert"):
        convert(1, "mmHg", "C")

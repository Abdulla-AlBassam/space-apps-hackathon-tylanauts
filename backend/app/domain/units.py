"""Unit spelling clean-up and conversion to canonical units.

Canonical spellings follow the Open mHealth / IEEE 1752.1 schema enums ('beats/min', 'C', 'mg/dL', ...).
To support a new unit: add its spellings to _ALIASES and, if needed, a converter to _CONVERTERS.
"""

from collections.abc import Callable


class UnitError(ValueError):
    pass


_ALIASES = {
    "beats/min": ["bpm", "beats per minute", "beats/minute"],
    "breaths/min": ["brpm", "breaths per minute", "breaths/minute"],
    "mmHg": ["mm hg", "mm[hg]"],
    "kPa": [],
    "C": ["°c", "degc", "celsius", "cel"],
    "F": ["°f", "degf", "fahrenheit", "[degf]"],
    "K": ["kelvin"],
    "mg/dL": ["mg/dl", "mg per dl"],
    "mmol/L": ["mmol/l", "mmol per l"],
    "%": ["percent", "pct"],
    "fraction": ["ratio", "decimal"],
    "ms": ["millisecond", "milliseconds", "msec"],
    "sec": ["s", "second", "seconds"],
    "min": ["minute", "minutes", "mins"],
    "h": ["hr", "hrs", "hour", "hours"],
    "mSv": [],
    "uSv": ["µsv", "μsv", "microsievert"],
    "Sv": [],
    "score": ["rating", "points", "/5"],
}

_LOOKUP = {canonical.lower(): canonical for canonical in _ALIASES}
_LOOKUP.update({alias: canonical for canonical, aliases in _ALIASES.items() for alias in aliases})

_CONVERTERS: dict[tuple[str, str], Callable[[float], float]] = {
    ("F", "C"): lambda v: (v - 32) * 5 / 9,
    ("K", "C"): lambda v: v - 273.15,
    ("mmol/L", "mg/dL"): lambda v: v * 18.016,
    ("kPa", "mmHg"): lambda v: v * 7.50062,
    ("fraction", "%"): lambda v: v * 100,
    ("sec", "h"): lambda v: v / 3600,
    ("min", "h"): lambda v: v / 60,
    ("sec", "ms"): lambda v: v * 1000,
    ("uSv", "mSv"): lambda v: v / 1000,
    ("Sv", "mSv"): lambda v: v * 1000,
}


def canonical_unit_name(unit: str) -> str:
    try:
        return _LOOKUP[unit.strip().lower()]
    except KeyError:
        raise UnitError(f"unknown unit '{unit}'") from None


def convert(value: float, from_unit: str, to_unit: str) -> float:
    """Convert value from from_unit (any known spelling) to to_unit (canonical spelling)."""
    source = canonical_unit_name(from_unit)
    if source == to_unit:
        return value
    try:
        converted = _CONVERTERS[(source, to_unit)](value)
    except KeyError:
        raise UnitError(f"cannot convert '{from_unit}' to '{to_unit}'") from None
    return round(converted, 4)

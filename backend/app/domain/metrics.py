"""The metric catalog: every health metric the backend understands.

Adding a metric = adding one MetricDefinition below (plus a JSON schema in
app/standards/schemas/astro/ if it isn't an official Open mHealth schema).
"""

from collections.abc import Callable
from dataclasses import dataclass

OMH_BASE = "https://w3id.org/openmhealth/schemas/omh/"
ASTRO_BASE = "https://tylanauts.example/schemas/astro/"


@dataclass(frozen=True)
class SchemaId:
    namespace: str
    name: str
    version: str

    def as_dict(self) -> dict[str, str]:
        return {"namespace": self.namespace, "name": self.name, "version": self.version}


@dataclass(frozen=True)
class Component:
    """One numeric part of a metric. Single-value metrics have one component named 'value'."""

    name: str
    body_key: str
    min: float
    max: float


@dataclass(frozen=True)
class MetricDefinition:
    id: str
    label: str
    schema_id: SchemaId
    canonical_unit: str
    components: tuple[Component, ...]
    requires_interval: bool = False
    # Cross-field sanity check on canonical values; returns an error message or None.
    check: Callable[[dict[str, float]], str | None] | None = None

    @property
    def schema_uri(self) -> str:
        base = OMH_BASE if self.schema_id.namespace == "omh" else ASTRO_BASE
        return f"{base}{self.schema_id.name}-{self.schema_id.version}.json"

    @property
    def is_composite(self) -> bool:
        return len(self.components) > 1


def _single(body_key: str, lo: float, hi: float) -> tuple[Component, ...]:
    return (Component("value", body_key, lo, hi),)


def _systolic_above_diastolic(v: dict[str, float]) -> str | None:
    if v["systolic"] <= v["diastolic"]:
        return "systolic must be higher than diastolic (values may be swapped)"
    return None


# Ranges are what is physically possible, to catch typos and sensor faults.
# They are NOT clinical thresholds; deciding what is worrying belongs to the analysis layer.
_DEFINITIONS = [
    MetricDefinition(
        id="heart-rate",
        label="Heart rate",
        schema_id=SchemaId("omh", "heart-rate", "3.0"),
        canonical_unit="beats/min",
        components=_single("heart_rate", 20, 250),
    ),
    MetricDefinition(
        id="blood-pressure",
        label="Blood pressure",
        schema_id=SchemaId("omh", "blood-pressure", "4.0"),
        canonical_unit="mmHg",
        components=(
            Component("systolic", "systolic_blood_pressure", 50, 260),
            Component("diastolic", "diastolic_blood_pressure", 20, 160),
        ),
        check=_systolic_above_diastolic,
    ),
    MetricDefinition(
        id="body-temperature",
        label="Body temperature",
        schema_id=SchemaId("omh", "body-temperature", "4.0"),
        canonical_unit="C",
        components=_single("body_temperature", 30, 45),
    ),
    MetricDefinition(
        id="blood-glucose",
        label="Blood glucose",
        schema_id=SchemaId("omh", "blood-glucose", "4.0"),
        canonical_unit="mg/dL",
        components=_single("blood_glucose", 10, 1000),
    ),
    MetricDefinition(
        id="oxygen-saturation",
        label="Blood oxygen (SpO2)",
        schema_id=SchemaId("omh", "oxygen-saturation", "3.0"),
        canonical_unit="%",
        components=_single("oxygen_saturation", 50, 100),
    ),
    MetricDefinition(
        id="respiratory-rate",
        label="Breathing rate",
        schema_id=SchemaId("omh", "respiratory-rate", "3.0"),
        canonical_unit="breaths/min",
        components=_single("respiratory_rate", 3, 70),
    ),
    MetricDefinition(
        id="sleep-duration",
        label="Sleep duration",
        schema_id=SchemaId("omh", "sleep-duration", "2.0"),
        canonical_unit="h",
        components=_single("sleep_duration", 0, 24),
        requires_interval=True,
    ),
    # Not covered by Open mHealth, so defined in our own 'astro' namespace using the same conventions.
    MetricDefinition(
        id="heart-rate-variability",
        label="Heart rate variability",
        schema_id=SchemaId("astro", "heart-rate-variability", "1.0"),
        canonical_unit="ms",
        components=_single("heart_rate_variability", 1, 300),
    ),
    MetricDefinition(
        id="mood",
        label="Mood (1 = very low, 5 = very good)",
        schema_id=SchemaId("astro", "mood", "1.0"),
        canonical_unit="score",
        components=_single("mood_rating", 1, 5),
    ),
    MetricDefinition(
        id="radiation-dose",
        label="Radiation dose equivalent",
        schema_id=SchemaId("astro", "radiation-dose", "1.0"),
        canonical_unit="mSv",
        components=_single("radiation_dose_equivalent", 0, 1000),
    ),
]

METRICS: dict[str, MetricDefinition] = {m.id: m for m in _DEFINITIONS}
METRICS_BY_SCHEMA: dict[tuple[str, str], MetricDefinition] = {
    (m.schema_id.namespace, m.schema_id.name): m for m in _DEFINITIONS
}

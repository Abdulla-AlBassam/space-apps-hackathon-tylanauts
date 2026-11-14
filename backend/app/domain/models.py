from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Modality = Literal["sensed", "self-reported"]


class Measurement(BaseModel):
    """One reading as an adapter understood it, in whatever unit the device used.

    Adapters only ever produce these. Turning them into standard Open mHealth / IEEE 1752.1
    data points is the pipeline's job, so adapters never need to know the standard.
    """

    metric: str = Field(description="Metric id from the catalog, e.g. 'heart-rate'.")
    value: float | dict[str, float] = Field(
        description="A number, or {component: number} for multi-part metrics like blood pressure."
    )
    unit: str | None = Field(None, description="Unit as the source wrote it. Omit to mean the canonical unit.")
    time: datetime | None = Field(None, description="When it was measured (point-in-time readings).")
    start: datetime | None = Field(None, description="Start of the measured period (e.g. sleep).")
    end: datetime | None = Field(None, description="End of the measured period.")
    modality: Modality = "sensed"
    source_record_id: str | None = Field(None, description="The source's own id for this reading; used to skip duplicates.")
    created_at: datetime | None = Field(None, description="When the source created the record, if known.")
    extras: dict[str, Any] = Field(default_factory=dict, description="Optional schema fields passed into the body as-is.")
    ref: str | None = Field(None, description="Where this came from in the payload, for error messages, e.g. 'row 3'.")


class RecordError(BaseModel):
    ref: str
    reason: str


class AdapterWarning(BaseModel):
    message: str


class DataPointRecord(BaseModel):
    """A stored data point: the untouched standard data point plus our own bookkeeping around it.

    IEEE 1752.1 headers carry no user or device fields, so who/what/how lives here instead.
    """

    uuid: str
    subject_id: str
    metric: str
    device_id: str | None
    adapter_id: str
    ingestion_id: str
    effective_start: datetime
    effective_end: datetime | None
    values: dict[str, float] = Field(description="Flat values in canonical units, ready for analysis.")
    data_point: dict[str, Any] = Field(description="The IEEE 1752.1 / Open mHealth data point, exactly per spec.")


class CoverageRow(BaseModel):
    subject_id: str
    metric: str
    count: int
    first: datetime = Field(description="Start of the earliest reading.")
    last: datetime = Field(description="End (or time) of the latest reading.")


class Stats(BaseModel):
    data_points: int
    ingestions: int
    coverage: list[CoverageRow] = Field(description="One row per subject and metric that has data.")


class IngestionReport(BaseModel):
    ingestion_id: str
    adapter_id: str
    subject_id: str
    device_id: str | None
    received_at: datetime
    received: int = Field(description="Records found in the payload.")
    accepted: int
    duplicates: int
    rejected: list[RecordError]
    warnings: list[str]
    data_point_ids: list[str]

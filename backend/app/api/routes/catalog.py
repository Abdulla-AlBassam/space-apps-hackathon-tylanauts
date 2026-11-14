from fastapi import APIRouter
from pydantic import BaseModel

from app.adapters.base import all_adapters
from app.domain.metrics import METRICS

router = APIRouter(tags=["catalog"])


class ComponentInfo(BaseModel):
    name: str
    body_field: str
    min: float
    max: float


class MetricInfo(BaseModel):
    id: str
    label: str
    schema_id: dict[str, str]
    canonical_unit: str
    components: list[ComponentInfo]
    requires_period: bool


class AdapterInfo(BaseModel):
    id: str
    name: str
    description: str
    content_type: str
    example: str


@router.get("/metrics", response_model=list[MetricInfo], summary="Metrics the backend understands")
def list_metrics():
    return [
        MetricInfo(
            id=m.id,
            label=m.label,
            schema_id=m.schema_id.as_dict(),
            canonical_unit=m.canonical_unit,
            components=[ComponentInfo(name=c.name, body_field=c.body_key, min=c.min, max=c.max) for c in m.components],
            requires_period=m.requires_interval,
        )
        for m in METRICS.values()
    ]


@router.get("/adapters", response_model=list[AdapterInfo], summary="Input formats that can be ingested")
def list_adapters():
    return [
        AdapterInfo(id=a.id, name=a.name, description=a.description, content_type=a.content_type, example=a.example)
        for a in all_adapters()
    ]

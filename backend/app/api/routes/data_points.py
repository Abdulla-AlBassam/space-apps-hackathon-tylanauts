from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_repository
from app.domain.metrics import METRICS
from app.domain.models import DataPointRecord
from app.storage.base import Repository

router = APIRouter(tags=["data points"])


def _utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


@router.get("/subjects", response_model=list[str], summary="Subjects that have data")
def list_subjects(repository: Repository = Depends(get_repository)):
    return repository.list_subjects()


@router.get(
    "/subjects/{subject_id}/data-points",
    response_model=list[DataPointRecord],
    summary="Stored data points for one subject, oldest first",
)
def query_data_points(
    subject_id: str,
    metric: str | None = Query(None, description="Only this metric, e.g. 'heart-rate'."),
    start: datetime | None = Query(None, description="From this time (inclusive). No timezone = UTC."),
    end: datetime | None = Query(None, description="Up to this time (exclusive). No timezone = UTC."),
    limit: int = Query(500, ge=1, le=5000),
    repository: Repository = Depends(get_repository),
):
    if metric and metric not in METRICS:
        raise HTTPException(400, f"unknown metric '{metric}' (known: {', '.join(METRICS)})")
    return repository.query_data_points(subject_id, metric, _utc(start), _utc(end), limit)

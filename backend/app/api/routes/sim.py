from fastapi import APIRouter, Depends

from app.api.deps import get_ingestion_service, get_repository
from app.pipeline.ingest import IngestionService
from app.sim import engine
from app.sim.engine import SimSettings, SimView
from app.storage.base import Repository

router = APIRouter(prefix="/sim", tags=["live simulator"])


@router.get("", response_model=SimView, summary="Live simulator: levers, devices and storage")
def get_sim(repository: Repository = Depends(get_repository)):
    return engine.view(repository)


@router.put("/settings", response_model=SimView, summary="Change the simulator's levers (whole settings object)")
def put_sim_settings(settings: SimSettings, repository: Repository = Depends(get_repository)):
    engine.save_settings(repository, settings)
    return engine.view(repository, settings)


@router.post(
    "/tick",
    response_model=SimView,
    summary="Send the device readings that are due, and clean up old simulated data",
    description=(
        "Called every few seconds by the live page while it's open. Sends at most one reading per device "
        "per 10 seconds however often it's called, through the real device adapters. Simulated readings "
        "older than the retention window are deleted."
    ),
)
def sim_tick(
    repository: Repository = Depends(get_repository),
    service: IngestionService = Depends(get_ingestion_service),
):
    return engine.tick(repository, service)

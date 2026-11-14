from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from starlette.concurrency import run_in_threadpool

from app.adapters.base import PayloadError, all_adapters
from app.api.deps import get_ingestion_service, get_repository, get_settings, require_ingest_key
from app.config import Settings
from app.domain.models import IngestionReport
from app.pipeline.ingest import IngestionService, UnknownAdapterError
from app.storage.base import Repository

router = APIRouter(tags=["ingestion"])

ID_PATTERN = r"^[A-Za-z0-9._-]{1,100}$"

_RAW_BODY_DOC = {
    "requestBody": {
        "required": True,
        "description": "The raw payload in the adapter's format (see GET /api/v1/adapters for examples).",
        "content": {
            "application/json": {"schema": {"type": "object"}},
            "text/csv": {"schema": {"type": "string"}},
        },
    }
}


@router.post(
    "/ingest/{adapter_id}",
    response_model=IngestionReport,
    summary="Ingest a payload through an adapter",
    description=(
        "Parses the payload, converts every reading to the standard format and stores it. "
        "Bad records are rejected individually with a reason; the rest are still stored. "
        "Sending the same readings twice is safe: repeats are counted as duplicates."
    ),
    openapi_extra=_RAW_BODY_DOC,
    dependencies=[Depends(require_ingest_key)],
    responses={
        400: {"description": "Nothing in the payload could be read (e.g. not valid JSON)"},
        401: {"description": "Missing or wrong X-Api-Key header"},
        404: {"description": "Unknown adapter"},
        413: {"description": "Payload too large"},
    },
)
async def ingest(
    request: Request,
    adapter_id: str = Path(description="Adapter id, e.g. 'manual-entry'."),
    subject_id: str = Query(pattern=ID_PATTERN, description="Who the data belongs to, e.g. 'astro-01'."),
    device_id: str | None = Query(None, pattern=ID_PATTERN, description="Which physical device, if known."),
    service: IngestionService = Depends(get_ingestion_service),
    settings: Settings = Depends(get_settings),
):
    body = await request.body()
    if len(body) > settings.max_payload_bytes:
        raise HTTPException(413, f"payload larger than {settings.max_payload_bytes} bytes")
    try:
        payload = body.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "payload must be UTF-8 text") from None
    try:
        return await run_in_threadpool(service.ingest, adapter_id, payload, subject_id, device_id)
    except UnknownAdapterError:
        known = ", ".join(a.id for a in all_adapters())
        raise HTTPException(404, f"unknown adapter '{adapter_id}' (known: {known})") from None
    except PayloadError as e:
        raise HTTPException(400, str(e)) from None


@router.get("/ingestions", response_model=list[IngestionReport], summary="Recent ingestion reports, newest first")
def list_ingestions(
    limit: int = Query(50, ge=1, le=500),
    subject_id: str | None = Query(None, description="Only uploads for this subject."),
    repository: Repository = Depends(get_repository),
):
    return repository.list_ingestions(limit, subject_id)


@router.get("/ingestions/{ingestion_id}", response_model=IngestionReport, summary="Report for a past ingestion")
def get_ingestion(ingestion_id: str, repository: Repository = Depends(get_repository)):
    report = repository.get_ingestion(ingestion_id)
    if report is None:
        raise HTTPException(404, "ingestion not found")
    return report

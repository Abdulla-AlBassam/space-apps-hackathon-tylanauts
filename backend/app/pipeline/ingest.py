"""The ingestion pipeline: raw payload in, standard data points stored, report out.

    payload -> adapter.parse -> normalize -> build_data_point -> validate -> de-duplicate -> store

One bad record never sinks the batch: it is rejected with a reason and everything else goes in.
"""

import uuid
from datetime import datetime, timezone

from app.adapters.base import get_adapter
from app.domain.models import AdapterWarning, DataPointRecord, IngestionReport, RecordError
from app.pipeline.build import build_data_point, data_point_uuid
from app.pipeline.normalize import NormalizationError, normalize
from app.standards.conformance import ConformanceError, validate_data_point
from app.storage.base import Repository


class UnknownAdapterError(LookupError):
    pass


class IngestionService:
    def __init__(self, repository: Repository):
        self.repository = repository

    def ingest(self, adapter_id: str, payload: str, subject_id: str, device_id: str | None = None) -> IngestionReport:
        adapter = get_adapter(adapter_id)
        if adapter is None:
            raise UnknownAdapterError(adapter_id)

        ingestion_id = str(uuid.uuid4())
        received_at = datetime.now(timezone.utc)
        rejected: list[RecordError] = []
        warnings: list[str] = []
        records: dict[str, DataPointRecord] = {}
        received = 0

        for item in adapter.parse(payload):  # PayloadError propagates: nothing readable at all
            if isinstance(item, AdapterWarning):
                warnings.append(item.message)
                continue
            received += 1
            if isinstance(item, RecordError):
                rejected.append(item)
                continue
            ref = item.ref or f"record {received}"
            try:
                n = normalize(item)
                point_uuid = data_point_uuid(n, subject_id, device_id)
                data_point = build_data_point(n, point_uuid, received_at)
                validate_data_point(data_point, n.metric.schema_uri)
            except (NormalizationError, ConformanceError) as e:
                rejected.append(RecordError(ref=ref, reason=str(e)))
                continue
            warnings.extend(f"{ref}: {w}" for w in n.warnings)
            records[point_uuid] = DataPointRecord(
                uuid=point_uuid,
                subject_id=subject_id,
                metric=n.metric.id,
                device_id=device_id,
                adapter_id=adapter_id,
                ingestion_id=ingestion_id,
                effective_start=n.start,
                effective_end=n.end,
                values=n.values,
                data_point=data_point,
            )

        existing = self.repository.existing_uuids(list(records))
        new_records = [r for u, r in records.items() if u not in existing]
        report = IngestionReport(
            ingestion_id=ingestion_id,
            adapter_id=adapter_id,
            subject_id=subject_id,
            device_id=device_id,
            received_at=received_at,
            received=received,
            accepted=len(new_records),
            # Includes repeats inside this same payload, not only ones stored earlier.
            duplicates=received - len(rejected) - len(new_records),
            rejected=rejected,
            warnings=warnings,
            data_point_ids=[r.uuid for r in new_records],
        )
        self.repository.save_ingestion(report, payload, new_records)
        return report

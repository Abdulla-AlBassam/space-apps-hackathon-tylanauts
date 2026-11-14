import json

import pytest

from app.adapters.base import PayloadError, all_adapters
from app.standards.conformance import validate_data_point
from app.domain.metrics import METRICS


@pytest.mark.parametrize("adapter", all_adapters(), ids=lambda a: a.id)
def test_every_adapter_example_ingests_cleanly(adapter, service, repository):
    """Any new adapter is covered automatically: its own example must go through the whole pipeline."""
    report = service.ingest(adapter.id, adapter.example, subject_id="astro-01")
    assert report.rejected == []
    assert report.accepted > 0
    for record in repository.query_data_points("astro-01"):
        validate_data_point(record.data_point, METRICS[record.metric].schema_uri)


def test_reingesting_is_idempotent(service):
    adapter = all_adapters()[0]
    first = service.ingest(adapter.id, adapter.example, subject_id="astro-01")
    second = service.ingest(adapter.id, adapter.example, subject_id="astro-01")
    assert second.accepted == 0
    assert second.duplicates == first.accepted


def test_same_readings_for_different_subjects_are_not_duplicates(service):
    payload = json.dumps({"entries": [{"metric": "heart-rate", "value": 60, "time": "2026-11-14T08:00:00Z"}]})
    assert service.ingest("manual-entry", payload, subject_id="astro-01").accepted == 1
    assert service.ingest("manual-entry", payload, subject_id="astro-02").accepted == 1


def test_manual_entry_keeps_good_entries_when_one_is_bad(service):
    payload = json.dumps(
        {
            "entries": [
                {"metric": "heart-rate", "value": 61, "time": "2026-11-14T08:00:00Z"},
                {"metric": "heart-rate", "value": "fast", "time": "2026-11-14T08:01:00Z"},
                {"metric": "heart-rate", "value": 900, "time": "2026-11-14T08:02:00Z"},
            ]
        }
    )
    report = service.ingest("manual-entry", payload, subject_id="astro-01")
    assert report.accepted == 1
    assert [r.ref for r in report.rejected] == ["entries[1]", "entries[2]"]


def test_manual_entry_defaults_to_self_reported(service, repository):
    payload = json.dumps({"entries": [{"metric": "mood", "value": 4, "time": "2026-11-14T08:00:00Z"}]})
    service.ingest("manual-entry", payload, subject_id="astro-01")
    [record] = repository.query_data_points("astro-01")
    assert record.data_point["header"]["modality"] == "self-reported"


def test_csv_reports_unknown_columns_and_half_blood_pressure(service):
    csv = "timestamp,HR,systolic,diastolic,cabin_co2\n2026-11-14T08:00:00Z,60,120,,400\n"
    report = service.ingest("csv-table", csv, subject_id="astro-01")
    assert report.accepted == 1
    assert any("cabin_co2" in w for w in report.warnings)
    assert "needs exactly these values" in report.rejected[0].reason


def test_csv_without_timestamp_column_is_a_payload_error(service):
    with pytest.raises(PayloadError, match="no timestamp column"):
        service.ingest("csv-table", "HR\n60\n", subject_id="astro-01")


def test_smart_shirt_converts_fraction_spo2_and_skips_skin_temp(service, repository):
    adapter = next(a for a in all_adapters() if a.id == "smart-shirt")
    report = service.ingest(adapter.id, adapter.example, subject_id="astro-01")
    spo2 = repository.query_data_points("astro-01", metric="oxygen-saturation")
    assert spo2[0].values == {"value": 98.0}
    assert any("skin_temp_c" in w for w in report.warnings)


def test_open_mhealth_duration_interval_and_extras_survive(service, repository):
    adapter = next(a for a in all_adapters() if a.id == "open-mhealth")
    service.ingest(adapter.id, adapter.example, subject_id="astro-01")
    [sleep] = repository.query_data_points("astro-01", metric="sleep-duration")
    assert sleep.values == {"value": pytest.approx(6.8667, abs=1e-3)}
    assert sleep.effective_end.isoformat().startswith("2026-11-14T05:30")
    [hr] = repository.query_data_points("astro-01", metric="heart-rate")
    assert hr.data_point["body"]["temporal_relationship_to_physical_activity"] == "at rest"


def test_open_mhealth_rejects_unsupported_schema_and_bad_extras(service):
    point = json.loads(next(a for a in all_adapters() if a.id == "open-mhealth").example)[0]
    unknown = {**point, "header": {**point["header"], "schema_id": {"namespace": "omh", "name": "step-count", "version": "3.0"}}}
    bad_extra = {**point, "body": {**point["body"], "temporal_relationship_to_physical_activity": "napping"}}
    report = service.ingest("open-mhealth", json.dumps([unknown, bad_extra]), subject_id="astro-01")
    assert report.accepted == 0
    assert "unsupported schema" in report.rejected[0].reason
    assert "napping" in report.rejected[1].reason

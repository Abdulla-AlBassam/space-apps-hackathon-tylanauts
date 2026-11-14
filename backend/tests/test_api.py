import dataclasses
import json

from fastapi.testclient import TestClient

from app.main import create_app

HR = {"entries": [{"metric": "heart-rate", "value": 62, "time": "2026-11-14T08:00:00Z"}]}


def test_health_reports_storage(client, settings):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["storage"] == ("postgres" if settings.database_url else "sqlite")


def test_ingest_key_required_when_configured(settings):
    keyed = TestClient(create_app(dataclasses.replace(settings, ingest_api_key="s3cret")))
    url, params = "/api/v1/ingest/manual-entry", {"subject_id": "astro-01"}
    assert keyed.post(url, params=params, json=HR).status_code == 401
    assert keyed.post(url, params=params, json=HR, headers={"X-Api-Key": "wrong"}).status_code == 401
    assert keyed.post(url, params=params, json=HR, headers={"X-Api-Key": "s3cret"}).status_code == 200
    # Reading never needs the key.
    assert keyed.get("/api/v1/subjects/astro-01/data-points").status_code == 200


def test_catalog(client):
    metrics = {m["id"] for m in client.get("/api/v1/metrics").json()}
    assert {"heart-rate", "blood-pressure", "mood", "radiation-dose"} <= metrics
    adapters = {a["id"] for a in client.get("/api/v1/adapters").json()}
    assert {"manual-entry", "csv-table", "smart-shirt", "open-mhealth"} <= adapters


def test_ingest_then_query(client):
    payload = {"entries": [{"metric": "heart-rate", "value": 62, "unit": "bpm", "time": "2026-11-14T08:00:00Z"}]}
    response = client.post("/api/v1/ingest/manual-entry", params={"subject_id": "astro-01"}, json=payload)
    assert response.status_code == 200
    report = response.json()
    assert report["accepted"] == 1

    points = client.get("/api/v1/subjects/astro-01/data-points", params={"metric": "heart-rate"}).json()
    assert points[0]["values"] == {"value": 62.0}
    assert points[0]["data_point"]["body"]["heart_rate"] == {"value": 62.0, "unit": "beats/min"}

    assert client.get(f"/api/v1/ingestions/{report['ingestion_id']}").json()["accepted"] == 1
    assert client.get("/api/v1/subjects").json() == ["astro-01"]


def test_csv_body(client):
    csv = "timestamp,HR\n2026-11-14T08:00:00Z,60\n"
    response = client.post(
        "/api/v1/ingest/csv-table",
        params={"subject_id": "astro-01"},
        content=csv,
        headers={"Content-Type": "text/csv"},
    )
    assert response.json()["accepted"] == 1


def test_time_range_filter(client):
    entries = [{"metric": "heart-rate", "value": 60 + i, "time": f"2026-11-1{i}T08:00:00Z"} for i in range(1, 4)]
    client.post("/api/v1/ingest/manual-entry", params={"subject_id": "a"}, json={"entries": entries})
    points = client.get(
        "/api/v1/subjects/a/data-points", params={"start": "2026-11-12T00:00:00", "end": "2026-11-13T00:00:00"}
    ).json()
    assert [p["values"]["value"] for p in points] == [62.0]


def test_errors(client):
    ok = {"subject_id": "astro-01"}
    assert client.post("/api/v1/ingest/fitbit", params=ok, json={}).status_code == 404
    assert client.post("/api/v1/ingest/manual-entry", params=ok, content="{not json").status_code == 400
    assert client.post("/api/v1/ingest/manual-entry", params={"subject_id": "bad id!"}, json={}).status_code == 422
    assert client.get("/api/v1/subjects/a/data-points", params={"metric": "steps"}).status_code == 400
    assert client.get("/api/v1/ingestions/nope").status_code == 404


def test_payload_size_limit(client):
    big = json.dumps({"entries": [], "pad": "x" * 6_000_000})
    response = client.post("/api/v1/ingest/manual-entry", params={"subject_id": "a"}, content=big)
    assert response.status_code == 413


def _hr(day: int, value: float) -> dict:
    return {"metric": "heart-rate", "value": value, "time": f"2026-11-{day:02d}T08:00:00Z"}


def test_stats_and_ingestion_list(client):
    client.post("/api/v1/ingest/manual-entry", params={"subject_id": "crew-01"},
                json={"entries": [_hr(1, 60), _hr(2, 62), {"metric": "mood", "value": 4, "time": "2026-11-02T07:00:00Z"}]})
    client.post("/api/v1/ingest/manual-entry", params={"subject_id": "crew-02"},
                json={"entries": [_hr(3, 70), {"metric": "heart-rate", "value": 900, "time": "2026-11-03T09:00:00Z"}]})

    stats = client.get("/api/v1/stats").json()
    assert stats["data_points"] == 4 and stats["ingestions"] == 2
    rows = {(c["subject_id"], c["metric"]): c for c in stats["coverage"]}
    assert rows[("crew-01", "heart-rate")]["count"] == 2
    assert rows[("crew-01", "heart-rate")]["first"].startswith("2026-11-01T08:00")
    assert rows[("crew-01", "heart-rate")]["last"].startswith("2026-11-02T08:00")
    assert ("crew-02", "mood") not in rows

    uploads = client.get("/api/v1/ingestions").json()
    assert [u["subject_id"] for u in uploads] == ["crew-02", "crew-01"]
    assert len(uploads[0]["rejected"]) == 1
    assert [u["subject_id"] for u in client.get("/api/v1/ingestions", params={"subject_id": "crew-01"}).json()] == ["crew-01"]


def test_data_points_newest_first(client):
    client.post("/api/v1/ingest/manual-entry", params={"subject_id": "a"}, json={"entries": [_hr(d, 60 + d) for d in (1, 2, 3)]})
    newest = client.get("/api/v1/subjects/a/data-points", params={"order": "desc", "limit": 2}).json()
    assert [p["values"]["value"] for p in newest] == [63.0, 62.0]
    assert client.get("/api/v1/subjects/a/data-points", params={"order": "sideways"}).status_code == 422


def test_viewer_page_and_root_redirect(client):
    page = client.get("/viewer")
    assert page.status_code == 200 and "Siryius data viewer" in page.text
    root = client.get("/", follow_redirects=False)
    assert root.status_code in (302, 307) and root.headers["location"] == "/viewer"

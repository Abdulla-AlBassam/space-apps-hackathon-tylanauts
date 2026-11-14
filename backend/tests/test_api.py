import json


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

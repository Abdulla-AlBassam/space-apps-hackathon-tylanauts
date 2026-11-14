# Developing the backend (backend contributors only)

**Frontend work never needs this page.** The dashboard uses the live API at
`https://tylanauts-api.vercel.app` ([README.md](README.md)). Use this page only when changing the
backend's own code: adding a device adapter, a metric, or an endpoint.

A copy run on your laptop has **its own empty database**, separate from the live one. Nothing you
do locally shows up on the dashboard. The live API changes only when the backend owner redeploys
([DEPLOY.md](DEPLOY.md)).

## Run it on your laptop

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8001
```

Docs at http://localhost:8001/docs. Port 8001, because the dashboard's own preview uses 8000.
With no `DATABASE_URL` set it stores data in a local SQLite file.

## Tests

```bash
.venv/bin/python -m pytest -q
```

To also run every storage test against Postgres, point `TEST_DATABASE_URL` at a **throwaway**
database (its tables are wiped), never the live one:

```bash
docker run -d --name pg-test -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16-alpine
TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/postgres .venv/bin/python -m pytest -q
```

## Add a new device

1. Create `app/adapters/my_device.py`:

   ```python
   import json
   from app.adapters.base import Adapter, PayloadError, register
   from app.domain.models import Measurement, RecordError

   @register
   class MyDeviceAdapter(Adapter):
       id = "my-device"
       name = "My Device export"
       description = "What this format is and where it comes from."
       example = json.dumps({"readings": [{"ts": "2026-11-14T08:00:00Z", "pulse": 61}]})

       def parse(self, payload):
           try:
               data = json.loads(payload)
           except json.JSONDecodeError as e:
               raise PayloadError(f"not valid JSON: {e}")
           for i, r in enumerate(data.get("readings", [])):
               if "ts" not in r:
                   yield RecordError(ref=f"readings[{i}]", reason="missing ts")
                   continue
               yield Measurement(metric="heart-rate", value=r["pulse"], unit="bpm", time=r["ts"], ref=f"readings[{i}]")
   ```

2. Run the tests. Your adapter is discovered automatically, shows up in `GET /api/v1/adapters`,
   and its `example` is pushed through the whole pipeline by `test_every_adapter_example_ingests_cleanly`.

You never build the standard format yourself: yield `Measurement`s in whatever unit the device
uses, and the pipeline converts, checks and builds the standard data point.

## Add a new metric

1. Add a `MetricDefinition` in `app/domain/metrics.py`.
2. If Open mHealth has a schema for it, use namespace `omh` and run `.venv/bin/python scripts/fetch_schemas.py`
   to bundle it. If not, write one in `app/standards/schemas/astro/` (copy `mood-1.0.json`).
3. If it needs new units, add them in `app/domain/units.py`.

## After changing any endpoint

Regenerate the API schema, or the tests fail:

```bash
.venv/bin/python scripts/export_openapi.py
```

Then ask the backend owner to redeploy so the live API matches.

## Folder map

```
app/
  main.py            builds the app (wires storage, pipeline, routes)
  config.py          settings from environment variables
  api/routes/        HTTP only: read the request, call the pipeline/storage, return JSON
  adapters/          one file per input format -> Measurements
  domain/            metric catalog, unit conversions, data models (no web or database code)
  pipeline/          normalize -> build standard data point -> ingest orchestration
  standards/         schema validation + bundled official schemas (works offline)
  storage/           Repository interface + SQLite and Postgres implementations
openapi.json         the API schema (generated)
scripts/fetch_schemas.py   refresh the bundled official schemas
scripts/export_openapi.py  regenerate openapi.json
tests/
```

## Settings (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | unset | Postgres connection string. Set = Postgres (required on Vercel), unset = SQLite |
| `HEALTH_DB_PATH` | `backend/data/health.db` | SQLite file, when `DATABASE_URL` is unset |
| `INGEST_API_KEY` | unset | Secret required in the `X-Api-Key` header to send data. Unset = no check |
| `CORS_ORIGINS` | `*` | Comma-separated browser origins allowed to call the API |
| `MAX_PAYLOAD_BYTES` | `5000000` | Largest accepted upload (Vercel itself caps requests at 4.5 MB) |

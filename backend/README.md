# Astronaut Health Data API (backend)

Takes health readings from many kinds of devices and inputs, converts them all into one standard
format (IEEE 1752.1 / Open mHealth data points), checks them, and stores them. Any frontend can use
it over plain HTTP + JSON.

**Live API:** https://tylanauts-api.vercel.app (try it at
https://tylanauts-api.vercel.app/docs). Sending data needs the shared `X-Api-Key`; ask nayem-m.

Design explained in [ARCHITECTURE.md](ARCHITECTURE.md). How the frontend and the plan docs connect to it: [INTEGRATION.md](INTEGRATION.md).

## Run it

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload
```

Then open http://localhost:8000/docs for interactive API docs where you can try every endpoint.
Locally it stores data in a SQLite file; set `DATABASE_URL` to use Postgres instead.
Hosting on Vercel with Postgres: [DEPLOY.md](DEPLOY.md).

Tests: `.venv/bin/python -m pytest -q`. To also run every storage test against Postgres, point
`TEST_DATABASE_URL` at a **throwaway** database (its tables are wiped), e.g.:

```bash
docker run -d --name pg-test -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16-alpine
TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/postgres .venv/bin/python -m pytest -q
```

## API schema

[`openapi.json`](openapi.json) is the full API contract (OpenAPI 3): every endpoint, parameter
and response shape. Frontend developers can read it at `/docs` on a running server, or generate
client code from the file. Each endpoint has a short id (`ingest`, `query_data_points`,
`list_metrics`...).

After changing an endpoint, regenerate it: `.venv/bin/python scripts/export_openapi.py`.
A test fails if the committed file is out of date.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | Is the server up, and which storage it uses |
| GET | `/api/v1/metrics` | Every metric we understand, its canonical unit and allowed range |
| GET | `/api/v1/adapters` | Every input format we accept, with a ready-to-send example |
| POST | `/api/v1/ingest/{adapter_id}?subject_id=astro-01&device_id=...` | Send a payload; get a report of what was accepted, rejected (with reasons) or skipped as a duplicate. Needs the `X-Api-Key` header when the server has `INGEST_API_KEY` set |
| GET | `/api/v1/ingestions/{ingestion_id}` | Look up a past ingestion report |
| GET | `/api/v1/subjects` | Subjects that have data |
| GET | `/api/v1/subjects/{subject_id}/data-points?metric=&start=&end=&limit=` | Stored data, oldest first |

Example:

```bash
curl -X POST "localhost:8000/api/v1/ingest/manual-entry?subject_id=astro-01" \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"metric":"heart-rate","value":62,"unit":"bpm","time":"2026-11-14T08:00:00Z"}]}'
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
| `INGEST_API_KEY` | unset | Secret required in the `X-Api-Key` header to send data. Unset = no check (local only) |
| `CORS_ORIGINS` | `*` | Comma-separated frontend origins allowed to call the API |
| `MAX_PAYLOAD_BYTES` | `5000000` | Largest accepted upload |

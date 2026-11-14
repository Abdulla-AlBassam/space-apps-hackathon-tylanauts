# Siryius Health Data API

The live backend for the Siryius dashboard. It takes health readings from devices and from what
astronauts type in, converts them into one standard format (IEEE 1752.1 / Open mHealth), checks
them, and stores them in a hosted Postgres database.

| | |
| --- | --- |
| **Base URL** | `https://tylanauts-api.vercel.app` |
| **Try every endpoint in the browser** | https://tylanauts-api.vercel.app/docs |
| **API schema (OpenAPI 3)** | https://tylanauts-api.vercel.app/openapi.json (same as [`openapi.json`](openapi.json) here) |
| **Is it up?** | https://tylanauts-api.vercel.app/health returns `{"status": "ok", "storage": "postgres", ...}` |

> **Use the live API only.** Frontend code calls `https://tylanauts-api.vercel.app` directly.
> Don't install, start or run this backend locally, and don't point the API address at
> `localhost`: a local copy has its own empty database, and the dashboard would show nothing real.
> Nothing in this folder needs to run for the frontend to work.

## Who can call it

- **Reading** needs no key.
- **Sending data** needs the `X-Api-Key` header (see [Sending data](#sending-data)).
- **Browsers** may call it only from these addresses: `https://tylanauts-crew-health.vercel.app`
  (the live dashboard), `http://localhost:8000` and `http://127.0.0.1:8000` (the dashboard's own
  local preview, `python3 -m http.server 8000` in `app/`). Any other address, such as a Vercel
  preview link, is blocked by the browser. Ask nayem-m to add it.

## Reading data

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/v1/subjects` | Ids of everyone with data, e.g. `["crew-01", "crew-02"]` |
| GET | `/api/v1/subjects/{subject_id}/data-points` | That person's stored readings, oldest first |
| GET | `/api/v1/metrics` | Every metric the backend stores: id, label, unit, possible range |
| GET | `/api/v1/adapters` | Every input format it accepts, each with a ready-to-send example |
| GET | `/api/v1/ingestions/{ingestion_id}` | The report of one past upload |

Filters for `/data-points`, all optional:

| Parameter | Meaning |
| --- | --- |
| `metric` | Only one metric, e.g. `heart-rate` (unknown names return `400` listing the valid ones) |
| `start` | From this time, inclusive, e.g. `2026-11-01T00:00:00Z` |
| `end` | Up to this time, exclusive |
| `limit` | 1 to 5000, default 500 |

A subject with no data returns `[]`, not an error.

```js
const API = "https://tylanauts-api.vercel.app/api/v1";
const res = await fetch(`${API}/subjects/crew-01/data-points?metric=heart-rate&limit=5000`);
if (!res.ok) throw new Error(`API returned ${res.status}`);
const records = await res.json();
```

Each record looks like this (a real one from the live database, ids shortened):

```json
{
  "uuid": "…",
  "subject_id": "deploy-check",
  "metric": "heart-rate",
  "device_id": null,
  "adapter_id": "manual-entry",
  "ingestion_id": "…",
  "effective_start": "2026-11-14T09:00:00Z",
  "effective_end": null,
  "values": {"value": 61.0},
  "data_point": {
    "header": {"uuid": "…", "schema_id": {"namespace": "omh", "name": "heart-rate", "version": "3.0"},
               "source_creation_date_time": "…", "modality": "sensed"},
    "body": {"heart_rate": {"value": 61.0, "unit": "beats/min"},
             "effective_time_frame": {"date_time": "2026-11-14T09:00:00Z"}}
  }
}
```

- **The number** is in `values`: `values.value` for most metrics, `values.systolic` and
  `values.diastolic` for blood pressure.
- **The unit** is always the metric's standard unit (table below), also inside `data_point.body`.
- **Times** are always UTC. Point-in-time readings have only `effective_start`. Periods such as a
  night's sleep also have `effective_end`.
- **`data_point`** is the full standard record. Most screens never need it.

### Metrics

| id | Unit | Notes |
| --- | --- | --- |
| `heart-rate` | beats/min | |
| `blood-pressure` | mmHg | Two values: `systolic`, `diastolic` |
| `body-temperature` | C | |
| `blood-glucose` | mg/dL | |
| `oxygen-saturation` | % | SpO2 |
| `respiratory-rate` | breaths/min | |
| `sleep-duration` | h | A period: has `effective_end` |
| `heart-rate-variability` | ms | RMSSD |
| `mood` | score | 1 (very low) to 5 (very good), typed in; may carry a note |
| `radiation-dose` | mSv | Dose equivalent, often per day (a period) |

`GET /api/v1/metrics` is the source of truth if this table and the API ever differ.

### Using it in the current dashboard

[`examples/readings-client.js`](examples/readings-client.js) has `fetchReadings(astronautId)`. It
calls the live API and returns the flat rows `app/data.js` already uses (`resting_hr`,
`hrv_rmssd`, ...), so the code after `generateReadings()` keeps working. The mapping, and which
dashboard metrics the backend doesn't store yet, are in [INTEGRATION.md](INTEGRATION.md).

## Sending data

`POST /api/v1/ingest/{adapter_id}?subject_id=crew-01&device_id=watch-01`

- **Header `X-Api-Key`** is required, or the reply is `401`. The key is a secret: ask nayem-m for
  it, and never write it into code or files committed to the repo.
- **`adapter_id`** says what format the body is in. For anything a person types in (check-in
  form, health log), use `manual-entry`.
- **`subject_id`** is who the data belongs to: letters, digits, `.`, `_`, `-`, up to 100
  characters. Use `crew-01` to `crew-04` for the simulated crew. `deploy-check` is a test
  subject: ignore it.
- **`device_id`** is optional: which physical device sent it.

The `manual-entry` body:

```json
{"entries": [
  {"metric": "mood", "value": 4, "time": "2026-11-14T07:40:00Z", "extras": {"note": "Slept well"}},
  {"metric": "blood-pressure", "value": {"systolic": 118, "diastolic": 76}, "unit": "mmHg",
   "time": "2026-11-14T07:42:00Z"},
  {"metric": "sleep-duration", "value": 6.5, "unit": "h",
   "start": "2026-11-13T22:30:00Z", "end": "2026-11-14T05:30:00Z"}
]}
```

- **`time`** is when it was measured. Sleep and other periods use `start` and `end` instead.
  Always send UTC with a `Z`. A time with no timezone is assumed to be UTC, and the reply warns.
- **`unit`** is optional. Leave it out to mean the standard unit. Common spellings are converted
  (`bpm`, `°F`, `mmol/L`, `hours`...).
- **`modality`** is `self-reported` by default for this adapter. Use `"sensed"` for instrument
  readings.

The reply is a report, with status `200` even when some entries were rejected:

```json
{"ingestion_id": "…", "received": 3, "accepted": 2, "duplicates": 0,
 "rejected": [{"ref": "entries[1]", "reason": "blood-pressure: systolic must be higher than diastolic (values may be swapped)"}],
 "warnings": [], "data_point_ids": ["…", "…"]}
```

Show `rejected[].reason` to the user: it says what to fix. Sending exactly the same reading again
is safe; it's counted under `duplicates` and not stored twice.

### Errors

| Status | When | Body |
| --- | --- | --- |
| `400` | Nothing in the body could be read (e.g. not JSON), or an unknown `metric` filter | `{"detail": "<what's wrong>"}` |
| `401` | Sending without the right `X-Api-Key` | `{"detail": "missing or wrong X-Api-Key header"}` |
| `404` | Unknown adapter or ingestion id | `{"detail": "<what's wrong>"}` |
| `413` | Body over 4.5 MB (Vercel's limit). Split large uploads | Vercel's error, not JSON |
| `422` | A query parameter has the wrong shape (e.g. a `subject_id` with spaces) | FastAPI's validation details |

## More

- [INTEGRATION.md](INTEGRATION.md): how this differs from the earlier plan, and the dashboard
  metric mapping.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the backend works inside.
- [DEVELOPING.md](DEVELOPING.md): for backend contributors only (adding devices and metrics).
- [DEPLOY.md](DEPLOY.md): for the backend owner only (hosting and redeploying).

# Siryius Health Data API

The live backend for the Siryius dashboard. It takes health readings from devices and from what
astronauts type in, converts them into one standard format (IEEE 1752.1 / Open mHealth), checks
them, and stores them in a hosted Postgres database.

**All the team's links on one page: [LINKS.md](LINKS.md).**

| | |
| --- | --- |
| **Base URL** | `https://tylanauts-api.vercel.app` |
| **See what's stored** | https://tylanauts-api.vercel.app/viewer (totals, who has which data, charts, recent uploads and their rejections; refreshes every 10 s) |
| **Live simulated devices** | https://tylanauts-api.vercel.app/live (18 wearables sending live data, with levers to worsen each crew member; see [Live device simulator](#live-device-simulator)) |
| **Try every endpoint in the browser** | https://tylanauts-api.vercel.app/docs |
| **API schema (OpenAPI 3)** | https://tylanauts-api.vercel.app/openapi.json (same as [`openapi.json`](openapi.json) here) |
| **Is it up?** | https://tylanauts-api.vercel.app/health returns `{"status": "ok", "storage": "postgres", ...}` |

> **Use the live API only.** Frontend code calls `https://tylanauts-api.vercel.app` directly.
> Don't install, start or run this backend locally, and don't point the API address at
> `localhost`: a local copy has its own empty database, and the dashboard would show nothing real.
> Nothing in this folder needs to run for the frontend to work.

## Who can call it

- **Reading** needs no key.
- **Sending data** needs the `X-Api-Key` header; the key is in [Sending data](#sending-data).
- **Browsers** may call it only from these addresses: `https://abdulla-albassam.github.io` (the
  dashboard on GitHub Pages), `https://tylanauts-crew-health.vercel.app` (its old Vercel address),
  `http://localhost:8000` and `http://127.0.0.1:8000` (the dashboard's own local preview,
  `python3 -m http.server 8000` in `app/`). Any other address is blocked by the browser. Ask
  nayem-m to add it.

## Reading data

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/v1/subjects` | Ids of everyone with data, e.g. `["crew-01", "crew-02"]` |
| GET | `/api/v1/subjects/{subject_id}/data-points` | That person's stored readings, oldest first (or newest first with `order=desc`) |
| GET | `/api/v1/stats` | Totals, plus for every subject and metric: how many readings, first and latest time |
| GET | `/api/v1/metrics` | Every metric the backend stores: id, label, unit, possible range |
| GET | `/api/v1/adapters` | Every input format it accepts, each with a ready-to-send example |
| GET | `/api/v1/ingestions` | Recent upload reports, newest first (`limit` up to 500, optional `subject_id`) |
| GET | `/api/v1/ingestions/{ingestion_id}` | The report of one past upload |

Filters for `/data-points`, all optional:

| Parameter | Meaning |
| --- | --- |
| `metric` | Only one metric, e.g. `heart-rate` (unknown names return `400` listing the valid ones) |
| `start` | From this time, inclusive, e.g. `2026-11-01T00:00:00Z` |
| `end` | Up to this time, exclusive |
| `limit` | 1 to 5000, default 500 |
| `order` | `asc` (oldest first, default) or `desc` (newest first: use with `limit` for "latest N") |

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

[`examples/readings-client.js`](examples/readings-client.js) has two ready-made functions, both
tested against the live API:

- `fetchReadings(astronautId)` returns the flat rows `app/data.js` already uses (`resting_hr`,
  `hrv_rmssd`, ...), so the code after `generateReadings()` keeps working.
- `sendEntries(astronautId, entries)` saves typed-in readings (the `manual-entry` format below)
  and returns the backend's report.
 The mapping, and which
dashboard metrics the backend doesn't store yet, are in [INTEGRATION.md](INTEGRATION.md).

## Sending data

`POST /api/v1/ingest/{adapter_id}?subject_id=crew-01&device_id=watch-01`

- **Header `X-Api-Key: 3MewV-3_MgznYQphRZqO9J0_vM-7azB8`** is required, or the reply is `401`.
  It's kept in the repo on purpose (demo data only). The same key is in
  [`examples/readings-client.js`](examples/readings-client.js), whose `sendEntries()` sends
  typed-in readings for you.
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

## Live device simulator

https://tylanauts-api.vercel.app/live shows 6 crew members (`crew-01` to `crew-06`), each wearing
a smart watch, a smart shirt and a radiation badge: 18 simulated devices.

- **What they send:**
  - Smart watch: heart rate and SpO2, through the `smart-watch` adapter.
  - Smart shirt: breathing rate, HRV and blood pressure, through `smart-shirt`.
  - Radiation badge: the rolling 24-hour dose, through `dosimeter`.
- **How often:** one reading per device every 10 seconds, into the same live database the
  dashboard reads. The readings land on the real crew ids, so the dashboard shows them.
- **Only while the page is open.** The page asks the backend every 5 seconds to send whatever
  is due (Vercel can't run a background loop). Close it, or press **Pause devices**, and they stop.
- **Storage stays small.** Simulated readings (device ids starting with `sim-`) are deleted
  after 60 minutes. Nothing else is ever deleted. The page shows readings kept, readings
  cleaned up, and the database size.
- **Levers.**
  - Per crew member: **Stress / fatigue** (heart rate and blood pressure up, HRV down),
    **Low oxygen** (SpO2 down, breathing and heart rate up), **Radiation** (up to 40× the
    normal dose).
  - Per device: **On** and **Faulty sensor** (every other reading is impossible, and the
    backend rejects it with a reason).
  - **Solar storm** sets radiation to maximum for everyone. **Reset levers** puts everything
    back to normal.
- **Shared:** levers are saved in the database, so everyone sees the same state.
- **For the dashboard:** to show it reacting, keep reading `crew-*` data every few seconds;
  a raised lever shows up in the latest readings within about 10 seconds.

Endpoints (no key needed; anyone with the address can move the levers):

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/v1/sim` | Levers, each device's latest values and counts, storage |
| PUT | `/api/v1/sim/settings` | Replace the levers (send back the `settings` object from GET, changed) |
| POST | `/api/v1/sim/tick` | Send the readings that are due and clean up old simulated data |

## More

- [INTEGRATION.md](INTEGRATION.md): how this differs from the earlier plan, and the dashboard
  metric mapping.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the backend works inside.
- [DEVELOPING.md](DEVELOPING.md): for backend contributors only (adding devices and metrics).
- [DEPLOY.md](DEPLOY.md): for the backend owner only (hosting and redeploying).

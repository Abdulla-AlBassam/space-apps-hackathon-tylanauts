# Connecting to the backend (for the team)

The backend is the hub from `docs/DEVICE_HUB.md`, built on the IEEE 1752.1 / Open mHealth
standard. This page says what changes for the frontend and the plan docs, and what the backend
does and doesn't cover yet. How to use the live API: [README.md](README.md). How it works:
[ARCHITECTURE.md](ARCHITECTURE.md).

Always use the live backend at `https://tylanauts-api.vercel.app`. Don't run a local copy for
frontend work: it has its own empty database.

## 1. What changes from the current plan

| Plan said | Backend does | Why |
| --- | --- | --- |
| Flat common row: `astronaut_id, device_id, device_type, metric, value, unit, time, quality` | Each reading is a standard IEEE 1752.1 / Open mHealth **data point**, stored inside a record that adds who, which device and which adapter | A real standard, checked against the official schemas, exportable as is. The flat rows are one function away (section 3) |
| `astronaut_id` | `subject_id` | Same thing |
| `device_type` | `adapter_id` (the input format: one adapter per device type) | Same thing once each device type has its adapter |
| Metric names like `resting_hr`, `hrv_rmssd` | Catalog ids like `heart-rate`, `heart-rate-variability` (list: `GET /api/v1/metrics`) | Match the standard's schema names |
| `value` | `values`: `{"value": 58}`, or `{"systolic": 118, "diastolic": 76}` for blood pressure | Some metrics have two numbers |
| `time` | `effective_start`, plus `effective_end` for periods like sleep | Sleep and daily doses cover a period |
| `POST /api/ingest/watch` | `POST /api/v1/ingest/{adapter_id}?subject_id=crew-01&device_id=watch-01` | One address pattern for every device; `/v1` so it can change later without breaking you |
| `GET /api/readings?astronaut_id=...&from=...&to=...` | `GET /api/v1/subjects/{subject_id}/data-points?metric=&start=&end=&limit=` | |
| Bad message gets a clear error | Each bad reading is rejected with where and why; the rest of the message is still stored. Sending the same data twice is safe | |
| Typed-in results marked `manual` | `manual-entry` adapter; readings marked `self-reported` | |
| Storage undecided | Postgres (Neon), hosted with the API on Vercel | Vercel can't keep files |
| Tech stack undecided | Python 3.12 + FastAPI on Vercel, like the dashboard ([DEPLOY.md](DEPLOY.md)). Live at https://tylanauts-api.vercel.app | |
| No API description | [`openapi.json`](openapi.json): the full API schema, also browsable at `/docs` | Frontend can build against it, or generate a client |

## 2. Metric names: dashboard to backend

| Dashboard (`app/data.js`) | Backend metric | Supported |
| --- | --- | --- |
| `resting_hr` | `heart-rate` | Yes (resting vs exercise not told apart yet) |
| `spo2` | `oxygen-saturation` | Yes |
| `hrv_rmssd` | `heart-rate-variability` | Yes |
| `resp_rate` | `respiratory-rate` | Yes |
| `sleep_hours` | `sleep-duration` | Yes (send start and end of sleep) |
| `radiation_dose` | `radiation-dose` (mSv) | Yes |
| `mood` (1-5) | `mood` | Yes |
| blood pressure (health log) | `blood-pressure` | Yes |
| | `body-temperature`, `blood-glucose` | Yes, not used by the dashboard yet |
| `skin_temp_delta` | none | **No** |
| `exercise_minutes` | none | **No** |
| `avg_exercise_hr` | none | **No** (would be `heart-rate` marked "during exercise") |
| `deep_sleep_pct` | none | **No** |
| body mass (scale) | none | **No** |
| "How rested" 1-5, symptoms, ECG, cognitive test, fitness test | none | **No** (and yes/no answers aren't supported yet) |

Ask for any "No" you need. Each one is a few lines in `app/domain/metrics.py`.

## 3. Replacing `generateReadings()` in the dashboard

[`examples/readings-client.js`](examples/readings-client.js) has `fetchReadings(astronautId)`.
It calls the backend and returns the same flat rows `app/data.js` builds today, with the
dashboard's metric names, so `groupByDay()` and everything after it keep working. Tested against
the running backend.

```js
const readings = await fetchReadings("crew-01");
// [{ astronaut_id: "crew-01", device_id: "watch-01", device_type: "watch",
//    metric: "resting_hr", value: 58, unit: "beats/min", time: "2026-11-14T06:00:00Z" }, ...]
```

Two things to change around it:

- `fetch` is asynchronous, so the page has to wait for the data before drawing (today
  `generateReadings()` returns instantly).
- `API_BASE` already points at the live backend, https://tylanauts-api.vercel.app. Keep it that
  way. It allows requests from the dashboard on GitHub Pages (`https://abdulla-albassam.github.io`)
  and from the dashboard's local preview on `localhost:8000`; tell the backend owner about any
  other address.
- Units come back in the standard's spelling (`beats/min`, `C`), not `bpm` / `°C`.

## 4. Sending data (simulator, typed-in logs, new devices)

```bash
curl -X POST "https://tylanauts-api.vercel.app/api/v1/ingest/manual-entry?subject_id=crew-01" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: 3MewV-3_MgznYQphRZqO9J0_vM-7azB8" \
  -d '{"entries":[{"metric":"mood","value":4,"time":"2026-11-14T08:00:00Z","extras":{"note":"Slept well"}}]}'
```

- Sending needs the shared key in `X-Api-Key` (the one above, kept in the repo on purpose for the
  demo). Reading never needs it. `sendEntries()` in `examples/readings-client.js` adds it for you.
- Every input format and a working example of its payload: `GET /api/v1/adapters`.
- The reply always says how many readings were accepted, how many were duplicates, and why
  any were rejected. Full details: [README.md](README.md#sending-data).
- Watch, chest strap and headband each need their own adapter (a backend change, see
  [DEVELOPING.md](DEVELOPING.md)). Until those exist, the simulator can send through
  `manual-entry` (JSON) or `csv-table` (CSV).
- Try every endpoint in the browser at https://tylanauts-api.vercel.app/docs.

## 5. Plan docs that need updating

| File | What to change |
| --- | --- |
| `docs/PLAN.md` decisions table | Tech stack: Python + FastAPI backend. Common data format: IEEE 1752.1 / Open mHealth, link to this page |
| `docs/DEVICE_HUB.md` "The common format" | Replace the flat table with section 1 above; webhook addresses become `/api/v1/ingest/{adapter_id}` |
| `docs/SUMMARY.md` 4.1, 4.2, 4.3 | Same field names, endpoints and storage as above |
| Issue #2 | Format is decided: link this page |
| Issue #37 | Addresses are `/api/v1/ingest/{adapter_id}` |

## 6. Not built yet

- **No per-person login.** Sending is protected by one shared key; reading is open.
- **Device list** (#38): add, pause, remove, battery, last sync.
- **Due and overdue tests** (#23), and the test catalogue it needs (#21).
- **`quality`** per reading and the device priority list (#39).
- **Watch, chest strap and headband adapters** (#37), and the **simulator** (#3).
- **Device-to-astronaut lookup.** Right now the sender names the astronaut in the URL; a real
  device only knows its own id.

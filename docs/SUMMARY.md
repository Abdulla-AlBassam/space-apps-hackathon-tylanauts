# Siryius: project summary (start here)

The one page that says what Team Tylanauts is building, what is decided, what is
still open, and what each person builds next. Written 14 Nov 2026 from the repo,
the Issues and the team chat. If something here is wrong, fix it in a pull request.

Labels used on this page:

- **Decided**: agreed with Abdulla. Build on it.
- **Proposed**: a sensible default written for this page. Use it unless the team says otherwise.
- **Undecided**: needs a team decision before anyone builds on it.

---

## 1. The pitch in one paragraph

On long missions astronauts have to spot changes in their own health, often far from
a doctor. **Siryius** is **one health hub for every wearable an astronaut wears**: a watch,
a chest strap, a headband, a radiation badge. Each device sends its readings to the hub,
the hub turns them into one common format and **combines them**, so readings can be
cross-checked and patterns that no single device can see get noticed. The astronaut
gets three simple scores (**Recovery, Radiation, Mind**), a 3D body map showing where
attention is needed, a health log with reminders for tests they type in, and a plain
"here's what to do" when something drifts. A flight surgeon on Earth can switch to a
more detailed view. For the hackathon all devices are **simulated**, but they send data
to **real web addresses on a small server**, so the data really flows through the hub.

## 2. What is decided

| Topic | Decision | Where it's written |
| --- | --- | --- |
| Name | The platform is called **Siryius**. | This page |
| Priority | **Software first.** Real hardware only after the MVP works. | [PLAN.md](PLAN.md) |
| Core idea | A hub that takes data from many wearables and combines it. | [DEVICE_HUB.md](DEVICE_HUB.md) (in PR #18, not merged yet) |
| How data arrives | Simulated devices send to **real webhooks** (web addresses) on a small server, one per device type. | DEVICE_HUB.md, Issue #37 |
| Devices we simulate | Watch, chest strap, headband. The app also shows a radiation badge and a body-mass scale. | PLAN.md, `app/data.js` |
| Headline scores | **Recovery, Radiation, Mind.** The formulas in the app are placeholders. | [design/DESIGN_BRIEF.md](design/DESIGN_BRIEF.md) |
| Who it's for | The astronaut, plus a flight surgeon view (a switch in the header). | DESIGN_BRIEF.md |
| Look | Desktop screen. Space Apps brand colours and fonts only, **no NASA logo**, icons everywhere, `?` help pop-ups, subtle space background. | DESIGN_BRIEF.md |
| Health log | 5 categories (Heart, Sleep, Mind & mood, Radiation, Bone & muscle), one astronaut's own view. | [HEALTH_LOG.md](HEALTH_LOG.md) |
| Device vs typed in | Devices fill in heart, sleep, activity and radiation dose. Blood/urine, eyes, hearing, mood and symptoms are typed in. | HEALTH_LOG.md |
| Warnings | Some warnings come from combining devices (e.g. bad sleep from the headband plus a high resting heart rate from the watch). | HEALTH_LOG.md |
| Reminders | For typed-in tests, plus a "device not synced in 24 hours" alert. | HEALTH_LOG.md |
| Data | All daily readings are simulated (daily vitals for real astronauts aren't public). Real NASA data (Inspiration4 blood panels, ISS radiation) can shape the numbers. | [DATA_SOURCES.md](DATA_SOURCES.md) |
| Connecting devices | A **mock** 6-step "Connect a device" walkthrough (every step just clicks Next) and a "My devices" page. | DEVICE_HUB.md |

## 3. How it fits together

```
 Simulator script (pretends to be the devices)
   |  watch        -> POST /api/ingest/watch        -> watch adapter
   |  chest strap  -> POST /api/ingest/chest-strap  -> chest strap adapter
   |  headband     -> POST /api/ingest/headband     -> headband adapter
   v
 Small server (backend)
   - each adapter turns that device's message into common-format readings
   - stores readings, devices, and typed-in health logs
   - answers the frontend's requests (readings, devices, logs, what's due)
   v
 Dashboard website (frontend, app/)
   - combines readings into Recovery / Radiation / Mind scores and alerts
   - Today, Health log, My devices, Body map, Crew pages
```

The data flow in plain English:

1. A (simulated) device sends a message to its own web address. Real devices all send
   data in different shapes, which is why each type gets its own address.
2. That address's **adapter** converts the message into rows in our common format.
   Adding a new kind of device later means one new address and adapter, nothing else.
3. The server **stores** the rows.
4. The dashboard **asks the server** for an astronaut's readings, works out the scores
   and alerts, and shows them, with a label saying which device each number came from.

Right now the dashboard makes up its own readings inside the browser
(`generateReadings()` in `app/data.js`). Once the backend works, that one function is
swapped for a request to the server, and the rest of the dashboard stays the same.

## 4. Backend: what to build

This is the main to-do list for whoever takes the **Backend / data** role.

### 4.1 The common reading format (Issue #2)

One row per measurement. **Decided** fields (from DEVICE_HUB.md):

| Field | Example | Meaning |
| --- | --- | --- |
| `astronaut_id` | `crew-01` | Who it belongs to |
| `device_id` | `watch-01` | Which exact device sent it |
| `device_type` | `watch` | `watch`, `chest-strap`, `headband`, ... |
| `metric` | `resting_hr` | What was measured |
| `value` | `58` | The number |
| `unit` | `bpm` | The unit |
| `time` | `2026-11-14T06:00:00Z` | When it was measured (UTC) |
| `quality` | `good` | Whether it can be trusted (`poor` if the wearer was moving) |

The metric names the dashboard already uses (in `app/data.js`). **Proposed:** keep
these exact names so the dashboard doesn't need changing.

| Metric | Unit | Comes from |
| --- | --- | --- |
| `resting_hr` | bpm | watch |
| `spo2` (blood oxygen) | % | watch |
| `skin_temp_delta` (change from normal) | °C | watch |
| `hrv_rmssd` (heart-rate variability) | ms | chest strap |
| `resp_rate` (breathing rate) | breaths/min | chest strap |
| `exercise_minutes` | min | chest strap |
| `avg_exercise_hr` | bpm | chest strap |
| `sleep_hours` | h | headband |
| `deep_sleep_pct` | % | headband |
| `radiation_dose` | mSv | radiation badge (dosimeter) |

Two small mismatches to settle in Issue #2:

- The dashboard spells the type `chest_strap` (underscore); DEVICE_HUB.md and the
  webhook address use `chest-strap` (dash). **Proposed:** `chest-strap` everywhere.
- The dashboard's readings don't have the `quality` field yet. It should be added.

### 4.2 Endpoints (web addresses)

Only the three ingest addresses are **decided** (Issue #37). The rest are **proposed**
names that match the Issues; agree them with the frontend before building.

| Address | What it does | Issue |
| --- | --- | --- |
| `POST /api/ingest/watch` | Takes a watch message, converts it, saves readings | #37 |
| `POST /api/ingest/chest-strap` | Same for the chest strap | #37 |
| `POST /api/ingest/headband` | Same for the headband | #37 |
| `GET /api/readings?astronaut_id=crew-01&from=...&to=...` | Readings for one astronaut, in the common format | #2 |
| `GET /api/devices?astronaut_id=crew-01` | That astronaut's devices: name, type, status, battery, last sync, paused or not | #38 |
| `POST /api/devices` | Add a device (the Connect walkthrough calls this at the end) | #38 |
| `PATCH /api/devices/:id` | Pause or resume sharing | #38 |
| `DELETE /api/devices/:id` | Remove a device | #38 |
| `POST /api/logs` | Save a typed-in test result (test id, value, note, time) | #22 |
| `GET /api/logs?astronaut_id=crew-01&test=...` | History of a test, mixed with device readings | #22 |
| `GET /api/due?astronaut_id=crew-01&date=...` | Tests due today, overdue tests (and by how long), devices silent for 24 hours | #23 |

Rules for every ingest address: each device gets a made-up message shape of its own
(the simulator sends those shapes), and a bad message gets a clear error back instead
of crashing the server (Issue #37).

Typed-in results use the **same common format**, with the source marked as `manual`
(Issue #22).

### 4.3 Storage

**Undecided** (part of the tech stack, Issue #1). It needs to hold three things:
readings, devices, and typed-in logs. For a hackathon demo a small database or even
a JSON file is enough. One thing to check whichever is picked: some hosting (for
example Vercel's serverless functions) doesn't keep files between requests, so a
JSON file there would lose data. A hosted database avoids that.

### 4.4 The simulator (Issue #3)

A small script that pretends to be the watch, chest strap and headband and sends
their messages to the real ingest addresses. It must be able to:

- **fill in 30 days quickly** before a demo, and
- **keep sending "live" readings** during the demo, so the dashboard visibly updates.

It follows a mission storyline with a few bad days so the alerts have something to
catch. The dashboard's current story (in `app/data.js`): the last 3 days show heart-rate
variability falling, resting heart rate rising and sleep getting shorter, so Recovery
drops three days in a row; and a radiation spike on one earlier day stands in for a
solar event. **Proposed:** the simulator tells the same story so the pitch stays the same.

### 4.5 Backend open questions

- **Tech stack** for the server and where it runs (Issue #1, Abdulla).
- **Where scores are worked out.** Today the dashboard does it in the browser. Keeping
  it there is simplest; moving it to the server is optional. **Undecided.**
- **Device priority** when two devices measure the same thing (e.g. heart rate from the
  chest strap if worn, otherwise the watch). Health logic writes the list (Issue #39);
  backend or frontend applies it. **Undecided** which side.
- Do the radiation badge and the body-mass scale also get ingest addresses, or stay
  inside the simulator only? **Undecided.**
- **AI doctor data** (Issue #32): a short write-up of what it reads and what the
  summary to Earth contains. No build yet.

## 5. Frontend: the pages

Plain HTML, CSS and JavaScript in `app/` (no build step). Live at
**https://tylanauts-crew-health.vercel.app**. A visual redesign is being merged now.

| Page | What's on it | State |
| --- | --- | --- |
| **Today** | Three score cards (Recovery, Radiation, Mind), the 3D body map in the centre with labelled lines to body areas, alerts, what's due, vitals, trend chart, and a raw-readings table in the flight surgeon view | Built (#7) |
| **Body map** (`body-map.html`) | Full-size 3D skeleton and organs (BodyParts3D, CC BY 4.0) that you can turn; six areas glow in their status colour | Built |
| **Health log** (`#log`) | Category cards, what's due and overdue, schedule, history, "Log a result" form | Built in the app with sample data; Issues #24, #25, #26 cover the rest |
| **My devices** (`#devices`) | Device cards (status, battery, last sync) and the mock Connect a device walkthrough | Built in the app; Issues #41, #42 |
| **Crew overview** (`crew.html`) | One crew score, astronaut-by-category grid, "crew patterns" shared by 3+ people | Mock built; feature itself not decided yet |
| **Alerts** | Alert list with suggested actions | Issue #9 |

Everything still runs on simulated data in the browser. The next big frontend step is
reading from the backend once it exists.

## 6. Still undecided

| Question | Who decides | Issue |
| --- | --- | --- |
| Tech stack, including the server and storage | Abdulla / team | #1 |
| Exact metric names and units in the common format | Frontend + backend | #2 |
| Real formulas for Recovery, Radiation and Mind, and score bands | Health logic | #5 |
| First alert rule and its action | Health logic | #6 |
| A warning rule that combines two devices | Health logic | #27 |
| Device priority list | Health logic | #39 |
| Is the AI doctor in the MVP? Scripted or live AI? | Abdulla | #29 |
| Is the crew overview in the final demo? Does the astronaut view hide crewmates' names? | Abdulla | (none yet) |
| Logo and colours for Siryius (within the brand rules) | Pitch | #10 |

## 7. Who owns what

From the Roles table in [PLAN.md](PLAN.md). The Mission Board's "Take" buttons update it.

| Role | Person | Owns |
| --- | --- | --- |
| Lead / integrator | Abdulla | The plan, reviews and merges, making the pieces connect |
| Frontend 1 | Abdulla | Dashboard screen and charts |
| Frontend 2 | FinnAliR | Alerts screen, check-in form, overall look |
| Backend / data | _not filled yet_ | Server, webhooks, storage, simulator |
| Health logic | _not filled yet_ | What we measure, scores and alerts, NASA sources |
| Business / pitch | TaqiTellsTales | Slides, demo video, story, submission write-up |

## 8. Open Issues by role

Issues marked **MVP** are must-haves. Pick one, assign yourself, branch, and open a
pull request with `Closes #N` (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

**Backend**
- #2 Write the common reading format and an example file (MVP, shared with frontend)
- #37 Build a webhook address and adapter for each device type (MVP)
- #3 Build the device simulator: watch, chest strap and headband sending 30 days (MVP)
- #22 Save hand-entered health logs and add sample history (MVP)
- #23 Work out which tests are due or overdue, and spot devices that stopped syncing (MVP)
- #38 Store and list each astronaut's devices (add, pause, remove)
- #32 What data the AI doctor reads and what the summary to Earth contains

Suggested order: #2, then #37, then #3 (now data flows end to end), then #38, #22, #23.

**Frontend**
- #7 Dashboard screen (MVP)
- #9 Alerts screen (MVP)
- #24 Today screen and log entry form (MVP)
- #25 Health history and trends screen (MVP)
- #41 Connect a device walkthrough (MVP)
- #42 My devices page (MVP)
- #8 Trend chart over the mission
- #26 Category cards and reminders screen
- #31 AI doctor chat and escalation screen mock

**Health logic**
- #5 Recovery score formula (MVP)
- #6 First alert rule and its action (MVP)
- #21 Health test catalogue, 5 categories (MVP)
- #39 Device priority list (MVP)
- #4 Which health signals matter in space, with NASA sources
- #27 A warning rule that combines two devices
- #30 AI doctor escalation rules
- #40 Sources for the device combinations table

**Pitch**
- #11 Pitch story and slide outline (MVP)
- #12 Demo video (MVP, with lead)
- #13 Final submission description (MVP, with lead)
- #10 Logo and colours (the name, Siryius, is chosen)
- #33 AI doctor and the delay to Earth in the pitch

**Lead**
- #1 Choose the tech stack and set up the empty app (MVP)
- #29 Decide if the AI doctor is in the MVP and how we demo it

## 9. Links

- Live dashboard: https://tylanauts-crew-health.vercel.app
- Mission Board (tasks and roles): https://tylanauts-board.vercel.app
- Plan: [PLAN.md](PLAN.md) · Device hub: [DEVICE_HUB.md](DEVICE_HUB.md) · Health log: [HEALTH_LOG.md](HEALTH_LOG.md)
- AI doctor idea: [AI_DOCTOR.md](AI_DOCTOR.md) · Data sources: [DATA_SOURCES.md](DATA_SOURCES.md) · Design brief: [design/DESIGN_BRIEF.md](design/DESIGN_BRIEF.md)
- Dashboard code notes: [app/README.md](../app/README.md)

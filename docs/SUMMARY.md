# Sirius: project summary (start here)

One page on what The Tylonauts are building: what works now, what's decided, what's
still open, and who owns what. Last updated 15 Nov 2026, from the code, the Issues and the
pull requests. If something here is wrong, fix it in a pull request.

---

## 1. The pitch in one paragraph

On long missions astronauts have to spot changes in their own health, with a doctor far
away and messages to Earth delayed. **Sirius** is **one health hub for every wearable an
astronaut wears**: a smart watch, a smart shirt and a radiation badge. Each device sends its
readings to the hub, which turns them into one common format and combines them. That lets
readings be cross-checked and catches patterns no single device can see. The astronaut gets
three scores (**Recovery, Radiation, Mind**), a 3D body map showing where attention is
needed, alerts that say what to do, a health log for typed-in tests, and short cognitive
tests. A flight surgeon can switch to a more detailed view. All devices are **simulated**,
but their data really flows through a live backend.

## 2. What works now

| Part | What it is | Where |
| --- | --- | --- |
| **Backend** | Live server that receives device readings, converts them with one adapter per device type (Open mHealth formats), stores them in Neon Postgres and answers the dashboard. Rejects bad readings with a reason. | https://tylanauts-api.vercel.app ([API docs](https://tylanauts-api.vercel.app/docs)) |
| **Simulated devices** | 18 devices (6 crew × smart watch, smart shirt, radiation badge), started and steered from the backend's `/live` page: stress, low oxygen, radiation, solar storm, device on/off, faulty sensor | `/live` on the backend |
| **30-day history** | `simulate.py` fills in 30 days for crew-01 to crew-06, telling the demo's story | [`simulator/simulate.py`](../simulator/simulate.py) |
| **Dashboard** | Plain HTML, CSS and JavaScript, no build step | [`app/`](../app/), live at https://tylanauts-crew-health.vercel.app |
| **Slides** | Demo deck | [`pitch/`](pitch/) |

### Dashboard pages

| Page | What's on it |
| --- | --- |
| **Today** | Recovery, Radiation and Mind on 0–100 dials, the 3D body map, an Alerts card, the score breakdown by device, vitals, this week, a trend chart. Name card switches between the six crew members. Flight surgeon switch shows raw readings. |
| **Alerts** | Alerts grouped as Alert, Watch and For info, each with what happened and what to do |
| **Calendar** | One month: each day's Recovery score, alerts, planned checks and readings |
| **Train** | Four cognitive tests (reaction time, sequence memory, number memory, number order), daily streak, points and badges. Each result is compared with the astronaut's own normal. |
| **Health log** | What's due and overdue, coming up, latest results, and a "Log a result" form |
| **Devices** | Device cards and a mock "Connect a device" walkthrough |
| **Body map** (`body-map.html`) | Full-screen 3D anatomy (BodyParts3D, CC BY 4.0): heart, mind and sleep, eyes, radiation |
| **Crew overview** (`crew.html`) | Crew score, a grid of everyone by category, and "crew patterns" where 3+ people drop together |
| **Debug** (`debug.html`) | Backend status, links to the backend pages, test requests and a log of every API call |
| **Sirius voice** | The logo in the corner reads out today's summary and answers simple questions ("what's my sleep?"). It uses browser speech, with scripted answers and no AI model. |

### Live or simulated

| Data | Source |
| --- | --- |
| Heart rate, HRV, blood oxygen, breathing rate, blood pressure, radiation dose, sleep, mood | **Live** from the backend |
| Skin temperature, deep sleep, exercise, device battery and sync, crew page, Train history | Made up in the browser (pages show a "Simulated data" tag) |
| Results typed into "Log a result" | Kept only until the page reloads (not saved to the backend) |

## 3. How it fits together

```
Simulated devices (/live page, or simulator/simulate.py)
  |  each device type sends to its own adapter on the backend
  v
Backend: tylanauts-api.vercel.app
  - adapter turns the device's message into common-format readings
  - stores them (Neon Postgres); answers GET /api/v1/... (reading needs no key)
  v
Dashboard: app/
  - data.js reads the astronaut's readings and fills gaps with made-up ones
  - works out the scores, alerts (escalation.js) and every page
```

Things to know:

- **Sending data needs the shared ingest key.** Reading doesn't. Ask nayem-m for the key,
  and don't paste it into code or docs.
- **Browsers can only read the backend from** the GitHub Pages copy and `localhost:8000`.
  Ask nayem-m to add any other address.
- **The live devices only send while someone has `/live` open** with "Start devices"
  pressed. Their readings are deleted after 60 minutes.
- If the backend doesn't answer within 6 seconds, the dashboard uses made-up data and says
  so. `?sample` in the address forces that, for working offline.

## 4. What's decided

| Topic | Decision | Where |
| --- | --- | --- |
| Name and team | **Sirius**, by **The Tylonauts** | [README](../README.md) |
| Priority | Software first. A real wearable only once everything else works. | [PLAN.md](PLAN.md) |
| Devices | Smart watch, smart shirt, radiation badge (simulated) | Backend `/live` |
| Tech stack | Plain HTML, CSS and JavaScript dashboard. Backend on Vercel with Neon Postgres. | `app/`, backend |
| Common format | Open mHealth readings, served by the backend's `/api/v1` | [API docs](https://tylanauts-api.vercel.app/docs) |
| Scores | Recovery, Radiation, Mind, marked Steady, Watch or Alert | `app/data.js` |
| Escalation | Five tiers, 0 Nominal to 4 Emergency, using NEWS2 vital-sign bands and each person's own normal. Two Tier 1 flags together make Tier 2. | [ESCALATION_RULES.md](ESCALATION_RULES.md) (Mariam) |
| Health log | Four categories: Heart, Sleep, Mind & mood, Radiation. Bone and muscle dropped (14 Nov). No body mass. | [HEALTH_LOG.md](HEALTH_LOG.md) |
| Schedule | NASA's published schedules where they exist (eye checks FD30, FD90, R-30; cognitive test monthly) | [MONITORING_SCHEDULE.md](MONITORING_SCHEDULE.md) |
| AI doctor | Replaced by the **Sirius voice**: scripted, no AI model | `app/voice.js` |
| Look | The Sirius identity: four colours (Ink, Bone, Slate, Ember), IBM Plex fonts, no NASA logo | [design/](design/) |
| Data | All simulated. Real astronaut vitals aren't public. NASA figures shape the story. | [DATA_SOURCES.md](DATA_SOURCES.md), [CHALLENGE_RESOURCES.md](CHALLENGE_RESOURCES.md) |

## 5. Still open

| Question | Who | Issue |
| --- | --- | --- |
| Real formulas for Recovery and Mind (today's are placeholders in `data.js`) | Health logic | #5 |
| Train cut-offs (15% worse = Watch, 30% = Alert are placeholders), and whether Train feeds the Mind score | Health logic | – |
| A warning rule that combines two devices (e.g. poor sleep plus a high resting heart rate) | Health logic | #27 |
| Which device wins when two measure the same thing | Health logic | #39 |
| Saving typed-in results and the device list to the backend | Backend | #22, #38 |
| Skin temperature, deep sleep and exercise in the backend, so they stop being made up | Backend | – |
| Is the crew overview in the final demo? Does the astronaut view hide crewmates' names? | Abdulla | – |
| Demo video and final submission write-up | Pitch, with Abdulla | #12, #13 |

## 6. Who owns what

| Role | Person |
| --- | --- |
| Lead and integrator, frontend | Abdulla |
| Frontend, research and docs | FinnAliR |
| Backend and device simulator | nayem-m |
| Health logic: escalation rules | Mariam |
| Health research | minhajadnan27 |
| Business and pitch | TaqiTellsTales |

## 7. Issues

Many open Issues describe work that has since been built. Abdulla, worth closing these
after a quick look:

- **Built:** #1 tech stack, #2 common format, #7 dashboard, #8 trend chart, #9 alerts,
  #24 Today and log form, #26 category cards and reminders, #37 adapters per device,
  #41 Connect a device walkthrough, #42 My devices page, #6 first alert rule (escalation.js),
  #11 pitch outline (demo deck), #21 test catalogue (in `data.js`).
- **Replaced:** #29, #31, #32 and #33 (AI doctor). The Sirius voice took its place.

Still genuinely open: #5, #12, #13, #22, #23, #25, #27, #38, #39, #40, #4.

To pick one: assign yourself, branch, and open a pull request with `Closes #N`
(see [CONTRIBUTING.md](../CONTRIBUTING.md)).

## 8. Links

- Live dashboard: https://tylanauts-crew-health.vercel.app (backup: https://abdulla-albassam.github.io/space-apps-hackathon-tylanauts/)
- Backend: https://tylanauts-api.vercel.app · Live devices: https://tylanauts-api.vercel.app/live · Data viewer: https://tylanauts-api.vercel.app/viewer
- Mission Board (tasks and roles): https://tylanauts-board.vercel.app
- Dashboard code notes: [app/README.md](../app/README.md)

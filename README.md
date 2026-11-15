# Sirius: health on board

By **The Tylonauts**, for the **NASA Space Apps Challenge 2026** (Manama local event).

Sirius is an astronaut health dashboard. It collects readings from every wearable an
astronaut wears, combines them into three simple scores, and tells the astronaut in plain
words what needs attention and what to do about it. All readings are simulated, but they
travel through a real backend, just as real devices would send them.

## Links

| What | Where |
| --- | --- |
| Live demo (the dashboard) | https://tylanauts-crew-health.vercel.app |
| Backup copy of the demo | https://abdulla-albassam.github.io/space-apps-hackathon-tylanauts/ |
| Backend (live server) | https://tylanauts-api.vercel.app |
| Backend API docs (try every request in the browser) | https://tylanauts-api.vercel.app/docs |
| Demo slides | [docs/pitch/Sirius_demo_deck.pptx](docs/pitch/Sirius_demo_deck.pptx) ([PDF](docs/pitch/Sirius_demo_deck.pdf)) |

## The challenge

> Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts carry much of the responsibility for spotting these changes in themselves. Your challenge is to build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health.

Event page: https://www.spaceappschallenge.org/2026/local-events/manama/?tab=details

## What Sirius does

Far from Earth, with messages to mission control delayed, astronauts have to notice changes
in their own health. Each wearable sees only part of the picture. Sirius brings them together.

- **One hub for every device.** A smart watch, a smart shirt and a radiation badge each send
  their readings to the backend. Each device type has its own adapter, which converts its
  readings into one common format. Combining devices lets Sirius cross-check readings and
  catch patterns no single device can.
- **Three scores:** **Recovery**, **Radiation** and **Mind**, each on a 0–100 dial and marked
  Steady, Watch or Alert.
- **Alerts with a clear next step.** Escalation rules give each day a tier from 0 (Nominal) to
  4 (Emergency), based on the UK NEWS2 early-warning chart and each astronaut's own normal.
  Every alert says what happened and what to do.
- **A 3D body map** that shows where attention is needed: heart, mind and sleep, eyes, and
  radiation dose.
- **Health log and calendar** for checks that are typed in, such as eye tests, blood pressure
  and mood, with reminders when they're due. The schedule follows published NASA schedules where
  one exists ([MONITORING_SCHEDULE.md](docs/MONITORING_SCHEDULE.md)).
- **Train:** four short cognitive tests (reaction time, sequence memory, number memory, number
  order), modelled on NASA's Cognition battery, with a daily streak. Each result is compared
  with the astronaut's own normal.
- **Sirius voice:** click the logo and it reads out today's summary, or ask it a question
  like "what's my sleep?". It uses the browser's built-in speech, with scripted answers and no AI model.
- **Crew overview:** spots when three or more crew members drop in the same area at once,
  which usually points to a shared cause, like a schedule change.
- **Flight surgeon view and astronaut switcher:** a switch for more detail, and a way to
  view any of the six crew members.

## How it fits together

```
Simulated devices (6 crew x smart watch, smart shirt, radiation badge)
  |   started and steered from the backend's /live page, or filled in by simulator/simulate.py
  v
Backend: tylanauts-api.vercel.app (hosted on Vercel, data in Neon Postgres)
  - one adapter per device type turns its readings into one common format
    (Open mHealth schemas)
  - stores the readings, rejects bad ones with a reason, and answers requests at /api/v1
  v
Dashboard: app/ (plain HTML, CSS and JavaScript, no build step)
  - reads each astronaut's readings, works out the scores and alerts, and draws every page
```

- **Live from the backend:** heart rate, heart rate variability, blood oxygen, breathing rate,
  blood pressure, radiation dose, sleep and mood.
- **Still simulated in the browser:** skin temperature, deep sleep, exercise, the device list
  and the crew page. Pages that use these show a "Simulated data" tag.
- **Debug page:** `app/debug.html` shows whether the backend is up, lets you send test
  requests, and lists every call the app makes.

Real astronauts' daily vitals aren't public, so every reading is simulated. Where NASA has
published figures, they shape the numbers and the story
([DATA_SOURCES.md](docs/DATA_SOURCES.md), [CHALLENGE_RESOURCES.md](docs/CHALLENGE_RESOURCES.md)).

## What's in this repo

| Folder | What it is |
| --- | --- |
| [`app/`](app/) | The Sirius dashboard. How to run it and what each file does: [app/README.md](app/README.md) |
| [`simulator/`](simulator/) | `simulate.py` fills in 30 days of readings for six crew members |
| [`docs/`](docs/) | Plan, research, health rules and design (see below) |
| [`dashboard/`](dashboard/) | The team's Mission Board for tasks and roles (not part of Sirius) |
| [`tools/`](tools/) | Script that builds the 3D body model |

Run the dashboard on your own computer:

```bash
cd app && python3 -m http.server 8000
```

Then open http://localhost:8000. The backend only accepts browser requests from
`localhost:8000` and the GitHub Pages copy, so use port 8000. Add `?sample` to the address to
work offline with made-up data.

## Docs

| If you want to... | Read |
| --- | --- |
| See the plan, roles and decisions | [docs/PLAN.md](docs/PLAN.md) |
| See how devices send data to the hub | [docs/DEVICE_HUB.md](docs/DEVICE_HUB.md) |
| Know what we measure and how often | [docs/HEALTH_LOG.md](docs/HEALTH_LOG.md), [docs/MONITORING_SCHEDULE.md](docs/MONITORING_SCHEDULE.md) |
| See how alerts escalate | [docs/ESCALATION_RULES.md](docs/ESCALATION_RULES.md) |
| See how NASA monitors astronaut health today | [docs/HEALTH_MONITORING_SYSTEMS.md](docs/HEALTH_MONITORING_SYSTEMS.md) |
| See the look and design brief | [docs/design/](docs/design/) |
| Contribute without breaking things | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Use Claude on this repo | [CLAUDE.md](CLAUDE.md) (Claude reads it automatically) |

## The Tylonauts

| Person | Role |
| --- | --- |
| Abdulla | Lead and integrator, frontend |
| FinnAliR | Frontend, research and docs |
| nayem-m | Backend and device simulator |
| Mariam | Health logic: escalation rules |
| TaqiTellsTales | Business and pitch |

## Credits

- 3D anatomy model: **BodyParts3D**, © The Database Center for Life Science, CC BY 4.0.
- 3D drawing: three.js (MIT licence).
- Sirius is an independent student project. It isn't made or endorsed by NASA, and doesn't use the NASA logo.

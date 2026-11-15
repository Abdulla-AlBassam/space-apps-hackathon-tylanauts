# Sirius – Astronaut Health Hub

By Team Tylonauts.

> **New here? Read [docs/SUMMARY.md](docs/SUMMARY.md) first.** It's the one page with what we're building, what's decided, and what's left to do.

Our team's project for the **NASA Space Apps Challenge 2026** (Manama local event).

## Links

| What | Where |
| --- | --- |
| Live demo (the dashboard) | https://tylanauts-crew-health.vercel.app |
| Backup copy of the demo | https://abdulla-albassam.github.io/space-apps-hackathon-tylanauts/ |
| Backend (live server) | https://tylanauts-api.vercel.app |
| Backend API docs (try every request in the browser) | https://tylanauts-api.vercel.app/docs |
| Demo slides | [docs/pitch/Sirius_demo_deck.pptx](docs/pitch/Sirius_demo_deck.pptx) ([PDF](docs/pitch/Sirius_demo_deck.pdf)) |

All readings are simulated: real astronauts' daily vitals aren't public. The simulator in
`simulator/simulate.py` sends them to the backend, and the dashboard reads them from there.

## The challenge

> Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts carry much of the responsibility for spotting these changes in themselves. Your challenge is to build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health.

Event page: https://www.spaceappschallenge.org/2026/local-events/manama/?tab=details

## Our idea

**One hub for every wearable.** Astronauts may wear several devices at once: a
watch, a chest strap, a headband. Each one only sees part of the body. Our app
receives readings from all of them (through a web address each device type sends
its data to, called a webhook), turns them into one common format, and combines
them. Combining lets us cross-check readings and spot patterns no single device
can, then give the astronaut a few simple scores and clear advice on what to do.

**Software first.** For the hackathon every device is **simulated**, and the
"connect a device" screens are a mock-up where each step just clicks Next. Real
hardware is secondary. See the plan.

## Start here

| If you want to... | Read |
| --- | --- |
| Get the whole picture in one page (start here) | [docs/SUMMARY.md](docs/SUMMARY.md) |
| See the plan, tasks and who's doing what at a glance | The **Mission Board** website (see `dashboard/README.md`) |
| Know what we're building and who does what | [docs/PLAN.md](docs/PLAN.md) |
| Understand how devices send data to the hub | [docs/DEVICE_HUB.md](docs/DEVICE_HUB.md) |
| Pick a task | The Mission Board, or the repo's **Issues** tab |
| Learn how we use Git without breaking things | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Use Claude on this repo | [CLAUDE.md](CLAUDE.md) (Claude reads it automatically) |

## Team

| Person | Role |
| --- | --- |
| Abdulla | Lead / integrator, Frontend |
| nayem-m | Developer |
| _TBD_ | Developer |
| _TBD_ | Developer |
| _TBD_ | Developer |
| _TBD_ | Business / pitch |

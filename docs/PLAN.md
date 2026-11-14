# Project plan

Short on purpose. If something here is wrong, change it in a pull request.

## 1. Goal

**Software comes first.** The dashboard and its features are the product. A real
watch or wearable is secondary: we only work on it after the MVP below is done.
Until then, all health readings come from simulated data.

Build a demo that shows an astronaut:

1. **What their body is doing**: a dashboard of daily health readings.
2. **What it means**: a few simple scores (for example "Recovery" and "Strain").
3. **What to do**: a clear alert and suggested action when something drifts.

## 2. The smallest demo we must finish (MVP)

If we only finish this, we still have something to show the judges:

- [ ] Simulated data for one astronaut across a mission (e.g. 30 days).
- [ ] One dashboard screen showing today's readings and scores.
- [ ] A **Recovery score** worked out from sleep, resting heart rate and heart-rate variability.
- [ ] At least **one alert** (e.g. "recovery has dropped 3 days in a row, here's what to do").
- [ ] A pitch deck and a short demo video.

Nice-to-haves only **after** the MVP works: a daily mood/symptom check-in,
trends over the whole mission, radiation-dose tracking, exercise tracking for
bone and muscle loss, a view for the flight surgeon on Earth.

**Feature idea (not decided yet):** a personal AI "doctor" assistant for each
astronaut that explains their data, suggests actions, and escalates serious
cases to the flight surgeon on Earth. See [AI_DOCTOR.md](AI_DOCTOR.md).

**Last priority:** connecting a real watch or wearable (or a mock-up of one for the
pitch). Only start this once everything above works.

**Feature idea (not decided yet): crew overview.** One page that rolls every
astronaut's health into a single crew score, shows each person against each
health category in a grid, and points out **crew patterns**: the same problem in
several people at once (for example everyone sleeping badly after a schedule
change, or mood down across the crew). A shared pattern usually means a shared
cause, so the fix is different from helping one person. Mock: `app/crew.html`.

## 3. Roles

| Role | Person | Owns |
| --- | --- | --- |
| Lead / integrator | Abdulla | The plan, reviewing and merging pull requests, making the pieces connect |
| Frontend 1 | Abdulla | Dashboard screen and charts |
| Frontend 2 | FinnAliR | Alerts screen, check-in form, overall look |
| Backend / data | _TBD_ | Simulated data and how the app reads it |
| Health logic | _TBD_ | What we measure, how scores and alerts are worked out, NASA sources |
| Business / pitch | TaqiTellsTales | Slides, demo video, the story, the submission write-up |

Put your name in the table when you've agreed on your role.

## 4. Decisions to make in the first hour

1. **Tech stack.** What the app is built with. Pick whatever most of the four developers already know. Write the answer here.
2. **The data shape.** The exact fields one day of data has (e.g. `date`, `sleep_hours`, `resting_hr`, `hrv_ms`, ...). Frontend and backend agree on this early so both can build at the same time.
3. **Which scores and alerts are in the MVP.**

| Decision | Answer |
| --- | --- |
| Tech stack | _TBD_ |
| Data shape | _TBD_ (link to the file once written) |
| MVP scores & alerts | _TBD_ |

## 5. Timeline

Times are counted from when we start, so this works whatever the exact event hours are.

| When | What |
| --- | --- |
| Hour 0–1 | Agree on the MVP and the decisions above. Everyone picks a first task. |
| First half | Build the MVP pieces in parallel. Check in every few hours. |
| Middle | Connect the pieces: real dashboard showing simulated data and scores. |
| **Last few hours** | **Feature freeze.** No new features. Fix bugs, polish the demo, record the video. |
| Final hour | Rehearse the pitch. Submit early, not at the last minute. |

## 6. Check-ins

Every few hours, 5 minutes, everyone answers three questions:

1. What did I finish?
2. What am I doing next?
3. Am I stuck on anything?

## 7. Health check log

A core feature: astronauts log health checks and tests by category, see their
history, and get reminders when a test is due. Some readings come from devices
automatically; the rest are typed in by hand. Full details, decisions and
sources are in [HEALTH_LOG.md](HEALTH_LOG.md).

First version:

- [ ] A catalogue of tests for five categories: Heart, Sleep, Mind & mood, Radiation, Bone & muscle.
- [ ] Hand-entered results saved and shown in one history with device readings.
- [ ] A **Today** screen with what is due and overdue, and a **log entry** form.
- [ ] A **history & trends** chart per test.
- [ ] Reminders for hand-entered tests, plus a "device not synced in 24 hours" alert.

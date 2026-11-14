# Project plan

Short on purpose. If something here is wrong, change it in a pull request.

## 1. Goal

### Product vision

**One hub for every wearable.** Our app receives readings from whatever devices
an astronaut wears (watch, chest strap, headband, and more), converts them into
one common format, and combines them. Combining devices gives better analysis
than relying on one device for each piece of information: readings can be
cross-checked, the most accurate device is used for each measurement, and
patterns across devices can be spotted.

What this means in practice:

- **Backend:** one webhook (a web address a device sends its data to) for each
  device type, which converts that device's data into our common format.
- **Analysis:** rules that combine readings from different devices into scores
  and alerts.
- **Frontend:** a "Connect a device" walkthrough (a mock-up: every step just
  clicks Next) and a "My devices" page listing each astronaut's devices.
- **Demo:** simulated devices send data to real webhook addresses on a small
  server, so we need no real hardware but the data really flows through the hub.

Full proposal (data flow, which combinations of devices are well established and
which are speculative, the connect screens, the devices page):
[DEVICE_HUB.md](DEVICE_HUB.md).

**Software comes first.** The dashboard and its features are the product. A real
watch or wearable is secondary: we only work on it after the MVP below is done.
Until then, all health readings come from simulated data.

Build a demo that shows an astronaut:

1. **What their body is doing**: a dashboard of daily health readings.
2. **What it means**: a few simple scores (for example "Recovery" and "Strain").
3. **What to do**: a clear alert and suggested action when something drifts.

## 2. The smallest demo we must finish (MVP)

If we only finish this, we still have something to show the judges:

- [ ] Simulated feeds from at least **three devices** (e.g. watch, chest strap, headband) for one astronaut across a mission (e.g. 30 days), sent to the hub's webhooks.
- [ ] Each device's data converted into the **one common format**.
- [ ] One dashboard screen showing today's readings and scores, and which device each reading came from.
- [ ] A **Recovery score** that combines sleep, resting heart rate and heart-rate variability from more than one device.
- [ ] A mock **Connect a device** walkthrough and a **My devices** page.
- [ ] At least **one alert** (e.g. "recovery has dropped 3 days in a row, here's what to do").
- [ ] A pitch deck and a short demo video.

Nice-to-haves only **after** the MVP works: a daily mood/symptom check-in,
trends over the whole mission, radiation-dose tracking, exercise tracking for
bone and muscle loss, a view for the flight surgeon on Earth.

**Feature idea (not decided yet):** a personal AI "doctor" assistant for each
astronaut that explains their data, suggests actions, and escalates serious
cases to the flight surgeon on Earth. See [AI_DOCTOR.md](AI_DOCTOR.md).

**Last priority:** connecting a real watch or wearable. Only start this once
everything above works.

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
| Backend / data | nayem-m | Simulated data and how the app reads it |
| Health logic | _TBD_ | What we measure, how scores and alerts are worked out, NASA sources |
| Business / pitch | TaqiTellsTales | Slides, demo video, the story, the submission write-up |

Put your name in the table when you've agreed on your role.

## 4. Decisions to make in the first hour

1. **Tech stack.** What the app is built with, including how the hub receives data (the webhooks). Pick whatever most of the four developers already know.
2. **The common data format.** The fields every reading has once it reaches the hub, whatever device it came from (e.g. `astronaut_id`, `device_id`, `device_type`, `metric`, `value`, `unit`, `time`). Frontend and backend agree on this early so both can build at the same time.
3. **Which devices we simulate**, and what each one measures.
4. **Which combined scores and alerts are in the MVP**, and which device we trust most when two report the same thing.

| Decision | Answer |
| --- | --- |
| Tech stack | _TBD_ |
| Common data format | _TBD_ (link to the file once written) |
| Devices we simulate | Watch, chest strap, headband |
| MVP scores, alerts and device priority | _TBD_ |

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

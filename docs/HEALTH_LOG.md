# Health check log

A core feature: astronauts log their health checks and tests, see them grouped
by category with a history, and get reminders when a test is due.

It sits on top of the multi-device hub (see PLAN.md, section 1). Some readings
arrive **automatically from devices**; the rest are **typed in by hand**. Both
end up in the same history.

## Decisions (agreed with Abdulla, 2026-11-14)

1. **Demo data:** everything uses made-up sample data. Hand-entered tests are
   typed in; device readings come from the simulated devices.
2. **Device vs hand-entered split:** devices supply heart rate, sleep, activity
   and (simulated) radiation dose. Blood and urine tests, eye exams, hearing
   tests, mood and symptoms are entered by hand.
3. **Combined warnings:** yes. The app flags patterns that only show up when
   devices are combined (for example poor sleep from the headband plus a high
   resting heart rate from the watch). Healthy ranges come from the
   data-sources research.
4. **Reminders:** in the app, for the hand-entered tests, plus a
   "device not synced in 24 hours" alert so missing data is never silent.
5. **Scope of the first version:** one astronaut's own view (no crew-doctor
   view yet) and four categories: Heart, Sleep, Mind & mood, Radiation.
   Bone density and muscle were dropped on 14 Nov 2026: we will not track them.

## Categories for the first version

Frequencies marked **(ours)** are our own proposal: the NASA documents we read
list these activities but do not say how often they happen.

| Category | Test / reading | Source | How often |
| --- | --- | --- | --- |
| Heart | Resting heart rate, heart-rate variability | Device (watch / chest strap) | Continuous |
| Heart | Blood pressure | Automatic, from the smart shirt | Daily (ours) |
| Heart | ECG | Hand-entered | Monthly (ours) |
| Sleep | Hours slept, sleep quality | Device (headband / watch) | Every night |
| Sleep | "How rested do you feel?" (1-5) | Hand-entered | Daily (ours) |
| Mind & mood | Mood check (1-5) and symptoms | Hand-entered | Daily (ours) |
| Mind & mood | Cognitive test (like NASA's WinSCAT) | Hand-entered | Monthly (NASA) |
| Mind & mood | Private psychological conference | Reminder only | Every 2 weeks (worked out from NASA crew time) |
| Radiation | Personal dose | Device (simulated dosimeter) | Daily |
| Radiation | Dose before and after a spacewalk | Hand-entered | Each spacewalk (NASA does this) |

**Later categories** (not in the first version): Blood & immune (hematocrit,
urine test), Eyes (eye chart, grid test, eye scans: NASA schedules these on
flight day 30, flight day 90 and about 30 days before return), Hearing.

## Screens

- **Today:** what is due today, overdue items in red, and any device that has
  not synced in 24 hours. Click an item to log it.
- **Log entry:** pick the test, enter the result (a number with its unit, yes/no,
  or a 1-5 scale), add a note. The time is saved automatically. Results outside
  the healthy range are flagged.
- **Categories:** one card per category with a status colour, when it was last
  done and when it is next due.
- **History & trends:** a chart per test over the mission with the healthy range
  shaded, and a table of past entries. Device readings and hand-entered results
  appear together, each showing where it came from.
- **Reminders:** the schedule for every test, with snooze and an overdue list.

## Sources

- NASA, *Crew Time Analysis of Planned Medical Activities*:
  https://ntrs.nasa.gov/api/citations/20230015627/downloads/Med%20Crew%20Time%20Analysis.pdf
  (lists the in-flight medical activities; gives time per activity, not frequency)
- NASA, *SANS-related ISS Hardware & Data* (eye exam schedule):
  https://ntrs.nasa.gov/api/citations/20180004916/downloads/20180004916.pdf
- NASA-STD-3001 Vol. 1, section 6, Medical Operations:
  https://www.nasa.gov/reference/6-0-medical-operations/

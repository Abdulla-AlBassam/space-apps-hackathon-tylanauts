# AI doctor (feature idea)

**Status: idea only.** Nothing here is decided. How it is built (which AI model,
where it runs, how it is wired in) is left for later.

## The idea in one paragraph

Each astronaut gets their own AI "doctor" assistant. It reads that astronaut's
health data (wearable readings, health check logs, scores, warnings), explains
what it sees in plain language, and suggests what to do next. When something is
too serious for the assistant to handle, it does not try to decide. Instead it
passes the case to a real flight surgeon on Earth, with a short summary of the
data so the doctor can act quickly.

## What it does

- **Explains** the astronaut's own data: "Your resting heart rate has been
  higher than usual for 3 days, and your sleep has been shorter."
- **Suggests** simple, low-risk actions: rest, drink water, do the next
  scheduled exercise session, log a health check that is overdue.
- **Answers questions** about the astronaut's own readings and history.
- **Escalates** anything serious to the flight surgeon on Earth (see below).
- **Remembers context** for each astronaut, such as their normal ranges, so
  advice is based on what is normal for them, not for an average person.

## Escalation tiers

Mariam's rules (draft v0.2, issue #30) replaced the first draft here. There are five tiers,
from 0 (Nominal) to 4 (Emergency). The full table, with each threshold and where it comes
from, is in [`ESCALATION_RULES.md`](ESCALATION_RULES.md). The dashboard uses those rules in
`app/escalation.js`, so the alerts and the AI doctor always show the same tier.

| Tier | Name | What the assistant does | Who is told |
| --- | --- | --- | --- |
| 0 | Nominal | Logs it only | Nobody |
| 1 | Watch | Notes the trend and suggests self-care | The astronaut, in the app |
| 2 | Caution | Asks follow-up questions and rechecks in 30-60 min | The astronaut and the flight surgeon (daily summary, not urgent) |
| 3 | Urgent | Checks the sensor, walks through the protocol, asks for a live call (within 1 hour) | The astronaut and the flight surgeon (paged now) |
| 4 | Emergency | Opens the emergency checklist and alerts crew and ground at once | Crew, flight surgeon and mission control |

## Why it is useful: the delay to Earth

On the International Space Station, astronauts can talk to doctors on the
ground almost live. Further out, that stops being true:

- **Moon:** about 1.3 seconds each way, so conversations still work.
- **Mars:** roughly 3 to 22 minutes each way, depending on where the two
  planets are in their orbits. A question and answer can take up to about
  45 minutes. There are also periods of a couple of weeks, when the Sun is
  between Earth and Mars, where contact is cut off or very limited.

This is the gap the assistant fills. It can respond right away for everyday
questions and small issues, and it makes better use of the slow link to Earth
by sending the doctor a ready-made summary instead of a long back-and-forth.
This ties directly to the challenge: astronauts on long missions carry much of
the responsibility for spotting health changes themselves.

## Safety and "not a medical device"

- This is a **hackathon demo, not a medical device**. It does not diagnose
  illness or prescribe medicine, and we should say that clearly on screen and
  in the pitch.
- The assistant **only suggests**. The astronaut and the flight surgeon make
  the decisions.
- When in doubt, it **escalates**. It should never hide a worrying reading or
  talk someone out of contacting a doctor.
- It should show **which data** each suggestion is based on, so the astronaut
  can check it.
- Health data is private. Each astronaut's assistant only sees that
  astronaut's data, and the flight surgeon sees what is escalated.

## Demo approach (to decide later)

Some options, nothing chosen:

- **Scripted:** pre-written messages for a few simulated situations (one per
  tier). Safest and most predictable on stage.
- **Live AI:** a real AI model reads the simulated data and replies. More
  impressive, but answers can vary and it needs an internet connection and an
  API key.
- **Mixed:** scripted for the escalation moments, live for general questions.

A simple demo story: the astronaut's recovery has dropped for 3 days
(tier 2), then a reading crosses a serious threshold, the assistant writes a
summary and sends it to the flight surgeon (tier 3), and we show the doctor's
reply arriving later, with a note about the delay.

## Open questions

- Is this part of the MVP, or a nice-to-have after it?
- Scripted, live AI, or mixed for the demo?
- Where does the flight surgeon's side live: a separate screen, or the
  existing "view for the flight surgeon on Earth" nice-to-have in the plan?
- ~~Which exact readings and thresholds go in each tier?~~ Answered by Mariam's draft, see `ESCALATION_RULES.md`.

## Tasks

- #29 Decide if it is in the MVP and how we demo it (lead)
- #30 Draft the escalation rules (health logic)
- #31 Mock up the chat and escalation screen (frontend)
- #32 What data it reads and what the summary to Earth contains (backend)
- #33 Add it to the pitch story (pitch)

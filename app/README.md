# Crew health dashboard (first build)

The astronaut health dashboard, built with plain HTML, CSS and JavaScript.
No install or build step: open `index.html` in a browser, or run a tiny local server:

```
cd app
python3 -m http.server 8000
# then open http://localhost:8000
```

**No real astronaut data.** When a page opens, `data.js` reads the astronaut's readings from
the backend (https://tylanauts-api.vercel.app). Those readings come from our device simulator
(`simulator/simulate.py`). Anything the backend doesn't store yet (skin temperature, deep sleep,
exercise, the health log schedule, devices, the AI doctor, the crew page) stays made up and shows
a small **"Sample data"** tag. The tag disappears by itself once the backend has live data for it.

If the backend can't be reached within 6 seconds, the whole page uses made-up data and says so
in a line at the top. Handy address-bar options:

- `?sample`: skip the backend and use made-up data (for working offline).
- `?api=http://localhost:8001/api/v1`: read from a backend running on your own computer.

## The files

| File | What it does |
| --- | --- |
| `index.html` | The page layout: left rail, header, and five pages switched by the rail: Today (scores, body map, alerts card, vitals, this week, trend), Alerts, Calendar, Health log and Devices. |
| `sirius.css` | **The Sirius visual identity**, shared by every page: the four colours, the two fonts, the logo and the health dial. Change a brand colour here and it changes everywhere. |
| `sirius.js` | Draws the brand pieces: the logo (`SIRIUS.mark`), the health dial used as the score meter (`SIRIUS.dial`), the moving logo for loading (`SIRIUS.loading`) and the intro video. |
| `brand/` | Logo files (`sirius-mark.svg`, `favicon.svg`) and the designer's motion logo video (`sirius-motion.mp4`). |
| `styles.css` | The main dashboard's layout and components. Colours and fonts come from `sirius.css`. |
| `data.js` | Reads the astronaut's readings from the backend, fills any gaps with made-up readings (3 wearables and a radiation badge), then works out the scores and alerts. Pages wait for `window.HEALTH_READY` before drawing. |
| `escalation.js` | Mariam's escalation rules (`docs/ESCALATION_RULES.md`): gives each day a tier from 0 (Nominal) to 4 (Emergency). The alerts and the AI doctor both use it. |
| `app.js` | Draws everything from `data.js`, plus the `?` help pop-ups. |
| `body-map.html` | **Body map** page: a 3D body you can turn, with glowing points where a health area needs attention. The same body map is the centrepiece of the Today page; this is its full-screen version ("Full screen" link on the map). |
| `body-map.js` | Draws the 3D anatomy model with three.js and the list of body areas. Reads the same simulated data from `data.js`, so both pages tell the same story. |
| `body-map.css` | Styling for the body map page (same Sirius colours and fonts). |
| `crew.html` | **Crew overview** mock: one crew score, a grid of every astronaut against every health category, and "crew patterns" that link people who share the same drop. Linked from the left rail ("Crew"). |
| `crew.js` | Makes 14 days of simulated scores for a crew of six, finds the patterns, and draws the page. Self-contained: it doesn't use `data.js`. |
| `crew.css` | Styling for the crew page. It loads `sirius.css` for the brand but not `styles.css`, so restyling the main dashboard can't break it. |
| `models/body.glb` | The 3D anatomy model (from BodyParts3D, CC BY 4.0). See `models/README.md`. |

## The Sirius visual identity

The look follows the designer's guide: `docs/design/sirius-identity/Sirius_visual_identity.pdf`.

- **Name:** Sirius, with the tagline "health on board". The wordmark is SIRIUS in capitals, spaced out.
- **Four colours:** Ink `#0D0D10` (backgrounds), Bone `#F2EEE6` (text and marks), Slate `#5B6472`
  (quiet things) and Ember `#FF5A36`. Ember is the only colour that asks for attention, so it is
  kept for alerts and things that are off. Don't add other colours.
- **Two fonts:** IBM Plex Sans for words (headings medium, body regular) and IBM Plex Mono for
  numbers and for the small CAPS labels above each section.
- **Logo:** a four-point star inside a dial of ticks, with one ember tick. Drawn by `SIRIUS.mark(size)`.
- **Health dial:** the same 24 ticks used as the score meter on Recovery, Radiation, Mind and the
  crew score. Bone ticks are the score so far, slate ticks are what is left. At **Watch** the last
  filled tick is ember; at **Alert** all filled ticks are ember. Drawn by `SIRIUS.dial(...)`.
- **Status words:** Steady, Watch, Alert (always with an icon, never colour alone).
- **Motion:** the designer's motion logo video plays once as an intro when the dashboard opens
  (click to skip; add `?intro=0` to the address to turn it off). The same motion, drawn live,
  shows while the 3D body loads and while a new device is being tested. Motion is calm:
  colours fade, nothing bounces, spins or glows.
- **Still true:** we can't use the NASA logo.

## Calendar

The calendar brings together things that used to be in separate places: what is due today,
what is coming up, the alerts, and each day's readings. It is not new data, just one view of it.

- **This week (on Today):** seven days in a row (two back, today, four ahead). An orange dot means
  something needs attention that day; a light dot means a health check is planned. Click a day to
  see its list. This replaced the old "Due today" list.
- **Calendar page (left rail):** one month at a time. Past days show that day's recovery score.
  The buttons at the top show only alerts, checks, readings, or one health area. Click a day to
  see everything for it in the card on the right, and log a result from there.
- **In the code:** `eventsOn(date)` in `app.js` builds the list for one day from the alerts, the
  health check schedule (`tests` in `data.js`) and the daily readings. Both views use it.
  Daily checks are folded into one line on future days so they don't fill the month.

## How the pages are laid out

- **Few boxes on purpose.** Sections sit straight on the background with space between them
  (`.panel` in `styles.css` has no border or fill). Only things that should stand out get a
  soft box (`.card`): the selected score, the score overview, the alerts card and the device
  tiles. Please keep new sections unboxed unless they really need to stand out.
- **Statuses are an icon and a coloured word** (`.pill`), with no outline.
- **Today, top of the screen:** the three scores, then the body map with two cards beside it.
  The **Overview** card shows what the selected score is made of and which device each part
  comes from; clicking Recovery, Radiation or Mind swaps it straight away. The **Alerts** card
  shows how many alerts are open and how serious they are, and opens the Alerts page
  (`#alerts`). That page has three separate sections, each with its own look: **Alert** (large
  cards with an orange edge, act today), **Watch** (smaller cards side by side) and **For info** (a
  quiet list with nothing to do). The three counts at the top jump to their section.
- **Body map labels** are an icon, a name and a status joined to the body by a thin line.
  Clicking one opens its details underneath. There are no view buttons: the body turns by itself.
- **AI doctor** is the round button in the bottom right corner of every dashboard page. It
  opens a chat box. The answers are scripted: `answer()` in `app.js` looks for key words in
  the question and fills in today's simulated numbers. It is still only an idea preview.
- **Health log** is kept to three things: what to do, what's coming up, and the latest results.
- **Crew overview** answers three questions per shared pattern: who lines up, what the issue
  is, and a suggested fix. Under that is one plain table of everyone today.

## Things to know

- **Scores are placeholders.** The Recovery, Strain and Sleep formulas in `data.js` are rough
  stand-ins until the health-logic owner decides the real ones.
- **Swapping in real data later:** replace `generateReadings()` in `data.js` with a request to
  our backend. As long as readings keep the same fields, the rest keeps working.
- **Tech stack isn't decided yet** (see `docs/PLAN.md`). Plain HTML was used so anyone can
  open it; it can be moved into a framework later.
- **Logo:** the Sirius logo is in `brand/`. We can't use the NASA logo.

## Body map

- **The 3D body is a real anatomy model** (skeleton, heart, brain, eyes and a faint
  skin outline) drawn in an X-ray style. It comes from **BodyParts3D**, © The Database Center for
  Life Science, licensed under CC BY 4.0. We must keep the credit shown at the bottom of the page.
  Details and how to rebuild it: `models/README.md`.
- **three.js** (MIT licence) is loaded from the jsDelivr CDN, pinned to version 0.160.0, so the
  body map needs an internet connection. The model itself (`models/body.glb`, about 3.8 MB) ships
  with the app, so open the page through a local server (see the top of this file), not by
  double-clicking the HTML file.
- **Four body areas:** heart, mind/mood/sleep, eyes (SANS) and radiation dose. Bone density and
  muscle are not tracked (removed on 14 Nov 2026), so the skeleton is only the picture of the body
  and the thigh muscles in the model file are not drawn. The matching part of the model glows in that area's status colour. Each area has
  readings with normal ranges, a `?` explaining why it matters in space, and what to do. The list
  lives in `AREAS` at the top of `body-map.js`.
- **Moving it into the main dashboard later:** copy the three parts of `body-map.html`
  (`#bm-list`, `#bm-stage`, `#bm-detail`) and its import map into `index.html`, and load
  `body-map.js` as a module.

## Crew overview

- **The idea:** show where several crew members line up, because the same thing dropping for
  several people at once usually has a shared cause (the schedule, a stressful event) rather
  than being one person's health.
- **Crew patterns:** when 3 or more people drop in the same category over the same days
  (15 or more points under their own normal), the page shows one short row: who, the issue
  (with the shared event that happened around the same time) and one suggested fix. Clicking
  a row highlights those people in the table. The numbers are at the top of `crew.js`
  (`DROP`, `CREW_MIN`) and are placeholders. Patterns that have already recovered are not shown.
- **Astronaut / Flight surgeon switch:** the Astronaut view hides crewmates' names
  ("Crewmate B"). That's a suggestion for the team to decide, not a settled rule.
- **The simulated story:** lost family calls from day 135 (mood, 3 people), a sleep schedule
  change on day 139 (sleep, 4 people), and the commander's heart drift that the main
  dashboard also shows.

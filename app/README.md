# Crew health dashboard (first build)

The astronaut health dashboard, built with plain HTML, CSS and JavaScript.
No install or build step: open `index.html` in a browser, or run a tiny local server:

```
cd app
python3 -m http.server 8000
# then open http://localhost:8000
```

**All data is simulated.** Nothing here is a real astronaut's reading.

## The files

| File | What it does |
| --- | --- |
| `index.html` | The page layout: header, score cards, vitals, trend chart, alerts, check-in, devices. |
| `styles.css` | All the styling. Colours and fonts come only from the Space Apps brand guide (see `docs/design/DESIGN_BRIEF.md`). |
| `data.js` | Makes 30 days of simulated readings from 3 wearables and a radiation badge, in the common format from `docs/PLAN.md`, then works out the scores and alerts. |
| `app.js` | Draws everything from `data.js`, plus the moving star background and the `?` help pop-ups. |
| `body-map.html` | **Body map** page: a 3D body you can turn, with glowing points where a health area needs attention. Linked from the left rail ("Body"). |
| `body-map.js` | Draws the 3D anatomy model with three.js and the list of body areas. Reads the same simulated data from `data.js`, so both pages tell the same story. |
| `body-map.css` | Styling for the body map page (same brand colours and fonts). |
| `crew.html` | **Crew overview** mock: one crew score, a grid of every astronaut against every health category, and "crew patterns" that link people who share the same drop. Not linked from the main dashboard yet. |
| `crew.js` | Makes 14 days of simulated scores for a crew of six, finds the patterns, and draws the page. Self-contained: it doesn't use `data.js`. |
| `crew.css` | Styling for the crew page. Self-contained: it doesn't load `styles.css`, so restyling the main dashboard can't break it. |
| `models/body.glb` | The 3D anatomy model (from BodyParts3D, CC BY 4.0). See `models/README.md`. |

## Things to know

- **Scores are placeholders.** The Recovery, Strain and Sleep formulas in `data.js` are rough
  stand-ins until the health-logic owner decides the real ones.
- **Swapping in real data later:** replace `generateReadings()` in `data.js` with a request to
  our backend. As long as readings keep the same fields, the rest keeps working.
- **Tech stack isn't decided yet** (see `docs/PLAN.md`). Plain HTML was used so anyone can
  open it; it can be moved into a framework later.
- **No logo yet.** We can't use the NASA logo. The official Space Apps logo files need adding
  from https://spaceappschallenge.org/brand (they couldn't be downloaded from the build machine).

## Body map

- **The 3D body is a real anatomy model** (skeleton, heart, brain, eyes, thigh muscles and a faint
  skin outline) drawn in an X-ray style. It comes from **BodyParts3D**, © The Database Center for
  Life Science, licensed under CC BY 4.0. We must keep the credit shown at the bottom of the page.
  Details and how to rebuild it: `models/README.md`.
- **three.js** (MIT licence) is loaded from the jsDelivr CDN, pinned to version 0.160.0, so the
  body map needs an internet connection. The model itself (`models/body.glb`, about 3.8 MB) ships
  with the app, so open the page through a local server (see the top of this file), not by
  double-clicking the HTML file.
- **Six body areas:** heart, mind/mood/sleep, eyes (SANS), radiation dose, bones (spine and hips)
  and leg muscles. The matching part of the model glows in that area's status colour. Each area has
  readings with normal ranges, a `?` explaining why it matters in space, and what to do. The list
  lives in `AREAS` at the top of `body-map.js`.
- **Moving it into the main dashboard later:** copy the three parts of `body-map.html`
  (`#bm-list`, `#bm-stage`, `#bm-detail`) and its import map into `index.html`, and load
  `body-map.js` as a module.

## Crew overview

- **The idea:** a bird's-eye view of the whole crew. The crew score is the average of each
  person's overall score, but because an average can hide one person struggling, people are
  also counted by their *weakest* category, and the grid always shows everyone.
- **Crew patterns:** when 3 or more people drop in the same category over the same days
  (15 or more points under their own normal), the page calls it a crew pattern, joins those
  people with a dashed line in the grid, and lists shared events from the mission log that
  happened around the same time. One or two people dropping is listed separately as personal.
  The numbers are at the top of `crew.js` (`DROP`, `CREW_MIN`) and are placeholders.
- **Astronaut / Flight surgeon switch:** the Astronaut view hides crewmates' names
  ("Crewmate B"). That's a suggestion for the team to decide, not a settled rule.
- **The simulated story:** a solar event on day 134 (everyone, now recovered), lost family
  calls from day 135 (mood, 3 people), a sleep schedule change on day 139 (sleep, 4 people),
  a spacewalk on day 140 (radiation, 2 people) and the commander's heart drift that the main
  dashboard also shows.

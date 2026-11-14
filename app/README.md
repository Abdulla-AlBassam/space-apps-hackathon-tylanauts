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

## Things to know

- **Scores are placeholders.** The Recovery, Strain and Sleep formulas in `data.js` are rough
  stand-ins until the health-logic owner decides the real ones.
- **Swapping in real data later:** replace `generateReadings()` in `data.js` with a request to
  our backend. As long as readings keep the same fields, the rest keeps working.
- **Tech stack isn't decided yet** (see `docs/PLAN.md`). Plain HTML was used so anyone can
  open it; it can be moved into a framework later.
- **No logo yet.** We can't use the NASA logo. The official Space Apps logo files need adding
  from https://spaceappschallenge.org/brand (they couldn't be downloaded from the build machine).

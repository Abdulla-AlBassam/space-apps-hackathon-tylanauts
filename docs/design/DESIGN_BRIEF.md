# Design brief: astronaut health dashboard (desktop)

Researched 14 Nov 2026. This is a starting point for the frontend team, not a final spec.
Where something could not be checked, it says so. Sources are at the bottom.

---

## 1. The three things to know first

1. **We can't use the NASA logo.** NASA's own rules say the "meatball" (round insignia) and the
   "worm" (the red NASA lettering) may not be used by people who aren't NASA employees, or on
   projects that aren't NASA-sponsored, without explicit permission. The Space Apps brand guide
   also says "DON'T use NASA official branding". So "NASA branding" for us means the
   **Space Apps Challenge brand kit**: its logo, colours and fonts. That kit is free for
   participants to use.
2. **Copy the Whoop structure, not its look.** The successful health apps all do the same thing:
   a few big scores at the top, tap a score to see the trend, tap again for the raw numbers.
   We should do that on one wide desktop screen.
3. **Dark navy background, calm when normal, loud only when something is wrong.** A dark
   theme matches Whoop and mission-control screens, and the Space Apps "Deep Blue" works as
   that background.

---

## 2. Branding rules we must follow

### Logos

| Logo | Can we use it? | Why |
| --- | --- | --- |
| NASA meatball / worm | **No** | NASA brand guidelines: not to be used by non-NASA people or on non-NASA-sponsored work without permission. Also must not imply NASA endorses us. |
| NASA Data Insignia ("DATA AT WORK") | **Not this weekend** | Only for products that use public NASA data, and it needs prior approval from NASA's Office of Communications through a request form. Not realistic during the hackathon. |
| Space Apps Challenge logo | **Yes**, following its rules | Download from the Space Apps brand page. Use the horizontal "Default" version in most places, the "Small" version for the app icon/favicon. |

Space Apps logo don'ts (quoted from their brand guide): don't tilt, rotate or skew it; don't change
its colours; don't use NASA official branding; don't add strokes to the text; don't stretch it;
don't rearrange the parts; don't put it on busy background images.

**Wording.** NASA's advertising rules list phrases like "NASA approved" and "official NASA" as not
allowed, and "NASA-inspired" as acceptable. So in the app and pitch, say things like
"built for NASA Space Apps 2026" or "uses NASA data", never "official NASA app".

**Photos.** NASA images can generally be used for educational and informational purposes, with
credit to NASA. Avoid photos where a NASA logo or an identifiable astronaut is the focus of
promotional material.

### Colours (Space Apps brand guide)

| Name | Hex | How we'd use it |
| --- | --- | --- |
| Deep Blue | `#07173F` | Main app background |
| Electric Blue | `#0042A6` | Panels, selected states, gradient |
| Neon Blue | `#0960E1` | Buttons, links (not for text on Deep Blue: too low contrast) |
| Blue Yonder | `#2E96F5` | Chart lines, "normal" data, highlights |
| Neon Yellow | `#EAFE07` | **Caution** status. Accent only, never a background (brand rule) |
| Rocket Red | `#E43700` | **Alert** status (bars, icons, big numbers) |
| Martian Red | `#8E1100` | Dark red fill behind an alert banner |
| White | `#FFFFFF` | Main text |

Brand rules worth repeating: text only on Deep Blue, Electric Blue or White backgrounds; don't use
Rocket Red as a background; contrast of at least 4.5:1; never use colour alone to mean something,
always add a word or icon. The guide suggests a 60-30-10 split (60% main colour, 30% secondary,
10% accent).

**One gap: the palette has no green**, and health apps use green for "good". Our suggestion is to
add one green of our own, for example `#3DDC97` (this is our choice, not a brand colour).

Contrast checks we ran on Deep Blue `#07173F` (4.5 is the minimum for normal text):
white 17.5, Neon Yellow 15.5, our green 9.9, Blue Yonder 5.7, Rocket Red **4.0**, Neon Blue **3.1**.
So Rocket Red is fine for icons, bars and large numbers, but small red text needs a lighter red
(for example `#FF5A36`, which scores 5.6; again our choice).

### Fonts (Space Apps brand guide, all free on Google Fonts)

| Use | Font |
| --- | --- |
| Headings, big score numbers | **Fira Sans** Black / Bold |
| Body text, labels | **Overpass** Regular / SemiBold |
| Raw readings, timestamps, tables | **Fira Code** (the guide lists it for code; we suggest it for numbers because every digit is the same width, so columns line up) |

(For reference, NASA's own web design system uses Inter, Public Sans and DM Mono. We should
use the Space Apps fonts instead, since we are a Space Apps project.)

---

## 3. What we learned from existing products

**Whoop** (from a design agency's breakdown, not Whoop's own docs; Whoop's official brand PDF
blocked our fetch)
- Home screen is three tiles: Recovery, Strain, Sleep.
- Recovery is 0–100% coloured green / yellow / red. The breakdown says green is 67% and up,
  red is below 33%.
- Strain uses a 0–21 scale.
- Three levels of detail: tiles, then a 7-day trend with coloured zones, then deep graphs of
  HRV, resting heart rate, breathing rate, skin temperature.
- Almost entirely black UI; green, yellow and red are the only strong colours.

**Oura** (from Oura's own article)
- Readiness 0–100: 85+ "Optimal", 70–84 "Good", under 70 "Pay attention".
- Each score has a list of **contributors** (sleep, resting heart rate, HRV balance, body
  temperature, and so on), each written as a plain question like "How well did I sleep last night
  compared to normal?". A contributor that needs attention gets a red progress bar.
- The 2025 redesign puts "One Big Thing" for the day at the top of the Today tab.

**Apple Vitals** (from Apple's support page)
- Learns a **typical range** for each overnight metric and flags anything outside it.
- Sends a notification only when **two or more** metrics are out of range at once, and adds
  context about possible causes (illness, medication, altitude).
- Each metric explains what can push it up or down.

**NASA Open MCT** (NASA's open-source mission-control software)
- Combines live and historical data, plots, tables and timelines "in one place", so operators
  don't switch between apps.
- Layouts are made of panels the operator can arrange.
- NASA lists "electronic health monitoring" as one of its uses.

**Not checked:** Garmin (pages need JavaScript and wouldn't load), Ultrahuman and Eight Sleep
(not reached), clinical patient monitors and the medical alarm-colour standard (IEC 60601-1-8;
no free source found). Don't treat anything about those as researched.

---

## 4. Recommendations for our dashboard

### Layout (one 16:9 desktop screen, no scrolling for the main view)

```
+--------------------------------------------------------------------------------+
| [Space Apps logo]  Astronaut: A. Example   Mission day 142 / 900   Status: OK   |
+------+-------------------------------------------------------+-----------------+
| Nav  |  RECOVERY 78%      STRAIN 12.4     SLEEP 7h10 (86%)   |  ALERTS & ACTIONS|
|      |  [big ring]        [big ring]      [big ring]         |  ! HRV low 3 days|
| Home |  "Good"            "Moderate"      "Good"             |    -> do X       |
| Trend|-------------------------------------------------------|  ~ Radiation dose|
| Body |  Trend: last 14 days, with shaded "your normal" band   |    -> do Y       |
| Mind |  [line chart: recovery / HRV / resting HR]            |                 |
| Rad. |-------------------------------------------------------|  Daily check-in  |
|      |  Readings table (Fira Code): HR, HRV, SpO2, temp, ...  |  [mood] [sleep]  |
+------+-------------------------------------------------------+-----------------+
```

- **Top bar:** who, which mission day, one overall status word.
- **Row of 3 score cards** (our versions of Recovery / Strain / Sleep). Big number, ring
  around it, a word ("Good"), and one line explaining why.
- **Click a score** to see its contributors Oura-style, each as a plain question with a bar.
- **Trend chart with a shaded "your normal" band**, like Apple's typical range. Points outside
  the band get coloured. This is the single most useful idea for spotting slow changes like
  bone loss or immune drift.
- **Alerts panel on the right**, always visible. Every alert says what happened, how sure we are,
  and **what to do**. That last part is what the challenge asks for ("evaluate and act").

### Status system (use everywhere)

| State | Colour | Icon + word |
| --- | --- | --- |
| Normal | Blue Yonder or green | check, "Normal" |
| Caution | Neon Yellow | triangle, "Watch" |
| Alert | Rocket Red | exclamation, "Act now" |

Rules: always icon + word + colour together; keep the screen mostly calm blue, so a yellow or
red item stands out; copy Apple and only raise a full alert when more than one signal agrees,
so astronauts don't learn to ignore it.

### Visual style
- Background Deep Blue, cards one shade lighter, a gentle Electric Blue to Deep Blue gradient
  (45°, as the brand guide suggests) only in the header.
- Line icons from Phosphor or Feather (the Space Apps guide recommends these).
- Big numbers in Fira Sans Black; everything else small and quiet.

### Score bands (for the health-logic owner to decide)
Whoop uses roughly 67 / 33 as cut-offs, Oura uses 85 / 70. We suggest starting with three
bands and tuning later; this is a `docs/PLAN.md` decision, not a design one.

---

## 5. Open questions for the team
1. What are our three headline scores? (Recovery, Strain, Sleep like Whoop, or something
   space-specific like Recovery, Radiation, Mind?)
2. Is the screen for the astronaut only, or also the flight surgeon on Earth? (That changes how
   much raw data we show.)
3. Do we want the green, or keep strictly to brand colours and use Blue Yonder for "normal"?

---

## Sources
- NASA brand guidelines: https://www.nasa.gov/nasa-brand-center/brand-guidelines
- NASA logo use: https://www.nasa.gov/nasa-brand-center/nasa-logo-use/
- NASA advertising guidelines: https://www.nasa.gov/nasa-brand-center/advertising-guidelines/
- NASA images and media: https://www.nasa.gov/nasa-brand-center/images-and-media/
- NASA Data Insignia: https://www.nasa.gov/nasa-data-insignia/
- Space Apps brand page: https://spaceappschallenge.org/brand
- Space Apps brand guide PDF (updated 25 Jun 2026): https://assets.spaceappschallenge.org/media/documents/Space_Apps_Brand_Guide_VUGpVJm.pdf
- Space Apps participant terms: https://www.spaceappschallenge.org/legal/
- Whoop design breakdown (third party): https://www.925studios.co/blog/whoop-design-breakdown
- Oura readiness score: https://ouraring.com/blog/readiness-score/
- Oura app redesign (9to5Google): https://9to5google.com/2025/10/20/oura-app-redesign/
- Apple Vitals: https://support.apple.com/guide/watch/vitals-apd15aa7ed96/watchos
- NASA Open MCT: https://nasa.github.io/openmct/about-open-mct/

The colour names and hex codes were checked against page 7 ("Colors") of the brand PDF, and the
"DON'T use NASA official branding" rule against page 6 ("Logo Don'ts").

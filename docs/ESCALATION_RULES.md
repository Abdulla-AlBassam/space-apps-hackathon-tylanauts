# Escalation rules: which readings go in which tier

Written by **Mariam** (draft v0.2, issue #30). This is her table from
`siryius_tier_thresholds.xlsx`, copied into the repo so the whole team can read it.
The dashboard uses it in `app/escalation.js`.

Prototype with simulated data. **Not a medical device.**

Every rule is labelled with where its number comes from:

- **Published:** taken from a guideline or NASA document.
- **Adapted:** a published number mapped onto our tiers.
- **Design:** our own choice, which a flight surgeon should review.

The vital-sign bands come from **NEWS2**, the UK Royal College of Physicians' early warning
score. It is built for hospital patients, not astronauts, and its own guidance says trigger
thresholds are a local decision. Mariam read the bands through secondary copies of the chart,
so they still need checking against the RCP original.

## The five tiers

| Tier | Name | What the AI doctor does | Who is told |
| --- | --- | --- | --- |
| 0 | Nominal | Logs it only | Nobody |
| 1 | Watch | Notes the trend and suggests self-care | The astronaut, in the app |
| 2 | Caution | Asks follow-up questions; rechecks in 30-60 min | The astronaut and the flight surgeon (non-urgent, daily summary) |
| 3 | Urgent | Checks the sensor, walks through the protocol, asks for a live consult (NEWS2: review within 1 h) | The astronaut and the flight surgeon (paged now) |
| 4 | Emergency | Emergency checklist; alerts crew and ground immediately | Crew, flight surgeon and mission control |

## Triggers and thresholds

| Tier | Trigger | Threshold | Label | Source |
| --- | --- | --- | --- | --- |
| 0 | Breathing rate, pulse | 12-20 breaths/min; 51-90 bpm | Published | NEWS2 (RCP) |
| 0 | SpO2, temperature | 96% or above; 36.1-38.0 °C | Published | NEWS2 (RCP) |
| 0 | Systolic BP | 111-219 mmHg | Published | NEWS2 (RCP) |
| 0 | Own baseline | Within personal range | Design | Team design |
| 1 | One NEWS2 reading scoring 1 | Breathing rate 9-11; SpO2 94-95%; systolic BP 101-110; pulse 41-50 or 91-110; temp 35.1-36.0 or 38.1-39.0 °C | Published | NEWS2 (RCP) chart |
| 1 | Blood pressure | Repeated resting readings of 130-139 systolic (AHA stage 1) | Adapted | AHA blood pressure categories |
| 1 | NEWS2 total | 1-2 | Design | Mapping onto our tiers |
| 1 | Resting heart rate | 10-15 bpm above personal baseline | Design | Team design |
| 1 | Sleep | About 1 h or more below own 14-night average | Design | Team design; Barger et al. 2014 |
| 1 | Recovery score | Below 50 for one day | Design | Team design |
| 1 | Cabin CO2 | 2.3-3.0 mmHg with a new symptom such as headache or fatigue | Adapted | NASA NTRS 20150019624 |
| 2 | One NEWS2 reading scoring 2 | Breathing rate 21-24; SpO2 92-93%; systolic BP 91-100; pulse 111-130; temp 39.1 °C or above | Published | NEWS2 (RCP) chart |
| 2 | Blood pressure | Confirmed resting readings of 140/90 or above (AHA stage 2) | Adapted | AHA blood pressure categories |
| 2 | NEWS2 total | 3-4 | Design | Mapping onto our tiers |
| 2 | Stacking | Two or more Tier 1 flags at once, or a new mild symptom | Design | Team design |
| 2 | Trends | Recovery below 50 for 3 days, or a drop of 25+ points in 24 h; sleep trending down over several nights | Design | Team design |
| 2 | Cabin CO2 | 1-hour average above 3 mmHg | Adapted | NASA-STD-3001 (OCHMO-TB-004) |
| 3 | One NEWS2 reading scoring 3 | Breathing rate 8 or below, or 25 or above; SpO2 91% or below; systolic BP 90 or below; pulse 40 or below, or 131 or above; temp 35.0 °C or below; new confusion | Published | NEWS2 (RCP) chart |
| 3 | NEWS2 total | 5-6 (or any single reading at 3): urgent review within 1 hour | Published | NEWS2 summary (secondary) |
| 3 | Severe high blood pressure, no symptoms | Above 180 systolic or above 120 diastolic | Published | AHA |
| 3 | Stacking | Any Tier 2 reading plus a symptom | Design | Team design |
| 3 | Cabin CO2 | Above 5.3 mmHg (180-day maximum allowable concentration) | Adapted | NASA NTRS 20100036637 |
| 4 | NEWS2 total | 7 or above: critical care activation | Published | NEWS2 summary (secondary) |
| 4 | Hypertensive emergency | Above 180/120 plus chest pain, shortness of breath, back pain, numbness, weakness, vision change or difficulty speaking | Published | AHA |
| 4 | Symptom overrides | Chest pain, severe breathing difficulty, fainting, signs of stroke, sudden severe headache or vision change | Design | Team design (partly from the AHA list) |
| 4 | New confusion | NEWS2 scores it 3; raised to Tier 4 because a spacecraft can't evacuate quickly | Design | Team design |

Exercise is **not** a trigger: ISS crews exercise about two hours a day, so it is used as
context for the heart-rate rules and still feeds the Recovery score.

## What the dashboard checks today

`app/escalation.js` runs these rules on each astronaut's latest day:

| Rule | Checked? | Why not, if not |
| --- | --- | --- |
| NEWS2 breathing rate, SpO2, pulse | Yes | |
| NEWS2 systolic BP and the BP categories | Yes, on the latest typed-in reading | The health log isn't stored by the backend yet, so the reading is sample data |
| NEWS2 temperature, consciousness, oxygen therapy | No | No data for these yet. The NEWS2 total is worked out from the readings we have |
| Resting heart rate, sleep, Recovery (own baseline) | Yes | Above 15 bpm over baseline has no separate rule in the draft, so it stays Tier 1 |
| Sleep trending down | Yes | "Several nights" is read as three nights in a row, each shorter than the last, ending below the 14-night average (our reading of the rule) |
| Stacking (two or more Tier 1 at once) | Yes | Shown as one combined alert |
| Symptoms | Only in the AI doctor chat | Typing a symptom like "headache" gives Tier 2; "chest pain", "can't breathe", "fainted", "confusion" and similar give Tier 4 |
| Cabin CO2 | No | No CO2 sensor data yet |
| "Tier 2 reading plus a symptom" | No | Symptoms aren't stored yet |

## Gaps (from Mariam's sheet)

- **No published source** for the Recovery score, the personal-baseline rules and the stacking
  rules. They are labelled Design.
- **Population mismatch:** NEWS2 is for hospital patients. No astronaut-specific vital-sign
  limits were found in the sources checked; ask a flight surgeon or check NASA medical standards.
- **Secondary sources:** check the NEWS2 bands against the RCP original.
- **Validation:** nothing here has been tested against real data.

## Sources

| Source | Link | Used for |
| --- | --- | --- |
| NEWS2, Royal College of Physicians | https://www.rcp.ac.uk/resources/national-early-warning-score-news-2/ | Vital-sign scoring bands |
| NEWS2 scoring chart (NWAS copy) | https://www.nwas.nhs.uk/publications/news2-national-early-warning-score | Chart bands |
| NEWS2 escalation guide (iatroX) | https://www.iatrox.com/blog/news2-scoring-escalation-guide | SpO2 and temperature bands (secondary) |
| NEWS2 calculator summary (Evigrade) | https://www.evigrade.com/en/calculators/news2 | Aggregate score actions (secondary) |
| NEWS2 implementation guide (CASRAI) | https://casrai.org/guides/early-warning-score-implementation | Thresholds are a local decision |
| AHA: Understanding blood pressure readings | https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings | BP categories and emergency symptoms |
| Crew sleep study (Barger et al. 2014) | https://www.news-medical.net/news/20140810/Space-missions-affect-sleep-patterns-in-astronauts.aspx | 8.5 h scheduled vs about 6 h actual |
| NASA ISS exercise | https://www.nasa.gov/?p=980652 | Two hours a day, seven days a week |
| NASA OCHMO-TB-004: Carbon Dioxide | https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/ | NASA-STD-3001 limit of 3 mmHg |
| NASA NTRS 20150019624 | https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20150019624.pdf | CO2 symptoms from 2.3 mmHg |
| NASA NTRS 20100036637 | https://ntrs.nasa.gov/citations/20100036637 | CO2 maximum 5.3 mmHg |

# Monitoring schedule

How often each health reading happens, and who does it: a wearable automatically, the
astronaut themselves, or a fellow crew member. Built from the tools in
[HEALTH_MONITORING_SYSTEMS.md](HEALTH_MONITORING_SYSTEMS.md) and the starter list in
[HEALTH_LOG.md](HEALTH_LOG.md), checked against NASA sources on 14 Nov 2026.

## How this follows NASA's guidelines

NASA's health standard, **NASA-STD-3001**, says *what* must be monitored but not *how
often*. Each program writes the schedule in its own Medical Operations Requirements
Document, which isn't public, and flight surgeons adjust it per crew member
([V1 6008, V1 6009](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf)).
So this schedule uses published NASA mission schedules where we found them, and our
own proposals elsewhere, each labelled.

| NASA requirement | What it requires | How this schedule meets it |
| --- | --- | --- |
| [V1 3003](https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf) In-mission preventive health care | Resources to monitor physical and psychological well-being during the mission | Sections 1–4: continuous wearables, daily check-ins, periodic tests |
| [V1 3004](https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf) In-mission medical care | Ability to diagnose and treat medical conditions in flight | Section 3: crewmate exams and tests with on-board equipment |
| [V2 7045](https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf) Medical equipment usability | Equipment usable by non-physician crew | Every manual test is one an astronaut or crewmate can run |
| [V1 4020](https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf) In-mission nutrient intake | 100% of each crew member's nutrient and energy needs, calculated from body mass | Daily food log and weekly body mass |
| [V2 6004](https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf) Habitat carbon dioxide | 1-hour average CO₂ no higher than 3 mmHg | Continuous CO₂ reading, alert above 3 mmHg |
| [V2 6022](https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf) Atmospheric alerting | Alert the crew when air readings leave safe limits | App alerts on CO₂ |
| [V1 4030](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) Career radiation limit | Career effective dose below 600 mSv | Daily and mission dose totals shown against 600 mSv |
| [V2 6161, V2 6162](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) Radiation monitoring | Monitor radiation in the habitat and for each crew member | Station monitors plus a personal dosimeter |
| [Medical operations, section 6](https://www.nasa.gov/reference/6-0-medical-operations/) | Private medical and psychological conferences "on a routine basis" | Section 4: weekly and every-2-weeks conferences |

**Basis** says how sure we are of each frequency:

- **NASA**: a NASA document states this schedule.
- **Derived**: worked out from NASA's total crew time for a 6-month mission (see notes).
- **Ours**: our own proposal for the app. NASA does the activity but we found no stated frequency.

Mission days are written as FD30 (flight day 30) and R-30 (30 days before return).

## 1. Automatic: reported by wearables

No action needed from the astronaut beyond wearing and charging the device. The app
raises a "device not synced in 24 hours" alert if data stops arriving.

| Reading | Category | Device | How often it reports | Basis |
| --- | --- | --- | --- | --- |
| Heart rate | Heart | Chest strap (preferred) or watch | Continuous; app stores 1-minute averages | Ours |
| Heart rate variability (HRV) | Heart | Chest strap or watch | Nightly, during sleep | Ours |
| Resting heart rate | Heart | Watch | Once each morning, from the night's data | Ours |
| ECG trace | Heart | Smart shirt ([Bio-Monitor](https://asc-csa.gc.ca/eng/sciences/astroskin.asp)) or chest strap | Continuous while worn | Ours |
| Breathing rate | Heart | Smart shirt | Continuous while worn | Ours |
| Blood oxygen (SpO₂) | Heart | Smart shirt or watch | During sleep, plus spot checks | Ours |
| Skin temperature | Immune / illness | Watch or smart shirt | Continuous; nightly average used for illness warnings | Ours |
| Sleep duration and stages | Sleep | Headband or watch ([Actiwatch](https://ntrs.nasa.gov/api/citations/20090014820/downloads/20090014820.pdf)-style) | Every night | NASA wears actigraphy for the whole mission ([source](https://ntrs.nasa.gov/api/citations/20200001281/downloads/20200001281.pdf)) |
| Activity and light exposure | Sleep | Watch | Continuous | NASA, same source |
| Exercise sessions (type, minutes, load) | Bone & muscle | Watch, plus the exercise machines' own logs | Every session; about 600 min a week in total ([study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566)) | NASA |
| Radiation dose | Radiation | Personal active dosimeter | Continuous; app shows daily and mission totals against the 600 mSv career limit | NASA ([Crew Active Dosimeters](https://ntrs.nasa.gov/api/citations/20250002757/downloads/Slides_Seminar_2025.pdf); V2 6162, V1 4030) |
| Cabin CO₂ | Environment | Station / personal CO₂ monitor | Continuous; alert if the 1-hour average passes 3 mmHg | NASA (limit from V2 6004; individual CO₂ monitoring is a planned ISS activity) |

## 2. Manual: the astronaut does it themselves

| Check | Category | How | How often | Basis |
| --- | --- | --- | --- | --- |
| Mood (1–5) and symptoms | Mind & mood | App check-in | Daily | Ours |
| "How rested do you feel?" (1–5) | Sleep | App check-in | Daily, on waking | Ours |
| Blood pressure | Heart | Sent by the smart shirt (see DEVICE_HUB.md), or an automatic cuff typed in | Daily | Ours |
| Food and water intake | Bone & muscle | App log (NASA uses an app called EveryWear) | Daily | Ours (NASA does this; no frequency found) |
| Body mass | Bone & muscle | Mass-measuring device (SLAMMD), typed in | Weekly | Ours |
| Vision test (near/far acuity, Amsler grid) and questionnaire | Eyes | Eye chart and grid, results typed in | FD30, FD90, R-30 | NASA ([SANS schedule](https://ntrs.nasa.gov/api/citations/20180004916/downloads/20180004916.pdf)) |
| Cognitive test (WinSCAT / Cognition) | Mind & mood | 10–16 minute test on a laptop or tablet | Monthly, compared with the astronaut's own pre-flight baseline | NASA: WinSCAT is a medical requirement for long-duration crew, [taken monthly](https://ntrs.nasa.gov/citations/20100036584) |
| Hearing test | Hearing | Self-run test on a laptop with headphones (NASA's On-Orbit Hearing Assessment) | Monthly, for missions longer than 30 days | Partly NASA: [routine for crew on orbit over 30 days](https://ntrs.nasa.gov/citations/20240009887); monthly is ours |
| Radiation dose before and after a spacewalk | Radiation | Read the dosimeter, typed in | Every spacewalk | NASA |

## 3. Manual: a fellow crew member does it

These need a second person: the crew medical officer (CMO) or another trained crewmate
operates the equipment or draws the sample.

| Test | Category | How | How often | Basis |
| --- | --- | --- | --- | --- |
| Eye scan (OCT) | Eyes | Crewmate operates the OCT2 scanner | FD30, FD90, R-30 | NASA ([SANS schedule](https://ntrs.nasa.gov/api/citations/20180004916/downloads/20180004916.pdf)) |
| Eye ultrasound | Eyes | Crewmate scans, guided live from the ground | FD30, FD90, R-30 | NASA, same source |
| Eye pressure (tonometry) | Eyes | Crewmate uses a tonometer | FD30, FD90, R-30 (ESA crew only) | NASA, same source |
| Blood draw (hematocrit, blood panel) | Blood & immune | Crewmate draws blood; sample tested on board or frozen for Earth | FD30 and R-30 | NASA research schedule ([source](https://ntrs.nasa.gov/api/citations/20200001281/downloads/20200001281.pdf)) |
| Saliva and microbiome samples | Blood & immune | Self-collected, processed with a crewmate | FD30 and R-30 | NASA, same source |
| Urine test | Blood & immune | Test strips or collection, logged by a crewmate | Monthly | Ours (NASA does urinalysis; no frequency found) |
| Maximum fitness test on the bike (Max CEVIS) | Bone & muscle | Crewmate monitors heart rate and stops the test if needed | On arrival, about every 90 days, and before departure | NASA ([status report](https://spaceref.com/?p=23118)) |
| Periodic health status exam | All | CMO checks vital signs, heart, lungs, ears, eyes and skin | Monthly | Ours (NASA plans these; no frequency found) |
| Health check before and after a spacewalk | All | CMO exam | Every spacewalk | NASA |

## 4. With the team on the ground

Not entered in the app, but the app shows them as reminders.

| Session | Who | How often | Basis |
| --- | --- | --- | --- |
| Private medical conference | Astronaut and flight surgeon | Weekly | Derived: 390 minutes per 6-month mission, about 15 minutes a week |
| Private psychological conference | Astronaut and behavioural health team | Every 2 weeks | Derived: 195 minutes per 6-month mission, half the medical conference time |
| Private exercise conference | Astronaut and exercise trainers | Weekly to every 2 weeks | Derived from planned crew time (frequency not stated) |

## Notes

- **HEALTH_LOG.md is updated to match:** the cognitive test is marked as NASA's schedule
  rather than ours. (The team dropped bone and muscle tracking on 14 Nov 2026, so the
  health log no longer has a fitness test.)
- **Annual checks on Earth:** NASA also re-certifies every astronaut medically once a
  year ([V1 3001](https://www.nasa.gov/wp-content/uploads/2024/02/ochmo-mtb-001-sans.pdf)).
  That happens on the ground, so it isn't in this in-flight schedule.
- **Derived conference frequencies** come from NASA's estimate of total crew time for a
  6-month mission ([Crew Time Analysis of Planned Medical Activities](https://ntrs.nasa.gov/api/citations/20230015627/downloads/Med%20Crew%20Time%20Analysis.pdf)).
  They assume a session of about 15 minutes; NASA-STD-3001 only says conferences are
  [held "on a routine basis"](https://www.nasa.gov/reference/6-0-medical-operations/).
- **Wearable rates marked "Ours"** are settings we choose for the app, not NASA
  requirements. Real devices record far more often; the app stores summaries.
- All data in the demo is simulated.

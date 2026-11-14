# Space Apps Health Challenge: Data Resources Report

_As of 14 Nov 2026._

## Summary

The challenge gives us five reading resources and no datasets. Three are NASA Human Research Program pages on the hazards, risks and current research of spaceflight. Two are Canadian Space Agency articles on radiation monitoring and why science is done in space.

They are most useful for the pitch and for realistic simulated data. Our strongest takeaways are NASA's five-hazard framing, specific figures like 1–1.5% bone loss a month and 70% of crew with eye swelling, and Artemis II's use of wrist actigraphy, which backs our wearable hub. Real data still has to come from the sources already in our repo.

## Resources at a glance

The challenge lists five resources: three from NASA's Human Research Program (HRP) and two from the Canadian Space Agency (CSA). All five are web articles. None is a downloadable dataset.

| Resource | Provider | Type | Downloadable data? |
| --- | --- | --- | --- |
| [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | NASA HRP | Overview article, with one page per hazard | No |
| [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/) | NASA HRP | List of 17 health risks, each with a reference page | No |
| [Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/) | NASA HRP | Short descriptions of 13 current studies | No |
| [Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) | CSA | News article (Feb 2026) | No |
| [Why Do We Conduct Science Experiments in Space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) | CSA | Explainer article | No |

## What is in each resource

### 5 Hazards of Human Spaceflight (NASA)

NASA groups everything that threatens astronaut health into five hazards: **Radiation, Isolation and confinement, Distance from Earth, Gravity fields, and Hostile/closed environments** (often shortened to RIDGE). Each hazard has its own page. The pages are short and give few numbers:

- **Distance:** Mars is about 140 million miles away on average; a Mars mission takes about three years, against three days to the Moon.
- **Gravity:** on Mars, crews would live in about three-eighths of Earth's gravity for up to two years.
- **Radiation:** "one of the most hazardous aspects of spaceflight"; NASA monitors it continuously, but the page gives no doses.

### Risks of Human Spaceflight (NASA)

The 17 specific health risks NASA's research program works on, each with a short reference page:

| Group | Risks |
| --- | --- |
| Physiology (11) | Immune changes, balance and motion sickness, heart and blood vessels, decompression sickness, microbiome, low oxygen, food and nutrition, spacewalk injuries, loss of fitness (heart, muscle, bone), eye and brain changes (SANS), bone weakening |
| Behaviour and human factors (5) | Behavioural and psychiatric conditions, teamwork, sleep and irregular schedules, operations support, landing injuries |
| Radiation (1) | Radiation-induced cancer |

Useful numbers from the risk pages:

- **Bone:** [1–1.5% of bone density lost per month](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/) on 4–6 month missions; tracked with scans before and after flight.
- **Eyes:** [about 70% of ISS astronauts](https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/) get some swelling at the back of the eye.
- **Sleep:** [about 16 sunrises and sunsets a day](https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/) on the ISS disrupt the body clock.
- **Immune:** [cold sores, rashes, allergies and infections](https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/) reported; tracked through blood, saliva and urine samples.
- **Heart:** [low blood pressure and fainting at landing](https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/), worse on longer missions; tracked with ultrasound.
- **Mental health:** [anxiety and depression](https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/), affecting sleep, morale and decisions.

### Ongoing HRP Research in Space (NASA)

Short summaries of 13 current studies, last updated August 2026:

- **Artemis II:** ARCHeR (a wrist actigraphy watch tracking sleep, activity and light), Immune Biomarkers (blood and saliva), and Artemis II Standard Measures (a shared health data bank).
- **ISS:** Standard Measures, CIPHER (many body systems at once), Zero T2 (exercise without a treadmill), B-Complex, Brain Fluid Pressure, Spinal Fluid Biomarkers, Thigh Cuff (eye-related studies), Venous Haemostasis (blood clotting), manual piloting, and re-entry comfort.

### Monitoring Radiation for Astronaut Health (CSA)

A February 2026 news article. The CSA awarded $5.5 million to develop **CANS** (Canadian Active Neutron Spectrometer), a compact instrument that measures neutron radiation continuously and on its own. **Neutrons make up about 30% of the radiation on the ISS** and cause serious biological damage. Earlier Canadian detectors on the ISS include MOSFET, EVARM, Radi-N and Radi-N2 (bubble detectors).

### Why Do We Conduct Science Experiments in Space? (CSA)

A general explainer. It lists what gets harder on Moon and Mars missions (more weightlessness, more radiation, longer isolation, communication delays, less help from Earth) and notes that about **200 experiments** run on the ISS at any time. It has no data or monitoring detail.

## What we can apply

The resources are most useful for framing the pitch around NASA's own words, setting realistic numbers in our simulated data, and checking our categories cover NASA's risks.

| Our feature | What to take from the resources | Resource |
| --- | --- | --- |
| Pitch story | Frame the problem with NASA's five hazards. Distance from Earth is the core of our pitch: a three-year Mars mission with communication delays means the crew must monitor and act on their own health | 5 Hazards |
| Health log categories | Tag each category with the NASA risk it addresses, so judges see we cover NASA's list (Heart, Sleep, Mind & mood, Radiation, Bone & muscle, Eyes) | Risks |
| Simulated 30-day data (#3) | Drive the storyline with NASA figures: bone density down about 1–1.5% a month; about 70% chance of eye swelling; disrupted sleep from 16 sunrises a day | Risks |
| Radiation card | Show neutrons as about 30% of ISS dose; name CANS as the kind of continuous monitor our hub would read from | CSA radiation |
| Device hub and sleep score | Point to Artemis II's ARCHeR wrist actigraphy as proof NASA already relies on wearables for sleep and activity | Ongoing research |
| Alerts (#6) | Write alerts around NASA's named effects: fainting risk after low blood pressure, cold sores and rashes as signs of immune change, run of low mood plus poor sleep | Risks |
| Exercise tracking | Reference the Zero T2 study (exercise without a treadmill), which matters for small deep-space vehicles | Ongoing research |
| AI doctor | The CSA explainer names communication delays and "less ability to rely on Earth for emergency medical assistance" as the reason crews need self-reliant tools | CSA explainer |
| Shared data bank idea | Artemis II Standard Measures stores consistent health data for research: a model for exporting our hub data to the flight surgeon | Ongoing research |

## Gaps and recommendations

The resources give no raw data. Real astronaut vitals are private, so the team's plan to simulate readings stays the right one.

- **For real numbers, use our own sources.** [DATA_SOURCES.md](DATA_SOURCES.md) already lists downloadable NASA data (OSDR studies, ISS radiation), and [HEALTH_MONITORING_SYSTEMS.md](HEALTH_MONITORING_SYSTEMS.md) covers the equipment.
- **Risks we don't cover yet:** immune changes, balance and motion sickness, nutrition, teamwork. The cheapest to add is immune: an "early illness" warning from skin temperature plus resting heart rate (already in [DEVICE_HUB.md](DEVICE_HUB.md) as an idea).
- **Eyes are in our schedule but not the MVP.** With 70% of ISS crew affected, a simple eye-check reminder (FD30, FD90, R-30) is worth showing in the demo.
- **Few numbers on the hazard pages.** Quote the risk pages for figures, not the hazard pages, and link each figure in the pitch.
- **Name-check the challenge resources in the submission.** Judges will know these five pages; citing them shows we used what we were given.

## Sources

All opened on 14 Nov 2026.

- [Space Apps 2026: Health Monitoring Software, Resources tab](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources)
- [NASA HRP: 5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) and [Space Radiation hazard](https://www.nasa.gov/hrp/hazard-space-radiation/)
- [NASA HRP: Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/)
- [NASA HRP: Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- [CSA: Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- [CSA: Why Do We Conduct Science Experiments in Space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp)
- NASA risk pages: [bone](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/), [SANS](https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/), [sleep](https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/), [immune](https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/), [cardiovascular](https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/), [behavioural health](https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/)

# Spacefarer Health Monitoring: Hardware, Software & Data Systems

_As of 14 Nov 2026._

## Summary

There is no single public database of astronaut health data. Clinical records stay private with NASA's Lifetime Surveillance of Astronaut Health (LSAH). Research data is split between NASA's Life Sciences Data Archive (LSDA) and the Open Science Data Repository (OSDR). Both release human data only through a controlled request process.

This document covers the ISS, the main platform in use today. Each section lists the systems that monitor crew health, grouped by what they measure. Equipment details come from public NASA, CSA and ESA material. Names and flight status can change, so check current status before relying on any single item.

## Data repositories

Astronaut health data sits in four main places. Anything that identifies a person requires approval before release.

| Repository | Run by | What it holds | Access |
| --- | --- | --- | --- |
| [Lifetime Surveillance of Astronaut Health (LSAH)](https://nlsp.nasa.gov/explore/lsdahome/datarequest) | NASA Johnson Space Center | Clinical and medical-test records for each astronaut, kept for life | Restricted; requests reviewed case by case |
| [Life Sciences Data Archive (LSDA)](https://nlsp.nasa.gov/explore/lsdahome/datarequest) | NASA Johnson Space Center, via the NASA Life Sciences Portal | Data from human research studies on astronauts and ground analogs | Public summaries; human data by request |
| [Open Science Data Repository (OSDR)](https://science.nasa.gov/biological-physical/data) | NASA Ames | Biological spaceflight and ground study data, including GeneLab omics and the Ames Life Sciences Data Archive | Mostly open; human-derived files [controlled access](https://www.nasa.gov/reference/osdr-tutorials-requesting-controlled-access-datasets/) |
| [NASA Task Book](https://taskbook.nasaprs.com) | NASA Human Research Program | Descriptions and reports for funded human research projects | Open |

To get human data from OSDR, researchers submit a request with their ethics board (IRB) approval, and a Data Access Committee decides. LSDA and LSAH use their own request process through the [NASA Life Sciences Portal](https://nlsp.nasa.gov/explore/lsdahome/datarequest); NASA says turnaround depends on how much data is requested.

## Onboard medical hardware

On the ISS, medical care runs through the [Crew Health Care System (CHeCS)](https://ntrs.nasa.gov/citations/20110011351), which has three parts. The Health Maintenance System covers medical care, resuscitation and health monitoring. The Environmental Health System monitors air, water, microbes, noise and radiation. The Countermeasures System provides exercise equipment.

| System | Maker / agency | What it does | On ISS since |
| --- | --- | --- | --- |
| Health Maintenance System (part of CHeCS) | NASA | Medical kit, medications, defibrillator, respiratory support; crew medical officers trained to use it | Start of ISS crew operations (2000) |
| [Vivid q ultrasound](https://ntrs.nasa.gov/api/citations/20170000357/downloads/20170000357.pdf) | GE / NASA | Scans of heart, vessels, eyes, organs; crew scan while experts guide them live from the ground | 2012 (replaced an earlier ATL/Philips unit) |
| [ECHO tele-operated ultrasound](https://www.esa.int/media/finding-the-echo) | CNES, built by Sonoscanner | A sonographer on Earth steers the motorized probe; the astronaut only holds it in place ([study](https://www.pubmed.gov/30093338/)) | Installed 2016, first used 2017 |
| [Spectralis OCT2](https://www.heidelbergengineering.com/us/?p=1065) | Heidelberg Engineering / NASA | Scans of the retina and optic nerve to track eye changes in space (SANS) | OCT since 2013; OCT2 upgrade in service Dec 2018 |

ESA's successor to ECHO, [EchoFinder-2](https://www.esa.int/media/finding-the-echo), uses augmented reality and AI so astronauts can scan with little ground help. That matters beyond low Earth orbit, where communication delays rule out live guidance.

## Wearables and physiological monitoring

Wearables record vital signs and sleep around the clock, filling the gaps between scheduled exams.

| Device | Maker / agency | Measures | Status |
| --- | --- | --- | --- |
| [Bio-Monitor (Astroskin)](https://asc-csa.gc.ca/eng/sciences/astroskin.asp) | Carré Technologies (Hexoskin) for the Canadian Space Agency | ECG, breathing, blood pressure, blood oxygen, skin temperature, activity; shirt plus headband | Launched Dec 2018, in use since Jan 2019 by CSA, NASA and ESA crews |
| [Actiwatch Spectrum](https://ntrs.nasa.gov/api/citations/20090014820/downloads/20090014820.pdf) | Philips | Wrist actigraphy: sleep, activity and light exposure | Worn for whole missions in sleep studies; used in NASA's Standard Measures |
| Exercise heart rate monitors | Various | Heart rate during workouts, sent to trainers on the ground | Routine |

ISS lighting is also part of sleep monitoring. The station's fluorescent lights were replaced with LEDs offering three settings to aid alertness, sleep or normal work, as part of NASA's [Lighting Effects study](https://phys.org/news/2016-12-nasa-effects-circadian-solution-astronauts.html).

## Exercise and body measurement

ISS crew exercise about 600 minutes a week each, and the machines log each session. In [one study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566), this kept body mass and lean mass nearly unchanged after flight, though aerobic fitness still fell 7.4%.

| Device | Purpose | What it records |
| --- | --- | --- |
| Advanced Resistive Exercise Device (ARED) | Weightlifting-style resistance using vacuum cylinders | Loads, reps, sets |
| Second-generation treadmill (T2 / COLBERT) | Running, held down by a harness and bungees | Speed, duration, harness load |
| Cycle ergometer with vibration isolation (CEVIS) | Aerobic cycling | Workload, heart rate |
| Space Linear Acceleration Mass Measurement Device (SLAMMD) | Body mass without gravity: measures how a known force accelerates the crew member | Body mass |
| Russian Chibis suit | Lower-body negative pressure, pulling blood toward the legs | Heart and blood-pressure response |

NASA is now [testing whether the treadmill is needed](https://ntrs.nasa.gov/citations/20240016101) by comparing crew who exercise without T2 against at least 40 controls.

## Samples, lab and in-flight analysis

Most biological samples are still frozen in orbit and analyzed on Earth. In-flight DNA sequencing, first shown in 2016–17, is the first step toward analyzing samples on board.

| System | What it does | Milestone |
| --- | --- | --- |
| MELFI freezers (−80 °C) | Store blood, urine and saliva until a cargo ship returns them to Earth | Long-standing |
| Refrigerated centrifuge | Separates blood samples before freezing | Long-standing |
| [MinION sequencer](https://pmc.ncbi.nlm.nih.gov/articles/PMC5740133) (Oxford Nanopore) | DNA sequencing in orbit | First space sequencing, Kate Rubins, 2016; 9 runs Aug 2016–Jan 2017 |
| [miniPCR](https://www.minipcr.com/minipcr-genes-in-space-3/) (Genes in Space) | Amplifies DNA so it can be sequenced | First space DNA amplification, April 2016 |
| [Genes in Space-3](https://www.labmanager.com/genes-in-space-3-successfully-identifies-unknown-microbes-in-space-5558) | Full sample-to-sequence ID of station microbes, done on board | Peggy Whitson, 2017; found Staphylococcus, Bacillus, Aspergillus, Penicillium |

NASA's follow-on BEST investigation compares swab-to-sequencer testing with traditional lab culture.

## Radiation and environmental monitoring

Radiation is tracked at three levels: each crew member, the station, and spacecraft heading beyond low Earth orbit. Air and water monitors fall under CHeCS's Environmental Health System.

| System | Level | What it does | Since |
| --- | --- | --- | --- |
| Passive crew dosimeters | Each crew member | Total dose for the mission, read after landing | Long-standing |
| [Crew Active Dosimeters](https://ntrs.nasa.gov/api/citations/20250002757/downloads/Slides_Seminar_2025.pdf) | Each crew member | Logs dose continuously; about the size of two AA batteries, Bluetooth, e-paper screen | 2020 |
| Tissue-equivalent proportional counter (TEPC) | Station | Reference instrument for absorbed dose and dose equivalent | Successor to Shuttle hardware |
| [Radiation Environment Monitors (REM)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3941488/) | Station | Five Timepix-based USB units monitoring radiation around the clock | Oct 2012 |
| [HERA](https://ntrs.nasa.gov/api/citations/20230008902/downloads/10%20Years%20of%20Timepix%20in%20Space.pdf) (Hybrid Electronic Radiation Assessor) | Spacecraft (Orion) | Real-time dose and solar-storm warnings; third-generation Timepix | Artemis missions |
| Air Quality Monitor | Station | Gas chromatograph–mass spectrometer for trace contaminants | Long-standing |
| CO₂ and combustion-product monitors | Station | Carbon dioxide levels and fire by-products | Long-standing |
| Water quality kits | Station | Organic carbon and microbe tests on drinking water | Long-standing |

NASA's [Space Radiation Analysis Group](https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm) reads these data against each astronaut's career exposure limit.

## Software, models and telemedicine

The software splits into tests the crew run in orbit and tools NASA uses on the ground to plan medical care and manage risk.

| Software | Used by | What it does |
| --- | --- | --- |
| [Cognition test battery](https://www.med.upenn.edu/uep/cognition.html) | Crew, in orbit | 10 short computer tests of attention, memory and decision-making; about 16 minutes on the ISS; part of NASA's standard behavioral health measures since passing review in 2017 ([study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7198903)) |
| WinSCAT | Crew, in orbit | Older cognitive screening test that Cognition is replacing |
| Private medical conferences | Crew and flight surgeons | Weekly private video and audio calls with flight surgeons in Houston, supported by downlinked medical data |
| [Integrated Medical Model (IMM)](https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/) | Mission planners, flight surgeons | Runs hundreds of thousands of simulated missions to predict medical events and the supplies to pack ([2022 study](https://link.springer.com/10.1038/s41526-022-00193-9)) |
| iMED (Integrated Medical Evidence Database) | IMM | SQL database of evidence on about 100 medical conditions, kept up by clinical experts |

The IMM is baselined to ISS medical capabilities and assumes every diagnosis and treatment is correct. NASA notes it must be adapted for Moon and Mars missions, [where evacuation to a hospital is not possible](https://ntrs.nasa.gov/api/citations/20220007443/downloads/Supplemental_20220007443.pdf).

## Future direction

Moon and Mars missions will need crews to handle health care largely on their own. A Mars signal can take up to about 20 minutes each way, so live guidance from Houston will not work. The current work points four ways:

- **Analysis on board:** sequencing and lab tests in flight instead of freezing samples for Earth.
- **Continuous wearables:** round-the-clock vital signs like Bio-Monitor instead of scheduled exams.
- **Guided and AI-assisted scanning:** tools like EchoFinder-2 so non-specialists can take diagnostic images.
- **Clinical decision support:** NASA [estimates](https://ntrs.nasa.gov/api/citations/20220007443/downloads/Supplemental_20220007443.pdf) that software raising the crew's level of care could cut medical risk by removing the need for a specialist in many conditions.

Open question: NASA's Exploration Medical Capability (ExMC) data architecture was not covered in the sources checked for this document.

## Sources

Key sources, all opened or checked in November 2026:

- [NASA Life Sciences Portal — LSDA / LSAH data requests](https://nlsp.nasa.gov/explore/lsdahome/datarequest)
- [NASA OSDR — biological and physical science data](https://science.nasa.gov/biological-physical/data) and [controlled-access tutorial](https://www.nasa.gov/reference/osdr-tutorials-requesting-controlled-access-datasets/)
- [NASA — Crew Health Care System report](https://ntrs.nasa.gov/citations/20110011351)
- [CSA — Bio-Monitor (Astroskin)](https://asc-csa.gc.ca/eng/sciences/astroskin.asp)
- [ESA — Finding the Echo](https://www.esa.int/media/finding-the-echo)
- [Heidelberg Engineering — Spectralis OCT2 on the ISS](https://www.heidelbergengineering.com/us/?p=1065)
- [npj Microgravity — ISS exercise and body composition](https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566)
- [NASA — 10 Years of Timepix in Space](https://ntrs.nasa.gov/api/citations/20230008902/downloads/10%20Years%20of%20Timepix%20in%20Space.pdf)
- [UPenn — Cognition test battery](https://www.med.upenn.edu/uep/cognition.html)
- [NASA — Integrated Medical Model overview](https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/)

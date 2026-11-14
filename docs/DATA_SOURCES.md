# Data sources: real NASA astronaut health data

Researched 14 Nov 2026. This page lists official NASA data we can use for the dashboard,
what is actually downloadable, and what is not.

**How to read the labels:**

- ✅ **Tested** means we downloaded it ourselves while writing this page and it worked.
- 📄 **Read** means we read the official page but did not download anything.
- ⚠️ **Unverified** means we found it in search results only, or the page would not load. Check it before relying on it.

## The short answer

Yes, some real astronaut health data is public, but **not the kind a "Whoop" shows**.

- **What is public:** blood tests, immune markers and heart-related proteins taken from
  4 civilian astronauts (the SpaceX Inspiration4 crew, 2021) **before and after** their
  3-day flight. Also years of **radiation readings from inside the ISS**.
- **What is not public:** day-by-day heart rate, sleep, heart rate variability, bone scans,
  mood scores, etc. for individual NASA astronauts. That is private medical data. NASA
  only publishes averages in research papers.

**So the plan stays the same:** our demo data is simulated, but we can (1) shape it using
published averages and ranges, and (2) drop in real radiation numbers and real blood-test
numbers to make the demo more believable.

---

## All datasets and links

Every link below was checked on 14 Nov 2026 and responded. The **download links start a file
download straight away**, with no login. Files ending in `TRANSFORMED.csv` are the tidiest
versions to use in code. The large `.xlsx` files are genetic data, which we probably won't need.

### A. Real astronaut data (Inspiration4 crew, NASA OSDR)

Most useful for us: **OSD-569** (blood count), **OSD-575** (metabolic, immune and heart panels), **OSD-656** (urine inflammation).
OSD-572, 573, 630 and 687 have no ready-made spreadsheet. They are raw genetic/microbe files, so only the study page is listed.

**OSD-569**: Whole Blood Measurements from the SpaceX Inspiration4 Mission (RNA-seq, epitranscriptome, WGS, clonal hematopoiesis, CBC)  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 · All files (11): https://osdr.nasa.gov/osdr/data/osd/files/569

- [GLDS-561_long-readRNAseq_Direct_RNA_seq_Gene_Expression_Processed.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=GLDS-561_long-readRNAseq_Direct_RNA_seq_Gene_Expression_Processed.xlsx) (123.3 MB)
- [LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv) (26 KB)
- [GLDS-561_directm6Aseq_Direct_RNA_seq_m6A_Processed_Data.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=GLDS-561_directm6Aseq_Direct_RNA_seq_m6A_Processed_Data.xlsx) (93.1 MB)
- [LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv) (9 KB)

**OSD-570**: SpaceX Inspiration4 PBMC Profiling: snRNA-seq, snATAC-seq, and T-cell and B-cell repertoire profiling  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-570 · All files (12): https://osdr.nasa.gov/osdr/data/osd/files/570

- [GLDS-562_snATAC-Seq_PBMC_Chromatin_Accessibility_snATAC-seq_Processed_Data.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-570/download?source=datamanager&file=GLDS-562_snATAC-Seq_PBMC_Chromatin_Accessibility_snATAC-seq_Processed_Data.xlsx) (9.5 MB)
- [GLDS-562_snRNA-Seq_PBMC_Gene_Expression_snRNA-seq_Processed_Data.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-570/download?source=datamanager&file=GLDS-562_snRNA-Seq_PBMC_Gene_Expression_snRNA-seq_Processed_Data.xlsx) (3.4 MB)

**OSD-571**: SpaceX Inspiration4 Plasma Profiling: Proteomics, EVPs, Metabolomics, cfDNA Sequencing and cfRNA Sequencing  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-571 · All files (14): https://osdr.nasa.gov/osdr/data/osd/files/571

- [GLDS-563_proteomics_Plasma_Proteomics_Processed_Data.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-571/download?source=datamanager&file=GLDS-563_proteomics_Plasma_Proteomics_Processed_Data.xlsx) (322 KB)
- [GLDS-563_metabolomics_Plasma_Metabolomics_Processed_Data.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-571/download?source=datamanager&file=GLDS-563_metabolomics_Plasma_Metabolomics_Processed_Data.xlsx) (297 KB)
- [GLDS-563_proteomics_EVP_Proteomics_Processed_Data.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-571/download?source=datamanager&file=GLDS-563_proteomics_EVP_Proteomics_Processed_Data.xlsx) (106 KB)

**OSD-572**: SpaceX Inspiration4 Oral, Nasal, and Skin Metagenomic and Metatranscriptomic Microbial Swabs  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-572 · All files (5404): https://osdr.nasa.gov/osdr/data/osd/files/572


**OSD-573**: SpaceX Inspiration4 Dragon Capsule Metagenomic and Metatranscriptomic Microbial Swabs  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-573 · All files (659): https://osdr.nasa.gov/osdr/data/osd/files/573


**OSD-574**: SpaceX Inspiration4 Deltoid Skin and Microbiome Data: Spatial Transcriptomics (NanoString GeoMx), Metageomics, and Metatranscriptomics  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-574 · All files (164): https://osdr.nasa.gov/osdr/data/osd/files/574

- [GLDS-566_SpatialTranscriptomics_Skin_Biopsy_Spatially_Resolved_Transcriptomics_Processed_Data.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-574/download?source=datamanager&file=GLDS-566_SpatialTranscriptomics_Skin_Biopsy_Spatially_Resolved_Transcriptomics_Processed_Data.xlsx) (1.0 MB)

**OSD-575**: SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays (Comprehensive Metabolic Panel and Multiplex)  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 · All files (9): https://osdr.nasa.gov/osdr/data/osd/files/575

- [LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv) (25 KB)
- [LSDS-8_Multiplex_serum.immune.EvePanel_SUBMITTED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Multiplex_serum.immune.EvePanel_SUBMITTED.csv) (107 KB)
- [LSDS-8_Multiplex_serum.cardiovascular.EvePanel_SUBMITTED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Multiplex_serum.cardiovascular.EvePanel_SUBMITTED.csv) (15 KB)
- [LSDS-8_Multiplex_serum.immune.AlamarPanel_SUBMITTED.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Multiplex_serum.immune.AlamarPanel_SUBMITTED.xlsx) (323 KB)
- [LSDS-8_Multiplex_serum_immune_EvePanel_TRANSFORMED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Multiplex_serum_immune_EvePanel_TRANSFORMED.csv) (41 KB)
- [LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv) (6 KB)
- [LSDS-8_Multiplex_serum.immune.AlamarPanel_TRANSFORMED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Multiplex_serum.immune.AlamarPanel_TRANSFORMED.csv) (142 KB)
- [LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv) (9 KB)

**OSD-630**: SpaceX Inspiration4 Stool Metagenome Profiling  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-630 · All files (150): https://osdr.nasa.gov/osdr/data/osd/files/630


**OSD-656**: SpaceX Inspiration4 Urine Inflammation Panel (Multiplex, NULISAseq)  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-656 · All files (4): https://osdr.nasa.gov/osdr/data/osd/files/656

- [LSDS-64_Multiplex_urine.immune.AlamarPanel_SUBMITTED.xlsx](https://osdr.nasa.gov/geode-py/ws/studies/OSD-656/download?source=datamanager&file=LSDS-64_Multiplex_urine.immune.AlamarPanel_SUBMITTED.xlsx) (267 KB)
- [LSDS-64_Multiplex_200plex v1-Target Information.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-656/download?source=datamanager&file=LSDS-64_Multiplex_200plex%20v1-Target%20Information.csv) (13 KB)
- [LSDS-64_Multiplex_urine.immune.AlamarPanel_TRANSFORMED.csv](https://osdr.nasa.gov/geode-py/ws/studies/OSD-656/download?source=datamanager&file=LSDS-64_Multiplex_urine.immune.AlamarPanel_TRANSFORMED.csv) (115 KB)

**OSD-687**: SpaceX Inspiration4 T-Cell Histone Modification Profiling (H3K4me1, H3K4me3, H3K27ac)  
Study page: https://osdr.nasa.gov/bio/repo/data/studies/OSD-687 · All files (87): https://osdr.nasa.gov/osdr/data/osd/files/687


### B. ISS radiation and cabin environment

| What | Link |
|---|---|
| RadLab, ISS radiation detectors (browse) | https://visualization.osdr.nasa.gov/radlab/ |
| RadLab API instructions | https://visualization.osdr.nasa.gov/radlab/gui/data-access/ |
| RadLab download: DosTel1 dose rate, 2009 to 2024 (large, about 3.4 million lines) | https://visualization.osdr.nasa.gov/radlab/api/?query=instrument=DosTel1&columns+=absorbed_dose_rate&format=csv |
| Environmental Data App: ISS temperature, humidity, CO₂ | https://visualization.osdr.nasa.gov/eda/ |

### C. Reference material (for thresholds, not raw data)

| What | Link |
|---|---|
| NASA Human Research Program: list of 17 health risks | https://www.nasa.gov/hrp/risks/ |
| Evidence report: fitness and muscle loss in spaceflight | https://ntrs.nasa.gov/citations/20220019338 |
| NASA news page announcing the Inspiration4 datasets | https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/ |
| SOMA portal (Weill Cornell), Inspiration4 and Twins Study data browser | https://soma.weill.cornell.edu |
| NASA Life Sciences Data Archive (request only, not usable for us) | https://nlsp.nasa.gov/explore/lsdahome |

---

## 1. NASA Open Science Data Repository (OSDR) – Inspiration4 crew data ✅ Tested

**Website:** https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
**News page:** https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/ 📄

The OSDR is NASA's public library of space biology data. In 2024 it published data from
the 4 Inspiration4 crew members (labelled C001 to C004, no names). The news page says the
**processed data is public**, while **raw genetic data needs an application approved by a board**.

| Study | What it has | Useful to us? |
|---|---|---|
| **OSD-569** Whole blood | Includes a **complete blood count** (red cells, white cells, haemoglobin, lymphocytes...) as a CSV ✅ | **Yes.** Immune changes is one of the challenge's named risks. |
| **OSD-575** Blood serum | **Metabolic panel** (things like glucose, kidney and liver markers) plus **immune and cardiovascular protein panels**, as CSVs ✅ (file names seen, contents not opened) | **Yes.** Cardiovascular and immune markers. |
| **OSD-656** Urine | Inflammation panel ✅ (listed, not downloaded) | Maybe |
| OSD-570, 571, 572, 573, 574, 630, 687 | Mostly genetic / microbe data (cells, plasma, skin swabs, stool, T-cells) 📄 | Probably not for a dashboard |

**What the blood-count file actually looks like** (we downloaded
`LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv`, 28 lines):

- One row per crew member per date. Dates are written like `L-92` (92 days before launch)
  and `R+1` (1 day after return). The dates are L-92, L-44, L-3, R+1, R+45, R+82, R+194.
- Each test has its value **and the normal range** in separate columns,
  e.g. `hemoglobin_value_percent`, `hemoglobin_range_min_percent`, `hemoglobin_range_max_percent`.
  That normal range is handy for our "green / amber / red" colouring.
- Example row: crew member C001 had haemoglobin 14.7 and 2,667 lymphocytes per microlitre
  three days before launch.
- **Important:** there are **no readings from during the flight** in this file, only before and after.

**How to get it:** free, no login. Every study has a public API (a web address that returns
data instead of a web page):

- List a study's files: `https://osdr.nasa.gov/osdr/data/osd/files/569`
- Download one: `https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=<file name>`

**How we could use it:** a "Lab results" panel that shows a real crew member's blood counts
before vs after flight, with the normal range shaded. We'd be honest in the demo that it's
a 3-day civilian mission, not a long one.

Related: the **SOMA data portal** by Weill Cornell, https://soma.weill.cornell.edu, lets you
browse the same Inspiration4 data plus NASA Twins Study data ⚠️ (not opened).

## 2. ISS radiation readings – OSDR RadLab ✅ Tested

**Website:** https://visualization.osdr.nasa.gov/radlab/
**API docs:** https://visualization.osdr.nasa.gov/radlab/gui/data-access/ 📄

RadLab collects readings from radiation detectors that sat inside the ISS (detectors called
DosTel, Liulin-5, ALTEA, RAD, REM, TEPC). Free, no login, downloads as CSV or JSON.

- Dose is measured as **absorbed dose rate in µGy per hour** (micro-grays per hour, a unit
  of how much radiation energy the body absorbs).
- We pulled the full DosTel1 record: about **3.4 million readings, from July 2009 to October 2024**.
  The middle (median) value was about **4.9 µGy/hour**. The average was about **27 µGy/hour**
  because of big short spikes. Those spikes are most likely from the ISS passing through the
  "South Atlantic Anomaly" (a known high-radiation zone), but we did not confirm that against
  the orbit data. ⚠️
- Working example (copy into a browser):
  `https://visualization.osdr.nasa.gov/radlab/api/?query=instrument=DosTel1&columns+=absorbed_dose_rate&format=csv`
  (this is a big file, around 3.4 million lines).

**How we could use it:** this is the best real data we found for a "live" feel. We can
replay a real stretch of ISS radiation readings as the dashboard's radiation tile, including
the spikes, and add them up into a running mission total.

## 3. OSDR Environmental Data App (ISS cabin conditions) 📄

**Website:** https://visualization.osdr.nasa.gov/eda/

Shows **cabin temperature, humidity and CO₂** on the ISS (plus radiation) for the time
windows of specific biology experiments (mouse and plant studies like RR-1, RR-3...).
The page says raw and summary data can be downloaded from its "Data Tables" tab.
We did not download it, and the page didn't say what units or file type it uses.

**How we could use it:** a small "cabin environment" strip (CO₂ especially, since high CO₂
is linked to headaches and poor thinking). Lower priority.

## 4. NASA Life Sciences Data Archive (LSDA) ⚠️ Could not read

**Website:** https://nlsp.nasa.gov/explore/lsdahome (old address lsda.jsc.nasa.gov redirects here)

This is where NASA keeps data from human research studies done on astronauts. The site
needs JavaScript and our tools couldn't load the content, so we could **not** check what
is open. From the names of the pages (there's a "data request" page) it looks like
astronaut data there **needs a formal request**, which is not realistic in a hackathon.
**Treat as: not usable for us.** Worth a 5-minute look in a normal browser if someone is curious.

## 5. NASA Human Research Program (HRP) risk pages – for thresholds and talking points 📄

**Website:** https://www.nasa.gov/hrp/risks

Not raw data, but this is NASA's official list of health risks for long missions. It lists
17 risks. The ones that match our challenge:

- Altered Immune System Responses
- Cardiovascular Adaptations
- Spaceflight-Induced Bone Changes
- Reduced Cardiorespiratory and Musculoskeletal Fitness
- Behavioral Changes and Psychiatric Disorders
- Inadequate Sleep and Irregular Schedules
- Radiation-Induced Cancers
- Spaceflight Associated Neuro-ocular Syndrome (eye changes)

**Use:** name our dashboard sections after these, so judges see we followed NASA's own framing.

The detailed "evidence reports" behind each risk are on NASA's report server (NTRS).
Example numbers from the fitness evidence report
(https://ntrs.nasa.gov/citations/20220019338):

- Quoted directly from the report: many crew come home with "greater than 10-20% loss of aerobic capacity". 📄
- From a summary of the report (so double check before putting on a slide) ⚠️: on long ISS
  missions (91–192 days), peak oxygen use (VO₂peak, a measure of fitness) dropped about **17%** by
  flight day 14, was still about **15% lower** the day after landing, and had recovered about 30 days later.

**Use:** these numbers can shape the simulated "fitness" trend (gradual drop during the
mission, recovery afterwards).

## 6. Other places we looked

| Source | What we found | Status |
|---|---|---|
| **NASA Twins Study** (Scott & Mark Kelly) | Some results can be explored through the SOMA portal; detailed personal data is controlled | ⚠️ Search results only |
| **HERA** (NASA's simulated-mission habitat in Houston) | Information packs for researchers; we found no public download of crew data | ⚠️ Search results only |
| **CHAPEA** (year-long simulated Mars habitat) | Not checked | ❌ Not checked |
| **data.nasa.gov** | Not checked separately; OSDR is the life-science part of NASA's open data | ❌ Not checked |
| **Space Apps challenge resources list** | Could not find this year's challenge page in search. **Please check the challenge page directly**, it often links to recommended datasets | ❌ Not checked |

## What is NOT public (so we must simulate it)

As far as we could find, none of these are published per astronaut, per day:

- Heart rate, heart rate variability (HRV), resting heart rate
- Sleep duration and quality
- Bone density scans
- Mood, stress or behavioural check-ins
- Personal radiation dose (we have the ISS cabin readings instead)

This is expected: it's private medical data. Our simulated data should be based on
**published averages** (like the evidence report numbers above) and say so in the app,
e.g. a small "Simulated data based on NASA published ranges" label.

## Suggested next steps

1. Backend: write a small script that downloads the Inspiration4 blood-count CSV and a
   week of RadLab readings into the repo, so the app doesn't depend on NASA's site during the demo.
2. Pick 2 or 3 evidence-report numbers per dashboard tile to set our "normal / watch / alert" thresholds,
   and record where each came from.

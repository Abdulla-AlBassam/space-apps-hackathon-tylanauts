/*
 * Nothing in this file is a real astronaut's reading: the live data comes from our device
 * simulator (simulator/simulate.py), and the rest is made up here.
 *
 * What this file does, in plain English:
 * 1. Pretends four wearables (a watch, a chest strap, a headband and a smart shirt) plus a
 *    radiation badge sent readings to our hub for the last 30 days of a mission.
 * 2. Writes each reading in one shared shape (the "common format" from docs/PLAN.md):
 *    { astronaut_id, device_id, device_type, metric, value, unit, time }
 * 3. Rolls those readings up into one summary per day, which the dashboard draws.
 *
 * The story built into the numbers: the last few days show HRV falling, resting
 * heart rate rising and sleep getting shorter, so the Recovery score drops three days
 * in a row and the dashboard raises an alert. That's the MVP alert from the plan.
 *
 * Live data: on page load this file asks the backend (tylanauts-api.vercel.app) for the
 * astronaut's readings. Readings the backend has replace the made-up ones; readings it
 * doesn't have yet (skin temperature, deep sleep, exercise) stay made up. Pages can ask
 * HEALTH_DATA.isSample(metric) to show a "Sample data" tag. If the backend can't be
 * reached, everything falls back to the made-up readings and HEALTH_DATA.live.source
 * says "sample".
 *
 * Pages wait for `window.HEALTH_READY` (a promise) before drawing.
 */

(function () {
  /* ---------- The crew (all made up for the demo) ---------- */
  // Six astronauts, the same people as the Crew page (crew.js). The name card at the top of
  // Today lets you switch between them (crew-switch.js). Each one has their own "story" so
  // the demo has something different to show for each person:
  //   story(fromEnd, i) says how rough each day was. fromEnd = 0 is today, i = 0 is 30 days ago.
  //   body  0-1: tiredness in the body (heart rate up, HRV down, less exercise)
  //   sleep 0-1: shorter, lighter sleep
  //   mood  points taken off the 1-5 mood check-in
  //   dose  extra radiation that day (mSv)
  //   bp    blood pressure creeping up (each point adds 5/3 mmHg)
  //   ex, exHr  extra exercise minutes / heart rate (a spacewalk counts as hard exercise)
  const MISSION = { mission: "Lunar Gateway Expedition 3", missionDay: 142, missionLength: 180 }; // made-up mission
  const REST_DEBT = [1.0, 0.7, 0.45, 0.2]; // the commander's last four days (today first)
  const SOLAR_EVENT_DAY = 18; // a solar particle event hits everyone on the same day
  const CREW = [
    {
      id: "crew-01", name: "Cmdr. R. Haddad", initials: "RH", role: "Commander",
      summary: "Running on too little rest",
      seed: 7, shirtSeed: 11, doseBefore: 61.3,
      base: { rhr: 56, hrv: 62, spo2: 97.5, resp: 14, sleep: 7.4, deep: 19, exMin: 120, exHr: 132, dose: 0.42, sys: 117, dia: 74 },
      story: (fromEnd) => {
        const s = REST_DEBT[fromEnd] || 0;
        return { body: s, sleep: s, bp: s, mood: (fromEnd <= 2 ? 1 : 0) + (fromEnd === 0 ? 0.6 : 0) };
      },
      typedBp: { systolic: 118, diastolic: 76 }, // last typed-in blood pressure
      moodNote: "Tired, slight headache",
      sync: { "scale-01": [27, 15] }, // device id: [hours since last sync, battery %]
    },
    {
      id: "crew-02", name: "M. Okafor", initials: "MO", role: "Flight engineer",
      summary: "Homesick since family calls were lost",
      seed: 23, shirtSeed: 29, doseBefore: 58.9,
      base: { rhr: 54, hrv: 64, spo2: 97.6, resp: 13.5, sleep: 7.5, deep: 20, exMin: 110, exHr: 128, dose: 0.4, sys: 112, dia: 71 },
      // Day 135 (a week ago) the comms window for private family calls was lost.
      story: (fromEnd) => ({
        mood: fromEnd <= 1 ? 2 : fromEnd <= 6 ? 1 : 0,
        sleep: fromEnd <= 2 ? 0.45 - fromEnd * 0.1 : fromEnd <= 6 ? 0.15 : 0,
        body: fromEnd <= 1 ? 0.15 : 0,
      }),
      moodNote: "Missing home. Hard to switch off at night",
      sync: { "scale-01": [6, 70] },
    },
    {
      id: "crew-03", name: "S. Lindqvist", initials: "SL", role: "Mission specialist",
      summary: "All steady",
      seed: 41, shirtSeed: 43, doseBefore: 54.2,
      base: { rhr: 55, hrv: 63, spo2: 97.7, resp: 13.8, sleep: 7.6, deep: 21, exMin: 125, exHr: 130, dose: 0.39, sys: 114, dia: 72 },
      story: () => ({}),
      moodNote: "Feeling good",
      sync: { "scale-01": [3, 88] },
    },
    {
      id: "crew-04", name: "K. Tanaka", initials: "KT", role: "Pilot",
      summary: "Recovering from a spacewalk",
      seed: 59, shirtSeed: 61, doseBefore: 66.0,
      base: { rhr: 57, hrv: 60, spo2: 97.4, resp: 14.2, sleep: 7.4, deep: 19, exMin: 130, exHr: 134, dose: 0.43, sys: 118, dia: 75 },
      // Day 140 (two days ago): a 6.5-hour spacewalk. Extra dose, hard work, a short night after.
      story: (fromEnd) =>
        fromEnd === 2 ? { dose: 1.6, ex: 200, exHr: 12, body: 0.3 }
        : fromEnd === 1 ? { body: 0.9, sleep: 0.6 }
        : fromEnd === 0 ? { body: 0.55, sleep: 0.2 } : {},
      moodNote: "Sore shoulders after the spacewalk",
      sync: { "scale-01": [9, 64] },
    },
    {
      id: "crew-05", name: "A. Moreau", initials: "AM", role: "Science officer",
      summary: "Highest radiation total on board",
      seed: 71, shirtSeed: 73, doseBefore: 248.0, // second long mission, so a bigger career total
      base: { rhr: 58, hrv: 58, spo2: 97.5, resp: 14, sleep: 7.2, deep: 18, exMin: 115, exHr: 131, dose: 0.45, sys: 116, dia: 73 },
      story: (fromEnd) =>
        fromEnd === 2 ? { dose: 1.4, ex: 190, exHr: 10, body: 0.2 }
        : fromEnd === 1 ? { body: 0.35, sleep: 0.25 } : {},
      moodNote: "Fine, a bit tired",
      sync: { "scale-01": [12, 52] },
    },
    {
      id: "crew-06", name: "J. Reyes", initials: "JR", role: "Medical officer",
      summary: "Blood pressure creeping up",
      seed: 83, shirtSeed: 89, doseBefore: 57.5,
      base: { rhr: 59, hrv: 58, spo2: 97.6, resp: 14, sleep: 7.3, deep: 19, exMin: 105, exHr: 129, dose: 0.41, sys: 118, dia: 75 },
      // Fluids shifting towards the head in low gravity; blood pressure has crept up for 10 days.
      story: (fromEnd) => (fromEnd <= 9 ? { bp: ((10 - fromEnd) / 10) * 4, body: fromEnd <= 2 ? 0.2 : 0 } : {}),
      bpFromShirt: true, // use the smart shirt's blood pressure for the alerts
      moodNote: "Mild headache in the mornings",
      sync: { "scale-01": [5, 77] },
    },
  ];

  // Who is shown: ?crew=crew-02 in the address bar, else the last one picked, else the commander.
  function readChoice() {
    const fromUrl = new URLSearchParams(location.search).get("crew");
    let saved = null;
    try { saved = localStorage.getItem("sirius.crew"); } catch (e) { /* storage blocked: ignore */ }
    return CREW.find((c) => c.id === fromUrl) || CREW.find((c) => c.id === saved) || CREW[0];
  }
  const PERSON = readChoice();
  const ASTRONAUT = { id: PERSON.id, name: PERSON.name, initials: PERSON.initials, role: PERSON.role, ...MISSION };

  // Lets the name card switch astronaut: remembers the choice and reloads the page with it.
  window.SIRIUS_CREW = {
    list: CREW.map(({ id, name, initials, role, summary }) => ({ id, name, initials, role, summary })),
    current: PERSON.id,
    select(id) {
      try { localStorage.setItem("sirius.crew", id); } catch (e) { /* ignore */ }
      const url = new URL(location.href);
      url.searchParams.set("crew", id);
      location.assign(url.toString());
    },
  };

  // The wearables this astronaut has connected to the hub. Each one sends its readings
  // to its own webhook address (the backend is planned; here the addresses are examples).
  const DEVICES = [
    { id: "watch-01", type: "watch", label: "Wrist watch", model: "Sirius Band", icon: "watch",
      measures: ["Heart rate", "Blood oxygen", "Skin temp", "Exercise"], lastSyncHours: 0.2, battery: 64 },
    { id: "strap-01", type: "chest_strap", label: "Chest strap", model: "HRV chest strap", icon: "heart-pulse",
      measures: ["HRV", "Breathing rate", "Exercise heart rate"], lastSyncHours: 0.5, battery: 81 },
    { id: "band-01", type: "headband", label: "Sleep headband", model: "EEG sleep headband", icon: "headphones",
      measures: ["Sleep time", "Deep sleep"], lastSyncHours: 1.1, battery: 37 },
    { id: "dosi-01", type: "dosimeter", label: "Radiation badge", model: "Personal dosimeter", icon: "radiation",
      measures: ["Radiation dose"], lastSyncHours: 0.1, battery: 92 },
    { id: "scale-01", type: "scale", label: "Body mass scale", model: "Mass measurement device", icon: "scale",
      measures: ["Body mass"], lastSyncHours: 27, battery: 15 },
    // Modelled on the Canadian Space Agency's Bio-Monitor, a smart shirt and headband used on
    // the ISS since 2018 (see docs/DEVICE_HUB.md for sources). Ours is a made-up copy for the demo.
    // Like Bio-Monitor, its battery pack is docked to a base to send the data, so it syncs less often.
    { id: "shirt-01", type: "smart_shirt", label: "Smart shirt", model: "Based on CSA's Bio-Monitor", icon: "shirt",
      measures: ["ECG", "Blood pressure", "Breathing rate & depth", "Skin temp", "Blood oxygen", "Activity"],
      note: "Worn day and night, including while asleep", lastSyncHours: 3, battery: 58 },
  ];
  // Each astronaut's devices last synced at different times.
  for (const [id, [hours, battery]] of Object.entries(PERSON.sync || {})) {
    Object.assign(DEVICES.find((d) => d.id === id), { lastSyncHours: hours, battery });
  }

  const DAYS = 30;

  // A tiny random-number generator with a fixed seed, so the demo shows the
  // same numbers every time the page loads.
  let seed = 7;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function noise(size) {
    return (rand() - 0.5) * 2 * size;
  }

  // How rough each day was for this astronaut (see the crew list at the top).
  function storyOf(i) {
    const fromEnd = DAYS - 1 - i; // 0 = today
    const st = PERSON.story(fromEnd, i) || {};
    return {
      body: st.body || 0, sleep: st.sleep || 0, mood: st.mood || 0, bp: st.bp || 0,
      ex: st.ex || 0, exHr: st.exHr || 0, dose: (st.dose || 0) + (i === SOLAR_EVENT_DAY ? 0.9 : 0),
    };
  }

  function generateReadings(today) {
    seed = PERSON.seed; // start the random numbers from the beginning every time
    const readings = [];
    const b = PERSON.base;

    for (let i = 0; i < DAYS; i++) {
      const date = new Date(today.getTime() - (DAYS - 1 - i) * 86400000);
      const st = storyOf(i);
      const time = date.toISOString();
      const add = (device, metric, value, unit) =>
        readings.push({
          astronaut_id: ASTRONAUT.id,
          device_id: device.id,
          device_type: device.type,
          metric,
          value: Math.round(value * 10) / 10,
          unit,
          time,
        });

      const [watch, strap, band, dosi] = DEVICES;

      add(watch, "resting_hr", b.rhr + noise(2) + st.body * 9, "bpm");
      add(strap, "hrv_rmssd", b.hrv + noise(5) - st.body * 24, "ms");
      add(watch, "spo2", b.spo2 + noise(0.6) - st.body * 0.8, "%");
      add(watch, "skin_temp_delta", noise(0.15) + st.body * 0.4, "°C");
      add(strap, "resp_rate", b.resp + noise(0.6) + st.body * 1.6, "breaths/min");
      add(band, "sleep_hours", b.sleep + noise(0.45) - st.sleep * 1.9, "h");
      add(band, "deep_sleep_pct", b.deep + noise(2.5) - st.sleep * 6, "%");
      add(strap, "exercise_minutes", b.exMin + noise(20) - st.body * 30 + st.ex, "min");
      add(strap, "avg_exercise_hr", b.exHr + noise(6) + st.body * 4 + st.exHr, "bpm");
      add(dosi, "radiation_dose", b.dose + noise(0.05) + st.dose, "mSv");
    }
    addShirtReadings(today, readings);
    return readings;
  }

  // The smart shirt's readings. They use their own random numbers, so adding the
  // shirt doesn't change any of the other numbers, which the device simulator copies exactly.
  // The backend doesn't store these yet, so they always show a "Sample data" tag.
  function addShirtReadings(today, readings) {
    let shirtSeed = PERSON.shirtSeed;
    const shirtNoise = (size) => {
      shirtSeed = (shirtSeed * 16807) % 2147483647;
      return ((shirtSeed - 1) / 2147483646 - 0.5) * 2 * size;
    };
    const shirt = DEVICES.find((d) => d.id === "shirt-01");
    const b = PERSON.base;
    for (let i = 0; i < DAYS; i++) {
      const st = storyOf(i);
      const time = new Date(today.getTime() - (DAYS - 1 - i) * 86400000).toISOString();
      const add = (metric, value, unit, places) =>
        readings.push({
          astronaut_id: ASTRONAUT.id, device_id: shirt.id, device_type: shirt.type,
          metric, value: Math.round(value * 10 ** places) / 10 ** places, unit, time,
        });
      // Heart: morning blood pressure. A tired, stressed body can push it up a little.
      add("bp_systolic", b.sys + shirtNoise(3) + st.bp * 5, "mmHg", 0);
      add("bp_diastolic", b.dia + shirtNoise(2) + st.bp * 3, "mmHg", 0);
      // Sleep: how deep each breath is while asleep (tidal volume; about 500 mL is typical at rest).
      add("breath_volume", 500 + shirtNoise(30) - st.sleep * 30, "mL", 0);
    }
  }

  /* ---------- Turning raw readings into daily summaries and scores ---------- */

  // One row per day. Each day keeps its first (morning) reading of each metric: resting heart
  // rate and HRV are morning measurements, and the backend also streams readings during the
  // day (exercise, short spikes) that shouldn't overwrite them. Readings arrive oldest first.
  function groupByDay(readings) {
    const days = new Map();
    for (const r of readings) {
      const key = r.time.slice(0, 10);
      if (!days.has(key)) days.set(key, { date: key, sources: {} });
      const day = days.get(key);
      if (r.metric in day.sources) continue;
      day[r.metric] = r.value;
      day.sources[r.metric] = r.device_id;
    }
    return [...days.values()];
  }

  function average(list) {
    return list.reduce((a, b) => a + b, 0) / list.length;
  }
  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  // PLACEHOLDER formulas. The health-logic owner will replace these.
  // Each score compares today with the astronaut's own normal (their baseline),
  // the same idea Whoop, Oura and Apple use.
  function addScores(days) {
    const BASE_DAYS = 14; // the "normal" is the first 14 of these 30 days
    const base = days.slice(0, BASE_DAYS);
    const baseline = {};
    for (const metric of ["resting_hr", "hrv_rmssd", "sleep_hours", "resp_rate", "spo2", "skin_temp_delta", "bp_systolic", "bp_diastolic", "breath_volume"]) {
      const values = base.map((d) => d[metric]);
      const mean = average(values);
      const sd = Math.sqrt(average(values.map((v) => (v - mean) ** 2))) || 1;
      baseline[metric] = { mean, sd, low: mean - 2 * sd, high: mean + 2 * sd };
    }

    let doseSoFar = PERSON.doseBefore; // pretend dose before these 30 days (mSv)
    for (const d of days) {
      // Each part is 0-100: about 85 on a normal day, lower the further you are from your normal.
      const hrv = clamp((d.hrv_rmssd / baseline.hrv_rmssd.mean) * 85, 0, 100);
      const rhr = clamp(Math.pow(baseline.resting_hr.mean / d.resting_hr, 3) * 85, 0, 100);
      const slp = clamp(Math.pow(d.sleep_hours / 8, 2) * 100, 0, 100);
      d.recovery = Math.round(clamp(0.45 * hrv + 0.3 * rhr + 0.25 * slp, 0, 100));
      d.recoveryParts = { hrv: Math.round(hrv), rhr: Math.round(rhr), sleep: Math.round(slp) };

      // Strain on Whoop's 0 to 21 scale: more minutes at a higher heart rate = more strain.
      d.strain = Math.round(clamp((d.exercise_minutes / 150) * (d.avg_exercise_hr / 140) * 14, 0, 21) * 10) / 10;

      d.sleepScore = Math.round(clamp(Math.pow(d.sleep_hours / 8, 2) * 85 + (d.deep_sleep_pct / 20) * 15, 0, 100));

      doseSoFar += d.radiation_dose;
      d.doseTotal = Math.round(doseSoFar * 10) / 10;

      // Mood (1 to 5) is typed in by the astronaut in the daily check-in, not measured by a device.
      const fromEnd = days.length - 1 - days.indexOf(d);
      // If the backend sent a mood for this day, use it; otherwise make one up.
      const madeUpMood = clamp(Math.round(4 + noise(0.6) - storyOf(DAYS - 1 - fromEnd).mood), 1, 5);
      if (d.mood == null) d.mood = madeUpMood;
      // Mind score (placeholder): mostly mood, plus sleep, as a 0-100 number.
      d.mindScore = Math.round(clamp((d.mood / 5) * 70 + Math.pow(d.sleep_hours / 8, 2) * 30, 0, 100));
      // Radiation: share of the career limit used so far.
      d.doseLimitPct = Math.round((d.doseTotal / CAREER_LIMIT_MSV) * 1000) / 10;
    }
    return baseline;
  }

  // Bands: our placeholder cut-offs (Whoop's are similar). Same rule everywhere.
  // NASA's career radiation limit for astronauts (NASA-STD-3001): 600 mSv.
  const CAREER_LIMIT_MSV = 600;

  function band(score) {
    if (score >= 67) return "good";
    if (score >= 34) return "watch";
    return "act";
  }

  // Alerts. Following Apple's idea: raise "Act now" only when signals agree.
  // Alerts. The health ones come from the escalation rules (escalation.js, Mariam's tiers):
  // each alert carries a tier from 0 (Nominal) to 4 (Emergency) and who gets told.
  // Device and radiation notes are added after them.
  const SELF_CARE = {
    resting_hr: "Swap today's high-intensity session for light exercise",
    sleep_hours: "Aim for 8 hours in your sleep station tonight",
    sleep_trend: "Keep the same bedtime for the next few nights",
    recovery: "Take it easier today and log how rested you feel",
  };
  const DEVICE_OF = { resting_hr: ["watch-01"], sleep_hours: ["band-01"], sleep_trend: ["band-01"], recovery: ["watch-01", "strap-01", "band-01"], resp_rate: ["strap-01"], spo2: ["watch-01"] };
  const tierInfo = (n) => window.ESCALATION.TIERS[n];

  function buildAlerts(days, baseline, assessment) {
    const alerts = [];
    const today = days[days.length - 1];
    const make = (tier, f) => ({
      level: tierInfo(tier).level, tier, tierName: tierInfo(tier).name, notify: tierInfo(tier).notify,
      title: f.title, detail: f.detail, rules: f.rules, actions: f.actions,
      signals: f.signals, sources: [...new Set(f.signals.flatMap((m) => DEVICE_OF[m] || []))],
      combined: f.combined || false, cat: f.cat, date: today.date,
    });
    const actionsFor = (tier, list) => {
      const own = list.map((f) => SELF_CARE[f.metric]).filter(Boolean);
      if (tier >= 3) return [tierInfo(tier).doctor, ...own];
      if (tier === 2) return [...own.slice(0, 2), "Recheck in 30-60 minutes; the AI doctor will ask a few questions", "Goes into your flight surgeon's daily summary"];
      return own.length ? own : ["Keep an eye on it; I'll check again tomorrow morning"];
    };

    const { flags, stacked, tier1 } = assessment;
    // Stacking (two or more Tier 1 signs at once) becomes one combined Tier 2 alert.
    if (stacked) {
      alerts.push(make(2, {
        title: `${tier1.length} warning signs at the same time`,
        detail: tier1.map((f) => f.detail).join(" "),
        rules: [...tier1.map((f) => ({ text: f.rule, status: f.status })), { text: "Two or more Tier 1 signs at once", status: "Design" }],
        actions: actionsFor(2, tier1), signals: tier1.map((f) => f.metric), combined: true, cat: "heart",
      }));
    }
    // Every other flag is its own alert (Tier 1 ones only when they didn't stack).
    for (const f of flags.filter((x) => x.tier >= 2 || !stacked).sort((a, b) => b.tier - a.tier)) {
      alerts.push(make(f.tier, {
        title: f.rule, detail: f.detail, rules: [{ text: f.rule, status: f.status }],
        actions: actionsFor(f.tier, [f]), signals: [f.metric], cat: f.cat,
      }));
    }
    alerts.sort((a, b) => b.tier - a.tier);

    for (const dev of DEVICES.filter((x) => x.lastSyncHours >= 24)) {
      alerts.push({
        level: "watch",
        title: `${dev.label} hasn't synced in 24 hours`,
        detail: `Last reading ${Math.round(dev.lastSyncHours)} hours ago. Battery ${dev.battery}%. Missing data is never silent.`,
        actions: ["Charge it and step on it once today", "Check it on the Devices page"],
        signals: [],
        sources: [dev.id],
        device: true, cat: "device", date: today.date,
      });
    }

    const doseSpike = [...days].reverse().find((d) => d.radiation_dose > 1); // the most recent one
    if (doseSpike) {
      alerts.push({
        level: "info",
        title: "Radiation spike recorded earlier",
        detail: `${doseSpike.radiation_dose} mSv on ${doseSpike.date}. Mission total is now ${today.doseTotal} mSv.`,
        actions: ["No action needed now. Shared with your flight surgeon."],
        signals: ["radiation_dose"],
        sources: ["dosi-01"],
        cat: "radiation", date: doseSpike.date,
      });
    }
    return alerts;
  }

  /* ---------- Health check log (see docs/HEALTH_LOG.md) ---------- */
  // Four categories for the first version. "auto" = filled in by a device.
  const CATEGORIES = [
    { id: "heart", name: "Heart", icon: "heart-pulse" },
    { id: "sleep", name: "Sleep", icon: "moon" },
    { id: "mind", name: "Mind & mood", icon: "brain" },
    { id: "radiation", name: "Radiation", icon: "radiation" },
  ];
  // How often each test happens. Most frequencies are our own proposal (see HEALTH_LOG.md).
  const TESTS = [
    { id: "rhr", cat: "heart", name: "Resting heart rate & HRV", how: "auto", every: "Continuous", device: "watch-01" },
    // Blood pressure used to be typed in daily; the smart shirt now sends it by itself.
    { id: "bp", cat: "heart", name: "Blood pressure", how: "auto", every: "Daily", device: "shirt-01" },
    { id: "shirt-ecg", cat: "heart", name: "Heart rhythm (ECG)", how: "auto", every: "Continuous", device: "shirt-01" },
    { id: "ecg", cat: "heart", name: "ECG", how: "typed", every: "Monthly", unit: "", normal: "normal rhythm", lastDays: 12 },
    { id: "sleep", cat: "sleep", name: "Hours slept & quality", how: "auto", every: "Every night", device: "band-01" },
    { id: "breath", cat: "sleep", name: "Breathing while asleep", how: "auto", every: "Every night", device: "shirt-01" },
    { id: "rested", cat: "sleep", name: "How rested do you feel? (1-5)", how: "typed", every: "Daily", unit: "/5", normal: "3 or more", lastDays: 0 },
    { id: "mood", cat: "mind", name: "Mood check & symptoms (1-5)", how: "typed", every: "Daily", unit: "/5", normal: "3 or more", lastDays: 1 },
    { id: "cog", cat: "mind", name: "Cognitive test", how: "typed", every: "Monthly", unit: "% of baseline", normal: "90% or more", lastDays: 31 },
    { id: "psych", cat: "mind", name: "Private psychological conference", how: "reminder", every: "Every 2 weeks", lastDays: 9 },
    { id: "dose", cat: "radiation", name: "Personal dose", how: "auto", every: "Daily", device: "dosi-01" },
    { id: "eva", cat: "radiation", name: "Dose before & after a spacewalk", how: "typed", every: "Each spacewalk", unit: "mSv", normal: "below 1 per walk", lastDays: 20 },
  ];
  const PERIOD_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, "Every 2 weeks": 14 };
  for (const t of TESTS) {
    const period = PERIOD_DAYS[t.every];
    if (period && t.lastDays != null) {
      t.dueInDays = period - t.lastDays; // 0 = due today, negative = overdue
    }
  }

  /* ---------- Putting it together ---------- */
  // Turns a list of readings into everything the pages draw. `live` says which readings
  // came from the backend.
  function build(readings, live) {
    const days = groupByDay(readings);
    const baseline = addScores(days);
    // The latest typed-in blood pressure (made up for now: the health log isn't stored yet).
    // Some astronauts' alerts use the smart shirt's latest reading instead.
    const lastDay = days[days.length - 1];
    const latestBp = PERSON.bpFromShirt
      ? { systolic: lastDay.bp_systolic, diastolic: lastDay.bp_diastolic, sample: true }
      : { ...(PERSON.typedBp || { systolic: 118, diastolic: 76 }), sample: true };
    const assessment = window.ESCALATION.assess(days, baseline, { bp: latestBp });
    // Each alert knows its day and health category, for the calendar.
    const alerts = buildAlerts(days, baseline, assessment);

    // Recent log entries: device readings and typed-in results in one history.
    const todayRow = days[days.length - 1];
    const yRow = days[days.length - 2];
    const history = [
      { when: "Today 07:00", test: "Hours slept", cat: "sleep", value: `${todayRow.sleep_hours} h`, source: "band-01", out: todayRow.sleep_hours < baseline.sleep_hours.low },
      { when: "Today 07:00", test: "Resting heart rate", cat: "heart", value: `${todayRow.resting_hr} bpm`, source: "watch-01", out: todayRow.resting_hr > baseline.resting_hr.high },
      { when: "Today 07:00", test: "Personal dose", cat: "radiation", value: `${todayRow.radiation_dose} mSv`, source: "dosi-01", out: false },
      { when: "Yesterday 21:10", test: "Mood check", cat: "mind", value: `${yRow.mood} / 5`, source: "typed", note: PERSON.moodNote, out: yRow.mood < 3 },
      { when: "Today 07:00", test: "Blood pressure", cat: "heart", value: `${todayRow.bp_systolic}/${todayRow.bp_diastolic} mmHg`, source: "shirt-01", out: todayRow.bp_systolic >= 130 || todayRow.bp_diastolic >= 80 },
    ];

    // The AI doctor (idea only, see docs/AI_DOCTOR.md). Scripted messages for the demo.
    const t = tierInfo(assessment.tier);
    const tierLine = `That puts you at Tier ${assessment.tier} (${t.name}), so ${t.notify.charAt(0).toLowerCase() + t.notify.slice(1)} will see it.`;
    const DOCTOR = {
      // The same tier as the alerts, from the escalation rules.
      tier: { n: assessment.tier, word: t.name, level: t.level },
      message: PERSON.id === "crew-01"
        ? `Your recovery has dropped for 3 days. Your watch shows a resting heart rate of ${todayRow.resting_hr} bpm (usually about ${Math.round(baseline.resting_hr.mean)}), and your headband shows only ${todayRow.sleep_hours} h of sleep. Together that usually means you need rest, not illness, but let's keep an eye on it. ${tierLine}`
        : assessment.flags.length
          ? `${assessment.flags.map((f) => f.detail).join(" ")} ${tierLine}`
          : `Everything is steady today. Recovery is ${todayRow.recovery} and you slept ${todayRow.sleep_hours} h. ${tierLine}`,
      suggestions: alerts[0] && alerts[0].actions ? alerts[0].actions.slice(0, 3) : ["Keep your usual routine", "Log how rested you feel", "I'll check again tomorrow morning"],
      basedOn: ["watch-01", "band-01", "strap-01"],
    };

    return {
      astronaut: ASTRONAUT, crew: window.SIRIUS_CREW.list, devices: DEVICES, readings, days, baseline, alerts, band,
      categories: CATEGORIES, tests: TESTS, history, doctor: DOCTOR, careerLimit: CAREER_LIMIT_MSV,
      escalation: assessment, live,
      // true when a reading is still made up (no live data for it on the latest day)
      isSample: (metric) => !live.metrics.includes(metric),
    };
  }

  /* ---------- Reading live data from the backend ---------- */
  // ?api=http://localhost:8001/api/v1 in the address bar points the page at a local backend.
  const API_BASE = new URLSearchParams(location.search).get("api") || "https://tylanauts-api.vercel.app/api/v1";
  const WAIT_MS = 6000; // after this long without an answer, use the made-up data
  // Backend metric id -> the name this file uses.
  const DASHBOARD_NAMES = {
    "heart-rate": "resting_hr",
    "oxygen-saturation": "spo2",
    "heart-rate-variability": "hrv_rmssd",
    "respiratory-rate": "resp_rate",
    "sleep-duration": "sleep_hours",
    "radiation-dose": "radiation_dose",
    "mood": "mood",
  };
  // The backend's newer simulator names its devices differently; point those names at
  // the devices the pages know, so every reading still shows the right device.
  const DEVICE_ALIASES = { "sim-watch-01": "watch-01", "sim-shirt-01": "shirt-01", "sim-badge-01": "dosi-01" };
  // The backend spells some units the standard's way; show them the way the pages do.
  const UNITS = { "beats/min": "bpm", C: "°C", score: "/5" };

  async function fetchLiveReadings(astronautId) {
    const since = new Date(Date.now() - 60 * 86400000).toISOString();
    const url = `${API_BASE}/subjects/${encodeURIComponent(astronautId)}/data-points?start=${since}&limit=5000`;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), WAIT_MS);
    try {
      const response = await fetch(url, { signal: stop.signal });
      if (!response.ok) throw new Error(`the server answered ${response.status}`);
      const records = await response.json();
      const rows = [];
      for (const rec of records) {
        // Most metrics have one number ("value"). Blood pressure has two, so it becomes
        // two dashboard readings: the top number and the bottom number.
        const parts = rec.metric === "blood-pressure"
          ? [["bp_systolic", rec.values.systolic], ["bp_diastolic", rec.values.diastolic]]
          : [[DASHBOARD_NAMES[rec.metric], rec.values.value]];
        const body = rec.data_point.body;
        const unit = Object.values(body).find((v) => v && typeof v === "object" && "unit" in v)?.unit;
        const deviceId = DEVICE_ALIASES[rec.device_id] || rec.device_id || "typed";
        for (const [metric, value] of parts) {
          if (!metric || typeof value !== "number") continue; // not used by the pages yet
          rows.push({
            astronaut_id: rec.subject_id,
            device_id: deviceId,
            device_type: (DEVICES.find((d) => d.id === deviceId) || {}).type || "typed",
            metric,
            value,
            unit: UNITS[unit] || unit,
            // Periods like sleep count for the day they end on.
            time: rec.effective_end || rec.effective_start,
          });
        }
      }
      return rows;
    } finally {
      clearTimeout(timer);
    }
  }

  // Live readings win; made-up ones fill whatever the backend doesn't have yet.
  function mergeReadings(liveRows) {
    const latest = liveRows.reduce((max, r) => (r.time > max ? r.time : max), "");
    const lastDay = latest.slice(0, 10);
    // Line the made-up days up with the live ones, so both describe the same 30 days.
    const sample = generateReadings(new Date(lastDay + "T07:00:00Z"));
    const firstDay = sample[0].time.slice(0, 10);
    const recent = liveRows.filter((r) => r.time.slice(0, 10) >= firstDay);
    const have = new Set(recent.map((r) => r.time.slice(0, 10) + "|" + r.metric));
    const filler = sample.filter((r) => !have.has(r.time.slice(0, 10) + "|" + r.metric));
    const metrics = [...new Set(recent.filter((r) => r.time.slice(0, 10) === lastDay).map((r) => r.metric))];
    return { readings: filler.concat(recent).sort((a, b) => (a.time < b.time ? -1 : 1)), metrics };
  }

  function useSample(reason) {
    if (reason) console.warn("[Sirius] Using sample data:", reason);
    window.HEALTH_DATA = build(generateReadings(new Date("2026-11-14T07:00:00Z")), { source: "sample", metrics: [], reason: reason || "" });
    return window.HEALTH_DATA;
  }

  // ?sample in the address bar skips the backend (handy for working offline).
  window.HEALTH_READY = /[?&]sample\b/.test(location.search)
    ? Promise.resolve(useSample("asked for with ?sample"))
    : fetchLiveReadings(ASTRONAUT.id)
        .then((rows) => {
          if (!rows.length) return useSample(`the server has no readings for ${ASTRONAUT.id} yet`);
          const { readings, metrics } = mergeReadings(rows);
          window.HEALTH_DATA = build(readings, { source: "live", metrics, reason: "" });
          return window.HEALTH_DATA;
        })
        .catch((err) => {
          console.warn("[Sirius] Backend error:", err);
          return useSample(err.name === "AbortError" ? "the server took too long to answer" : "couldn't reach the server");
        });
})();

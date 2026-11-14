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
  const ASTRONAUT = {
    id: "crew-01",
    name: "Cmdr. R. Haddad", // made-up person for the demo
    mission: "Lunar Gateway Expedition 3", // made-up mission
    missionDay: 142,
    missionLength: 180,
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

  // How "rough" each of the last few days was (0 = normal). Drives the story.
  function stress(dayIndex) {
    const fromEnd = DAYS - 1 - dayIndex; // 0 = today
    if (fromEnd === 0) return 1.0;
    if (fromEnd === 1) return 0.7;
    if (fromEnd === 2) return 0.45;
    if (fromEnd === 3) return 0.2;
    return 0;
  }

  function generateReadings(today) {
    seed = 7; // start the random numbers from the beginning every time
    const readings = [];

    for (let i = 0; i < DAYS; i++) {
      const date = new Date(today.getTime() - (DAYS - 1 - i) * 86400000);
      const s = stress(i);
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

      add(watch, "resting_hr", 56 + noise(2) + s * 9, "bpm");
      add(strap, "hrv_rmssd", 62 + noise(5) - s * 24, "ms");
      add(watch, "spo2", 97.5 + noise(0.6) - s * 0.8, "%");
      add(watch, "skin_temp_delta", noise(0.15) + s * 0.4, "°C");
      add(strap, "resp_rate", 14 + noise(0.6) + s * 1.6, "breaths/min");
      add(band, "sleep_hours", 7.4 + noise(0.45) - s * 1.9, "h");
      add(band, "deep_sleep_pct", 19 + noise(2.5) - s * 6, "%");
      add(strap, "exercise_minutes", 120 + noise(20) - s * 30, "min");
      add(strap, "avg_exercise_hr", 132 + noise(6) + s * 4, "bpm");
      // A small spike on day 18 stands in for a solar particle event.
      add(dosi, "radiation_dose", 0.42 + noise(0.05) + (i === 18 ? 0.9 : 0), "mSv");
    }
    addShirtReadings(today, readings);
    return readings;
  }

  // The smart shirt's readings. They use their own random numbers (seed 11), so adding the
  // shirt doesn't change any of the other numbers, which the device simulator copies exactly.
  // The backend doesn't store these yet, so they always show a "Sample data" tag.
  function addShirtReadings(today, readings) {
    let shirtSeed = 11;
    const shirtNoise = (size) => {
      shirtSeed = (shirtSeed * 16807) % 2147483647;
      return ((shirtSeed - 1) / 2147483646 - 0.5) * 2 * size;
    };
    const shirt = DEVICES.find((d) => d.id === "shirt-01");
    for (let i = 0; i < DAYS; i++) {
      const s = stress(i);
      const time = new Date(today.getTime() - (DAYS - 1 - i) * 86400000).toISOString();
      const add = (metric, value, unit, places) =>
        readings.push({
          astronaut_id: ASTRONAUT.id, device_id: shirt.id, device_type: shirt.type,
          metric, value: Math.round(value * 10 ** places) / 10 ** places, unit, time,
        });
      // Heart: morning blood pressure. A tired, stressed body can push it up a little.
      add("bp_systolic", 117 + shirtNoise(3) + s * 5, "mmHg", 0);
      add("bp_diastolic", 74 + shirtNoise(2) + s * 3, "mmHg", 0);
      // Sleep: how deep each breath is while asleep (tidal volume; about 500 mL is typical at rest).
      add("breath_volume", 500 + shirtNoise(30) - s * 30, "mL", 0);
    }
  }

  /* ---------- Turning raw readings into daily summaries and scores ---------- */

  function groupByDay(readings) {
    const days = new Map();
    for (const r of readings) {
      const key = r.time.slice(0, 10);
      if (!days.has(key)) days.set(key, { date: key, sources: {} });
      const day = days.get(key);
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

    let doseSoFar = 61.3; // pretend dose before these 30 days (mSv)
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
      const madeUpMood = clamp(Math.round(4 + noise(0.6) - (fromEnd <= 2 ? 1 : 0) - (fromEnd === 0 ? 0.6 : 0)), 1, 5);
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

    const doseSpike = days.find((d) => d.radiation_dose > 1);
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
    const latestBp = { systolic: 118, diastolic: 76, sample: true };
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
      { when: "Yesterday 21:10", test: "Mood check", cat: "mind", value: `${yRow.mood} / 5`, source: "typed", note: "Tired, slight headache", out: yRow.mood < 3 },
      { when: "Today 07:00", test: "Blood pressure", cat: "heart", value: `${todayRow.bp_systolic}/${todayRow.bp_diastolic} mmHg`, source: "shirt-01", out: todayRow.bp_systolic >= 130 || todayRow.bp_diastolic >= 80 },
    ];

    // The AI doctor (idea only, see docs/AI_DOCTOR.md). Scripted messages for the demo.
    const DOCTOR = {
      // The same tier as the alerts, from the escalation rules.
      tier: { n: assessment.tier, word: tierInfo(assessment.tier).name, level: tierInfo(assessment.tier).level },
      message: `Your recovery has dropped for 3 days. Your watch shows a resting heart rate of ${todayRow.resting_hr} bpm (usually about ${Math.round(baseline.resting_hr.mean)}), and your headband shows only ${todayRow.sleep_hours} h of sleep. Together that usually means you need rest, not illness, but let's keep an eye on it. That puts you at Tier ${assessment.tier} (${tierInfo(assessment.tier).name}), so ${tierInfo(assessment.tier).notify.charAt(0).toLowerCase() + tierInfo(assessment.tier).notify.slice(1)} will see it.`,
      suggestions: ["Take today's exercise easy", "Log how rested you feel", "I'll check again tomorrow morning"],
      basedOn: ["watch-01", "band-01", "strap-01"],
    };

    return {
      astronaut: ASTRONAUT, devices: DEVICES, readings, days, baseline, alerts, band,
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
        const metric = DASHBOARD_NAMES[rec.metric];
        if (!metric || typeof rec.values.value !== "number") continue; // not used by the pages yet
        const body = rec.data_point.body;
        const unit = Object.values(body).find((v) => v && typeof v === "object" && "unit" in v)?.unit;
        const deviceId = DEVICE_ALIASES[rec.device_id] || rec.device_id || "typed";
        rows.push({
          astronaut_id: rec.subject_id,
          device_id: deviceId,
          device_type: (DEVICES.find((d) => d.id === deviceId) || {}).type || "typed",
          metric,
          value: rec.values.value,
          unit: UNITS[unit] || unit,
          // Periods like sleep count for the day they end on.
          time: rec.effective_end || rec.effective_start,
        });
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

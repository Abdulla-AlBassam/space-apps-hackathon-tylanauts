/*
 * SIMULATED DATA. Nothing in this file is a real astronaut's reading.
 *
 * What this file does, in plain English:
 * 1. Pretends three wearables (a watch, a chest strap, a headband) plus a radiation
 *    badge sent readings to our hub for the last 30 days of a mission.
 * 2. Writes each reading in one shared shape (the "common format" from docs/PLAN.md):
 *    { astronaut_id, device_id, device_type, metric, value, unit, time }
 * 3. Rolls those readings up into one summary per day, which the dashboard draws.
 *
 * The story built into the numbers: the last few days show HRV falling, resting
 * heart rate rising and sleep getting shorter, so the Recovery score drops three days
 * in a row and the dashboard raises an alert. That's the MVP alert from the plan.
 *
 * When the real backend exists, replace `generateReadings()` with a fetch from it.
 * Everything below it can stay the same.
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
    { id: "watch-01", type: "watch", label: "Wrist watch", model: "Tylanauts Band", icon: "watch",
      measures: ["Heart rate", "Blood oxygen", "Skin temp", "Exercise"], lastSyncHours: 0.2, battery: 64 },
    { id: "strap-01", type: "chest_strap", label: "Chest strap", model: "HRV chest strap", icon: "heart-pulse",
      measures: ["HRV", "Breathing rate", "Exercise heart rate"], lastSyncHours: 0.5, battery: 81 },
    { id: "band-01", type: "headband", label: "Sleep headband", model: "EEG sleep headband", icon: "headphones",
      measures: ["Sleep time", "Deep sleep"], lastSyncHours: 1.1, battery: 37 },
    { id: "dosi-01", type: "dosimeter", label: "Radiation badge", model: "Personal dosimeter", icon: "radiation",
      measures: ["Radiation dose"], lastSyncHours: 0.1, battery: 92 },
    { id: "scale-01", type: "scale", label: "Body mass scale", model: "Mass measurement device", icon: "scale",
      measures: ["Body mass"], lastSyncHours: 27, battery: 15 },
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

  function generateReadings() {
    const readings = [];
    const today = new Date("2026-11-14T07:00:00Z");

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
    return readings;
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
    for (const metric of ["resting_hr", "hrv_rmssd", "sleep_hours", "resp_rate", "spo2", "skin_temp_delta"]) {
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
      d.mood = clamp(Math.round(4 + noise(0.6) - (fromEnd <= 2 ? 1 : 0) - (fromEnd === 0 ? 0.6 : 0)), 1, 5);
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
  function buildAlerts(days, baseline) {
    const alerts = [];
    const last = days.slice(-4);
    const today = days[days.length - 1];

    const droppingDays = last.slice(1).filter((d, i) => d.recovery < last[i].recovery).length;
    const outOfRange = ["resting_hr", "hrv_rmssd", "sleep_hours", "resp_rate"].filter((m) => {
      const b = baseline[m];
      return today[m] < b.low || today[m] > b.high;
    });

    if (droppingDays === 3) {
      alerts.push({
        level: outOfRange.length >= 2 ? "act" : "watch",
        title: "Recovery has dropped 3 days in a row",
        detail: `${last[0].recovery}% → ${today.recovery}%. ${outOfRange.length} of your vitals are outside your normal range today.`,
        actions: [
          "Swap today's high-intensity session for light exercise",
          "Aim for 8 hours in your sleep station tonight",
          "Log how you feel in today's check-in",
        ],
        signals: outOfRange,
        sources: ["watch-01", "strap-01", "band-01"],
      });
    }

    if (today.hrv_rmssd < baseline.hrv_rmssd.low) {
      alerts.push({
        level: "watch",
        title: "HRV below your normal range",
        detail: `${today.hrv_rmssd} ms vs your usual ${Math.round(baseline.hrv_rmssd.mean)} ms. Often linked to poor sleep, stress or illness.`,
        actions: ["Try a 10-minute breathing session", "Check again tomorrow morning"],
        signals: ["hrv_rmssd"],
        sources: ["strap-01"],
      });
    }

    // A warning only possible by combining two devices: short sleep (headband)
    // together with a raised resting heart rate (watch).
    if (today.sleep_hours < baseline.sleep_hours.low && today.resting_hr > baseline.resting_hr.high) {
      alerts.push({
        level: "watch",
        title: "Short sleep and a raised heart rate together",
        detail: `${today.sleep_hours} h of sleep and ${today.resting_hr} bpm resting heart rate. Neither device would flag this alone.`,
        actions: ["Check in on recovery: light duties if you can", "Log how rested you feel"],
        signals: ["sleep_hours"],
        sources: ["band-01", "watch-01"],
        combined: true,
      });
    }

    for (const dev of DEVICES.filter((x) => x.lastSyncHours >= 24)) {
      alerts.push({
        level: "watch",
        title: `${dev.label} hasn't synced in 24 hours`,
        detail: `Last reading ${Math.round(dev.lastSyncHours)} hours ago. Battery ${dev.battery}%. Missing data is never silent.`,
        actions: ["Charge it and step on it once today", "Check it on the Devices page"],
        signals: [],
        sources: [dev.id],
        device: true,
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
      });
    }
    return alerts;
  }

  /* ---------- Health check log (see docs/HEALTH_LOG.md) ---------- */
  // Five categories for the first version. "auto" = filled in by a device.
  const CATEGORIES = [
    { id: "heart", name: "Heart", icon: "heart-pulse" },
    { id: "sleep", name: "Sleep", icon: "moon" },
    { id: "mind", name: "Mind & mood", icon: "brain" },
    { id: "radiation", name: "Radiation", icon: "radiation" },
    { id: "bone", name: "Bone & muscle", icon: "bone" },
  ];
  // How often each test happens. Most frequencies are our own proposal (see HEALTH_LOG.md).
  const TESTS = [
    { id: "rhr", cat: "heart", name: "Resting heart rate & HRV", how: "auto", every: "Continuous", device: "watch-01" },
    { id: "bp", cat: "heart", name: "Blood pressure", how: "typed", every: "Daily", unit: "mmHg", normal: "below 130/80", lastDays: 1 },
    { id: "ecg", cat: "heart", name: "ECG", how: "typed", every: "Monthly", unit: "", normal: "normal rhythm", lastDays: 12 },
    { id: "sleep", cat: "sleep", name: "Hours slept & quality", how: "auto", every: "Every night", device: "band-01" },
    { id: "rested", cat: "sleep", name: "How rested do you feel? (1-5)", how: "typed", every: "Daily", unit: "/5", normal: "3 or more", lastDays: 0 },
    { id: "mood", cat: "mind", name: "Mood check & symptoms (1-5)", how: "typed", every: "Daily", unit: "/5", normal: "3 or more", lastDays: 1 },
    { id: "cog", cat: "mind", name: "Cognitive test", how: "typed", every: "Monthly", unit: "% of baseline", normal: "90% or more", lastDays: 31 },
    { id: "psych", cat: "mind", name: "Private psychological conference", how: "reminder", every: "Every 2 weeks", lastDays: 9 },
    { id: "dose", cat: "radiation", name: "Personal dose", how: "auto", every: "Daily", device: "dosi-01" },
    { id: "eva", cat: "radiation", name: "Dose before & after a spacewalk", how: "typed", every: "Each spacewalk", unit: "mSv", normal: "below 1 per walk", lastDays: 20 },
    { id: "exercise", cat: "bone", name: "Exercise session", how: "auto", every: "Daily", device: "watch-01" },
    { id: "mass", cat: "bone", name: "Body mass", how: "typed", every: "Weekly", unit: "kg", normal: "77-80", lastDays: 8 },
    { id: "fitness", cat: "bone", name: "Fitness test (treadmill or bike)", how: "typed", every: "Monthly", unit: "% of pre-flight", normal: "90% or more", lastDays: 22 },
  ];
  const PERIOD_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, "Every 2 weeks": 14 };
  for (const t of TESTS) {
    const period = PERIOD_DAYS[t.every];
    if (period && t.lastDays != null) {
      t.dueInDays = period - t.lastDays; // 0 = due today, negative = overdue
    }
  }

  const readings = generateReadings();
  const days = groupByDay(readings);
  const baseline = addScores(days);
  const alerts = buildAlerts(days, baseline);

  // Recent log entries: device readings and typed-in results in one history.
  const todayRow = days[days.length - 1];
  const yRow = days[days.length - 2];
  const history = [
    { when: "Today 07:00", test: "Hours slept", cat: "sleep", value: `${todayRow.sleep_hours} h`, source: "band-01", out: todayRow.sleep_hours < baseline.sleep_hours.low },
    { when: "Today 07:00", test: "Resting heart rate", cat: "heart", value: `${todayRow.resting_hr} bpm`, source: "watch-01", out: todayRow.resting_hr > baseline.resting_hr.high },
    { when: "Today 07:00", test: "Personal dose", cat: "radiation", value: `${todayRow.radiation_dose} mSv`, source: "dosi-01", out: false },
    { when: "Yesterday 21:10", test: "Mood check", cat: "mind", value: `${yRow.mood} / 5`, source: "typed", note: "Tired, slight headache", out: yRow.mood < 3 },
    { when: "Yesterday 08:05", test: "Blood pressure", cat: "heart", value: "118/76 mmHg", source: "typed", out: false },
    { when: "Yesterday 16:30", test: "Exercise session", cat: "bone", value: `${Math.round(yRow.exercise_minutes)} min`, source: "watch-01", out: false },
    { when: "8 days ago", test: "Body mass", cat: "bone", value: "78.4 kg", source: "typed", out: false },
  ];

  // The AI doctor (idea only, see docs/AI_DOCTOR.md). Scripted messages for the demo.
  const DOCTOR = {
    tier: { n: 2, word: "Watch", level: "watch" },
    message: `Your recovery has dropped for 3 days. Your watch shows a resting heart rate of ${todayRow.resting_hr} bpm (usually about ${Math.round(baseline.resting_hr.mean)}), and your headband shows only ${todayRow.sleep_hours} h of sleep. Together that usually means you need rest, not illness, but let's keep an eye on it.`,
    suggestions: ["Take today's exercise easy", "Log how rested you feel", "I'll check again tomorrow morning"],
    basedOn: ["watch-01", "band-01", "strap-01"],
  };

  window.HEALTH_DATA = {
    astronaut: ASTRONAUT, devices: DEVICES, readings, days, baseline, alerts, band,
    categories: CATEGORIES, tests: TESTS, history, doctor: DOCTOR, careerLimit: CAREER_LIMIT_MSV,
  };
})();

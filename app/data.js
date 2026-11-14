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

  const DEVICES = [
    { id: "watch-01", type: "watch", label: "Wrist watch" },
    { id: "strap-01", type: "chest_strap", label: "Chest strap" },
    { id: "band-01", type: "headband", label: "Sleep headband" },
    { id: "dosi-01", type: "dosimeter", label: "Radiation badge" },
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
    }
    return baseline;
  }

  // Bands: our placeholder cut-offs (Whoop's are similar). Same rule everywhere.
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
      });
    }

    if (today.hrv_rmssd < baseline.hrv_rmssd.low) {
      alerts.push({
        level: "watch",
        title: "HRV below your normal range",
        detail: `${today.hrv_rmssd} ms vs your usual ${Math.round(baseline.hrv_rmssd.mean)} ms. Often linked to poor sleep, stress or illness.`,
        actions: ["Try a 10-minute breathing session", "Check again tomorrow morning"],
        signals: ["hrv_rmssd"],
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
      });
    }
    return alerts;
  }

  const readings = generateReadings();
  const days = groupByDay(readings);
  const baseline = addScores(days);
  const alerts = buildAlerts(days, baseline);

  window.HEALTH_DATA = { astronaut: ASTRONAUT, devices: DEVICES, readings, days, baseline, alerts, band };
})();

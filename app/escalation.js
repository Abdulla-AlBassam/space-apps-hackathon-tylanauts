/*
 * Escalation rules: which readings put the astronaut in which tier, and who gets told.
 *
 * Source: Mariam's draft v0.2 ("Siryius escalation tiers: triggers, thresholds and sources",
 * issue #30), written up in docs/ESCALATION_RULES.md. Every rule below says where its number
 * comes from, using her three labels:
 *   Published = taken from a guideline or NASA document
 *   Adapted   = a published number mapped onto our tiers
 *   Design    = our own choice, which a flight surgeon should review
 *
 * In plain English, this file:
 * 1. Scores today's breathing rate, blood oxygen, pulse and blood pressure on NEWS2, the UK
 *    hospital early-warning chart Mariam based the vital-sign bands on.
 * 2. Compares heart rate, sleep and the Recovery score with the astronaut's own normal.
 * 3. Turns everything that fired into "flags", each with a tier from 0 (Nominal) to 4 (Emergency).
 * 4. Applies the stacking rule: two or more Tier 1 flags at once make Tier 2.
 * The highest tier wins. The alerts and the AI doctor both read the result, so they always agree.
 *
 * Not checked yet, because we have no data for them: body temperature, consciousness,
 * cabin CO2 and symptoms (except what the astronaut types to the AI doctor, see symptomTier).
 * Prototype with simulated data. Not a medical device.
 */
(function () {
  // The five tiers, from Mariam's "Tiers" sheet. `level` is the colour/status the app uses:
  // good = Steady, watch = Watch (ember outline), act = Alert (solid ember).
  const TIERS = [
    { n: 0, name: "Nominal", level: "good", doctor: "Log only", notify: "Nobody" },
    { n: 1, name: "Watch", level: "watch", doctor: "Trend note and self-care suggestion", notify: "You, in the app" },
    { n: 2, name: "Caution", level: "watch", doctor: "Follow-up questions; recheck in 30-60 min", notify: "You and your flight surgeon (in the daily summary, not urgent)" },
    { n: 3, name: "Urgent", level: "act", doctor: "Check the sensor, walk through the protocol, ask for a live call with the flight surgeon (within 1 hour)", notify: "You and your flight surgeon (paged now)" },
    { n: 4, name: "Emergency", level: "act", doctor: "Emergency checklist; alert crew and ground immediately", notify: "Crew, flight surgeon and mission control" },
  ];

  /* ---------- NEWS2 points for one reading (0 = normal, 3 = furthest out) ---------- */
  // Bands from Mariam's sheet (NEWS2, Royal College of Physicians; she read them through
  // secondary copies of the chart, so they still need checking against the original).
  // NEWS2 counts whole numbers, so readings are rounded first.
  const NEWS2 = {
    resp_rate: { name: "Breathing rate", unit: "breaths/min", points: (v) => (v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3) },
    spo2: { name: "Blood oxygen", unit: "%", points: (v) => (v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0) },
    resting_hr: { name: "Pulse", unit: "bpm", points: (v) => (v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3) },
    systolic: { name: "Systolic blood pressure", unit: "mmHg", points: (v) => (v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : 0) },
  };

  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const r1 = (x) => Math.round(x * 10) / 10;

  /*
   * days:     the daily summaries from data.js (oldest first; the last one is today)
   * baseline: the astronaut's normal for each metric (data.js works it out)
   * extra:    { bp: { systolic, diastolic, sample } } = the latest typed-in blood pressure
   * Returns { tier, flags, news2 }.
   */
  function assess(days, baseline, extra) {
    const today = days[days.length - 1];
    const yesterday = days[days.length - 2];
    const flags = [];
    const flag = (tier, f) => flags.push({ tier, ...f });

    // 1. NEWS2: each reading on its own, then the total.
    const vitals = { resp_rate: today.resp_rate, spo2: today.spo2, resting_hr: today.resting_hr };
    if (extra.bp) vitals.systolic = extra.bp.systolic;
    let total = 0;
    const parts = [];
    for (const [key, raw] of Object.entries(vitals)) {
      if (raw == null) continue;
      const v = Math.round(raw);
      const pts = NEWS2[key].points(v);
      total += pts;
      parts.push({ key, name: NEWS2[key].name, value: v, points: pts });
      if (pts > 0) {
        flag(pts, { // 1 point = Tier 1, 2 = Tier 2, 3 = Tier 3
          rule: `${NEWS2[key].name} scores ${pts} on NEWS2`, status: "Published",
          detail: `${NEWS2[key].name} ${v} ${NEWS2[key].unit}.`, metric: key, cat: "heart",
        });
      }
    }
    const totalTier = total >= 7 ? 4 : total >= 5 ? 3 : total >= 3 ? 2 : total >= 1 ? 1 : 0;
    // Only add the total as its own flag when it says more than the single readings did.
    if (totalTier > Math.max(0, ...flags.map((f) => f.tier))) {
      flag(totalTier, {
        rule: `NEWS2 total of ${total} (from ${parts.length} of its 7 readings)`, status: totalTier >= 3 ? "Published" : "Design",
        detail: parts.filter((p) => p.points).map((p) => `${p.name} ${p.value}`).join(", ") + ".", metric: "news2", cat: "heart",
      });
    }

    // 2. Blood pressure categories (AHA). Uses the latest typed-in reading.
    if (extra.bp) {
      const { systolic: s, diastolic: d } = extra.bp;
      if (s > 180 || d > 120) flag(3, { rule: "Severe high blood pressure", status: "Published", detail: `${s}/${d} mmHg.`, metric: "bp", cat: "heart" });
      else if (s >= 140 || d >= 90) flag(2, { rule: "Blood pressure 140/90 or above", status: "Adapted", detail: `${s}/${d} mmHg. Needs confirming with repeat readings.`, metric: "bp", cat: "heart" });
      else if (s >= 130) flag(1, { rule: "Systolic blood pressure 130-139", status: "Adapted", detail: `${s}/${d} mmHg. Counts when readings stay there.`, metric: "bp", cat: "heart" });
    }

    // 3. Against the astronaut's own normal (all Design rules).
    const rhrUp = today.resting_hr - baseline.resting_hr.mean;
    if (rhrUp >= 10) {
      flag(1, {
        rule: "Resting heart rate 10 or more bpm above your normal", status: "Design",
        detail: `Resting heart rate ${today.resting_hr} bpm, ${r1(rhrUp)} above your usual ${Math.round(baseline.resting_hr.mean)}.`,
        metric: "resting_hr", cat: "heart", source: "watch-01",
      });
    }
    const last14 = days.slice(-15, -1).map((d) => d.sleep_hours); // the 14 nights before last night
    const sleepAvg = mean(last14);
    if (sleepAvg - today.sleep_hours >= 1) {
      flag(1, {
        rule: "Sleep 1 h or more below your 14-night average", status: "Design",
        detail: `Slept ${today.sleep_hours} h last night; your 14-night average is ${r1(sleepAvg)} h.`,
        metric: "sleep_hours", cat: "sleep", source: "band-01",
      });
    }
    const nights = days.slice(-3).map((d) => d.sleep_hours);
    if (nights[0] > nights[1] && nights[1] > nights[2] && nights[2] < sleepAvg) {
      flag(2, {
        rule: "Sleep going down over several nights", status: "Design",
        detail: `Slept ${nights.join(" h, ")} h over the last three nights.`,
        metric: "sleep_trend", cat: "sleep", source: "band-01",
      });
    }
    const low3 = days.slice(-3).every((d) => d.recovery < 50);
    const drop = yesterday.recovery - today.recovery;
    if (low3 || drop >= 25) {
      flag(2, {
        rule: low3 ? "Recovery below 50 for 3 days" : "Recovery dropped 25 or more points in a day", status: "Design",
        detail: `Recovery ${yesterday.recovery}% yesterday, ${today.recovery}% today.`, metric: "recovery", cat: "heart",
      });
    } else if (today.recovery < 50) {
      flag(1, {
        rule: "Recovery below 50", status: "Design",
        detail: `Recovery is ${today.recovery}% today (${yesterday.recovery}% yesterday).`, metric: "recovery", cat: "heart",
      });
    }

    // 4. Stacking: two or more Tier 1 flags at the same time make Tier 2.
    const tier1 = flags.filter((f) => f.tier === 1);
    const stacked = tier1.length >= 2;

    const tier = Math.max(0, stacked ? 2 : 0, ...flags.map((f) => f.tier));
    return { tier, flags, stacked, tier1, news2: { total, parts, missing: ["temperature", "consciousness", "oxygen therapy"] } };
  }

  // What the astronaut types to the AI doctor. Mariam's symptom overrides (Tier 4) and
  // "a new mild symptom" (Tier 2). Returns null if no symptom words are found.
  const EMERGENCY = ["chest pain", "can't breathe", "cannot breathe", "short of breath", "shortness of breath", "fainted", "fainting", "passed out",
    "stroke", "face drooping", "slurred", "can't speak", "worst headache", "sudden severe headache", "lost vision", "vision loss", "confused", "confusion"];
  const MILD = ["headache", "dizzy", "nausea", "nauseous", "sore throat", "fever", "cough", "blurry", "blurred"];
  function symptomTier(text) {
    const q = text.toLowerCase();
    const hit = EMERGENCY.find((w) => q.includes(w));
    if (hit) return { tier: 4, symptom: hit };
    const mild = MILD.find((w) => q.includes(w));
    if (mild) return { tier: 2, symptom: mild };
    return null;
  }

  window.ESCALATION = { TIERS, assess, symptomTier };
})();

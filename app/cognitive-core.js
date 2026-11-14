/*
 * Cognitive tests: the rules, with no drawing code (the Train page is drawn by cognitive.js).
 * Kept apart so the numbers can be tested on their own: in a terminal, `node` can load this file.
 *
 * What lives here, in plain English:
 *   TESTS       the four short tests (reaction time, sequence memory, number memory, number order)
 *   streakInfo  the daily check-in streak, with one "shield" that forgives a single missed day
 *   xpTotal /   points and levels. Nothing is stored twice: points are worked out from the
 *   levelFor    saved check-ins and results every time, so they can never drift out of step.
 *   trend       each person's own "normal" per test, and Steady / Watch / Alert against it
 *   BADGES      the unlockable badges
 *   makeSample  made-up history so the demo has something to show on day one
 *
 * PLACEHOLDERS: the Watch / Alert cut-offs (15% and 30% worse than your own normal) and the
 * point values are first guesses for the demo. The health-logic owner should set the real ones.
 * These tests are a self-check, not a diagnosis.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SIRIUS_COG_CORE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- The tests ---------- */
  // better: which direction is an improvement. unit/format are only for showing the score.
  const TESTS = [
    {
      id: "reaction", name: "Reaction time", icon: "zap", domain: "Alertness", better: "lower",
      blurb: "Tap the moment the screen changes. Five rounds; the middle time counts.",
      likeNasa: "Like the Psychomotor Vigilance Test used on the ISS.",
      format: (s) => s + " ms",
    },
    {
      id: "sequence", name: "Sequence memory", icon: "grid-3x3", domain: "Spatial memory", better: "higher",
      blurb: "Watch the squares light up, then repeat the pattern. It grows by one each level.",
      format: (s) => "Level " + s,
    },
    {
      id: "digits", name: "Number memory", icon: "hash", domain: "Working memory", better: "higher",
      blurb: "Remember a number, then type it back. It gets one digit longer each level.",
      format: (s) => s + (s === 1 ? " digit" : " digits"),
    },
    {
      id: "order", name: "Number order", icon: "eye", domain: "Visual memory", better: "higher",
      blurb: "Numbers flash on a grid. Tap them in order after they disappear. Three strikes.",
      format: (s) => s + (s === 1 ? " number" : " numbers"),
    },
  ];
  const TEST_BY_ID = Object.fromEntries(TESTS.map((t) => [t.id, t]));

  /* ---------- Placeholder numbers (see the note at the top) ---------- */
  const WATCH_AT = 0.15;   // this much worse than your own normal = Watch
  const ALERT_AT = 0.30;   // this much worse = Alert
  const RECENT_N = 3;      // "how you are doing now" = the middle of your last 3 results
  const BASE_N = 10;       // "your normal" = the middle of the 10 results before those
  const BASE_MIN = 3;      // fewest earlier results needed before we judge anything
  const SHIELD_EVERY = 7;  // a streak shield is earned at every 7th day in a row
  const MISSION_NEED = 3;  // daily mission: this many different tests in one day
  const XP = { checkin: 10, test: 30, personalBest: 20, mission: 40 };

  /* ---------- Dates ---------- */
  const pad = (n) => (n < 10 ? "0" : "") + n;
  // A day is written "2026-11-14" in the astronaut's own (local) time.
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dayNum(key) { const p = key.split("-").map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function addDays(key, n) { const t = new Date((dayNum(key) + n) * 86400000); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); }
  // A time stamp in local time with no zone, e.g. "2026-11-14T08:05:00". Sorts correctly as text.
  function stamp(d) { d = d || new Date(); return dayKey(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }

  function median(list) {
    if (!list.length) return null;
    const s = list.slice().sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  const reactionScore = (times) => Math.round(median(times));

  /* ---------- The store: everything saved for one astronaut ---------- */
  //   visits        days the app was really opened ("2026-11-14")
  //   sampleVisits  made-up days, so the demo opens with a streak (removed by clearSample)
  //   results       [{ t, day, test, score, xp, pb, sample? }]
  function newStore() { return { v: 1, visits: [], sampleVisits: [], results: [] }; }
  function normalize(obj) {
    const s = newStore();
    if (!obj || typeof obj !== "object") return s;
    if (Array.isArray(obj.visits)) s.visits = obj.visits.filter((x) => typeof x === "string");
    if (Array.isArray(obj.sampleVisits)) s.sampleVisits = obj.sampleVisits.filter((x) => typeof x === "string");
    if (Array.isArray(obj.results)) s.results = obj.results.filter((r) => r && TEST_BY_ID[r.test] && isFinite(r.score) && typeof r.t === "string");
    return s;
  }
  const allVisits = (store) => Array.from(new Set(store.visits.concat(store.sampleVisits))).sort();
  const hasSample = (store) => store.sampleVisits.length > 0 || store.results.some((r) => r.sample);
  function clearSample(store) {
    store.sampleVisits = [];
    store.results = store.results.filter((r) => !r.sample);
    return store;
  }

  function recordVisit(store, today) {
    if (store.visits.includes(today)) return { isNew: false };
    const before = streakInfo(allVisits(store), today);
    store.visits.push(today);
    store.visits.sort();
    const after = streakInfo(allVisits(store), today);
    return { isNew: true, before, after };
  }

  // Adds one finished test. `at` is a Date (or a ready-made stamp for sample data).
  // Returns the saved result, including the points it earned and whether it was a personal best.
  function addResult(store, test, score, at, opts) {
    const t = typeof at === "string" ? at : stamp(at);
    const earlier = store.results.filter((r) => r.test === test);
    const meta = TEST_BY_ID[test];
    let pb = false;
    if (earlier.length) {
      const best = meta.better === "lower" ? Math.min.apply(null, earlier.map((r) => r.score)) : Math.max.apply(null, earlier.map((r) => r.score));
      pb = meta.better === "lower" ? score < best : score > best;
    }
    const r = { t, day: t.slice(0, 10), test, score, xp: XP.test + (pb ? XP.personalBest : 0), pb };
    if (opts && opts.sample) r.sample = true;
    store.results.push(r);
    store.results.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
    return r;
  }

  /* ---------- Daily check-in streak ---------- */
  // Walks through every day the app was opened. A single missed day is forgiven if a shield is
  // held; a shield is earned at every 7th day in a row (you can hold one at a time).
  function streakInfo(visitDays, today) {
    const days = Array.from(new Set(visitDays)).sort();
    let streak = 0, best = 0, shield = 0, used = 0, last = null;
    for (const d of days) {
      if (last === null) streak = 1;
      else {
        const gap = dayNum(d) - dayNum(last);
        if (gap <= 1) streak += 1;
        else if (gap === 2 && shield > 0) { shield -= 1; used += 1; streak += 1; }
        else streak = 1;
      }
      if (streak % SHIELD_EVERY === 0 && shield < 1) shield = 1;
      if (streak > best) best = streak;
      last = d;
    }
    // Is it still going today?  done: already checked in today.  open: check in today to keep it.
    // shield: yesterday was missed but a shield will cover it.  broken: too long ago.
    let current = 0, state = "none";
    if (last !== null) {
      const gap = dayNum(today) - dayNum(last);
      if (gap <= 0) { current = streak; state = "done"; }
      else if (gap === 1) { current = streak; state = "open"; }
      else if (gap === 2 && shield > 0) { current = streak; state = "shield"; }
      else state = "broken";
    }
    return { current, best, shield, shieldsUsed: used, last, state };
  }
  // Seven small ticks for the week strip: which of the last 7 days were checked in.
  function weekStrip(visitDays, today) {
    const set = new Set(visitDays);
    const out = [];
    for (let i = 6; i >= 0; i--) { const k = addDays(today, -i); out.push({ day: k, on: set.has(k), today: i === 0 }); }
    return out;
  }

  /* ---------- Points, levels, daily mission ---------- */
  function missionDays(results) {
    const byDay = {};
    results.forEach((r) => { (byDay[r.day] = byDay[r.day] || new Set()).add(r.test); });
    return Object.keys(byDay).filter((d) => byDay[d].size >= MISSION_NEED);
  }
  function xpTotal(store) {
    return allVisits(store).length * XP.checkin +
      store.results.reduce((s, r) => s + (r.xp || 0), 0) +
      missionDays(store.results).length * XP.mission;
  }
  // Level L starts at 100 * L * (L - 1) points: 0, 200, 600, 1200, 2000, ...
  const LEVEL_NAMES = ["Candidate", "Cadet", "Crew", "Specialist", "Navigator", "Pilot", "Flight lead", "Commander"];
  function levelFor(xp) {
    const L = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 100)) / 2);
    const lo = 100 * L * (L - 1), hi = 100 * (L + 1) * L;
    return { level: L, name: LEVEL_NAMES[Math.min(L - 1, LEVEL_NAMES.length - 1)], xp, into: xp - lo, span: hi - lo, toNext: hi - xp };
  }

  /* ---------- Your own normal ---------- */
  // Compares how you are doing now (middle of the last 3) with your normal (middle of the 10
  // before those). state: none | learning | good | watch | act  (good = Steady).
  function trend(testId, results) {
    const meta = TEST_BY_ID[testId];
    const list = results.filter((r) => r.test === testId).sort((a, b) => (a.t < b.t ? -1 : 1)).map((r) => r.score);
    if (!list.length) return { n: 0, state: "none" };
    const recent = list.slice(-RECENT_N);
    const before = list.slice(0, list.length - recent.length).slice(-BASE_N);
    const out = { n: list.length, latest: list[list.length - 1] };
    if (before.length < BASE_MIN) return Object.assign(out, { state: "learning", needed: RECENT_N + BASE_MIN - list.length });
    const base = median(before), rec = median(recent);
    const worse = (meta.better === "lower" ? rec - base : base - rec) / Math.max(base, 1);
    return Object.assign(out, {
      base, recent: rec, worse, pct: Math.round(Math.abs(worse) * 100),
      state: worse >= ALERT_AT ? "act" : worse >= WATCH_AT ? "watch" : "good",
    });
  }
  // One new score against your normal (used on the result screen). Null until there is a normal.
  function compareToNormal(testId, score, earlierResults) {
    const meta = TEST_BY_ID[testId];
    const list = earlierResults.filter((r) => r.test === testId).map((r) => r.score).slice(-BASE_N);
    if (list.length < BASE_MIN) return null;
    const base = median(list);
    const worse = (meta.better === "lower" ? score - base : base - score) / Math.max(base, 1);
    return { base, worse, pct: Math.round(Math.abs(worse) * 100) };
  }
  function bestOf(testId, results) {
    const meta = TEST_BY_ID[testId];
    const list = results.filter((r) => r.test === testId).map((r) => r.score);
    if (!list.length) return null;
    return meta.better === "lower" ? Math.min.apply(null, list) : Math.max.apply(null, list);
  }

  /* ---------- Badges ---------- */
  const ctxBest = (c, id) => bestOf(id, c.results);
  const BADGES = [
    { id: "first-flight", name: "First flight", icon: "rocket", how: "Finish your first test", earned: (c) => c.results.length >= 1 },
    { id: "steady-week", name: "Steady week", icon: "calendar-days", how: "Check in 7 days in a row", earned: (c) => c.streak.best >= 7 },
    { id: "month-in-orbit", name: "Month in orbit", icon: "orbit", how: "Check in 30 days in a row", earned: (c) => c.streak.best >= 30 },
    { id: "full-battery", name: "Full battery", icon: "battery", how: "Do all four tests in one day", earned: (c) => allFourDays(c.results) },
    { id: "quick-draw", name: "Quick draw", icon: "zap", how: "Reaction time of 250 ms or faster", earned: (c) => ctxBest(c, "reaction") !== null && ctxBest(c, "reaction") <= 250 },
    { id: "spatial-sense", name: "Spatial sense", icon: "grid-3x3", how: "Reach level 9 in Sequence memory", earned: (c) => (ctxBest(c, "sequence") || 0) >= 9 },
    { id: "long-memory", name: "Long memory", icon: "hash", how: "Remember 10 digits", earned: (c) => (ctxBest(c, "digits") || 0) >= 10 },
    { id: "order-keeper", name: "Order keeper", icon: "eye", how: "Clear 9 numbers in Number order", earned: (c) => (ctxBest(c, "order") || 0) >= 9 },
    { id: "navigator", name: "Navigator", icon: "trophy", how: "Reach level 5", earned: (c) => c.level >= 5 },
  ];
  function allFourDays(results) {
    const byDay = {};
    results.forEach((r) => { (byDay[r.day] = byDay[r.day] || new Set()).add(r.test); });
    return Object.keys(byDay).some((d) => byDay[d].size >= TESTS.length);
  }
  function earnedBadgeIds(store, today) {
    const streak = streakInfo(allVisits(store), today);
    const ctx = { results: store.results, streak, level: levelFor(xpTotal(store)).level };
    return BADGES.filter((b) => b.earned(ctx)).map((b) => b.id);
  }

  /* ---------- Everything the Train page needs, in one object ---------- */
  function summary(store, today) {
    const visits = allVisits(store);
    const streak = streakInfo(visits, today);
    const xp = levelFor(xpTotal(store));
    const todays = new Set(store.results.filter((r) => r.day === today).map((r) => r.test));
    const earned = new Set(earnedBadgeIds(store, today));
    return {
      today, streak, xp, week: weekStrip(visits, today),
      mission: { done: Math.min(todays.size, MISSION_NEED), need: MISSION_NEED, complete: todays.size >= MISSION_NEED, bonus: XP.mission },
      tests: TESTS.map((t) => ({
        test: t, trend: trend(t.id, store.results), best: bestOf(t.id, store.results),
        doneToday: todays.has(t.id), history: store.results.filter((r) => r.test === t.id).slice(-14).map((r) => r.score),
      })),
      badges: BADGES.map((b) => ({ id: b.id, name: b.name, icon: b.icon, how: b.how, earned: earned.has(b.id) })),
      sample: hasSample(store),
    };
  }

  /* ---------- Small rules the games use ---------- */
  function makeRng(seed) { // small, repeatable random numbers (mulberry32)
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A number of n digits that does not start with 0, as text.
  function makeDigits(n, rand) {
    let s = String(1 + Math.floor(rand() * 9));
    for (let i = 1; i < n; i++) s += Math.floor(rand() * 10);
    return s;
  }
  // n different squares out of `cells`, as a list: item 0 is where "1" goes, item 1 is "2", ...
  function placeNumbers(n, cells, rand) {
    const pool = Array.from({ length: cells }, (_, i) => i);
    for (let i = 0; i < n; i++) { const j = i + Math.floor(rand() * (cells - i)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    return pool.slice(0, n);
  }

  /* ---------- Made-up history for the demo ---------- */
  // Each crew member gets a streak ending yesterday (so opening the app today adds a day) and a
  // few weeks of results. Two have a little story that matches the main dashboard:
  //   crew-01 (running on too little rest): reaction time and sequence memory dip in the last days
  //   crew-02 (homesick):                   number memory dips over the last week
  const SAMPLE_PROFILES = {
    "crew-01": { run: 12, seed: 101, norm: { reaction: 262, sequence: 7, digits: 8, order: 8 }, focus: ["reaction", "sequence"] },
    "crew-02": { run: 9,  seed: 202, norm: { reaction: 255, sequence: 8, digits: 8, order: 9 }, focus: ["digits", "order"] },
    "crew-03": { run: 20, seed: 303, norm: { reaction: 248, sequence: 9, digits: 9, order: 9 } },
    "crew-04": { run: 3,  seed: 404, norm: { reaction: 270, sequence: 7, digits: 7, order: 8 } },
    "crew-05": { run: 8,  seed: 505, norm: { reaction: 258, sequence: 8, digits: 8, order: 8 } },
    "crew-06": { run: 15, seed: 611, norm: { reaction: 266, sequence: 7, digits: 9, order: 7 } },
  };
  // fromEnd 1 = yesterday. Returns how the story changes the score on that day.
  function storyEffect(crewId, test, fromEnd) {
    if (crewId === "crew-01") {
      if (test === "reaction" && fromEnd <= 4) return { mult: [1, 1.1, 1.18, 1.24, 1.30][5 - fromEnd] || 1 };
      if (test === "sequence" && fromEnd <= 3) return { add: -2 };
    }
    if (crewId === "crew-02" && test === "digits" && fromEnd <= 7) return { add: -2 };
    return {};
  }
  function makeSample(crewId, today) {
    const prof = SAMPLE_PROFILES[crewId] || SAMPLE_PROFILES["crew-03"];
    const rand = makeRng(prof.seed);
    const store = newStore();
    const run = prof.run;
    // a short block of days before a missed day (too short to earn a shield), then the current run
    const days = [];
    for (let i = run + 7; i >= run + 2; i--) days.push(-i);
    for (let i = run; i >= 1; i--) days.push(-i);
    days.forEach((off, idx) => {
      const day = addDays(today, off);
      store.sampleVisits.push(day);
      // two tests a day, rotating, plus the crew member's "story" tests every day
      let tests = [TESTS[idx % 4].id, TESTS[(idx + 1) % 4].id];
      if (prof.focus) tests = Array.from(new Set(prof.focus.concat(tests))).slice(0, 3);
      tests.forEach((id, k) => {
        let score;
        const norm = prof.norm[id];
        const jitter = (rand() + rand() + rand() - 1.5) / 1.5; // about -1 to 1
        if (id === "reaction") score = Math.round(norm * (1 + jitter * 0.06));
        else score = Math.round(norm + jitter * 1.4);
        const fx = storyEffect(crewId, id, -off);
        if (fx.mult) score = Math.round(score * fx.mult);
        if (fx.add) score += fx.add;
        score = id === "reaction" ? Math.max(score, 170) : Math.max(score, id === "sequence" ? 3 : 4);
        addResult(store, id, score, day + "T08:" + pad(10 + k * 7) + ":00", { sample: true });
      });
    });
    return store;
  }

  return {
    TESTS, TEST_BY_ID, BADGES, XP, WATCH_AT, ALERT_AT, MISSION_NEED,
    dayKey, dayNum, addDays, stamp, median, reactionScore,
    newStore, normalize, allVisits, hasSample, clearSample, recordVisit, addResult,
    streakInfo, weekStrip, missionDays, xpTotal, levelFor, trend, compareToNormal, bestOf,
    earnedBadgeIds, summary, makeRng, makeDigits, placeNumbers, makeSample,
  };
});

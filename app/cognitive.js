/*
 * Train page (#train): four short cognitive tests, a daily check-in streak, points, levels and
 * badges. The rules live in cognitive-core.js; this file draws the page and runs the games.
 *
 * In plain English:
 *   - Opening the app counts as that day's check-in (the streak). Nothing to press.
 *   - Each test saves its score for the astronaut who is selected (SIRIUS_CREW.current).
 *   - Results are kept in this browser only (localStorage, one saved record per astronaut).
 *     A new browser starts with made-up history, tagged "Sample data", so the demo has a
 *     streak and trends to show. "Clear sample history" removes it.
 *   - Address bar option: ?cog=reset throws away this astronaut's saved Train data and starts
 *     from the made-up history again (handy before a demo).
 *
 * Nothing here is a diagnosis. The Steady / Watch / Alert words compare a person with their own
 * recent normal, using placeholder cut-offs (see cognitive-core.js).
 */
window.HEALTH_READY.then(function () {
  const Core = window.SIRIUS_COG_CORE;
  const root = document.getElementById("view-train");
  if (!Core || !root) return;
  const ic = (name, cls) => window.icon(name, cls);
  const $ = (sel, el) => (el || document).querySelector(sel);
  const today = () => Core.dayKey();
  const crewId = (window.SIRIUS_CREW && window.SIRIUS_CREW.current) || "crew-01";
  const KEY = "sirius.cog.v1." + crewId;

  /* ---------- Saved data (this browser only) ---------- */
  if (/[?&]cog=reset\b/.test(location.search)) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  let memory = null; // used when the browser blocks storage, so the page still works until it is closed
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (raw) { try { return Core.normalize(JSON.parse(raw)); } catch (e) { /* damaged: start again */ } }
    return memory || Core.makeSample(crewId, today());
  }
  let store = load();
  function save() { memory = store; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }

  /* ---------- Small helpers ---------- */
  const LEVEL_ICON = { good: "circle-check", watch: "triangle-alert", act: "octagon-alert" };
  const LEVEL_WORD = { good: "Steady", watch: "Watch", act: "Alert" };
  const pill = (level) => `<span class="pill is-${level}">${ic(LEVEL_ICON[level])}${LEVEL_WORD[level]}</span>`;
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const SAMPLE_TIP = "Made-up numbers for the demo. Your own results are added to them, or use Clear sample history to start fresh.";
  const sampleTag = () => `<span class="sample-tag" title="${SAMPLE_TIP}">Sample data</span>`;
  const WORDS = { lower: ["faster", "slower"], higher: ["higher", "lower"] }; // [better, worse]

  function toast(text, icon) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.innerHTML = ic(icon || "circle-check") + text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 3200);
  }

  /* ---------- The Train page ---------- */
  function weekdayLetter(day) { return new Date(day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "narrow" }); }

  function streakStat(S) {
    const st = S.streak;
    const week = S.week.map((d) => `<span class="cog-day${d.on ? " on" : ""}${d.today ? " today" : ""}" title="${d.day}${d.on ? ": checked in" : ""}"><i></i><small>${weekdayLetter(d.day)}</small></span>`).join("");
    let sub = st.state === "done" ? "Checked in today." : st.state === "open" ? "Check in today to keep your streak." : st.state === "shield" ? "A shield will cover yesterday if you check in today." : "Open the app each day to build a streak.";
    sub += ` Best: ${plural(st.best, "day", "days")}.`;
    if (st.shield) sub += ` <span title="You earn a shield at every 7th day in a row. It forgives one missed day.">${ic("shield-check")}Shield ready</span>`;
    return `<section class="cog-stat" aria-label="Daily check-in streak">
      <p class="label">Daily check-in</p>
      <p class="cog-big">${ic("flame")}<b>${st.current}</b><span>${st.current === 1 ? "day" : "days"}</span></p>
      <div class="cog-week" role="img" aria-label="Last seven days">${week}</div>
      <p class="cog-sub">${sub}</p></section>`;
  }
  function levelStat(S) {
    const x = S.xp;
    return `<section class="cog-stat" aria-label="Level">
      <p class="label">Level</p>
      <p class="cog-big"><b>${x.level}</b><span>${x.name}</span></p>
      <div class="cog-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${x.span}" aria-valuenow="${x.into}"><span style="width:${Math.round((x.into / x.span) * 100)}%"></span></div>
      <p class="cog-sub">${x.xp.toLocaleString("en-GB")} points. ${x.toNext.toLocaleString("en-GB")} to level ${x.level + 1}.</p></section>`;
  }
  function missionStat(S) {
    const m = S.mission;
    const segs = Array.from({ length: m.need }, (_, i) => `<i class="${i < m.done ? "on" : ""}"></i>`).join("");
    const sub = m.complete ? `Mission complete. +${m.bonus} points earned today.` : `Finish ${m.need} different tests today for +${m.bonus} points.`;
    return `<section class="cog-stat" aria-label="Today's mission">
      <p class="label">Today's mission</p>
      <p class="cog-big"><b>${m.done}</b><span>of ${m.need} tests</span></p>
      <div class="cog-segs" role="img" aria-label="${m.done} of ${m.need} done">${segs}</div>
      <p class="cog-sub">${sub}</p></section>`;
  }

  function spark(vals, base, level) {
    if (vals.length < 2) return "";
    const w = 112, h = 30, p = 3;
    const all = base != null ? vals.concat([base]) : vals;
    let lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (hi === lo) { hi += 1; lo -= 1; }
    const x = (i) => p + (i * (w - 2 * p)) / (vals.length - 1);
    const y = (v) => h - p - ((v - lo) / (hi - lo)) * (h - 2 * p);
    const pts = vals.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
    const last = vals.length - 1;
    return `<svg class="cog-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Your last ${vals.length} results">` +
      (base != null ? `<line class="cog-spark-base" x1="${p}" x2="${w - p}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}"/>` : "") +
      `<polyline class="cog-spark-line" points="${pts}"/>` +
      `<circle class="${level === "watch" || level === "act" ? "is-ember" : ""}" cx="${x(last).toFixed(1)}" cy="${y(vals[last]).toFixed(1)}" r="2.6"/></svg>`;
  }

  function trendLine(row) {
    const t = row.trend, meta = row.test;
    if (t.state === "none") return "Not tried yet. Your normal builds after a few tests.";
    if (t.state === "learning") return `Learning your normal: ${plural(t.needed, "more test", "more tests")} to go.`;
    const w = WORDS[meta.better];
    if (t.pct === 0) return `Recent tests are right at your normal (${meta.format(Math.round(t.base))}).`;
    return `Recent tests are ${t.pct}% ${t.worse > 0 ? w[1] : w[0]} than your normal (${meta.format(Math.round(t.base))}).`;
  }

  function testTile(row) {
    const meta = row.test, t = row.trend;
    const level = ["good", "watch", "act"].includes(t.state) ? t.state : null;
    return `<article class="card cog-test" data-test="${meta.id}">
      <header><span class="cog-ico">${ic(meta.icon)}</span>
        <div><h3>${meta.name}</h3><p class="label">${meta.domain}</p></div>${level ? pill(level) : ""}</header>
      <p class="cog-blurb">${meta.blurb}</p>
      <div class="cog-score">${t.n ? `<b>${meta.format(t.latest)}</b>` : `<span class="dim">No score yet</span>`}${spark(row.history, t.base, level)}</div>
      <p class="cog-line">${trendLine(row)}</p>
      <footer><button type="button" class="${row.doneToday ? "btn-ghost" : "btn-primary"} small" data-start="${meta.id}">${row.doneToday ? "Again" : "Start"}</button>
        ${row.doneToday ? `<span class="cog-done">${ic("check")}Done today</span>` : ""}
        ${row.best != null ? `<span class="cog-best">BEST ${meta.format(row.best)}</span>` : ""}</footer></article>`;
  }

  function badgeItem(b) {
    return `<li class="cog-badge ${b.earned ? "on" : "off"}"><span class="cog-badge-ico">${ic(b.earned ? b.icon : "lock")}</span>
      <div><b>${b.name}</b><small>${b.earned ? "Earned" : b.how}</small></div></li>`;
  }

  function render() {
    const S = Core.summary(store, today());
    const earned = S.badges.filter((b) => b.earned).length;
    root.innerHTML = `
      <div class="view-head">
        <div><h2 class="view-title">${ic("brain")}Train</h2>
          <p class="view-sub">Short tests of alertness and memory. You are compared with your own normal, nobody else.</p></div>
        ${S.sample ? `<button type="button" class="btn-ghost small" data-clear>Clear sample history</button>` : ""}
      </div>
      <div class="cog-stats">${streakStat(S)}${levelStat(S)}${missionStat(S)}</div>
      <section class="panel" aria-label="Tests">
        <div class="panel-head"><h2>${ic("gauge")}Tests</h2>${S.sample ? sampleTag() : ""}</div>
        <div class="cog-tests">${S.tests.map(testTile).join("")}</div>
      </section>
      <section class="panel" aria-label="Badges">
        <div class="panel-head"><h2>${ic("award")}Badges</h2><span class="spacer"></span><span class="cog-count">${earned} OF ${S.badges.length}</span></div>
        <ul class="cog-badges">${S.badges.map(badgeItem).join("")}</ul>
      </section>
      <p class="cog-note">${ic("info")}<span>These are quick self-checks, not a medical test. One bad day says little; a dip that lasts several days is what is worth noticing. Results stay in this browser.</span></p>`;
    updateChip(S);
    return S;
  }

  root.addEventListener("click", (e) => {
    const start = e.target.closest("[data-start]");
    if (start) return openStage(start.dataset.start, start);
    if (e.target.closest("[data-clear]")) { Core.clearSample(store); save(); render(); toast("Sample history cleared", "check"); }
  });

  /* ---------- Streak chip in the top bar ---------- */
  const chip = document.createElement("a");
  chip.className = "cog-chip";
  chip.href = "#train";
  const bar = $(".topbar-right");
  if (bar) bar.insertBefore(chip, bar.firstChild);
  function updateChip(S) {
    const n = S.streak.current;
    chip.innerHTML = ic("flame") + "<b>" + n + "</b>";
    chip.classList.toggle("is-risk", S.streak.state === "open" || S.streak.state === "shield");
    chip.title = "Daily check-in streak: " + plural(n, "day", "days") + ". Open Train.";
    chip.setAttribute("aria-label", chip.title);
  }

  /* ---------- The test area (full screen) ---------- */
  let stage = null, stopGame = null, opener = null, finished = false;

  function closeStage() {
    if (stopGame) { stopGame(); stopGame = null; }
    if (!stage) return;
    stage.remove(); stage = null;
    document.body.classList.remove("cog-lock");
    const app = $(".app"); if (app) app.inert = false;
    document.removeEventListener("keydown", onStageKey);
    if (opener && document.contains(opener)) opener.focus();
    else { const again = root.querySelector("[data-start]"); if (again) again.focus(); }
  }
  function onStageKey(e) { if (e.key === "Escape") { e.preventDefault(); closeStage(); } }

  function openStage(testId, from) {
    if (stage) closeStage();
    opener = from || null;
    const meta = Core.TEST_BY_ID[testId];
    stage = document.createElement("div");
    stage.className = "cog-stage";
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-modal", "true");
    stage.setAttribute("aria-label", meta.name);
    stage.innerHTML = `<div class="cog-stage-bar"><span class="cog-stage-title">${ic(meta.icon)}${meta.name}</span>
      <button type="button" class="btn-ghost small" data-quit>${ic("x")}Quit</button></div><div class="cog-stage-body" id="cog-play" tabindex="-1"></div>`;
    document.body.appendChild(stage);
    document.body.classList.add("cog-lock");
    const note = document.getElementById("toast"); if (note) note.hidden = true; // keep the screen clear during a test
    const app = $(".app"); if (app) app.inert = true;
    document.addEventListener("keydown", onStageKey);
    stage.addEventListener("click", (e) => { if (e.target.closest("[data-quit]")) closeStage(); });
    intro(testId);
  }

  function intro(testId) {
    const meta = Core.TEST_BY_ID[testId], body = $("#cog-play", stage);
    if (stopGame) { stopGame(); stopGame = null; }
    body.innerHTML = `<div class="cog-intro"><span class="cog-ico">${ic(meta.icon)}</span><h3>${meta.name}</h3>
      <p>${meta.blurb}</p>${meta.likeNasa ? `<p>${meta.likeNasa}</p>` : ""}
      <button type="button" class="btn-primary" data-go>Start</button></div>`;
    const go = $("[data-go]", body);
    go.addEventListener("click", () => {
      finished = false;
      body.innerHTML = "";
      stopGame = GAMES[testId](body, (score, detail) => { if (!finished) { finished = true; finish(testId, score, detail); } });
    });
    go.focus();
  }

  /* ---------- What happens when a test ends ---------- */
  function finish(testId, score, detail) {
    const meta = Core.TEST_BY_ID[testId];
    const before = { results: store.results.slice(), xp: Core.xpTotal(store), badges: new Set(Core.earnedBadgeIds(store, today())) };
    const cmp = Core.compareToNormal(testId, score, before.results);
    const r = Core.addResult(store, testId, score, new Date());
    save();
    const S = render();
    const lvlBefore = Core.levelFor(before.xp).level;
    const missionBonus = Core.xpTotal(store) - before.xp - r.xp;
    const newBadges = S.badges.filter((b) => b.earned && !before.badges.has(b.id));

    let line;
    if (!cmp) line = `${ic("info")}<span>Your normal builds after a few results.</span>`;
    else if (cmp.pct === 0) line = `${ic("circle-check")}<span>Right at your normal (${meta.format(Math.round(cmp.base))}).</span>`;
    else {
      const w = WORDS[meta.better];
      line = `${ic(cmp.worse > 0 ? "triangle-alert" : "circle-check")}<span>${cmp.pct}% ${cmp.worse > 0 ? w[1] : w[0]} than your normal (${meta.format(Math.round(cmp.base))}).</span>`;
    }
    const gains = [`<li>${ic("plus")}${r.xp} points</li>`];
    if (r.pb) gains.push(`<li>${ic("trophy")}Personal best</li>`);
    if (missionBonus > 0) gains.push(`<li>${ic("circle-check")}Daily mission complete, +${missionBonus}</li>`);
    if (S.xp.level > lvlBefore) gains.push(`<li>${ic("award")}Level ${S.xp.level}: ${S.xp.name}</li>`);
    newBadges.forEach((b) => gains.push(`<li>${ic(b.icon)}New badge: ${b.name}</li>`));
    const times = detail && detail.times ? `<p class="cog-times">${detail.times.map((t) => t + " ms").join("  ·  ")}</p>` : "";

    if (!stage) return;
    const body = $("#cog-play", stage);
    if (stopGame) { stopGame(); stopGame = null; }
    body.innerHTML = `<div class="cog-result"><p class="label">${meta.name}</p>
      <p class="cog-result-score">${meta.format(score)}</p>
      <p class="cog-result-line">${line}</p>
      <ul class="cog-gains">${gains.join("")}</ul>${times}
      <div class="cog-actions"><button type="button" class="btn-primary" data-again>Try again</button><button type="button" class="btn-ghost" data-quit>Done</button></div></div>`;
    $("[data-again]", body).addEventListener("click", () => intro(testId));
    $("[data-again]", body).focus();
  }

  /* ---------- The four games. Each returns a function that stops it. ---------- */
  const GAMES = {};

  // Reaction time: wait for the screen to change, then tap. Five rounds, the middle time counts.
  // Tapping too early only restarts that round.
  GAMES.reaction = function (body, done) {
    const ROUNDS = 5, MIN_REACTION = 100, times = [];
    let timer = null, state = "ready", t0 = 0;
    body.innerHTML = `<button type="button" class="cog-react" data-state="ready" aria-live="polite"><span class="cog-react-msg"></span><span class="cog-react-sub"></span></button>`;
    const el = body.firstElementChild, msg = el.children[0], sub = el.children[1];
    const set = (st, m, s) => { state = st; el.dataset.state = st; msg.textContent = m; sub.textContent = s || ""; };
    function wait() {
      set("wait", "Wait for the change", `Round ${times.length + 1} of ${ROUNDS}`);
      timer = setTimeout(() => { set("go", "Tap now", "Round " + (times.length + 1) + " of " + ROUNDS); t0 = performance.now(); }, 1500 + Math.random() * 3000);
    }
    function press(e) {
      if (e) e.preventDefault();
      if (state === "ready") return wait();
      if (state === "wait") { clearTimeout(timer); set("early", "Too soon", "Wait for the screen to change"); timer = setTimeout(wait, 1300); return; }
      if (state === "go") {
        const rt = Math.round(performance.now() - t0);
        // Nobody reacts in under 100 ms: that is a lucky guess, so it counts as too soon (as in NASA's PVT)
        if (rt < MIN_REACTION) { set("early", "Too soon", "That was a guess. Wait for the change."); timer = setTimeout(wait, 1500); return; }
        times.push(rt);
        if (times.length >= ROUNDS) { set("between", rt + " ms", ""); timer = setTimeout(() => { state = "over"; done(Core.reactionScore(times), { times }); }, 900); state = "over"; return; }
        set("between", rt + " ms", `Round ${times.length} of ${ROUNDS} done`);
        timer = setTimeout(wait, 1000);
      }
    }
    // pointerdown (not click) so a tap counts the moment it lands
    el.addEventListener("pointerdown", press);
    const key = (e) => { if (!e.repeat && (e.code === "Space" || e.key === "Enter")) press(e); };
    document.addEventListener("keydown", key);
    set("ready", "Tap or press Space to begin", `${ROUNDS} rounds`);
    el.focus();
    return () => { clearTimeout(timer); document.removeEventListener("keydown", key); };
  };

  // Sequence memory: squares light up one by one; repeat them. One more each level.
  GAMES.sequence = function (body, done) {
    const seq = [], timers = [];
    let level = 0, pos = 0, phase = "show";
    body.innerHTML = `<p class="cog-status" aria-live="polite"></p><div class="cog-seq">${Array.from({ length: 9 }, (_, i) => `<button type="button" class="cog-tile" data-i="${i}" aria-label="Square ${i + 1}"></button>`).join("")}</div>`;
    const status = $(".cog-status", body), tiles = Array.from(body.querySelectorAll(".cog-tile"));
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const flash = (i, ms) => { tiles[i].classList.add("lit"); later(() => tiles[i].classList.remove("lit"), ms); };
    function next() {
      level++; pos = 0; phase = "show";
      seq.push(Math.floor(Math.random() * 9));
      status.textContent = `Level ${level}. Watch.`;
      seq.forEach((c, i) => later(() => flash(c, 420), 700 + i * 650));
      later(() => { phase = "input"; status.textContent = "Your turn."; }, 700 + seq.length * 650);
    }
    body.addEventListener("click", (e) => {
      const b = e.target.closest(".cog-tile");
      if (!b || phase !== "input") return;
      const i = +b.dataset.i;
      flash(i, 180);
      if (i === seq[pos]) {
        pos++;
        if (pos === seq.length) { phase = "wait"; status.textContent = "Correct."; later(next, 900); }
      } else {
        phase = "over"; b.classList.add("wrong"); status.textContent = "Not quite.";
        later(() => done(level - 1, {}), 1000);
      }
    });
    next();
    return () => timers.forEach(clearTimeout);
  };

  // Number memory: a number flashes, then you type it back. One more digit each level.
  GAMES.digits = function (body, done) {
    const timers = [];
    let n = 0, answer = "";
    body.innerHTML = `<p class="cog-status" aria-live="polite"></p><div class="cog-digits"></div>
      <div class="cog-timebar" aria-hidden="true"><span></span></div>
      <form class="cog-form" hidden><label class="cog-sr" for="cog-in">Type the number</label>
        <input id="cog-in" inputmode="numeric" autocomplete="off" pattern="[0-9]*"><button type="submit" class="btn-primary">Submit</button></form>`;
    const status = $(".cog-status", body), shown = $(".cog-digits", body), fill = $(".cog-timebar span", body);
    const form = $(".cog-form", body), input = $("input", body);
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    function next() {
      n++; answer = Core.makeDigits(n, Math.random);
      form.hidden = true; input.value = ""; shown.textContent = answer;
      status.textContent = `Level ${n}. Remember this number.`;
      const ms = 900 + n * 500;
      fill.style.transition = "none"; fill.style.width = "100%"; void fill.offsetWidth;
      fill.style.transition = `width ${ms}ms linear`; fill.style.width = "0%";
      later(() => { shown.textContent = ""; form.hidden = false; status.textContent = "What was the number?"; input.focus(); }, ms);
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (form.hidden) return;
      const typed = input.value.replace(/\D/g, "");
      form.hidden = true;
      if (typed === answer) { status.textContent = "Correct."; later(next, 800); return; }
      status.textContent = "Not quite.";
      shown.textContent = "";
      const a = document.createElement("span"); a.textContent = answer;
      const s1 = document.createElement("small"); s1.textContent = "The number";
      const b = document.createElement("span"); b.className = "is-miss"; b.textContent = typed || "(nothing)";
      const s2 = document.createElement("small"); s2.textContent = "You typed";
      shown.append(s1, a, s2, b);
      later(() => done(n - 1, {}), 2200);
    });
    next();
    return () => timers.forEach(clearTimeout);
  };

  // Number order: numbers sit on a grid. Tap 1 and the rest turn blank; tap them in order.
  // Three strikes. Score = the most numbers you cleared.
  GAMES.order = function (body, done) {
    const COLS = 6, CELLS = 30, MAX = 20, timers = [];
    let n = 4, strikes = 0, best = 0, nextNum = 1, masked = false, locked = false, spots = [];
    body.innerHTML = `<p class="cog-status" aria-live="polite"></p><div class="cog-order" style="--cols:${COLS}"></div>
      <p class="cog-strikes" aria-live="polite"></p>`;
    const status = $(".cog-status", body), grid = $(".cog-order", body), strikeEl = $(".cog-strikes", body);
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const drawStrikes = () => { strikeEl.innerHTML = `Strikes ${[0, 1, 2].map((i) => `<i class="${i < strikes ? "on" : ""}"></i>`).join("")}`; strikeEl.setAttribute("aria-label", strikes + " of 3 strikes"); };
    function round() {
      spots = Core.placeNumbers(n, CELLS, Math.random);
      nextNum = 1; masked = false; locked = false;
      grid.innerHTML = Array.from({ length: CELLS }, (_, c) => {
        const k = spots.indexOf(c);
        return k < 0 ? `<button type="button" class="cog-cell gone" tabindex="-1" aria-hidden="true" disabled></button>`
          : `<button type="button" class="cog-cell" data-n="${k + 1}" aria-label="Number ${k + 1}">${k + 1}</button>`;
      }).join("");
      status.textContent = `Remember ${n} numbers. Tap 1 to start.`;
      drawStrikes();
    }
    grid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-n]");
      if (!b || locked) return;
      const num = +b.dataset.n;
      if (num === nextNum) {
        if (nextNum === 1) {
          masked = true;
          grid.querySelectorAll("[data-n]").forEach((c) => { c.classList.add("masked"); c.textContent = ""; c.setAttribute("aria-label", "Hidden square"); });
          status.textContent = "Now tap them in order.";
        }
        b.classList.add("gone"); b.disabled = true; b.tabIndex = -1;
        nextNum++;
        if (nextNum > n) {
          best = n; locked = true; status.textContent = "Cleared.";
          if (n >= MAX) return later(() => done(best, {}), 800);
          n++; later(round, 800);
        }
      } else {
        strikes++; locked = true; drawStrikes();
        if (strikes >= 3) { status.textContent = "Three strikes."; later(() => done(best, {}), 1000); }
        else { status.textContent = "Strike. Same count, new grid."; later(round, 1100); }
      }
    });
    round();
    return () => timers.forEach(clearTimeout);
  };

  /* ---------- Start up ---------- */
  const visit = Core.recordVisit(store, today());
  save();
  render();
  if (visit.isNew) {
    const a = visit.after, b = visit.before;
    let text = a.current > 1 ? `Day ${a.current} check-in. +${Core.XP.checkin} points.` : `Check-in recorded. +${Core.XP.checkin} points.`;
    if (a.shieldsUsed > b.shieldsUsed) text = `Shield used to keep your ${a.current}-day streak.`;
    setTimeout(() => toast(text, "flame"), 1500);
  }

  // A small door for the rest of the app (for example the Mind score or alerts later on):
  // window.SIRIUS_COG.summary() gives streak, level, and each test's Steady / Watch / Alert.
  window.SIRIUS_COG = { summary: () => Core.summary(store, today()) };
});

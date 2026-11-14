/*
 * Crew overview page. SIMULATED DATA: none of these people or readings are real.
 *
 * What this file does, in plain English:
 * 1. Makes up 14 days of daily scores (0 to 100) for a crew of six, in the five
 *    health-log categories: heart, sleep, mood, radiation, bone & muscle.
 * 2. Rolls everyone into one crew score, and works out a crew average per category.
 * 3. Looks for "crew patterns": the same category dropping for 3 or more people
 *    over the same days. One or two people dropping is shown separately, because
 *    that's a personal issue, not a crew-wide one.
 * 4. Draws the page: score tiles, the crew grid (with a "thread" joining the people
 *    in a pattern), a 14-day chart, pattern cards, and the "?" help pop-ups.
 *
 * The story built into the numbers (so the demo has something to find):
 * - Day 134: a solar particle event hits everyone's radiation score (now recovered).
 * - Day 135: the comms window for private family calls is lost; mood slips for 3 crew.
 * - Day 139: the sleep schedule moves 2 hours earlier for docking; sleep drops for 4 crew.
 * - Day 140: two crew do a spacewalk and pick up extra radiation (just two, so not a pattern).
 * - The commander's heart readings drift (matches the story on the main dashboard),
 *   and one person slowly skips exercise (bone & muscle).
 *
 * When the real backend exists, replace makeCrewData() with a request to it.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Settings ---------- */
  const MISSION = { name: "Lunar Gateway Expedition 3", today: 142, length: 180 }; // made-up mission
  const DAYS = 14; // days 129 to 142
  const FIRST_DAY = MISSION.today - DAYS + 1;
  const BASE_DAYS = 5; // each person's "normal" is their average over the first 5 days
  const DROP = 15; // a score this many points under someone's normal counts as "down"
  const CREW_MIN = 3; // this many people down at once = a crew pattern

  // Made-up crew. "you" is who the Astronaut view belongs to.
  const CREW = [
    { id: "crew-01", name: "R. Haddad", role: "Commander", initials: "RH", you: true },
    { id: "crew-02", name: "M. Okafor", role: "Flight engineer", initials: "MO" },
    { id: "crew-03", name: "S. Lindqvist", role: "Mission specialist", initials: "SL" },
    { id: "crew-04", name: "K. Tanaka", role: "Pilot", initials: "KT" },
    { id: "crew-05", name: "A. Moreau", role: "Science officer", initials: "AM" },
    { id: "crew-06", name: "J. Reyes", role: "Medical officer", initials: "JR" },
  ];

  // Line icons in the Feather style the brand guide recommends.
  const CAT_ICONS = {
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    sleep: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    mood: '<circle cx="12" cy="12" r="8"/><path d="M8.8 14.2a4 4 0 0 0 6.4 0M9.5 9.8v.3M14.5 9.8v.3"/>',
    radiation: '<circle cx="12" cy="12" r="1.8"/><path d="M12 3.5a8.5 8.5 0 0 1 7.4 4.3l-4.6 2.6M4.6 7.8A8.5 8.5 0 0 1 12 3.5M4.6 7.8l4.6 2.6M12 20.5v-5.2M12 20.5a8.5 8.5 0 0 0 7.4-4.3M12 20.5a8.5 8.5 0 0 1-7.4-4.3"/>',
    bone: '<path d="M6.5 6.5l11 11M4 9l5-5M15 20l5-5M2.5 10.5l1.5-1.5M20 15l1.5-1.5M10.5 2.5L9 4M13.5 21.5L15 20"/>',
  };
  const icon = (key, cls = "cat-ico") =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAT_ICONS[key]}</svg>`;

  const CATS = [
    { key: "heart", name: "Heart", help: "c-heart" },
    { key: "sleep", name: "Sleep", help: "c-sleep" },
    { key: "mood", name: "Mood", help: "c-mood" },
    { key: "radiation", name: "Radiation", help: "c-radiation" },
    { key: "bone", name: "Bone & muscle", help: "c-bone" },
  ];

  // Things that happened to the whole crew (or part of it). Simulated mission log.
  const EVENTS = [
    { day: 134, cat: "radiation", what: "Solar particle event, crew sheltered for 6 hours", who: "Everyone" },
    { day: 135, cat: "mood", what: "Comms window lost: no private family calls for now", who: "Everyone" },
    { day: 139, cat: "sleep", what: "Sleep schedule moved 2 hours earlier for docking", who: "Everyone" },
    { day: 140, cat: "radiation", what: "Spacewalk (6.5 hours outside)", who: "K. Tanaka, A. Moreau" },
  ];

  // What a crew-wide drop in each category could mean, and what to do about it.
  const CREW_ACTIONS = {
    heart: ["Flight surgeon: review the heart readings of the people listed", "Check the cabin air (CO2, temperature) for the modules they share"],
    sleep: ["Commander: review the crew sleep schedule with mission control", "Check light and noise in the sleep stations", "Avoid scheduling hard tasks first thing tomorrow"],
    mood: ["Plan a shared crew meal or group activity", "Ask the ground team for a private family call as soon as the comms window allows", "Flight surgeon: offer each person a private check-in"],
    radiation: ["No action needed now: doses are back to normal", "Logged for each person's mission dose total"],
    bone: ["Review the exercise schedule: is there enough time on the treadmill and resistance machine?", "Check the exercise equipment is working"],
  };
  // Used as "3 people have ..." and "Only R. Haddad has ...".
  const PERSONAL_WORDS = {
    heart: "lower heart scores than usual",
    sleep: "worse sleep than usual",
    mood: "lower mood than usual",
    radiation: "a higher radiation dose than usual",
    bone: "less exercise than usual",
  };

  /* ---------- Status helpers (same cut-offs as the main dashboard) ---------- */
  const band = (score) => (score >= 67 ? "good" : score >= 34 ? "watch" : "act");
  const WORDS = { good: "Normal", watch: "Watch", act: "Act now", info: "For info" };
  const ICONS = {
    good: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.2l2 2 4-4.2"/></svg>',
    watch: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 1.8l6.6 12H1.4z" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.3"/></svg>',
    act: '<svg class="ico" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7.2"/><path d="M8 4v4.8M8 11v.4" stroke="#07173F" stroke-width="1.9" stroke-linecap="round"/></svg>',
    info: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v4M8 4.8v.3"/></svg>',
  };
  const helpBtn = (key) => `<button type="button" class="help" data-help="${key}" aria-label="What is this?">?</button>`;
  const average = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  /* ---------- 1. Simulated crew data ---------- */
  let seed = 11; // fixed seed: the same numbers on every page load
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  const noise = (size) => (rand() - 0.5) * 2 * size;

  // How far below normal each story pushes a score on a given mission day.
  function storyOffset(person, cat, day) {
    const id = person.id;
    if (cat === "sleep" && ["crew-01", "crew-02", "crew-03", "crew-04"].includes(id) && day >= 139) {
      return -[8, 18, 26, 31][day - 139];
    }
    if (cat === "sleep" && day >= 140) return -3; // everyone else only slightly affected
    if (cat === "mood" && ["crew-03", "crew-05", "crew-06"].includes(id) && day >= 136) {
      return -Math.min(30, 5 * (day - 135));
    }
    if (cat === "radiation") {
      const solar = { 134: -36, 135: -26, 136: -16, 137: -8 }[day] || 0;
      const eva = ["crew-04", "crew-05"].includes(id) ? { 140: -32, 141: -27, 142: -24 }[day] || 0 : 0;
      return solar + eva;
    }
    if (cat === "heart" && id === "crew-01" && day >= 139) return -[10, 22, 33, 44][day - 139];
    if (cat === "bone" && id === "crew-06") return -1.6 * (day - FIRST_DAY);
    return 0;
  }

  function makeCrewData() {
    const typical = { heart: 82, sleep: 80, mood: 81, radiation: 86, bone: 80 };
    return CREW.map((person) => {
      const scores = {};
      for (const c of CATS) {
        const own = typical[c.key] + noise(6); // everyone's normal is a little different
        scores[c.key] = [];
        for (let i = 0; i < DAYS; i++) {
          const day = FIRST_DAY + i;
          scores[c.key].push(Math.round(clamp(own + noise(3.5) + storyOffset(person, c.key, day), 0, 100)));
        }
      }
      return { ...person, scores };
    });
  }

  /* ---------- 2. Rolling it up ---------- */
  const crew = makeCrewData();
  const T = DAYS - 1; // index of today

  for (const p of crew) {
    p.normal = {};
    for (const c of CATS) p.normal[c.key] = Math.round(average(p.scores[c.key].slice(0, BASE_DAYS)));
    // Each person's overall score today: the average of their five categories.
    p.overall = Math.round(average(CATS.map((c) => p.scores[c.key][T])));
  }
  const crewAvg = (cat, i) => Math.round(average(crew.map((p) => p.scores[cat][i])));
  const crewScore = Math.round(average(crew.map((p) => p.overall)));
  const crewScoreWeekAgo = Math.round(average(crew.map((p) => average(CATS.map((c) => p.scores[c.key][T - 7])))));

  /* ---------- 3. Finding crew patterns ---------- */
  const isDown = (p, cat, i) => p.scores[cat][i] <= p.normal[cat] - DROP;

  function findPatterns() {
    const patterns = [];
    const singles = [];
    for (const c of CATS) {
      // Walk back from today to find the most recent run of days where 3+ people were down together.
      let end = -1;
      for (let i = T; i >= BASE_DAYS; i--) {
        if (crew.filter((p) => isDown(p, c.key, i)).length >= CREW_MIN) { end = i; break; }
      }
      if (end >= 0) {
        let start = end;
        while (start - 1 >= BASE_DAYS && crew.filter((p) => isDown(p, c.key, start - 1)).length >= CREW_MIN) start--;
        const ongoing = end === T;
        const people = crew.filter((p) => {
          for (let i = start; i <= end; i++) if (isDown(p, c.key, i)) return true;
          return false;
        });
        const todayLevels = people.map((p) => band(p.scores[c.key][T]));
        const level = !ongoing ? "info" : todayLevels.includes("act") || people.length >= 5 ? "act" : "watch";
        const events = EVENTS.filter((e) => e.cat === c.key && e.day >= FIRST_DAY + start - 4 && e.day <= FIRST_DAY + end);
        const drops = people.map((p) => p.normal[c.key] - Math.min(...p.scores[c.key].slice(start, end + 1)));
        patterns.push({
          cat: c.key, level, ongoing, people, events,
          startDay: FIRST_DAY + start, endDay: FIRST_DAY + end,
          avgDrop: Math.round(average(drops)),
        });
      }
      // Anyone down today who isn't part of a crew pattern in this category.
      const inPattern = new Set((patterns.find((x) => x.cat === c.key && x.ongoing) || { people: [] }).people.map((p) => p.id));
      for (const p of crew) {
        if (isDown(p, c.key, T) && !inPattern.has(p.id)) singles.push({ person: p, cat: c.key, score: p.scores[c.key][T] });
      }
    }
    const order = { act: 0, watch: 1, info: 2 };
    patterns.sort((a, b) => order[a.level] - order[b.level] || b.people.length - a.people.length);
    return { patterns, singles };
  }
  const { patterns, singles } = findPatterns();

  /* ---------- Page state ---------- */
  const state = {
    surgeon: true, // the Flight surgeon view shows names; the Astronaut view hides crewmates' names
    pattern: patterns.findIndex((p) => p.ongoing), // the first ongoing pattern starts selected
    chartCat: null,
    picked: null, // { id, cat } of the square shown in the close-up
  };
  if (state.pattern < 0) state.pattern = patterns.length ? 0 : null;
  state.chartCat = state.pattern !== null ? patterns[state.pattern].cat : "sleep";

  // In the Astronaut view, crewmates are shown as "Crewmate B" etc. (their privacy).
  const label = (p) => (state.surgeon || p.you ? p.name : "Crewmate " + "ABCDEF"[CREW.findIndex((c) => c.id === p.id)]);
  const initials = (p) => (state.surgeon || p.you ? p.initials : "ABCDEF"[CREW.findIndex((c) => c.id === p.id)]);
  const avatar = (p) => `<span class="avatar" aria-hidden="true">${initials(p)}</span>`;
  const catName = (key) => CATS.find((c) => c.key === key).name;
  const levelWord = (lvl) => `<span class="level-word is-${lvl}">${ICONS[lvl]}${WORDS[lvl]}</span>`;

  /* ---------- 4a. Header ---------- */
  $("cw-mission").textContent = `${MISSION.name} · crew of ${CREW.length}`;
  $("cw-day").innerHTML = `Day <b>${MISSION.today}</b> of ${MISSION.length}`;
  $("cw-fill").style.width = (MISSION.today / MISSION.length) * 100 + "%";
  for (const lvl of ["good", "watch", "act"]) $("lg-" + lvl).innerHTML = ICONS[lvl] + `<b>${WORDS[lvl]}</b>`;

  /* ---------- 4b. Crew score and category tiles ---------- */
  function ring(value, level) {
    const r = 48, len = 2 * Math.PI * r;
    const color = { good: "#2E96F5", watch: "#EAFE07", act: "#E43700" }[level];
    return `<div class="ring">
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <circle class="track" cx="56" cy="56" r="${r}" fill="none" stroke-width="9"/>
        <circle class="fill" cx="56" cy="56" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
          stroke-dasharray="${len}" stroke-dashoffset="${reduceMotion ? len * (1 - value / 100) : len}" data-target="${len * (1 - value / 100)}"/>
      </svg>
      <div class="ring-num"><b>${value}</b><small>of 100</small></div>
    </div>`;
  }

  function renderSummary() {
    const level = band(crewScore);
    const counts = { good: 0, watch: 0, act: 0 };
    // Each person counts under their worst category today, so one bad area isn't hidden by an average.
    const worst = (p) => { const l = CATS.map((c) => band(p.scores[c.key][T])); return l.includes("act") ? "act" : l.includes("watch") ? "watch" : "good"; };
    crew.forEach((p) => counts[worst(p)]++);
    const change = crewScore - crewScoreWeekAgo;
    // The category pulling the crew down the most today
    const lowest = CATS.map((c) => ({ c, v: crewAvg(c.key, T) })).sort((a, b) => a.v - b.v)[0];

    let html = `<div class="panel crew-score">
      ${ring(crewScore, level)}
      <div>
        <div class="crew-score-title">Crew score ${helpBtn("crew-score")}</div>
        <div class="crew-score-word is-${level}">${ICONS[level]}${WORDS[level]}</div>
        <p class="crew-count-label">People, by their weakest area today ${helpBtn("crew-count")}</p>
        <div class="crew-count">
          <span class="is-good">${ICONS.good}<b>${counts.good}</b>&nbsp;all normal</span>
          <span class="is-watch">${ICONS.watch}<b>${counts.watch}</b>&nbsp;watch</span>
          <span class="is-act">${ICONS.act}<b>${counts.act}</b>&nbsp;act now</span>
        </div>
        <p class="crew-note">${change < 0 ? "Down " + -change : change > 0 ? "Up " + change : "No change"} since a week ago. Lowest today: ${lowest.c.name.toLowerCase()}.</p>
      </div>
    </div>`;

    for (const c of CATS) {
      const v = crewAvg(c.key, T);
      const lvl = band(v);
      const weekAgo = crewAvg(c.key, T - 7);
      const diff = v - weekAgo;
      const dots = crew.map((p) => `<i class="is-${band(p.scores[c.key][T])}" title="${label(p)}"></i>`).join("");
      html += `<div role="button" tabindex="0" class="panel cat${state.chartCat === c.key ? " selected" : ""}" data-cat="${c.key}" aria-label="${c.name}: crew average ${v}. Show on chart">
        <span class="cat-name">${icon(c.key)}${c.name} ${helpBtn(c.help)}</span>
        <span class="cat-num is-${lvl}"><b>${v}</b><small title="Change since a week ago">${diff > 0 ? "▲" + diff : diff < 0 ? "▼" + -diff : "no change"} this week</small></span>
        <span class="cat-meta"><span class="dots">${dots}</span></span>
      </div>`;
    }
    $("cw-summary").innerHTML = html;

    if (!reduceMotion) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.querySelectorAll(".ring .fill").forEach((el) => (el.style.strokeDashoffset = el.dataset.target));
      }));
    }
  }
  $("cw-summary").addEventListener("click", (e) => {
    if (e.target.closest(".help")) return;
    const b = e.target.closest(".cat");
    if (!b) return;
    state.chartCat = b.dataset.cat;
    renderSummary();
    renderTabs();
    drawChart();
  });

  /* ---------- 4c. The crew grid ---------- */
  function renderGrid() {
    const sel = state.pattern !== null ? patterns[state.pattern] : null;
    const hitIds = sel ? new Set(sel.people.map((p) => p.id)) : new Set();
    const grid = $("grid");
    grid.classList.toggle("focus", !!sel);
    grid.classList.toggle("calm", !!sel && sel.level === "info");

    let html = `<thead><tr><th scope="col">Crew</th>`;
    for (const c of CATS) {
      html += `<th scope="col" class="col-btn${sel && sel.cat === c.key ? " on" : ""}" data-cat="${c.key}"><span class="th-in">${icon(c.key)}${c.name}</span></th>`;
    }
    html += `<th aria-hidden="true"></th><th scope="col">Overall</th></tr></thead><tbody>`;

    for (const p of crew) {
      const rowHit = hitIds.has(p.id);
      html += `<tr><th scope="row"><div class="person${rowHit ? " hit" : ""}">${avatar(p)}<div>
        <div class="person-name">${label(p)}${p.you ? '<span class="you">YOU</span>' : ""}</div>
        <div class="person-role">${p.role}</div></div></div></th>`;
      for (const c of CATS) {
        const v = p.scores[c.key][T];
        const lvl = band(v);
        const hit = rowHit && sel.cat === c.key;
        const picked = state.picked && state.picked.id === p.id && state.picked.cat === c.key;
        html += `<td><button type="button" class="cell lvl-${lvl}${hit ? " hit" : ""}${picked ? " picked" : ""}" data-id="${p.id}" data-cat="${c.key}"
          aria-label="${label(p)}, ${c.name}: ${v}, ${WORDS[lvl]}">${ICONS[lvl]}${v}</button></td>`;
      }
      const ol = band(p.overall);
      html += `<td class="sep" aria-hidden="true"></td><td><div class="cell overall lvl-${ol}" aria-label="${label(p)} overall: ${p.overall}">${ICONS[ol]}${p.overall}</div></td></tr>`;
    }
    grid.innerHTML = html + "</tbody>";
    $("grid-hint").textContent = sel ? `Showing: ${catName(sel.cat).toLowerCase()} pattern. Click it again to clear.` : "Click a square for a close-up";
    drawThread();
  }

  // Draw a dashed line that joins the squares of everyone in the selected pattern.
  function drawThread() {
    const svg = $("thread");
    const wrap = $("grid-wrap");
    const sel = state.pattern !== null ? patterns[state.pattern] : null;
    svg.innerHTML = "";
    if (!sel) return;
    const box = wrap.getBoundingClientRect();
    const pts = [...$("grid").querySelectorAll(".cell.hit")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left + wrap.scrollLeft + r.width / 2, y: r.top - box.top + r.height / 2 };
    });
    svg.setAttribute("width", wrap.scrollWidth);
    svg.setAttribute("height", wrap.scrollHeight);
    svg.style.width = wrap.scrollWidth + "px";
    svg.style.height = wrap.scrollHeight + "px";
    if (pts.length < 2) return;
    const color = sel.level === "info" ? "#2E96F5" : sel.level === "act" ? "#E43700" : "#EAFE07";
    // A gentle curve that bows out to the right of the column between each pair of squares.
    let d = `M${pts[0].x + 34},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const bow = 30 + Math.min(40, (b.y - a.y) * 0.15);
      d += ` C${a.x + 34 + bow},${a.y} ${b.x + 34 + bow},${b.y} ${b.x + 34},${b.y}`;
    }
    svg.innerHTML = `<path d="${d}" stroke="${color}" opacity="0.9"/>` +
      pts.map((p) => `<circle cx="${p.x + 34}" cy="${p.y}" r="4" fill="#07173F" stroke="${color}"/>`).join("");
  }

  $("grid").addEventListener("click", (e) => {
    const th = e.target.closest(".col-btn");
    if (th) {
      // Clicking a column heading selects that category's pattern, if there is one.
      const idx = patterns.findIndex((p) => p.cat === th.dataset.cat);
      selectPattern(idx >= 0 && idx !== state.pattern ? idx : null);
      state.chartCat = th.dataset.cat;
      renderSummary(); renderTabs(); drawChart();
      return;
    }
    const cell = e.target.closest("button.cell");
    if (!cell) return;
    const same = state.picked && state.picked.id === cell.dataset.id && state.picked.cat === cell.dataset.cat;
    state.picked = same ? null : { id: cell.dataset.id, cat: cell.dataset.cat };
    renderGrid();
    renderCloseup();
  });
  window.addEventListener("resize", drawThread);
  $("grid-wrap").addEventListener("scroll", drawThread, { passive: true });

  /* ---------- 4d. Close-up of one square ---------- */
  function sparkline(values, normal, crewLine) {
    const w = 320, h = 70, pad = 6;
    const x = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = (v) => h - pad - (v / 100) * (h - pad * 2);
    const line = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const last = values[values.length - 1];
    const color = { good: "#2E96F5", watch: "#EAFE07", act: "#E43700" }[band(last)];
    return `<svg class="closeup-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${pad}" x2="${w - pad}" y1="${y(normal)}" y2="${y(normal)}" stroke="rgba(46,150,245,0.5)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
      <path d="${line(crewLine)}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      <path d="${line(values)}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    </svg>`;
  }

  function renderCloseup() {
    const box = $("closeup");
    if (!state.picked) { box.hidden = true; return; }
    const p = crew.find((c) => c.id === state.picked.id);
    const cat = state.picked.cat;
    const vals = p.scores[cat];
    const v = vals[T];
    const crewLine = vals.map((_, i) => crewAvg(cat, i));
    const inPattern = patterns.find((x) => x.cat === cat && x.people.includes(p));
    let text;
    if (inPattern && inPattern.ongoing) text = `Part of a crew pattern: ${inPattern.people.length} people have ${PERSONAL_WORDS[cat]} at the same time. They may share a cause: see the pattern card.`;
    else if (isDown(p, cat, T)) text = `Only ${label(p)} has ${PERSONAL_WORDS[cat]} right now, so this looks personal rather than crew-wide.`;
    else if (inPattern) text = `Was part of the ${catName(cat).toLowerCase()} pattern on days ${inPattern.startDay} to ${inPattern.endDay}. Back near normal now.`;
    else text = "Within this person's normal range.";
    box.hidden = false;
    box.innerHTML = `<div class="closeup-head">${avatar(p)}<div><h3>${label(p)}</h3><p>${icon(cat, "ico")} ${catName(cat)} · ${p.role}</p></div>
        <button type="button" class="closeup-x" id="closeup-x" aria-label="Close">×</button></div>
      <div class="closeup-nums">
        <div><small>Today</small><b class="is-${band(v)}">${v}</b></div>
        <div><small>Their normal</small><b>${p.normal[cat]}</b></div>
        <div><small>Crew today</small><b>${crewAvg(cat, T)}</b></div>
      </div>
      ${sparkline(vals, p.normal[cat], crewLine)}
      <div class="cw-chart-legend"><span><i class="ln" style="border-color:${{ good: "#2E96F5", watch: "#EAFE07", act: "#E43700" }[band(v)]}"></i>${label(p)}</span><span><i class="ln" style="border-color:rgba(255,255,255,.35)"></i>Crew average</span><span><i class="ln ln-event" style="border-color:rgba(46,150,245,.5)"></i>Their normal</span></div>
      <p class="closeup-text">${text}</p>`;
    $("closeup-x").addEventListener("click", () => { state.picked = null; renderGrid(); renderCloseup(); });
  }

  /* ---------- 4e. Crew patterns, single people, events ---------- */
  function renderPatterns() {
    const box = $("patterns");
    if (!patterns.length) { box.innerHTML = '<p class="empty">No shared patterns right now.</p>'; return; }
    box.innerHTML = patterns.map((pt, i) => {
      const name = catName(pt.cat);
      const title = pt.ongoing
        ? `${name} down for ${pt.people.length} of ${crew.length} crew`
        : `${name}: whole-crew dip, now recovered`;
      const when = pt.ongoing ? `since day ${pt.startDay}` : `days ${pt.startDay}–${pt.endDay}`;
      const detail = pt.ongoing
        ? `${pt.people.length} people have ${PERSONAL_WORDS[pt.cat]}, on average ${pt.avgDrop} points under their own normal.`
        : `${pt.people.length} people dipped at the same time, on average ${pt.avgDrop} points. Everyone is back near normal.`;
      const maybe = pt.events.length
        ? `<h4>Happened around the same time</h4><p class="maybe">${pt.events.map((e) => `Day ${e.day}: ${e.what}`).join("<br>")}<br>This may be the shared cause. Check with the crew before acting on it.</p>`
        : "";
      return `<div role="button" tabindex="0" class="pattern is-${pt.level === "info" ? "good" : pt.level} lvl-${pt.level}${state.pattern === i ? " selected" : ""}" data-i="${i}" aria-pressed="${state.pattern === i}">
        <span class="pattern-top">${icon(pt.cat)}<span class="pattern-title">${title}</span><span class="pattern-when">${when}</span></span>
        <span class="pattern-top" style="margin-top:6px">${levelWord(pt.level)}</span>
        <p class="pattern-detail">${detail}</p>
        <span class="chips">${pt.people.map((p) => `<span class="chip">${avatar(p)}${label(p)}</span>`).join("")}</span>
        <div class="pattern-more">${maybe}<h4>What to do</h4><ul>${CREW_ACTIONS[pt.cat].map((a) => `<li>${a}</li>`).join("")}</ul></div>
      </div>`;
    }).join("");
  }
  function selectPattern(i) {
    state.pattern = i;
    if (i !== null) state.chartCat = patterns[i].cat;
    renderPatterns();
    renderGrid();
  }
  $("patterns").addEventListener("click", (e) => {
    const b = e.target.closest(".pattern");
    if (!b) return;
    const i = Number(b.dataset.i);
    selectPattern(state.pattern === i ? null : i);
    renderSummary(); renderTabs(); drawChart();
  });

  function renderSingles() {
    const box = $("singles");
    if (!singles.length) { box.innerHTML = '<p class="empty">Nobody stands out on their own today.</p>'; return; }
    box.innerHTML = singles.map((s) => {
      const lvl = band(s.score);
      return `<button type="button" class="single" data-id="${s.person.id}" data-cat="${s.cat}">${avatar(s.person)}
        <span><b>${label(s.person)}</b>: ${PERSONAL_WORDS[s.cat]}</span><span class="is-${lvl}">${ICONS[lvl]}</span></button>`;
    }).join("");
  }
  $("singles").addEventListener("click", (e) => {
    const b = e.target.closest(".single");
    if (!b) return;
    state.picked = { id: b.dataset.id, cat: b.dataset.cat };
    renderGrid();
    renderCloseup();
    $("closeup").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  });

  function renderEvents() {
    $("events").innerHTML = EVENTS.map((e) => `<li><span class="ev-day">Day ${e.day}</span>
      <span><span class="ev-what">${e.what}</span><span class="ev-who">${e.who}</span></span></li>`).join("");
  }

  /* ---------- 4f. 14-day chart ---------- */
  function renderTabs() {
    $("trend-tabs").innerHTML = CATS.map((c) =>
      `<button type="button" role="tab" aria-selected="${state.chartCat === c.key}" data-cat="${c.key}">${c.name}</button>`).join("");
  }
  $("trend-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.chartCat = b.dataset.cat;
    renderSummary(); renderTabs(); drawChart();
  });

  function drawChart() {
    const svg = $("chart");
    const W = svg.clientWidth || 700, H = 260;
    const m = { l: 34, r: 16, t: 26, b: 26 };
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const cat = state.chartCat;
    const x = (i) => m.l + (i / (DAYS - 1)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - v / 100) * (H - m.t - m.b);
    const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const sel = state.pattern !== null && patterns[state.pattern].cat === cat ? patterns[state.pattern] : null;
    const hitColor = sel && sel.level === "info" ? "#2E96F5" : "#EAFE07";

    let out = "";
    // Background: the Watch zone (34 to 66) and Act now zone (under 34) as faint strips
    out += `<rect x="${m.l}" y="${y(66)}" width="${W - m.l - m.r}" height="${y(34) - y(66)}" fill="rgba(234,254,7,0.04)"/>`;
    out += `<rect x="${m.l}" y="${y(33)}" width="${W - m.l - m.r}" height="${y(0) - y(33)}" fill="rgba(228,55,0,0.06)"/>`;
    for (const v of [0, 33, 67, 100]) {
      out += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(46,150,245,0.14)"/>`;
      out += `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    for (let i = 0; i < DAYS; i += 2) out += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">d${FIRST_DAY + i}</text>`;

    // Shared events for this category, as dashed vertical lines
    for (const e of EVENTS.filter((ev) => ev.cat === cat)) {
      const ex = x(e.day - FIRST_DAY);
      out += `<line x1="${ex}" x2="${ex}" y1="${m.t - 6}" y2="${H - m.b}" stroke="rgba(255,255,255,0.4)" stroke-dasharray="3 4"/>`;
      const short = e.what.split(/[,:]/)[0];
      const anchor = ex > W - 160 ? "end" : "start";
      out += `<text class="ev-label" x="${ex + (anchor === "end" ? -6 : 6)}" y="${m.t - 10}" text-anchor="${anchor}">${short}</text>`;
    }

    // Each astronaut as a faint line; people in the selected pattern in the pattern colour
    for (const p of crew) {
      const hit = sel && sel.people.includes(p);
      out += `<path d="${path(p.scores[cat])}" fill="none" stroke="${hit ? hitColor : "rgba(46,150,245,0.38)"}" stroke-width="${hit ? 2 : 1.4}" opacity="${hit ? 0.9 : 1}"><title>${label(p)}</title></path>`;
    }
    // Crew average on top, in white
    const avg = Array.from({ length: DAYS }, (_, i) => crewAvg(cat, i));
    out += `<path d="${path(avg)}" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>`;
    out += `<circle cx="${x(T)}" cy="${y(avg[T])}" r="4.5" fill="#FFFFFF"/>`;
    out += `<text x="${x(T) - 8}" y="${y(avg[T]) - 10}" text-anchor="end" style="fill:#fff">${avg[T]}</text>`;
    svg.innerHTML = out;
    svg.setAttribute("aria-label", `${catName(cat)}: crew average over the last 14 days, ${avg[0]} to ${avg[T]}`);
  }
  window.addEventListener("resize", drawChart);

  // The score tiles and pattern cards are clickable boxes, not real buttons (they hold
  // "?" buttons and lists), so Enter and Space need to click them by hand.
  document.addEventListener("keydown", (e) => {
    const box = e.target.closest && e.target.closest('[role="button"]');
    if (box && e.target === box && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      box.click();
    }
  });

  /* ---------- View switch ---------- */
  function setView(surgeon) {
    state.surgeon = surgeon;
    $("view-surgeon").setAttribute("aria-pressed", surgeon);
    $("view-astro").setAttribute("aria-pressed", !surgeon);
    renderAll();
  }
  $("view-surgeon").addEventListener("click", () => setView(true));
  $("view-astro").addEventListener("click", () => setView(false));

  /* ---------- "?" help pop-ups ---------- */
  const HELP = {
    view: ["Who is viewing", "Flight surgeon view shows everyone's name. Astronaut view keeps your own name and shows crewmates as \"Crewmate B\" and so on, so people can see the crew picture without seeing each other's private health details. (An idea for the team to decide.)"],
    "crew-score": ["Crew score", "Everyone's health rolled into one number, from 0 to 100. Each person gets an overall score (the average of their five categories), and the crew score is the average of those. One number can hide one person struggling, so the grid below always shows everyone. Placeholder formula for the demo."],
    "crew-count": ["People, by their weakest area", "Each person is counted under their worst category today. Someone with one Act now square counts as Act now, even if their other scores are fine, so the crew score can't hide them."],
    "c-heart": ["Heart", "Resting heart rate and heart rate variability against each person's own normal."],
    "c-sleep": ["Sleep", "Hours slept and how deep the sleep was, from the sleep headband."],
    "c-mood": ["Mood", "From each person's daily check-in. Wearables can't measure how someone feels, so this comes from them."],
    "c-radiation": ["Radiation", "How each person's daily dose compares with a normal day. 100 = a normal low dose; lower = more dose than usual (for example after a solar event or a spacewalk)."],
    "c-bone": ["Bone & muscle", "Whether each person is getting the exercise that protects bones and muscles in low gravity."],
    grid: ["Everyone, every category", "Each row is one astronaut, each column one health category. The number is today's score (0 to 100) and the colour is its status. Click a square for a 14-day close-up. Click a column heading to show that category's crew pattern, if there is one."],
    trend: ["Last 14 days", "The white line is the crew average. The thin lines are each astronaut. Dashed lines mark shared events, like a schedule change, which can explain a dip that several people share."],
    patterns: ["Crew patterns", `A pattern is when ${CREW_MIN} or more people drop in the same category over the same days (at least ${DROP} points under their own normal). That usually points to a shared cause, like the schedule, the cabin air or a stressful event, rather than one person's health. Click a pattern to see who it links in the grid.`],
    singles: ["Just one or two people", "People who are down today in a category, but not as part of a crew pattern. These are more likely personal and are best handled one-to-one."],
    events: ["Shared events", "Things that happened to the whole crew or part of it, from the mission log. Simulated for the demo."],
  };
  const pop = $("help-pop");
  let pinned = null;
  function showHelp(btn) {
    const [title, text] = HELP[btn.dataset.help] || ["", ""];
    pop.innerHTML = `<b>${title}</b>${text}`;
    pop.classList.add("show");
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
    let top = r.bottom + 10;
    if (top + ph > window.innerHeight - 12) top = r.top - ph - 10;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  const hideHelp = () => pop.classList.remove("show");
  document.addEventListener("mouseover", (e) => { const b = e.target.closest(".help"); if (b && !pinned) showHelp(b); });
  document.addEventListener("mouseout", (e) => { if (e.target.closest(".help") && !pinned) hideHelp(); });
  document.addEventListener("focusin", (e) => { const b = e.target.closest(".help"); if (b) showHelp(b); });
  document.addEventListener("focusout", (e) => { if (e.target.closest(".help") && !pinned) hideHelp(); });
  // Capture phase, so a "?" inside a clickable card opens help without also clicking the card.
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".help");
    document.querySelectorAll(".help.open").forEach((x) => x !== b && x.classList.remove("open"));
    if (b) {
      e.stopPropagation();
      e.preventDefault();
      pinned = pinned === b ? null : b;
      b.classList.toggle("open", !!pinned);
      pinned ? showHelp(b) : hideHelp();
    } else if (pinned) {
      pinned = null;
      hideHelp();
    }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      pinned = null;
      document.querySelectorAll(".help.open").forEach((x) => x.classList.remove("open"));
      hideHelp();
    }
  });
  window.addEventListener("scroll", () => !pinned && hideHelp(), { passive: true });

  /* ---------- Star background (a lighter copy of the main dashboard's) ---------- */
  const canvas = $("space");
  const ctx = canvas.getContext("2d");
  let W = 0, Hc = 0, stars = [];
  function resizeSky() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; Hc = window.innerHeight;
    canvas.width = W * dpr; canvas.height = Hc * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((W * Hc) / 5200) }, () => {
      const depth = Math.random();
      return {
        a: Math.random() * Math.PI * 2,
        r: Math.sqrt(Math.random()) * Math.hypot(W, Hc) * 1.1,
        size: 0.4 + depth * 1.4,
        speed: 0.00002 + depth * 0.00005,
        alpha: 0.25 + depth * 0.6,
        twinkle: Math.random() * Math.PI * 2,
        blue: Math.random() < 0.3,
      };
    });
  }
  function sky(t) {
    ctx.fillStyle = "#07173F";
    ctx.fillRect(0, 0, W, Hc);
    const cx = W * 0.15, cy = Hc * 1.35;
    for (const s of stars) {
      s.a += s.speed * 16;
      const sx = cx + Math.cos(s.a) * s.r, sy = cy + Math.sin(s.a) * s.r;
      if (sx < -4 || sx > W + 4 || sy < -4 || sy > Hc + 4) continue;
      const tw = 0.75 + 0.25 * Math.sin(t * 0.0012 + s.twinkle);
      ctx.fillStyle = s.blue ? `rgba(46,150,245,${s.alpha * tw})` : `rgba(255,255,255,${s.alpha * tw})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reduceMotion) requestAnimationFrame(sky);
  }
  window.addEventListener("resize", resizeSky);
  resizeSky();
  requestAnimationFrame(sky);

  /* ---------- First draw ---------- */
  function renderAll() {
    renderSummary();
    renderGrid();
    renderCloseup();
    renderPatterns();
    renderSingles();
    renderEvents();
    renderTabs();
    drawChart();
  }
  renderAll();
  // Fonts change the size of the grid squares, so redraw the thread once they've loaded.
  if (document.fonts) document.fonts.ready.then(drawThread);
})();

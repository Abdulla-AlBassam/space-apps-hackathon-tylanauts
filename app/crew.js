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
 * 4. Draws the page, which is kept deliberately simple: the crew score in one line, one
 *    short row per shared pattern (who, the issue, a suggested fix), and one small table
 *    of everyone today. Clicking a pattern highlights its people in the table.
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
    { day: 134, cat: "radiation", what: "Solar particle event, crew sheltered for 6 hours", short: "a solar particle event", who: "Everyone" },
    { day: 135, cat: "mood", what: "Comms window lost: no private family calls for now", short: "private family calls were lost", who: "Everyone" },
    { day: 139, cat: "sleep", what: "Sleep schedule moved 2 hours earlier for docking", short: "the sleep schedule moved 2 hours earlier", who: "Everyone" },
    { day: 140, cat: "radiation", what: "Spacewalk (6.5 hours outside)", short: "a spacewalk", who: "K. Tanaka, A. Moreau" },
  ];

  // One suggested fix for a crew-wide drop in each category.
  const CREW_FIX = {
    heart: "Flight surgeon reviews their heart readings, and checks the cabin air in the modules they share.",
    sleep: "Review the sleep schedule with mission control, and keep hard tasks out of tomorrow morning.",
    mood: "Plan a shared crew meal, and ask the ground team for family calls as soon as comms allow.",
    radiation: "Nothing to do now. The doses are logged in each person's mission total.",
    bone: "Check the exercise equipment and make room for it in the schedule.",
  };
  // Used as "Sleep is down for 4 of 6".
  const ISSUE_WORDS = { heart: "Heart scores are down", sleep: "Sleep is down", mood: "Mood is down", radiation: "Radiation dose is up", bone: "Exercise is down" };

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
  const { patterns } = findPatterns();

  /* ---------- Page state ---------- */
  // Only patterns that are happening now are shown. Ones that have recovered are left out.
  const live = patterns.filter((p) => p.ongoing);
  const state = {
    surgeon: true, // the Flight surgeon view shows names; the Astronaut view hides crewmates' names
    pattern: live.length ? 0 : null, // which pattern is highlighted in the table
  };

  // In the Astronaut view, crewmates are shown as "Crewmate B" etc. (their privacy).
  const label = (p) => (state.surgeon || p.you ? p.name : "Crewmate " + "ABCDEF"[CREW.findIndex((c) => c.id === p.id)]);
  const initials = (p) => (state.surgeon || p.you ? p.initials : "ABCDEF"[CREW.findIndex((c) => c.id === p.id)]);
  const avatar = (p) => `<span class="avatar" title="${label(p)}">${initials(p)}</span>`;
  const catName = (key) => CATS.find((c) => c.key === key).name;

  /* ---------- 4a. Header ---------- */
  $("cw-mission").textContent = `${MISSION.name} · day ${MISSION.today} of ${MISSION.length} · crew of ${CREW.length}`;
  for (const lvl of ["good", "watch", "act"]) $("lg-" + lvl).innerHTML = ICONS[lvl] + WORDS[lvl];

  /* ---------- 4b. Crew score, in one line ---------- */
  function renderScore() {
    const level = band(crewScore);
    const change = crewScore - crewScoreWeekAgo;
    const n = live.length;
    $("cw-score").innerHTML = `
      <b class="cw-score-num is-${level}">${crewScore}</b>
      <div>
        <p class="cw-score-title">Crew score ${helpBtn("crew-score")} <span class="level-word is-${level}">${ICONS[level]}${WORDS[level]}</span></p>
        <p class="cw-score-note">${change < 0 ? "Down " + -change : change > 0 ? "Up " + change : "No change"} from a week ago. ${n ? `${n} shared pattern${n === 1 ? "" : "s"} right now.` : "No shared patterns right now."}</p>
      </div>`;
  }

  /* ---------- 4c. Shared patterns: who, the issue, a suggested fix ---------- */
  function renderInsights() {
    const box = $("insights");
    if (!live.length) { box.innerHTML = '<p class="empty">Nothing is affecting several people at once right now.</p>'; return; }
    box.innerHTML = live.map((pt, i) => {
      const cause = pt.events[0];
      return `<div role="button" tabindex="0" class="insight${state.pattern === i ? " selected" : ""}" data-i="${i}" aria-pressed="${state.pattern === i}">
        <div class="in-who">
          <span class="avatars">${pt.people.map(avatar).join("")}</span>
          <span class="in-count"><b>${pt.people.length}</b> of ${crew.length} crew</span>
        </div>
        <div class="in-issue">
          <h3 class="is-${pt.level}">${icon(pt.cat)}<span>${ISSUE_WORDS[pt.cat]}</span></h3>
          <p>Since day ${pt.startDay}${cause ? `, after ${cause.short}` : ""}.</p>
        </div>
        <div class="in-fix">
          <h4>Suggested fix</h4>
          <p>${CREW_FIX[pt.cat]}</p>
        </div>
      </div>`;
    }).join("");
  }
  $("insights").addEventListener("click", (e) => {
    const b = e.target.closest(".insight");
    if (!b) return;
    const i = Number(b.dataset.i);
    state.pattern = state.pattern === i ? null : i;
    renderInsights();
    renderGrid();
  });

  /* ---------- 4d. Everyone today: one row per person, one column per health area ---------- */
  function renderGrid() {
    const sel = state.pattern !== null ? live[state.pattern] : null;
    const hitIds = sel ? new Set(sel.people.map((p) => p.id)) : new Set();
    let html = `<thead><tr><th scope="col"><span class="sr">Crew member</span></th>`;
    for (const c of CATS) html += `<th scope="col" class="${sel && sel.cat === c.key ? "on" : ""}">${icon(c.key)}<span>${c.name}</span></th>`;
    html += `</tr></thead><tbody>`;
    for (const p of crew) {
      html += `<tr><th scope="row"><div class="person">${avatar(p)}<div>
        <div class="person-name">${label(p)}${p.you ? '<span class="you">You</span>' : ""}</div>
        <div class="person-role">${p.role}</div></div></div></th>`;
      for (const c of CATS) {
        const v = p.scores[c.key][T];
        const lvl = band(v);
        const hit = sel && sel.cat === c.key && hitIds.has(p.id);
        // Normal scores stay quiet; only Watch and Act now get an icon and colour.
        html += `<td><span class="cell lvl-${lvl}${hit ? " hit" : ""}" title="${label(p)}, ${c.name}: ${v}, ${WORDS[lvl]}">${lvl === "good" ? "" : ICONS[lvl]}${v}</span></td>`;
      }
      html += `</tr>`;
    }
    $("grid").innerHTML = html + "</tbody>";
  }

  // The pattern rows are clickable boxes, not real buttons, so Enter and Space click them.
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
    "crew-score": ["Crew score", "Everyone's health rolled into one number, from 0 to 100: the average of each person's five health areas. One number can hide one person struggling, so the table below always shows everyone. Placeholder formula for the demo."],
    patterns: ["Where the crew lines up", `When ${CREW_MIN} or more people drop in the same health area over the same days (at least ${DROP} points under their own normal), it usually points to a shared cause, like the schedule or a stressful event, rather than one person's health. Click a row to highlight those people in the table below.`],
    grid: ["Everyone today", "Each row is one astronaut and each column is one health area. The number is today's score from 0 to 100. Yellow means Watch and red means Act now. A score on its own, like one person's heart, is personal rather than crew-wide."],
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
    renderScore();
    renderInsights();
    renderGrid();
  }
  renderAll();
})();

/*
 * Draws the whole dashboard from window.HEALTH_DATA (made in data.js).
 * Pages (switched with the left rail, using the address bar's #):
 *   #today   – scores (each with a Sirius health dial), 3D body map (body-map.js), a small alerts card, what's due, vitals, trends
 *   #alerts  – every alert in full: what changed and what to do
 *   #calendar – one month at a time: each day's alerts, health checks and readings together
 *   #log     – health log: what's due, what's coming up, latest results, "Log a result"
 * The Sirius voice (voice.js) reads out today's summary and answers spoken questions.
 *   #devices – my devices, how data flows, "Connect a device" walkthrough (a mock)
 * Every icon comes from icons.js (Lucide). No real astronaut data: readings come from our
 * device simulator through the backend, and anything still made up wears a "Sample data" tag.
 * data.js loads the readings first; drawing starts once window.HEALTH_READY is done.
 */
window.APP_HANDLES_HELP = true; // tells body-map.js that this file shows the "?" pop-ups
window.HEALTH_READY.then(function () {

  const H = window.HEALTH_DATA;
  const { astronaut, devices, days, baseline, alerts, band, categories, tests, history } = H;
  const today = days[days.length - 1];
  const $ = (id) => document.getElementById(id);
  const ic = (name, cls) => window.icon(name, cls);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Small helpers ---------- */
  const STATUS_ICON = { good: "circle-check", watch: "triangle-alert", act: "octagon-alert", info: "info" };
  // The three status words come from the Sirius identity's health dial: Steady, Watch, Alert.
  const WORDS = { good: "Steady", watch: "Watch", act: "Alert", info: "For info" };
  const pill = (level, word) => `<span class="pill is-${level}">${ic(STATUS_ICON[level])}${word || WORDS[level]}</span>`;
  const device = (id) => devices.find((d) => d.id === id);
  const deviceLabel = (id) => (device(id) || {}).label || id;
  const deviceChip = (id) => {
    if (id === "typed") return `<span class="chip">${ic("clipboard-pen")}Typed in</span>`;
    const d = device(id);
    return d ? `<span class="chip">${ic(d.icon)}${d.label}</span>` : "";
  };
  // "Sample data" tag: shown beside anything that still uses made-up numbers.
  const SAMPLE_TIP = "Made-up numbers for the demo. Real readings will replace them once the backend stores this.";
  const sampleTag = () => `<span class="sample-tag" title="${SAMPLE_TIP}">Sample data</span>`;
  const head = (id, iconName, text, sample) => { const el = $(id); if (el) el.innerHTML = ic(iconName) + text + (sample ? sampleTag() : ""); };
  const fmtDate = (iso) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const helpBtn = (key) => `<button type="button" class="help" data-help="${key}" aria-label="What is this?">?</button>`;
  const catOf = (id) => categories.find((c) => c.id === id);

  function toast(text) {
    const t = $("toast");
    t.innerHTML = ic("circle-check") + text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 2600);
  }

  /* ---------- Rail and page switching ---------- */
  const PAGES = [
    { id: "today", label: "Today", icon: "house" },
    { id: "alerts", label: "Alerts", icon: "bell" },
    { id: "calendar", label: "Calendar", icon: "calendar" },
    { id: "log", label: "Log", icon: "clipboard-list" },
    { id: "devices", label: "Devices", icon: "watch" },
  ];
  // The logo (star + dial mark) and the SIRIUS wordmark are drawn by sirius.js.
  $("rail").innerHTML =
    `<a class="brand" href="#today" aria-label="Sirius home">${SIRIUS.mark(40, { label: "" })}<span class="wordmark">Sirius</span></a>` +
    // The white "Log" button comes first: it opens the Health log page, where results are typed in
    `<a class="rail-link rail-log" href="#log" data-page="log" title="Log your results"><i>${ic("plus")}</i><span>Log</span></a>` +
    PAGES.filter((p) => p.id !== "log").map((p) => `<a class="rail-link" href="#${p.id}" data-page="${p.id}" title="${p.label}">${ic(p.icon)}<span>${p.label}</span>${p.id === "alerts" ? `<i class="rail-count" id="rail-count"></i>` : ""}</a>`).join("") +
    `<a class="rail-link" href="crew.html" title="Crew overview">${ic("users")}<span>Crew</span></a>`;

  function showPage() {
    const id = (location.hash || "#today").slice(1);
    const page = PAGES.find((p) => p.id === id) ? id : "today";
    PAGES.forEach((p) => ($("view-" + p.id).hidden = p.id !== page));
    document.querySelectorAll("#rail [data-page]").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
    if (page === "today") requestAnimationFrame(() => drawTrend(false));
    window.dispatchEvent(new Event("resize")); // lets the 3D body resize if it was hidden
  }
  window.addEventListener("hashchange", () => { showPage(); window.scrollTo(0, 0); });

  /* ---------- Header ---------- */
  $("astro-name").textContent = astronaut.name;
  $("astro-mission").innerHTML = ic("rocket") + astronaut.mission;
  $("mission-label").innerHTML = `${ic("calendar")}Day <b>${astronaut.missionDay}</b> of ${astronaut.missionLength}`;
  $("mission-fill").style.width = (astronaut.missionDay / astronaut.missionLength) * 100 + "%";

  /* ---------- Astronaut / flight surgeon switch ---------- */
  let surgeon = false;
  $("viewer-switch").innerHTML = `
    <button type="button" id="view-astro" aria-pressed="true">${ic("astronaut")}Astronaut</button>
    <button type="button" id="view-surgeon" aria-pressed="false">${ic("stethoscope")}Flight surgeon</button>`;
  function setView(isSurgeon) {
    surgeon = isSurgeon;
    $("view-astro").setAttribute("aria-pressed", !surgeon);
    $("view-surgeon").setAttribute("aria-pressed", surgeon);
    $("raw-panel").hidden = !surgeon;
  }
  $("view-astro").addEventListener("click", () => setView(false));
  $("view-surgeon").addEventListener("click", () => setView(true));

  /* ---------- Score cards: Recovery, Radiation, Mind ---------- */
  const SCORES = [
    {
      key: "recovery",
      title: "Recovery",
      icon: "heart-pulse",
      value: today.recovery,
      ringPct: today.recovery,
      unit: "out of 100",
      level: band(today.recovery),
      line: "How ready your body is for today.",
    },
    {
      key: "radiation",
      title: "Radiation",
      icon: "radiation",
      value: Math.round(today.doseTotal),
      ringPct: today.doseLimitPct,
      unit: "mSv total",
      dialUnit: "mSv",
      dialMax: H.careerLimit, // the dial runs from 0 to the 600 mSv career limit
      level: "good",
      word: `${today.doseLimitPct}% of limit`,
      line: `${Math.round(today.doseTotal)} mSv so far, ${today.radiation_dose} mSv today. Career limit ${H.careerLimit} mSv.`,
    },
    {
      key: "mind",
      title: "Mind",
      icon: "brain",
      value: today.mindScore,
      ringPct: today.mindScore,
      unit: "out of 100",
      level: band(today.mindScore),
      line: `Mood ${today.mood}/5 in today's check-in.`,
    },
  ];

  // The meter on each score is the Sirius health dial, drawn as a 0 to 100 speedometer with
  // the score's icon under the number. Bone ticks are the score so far, slate ticks are what
  // is left, ember means attention.
  const dial = (s) => SIRIUS.dial(s.ringPct, s.level, s.value, 116, s.dialUnit, s.icon, s.dialMax);

  let selectedScore = "recovery"; // which score the Overview card (beside the body map) is showing
  function renderScores() {
    $("scores").innerHTML = SCORES.map(
      (s) => `
      <div class="score${s.key === selectedScore ? " selected" : ""}" role="button" tabindex="0"
           data-score="${s.key}" aria-pressed="${s.key === selectedScore}"
           aria-label="${s.title} ${s.value} ${s.unit}. Show its overview">
        ${dial(s)}
        <div class="score-text">
          <div class="score-title">${s.title} ${helpBtn(s.key)}</div>
          ${pill(s.level, s.word)}
          <p class="score-line">${s.line}</p>
        </div>
      </div>`
    ).join("");
  }
  $("scores").addEventListener("click", (e) => {
    if (e.target.closest(".help")) return;
    const card = e.target.closest("[data-score]");
    if (card) selectScore(card.dataset.score);
  });
  $("scores").addEventListener("keydown", (e) => {
    const card = e.target.closest("[data-score]");
    if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      selectScore(card.dataset.score);
    }
  });
  // Clicking a score swaps the Overview card to that score straight away (and the trend chart too).
  function selectScore(key) {
    selectedScore = key;
    document.querySelectorAll("[data-score]").forEach((el) => {
      el.classList.toggle("selected", el.dataset.score === key);
      el.setAttribute("aria-pressed", el.dataset.score === key);
    });
    renderContributors();
    selectTrend({ recovery: "recovery", radiation: "doseTotal", mind: "mindScore" }[key]);
  }

  /* ---------- Overview of the selected score: what it is made of ---------- */
  function contributorRows(key) {
    const b = baseline;
    if (key === "recovery") {
      return [
        { icon: "activity", q: "Is your heart rate variability normal for you?", v: today.recoveryParts.hrv, note: `${today.hrv_rmssd} ms (usual ${Math.round(b.hrv_rmssd.mean)})`, src: "strap-01" },
        { icon: "heart-pulse", q: "Is your resting heart rate normal for you?", v: today.recoveryParts.rhr, note: `${today.resting_hr} bpm (usual ${Math.round(b.resting_hr.mean)})`, src: "watch-01" },
        { icon: "moon", q: "Did you get enough sleep?", v: today.recoveryParts.sleep, note: `${today.sleep_hours} h of 8 h`, src: "band-01" },
      ];
    }
    if (key === "radiation") {
      return [
        { icon: "radiation", q: "Was today's dose normal?", v: Math.round(today.radiation_dose * 100), note: `${today.radiation_dose} mSv (usually under 1)`, src: "dosi-01", neutral: true, max: 100, pctLabel: `${today.radiation_dose}` },
        { icon: "gauge", q: "How much of your career limit is used?", v: Math.round(today.doseLimitPct), note: `${today.doseTotal} of ${H.careerLimit} mSv`, src: "dosi-01", neutral: true, pctLabel: `${today.doseLimitPct}%` },
      ];
    }
    return [
      { icon: "smile", q: "How is your mood?", v: Math.round((today.mood / 5) * 100), note: `${today.mood} out of 5, from your check-in`, src: "typed" },
      { icon: "moon", q: "Did you sleep enough?", v: today.recoveryParts.sleep, note: `${today.sleep_hours} h of 8 h`, src: "band-01" },
      { icon: "message-circle", q: "When is your next private psych conference?", v: 64, note: "In 5 days (every 2 weeks)", src: "typed", neutral: true, pctLabel: "5 d" },
    ];
  }
  // A small icon for where a number came from (hover it for the device's name)
  const srcIcon = (id) => `<span title="${id === "typed" ? "Typed in" : deviceLabel(id)}">${ic(id === "typed" ? "clipboard-pen" : (device(id) || {}).icon || "activity")}</span>`;
  function renderContributors() {
    const s = SCORES.find((x) => x.key === selectedScore);
    $("contrib-title").innerHTML = ic(s.icon) + `${s.title} overview`;
    $("contrib").innerHTML = contributorRows(selectedScore)
      .map((r) => {
        const level = r.neutral ? "good" : band(r.v);
        return `<div class="contrib-row">
          <span class="contrib-ico">${ic(r.icon)}</span>
          <div>${r.q}<div class="contrib-note">${srcIcon(r.src)}${r.note}</div></div>
          <div class="contrib-bar is-${level}"><span style="width:0%" data-w="${Math.min(100, r.v)}%"></span></div>
          <div class="contrib-num is-${level}">${r.pctLabel || r.v}</div>
        </div>`;
      })
      .join("");
    requestAnimationFrame(() => document.querySelectorAll(".contrib-bar span").forEach((el) => (el.style.width = el.dataset.w)));
  }

  /* ---------- Body map heading ---------- */
  head("bm-heading", "person-standing", "Body map");
  $("bm-loading").innerHTML = SIRIUS.loading("Loading the 3D body"); // the motion logo, until body-map.js is ready

  /* ---------- Alerts ----------
   * On Today there is one small card: how many alerts are open and how serious they are.
   * Clicking it opens the Alerts page (#alerts), which lists each alert in full.
   */
  head("alerts-title", "bell-ring", "Alerts and actions");
  function alertCounts() {
    const open = alerts.filter((a) => !a.done);
    return {
      act: open.filter((a) => a.level === "act").length,
      watch: open.filter((a) => a.level === "watch").length,
      info: alerts.filter((a) => a.level === "info").length,
    };
  }
  const countsHtml = (c) =>
    [["act", c.act], ["watch", c.watch], ["info", c.info]]
      .filter(([, n]) => n > 0)
      .map(([level, n]) => `<span class="pill is-${level}">${ic(STATUS_ICON[level])}<b>${n}</b> ${WORDS[level]}</span>`)
      .join("");
  function renderAlerts() {
    const c = alertCounts();
    const needs = c.act + c.watch; // "For info" alerts don't need anything doing
    const level = c.act ? "act" : c.watch ? "watch" : "good";
    const top = alerts.find((a) => !a.done && a.level !== "info");

    // The small card on Today
    $("alerts-card").innerHTML = `
      <div class="panel-head"><h2>${ic("bell-ring")}Alerts</h2>${helpBtn("alerts")}<span class="spacer"></span><a class="link-btn" href="#alerts">View all${ic("chevron-right")}</a></div>
      <div class="alerts-sum">
        <b class="alerts-num is-${level}">${needs}</b>
        <p class="alerts-line">${needs ? `need${needs === 1 ? "s" : ""} your<br>attention` : "Nothing needs<br>your attention"}</p>
      </div>
      <div class="alerts-levels">${countsHtml(c) || pill("good", "All steady")}</div>
      ${top ? `<p class="alerts-top"><i class="ember-dot"></i>${top.title}</p>` : ""}`;

    // The count on the left rail
    const rc = $("rail-count");
    rc.textContent = needs || "";
    rc.className = "rail-count is-" + level;
    rc.hidden = !needs;

    // The Alerts page: three separate sections, one per level, each with its own look.
    // Alert = large cards (act today), Watch = smaller cards side by side, For info = a quiet list.
    $("alert-counts").innerHTML = SECTIONS.map((sec) => {
      const n = sec.level === "info" ? c.info : c[sec.level];
      return `<a class="alert-tab is-${sec.level}${n ? "" : " is-empty"}" href="#alerts" data-jump="${sec.level}"><b>${n}</b><span>${ic(STATUS_ICON[sec.level])}${WORDS[sec.level]}</span></a>`;
    }).join("");
    $("alert-list").innerHTML = SECTIONS.map((sec) => {
      const list = alerts.map((a, i) => ({ a, i })).filter((x) => x.a.level === sec.level);
      if (!list.length && sec.level !== "act") return ""; // the Alert section always shows, so "nothing urgent" is said out loud
      const open = list.filter((x) => !x.a.done).length;
      return `<section class="alert-sec sec-${sec.level}" id="alerts-${sec.level}" aria-label="${sec.name}">
        <header class="alert-sec-head">
          <span class="alert-sec-ico">${ic(STATUS_ICON[sec.level])}</span>
          <div><h3>${sec.name}</h3><p>${sec.sub}</p></div>
          <span class="alert-sec-count label">${sec.level === "info" ? list.length : `${open} open`}</span>
        </header>
        ${list.length
          ? `<div class="alert-sec-body">${list.map((x) => alertCard(x.a, x.i)).join("")}</div>`
          : `<p class="empty alert-none">${ic("circle-check")}Nothing needs action today.</p>`}
      </section>`;
    }).join("");
  }
  const SECTIONS = [
    { level: "act", name: "Alert", sub: "Act on these today." },
    { level: "watch", name: "Watch", sub: "Not urgent. Keep an eye on these and follow the steps when you can." },
    { level: "info", name: "For info", sub: "Nothing to do. These are here so you know." },
  ];
  function alertCard(a, i) {
    // For info: one quiet row, no steps and no button
    if (a.level === "info")
      return `<article class="alert info">
        <div class="alert-what"><h4>${a.title}</h4><p>${a.detail}</p></div>
        <p class="alert-note">${a.actions.join(" ")}</p>
      </article>`;
    // Every card is kept to three things: a title, one short line on what happened, and what to do.
    return `<article class="alert ${a.level}${a.done ? " done" : ""}">
      <div class="alert-what">
        <h4>${a.title}</h4>
        <p>${a.detail}</p>
      </div>
      <div class="alert-do">
        <div class="alert-steps">
          <h5>${ic("clipboard-list")}What to do</h5>
          <ul>${a.actions.map((x) => `<li>${x}</li>`).join("")}</ul>
        </div>
        <button type="button" class="${a.done ? "btn-ghost" : "btn-primary"}" data-alert="${i}">${ic(a.done ? "refresh-cw" : "check")}${a.done ? "Undo" : "Mark as done"}</button>
      </div>
    </article>`;
  }
  // The three counts at the top of the page jump to their section
  $("alert-counts").addEventListener("click", (e) => {
    const t = e.target.closest("[data-jump]");
    if (!t) return;
    e.preventDefault();
    const sec = $("alerts-" + t.dataset.jump);
    if (sec) sec.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  $("alerts-card").addEventListener("click", (e) => {
    if (!e.target.closest(".help, a")) location.hash = "#alerts"; // the whole card opens the Alerts page
  });
  $("alert-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-alert]");
    if (!b) return;
    const a = alerts[+b.dataset.alert];
    a.done = !a.done;
    renderAlerts();
    renderWeek();
    renderCalendar();
  });

  /* ---------- Health log: what's due ---------- */
  const typedTests = () => tests.filter((t) => t.dueInDays != null);
  function dueItems() {
    const items = typedTests()
      .filter((t) => t.dueInDays <= 0)
      .map((t) => ({ t, level: t.dueInDays < 0 ? "act" : "watch", word: t.dueInDays < 0 ? `Overdue ${-t.dueInDays} day${t.dueInDays < -1 ? "s" : ""}` : "Due today" }));
    items.sort((a, b) => a.t.dueInDays - b.t.dueInDays);
    return items;
  }
  function renderDue() {
    const items = dueItems();
    const unsynced = devices.filter((d) => d.lastSyncHours >= 24);
    const rows = items
      .map(({ t, level, word }) => `<div class="due">
          <span class="due-ico is-good">${ic(catOf(t.cat).icon)}</span>
          <div class="due-text"><b>${t.name}</b>${pill(level, word)}</div>
          ${t.how === "reminder" ? "" : `<button type="button" class="btn-ghost small" data-log="${t.id}">${ic("plus")}Log</button>`}
        </div>`)
      .concat(unsynced.map((d) => `<div class="due">
          <span class="due-ico is-good">${ic(d.icon)}</span>
          <div class="due-text"><b>${d.label} not synced</b>${pill("watch", `${Math.round(d.lastSyncHours)} h ago`)}</div>
          <a class="btn-ghost small" href="#devices">${ic("wifi-off")}Check</a>
        </div>`));
    const empty = `<p class="empty">${ic("circle-check")}Nothing due. You're all caught up.</p>`;
    $("due-full").innerHTML = rows.join("") || empty;
    head("log-due-heading", "calendar-clock", `To do <span class="count">${items.length + unsynced.length}</span>`, true);

    // Coming up: the next few checks that aren't due yet
    const next = typedTests().filter((t) => t.dueInDays > 0).sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 5);
    $("next-list").innerHTML = next
      .map((t) => `<div class="due">
        <span class="due-ico is-good">${ic(catOf(t.cat).icon)}</span>
        <div class="due-text"><b>${t.name}</b><span>${t.every}</span></div>
        <span class="due-when">${t.dueInDays === 1 ? "Tomorrow" : `In ${t.dueInDays} days`}</span>
      </div>`)
      .join("");
    renderWeek();      // the "This week" strip on Today
    renderCalendar();  // and the Calendar page, so both stay up to date after a result is logged
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-log]");
    if (b) openLogModal(b.dataset.log);
  });

  /* ---------- Calendar ----------
   * One place for things that used to be spread around: what is due today, what is
   * coming up, the alerts, and each day's readings. Two views use the same list of events:
   *   - "This week" on Today: a strip of seven days, with the chosen day's list under it
   *   - the Calendar page: a whole month, filters, and the chosen day in a side card
   */
  const PERIOD = { Daily: 1, Weekly: 7, Monthly: 30, "Every 2 weeks": 14 };
  const DAY_MS = 86400000;
  const todayISO = today.date;
  const toDate = (iso) => new Date(iso + "T00:00:00Z");
  const addDays = (iso, n) => new Date(toDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
  const daysFromToday = (iso) => Math.round((toDate(iso) - toDate(todayISO)) / DAY_MS);
  const dayByDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const fmtLong = (iso) => toDate(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const shortName = (name) => name.replace(/ \(.*\)$/, "");
  // "Today 07:00", "Yesterday 21:10", "8 days ago" -> how many days back that was
  const daysAgoOf = (when) => (/^(Today|Just now)/.test(when) ? 0 : /^Yesterday/.test(when) ? 1 : +(when.match(/(\d+) days ago/) || [0, -1])[1]);

  const cal = {
    weekDay: todayISO,                 // the day picked in the "This week" strip
    day: todayISO,                     // the day picked on the Calendar page
    month: todayISO.slice(0, 7),       // the month shown on the Calendar page, as "2026-11"
    filter: "all",                     // all | alert | check | reading | a health category id
  };

  // Everything that belongs to one day, as a plain list. Each item has a kind
  // (alert, check or reading) and a health category, which the filters use.
  function eventsOn(iso) {
    const n = daysFromToday(iso);
    const list = [];
    for (const a of alerts) if (a.date === iso) list.push({ kind: "alert", cat: a.cat, level: a.done ? "good" : a.level, title: a.title, done: a.done });

    if (n >= 0) {
      const daily = [];
      for (const t of typedTests()) {
        const period = PERIOD[t.every];
        if (!period) continue;
        if (n === 0) {
          if (t.dueInDays <= 0) list.push({ kind: "check", cat: t.cat, t, title: t.name, level: t.dueInDays < 0 ? "act" : "watch", word: t.dueInDays < 0 ? `Overdue ${-t.dueInDays} day${t.dueInDays < -1 ? "s" : ""}` : "Due today" });
          continue;
        }
        const first = t.dueInDays > 0 ? t.dueInDays : period; // if it's due now, the next one is a full period away
        if (n >= first && (n - first) % period === 0) (period === 1 ? daily : list).push({ kind: "check", cat: t.cat, t, title: t.name, sub: t.every });
      }
      // Daily checks would fill every future day, so they are folded into one quiet line
      if (daily.length) list.push({ kind: "check", cat: daily.map((e) => e.cat), daily: true, title: "Daily checks", sub: daily.map((e) => shortName(e.title)).join(", ") });
    }

    const d = dayByDate[iso];
    if (d) {
      const b = baseline;
      list.push({ kind: "reading", cat: "heart", icon: "heart-pulse", title: "Recovery", value: d.recovery, level: band(d.recovery) });
      list.push({ kind: "reading", cat: "sleep", icon: "moon", title: "Sleep", value: `${d.sleep_hours} h`, level: d.sleep_hours < b.sleep_hours.low ? "watch" : "good" });
      list.push({ kind: "reading", cat: "mind", icon: "brain", title: "Mind", value: d.mindScore, level: band(d.mindScore) });
      list.push({ kind: "reading", cat: "radiation", icon: "radiation", title: "Radiation dose", value: `${d.radiation_dose} mSv`, level: d.radiation_dose > 1 ? "watch" : "good" });
    }
    for (const h of history) if (h.source === "typed" && daysAgoOf(h.when) === -n) list.push({ kind: "reading", cat: h.cat, icon: catOf(h.cat).icon, title: h.test, sub: "Typed in", value: h.value, level: h.out ? "watch" : "good" });
    return list;
  }
  const matches = (e, f) => f === "all" || e.kind === f || [].concat(e.cat).includes(f);
  const needsAttention = (e) => e.kind !== "reading" && (e.level === "act" || e.level === "watch");

  // The small marks under a date: an ember dot if something needs attention that day,
  // a bone dot if a health check is planned.
  function marks(list) {
    const hot = list.some(needsAttention);
    const planned = list.some((e) => e.kind === "check" && !e.daily && !needsAttention(e));
    return `<span class="mk-row">${hot ? '<i class="mk mk-hot"></i>' : ""}${planned ? '<i class="mk mk-plan"></i>' : ""}</span>`;
  }

  // One line in a day's list
  function eventRow(e, iso) {
    const n = daysFromToday(iso);
    if (e.kind === "alert") {
      return `<a class="due due-link" href="#alerts"><span class="due-ico is-${e.level}">${ic("bell")}</span>
        <div class="due-text"><b>${e.title}</b>${e.done ? pill("good", "Done") : pill(e.level)}</div>${ic("chevron-right", "dim")}</a>`;
    }
    if (e.kind === "check") {
      const icon = e.device ? e.device.icon : e.daily ? "calendar-clock" : catOf(e.t.cat).icon;
      const action = e.device ? `<a class="btn-ghost small" href="#devices">${ic("wifi-off")}Check</a>`
        : e.word && e.t.how !== "reminder" ? `<button type="button" class="btn-ghost small" data-log="${e.t.id}">${ic("plus")}Log</button>`
        : e.word ? "" : `<span class="due-when">${n === 1 ? "Tomorrow" : `In ${n} days`}</span>`;
      return `<div class="due"><span class="due-ico">${ic(icon)}</span>
        <div class="due-text"><b>${e.title}</b>${e.word ? pill(e.level, e.word) : `<span>${e.sub}</span>`}</div>${action}</div>`;
    }
    return `<div class="due"><span class="due-ico">${ic(e.icon)}</span>
      <div class="due-text"><b>${e.title}</b>${e.sub ? `<span>${e.sub}</span>` : ""}</div>
      <span class="due-value${e.level === "good" ? "" : " is-watch"}">${e.value}</span></div>`;
  }
  const missionDayOf = (iso) => astronaut.missionDay + daysFromToday(iso);
  const dateLine = (iso) => `${daysFromToday(iso) === 0 ? "Today · " : ""}${fmtLong(iso)} · Mission day ${missionDayOf(iso)}`;

  /* "This week" on Today: two days back, today, four days ahead */
  function renderWeek() {
    head("due-heading", "calendar-days", "This week", true);
    $("due-all").innerHTML = "Calendar" + ic("chevron-right");
    let html = "";
    for (let n = -2; n <= 4; n++) {
      const iso = addDays(todayISO, n);
      const list = eventsOn(iso);
      const dt = toDate(iso);
      html += `<button type="button" class="wk-day${n === 0 ? " is-today" : ""}${n < 0 ? " is-past" : ""}${iso === cal.weekDay ? " selected" : ""}" data-day="${iso}" aria-pressed="${iso === cal.weekDay}" aria-label="${fmtLong(iso)}">
        <span class="wk-name">${dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
        <span class="wk-num">${dt.getUTCDate()}</span>${marks(list)}</button>`;
    }
    $("week-strip").innerHTML = html;

    // Under the strip: the chosen day. Readings are left out here because Today already
    // shows them; the Calendar page has everything.
    const iso = cal.weekDay;
    const all = eventsOn(iso).filter((e) => e.kind !== "reading" || daysFromToday(iso) < 0);
    // Alerts are folded into one line here (the Alerts card above has the detail),
    // which leaves room for the checks that are due.
    const open = all.filter((e) => e.kind === "alert" && needsAttention(e));
    const list = all.filter((e) => !open.includes(e));
    list.sort((a, b) => (a.level === "act" ? 0 : a.level === "watch" ? 1 : 2) - (b.level === "act" ? 0 : b.level === "watch" ? 1 : 2));
    const alertsRow = open.length
      ? `<a class="due due-link" href="#alerts"><span class="due-ico is-watch">${ic("bell")}</span>
          <div class="due-text"><b>${open.length} alert${open.length === 1 ? "" : "s"} need${open.length === 1 ? "s" : ""} attention</b><span>${open[0].title}${open.length > 1 ? `, and ${open.length - 1} more` : ""}</span></div>${ic("chevron-right", "dim")}</a>`
      : "";
    const TOP = 3;
    $("week-date").textContent = dateLine(iso);
    $("due-today").innerHTML = list.length || alertsRow
      ? alertsRow + list.slice(0, TOP).map((e) => eventRow(e, iso)).join("") + (list.length > TOP ? `<p class="due-more"><a href="#calendar" data-open-day="${iso}">+ ${list.length - TOP} more in the calendar</a></p>` : "")
      : `<p class="empty">${ic("circle-check")}Nothing planned for this day.</p>`;
  }
  $("week-strip").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    cal.weekDay = b.dataset.day;
    renderWeek();
  });
  // "Calendar" and "+ more" open the Calendar page on the day you were looking at
  document.addEventListener("click", (e) => {
    if (e.target.closest("#due-all, [data-open-day]")) { cal.day = cal.weekDay; cal.month = cal.day.slice(0, 7); renderCalendar(); }
  });

  /* The Calendar page */
  head("cal-title", "calendar", "Calendar", true);
  const FILTERS = [
    { id: "all", label: "All" },
    { id: "alert", label: "Alerts", icon: "bell" },
    { id: "check", label: "Checks", icon: "calendar-clock" },
    { id: "reading", label: "Readings", icon: "activity" },
  ].concat(categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon })));
  function renderCalendar() {
    $("cal-filters").innerHTML = FILTERS.map((f) => `<button type="button" data-filter="${f.id}" aria-selected="${f.id === cal.filter}">${f.icon ? ic(f.icon) : ""}${f.label}</button>`).join("");
    const [y, m] = cal.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    $("cal-month").innerHTML = ic("calendar-days") + first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    $("cal-nav").innerHTML = `<button type="button" class="icon-btn" data-month="-1" aria-label="Previous month">${ic("chevron-left")}</button>
      <button type="button" class="btn-ghost small" data-month="0">Today</button>
      <button type="button" class="icon-btn" data-month="1" aria-label="Next month">${ic("chevron-right")}</button>`;

    // Weeks start on Monday. Days from the months either side fill the first and last rows.
    const lead = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
    const startISO = addDays(first.toISOString().slice(0, 10), -lead);
    let html = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span class="cal-wd label">${d}</span>`).join("");
    for (let i = 0; i < cells; i++) {
      const iso = addDays(startISO, i);
      const list = eventsOn(iso).filter((e) => matches(e, cal.filter));
      const n = daysFromToday(iso);
      // Up to two short labels: things needing attention first, then planned checks
      const named = list.filter((e) => e.kind !== "reading" && !e.daily).sort((a, b) => needsAttention(b) - needsAttention(a));
      const labels = named.slice(0, 2).map((e) => `<span class="cal-ev${needsAttention(e) ? " is-watch" : ""}">${shortName(e.title)}</span>`).join("") +
        (named.length > 2 ? `<span class="cal-ev dim">+ ${named.length - 2} more</span>` : "");
      // Past days also show that day's recovery score, in ember if it was below Steady
      const rec = list.find((e) => e.kind === "reading" && e.title === "Recovery");
      html += `<button type="button" class="cal-cell${iso.slice(0, 7) === cal.month ? "" : " is-out"}${n === 0 ? " is-today" : ""}${iso === cal.day ? " selected" : ""}" data-day="${iso}" aria-pressed="${iso === cal.day}" aria-label="${fmtLong(iso)}, ${list.length} item${list.length === 1 ? "" : "s"}">
        <span class="cal-top"><span class="cal-num">${toDate(iso).getUTCDate()}</span>${rec && n < 0 ? `<span class="cal-rec${rec.level === "good" ? "" : " is-watch"}" title="Recovery that day">${rec.value}</span>` : marks(list)}</span>
        ${labels}</button>`;
    }
    $("cal-grid").innerHTML = html;
    $("cal-legend").innerHTML = `<span><i class="mk mk-hot"></i>Needs attention</span><span><i class="mk mk-plan"></i>Health check planned</span><span><b class="cal-rec">82</b>Recovery score that day</span>`;

    // The chosen day, in the card on the right
    const list = eventsOn(cal.day).filter((e) => matches(e, cal.filter));
    const groups = [["alert", "Alerts"], ["check", "Health checks"], ["reading", "Readings"]];
    $("cal-day").innerHTML = `<div class="panel-head"><h2>${ic("calendar")}${daysFromToday(cal.day) === 0 ? "Today" : daysFromToday(cal.day) === 1 ? "Tomorrow" : daysFromToday(cal.day) === -1 ? "Yesterday" : fmtDate(cal.day)}</h2></div>
      <p class="cal-day-title">${fmtLong(cal.day)}</p>
      <p class="label">Mission day ${missionDayOf(cal.day)} of ${astronaut.missionLength}</p>` +
      (list.length
        ? groups.map(([kind, title]) => {
            const rows = list.filter((e) => e.kind === kind);
            return rows.length ? `<h3 class="label cal-group">${title}</h3><div class="due-list">${rows.map((e) => eventRow(e, cal.day)).join("")}</div>` : "";
          }).join("")
        : `<p class="empty cal-empty">${ic("circle-check")}Nothing here for this day${cal.filter === "all" ? "" : " with this filter"}.</p>`);
  }
  $("cal-filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (b) { cal.filter = b.dataset.filter; renderCalendar(); }
  });
  $("cal-nav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-month]");
    if (!b) return;
    if (b.dataset.month === "0") { cal.day = todayISO; cal.month = todayISO.slice(0, 7); }
    else {
      const [y, m] = cal.month.split("-").map(Number);
      cal.month = new Date(Date.UTC(y, m - 1 + Number(b.dataset.month), 1)).toISOString().slice(0, 7);
    }
    renderCalendar();
  });
  $("cal-grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    cal.day = b.dataset.day;
    cal.month = cal.day.slice(0, 7);
    renderCalendar();
  });

  /* ---------- Health log page ---------- */
  head("log-title", "clipboard-list", "Health log");
  $("log-new").innerHTML = ic("plus") + "Log a result";
  $("log-new").addEventListener("click", () => openLogModal());
  head("next-heading", "calendar", "Coming up", true);
  head("hist-heading", "history", "Latest results", true);

  function renderHistory() {
    $("history").innerHTML = `<thead><tr><th>Test</th><th>Result</th><th>When</th><th>From</th></tr></thead><tbody>${history
      .slice(0, 6)
      .map(
        (h) => `<tr><td><span class="td-ico">${ic(catOf(h.cat).icon)}</span>${h.test}</td>
          <td class="num ${h.out ? "is-watch" : ""}">${h.out ? ic("triangle-alert") : ""}${h.value}</td>
          <td class="dim">${h.when}</td><td>${deviceChip(h.source)}</td></tr>`
      )
      .join("")}</tbody>`;
  }

  /* ---------- Pop-up window ---------- */
  const modal = $("modal"), box = $("modal-box");
  function openModal(html) {
    box.innerHTML = html;
    modal.hidden = false;
    const f = box.querySelector("input, select, button.btn-primary");
    if (f) f.focus();
  }
  function closeModal() { modal.hidden = true; box.innerHTML = ""; }
  modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });

  function openLogModal(testId) {
    const choices = tests.filter((t) => t.how === "typed");
    const sel = choices.find((t) => t.id === testId) || choices[0];
    openModal(`
      <div class="modal-head"><h2 id="modal-title">${ic("clipboard-pen")}Log a result</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ic("x")}</button></div>
      <form id="log-form" class="form">
        <label for="log-test">Test</label>
        <select id="log-test">${choices.map((t) => `<option value="${t.id}" ${t.id === sel.id ? "selected" : ""}>${catOf(t.cat).name}: ${t.name}</option>`).join("")}</select>
        <label for="log-value">Result <span class="dim" id="log-unit"></span></label>
        <input id="log-value" required autocomplete="off" placeholder="e.g. 120/80">
        <p class="dim small" id="log-normal"></p>
        <label for="log-note">Note (optional)</label>
        <input id="log-note" autocomplete="off" placeholder="How you feel, anything unusual">
        <p class="dim small">${ic("clock")}The time is saved automatically.</p>
        <div class="modal-actions"><button type="button" class="btn-ghost" data-close>Cancel</button><button type="submit" class="btn-primary">${ic("check")}Save result</button></div>
      </form>`);
    const upd = () => {
      const t = tests.find((x) => x.id === $("log-test").value);
      $("log-unit").textContent = t.unit ? `(${t.unit})` : "";
      $("log-normal").innerHTML = `${ic("info")}Healthy range: ${t.normal}`;
    };
    $("log-test").addEventListener("change", upd);
    upd();
    $("log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const t = tests.find((x) => x.id === $("log-test").value);
      const value = $("log-value").value.trim();
      const num = parseFloat(value);
      const out = (t.id === "mood" || t.id === "rested") && num < 3;
      history.unshift({ when: "Just now", test: t.name.replace(/ \(1-5\)$/, ""), cat: t.cat, value: `${value}${t.unit && !value.includes(t.unit) ? " " + t.unit : ""}`, source: "typed", note: $("log-note").value.trim(), out });
      t.lastDays = 0;
      t.dueInDays = { Daily: 1, Weekly: 7, Monthly: 30, "Every 2 weeks": 14 }[t.every] || 30;
      closeModal();
      renderDue(); renderHistory();
      toast(`${t.name.replace(/ \(1-5\)$/, "")} saved${out ? ", flagged as outside the healthy range" : ""}`);
    });
  }

  /* ---------- Devices page ---------- */
  head("dev-title", "watch", "My devices", true);
  $("dev-connect").innerHTML = ic("plus") + "Connect a device";
  $("dev-connect").addEventListener("click", () => openWizard());

  $("flow").innerHTML = `
    <div class="flow-step">${ic("watch")}${ic("heart-pulse")}${ic("headphones")}${ic("shirt")}<span>Wearables</span></div>
    <span class="flow-arrow">${ic("chevron-right")}</span>
    <div class="flow-step">${ic("webhook")}<span>Webhook per device</span></div>
    <span class="flow-arrow">${ic("chevron-right")}</span>
    <div class="flow-step">${ic("orbit")}<span>Hub: one common format</span></div>
    <span class="flow-arrow">${ic("chevron-right")}</span>
    <div class="flow-step">${ic("sparkles")}<span>Combined scores & warnings</span></div>
    ${helpBtn("flow")}`;

  function batteryIcon(b) { return b < 25 ? "battery-low" : "battery"; }
  function renderDevices() {
    $("dev-grid").innerHTML = devices
      .map((d) => {
        const stale = d.lastSyncHours >= 24;
        const synced = d.lastSyncHours < 1 ? `${Math.max(1, Math.round(d.lastSyncHours * 60))} min ago` : `${Math.round(d.lastSyncHours)} h ago`;
        return `<div class="card dev${stale ? " stale" : ""}">
          <div class="dev-top"><span class="dev-ico is-good">${ic(d.icon)}</span>
            <div><h3>${d.label}</h3><p class="dim">${d.model}</p></div>
            ${stale ? pill("watch", "Not synced") : pill("good", "Connected")}</div>
          <div class="dev-stats">
            <span>${ic(stale ? "wifi-off" : "wifi")}Synced ${synced}</span>
            <span class="${d.battery < 25 ? "is-watch" : ""}">${ic(batteryIcon(d.battery))}${d.battery}%</span>
          </div>
          <p class="dev-measures">${d.measures.join(" · ")}</p>
          ${d.note ? `<p class="dev-note dim small">${ic("moon")}${d.note}</p>` : ""}
          <div class="hook"><span>${ic("webhook")}</span><code>hub.tylanauts.app/hooks/${d.id}</code>
            <button type="button" class="icon-btn" data-copy="https://hub.tylanauts.app/hooks/${d.id}" aria-label="Copy webhook address">${ic("copy")}</button></div>
        </div>`;
      })
      .join("");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const text = b.dataset.copy;
    const done = () => toast("Webhook address copied");
    try { navigator.clipboard.writeText(text).then(done, done); } catch (err) { done(); }
  });

  /* Connect-a-device walkthrough: a mock where every step just needs "Next". */
  const KINDS = [
    { type: "watch", label: "Watch", icon: "watch", measures: ["Heart rate", "Blood oxygen", "Exercise"] },
    { type: "chest_strap", label: "Chest strap", icon: "heart-pulse", measures: ["HRV", "Breathing rate"] },
    { type: "headband", label: "Headband", icon: "headphones", measures: ["Sleep time", "Deep sleep"] },
    { type: "dosimeter", label: "Radiation badge", icon: "radiation", measures: ["Radiation dose"] },
    { type: "smart_shirt", label: "Smart shirt", icon: "shirt", measures: ["ECG", "Blood pressure", "Breathing rate & depth"] },
    { type: "thermometer", label: "Thermometer", icon: "thermometer", measures: ["Body temperature"] },
    { type: "other", label: "Something else", icon: "plug", measures: ["Custom readings"] },
  ];
  const STEPS = ["Choose", "Pair", "Webhook", "Test", "Done"];
  let wiz;
  function openWizard() {
    wiz = { step: 0, kind: KINDS[0], name: "" };
    renderWizard();
    modal.hidden = false;
  }
  function renderWizard() {
    const k = wiz.kind;
    const id = `${k.type.replace("_", "-")}-0${devices.filter((d) => d.type === k.type).length + 2}`;
    wiz.id = id;
    const bar = `<ol class="steps">${STEPS.map((s, i) => `<li class="${i < wiz.step ? "done" : i === wiz.step ? "now" : ""}">${i < wiz.step ? ic("check") : `<b>${i + 1}</b>`}${s}</li>`).join("")}</ol>`;
    let body = "";
    if (wiz.step === 0) {
      body = `<p>What are you connecting?</p><div class="kinds">${KINDS.map((x) => `<button type="button" class="kind${x === k ? " on" : ""}" data-kind="${x.type}">${ic(x.icon)}${x.label}</button>`).join("")}</div>`;
    } else if (wiz.step === 1) {
      body = `<div class="wiz-art">${ic(k.icon)}</div>
        <p>Turn on your ${k.label.toLowerCase()} and hold its button until the light flashes blue. Keep it close to the station.</p>
        <label for="wiz-name">Give it a name</label><input id="wiz-name" value="${wiz.name || k.label}" autocomplete="off">`;
    } else if (wiz.step === 2) {
      body = `<p>Your ${k.label.toLowerCase()} will send its readings to this address. Paste it into the device's app under "Data export".</p>
        <div class="hook big"><span>${ic("webhook")}</span><code>hub.tylanauts.app/hooks/${id}</code>
        <button type="button" class="icon-btn" data-copy="https://hub.tylanauts.app/hooks/${id}" aria-label="Copy webhook address">${ic("copy")}</button></div>
        <p class="dim small">${ic("info")}Each device gets its own address, so the hub knows where every reading came from.</p>`;
    } else if (wiz.step === 3) {
      body = wiz.tested
        ? `<div class="wiz-art ok">${ic("circle-check")}</div><p><b>Test reading received.</b> The hub understood it and turned it into our common format.</p>
           <div class="chips">${k.measures.map((m) => `<span class="chip">${ic("activity")}${m}</span>`).join("")}</div>`
        : `<div class="wiz-art">${SIRIUS.mark(86, { motion: true, label: "" })}</div><p>Waiting for a test reading from your ${k.label.toLowerCase()}…</p>`;
      if (!wiz.tested) setTimeout(() => { if (wiz && wiz.step === 3) { wiz.tested = true; renderWizard(); } }, 2900); // long enough to see the motion logo fill
    } else {
      body = `<div class="wiz-art ok">${ic(k.icon)}</div><p><b>${wiz.name || k.label} is connected.</b> Its readings will now show on your dashboard and in your health log.</p>`;
    }
    const canNext = wiz.step !== 3 || wiz.tested;
    box.innerHTML = `
      <div class="modal-head"><h2 id="modal-title">${ic("plug")}Connect a device</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ic("x")}</button></div>
      ${bar}<div class="wiz-body">${body}</div>
      <div class="modal-actions">
        ${wiz.step > 0 && wiz.step < 4 ? `<button type="button" class="btn-ghost" id="wiz-back">${ic("arrow-left")}Back</button>` : `<span></span>`}
        <button type="button" class="btn-primary" id="wiz-next" ${canNext ? "" : "disabled"}>${wiz.step === 4 ? ic("check") + "Finish" : "Next" + ic("chevron-right")}</button>
      </div>`;
  }
  box.addEventListener("click", (e) => {
    if (!wiz || modal.hidden) return;
    const kind = e.target.closest("[data-kind]");
    if (kind) { wiz.kind = KINDS.find((x) => x.type === kind.dataset.kind); renderWizard(); return; }
    if (e.target.closest("#wiz-back")) { wiz.step--; wiz.tested = false; renderWizard(); return; }
    if (e.target.closest("#wiz-next")) {
      const nameEl = $("wiz-name");
      if (nameEl) wiz.name = nameEl.value.trim();
      if (wiz.step === 4) {
        devices.push({ id: wiz.id, type: wiz.kind.type, label: wiz.name || wiz.kind.label, model: "Just connected", icon: wiz.kind.icon, measures: wiz.kind.measures, lastSyncHours: 0, battery: 100 });
        wiz = null;
        closeModal();
        renderDevices();
        toast("Device connected");
        return;
      }
      wiz.step++;
      renderWizard();
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) { wiz = null; closeModal(); } });

  /* ---------- Vitals ---------- */
  head("vitals-heading", "activity", "Vitals last night");
  const VITALS = [
    { metric: "resting_hr", name: "Resting heart rate", unit: "bpm", help: "rhr", icon: "heart-pulse" },
    { metric: "hrv_rmssd", name: "Heart rate variability", unit: "ms", help: "hrv", icon: "activity" },
    { metric: "spo2", name: "Blood oxygen", unit: "%", help: "spo2", icon: "droplet" },
    { metric: "resp_rate", name: "Breathing rate", unit: "/min", help: "resp", icon: "wind" },
    { metric: "skin_temp_delta", name: "Skin temperature", unit: "°C", help: "temp", icon: "thermometer", signed: true },
    { metric: "sleep_hours", name: "Sleep", unit: "h", help: "sleepv", icon: "moon" },
  ];
  function sparkline(values, low, high) {
    const w = 140, h = 30, pad = 3;
    const all = values.concat(low != null ? [low, high] : []);
    const min = Math.min(...all), max = Math.max(...all);
    const x = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const bandRect = low != null ? `<rect x="0" y="${y(high).toFixed(1)}" width="${w}" height="${(y(low) - y(high)).toFixed(1)}" class="spark-band"/>` : "";
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${bandRect}
      <polyline points="${pts}" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="2.5" fill="currentColor"/></svg>`;
  }
  function renderVitals() {
    $("vitals").innerHTML = VITALS.map((v) => {
      const value = today[v.metric];
      const b = baseline[v.metric];
      const out = b && (value < b.low || value > b.high);
      const shown = v.signed && value > 0 ? "+" + value : value;
      const src = device(today.sources[v.metric]) || { label: "device" }; // an unknown device must never blank the page
      return `<div class="vital ${out ? "out" : ""}">
        <div class="vital-name"><span class="vital-ico">${ic(v.icon)}</span>${v.name} ${helpBtn(v.help)}</div>
        <div class="vital-value">${shown}<small>${v.unit}</small></div>
        <div class="vital-flag">${out ? pill("watch", "Outside normal") : pill("good")}${H.isSample(v.metric) ? sampleTag() : ""}</div>
        <div class="${out ? "is-watch" : "is-good"}" title="Last 14 days, from your ${src.label.toLowerCase()}">${sparkline(days.slice(-14).map((d) => d[v.metric]), b ? b.low : null, b ? b.high : null)}</div>
      </div>`;
    }).join("");
  }

  /* ---------- 30-day trend chart ---------- */
  head("trend-heading", "chart-line", "Last 30 days");
  $("chart-legend").innerHTML = `<span><i class="swatch"></i>Your normal range</span><span><i class="ember-dot"></i>Outside normal</span>`;
  const TRENDS = [
    { metric: "recovery", label: "Recovery", unit: "%", icon: "heart-pulse" },
    { metric: "doseTotal", label: "Radiation", unit: "mSv", icon: "radiation", noBand: true },
    { metric: "mindScore", label: "Mind", unit: "%", icon: "brain" },
    { metric: "hrv_rmssd", label: "HRV", unit: "ms", icon: "activity" },
    { metric: "resting_hr", label: "Resting HR", unit: "bpm", icon: "heart-pulse" },
    { metric: "sleep_hours", label: "Sleep", unit: "h", icon: "moon" },
  ];
  let trendMetric = "recovery";
  $("trend-tabs").innerHTML = TRENDS.map((t) => `<button type="button" role="tab" data-metric="${t.metric}" aria-selected="${t.metric === trendMetric}">${ic(t.icon)}${t.label}</button>`).join("");
  $("trend-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-metric]");
    if (b) selectTrend(b.dataset.metric);
  });
  function selectTrend(metric) {
    trendMetric = metric;
    document.querySelectorAll("#trend-tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.metric === metric));
    drawTrend(true);
  }
  function normalRange(metric) {
    const base = days.slice(0, 14).map((d) => d[metric]);
    const mean = base.reduce((a, b) => a + b, 0) / base.length;
    const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length) || 1;
    return { low: mean - 2 * sd, high: mean + 2 * sd };
  }
  function niceTicks(min, max, count) {
    const step0 = (max - min) / count || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const start = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = start; ticks.length < 2 || ticks[ticks.length - 1] < max; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
  }
  function drawTrend(animate) {
    const svg = $("trend");
    const W = svg.clientWidth;
    if (!W) return;
    const Hh = 240;
    const m = { top: 14, right: 30, bottom: 26, left: 44 };
    svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    const t = TRENDS.find((x) => x.metric === trendMetric);
    const values = days.map((d) => d[trendMetric]);
    const range = t.noBand ? null : normalRange(trendMetric);
    let lo = Math.min(...values, range ? range.low : Infinity), hi = Math.max(...values, range ? range.high : -Infinity);
    const padv = (hi - lo) * 0.12;
    const ticks = niceTicks(lo - padv, hi + padv, 4);
    lo = ticks[0]; hi = ticks[ticks.length - 1];
    const x = (i) => m.left + (i / (values.length - 1)) * (W - m.left - m.right);
    const y = (v) => m.top + (1 - (v - lo) / (hi - lo)) * (Hh - m.top - m.bottom);
    const isOut = (v) => range && (v < range.low || v > range.high);
    const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const area = `${path}L${x(values.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z`;
    const xLabels = [0, 7, 14, 21, 29].map((i) => `<text x="${x(i)}" y="${Hh - 6}" text-anchor="middle">${fmtDate(days[i].date)}</text>`).join("");
    const dots = values.map((v, i) => {
      const last = i === values.length - 1;
      if (!isOut(v) && !last) return "";
      return `<circle class="dot${isOut(v) ? " out" : ""}" cx="${x(i)}" cy="${y(v)}" r="${last ? 5.5 : 4}"/>`;
    }).join("");
    const bandSvg = range ? `<rect class="band" x="${m.left}" width="${W - m.left - m.right}" y="${y(range.high)}" height="${Math.max(0, y(range.low) - y(range.high))}"/>
      <line class="band-edge" x1="${m.left}" x2="${W - m.right}" y1="${y(range.high)}" y2="${y(range.high)}"/>
      <line class="band-edge" x1="${m.left}" x2="${W - m.right}" y1="${y(range.low)}" y2="${y(range.low)}"/>` : "";
    svg.innerHTML = `
      <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2EEE6" stop-opacity="0.12"/><stop offset="1" stop-color="#F2EEE6" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${ticks.map((v) => `<line x1="${m.left}" x2="${W - m.right}" y1="${y(v)}" y2="${y(v)}"/>`).join("")}</g>
      ${bandSvg}
      <g class="axis">${ticks.map((v) => `<text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}${xLabels}</g>
      <path class="area" d="${area}"/>
      <path class="line${animate && !reduceMotion ? " draw" : ""}" d="${path}"/>
      ${dots}
      <line class="hover-line" id="hover-line" y1="${m.top}" y2="${Hh - m.bottom}" x1="-10" x2="-10"/>
      <rect id="hover-zone" x="${m.left}" y="0" width="${W - m.left - m.right}" height="${Hh}" fill="transparent"/>`;
    const line = svg.querySelector(".line");
    if (line.classList.contains("draw")) {
      const len = line.getTotalLength();
      line.style.setProperty("--len", len);
      line.style.strokeDasharray = len;
    }
    const tip = $("chart-tip");
    $("hover-zone").onmousemove = (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      const i = Math.round(((px - m.left) / (W - m.left - m.right)) * (values.length - 1));
      if (i < 0 || i >= values.length) return;
      const hl = $("hover-line");
      hl.setAttribute("x1", x(i)); hl.setAttribute("x2", x(i));
      tip.hidden = false;
      tip.innerHTML = `${fmtDate(days[i].date)} · <b>${values[i]} ${t.unit}</b>${isOut(values[i]) ? ' · <span class="is-watch">outside normal</span>' : ""}`;
      tip.style.left = (x(i) / W) * rect.width + "px";
      tip.style.top = (y(values[i]) / Hh) * rect.height + "px";
    };
    $("hover-zone").onmouseleave = () => { tip.hidden = true; $("hover-line").setAttribute("x1", -10); $("hover-line").setAttribute("x2", -10); };
  }
  window.addEventListener("resize", () => drawTrend(false));

  /* ---------- Raw readings (flight surgeon view) ---------- */
  head("raw-heading", "stethoscope", "Raw readings and their devices");
  function renderRaw() {
    const rows = [
      ["Resting heart rate", "resting_hr", "bpm"], ["Heart rate variability", "hrv_rmssd", "ms"], ["Blood oxygen", "spo2", "%"],
      ["Breathing rate", "resp_rate", "/min"], ["Skin temperature change", "skin_temp_delta", "°C"], ["Sleep", "sleep_hours", "h"],
      ["Blood pressure (top number)", "bp_systolic", "mmHg"], ["Blood pressure (bottom number)", "bp_diastolic", "mmHg"], ["Breathing depth while asleep", "breath_volume", "mL"],
      ["Deep sleep", "deep_sleep_pct", "%"], ["Exercise", "exercise_minutes", "min"], ["Radiation", "radiation_dose", "mSv"],
    ];
    const last5 = days.slice(-5);
    $("raw").innerHTML = `
      <thead><tr><th>Reading</th><th>Device</th>${last5.map((d) => `<th>${fmtDate(d.date)}</th>`).join("")}<th>Normal range</th></tr></thead>
      <tbody>${rows.map(([name, key, unit]) => {
        const b = baseline[key];
        const cells = last5.map((d) => `<td class="num ${b && (d[key] < b.low || d[key] > b.high) ? "is-watch" : ""}">${d[key]}</td>`).join("");
        return `<tr><td>${name} <span class="dim">${unit}</span>${H.isSample(key) ? sampleTag() : ""}</td><td>${deviceChip(today.sources[key])}</td>${cells}<td class="num">${b ? `${b.low.toFixed(1)}–${b.high.toFixed(1)}` : "–"}</td></tr>`;
      }).join("")}</tbody>`;
  }

  /* ---------- "?" help pop-ups ---------- */
  const HELP = {
    recovery: ["Recovery", "How ready your body is today, from 0 to 100. It compares last night's heart rate variability, resting heart rate and sleep with your own normal, using three different devices. 67 and up is Steady, 34 to 66 is Watch, 33 and below is Alert. (Placeholder formula for the demo.)"],
    radiation: ["Radiation", "Your total radiation dose this mission, from your radiation badge, and how much of NASA's 600 mSv career limit that is. The dial shows the share of the limit used."],
    mind: ["Mind", "How you're doing mentally, from 0 to 100. Mostly your daily mood check-in, plus how well you slept. Isolation and confinement are real risks on long missions. (Placeholder formula for the demo.)"],
    bodymap: ["Body map", "A 3D body with a label for each health area. The line shows where on the body it is. Orange marks an area that needs attention. Click a label to open its details. Drag to turn the body."],
    contributors: ["Overview", "The pieces that make up the score selected above, and which device or check-in each one comes from. This is the hub at work: one score built from several devices. Click Recovery, Radiation or Mind to switch."],
    alerts: ["Alerts", "How many things need your attention and how serious they are. Open the card to see what changed and what to do about it."],
    week: ["This week", "Seven days at a glance: two days back, today and four days ahead. An orange dot means something needs attention that day, a light dot means a health check is planned. Click a day to see its list. Calendar opens the whole month."],
    calendar: ["Calendar", "Each day gathers three things: alerts, health checks (due, overdue or planned) and that day's readings. Past days show the recovery score, in orange if it was below Steady. Use the buttons at the top to show only one kind or one health area. Click a day to see its details."],
    due: ["Due today", "Health checks you type in yourself, like blood pressure or a mood check, plus any device that hasn't synced for 24 hours. Click Log to add a result."],
    next: ["Coming up", "The next health checks on your schedule. How often each one happens is our own proposal; NASA's documents list the tests but not always how often."],
    history: ["Latest results", "The newest device readings and typed-in results, with where each one came from. Results outside the healthy range are marked in orange."],
    flow: ["How data flows", "Each wearable sends readings to its own web address (a webhook). The hub turns them into one common format and combines them, so it can spot patterns no single device could."],
    vitals: ["Vitals", "Overnight readings from your devices. The shaded strip in each mini chart is your normal range. A reading outside it is marked in orange."],
    trend: ["30-day trend", "The line shows the last 30 days. The shaded band is your normal range, worked out from your own earlier days. Orange dots mark days outside it."],
    raw: ["Raw readings", "The numbers behind the dashboard, with the device each one came from. Shown in the flight surgeon view only."],
    rhr: ["Resting heart rate", "Your heart rate while fully at rest overnight. A rise of several beats above your normal can mean fatigue, illness or stress."],
    hrv: ["Heart rate variability (HRV)", "The tiny changes in time between heartbeats, in milliseconds. Higher than your normal usually means well recovered; lower can mean stress, poor sleep or illness."],
    spo2: ["Blood oxygen (SpO2)", "How much of your blood is carrying oxygen. Usually 95% or higher."],
    resp: ["Breathing rate", "Breaths per minute while asleep. A rise above your normal can be an early sign of illness."],
    temp: ["Skin temperature", "Change from your normal overnight skin temperature. A rise can be an early sign of illness."],
    sleepv: ["Sleep", "Hours asleep last night, from your sleep headband."],
  };
  const pop = $("help-pop");
  let pinned = null;
  function showHelp(btn) {
    const [title, text] = HELP[btn.dataset.help] || (window.BM_HELP || {})[btn.dataset.help] || ["", ""];
    pop.innerHTML = `<b>${title}</b>${text}`;
    pop.classList.add("show");
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12) + "px";
    pop.style.top = (r.bottom + 10 + ph > window.innerHeight - 12 ? r.top - ph - 10 : r.bottom + 10) + "px";
  }
  const hideHelp = () => pop.classList.remove("show");
  document.addEventListener("mouseover", (e) => { const b = e.target.closest(".help"); if (b && !pinned) showHelp(b); });
  document.addEventListener("mouseout", (e) => { if (e.target.closest(".help") && !pinned) hideHelp(); });
  document.addEventListener("focusin", (e) => { const b = e.target.closest(".help"); if (b) showHelp(b); });
  document.addEventListener("focusout", (e) => { if (e.target.closest(".help") && !pinned) hideHelp(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".help");
    if (b) { e.stopPropagation(); e.preventDefault(); pinned = pinned === b ? null : b; pinned ? showHelp(b) : hideHelp(); }
    else if (pinned) { pinned = null; hideHelp(); }
  }, true);
  window.addEventListener("scroll", () => !pinned && hideHelp(), { passive: true });

  /* ---------- No live data at all: say so once, at the top ---------- */
  if (H.live.source === "sample") {
    document.querySelector(".main").insertAdjacentHTML("afterbegin",
      `<p class="sample-banner" role="status">${ic("info")}Showing sample data only: ${H.live.reason}.</p>`);
  }

  /* ---------- First draw ---------- */
  renderScores();
  renderContributors();
  renderAlerts();
  renderDue();
  renderHistory();
  renderDevices();
  renderVitals();
  renderRaw();
  showPage();
  drawTrend(true);
});

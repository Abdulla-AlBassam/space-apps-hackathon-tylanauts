/*
 * Draws the whole dashboard from window.HEALTH_DATA (made in data.js).
 * Pages (switched with the left rail, using the address bar's #):
 *   #today   – score cards, 3D body map (body-map.js), alerts, AI doctor, vitals, trends
 *   #log     – health check log: categories, what's due, schedule, history, "Log a result"
 *   #devices – my devices, how data flows, "Connect a device" walkthrough (a mock)
 * Every icon comes from icons.js (Lucide). All data is simulated.
 */
(function () {
  window.APP_HANDLES_HELP = true; // tells body-map.js that this file shows the "?" pop-ups

  const H = window.HEALTH_DATA;
  const { astronaut, devices, days, baseline, alerts, band, categories, tests, history, doctor } = H;
  const today = days[days.length - 1];
  const $ = (id) => document.getElementById(id);
  const ic = (name, cls) => window.icon(name, cls);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Small helpers ---------- */
  const STATUS_ICON = { good: "circle-check", watch: "triangle-alert", act: "octagon-alert", info: "info" };
  const WORDS = { good: "Normal", watch: "Watch", act: "Act now", info: "For info" };
  const pill = (level, word) => `<span class="pill is-${level}">${ic(STATUS_ICON[level])}${word || WORDS[level]}</span>`;
  const device = (id) => devices.find((d) => d.id === id);
  const deviceLabel = (id) => (device(id) || {}).label || id;
  const deviceChip = (id) => {
    if (id === "typed") return `<span class="chip">${ic("clipboard-pen")}Typed in</span>`;
    const d = device(id);
    return d ? `<span class="chip">${ic(d.icon)}${d.label}</span>` : "";
  };
  const head = (id, iconName, text) => { const el = $(id); if (el) el.innerHTML = ic(iconName) + text; };
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
    { id: "log", label: "Health log", icon: "clipboard-list" },
    { id: "devices", label: "Devices", icon: "watch" },
  ];
  $("rail").innerHTML =
    `<span class="rail-mark" title="Siryius">${ic("orbit")}</span>` +
    PAGES.map((p) => `<a href="#${p.id}" data-page="${p.id}">${ic(p.icon)}<span>${p.label}</span></a>`).join("") +
    `<a href="crew.html">${ic("users")}<span>Crew</span></a>` +
    `<a href="body-map.html">${ic("person-standing")}<span>Full body</span></a>`;

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
  $("brand").innerHTML = '<span class="logo-box" title="Logo placeholder">Logo</span><span>Siryius</span>'; // placeholder until the real logo and design language arrive
  $("astro-name").textContent = astronaut.name;
  $("astro-mission").innerHTML = ic("rocket") + astronaut.mission;
  $("mission-label").innerHTML = `${ic("calendar")}Day <b>${astronaut.missionDay}</b> of ${astronaut.missionLength}`;
  $("mission-fill").style.width = (astronaut.missionDay / astronaut.missionLength) * 100 + "%";

  function renderStatusPill() {
    const open = alerts.filter((a) => !a.done);
    const level = open.some((a) => a.level === "act") ? "act" : open.some((a) => a.level === "watch") ? "watch" : "good";
    const el = $("status-pill");
    el.className = "status-pill is-" + level;
    el.innerHTML = ic(STATUS_ICON[level]) + (level === "good" ? "All normal" : level === "watch" ? "Keep an eye on" : "Needs action");
  }

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
    renderDoctor();
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
      unit: "%",
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
      level: "good",
      word: `${today.doseLimitPct}% of limit`,
      line: `${today.radiation_dose} mSv today. Career limit ${H.careerLimit} mSv.`,
    },
    {
      key: "mind",
      title: "Mind",
      icon: "brain",
      value: today.mindScore,
      ringPct: today.mindScore,
      unit: "%",
      level: band(today.mindScore),
      line: `Mood ${today.mood}/5 in today's check-in.`,
    },
  ];

  function ring(s) {
    const r = 46;
    const full = 2 * Math.PI * r;
    const offset = full * (1 - Math.min(100, s.ringPct) / 100);
    const colour = { good: "#2E96F5", watch: "#EAFE07", act: "#E43700" }[s.level];
    return `<svg class="ring" viewBox="0 0 112 112" aria-hidden="true">
      <circle class="track" cx="56" cy="56" r="${r}"/>
      <circle class="value" cx="56" cy="56" r="${r}" stroke="${colour}"
        stroke-dasharray="${full}" stroke-dashoffset="${offset}" style="--full:${full}"/>
      <text class="num" x="56" y="62">${s.value}</text>
      <text class="unit" x="56" y="80">${s.unit}</text>
    </svg>`;
  }

  let selectedScore = "recovery";
  function renderScores() {
    $("scores").innerHTML = SCORES.map(
      (s) => `
      <div class="panel score${s.key === selectedScore ? " selected" : ""}" role="button" tabindex="0"
           data-score="${s.key}" aria-pressed="${s.key === selectedScore}"
           aria-label="${s.title} ${s.value} ${s.unit}. Show what's behind it">
        ${ring(s)}
        <div class="score-text">
          <div class="score-title"><span class="title-ico is-${s.level}">${ic(s.icon)}</span>${s.title} ${helpBtn(s.key)}</div>
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
  function selectScore(key) {
    selectedScore = key;
    document.querySelectorAll("[data-score]").forEach((el) => {
      el.classList.toggle("selected", el.dataset.score === key);
      el.setAttribute("aria-pressed", el.dataset.score === key);
    });
    renderContributors();
    selectTrend({ recovery: "recovery", radiation: "doseTotal", mind: "mindScore" }[key]);
  }

  /* ---------- What's behind each score ---------- */
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
  function renderContributors() {
    const s = SCORES.find((x) => x.key === selectedScore);
    $("contrib-title").innerHTML = ic(s.icon) + `What's behind ${s.title}`;
    $("contrib").innerHTML = contributorRows(selectedScore)
      .map((r) => {
        const level = r.neutral ? "good" : band(r.v);
        return `<div class="contrib-row">
          <span class="contrib-ico is-${level}">${ic(r.icon)}</span>
          <div>${r.q}<div class="contrib-note">${r.note} · ${deviceChip(r.src)}</div></div>
          <div class="contrib-bar is-${level}"><span style="width:0%" data-w="${Math.min(100, r.v)}%"></span></div>
          <div class="contrib-num is-${level}">${r.pctLabel || r.v}</div>
        </div>`;
      })
      .join("");
    requestAnimationFrame(() => document.querySelectorAll(".contrib-bar span").forEach((el) => (el.style.width = el.dataset.w)));
  }

  /* ---------- Body map heading ---------- */
  head("bm-heading", "person-standing", "Body map");
  $("bm-full").innerHTML = ic("person-standing") + "Full screen";

  /* ---------- Alerts ---------- */
  head("alerts-heading", "bell-ring", "Alerts and actions");
  function renderAlerts() {
    $("alert-list").innerHTML = alerts
      .map(
        (a, i) => `<div class="alert ${a.level}${a.done ? " done" : ""}">
        <div class="alert-top">${pill(a.level)}${a.combined ? `<span class="badge">${ic("sparkles")}Combined devices</span>` : ""}${a.device ? `<span class="badge">${ic("wifi-off")}Device</span>` : ""}</div>
        <h3>${a.title}</h3>
        <p>${a.detail}</p>
        <div class="chips">${(a.sources || []).map(deviceChip).join("")}</div>
        <ul>${a.actions.map((x) => `<li>${x}</li>`).join("")}</ul>
        ${a.level === "info" ? "" : `<button type="button" class="btn-ghost" data-alert="${i}">${ic(a.done ? "refresh-cw" : "check")}${a.done ? "Undo" : "Mark as done"}</button>`}
      </div>`
      )
      .join("");
    renderStatusPill();
  }
  $("alert-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-alert]");
    if (!b) return;
    const a = alerts[+b.dataset.alert];
    a.done = !a.done;
    renderAlerts();
  });

  /* ---------- AI doctor (idea preview, scripted) ---------- */
  let doctorState = { sent: false, asked: false };
  function renderDoctor() {
    const d = doctor;
    $("doctor").innerHTML = `
      <div class="panel-head"><h2>${ic("bot")}AI doctor</h2>${helpBtn("doctor")}<span class="spacer"></span><span class="badge">${ic("sparkles")}Idea preview</span></div>
      <div class="doc-tier">${pill(d.tier.level, `Tier ${d.tier.n} · ${d.tier.word}`)}<span class="doc-based">Based on ${d.basedOn.map((id) => `<span title="${deviceLabel(id)}">${ic(device(id).icon)}</span>`).join("")}</span></div>
      <div class="bubble">${ic("bot", "bubble-ico")}<p>${d.message}</p></div>
      <div class="chips">${d.suggestions.map((s) => `<span class="chip">${ic("check")}${s}</span>`).join("")}</div>
      ${doctorState.asked ? `<div class="bubble me"><p>Should I skip today's run?</p></div>
        <div class="bubble">${ic("bot", "bubble-ico")}<p>Swap it for a light bike session. Your heart needs an easier day, and you'll still protect your bones and muscles.</p></div>` : ""}
      <div class="doc-actions">
        <button type="button" class="btn-ghost" id="doc-ask" ${doctorState.asked ? "disabled" : ""}>${ic("message-circle")}Ask: should I skip my run?</button>
        <button type="button" class="btn-primary small" id="doc-send" ${doctorState.sent ? "disabled" : ""}>${ic(doctorState.sent ? "check" : "send")}${doctorState.sent ? "Summary sent" : "Send summary to flight surgeon"}</button>
      </div>
      ${doctorState.sent ? `<p class="doc-note">${ic("satellite")}Sent to ${surgeon ? "you (flight surgeon)" : "your flight surgeon"}. From the Moon a message takes about 1.3 seconds each way; from Mars it can take up to 22 minutes.</p>` : ""}
      <p class="doc-disclaimer">${ic("shield-check")}Suggestions only. Not a medical device. Serious issues go to a real doctor.</p>`;
  }
  $("doctor").addEventListener("click", (e) => {
    if (e.target.closest("#doc-send")) { doctorState.sent = true; renderDoctor(); toast("Summary sent to the flight surgeon"); }
    if (e.target.closest("#doc-ask")) { doctorState.asked = true; renderDoctor(); }
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
    const html =
      items
        .map(({ t, level, word }) => `<div class="due">
          <span class="due-ico">${ic(catOf(t.cat).icon)}</span>
          <div class="due-text"><b>${t.name}</b><span>${catOf(t.cat).name} · ${t.every}</span></div>
          ${pill(level, word)}
          ${t.how === "reminder" ? "" : `<button type="button" class="btn-ghost small" data-log="${t.id}">${ic("plus")}Log</button>`}
        </div>`)
        .join("") +
      unsynced
        .map((d) => `<div class="due">
          <span class="due-ico">${ic(d.icon)}</span>
          <div class="due-text"><b>${d.label} not synced</b><span>Last reading ${Math.round(d.lastSyncHours)} h ago</span></div>
          ${pill("watch", "24 h+")}
          <a class="btn-ghost small" href="#devices">${ic("wifi-off")}Check</a>
        </div>`)
        .join("");
    const empty = `<p class="empty">${ic("circle-check")}Nothing due. You're all caught up.</p>`;
    $("due-today").innerHTML = html || empty;
    $("due-full").innerHTML = html || empty;
    head("due-heading", "calendar-clock", `Due today <span class="count">${items.length + unsynced.length}</span>`);
    head("log-due-heading", "calendar-clock", `Due and overdue <span class="count">${items.length + unsynced.length}</span>`);
    $("due-all").innerHTML = ic("clipboard-list") + "Health log";
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-log]");
    if (b) openLogModal(b.dataset.log);
  });

  /* ---------- Health log page ---------- */
  head("log-title", "clipboard-list", "Health log");
  $("log-new").innerHTML = ic("plus") + "Log a result";
  $("log-new").addEventListener("click", () => openLogModal());
  head("sched-heading", "calendar", "Schedule");
  head("hist-heading", "history", "History");

  function catStatus(cat) {
    const ts = typedTests().filter((t) => t.cat === cat.id);
    if (ts.some((t) => t.dueInDays < 0)) return "act";
    if (ts.some((t) => t.dueInDays === 0)) return "watch";
    if (history.some((h) => h.cat === cat.id && h.out)) return "watch";
    return "good";
  }
  function renderCategories() {
    $("cat-grid").innerHTML = categories
      .map((c) => {
        const ts = tests.filter((t) => t.cat === c.id);
        const auto = ts.filter((t) => t.how === "auto").length;
        const next = typedTests().filter((t) => t.cat === c.id).sort((a, b) => a.dueInDays - b.dueInDays)[0];
        const last = history.find((h) => h.cat === c.id);
        const st = catStatus(c);
        return `<div class="panel cat">
          <div class="cat-top"><span class="cat-ico is-${st}">${ic(c.icon)}</span>${pill(st)}</div>
          <h3>${c.name}</h3>
          <p>${ic("history")}Last: ${last ? `${last.test}, ${last.when.toLowerCase()}` : "nothing yet"}</p>
          <p>${ic("calendar-clock")}Next: ${next ? (next.dueInDays <= 0 ? `${next.name} (${next.dueInDays < 0 ? "overdue" : "today"})` : `${next.name} in ${next.dueInDays} d`) : "–"}</p>
          <p>${ic("plug")}${auto} from devices · ${ts.length - auto} typed in</p>
        </div>`;
      })
      .join("");
  }
  function renderSchedule() {
    $("schedule").innerHTML = `<thead><tr><th>Test</th><th>How</th><th>How often</th><th>Next</th></tr></thead><tbody>${tests
      .map((t) => {
        const how = t.how === "auto" ? deviceChip(t.device) : t.how === "reminder" ? `<span class="chip">${ic("bell")}Reminder</span>` : deviceChip("typed");
        const next = t.dueInDays == null ? "Automatic" : t.dueInDays < 0 ? `<span class="is-watch">Overdue</span>` : t.dueInDays === 0 ? "Today" : `In ${t.dueInDays} d`;
        return `<tr><td><span class="td-ico">${ic(catOf(t.cat).icon)}</span>${t.name}</td><td>${how}</td><td>${t.every}</td><td>${next}</td></tr>`;
      })
      .join("")}</tbody>`;
  }
  function renderHistory() {
    $("history").innerHTML = `<thead><tr><th>When</th><th>Test</th><th>Result</th><th>Source</th><th>Note</th></tr></thead><tbody>${history
      .map(
        (h) => `<tr><td>${h.when}</td><td><span class="td-ico">${ic(catOf(h.cat).icon)}</span>${h.test}</td>
          <td class="num ${h.out ? "is-watch" : ""}">${h.out ? ic("triangle-alert") : ""}${h.value}</td>
          <td>${deviceChip(h.source)}</td><td class="dim">${h.note || ""}</td></tr>`
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
      renderDue(); renderCategories(); renderSchedule(); renderHistory();
      toast(`${t.name.replace(/ \(1-5\)$/, "")} saved${out ? ", flagged as outside the healthy range" : ""}`);
    });
  }

  /* ---------- Devices page ---------- */
  head("dev-title", "watch", "My devices");
  $("dev-connect").innerHTML = ic("plus") + "Connect a device";
  $("dev-connect").addEventListener("click", () => openWizard());

  $("flow").innerHTML = `
    <div class="flow-step">${ic("watch")}${ic("heart-pulse")}${ic("headphones")}<span>Wearables</span></div>
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
        return `<div class="panel dev${stale ? " stale" : ""}">
          <div class="dev-top"><span class="dev-ico">${ic(d.icon)}</span>
            <div><h3>${d.label}</h3><p class="dim">${d.model}</p></div>
            ${stale ? pill("watch", "Not synced") : pill("good", "Connected")}</div>
          <div class="dev-stats">
            <span>${ic(stale ? "wifi-off" : "wifi")}Synced ${synced}</span>
            <span class="${d.battery < 25 ? "is-watch" : ""}">${ic(batteryIcon(d.battery))}${d.battery}%</span>
          </div>
          <div class="chips">${d.measures.map((m) => `<span class="chip">${ic("activity")}${m}</span>`).join("")}</div>
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
      body = `<div class="wiz-art">${ic(k.icon)}<span class="pulse-ring"></span></div>
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
        : `<div class="wiz-art">${ic("loader", "spin")}</div><p>Waiting for a test reading from your ${k.label.toLowerCase()}…</p>`;
      if (!wiz.tested) setTimeout(() => { if (wiz && wiz.step === 3) { wiz.tested = true; renderWizard(); } }, 1300);
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
    const bandRect = low != null ? `<rect x="0" y="${y(high).toFixed(1)}" width="${w}" height="${(y(low) - y(high)).toFixed(1)}" fill="rgba(46,150,245,0.12)"/>` : "";
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${bandRect}
      <polyline points="${pts}" fill="none" stroke="#2E96F5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="2.5" fill="currentColor"/></svg>`;
  }
  function renderVitals() {
    $("vitals").innerHTML = VITALS.map((v) => {
      const value = today[v.metric];
      const b = baseline[v.metric];
      const out = b && (value < b.low || value > b.high);
      const shown = v.signed && value > 0 ? "+" + value : value;
      const src = device(today.sources[v.metric]);
      return `<div class="vital ${out ? "out" : ""}">
        <div class="vital-name"><span class="vital-ico ${out ? "is-watch" : "is-good"}">${ic(v.icon)}</span>${v.name} ${helpBtn(v.help)}</div>
        <div class="vital-value">${shown}<small>${v.unit}</small></div>
        <div class="vital-flag">${out ? pill("watch", "Outside normal") : pill("good", "Normal for you")}</div>
        <div class="${out ? "is-watch" : "is-good"}">${sparkline(days.slice(-14).map((d) => d[v.metric]), b ? b.low : null, b ? b.high : null)}</div>
        <div class="vital-src">${ic(src.icon)}${src.label}</div>
      </div>`;
    }).join("");
  }

  /* ---------- 30-day trend chart ---------- */
  head("trend-heading", "chart-line", "Last 30 days");
  $("chart-legend").innerHTML = `<span><i class="swatch"></i>Your normal range</span><span>${ic("triangle-alert", "is-watch")}Outside normal</span>`;
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
      return `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="${last ? 5.5 : 4}" fill="${isOut(v) ? "#EAFE07" : "#2E96F5"}"/>`;
    }).join("");
    const bandSvg = range ? `<rect class="band" x="${m.left}" width="${W - m.left - m.right}" y="${y(range.high)}" height="${Math.max(0, y(range.low) - y(range.high))}"/>
      <line class="band-edge" x1="${m.left}" x2="${W - m.right}" y1="${y(range.high)}" y2="${y(range.high)}"/>
      <line class="band-edge" x1="${m.left}" x2="${W - m.right}" y1="${y(range.low)}" y2="${y(range.low)}"/>` : "";
    svg.innerHTML = `
      <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E96F5" stop-opacity="0.28"/><stop offset="1" stop-color="#2E96F5" stop-opacity="0"/></linearGradient></defs>
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
      ["Deep sleep", "deep_sleep_pct", "%"], ["Exercise", "exercise_minutes", "min"], ["Radiation", "radiation_dose", "mSv"],
    ];
    const last5 = days.slice(-5);
    $("raw").innerHTML = `
      <thead><tr><th>Reading</th><th>Device</th>${last5.map((d) => `<th>${fmtDate(d.date)}</th>`).join("")}<th>Normal range</th></tr></thead>
      <tbody>${rows.map(([name, key, unit]) => {
        const b = baseline[key];
        const cells = last5.map((d) => `<td class="num ${b && (d[key] < b.low || d[key] > b.high) ? "is-watch" : ""}">${d[key]}</td>`).join("");
        return `<tr><td>${name} <span class="dim">${unit}</span></td><td>${deviceChip(today.sources[key])}</td>${cells}<td class="num">${b ? `${b.low.toFixed(1)}–${b.high.toFixed(1)}` : "–"}</td></tr>`;
      }).join("")}</tbody>`;
  }

  /* ---------- "?" help pop-ups ---------- */
  const HELP = {
    recovery: ["Recovery", "How ready your body is today, from 0 to 100%. It compares last night's heart rate variability, resting heart rate and sleep with your own normal, using three different devices. 67% and up is Normal, 34 to 66% is Watch, 33% and below is Act now. (Placeholder formula for the demo.)"],
    radiation: ["Radiation", "Your total radiation dose this mission, from your radiation badge, and how much of NASA's 600 mSv career limit that is. The ring shows the share of the limit used."],
    mind: ["Mind", "How you're doing mentally, from 0 to 100%. Mostly your daily mood check-in, plus how well you slept. Isolation and confinement are real risks on long missions. (Placeholder formula for the demo.)"],
    bodymap: ["Body map", "A 3D body with a label for each health area. The line shows where on the body it is. Colours show today's status. Click a label to open its details. Drag to turn the body."],
    contributors: ["What's behind the score", "The pieces that make up the score you selected, and which device or check-in each one comes from. Click a different score card to switch."],
    alerts: ["Alerts and actions", "What changed and what to do about it. Some warnings only appear when two devices are combined, which is the point of the hub. Act now is shown only when several signals agree."],
    doctor: ["AI doctor (idea)", "A preview of an idea we're exploring: an assistant that explains your data in plain words, suggests simple actions, and sends a summary to a real flight surgeon when something is serious. These messages are scripted for the demo."],
    due: ["Due today", "Health checks you type in yourself, like blood pressure or a mood check, plus any device that hasn't synced for 24 hours. Click Log to add a result."],
    schedule: ["Schedule", "Every test in the health log and how often it happens. Device readings fill in automatically. Most frequencies are our own proposal; NASA's documents list the tests but not always how often."],
    history: ["History", "Device readings and typed-in results together, newest first, with where each one came from. Results outside the healthy range are flagged."],
    flow: ["How data flows", "Each wearable sends readings to its own web address (a webhook). The hub turns them into one common format and combines them, so it can spot patterns no single device could."],
    vitals: ["Vitals", "Overnight readings from your devices. The shaded strip in each mini chart is your normal range. A reading outside it gets a yellow outline."],
    trend: ["30-day trend", "The line shows the last 30 days. The shaded band is your normal range, worked out from your own earlier days. Yellow dots mark days outside it."],
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
    if (b) { e.stopPropagation(); pinned = pinned === b ? null : b; pinned ? showHelp(b) : hideHelp(); }
    else if (pinned) { pinned = null; hideHelp(); }
  }, true);
  window.addEventListener("scroll", () => !pinned && hideHelp(), { passive: true });

  /* ---------- Space background ----------
   * Stars slowly turning around a dark mass below the screen, a few drifting dark
   * clouds, and the faint edge of a planet in the corner. Brand blues and white only.
   */
  const canvas = $("space");
  const ctx = canvas.getContext("2d");
  let W = 0, Hc = 0, stars = [], clouds = [];
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; Hc = window.innerHeight;
    canvas.width = W * dpr; canvas.height = Hc * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((W * Hc) / 5200) }, () => {
      const depth = Math.random();
      return { a: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * Math.hypot(W, Hc) * 1.1, size: 0.4 + depth * 1.4,
        speed: 0.00002 + depth * 0.00005, alpha: 0.25 + depth * 0.6, twinkle: Math.random() * Math.PI * 2, blue: Math.random() < 0.3 };
    });
    clouds = Array.from({ length: 4 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * Hc, r: Math.max(W, Hc) * (0.25 + Math.random() * 0.2),
      dx: (Math.random() - 0.5) * 0.06, dy: (Math.random() - 0.5) * 0.04, tint: i % 2 ? "0,66,166" : "0,0,0" }));
  }
  function frame(t) {
    ctx.fillStyle = "#07173F";
    ctx.fillRect(0, 0, W, Hc);
    for (const c of clouds) {
      c.x += c.dx; c.y += c.dy;
      if (c.x < -c.r) c.x = W + c.r; if (c.x > W + c.r) c.x = -c.r;
      if (c.y < -c.r) c.y = Hc + c.r; if (c.y > Hc + c.r) c.y = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(${c.tint},0.35)`); g.addColorStop(1, `rgba(${c.tint},0)`);
      ctx.fillStyle = g; ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }
    const cx = W * 0.15, cy = Hc * 1.35;
    for (const s of stars) {
      s.a += s.speed * 16;
      const x = cx + Math.cos(s.a) * s.r, y = cy + Math.sin(s.a) * s.r;
      if (x < -4 || x > W + 4 || y < -4 || y > Hc + 4) continue;
      const tw = 0.75 + 0.25 * Math.sin(t * 0.0012 + s.twinkle);
      ctx.fillStyle = s.blue ? `rgba(46,150,245,${s.alpha * tw})` : `rgba(255,255,255,${s.alpha * tw})`;
      ctx.beginPath(); ctx.arc(x, y, s.size, 0, Math.PI * 2); ctx.fill();
    }
    const pr = Math.max(W, Hc) * 0.55, px = W + pr * 0.35, py = Hc + pr * 0.45;
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.2, px, py, pr);
    pg.addColorStop(0, "rgba(0,66,166,0.0)"); pg.addColorStop(0.85, "rgba(0,66,166,0.18)");
    pg.addColorStop(0.985, "rgba(46,150,245,0.35)"); pg.addColorStop(1, "rgba(46,150,245,0)");
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  /* ---------- First draw ---------- */
  renderScores();
  renderContributors();
  renderAlerts();
  renderDoctor();
  renderDue();
  renderCategories();
  renderSchedule();
  renderHistory();
  renderDevices();
  renderVitals();
  renderRaw();
  showPage();
  drawTrend(true);
})();

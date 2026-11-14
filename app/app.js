/*
 * Draws the dashboard from window.HEALTH_DATA (made in data.js).
 * Sections, top to bottom: star-field background, header, score cards,
 * "what's behind this score", vitals, 30-day trend, raw readings (flight surgeon only),
 * alerts, check-in, devices, and the "?" help pop-ups.
 */
(function () {
  const H = window.HEALTH_DATA;
  const { astronaut, devices, days, baseline, alerts, band } = H;
  const today = days[days.length - 1];
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Small helpers ---------- */
  const ICONS = {
    good: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.2l2 2 4-4.2"/></svg>',
    watch: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 1.8l6.6 12H1.4z" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.3"/></svg>',
    act: '<svg class="ico" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7.2"/><path d="M8 4v4.8M8 11v.4" stroke="#07173F" stroke-width="1.9" stroke-linecap="round"/></svg>',
    info: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v4M8 4.8v.3"/></svg>',
  };
  const WORDS = { good: "Normal", watch: "Watch", act: "Act now", info: "For info" };
  const deviceLabel = (id) => (devices.find((d) => d.id === id) || {}).label || id;
  const fmtDate = (iso) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const helpBtn = (key) => `<button type="button" class="help" data-help="${key}" aria-label="What is this?">?</button>`;

  /* ---------- Header ---------- */
  $("astro-name").textContent = astronaut.name;
  $("astro-mission").textContent = astronaut.mission;
  $("mission-label").innerHTML = `Day <b>${astronaut.missionDay}</b> of ${astronaut.missionLength}`;
  $("mission-fill").style.width = (astronaut.missionDay / astronaut.missionLength) * 100 + "%";

  function renderStatusPill() {
    const open = alerts.filter((a) => !a.done);
    const level = open.some((a) => a.level === "act") ? "act" : open.some((a) => a.level === "watch") ? "watch" : "good";
    const pill = $("status-pill");
    pill.className = "status-pill is-" + level;
    pill.innerHTML = ICONS[level] + (level === "good" ? "All normal" : level === "watch" ? "Keep an eye on" : "Needs action");
  }

  /* ---------- Score cards ---------- */
  function strainWord(s) {
    if (s < 10) return "Light day";
    if (s < 14) return "Moderate day";
    if (s < 18) return "Hard day";
    return "All out";
  }

  const SCORES = [
    {
      key: "recovery",
      title: "Recovery",
      value: today.recovery,
      max: 100,
      unit: "%",
      level: band(today.recovery),
      line: "How ready your body is for today.",
    },
    {
      key: "strain",
      title: "Strain",
      value: today.strain,
      max: 21,
      unit: "of 21",
      level: "good",
      word: strainWord(today.strain),
      line: "How hard your body worked yesterday.",
    },
    {
      key: "sleep",
      title: "Sleep",
      value: today.sleepScore,
      max: 100,
      unit: "%",
      level: band(today.sleepScore),
      line: `${Math.floor(today.sleep_hours)}h ${Math.round((today.sleep_hours % 1) * 60)}m last night.`,
    },
  ];

  function ring(value, max, unit, level) {
    const r = 46;
    const full = 2 * Math.PI * r;
    const offset = full * (1 - value / max);
    const colour = { good: "#2E96F5", watch: "#EAFE07", act: "#E43700" }[level];
    return `<svg class="ring" viewBox="0 0 112 112" aria-hidden="true">
      <circle class="track" cx="56" cy="56" r="${r}"/>
      <circle class="value" cx="56" cy="56" r="${r}" stroke="${colour}"
        stroke-dasharray="${full}" stroke-dashoffset="${offset}" style="--full:${full}"/>
      <text class="num" x="56" y="62">${value}</text>
      <text class="unit" x="56" y="80">${unit}</text>
    </svg>`;
  }

  let selectedScore = "recovery";
  function renderScores() {
    $("scores").innerHTML = SCORES.map(
      (s) => `
      <div class="panel score${s.key === selectedScore ? " selected" : ""}" role="button" tabindex="0"
           data-score="${s.key}" aria-pressed="${s.key === selectedScore}"
           aria-label="${s.title} ${s.value} ${s.unit}. Show what's behind it">
        ${ring(s.value, s.max, s.unit, s.level)}
        <div class="score-text">
          <div class="score-title">${s.title} ${helpBtn(s.key)}</div>
          <div class="score-word is-${s.level}">${ICONS[s.level]}${s.word || WORDS[s.level]}</div>
          <p class="score-line">${s.line}</p>
        </div>
      </div>`
    ).join("");
  }

  $("scores").addEventListener("click", (e) => {
    if (e.target.closest(".help")) return;
    const card = e.target.closest("[data-score]");
    if (!card) return;
    selectScore(card.dataset.score);
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
    const metric = { recovery: "recovery", strain: "strain", sleep: "sleep_hours" }[key];
    selectTrend(metric);
  }

  /* ---------- What's behind each score ---------- */
  function contributorRows(key) {
    const b = baseline;
    if (key === "recovery") {
      return [
        { q: "Is your heart rate variability normal for you?", v: today.recoveryParts.hrv, note: `${today.hrv_rmssd} ms (usual ${Math.round(b.hrv_rmssd.mean)})` },
        { q: "Is your resting heart rate normal for you?", v: today.recoveryParts.rhr, note: `${today.resting_hr} bpm (usual ${Math.round(b.resting_hr.mean)})` },
        { q: "Did you get enough sleep?", v: today.recoveryParts.sleep, note: `${today.sleep_hours} h of 8 h` },
      ];
    }
    if (key === "strain") {
      return [
        { q: "How long did you exercise?", v: Math.round(Math.min(100, (today.exercise_minutes / 150) * 100)), note: `${Math.round(today.exercise_minutes)} min of 150 planned`, neutral: true },
        { q: "How hard was your heart working?", v: Math.round(Math.min(100, (today.avg_exercise_hr / 170) * 100)), note: `${today.avg_exercise_hr} bpm average`, neutral: true },
      ];
    }
    return [
      { q: "Did you sleep long enough?", v: Math.round(Math.min(100, (today.sleep_hours / 8) * 100)), note: `${today.sleep_hours} h of 8 h` },
      { q: "Did you get enough deep sleep?", v: Math.round(Math.min(100, (today.deep_sleep_pct / 20) * 100)), note: `${today.deep_sleep_pct}% of the night (aim 20%)` },
    ];
  }

  function renderContributors() {
    const s = SCORES.find((x) => x.key === selectedScore);
    $("contrib-title").textContent = `What's behind ${s.title}`;
    $("contrib").innerHTML = contributorRows(selectedScore)
      .map((r) => {
        const level = r.neutral ? "good" : band(r.v);
        return `<div class="contrib-row">
          <div>${r.q}<div style="font-size:12px;color:var(--text-faint)">${r.note}</div></div>
          <div class="contrib-bar is-${level}"><span style="width:0%" data-w="${r.v}%"></span></div>
          <div class="contrib-num is-${level}">${r.v}</div>
        </div>`;
      })
      .join("");
    requestAnimationFrame(() =>
      document.querySelectorAll(".contrib-bar span").forEach((el) => (el.style.width = el.dataset.w))
    );
  }

  /* ---------- Vitals ---------- */
  const VITALS = [
    { metric: "resting_hr", name: "Resting heart rate", unit: "bpm", help: "rhr" },
    { metric: "hrv_rmssd", name: "Heart rate variability", unit: "ms", help: "hrv" },
    { metric: "spo2", name: "Blood oxygen", unit: "%", help: "spo2" },
    { metric: "resp_rate", name: "Breathing rate", unit: "/min", help: "resp" },
    { metric: "skin_temp_delta", name: "Skin temperature", unit: "°C", help: "temp", signed: true },
    { metric: "radiation_dose", name: "Radiation today", unit: "mSv", help: "radiation", noBand: true },
  ];

  function sparkline(values, low, high) {
    const w = 140, h = 30, pad = 3;
    const all = values.concat(low != null ? [low, high] : []);
    const min = Math.min(...all), max = Math.max(...all);
    const x = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const bandRect = low != null
      ? `<rect x="0" y="${y(high).toFixed(1)}" width="${w}" height="${(y(low) - y(high)).toFixed(1)}" fill="rgba(46,150,245,0.12)"/>`
      : "";
    const last = values[values.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${bandRect}
      <polyline points="${pts}" fill="none" stroke="#2E96F5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(values.length - 1)}" cy="${y(last)}" r="2.5" fill="currentColor"/>
    </svg>`;
  }

  function renderVitals() {
    $("vitals").innerHTML = VITALS.map((v) => {
      const value = today[v.metric];
      const b = baseline[v.metric];
      const out = b && !v.noBand && (value < b.low || value > b.high);
      const recent = days.slice(-14).map((d) => d[v.metric]);
      const shown = v.signed && value > 0 ? "+" + value : value;
      const flag = v.noBand
        ? `<span class="is-info">Mission total ${today.doseTotal} mSv</span>`
        : out
        ? `<span class="is-watch">${ICONS.watch}Outside normal</span>`
        : `<span class="is-good">${ICONS.good}Normal for you</span>`;
      return `<div class="vital ${out ? "out is-watch" : ""}">
        <div class="vital-name">${v.name} ${helpBtn(v.help)}</div>
        <div class="vital-value">${shown}<small>${v.unit}</small></div>
        <div class="vital-flag">${flag}</div>
        <div class="${out ? "is-watch" : "is-good"}">${sparkline(recent, b && !v.noBand ? b.low : null, b && !v.noBand ? b.high : null)}</div>
        <div class="vital-src">from ${deviceLabel(today.sources[v.metric])}</div>
      </div>`;
    }).join("");
  }

  /* ---------- 30-day trend chart ---------- */
  const TRENDS = [
    { metric: "recovery", label: "Recovery", unit: "%" },
    { metric: "hrv_rmssd", label: "HRV", unit: "ms" },
    { metric: "resting_hr", label: "Resting HR", unit: "bpm" },
    { metric: "sleep_hours", label: "Sleep", unit: "h" },
    { metric: "strain", label: "Strain", unit: "" },
  ];
  let trendMetric = "recovery";

  $("trend-tabs").innerHTML = TRENDS.map(
    (t) => `<button type="button" role="tab" data-metric="${t.metric}" aria-selected="${t.metric === trendMetric}">${t.label}</button>`
  ).join("");
  $("trend-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-metric]");
    if (b) selectTrend(b.dataset.metric);
  });

  function selectTrend(metric) {
    trendMetric = metric;
    document.querySelectorAll("#trend-tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.metric === metric));
    drawTrend(true);
  }

  // The normal range for any metric: average of the first 14 days, plus or minus two spreads.
  function normalRange(metric) {
    const base = days.slice(0, 14).map((d) => d[metric]);
    const mean = base.reduce((a, b) => a + b, 0) / base.length;
    const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length) || 1;
    return { low: mean - 2 * sd, high: mean + 2 * sd };
  }

  function niceTicks(min, max, count) {
    const step0 = (max - min) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const start = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = start; ticks.length < 2 || ticks[ticks.length - 1] < max; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
  }

  function drawTrend(animate) {
    const svg = $("trend");
    const W = svg.clientWidth || 800, Hh = 260;
    const m = { top: 14, right: 30, bottom: 26, left: 44 };
    svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    const t = TRENDS.find((x) => x.metric === trendMetric);
    const values = days.map((d) => d[trendMetric]);
    const range = normalRange(trendMetric);

    let lo = Math.min(...values, range.low), hi = Math.max(...values, range.high);
    const padv = (hi - lo) * 0.12;
    const ticks = niceTicks(lo - padv, hi + padv, 4);
    lo = ticks[0];
    hi = ticks[ticks.length - 1];

    const x = (i) => m.left + (i / (values.length - 1)) * (W - m.left - m.right);
    const y = (v) => m.top + (1 - (v - lo) / (hi - lo)) * (Hh - m.top - m.bottom);

    const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const area = `${path}L${x(values.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z`;
    const xLabels = [0, 7, 14, 21, 29]
      .map((i) => `<text x="${x(i)}" y="${Hh - 6}" text-anchor="middle">${fmtDate(days[i].date)}</text>`)
      .join("");
    const dots = values
      .map((v, i) => {
        const out = v < range.low || v > range.high;
        const isLast = i === values.length - 1;
        if (!out && !isLast) return "";
        return `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="${isLast ? 5.5 : 4}" fill="${out ? "#EAFE07" : "#2E96F5"}"/>`;
      })
      .join("");

    svg.innerHTML = `
      <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2E96F5" stop-opacity="0.28"/><stop offset="1" stop-color="#2E96F5" stop-opacity="0"/>
      </linearGradient></defs>
      <g class="grid">${ticks.map((v) => `<line x1="${m.left}" x2="${W - m.right}" y1="${y(v)}" y2="${y(v)}"/>`).join("")}</g>
      <rect class="band" x="${m.left}" width="${W - m.left - m.right}" y="${y(range.high)}" height="${Math.max(0, y(range.low) - y(range.high))}"/>
      <line class="band-edge" x1="${m.left}" x2="${W - m.right}" y1="${y(range.high)}" y2="${y(range.high)}"/>
      <line class="band-edge" x1="${m.left}" x2="${W - m.right}" y1="${y(range.low)}" y2="${y(range.low)}"/>
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
    const zone = $("hover-zone");
    zone.onmousemove = (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      const i = Math.round(((px - m.left) / (W - m.left - m.right)) * (values.length - 1));
      if (i < 0 || i >= values.length) return;
      const hl = $("hover-line");
      hl.setAttribute("x1", x(i));
      hl.setAttribute("x2", x(i));
      const out = values[i] < range.low || values[i] > range.high;
      tip.hidden = false;
      tip.innerHTML = `${fmtDate(days[i].date)} · <b>${values[i]}${t.unit ? " " + t.unit : ""}</b>${out ? ' · <span class="is-watch">outside normal</span>' : ""}`;
      tip.style.left = (x(i) / W) * rect.width + "px";
      tip.style.top = (y(values[i]) / Hh) * rect.height + "px";
    };
    zone.onmouseleave = () => {
      tip.hidden = true;
      $("hover-line").setAttribute("x1", -10);
      $("hover-line").setAttribute("x2", -10);
    };
  }
  window.addEventListener("resize", () => drawTrend(false));

  /* ---------- Raw readings (flight surgeon view) ---------- */
  function renderRaw() {
    const rows = [
      ["Resting heart rate", "resting_hr", "bpm"],
      ["Heart rate variability", "hrv_rmssd", "ms"],
      ["Blood oxygen", "spo2", "%"],
      ["Breathing rate", "resp_rate", "/min"],
      ["Skin temperature change", "skin_temp_delta", "°C"],
      ["Sleep", "sleep_hours", "h"],
      ["Deep sleep", "deep_sleep_pct", "%"],
      ["Exercise", "exercise_minutes", "min"],
      ["Radiation", "radiation_dose", "mSv"],
    ];
    const last5 = days.slice(-5);
    $("raw").innerHTML = `
      <thead><tr><th>Reading</th><th>Device</th>${last5.map((d) => `<th>${fmtDate(d.date)}</th>`).join("")}<th>Normal range</th></tr></thead>
      <tbody>${rows
        .map(([name, key, unit]) => {
          const b = baseline[key];
          const cells = last5
            .map((d) => {
              const out = b && (d[key] < b.low || d[key] > b.high);
              return `<td class="num ${out ? "is-watch" : ""}">${d[key]}</td>`;
            })
            .join("");
          return `<tr><td>${name} <span style="color:var(--text-faint)">${unit}</span></td><td>${deviceLabel(today.sources[key])}</td>${cells}<td class="num">${b ? `${b.low.toFixed(1)}–${b.high.toFixed(1)}` : "–"}</td></tr>`;
        })
        .join("")}</tbody>`;
  }

  /* ---------- Alerts ---------- */
  function renderAlerts() {
    $("alert-list").innerHTML = alerts
      .map(
        (a, i) => `<div class="alert ${a.level}${a.done ? " done" : ""}">
        <div class="alert-top"><span class="alert-level is-${a.level}">${ICONS[a.level]}${WORDS[a.level]}</span></div>
        <h3>${a.title}</h3>
        <p>${a.detail}</p>
        <ul>${a.actions.map((x) => `<li>${x}</li>`).join("")}</ul>
        ${a.level === "info" ? "" : `<button type="button" class="alert-done" data-alert="${i}">${a.done ? "Undo" : "Mark as done"}</button>`}
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

  /* ---------- Check-in ---------- */
  const MOODS = [
    { n: 1, word: "Awful" },
    { n: 2, word: "Low" },
    { n: 3, word: "OK" },
    { n: 4, word: "Good" },
    { n: 5, word: "Great" },
  ];
  $("moods").innerHTML = MOODS.map(
    (m) => `<button type="button" data-mood="${m.n}" aria-pressed="false"><b>${m.n}</b>${m.word}</button>`
  ).join("");
  $("moods").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mood]");
    if (!b) return;
    document.querySelectorAll("#moods button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    const n = +b.dataset.mood;
    $("checkin-note").textContent =
      n <= 2
        ? "Logged. Your flight surgeon will see this alongside today's alert."
        : "Logged. Thanks, this helps explain your scores.";
  });

  /* ---------- Devices ---------- */
  $("devices").innerHTML = devices
    .map((d) => `<div class="device"><span class="dot-live"></span>${d.label}<small>synced 07:00</small></div>`)
    .join("");

  /* ---------- Astronaut / flight surgeon switch ---------- */
  function setView(surgeon) {
    $("view-astro").setAttribute("aria-pressed", !surgeon);
    $("view-surgeon").setAttribute("aria-pressed", surgeon);
    $("raw-panel").hidden = !surgeon;
  }
  $("view-astro").addEventListener("click", () => setView(false));
  $("view-surgeon").addEventListener("click", () => setView(true));

  /* ---------- Rail: highlight the section in view ---------- */
  const railLinks = [...document.querySelectorAll(".rail a")];
  railLinks.forEach((a) =>
    a.addEventListener("click", () => {
      railLinks.forEach((x) => x.classList.toggle("active", x === a));
    })
  );

  /* ---------- "?" help pop-ups ---------- */
  const HELP = {
    recovery: ["Recovery", "How ready your body is to take on strain today, from 0 to 100%. It compares last night's heart rate variability, resting heart rate and sleep with your own normal. 67% and up is Normal, 34 to 66% is Watch, 33% and below is Act now. (Placeholder formula for the demo.)"],
    strain: ["Strain", "How much load your heart and muscles took yesterday, on a 0 to 21 scale. More time at a higher heart rate means more strain. On long missions, enough exercise protects bones and muscles."],
    sleep: ["Sleep", "How well you slept, from 0 to 100%. Mostly hours slept against an 8-hour need, plus how much deep sleep you got."],
    contributors: ["What's behind the score", "The pieces that make up the score you selected. Each bar shows how that piece compares with your normal. Click a different score card to switch."],
    vitals: ["Vitals", "Overnight readings from your devices. The shaded strip in each mini chart is your normal range. A reading outside it gets a yellow outline."],
    trend: ["30-day trend", "The line shows the last 30 days. The shaded band is your normal range, worked out from your own earlier days. Yellow dots mark days outside it. Slow drifts, like bone or immune changes, show up here before they're obvious."],
    raw: ["Raw readings", "The numbers behind the dashboard, with the device each one came from. Shown in the flight surgeon view only."],
    alerts: ["Alerts and actions", "Each alert says what changed and what to do about it. Act now is shown only when two or more signals agree, so alerts stay rare and worth reading."],
    checkin: ["Daily check-in", "A 5-second rating of how you feel. Wearables can't measure mood or symptoms, so this fills the gap and helps explain your scores."],
    devices: ["Connected devices", "The wearables sending readings to this dashboard. Each reading on the page shows which device it came from."],
    rhr: ["Resting heart rate", "Your heart rate while fully at rest overnight. A rise of several beats above your normal can mean fatigue, illness or stress."],
    hrv: ["Heart rate variability (HRV)", "The tiny changes in time between heartbeats, in milliseconds. Higher than your normal usually means well recovered; lower can mean stress, poor sleep or illness."],
    spo2: ["Blood oxygen (SpO2)", "How much of your blood is carrying oxygen. Usually 95% or higher."],
    resp: ["Breathing rate", "Breaths per minute while asleep. A rise above your normal can be an early sign of illness."],
    temp: ["Skin temperature", "Change from your normal overnight skin temperature. A rise can be an early sign of illness."],
    radiation: ["Radiation today", "The dose measured by your radiation badge today, in millisieverts (mSv), and your total for the mission so far. Simulated values."],
  };

  const pop = $("help-pop");
  let pinned = null;
  function showHelp(btn) {
    const [title, text] = HELP[btn.dataset.help] || ["", ""];
    pop.innerHTML = `<b>${title}</b>${text}`;
    pop.classList.add("show");
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
    let top = r.bottom + 10;
    if (top + ph > window.innerHeight - 12) top = r.top - ph - 10;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  function hideHelp() {
    pop.classList.remove("show");
  }
  document.addEventListener("mouseover", (e) => {
    const b = e.target.closest(".help");
    if (b && !pinned) showHelp(b);
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(".help") && !pinned) hideHelp();
  });
  document.addEventListener("focusin", (e) => {
    const b = e.target.closest(".help");
    if (b) showHelp(b);
  });
  document.addEventListener("focusout", (e) => {
    if (e.target.closest(".help") && !pinned) hideHelp();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".help");
    document.querySelectorAll(".help.open").forEach((x) => x !== b && x.classList.remove("open"));
    if (b) {
      e.stopPropagation();
      pinned = pinned === b ? null : b;
      b.classList.toggle("open", !!pinned);
      pinned ? showHelp(b) : hideHelp();
    } else if (pinned) {
      pinned = null;
      hideHelp();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      pinned = null;
      document.querySelectorAll(".help.open").forEach((x) => x.classList.remove("open"));
      hideHelp();
    }
  });
  window.addEventListener("scroll", () => !pinned && hideHelp(), { passive: true });

  /* ---------- Space background ----------
   * Three layers of stars slowly turning around a dark mass below the screen,
   * a few drifting dark clouds, and the faint edge of a planet in the corner.
   * Only brand blues and white are used.
   */
  const canvas = $("space");
  const ctx = canvas.getContext("2d");
  let W = 0, Hc = 0, dpr = 1, stars = [], clouds = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    Hc = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = Hc * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((W * Hc) / 5200);
    stars = Array.from({ length: count }, () => {
      const depth = Math.random();
      return {
        a: Math.random() * Math.PI * 2,
        r: Math.sqrt(Math.random()) * Math.hypot(W, Hc) * 1.1,
        size: 0.4 + depth * 1.4,
        speed: (0.00002 + depth * 0.00005) * (Math.random() < 0.5 ? 1 : 1),
        alpha: 0.25 + depth * 0.6,
        twinkle: Math.random() * Math.PI * 2,
        blue: Math.random() < 0.3,
      };
    });
    clouds = Array.from({ length: 4 }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * Hc,
      r: Math.max(W, Hc) * (0.25 + Math.random() * 0.2),
      dx: (Math.random() - 0.5) * 0.06,
      dy: (Math.random() - 0.5) * 0.04,
      tint: i % 2 ? "0,66,166" : "0,0,0",
    }));
  }

  function frame(t) {
    ctx.fillStyle = "#07173F";
    ctx.fillRect(0, 0, W, Hc);

    // Dark clouds ("black mass") drifting slowly
    for (const c of clouds) {
      c.x += c.dx; c.y += c.dy;
      if (c.x < -c.r) c.x = W + c.r; if (c.x > W + c.r) c.x = -c.r;
      if (c.y < -c.r) c.y = Hc + c.r; if (c.y > Hc + c.r) c.y = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(${c.tint},0.35)`);
      g.addColorStop(1, `rgba(${c.tint},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }

    // Stars orbiting a centre below the bottom-left corner
    const cx = W * 0.15, cy = Hc * 1.35;
    for (const s of stars) {
      s.a += s.speed * 16;
      const x = cx + Math.cos(s.a) * s.r;
      const y = cy + Math.sin(s.a) * s.r;
      if (x < -4 || x > W + 4 || y < -4 || y > Hc + 4) continue;
      const tw = 0.75 + 0.25 * Math.sin(t * 0.0012 + s.twinkle);
      ctx.fillStyle = s.blue ? `rgba(46,150,245,${s.alpha * tw})` : `rgba(255,255,255,${s.alpha * tw})`;
      ctx.beginPath();
      ctx.arc(x, y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Faint planet edge in the bottom-right corner
    const pr = Math.max(W, Hc) * 0.55;
    const px = W + pr * 0.35, py = Hc + pr * 0.45;
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.2, px, py, pr);
    pg.addColorStop(0, "rgba(0,66,166,0.0)");
    pg.addColorStop(0.85, "rgba(0,66,166,0.18)");
    pg.addColorStop(0.985, "rgba(46,150,245,0.35)");
    pg.addColorStop(1, "rgba(46,150,245,0)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    if (!reduceMotion) requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  /* ---------- First draw ---------- */
  renderScores();
  renderContributors();
  renderVitals();
  renderRaw();
  renderAlerts();
  drawTrend(true);
})();

/*
 * Debug page (debug.html). Read-only: it only sends GET requests, never sends data,
 * and never uses the ingest key.
 *
 * In plain English, it draws four things:
 *   1. Backend: is the server up, how fast it answered, and how much it stores.
 *   2. What the dashboard is showing: for every number the dashboard uses, whether it came
 *      from the backend ("Live") or is still made up ("Sample"). This uses the same data.js
 *      the dashboard uses, so the answer is exactly what the dashboard sees.
 *   3. A form to send a test request for one crew member.
 *   4. The call log: every backend call any Sirius page made in this browser (api-log.js
 *      writes them down), newest first. Click a call to see what the server answered.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const ic = (name) => window.icon(name);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Same address data.js uses, including the ?api=... override.
  const API_BASE = new URLSearchParams(location.search).get("api") || "https://tylanauts-api.vercel.app/api/v1";
  const ROOT = API_BASE.replace(/\/api\/v1\/?$/, ""); // /health and /docs live here
  const WAIT_MS = 10000;

  $("db-logo").innerHTML = SIRIUS.mark(28, { label: "" });
  $("db-docs").href = ROOT + "/docs";
  $("db-docs").innerHTML = ic("info") + "API docs";

  // The backend's own pages (from the backend README). Opening them only reads; the
  // Live devices page is where the team starts, pauses and steers the simulated devices.
  const TOOLS = [
    { label: "Live devices", path: "/live", note: "start or pause the 18 simulated devices and move the levers" },
    { label: "Data viewer", path: "/viewer", note: "everything in the database, with charts and rejected readings" },
    { label: "API docs", path: "/docs", note: "every endpoint, with Try it out" },
    { label: "API schema", path: "/openapi.json", note: "the machine-readable contract" },
    { label: "Health check", path: "/health", note: "should say storage: postgres" },
  ];
  $("tools").innerHTML = TOOLS.map((t) =>
    `<a class="tool" href="${esc(ROOT + t.path)}" target="_blank" rel="noopener"><b>${esc(t.label)}</b><span>${esc(t.note)}</span></a>`).join("");

  async function get(url) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), WAIT_MS);
    const started = performance.now();
    try {
      const response = await fetch(url, { signal: stop.signal });
      const body = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, ms: Math.round(performance.now() - started), body };
    } catch (err) {
      return { ok: false, status: 0, ms: Math.round(performance.now() - started), body: null,
        error: err.name === "AbortError" ? "gave up waiting" : "couldn't reach it" };
    } finally {
      clearTimeout(timer);
    }
  }

  const timeOf = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateTimeOf = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  const ago = (iso) => {
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 90) return s + " s ago";
    if (s < 5400) return Math.round(s / 60) + " min ago";
    if (s < 129600) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " days ago";
  };
  const size = (bytes) => (bytes == null ? "" : bytes < 1024 ? bytes + " B" : (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB");

  /* ---------- 1. Backend status ---------- */
  let stats = null;
  async function loadStatus() {
    $("status-refresh").disabled = true;
    $("status").innerHTML = `<p class="db-note">${ic("loader")} Asking the server…</p>`;
    const [health, st] = await Promise.all([get(ROOT + "/health"), get(API_BASE + "/stats")]);
    stats = st.ok ? st.body : null;
    const up = health.ok && health.body && health.body.status === "ok";
    const cell = (label, value, cls) => `<div class="stat"><span class="label">${label}</span><b class="${cls || ""}">${value}</b></div>`;
    const lastAll = stats && stats.coverage.length ? stats.coverage.reduce((m, c) => (c.last > m ? c.last : m), "") : null;
    $("status").innerHTML =
      cell("Server", up ? `${ic("circle-check")}Up` : health.status === 0 && health.error !== "gave up waiting" ? `${ic("octagon-alert")}Blocked` : `${ic("octagon-alert")}Down`, up ? "" : "is-bad") +
      cell("Answered in", health.status ? `${health.ms} ms` : health.error || "no answer") +
      cell("Storage", up ? esc(health.body.storage) : "–") +
      cell("Version", up ? esc(health.body.version) : "–") +
      cell("Readings stored", stats ? stats.data_points.toLocaleString("en-GB") : "–") +
      cell("Uploads received", stats ? stats.ingestions.toLocaleString("en-GB") : "–") +
      cell("Newest reading", lastAll ? ago(lastAll) : "–") +
      `<p class="db-note small mono status-url">${esc(ROOT)}</p>` +
      (health.status === 0 && health.error !== "gave up waiting"
        ? `<p class="db-note small status-url">The browser couldn't read the server from <span class="mono">${esc(location.origin)}</span>. ` +
          `The backend only lets the GitHub Pages site and <span class="mono">localhost:8000</span> read it, so open Sirius from one of those ` +
          `(or ask nayem-m to add this address). <a href="${esc(ROOT)}/health" target="_blank" rel="noopener">Open the health check directly</a> to see whether the server itself is up.</p>`
        : "");
    $("status-refresh").disabled = false;
    drawBackendHas();
  }
  $("status-refresh").innerHTML = ic("refresh-cw") + "Check again";
  $("status-refresh").addEventListener("click", loadStatus);

  /* ---------- 2. Live or sample ---------- */
  const NAMES = {
    resting_hr: "Resting heart rate", hrv_rmssd: "Heart rate variability (HRV)", spo2: "Blood oxygen",
    skin_temp_delta: "Skin temperature change", resp_rate: "Breathing rate", sleep_hours: "Sleep time",
    deep_sleep_pct: "Deep sleep", exercise_minutes: "Exercise time", avg_exercise_hr: "Exercise heart rate",
    radiation_dose: "Radiation dose", bp_systolic: "Blood pressure (top number)", bp_diastolic: "Blood pressure (bottom number)",
    breath_volume: "Breath depth", mood: "Mood",
  };

  function drawSource(data) {
    const live = data.live;
    const who = esc(data.astronaut.id);
    $("source-note").innerHTML = live.source === "live"
      ? `The dashboard is reading <b>live data</b> from the backend for <b>${who}</b>. Numbers marked Sample aren't stored by the backend yet, so the dashboard still makes them up.`
      : `The dashboard is showing <b>sample data only</b> for <b>${who}</b>, because ${esc(live.reason || "the backend couldn't be used")}.`;

    // The newest reading of each metric, as the dashboard has it.
    const latest = {};
    for (const r of data.readings) if (!latest[r.metric] || r.time >= latest[r.metric].time) latest[r.metric] = r;
    const metrics = Object.keys(latest).sort((a, b) => (data.isSample(a) - data.isSample(b)) || a.localeCompare(b));
    $("metrics").innerHTML =
      `<thead><tr><th>Reading</th><th>Shown as</th><th>Latest value</th><th>From device</th><th>Time</th></tr></thead><tbody>` +
      metrics.map((m) => {
        const r = latest[m];
        const sample = data.isSample(m);
        return `<tr><td>${esc(NAMES[m] || m)}<span class="mono dim"> ${esc(m)}</span></td>` +
          `<td>${sample ? `<span class="sample-tag">Sample</span>` : `<span class="live-tag">${ic("wifi")}Live</span>`}</td>` +
          `<td class="mono">${esc(r.value)} ${esc(r.unit || "")}</td>` +
          `<td class="mono dim">${esc(r.device_id)}</td>` +
          `<td class="mono dim">${esc(dateTimeOf(r.time))}</td></tr>`;
      }).join("") + `</tbody>`;
    $("pages-note").innerHTML =
      "Live means the backend has a reading for it on the latest day. The Today, Alerts, Calendar and Log pages use this mix. " +
      "Breath depth, deep sleep, exercise and skin temperature aren't sent by the simulated devices yet. " +
      "The Crew overview page and the device list (battery, last sync) are still all sample data.";
    drawBackendHas();
  }

  // What the backend stores for this crew member, including things the dashboard doesn't read yet.
  function drawBackendHas() {
    const data = window.HEALTH_DATA;
    let el = $("backend-has");
    if (!data || !stats) { if (el) el.remove(); return; }
    const rows = stats.coverage.filter((c) => c.subject_id === data.astronaut.id);
    if (!el) {
      el = document.createElement("p");
      el.id = "backend-has";
      el.className = "db-note small";
      $("pages-note").before(el);
    }
    el.innerHTML = rows.length
      ? `The backend stores these for ${esc(data.astronaut.id)}: ` +
        rows.map((c) => `<span class="mono">${esc(c.metric)}</span> (${c.count}, newest ${esc(ago(c.last))})`).join(", ") + "."
      : `The backend stores nothing for ${esc(data.astronaut.id)}.`;
  }

  /* ---------- 3. Test requests ---------- */
  const ENDPOINTS = [
    { id: "readings", label: "Latest readings (newest 20)", url: (s) => `${API_BASE}/subjects/${encodeURIComponent(s)}/data-points?limit=20&order=desc` },
    { id: "readings-day", label: "Readings from the last 24 hours", url: (s) => `${API_BASE}/subjects/${encodeURIComponent(s)}/data-points?start=${new Date(Date.now() - 86400000).toISOString()}&limit=500&order=desc` },
    { id: "uploads", label: "Recent uploads from devices", url: (s) => `${API_BASE}/ingestions?limit=10&subject_id=${encodeURIComponent(s)}` },
    { id: "health", label: "Server health (anyone)", url: () => `${ROOT}/health`, all: true },
    { id: "stats", label: "Storage totals (anyone)", url: () => `${API_BASE}/stats`, all: true },
    { id: "subjects", label: "Crew members with data (anyone)", url: () => `${API_BASE}/subjects`, all: true },
    { id: "metrics", label: "Metrics the backend knows (anyone)", url: () => `${API_BASE}/metrics`, all: true },
    { id: "sim", label: "Device simulator settings (anyone)", url: () => `${API_BASE}/sim`, all: true },
  ];
  $("t-endpoint").innerHTML = ENDPOINTS.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join("");
  $("t-send").innerHTML = ic("send") + "Send";
  const endpoint = () => ENDPOINTS.find((e) => e.id === $("t-endpoint").value);
  const showUrl = () => {
    const e = endpoint();
    $("t-subject").disabled = !!e.all;
    $("t-url").textContent = "GET " + e.url($("t-subject").value);
  };
  $("t-endpoint").addEventListener("change", showUrl);
  $("t-subject").addEventListener("change", showUrl);

  async function loadSubjects() {
    const res = await get(API_BASE + "/subjects");
    // Crew members the backend has data for; keep crew-01 to crew-06 even if it has none.
    const crew = ["crew-01", "crew-02", "crew-03", "crew-04", "crew-05", "crew-06"];
    const fromServer = res.ok && Array.isArray(res.body) ? res.body.filter((s) => /^crew-/.test(s)) : [];
    const list = [...new Set(crew.concat(fromServer))].sort();
    $("t-subject").innerHTML = list.map((s) => `<option>${esc(s)}</option>`).join("");
    showUrl();
  }

  let pendingUrl = null; // the test request we're waiting for, so the log can open it
  $("tester").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("t-send").disabled = true;
    pendingUrl = endpoint().url($("t-subject").value);
    await get(pendingUrl);
    $("t-send").disabled = false;
  });

  /* ---------- 4. Call log ---------- */
  const open = new Set();
  function drawLog() {
    const calls = window.SIRIUS_API_LOG.read();
    $("log-count").textContent = calls.length ? `${calls.length} call${calls.length === 1 ? "" : "s"}` : "";
    $("log-clear").disabled = !calls.length;
    if (!calls.length) {
      $("log").innerHTML = `<p class="db-note">No calls yet. Open the Today page, or send a test request above.</p>`;
      return;
    }
    $("log").innerHTML = calls.map((c) => {
      const u = new URL(c.url);
      const path = u.pathname + u.search;
      const bad = !c.ok;
      const statusText = c.status ? c.status : "failed";
      const summary = c.error ? esc(c.error) : c.items != null ? `${c.items} item${c.items === 1 ? "" : "s"}` : "";
      return `<details class="call${bad ? " is-bad" : ""}" data-id="${esc(c.id)}"${open.has(c.id) ? " open" : ""}>
        <summary>
          <span class="mono dim">${esc(timeOf(c.at))}</span>
          <span class="mono code">${esc(statusText)}</span>
          <span class="mono method">${esc(c.method)}</span>
          <span class="mono path" title="${esc(c.url)}">${esc(decodeURIComponent(path))}</span>
          <span class="mono dim right">${c.ms != null ? c.ms + " ms" : ""}</span>
          <span class="mono dim right">${size(c.bytes)}</span>
          <span class="dim right from">${esc(c.page)}</span>
        </summary>
        <div class="call-body">
          <p class="db-note small mono">${esc(c.url)}</p>
          ${summary ? `<p class="db-note small">${summary}${c.items > 3 ? ", showing the first 3" : ""}</p>` : ""}
          ${c.preview ? `<pre>${esc(c.preview)}</pre>` : ""}
        </div>
      </details>`;
    }).join("");
  }
  // Remember which calls are open, so a redraw doesn't close them.
  $("log").addEventListener("toggle", (ev) => {
    const id = ev.target.dataset && ev.target.dataset.id;
    if (!id) return;
    ev.target.open ? open.add(id) : open.delete(id);
  }, true);
  $("log-clear").innerHTML = ic("x") + "Clear";
  $("log-clear").addEventListener("click", () => window.SIRIUS_API_LOG.clear());
  // New calls on this page, and calls written by other Sirius tabs.
  window.addEventListener("sirius-api-call", (ev) => {
    if (ev.detail && ev.detail.url === pendingUrl) { open.add(ev.detail.id); pendingUrl = null; }
    drawLog();
  });
  window.addEventListener("storage", (ev) => { if (ev.key === window.SIRIUS_API_LOG.KEY) drawLog(); });

  /* ---------- Start ---------- */
  drawLog();
  loadStatus();
  loadSubjects();
  $("source-note").innerHTML = `${ic("loader")} Loading the dashboard's data…`;
  window.HEALTH_READY.then(drawSource);
})();

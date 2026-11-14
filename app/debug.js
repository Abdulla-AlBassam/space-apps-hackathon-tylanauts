/*
 * Debug page (debug.html). Read-only: it only sends GET requests, never sends data,
 * and never uses the ingest key.
 *
 * In plain English, it draws four things:
 *   1. Backend: is the server up, how fast it answered, and how much it stores.
 *   2. Connected devices: every device the backend has heard from lately, whether it is
 *      sending now, and the simulator's on/off and faulty switches. Then the latest reading
 *      of every metric the backend stores for one crew member.
 *   Everything on this page comes from the backend. Nothing is made up (no sample data).
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
  let statusReady = null;
  function loadStatus() { statusReady = checkStatus(); return statusReady; }
  async function checkStatus() {
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
  }
  $("status-refresh").innerHTML = ic("refresh-cw") + "Check again";
  $("status-refresh").addEventListener("click", loadStatus);

  /* ---------- 2. Connected devices ---------- */
  // Built only from what the backend says: its recent uploads (/ingestions) and the
  // simulator's switches (/sim). Nothing here is made up.
  const TYPES = { "smart-watch": "Smart watch", "smart-shirt": "Smart shirt", dosimeter: "Radiation badge", "csv-table": "CSV upload", "manual-entry": "Typed in" };
  const SENDING_S = 120; // uploaded within the last 2 minutes = sending now
  const UPLOADS = 300;   // how many recent uploads to look through

  async function loadDevices() {
    $("dev-refresh").disabled = true;
    $("sim-note").innerHTML = `${ic("loader")} Asking the server…`;
    const [sim, ups] = await Promise.all([get(API_BASE + "/sim"), get(`${API_BASE}/ingestions?limit=${UPLOADS}`)]);
    $("dev-refresh").disabled = false;
    if (!ups.ok || !Array.isArray(ups.body)) {
      $("devices").innerHTML = "";
      $("dev-count").textContent = "";
      $("sim-note").textContent = "Couldn't get the device uploads from the backend.";
      return;
    }
    const settings = sim.ok && sim.body ? sim.body.settings : null;
    const switches = (settings && settings.devices) || {};
    const devs = {};
    for (const u of ups.body) {
      const id = u.device_id || "(no device)";
      const d = devs[id] || (devs[id] = { id, adapter: u.adapter_id, subject: u.subject_id, last: u.received_at, uploads: 0, rejected: 0 });
      d.uploads++;
      d.rejected += (u.rejected || []).length;
      if (u.received_at > d.last) d.last = u.received_at;
    }
    // Simulated devices that haven't uploaded lately are still listed, with no upload time.
    for (const id of Object.keys(switches)) if (!devs[id]) devs[id] = { id, adapter: null, subject: null, last: null, uploads: 0, rejected: 0 };

    const ageS = (iso) => (Date.now() - new Date(iso)) / 1000;
    const list = Object.values(devs).sort((a, b) => String(a.subject).localeCompare(String(b.subject)) || a.id.localeCompare(b.id));
    const sending = list.filter((d) => d.last && ageS(d.last) < SENDING_S).length;
    $("dev-count").textContent = `${sending} of ${list.length} sending now`;

    const oldest = ups.body.length ? ups.body[ups.body.length - 1].received_at : null;
    $("sim-note").innerHTML =
      (settings
        ? `Simulator switch: <b>${settings.running ? "on" : "off"}</b>${settings.scenario ? `, scenario <b>${esc(settings.scenario)}</b>` : ""}. ` +
          `The simulated devices only send while someone has <a href="${esc(ROOT)}/live" target="_blank" rel="noopener">Live devices</a> open with Start devices pressed. `
        : "") +
      (oldest ? `Uploads counted from the backend's last ${ups.body.length}, back to ${esc(ago(oldest))}.` : "The backend has no uploads.");

    $("devices").innerHTML =
      `<thead><tr><th>Device</th><th>Type</th><th>Crew member</th><th>Status</th><th>Last upload</th><th>Uploads</th><th>Rejected</th></tr></thead><tbody>` +
      list.map((d) => {
        const sw = switches[d.id];
        let status;
        if (sw && sw.faulty) status = `<span class="bad-tag">Faulty sensor</span>`;
        else if (sw && !sw.on) status = `<span class="dim">Switched off</span>`;
        else if (d.last && ageS(d.last) < SENDING_S) status = `<span class="live-tag">${ic("wifi")}Sending</span>`;
        else status = `<span class="dim">Quiet</span>`;
        return `<tr><td class="mono">${esc(d.id)}</td>` +
          `<td>${esc(TYPES[d.adapter] || d.adapter || "–")}</td>` +
          `<td class="mono">${esc(d.subject || "–")}</td>` +
          `<td>${status}</td>` +
          `<td class="mono dim">${d.last ? esc(ago(d.last)) : "–"}</td>` +
          `<td class="mono">${d.uploads}</td>` +
          `<td class="mono${d.rejected ? " is-bad" : " dim"}">${d.rejected}</td></tr>`;
      }).join("") + `</tbody>`;
  }
  $("dev-refresh").innerHTML = ic("refresh-cw") + "Check again";
  $("dev-refresh").addEventListener("click", loadDevices);

  /* ---------- Latest readings, straight from the backend ---------- */
  let labels = {}; // backend metric id -> its own label, from /metrics
  const fmt = (n) => (typeof n === "number" ? String(+n.toPrecision(4)) : esc(n));
  const valueOf = (r) => {
    const v = r.values || {};
    if ("systolic" in v) return `${fmt(v.systolic)}/${fmt(v.diastolic)}`;
    if ("value" in v) return fmt(v.value);
    return esc(JSON.stringify(v));
  };
  const unitOf = (r) => {
    const body = (r.data_point && r.data_point.body) || {};
    const u = Object.values(body).find((x) => x && typeof x === "object" && "unit" in x);
    return u ? u.unit : "";
  };

  async function loadReadings() {
    const s = $("r-subject").value;
    if (!s) return;
    $("metrics").innerHTML = `<tbody><tr><td>${ic("loader")} Asking the server…</td></tr></tbody>`;
    await statusReady; // the storage totals say which metrics this crew member has
    const res = await get(`${API_BASE}/subjects/${encodeURIComponent(s)}/data-points?limit=300&order=desc`);
    if (s !== $("r-subject").value) return; // picked someone else meanwhile
    if (!res.ok || !Array.isArray(res.body)) {
      $("metrics").innerHTML = `<tbody><tr><td>Couldn't get readings for ${esc(s)} from the backend.</td></tr></tbody>`;
      return;
    }
    // The newest reading is the one that ended last. (The backend sorts by start time, and a
    // radiation badge reports a 24-hour window, so its start is a day earlier than its end.)
    const timeOfRec = (r) => r.effective_end || r.effective_start;
    const latest = {};
    const keep = (r) => { if (!latest[r.metric] || timeOfRec(r) > timeOfRec(latest[r.metric])) latest[r.metric] = r; };
    res.body.forEach(keep);
    // Metrics sent rarely (sleep, mood) may be older than the newest 300: ask for those one by one.
    const coverage = stats ? stats.coverage.filter((c) => c.subject_id === s) : [];
    const missing = coverage.filter((c) => !latest[c.metric]).map((c) => c.metric);
    const extra = await Promise.all(missing.map((m) =>
      get(`${API_BASE}/subjects/${encodeURIComponent(s)}/data-points?metric=${encodeURIComponent(m)}&limit=5&order=desc`)));
    extra.forEach((x) => { if (x.ok && Array.isArray(x.body)) x.body.forEach(keep); });
    if (s !== $("r-subject").value) return;

    const count = Object.fromEntries(coverage.map((c) => [c.metric, c.count]));
    const metrics = Object.keys(latest).sort((a, b) => timeOfRec(latest[b]).localeCompare(timeOfRec(latest[a])));
    if (!metrics.length) {
      $("metrics").innerHTML = `<tbody><tr><td>The backend has no readings for ${esc(s)}.</td></tr></tbody>`;
      return;
    }
    $("metrics").innerHTML =
      `<thead><tr><th>Reading</th><th>Latest value</th><th>From device</th><th>Time</th><th>Stored</th></tr></thead><tbody>` +
      metrics.map((m) => {
        const r = latest[m];
        const t = timeOfRec(r);
        return `<tr><td>${esc(labels[m] || m)}<span class="mono dim"> ${esc(m)}</span></td>` +
          `<td class="mono">${valueOf(r)} ${esc(unitOf(r))}</td>` +
          `<td class="mono dim">${esc(r.device_id || "typed")}</td>` +
          `<td class="mono dim">${esc(dateTimeOf(t))} · ${esc(ago(t))}</td>` +
          `<td class="mono dim">${count[m] != null ? count[m].toLocaleString("en-GB") : "–"}</td></tr>`;
      }).join("") + `</tbody>`;
  }
  $("r-subject").addEventListener("change", loadReadings);

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
    $("r-subject").innerHTML = $("t-subject").innerHTML;
    loadReadings();
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
  loadDevices();
  get(API_BASE + "/metrics").then((res) => {
    if (res.ok && Array.isArray(res.body)) labels = Object.fromEntries(res.body.map((m) => [m.id, m.label]));
    loadSubjects();
  });
})();

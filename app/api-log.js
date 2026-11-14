/*
 * API call recorder, used by the Debug page (debug.html).
 *
 * What it does, in plain English:
 * Every time a page asks our backend (tylanauts-api) for something, this file writes down
 * what was asked, how the server answered, and how long it took. It keeps the last 40 calls
 * in the browser's own storage (localStorage), so the Debug page can show calls that the
 * Today page made a moment ago, even though they are different pages.
 *
 * It only records requests to the backend. It never records request headers, so a key
 * could never end up in the log (and the app sends none: reading needs no key).
 *
 * Load it before data.js, so the very first call is caught.
 */
(function () {
  const KEY = "sirius-api-log";
  const MAX_CALLS = 40;
  const MAX_PREVIEW = 12000; // characters of the answer to keep per call
  const API_HOSTS = ["tylanauts-api.vercel.app"];
  // ?api=... in the address bar points data.js at another backend: record that one too.
  try {
    const custom = new URLSearchParams(location.search).get("api");
    if (custom) API_HOSTS.push(new URL(custom).host);
  } catch (e) { /* not a valid address: ignore */ }

  const isApi = (url) => {
    try { return API_HOSTS.includes(new URL(url, location.href).host); } catch (e) { return false; }
  };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(calls) {
    try { localStorage.setItem(KEY, JSON.stringify(calls.slice(0, MAX_CALLS))); } catch (e) { /* storage full or blocked */ }
  }

  // A short version of a long answer: long lists keep their first 3 items.
  function shorten(text) {
    let json;
    try { json = JSON.parse(text); } catch (e) { return { preview: text.slice(0, MAX_PREVIEW), items: null }; }
    const items = Array.isArray(json) ? json.length : null;
    const small = Array.isArray(json) && json.length > 3 ? json.slice(0, 3) : json;
    let preview = JSON.stringify(small, null, 2);
    if (preview.length > MAX_PREVIEW) preview = preview.slice(0, MAX_PREVIEW) + "\n… (cut short)";
    return { preview, items };
  }

  function record(entry) {
    const calls = read();
    calls.unshift(entry);
    save(calls);
    window.dispatchEvent(new CustomEvent("sirius-api-call", { detail: entry }));
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isApi(url)) return realFetch(input, init);
    const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    const page = location.pathname.split("/").pop() || "index.html";
    const started = performance.now();
    const entry = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), at: new Date().toISOString(), page, method, url };
    try {
      const response = await realFetch(input, init);
      entry.status = response.status;
      entry.ok = response.ok;
      // Read a copy of the answer, so the page that asked still gets the original.
      response.clone().text().then((text) => {
        entry.ms = Math.round(performance.now() - started);
        entry.bytes = new Blob([text]).size;
        Object.assign(entry, shorten(text));
        record(entry);
      }).catch(() => { entry.ms = Math.round(performance.now() - started); record(entry); });
      return response;
    } catch (err) {
      entry.ms = Math.round(performance.now() - started);
      entry.ok = false;
      entry.status = 0;
      entry.error = err.name === "AbortError" ? "Gave up waiting (timed out)" : "Couldn't reach the server (network or CORS error)";
      record(entry);
      throw err;
    }
  };

  window.SIRIUS_API_LOG = { read, clear: () => { save([]); window.dispatchEvent(new CustomEvent("sirius-api-call")); }, KEY };
})();

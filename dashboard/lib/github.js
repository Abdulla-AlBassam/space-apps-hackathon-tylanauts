// Shared helpers for the dashboard's server functions (api/*.js).
// The GitHub token lives only here on the server, never in the browser.

const OWNER = process.env.REPO_OWNER || "Abdulla-AlBassam";
const REPO = process.env.REPO_NAME || "space-apps-hackathon-tylanauts";
const PLAN_PATH = process.env.PLAN_PATH || "docs/PLAN.md";

async function gh(path, { method = "GET", accept, body } = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: accept || "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tylanauts-dashboard",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch (e) {}
    const err = new Error(`GitHub answered ${res.status} for ${method} ${path}${detail ? `: ${detail}` : ""}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return accept === "application/vnd.github.raw" ? res.text() : res.json();
}

// People who can be assigned to issues = the repo's collaborators who accepted their invite.
async function assignable() {
  const list = await gh("/assignees?per_page=100");
  return list.map((u) => u.login);
}

function send(res, status, obj, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// Guard shared by the write endpoints.
async function guardWrite(req, res) {
  if (req.method !== "POST") { send(res, 405, { error: "method", message: "Use POST." }); return null; }
  if (!process.env.GITHUB_TOKEN) { send(res, 503, { error: "missing_token", message: "GITHUB_TOKEN is not set in Vercel." }); return null; }
  let body;
  try { body = await readJson(req); } catch (e) { send(res, 400, { error: "bad_json", message: "Couldn't read the request." }); return null; }
  return body;
}

module.exports = { OWNER, REPO, PLAN_PATH, gh, assignable, send, guardWrite };

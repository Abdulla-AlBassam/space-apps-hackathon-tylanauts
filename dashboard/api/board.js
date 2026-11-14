// Vercel serverless function: GET /api/board
//
// Reads the live task list (GitHub Issues), open pull requests and the plan
// (docs/PLAN.md) from our private GitHub repo, and returns them as one JSON
// object for the dashboard page.
//
// It needs one secret, set in Vercel > Project > Settings > Environment Variables:
//   GITHUB_TOKEN  a read-only fine-grained GitHub token for this repo
//                 (permissions: Contents, Issues, Pull requests, Metadata = Read-only)
//
// The token stays on the server. The browser only ever sees the JSON below.

const OWNER = process.env.REPO_OWNER || "Abdulla-AlBassam";
const REPO = process.env.REPO_NAME || "space-apps-hackathon-tylanauts";
const PLAN_PATH = process.env.PLAN_PATH || "docs/PLAN.md";

async function gh(path, accept) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: accept || "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tylanauts-dashboard",
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub answered ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  return accept === "application/vnd.github.raw" ? res.text() : res.json();
}

// "Closes #7", "fixes #3", "resolves #12" in a PR's title or description.
function linkedIssues(pr) {
  const text = `${pr.title || ""}\n${pr.body || ""}`;
  const found = new Set();
  for (const m of text.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) found.add(Number(m[1]));
  return [...found];
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!process.env.GITHUB_TOKEN) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "missing_token", message: "GITHUB_TOKEN is not set in Vercel yet." }));
    return;
  }

  try {
    const [items, pulls, plan] = await Promise.all([
      gh("/issues?state=all&per_page=100&sort=created&direction=asc"),
      gh("/pulls?state=open&per_page=100"),
      gh(`/contents/${PLAN_PATH}`, "application/vnd.github.raw").catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    ]);

    const prs = pulls.map((p) => ({
      number: p.number,
      title: p.title,
      url: p.html_url,
      author: p.user && p.user.login,
      draft: !!p.draft,
      issues: linkedIssues(p),
    }));

    const issues = items
      .filter((i) => !i.pull_request) // the issues endpoint also returns PRs; drop them
      .map((i) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state, // "open" | "closed"
        labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
        assignees: i.assignees.map((a) => a.login),
        prs: prs.filter((p) => p.issues.includes(i.number)).map((p) => p.number),
      }));

    // Cache at Vercel's edge for 60 seconds, so many teammates opening the page
    // don't each call GitHub. After a change on GitHub the page catches up within a minute or so.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.statusCode = 200;
    res.end(JSON.stringify({
      repo: { owner: OWNER, name: REPO, url: `https://github.com/${OWNER}/${REPO}` },
      fetchedAt: new Date().toISOString(),
      issues,
      prs,
      plan,
    }));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "github_error", message: e.message }));
  }
};

// GET /api/board
// Reads the task list (GitHub Issues), open pull requests, the people who can be
// assigned, and the plan (docs/PLAN.md), and returns them as one JSON object.
// Needs GITHUB_TOKEN in Vercel (see dashboard/README.md).

const { OWNER, REPO, PLAN_PATH, gh, assignable, send } = require("../lib/github");

// "Closes #7", "fixes #3", "resolves #12" in a PR's title or description.
function linkedIssues(pr) {
  const text = `${pr.title || ""}\n${pr.body || ""}`;
  const found = new Set();
  for (const m of text.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) found.add(Number(m[1]));
  return [...found];
}

module.exports = async (req, res) => {
  if (!process.env.GITHUB_TOKEN) return send(res, 503, { error: "missing_token", message: "GITHUB_TOKEN is not set in Vercel yet." });

  try {
    const [items, pulls, people, plan] = await Promise.all([
      gh("/issues?state=all&per_page=100&sort=created&direction=asc"),
      gh("/pulls?state=open&per_page=100"),
      assignable().catch(() => []),
      gh(`/contents/${PLAN_PATH}`, { accept: "application/vnd.github.raw" }).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    ]);

    const prs = pulls.map((p) => ({
      number: p.number, title: p.title, url: p.html_url, author: p.user && p.user.login, draft: !!p.draft, issues: linkedIssues(p),
    }));

    const issues = items
      .filter((i) => !i.pull_request) // the issues endpoint also returns PRs; drop them
      .map((i) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state,
        labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
        assignees: i.assignees.map((a) => a.login),
        prs: prs.filter((p) => p.issues.includes(i.number)).map((p) => p.number),
      }));

    // Normal loads are cached at Vercel's edge for 30s so many viewers don't each hit GitHub.
    // Right after someone clicks a button, the page asks with ?fresh=… to skip the cache.
    const fresh = req.url && req.url.includes("fresh=");
    send(res, 200, {
      repo: { owner: OWNER, name: REPO, url: `https://github.com/${OWNER}/${REPO}` },
      fetchedAt: new Date().toISOString(),
      issues, prs, people, plan,
    }, fresh ? "no-store" : "public, s-maxage=30, stale-while-revalidate=120");
  } catch (e) {
    send(res, 502, { error: "github_error", message: e.message });
  }
};

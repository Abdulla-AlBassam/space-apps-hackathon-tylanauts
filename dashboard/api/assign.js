// POST /api/assign   { issue: 7, login: "nayem-m", action: "take" | "drop" }
// Adds or removes a teammate as the assignee of a task (GitHub issue).
// Only people who can be assigned on the repo (accepted collaborators) are allowed.

const { gh, assignable, send, guardWrite } = require("../lib/github");

module.exports = async (req, res) => {
  const body = await guardWrite(req, res);
  if (!body) return;
  const issue = Number(body.issue);
  const login = String(body.login || "");
  const action = body.action === "drop" ? "drop" : "take";
  if (!Number.isInteger(issue) || issue < 1) return send(res, 400, { error: "bad_issue", message: "That task number isn't valid." });

  try {
    const people = await assignable();
    if (!people.includes(login)) return send(res, 403, { error: "not_teammate", message: `${login || "That user"} isn't on the repo yet. Accept the GitHub invite first.` });

    const current = await gh(`/issues/${issue}`);
    if (current.pull_request) return send(res, 400, { error: "bad_issue", message: "That number is a pull request, not a task." });

    if (action === "take") await gh(`/issues/${issue}/assignees`, { method: "POST", body: { assignees: [login] } });
    else await gh(`/issues/${issue}/assignees`, { method: "DELETE", body: { assignees: [login] } });

    send(res, 200, { ok: true, issue, login, action });
  } catch (e) {
    const permission = e.status === 403 || e.status === 404;
    send(res, permission ? 403 : 502, {
      error: permission ? "no_permission" : "github_error",
      message: permission ? "The board's GitHub key can't make changes yet (it needs Issues: Read and write)." : e.message,
    });
  }
};

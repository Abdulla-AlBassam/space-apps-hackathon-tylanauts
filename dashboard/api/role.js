// POST /api/role   { role: "Frontend 2", login: "nayem-m", action: "take" | "leave" }
// Writes a teammate's name into (or out of) the Person column of the Roles table
// in docs/PLAN.md, as a small commit on main. Vercel then redeploys by itself.

const { PLAN_PATH, gh, assignable, send, guardWrite } = require("../lib/github");

const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const joinRow = (cells) => `| ${cells.join(" | ")} |`;
const isEmpty = (c) => /^_?TBD_?$/i.test(c.trim()) || c.trim() === "";

module.exports = async (req, res) => {
  const body = await guardWrite(req, res);
  if (!body) return;
  const role = String(body.role || "").trim();
  const login = String(body.login || "");
  const action = body.action === "leave" ? "leave" : "take";
  if (!role) return send(res, 400, { error: "bad_role", message: "No role given." });

  try {
    const people = await assignable();
    if (!people.includes(login)) return send(res, 403, { error: "not_teammate", message: `${login || "That user"} isn't on the repo yet. Accept the GitHub invite first.` });

    const file = await gh(`/contents/${PLAN_PATH}`);
    const text = Buffer.from(file.content, "base64").toString("utf8");
    const lines = text.split("\n");

    // Find the "## … Roles" section, then its table, then the row for this role.
    const start = lines.findIndex((l) => /^##\s.*\brole/i.test(l));
    if (start < 0) return send(res, 409, { error: "no_roles", message: "Couldn't find the Roles section in the plan." });
    let personCol = -1, rowIndex = -1;
    for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
      if (!/^\s*\|/.test(lines[i]) || /^\s*\|?\s*:?-{2,}/.test(lines[i])) continue;
      const cells = splitRow(lines[i]);
      if (personCol < 0) { personCol = cells.findIndex((c) => /person/i.test(c)); continue; }
      if (cells[0] === role) { rowIndex = i; break; }
    }
    if (personCol < 0 || rowIndex < 0) return send(res, 404, { error: "no_role", message: `Couldn't find the role "${role}" in the plan.` });

    const cells = splitRow(lines[rowIndex]);
    const who = cells[personCol] || "";
    const names = isEmpty(who) ? [] : who.split(",").map((s) => s.trim()).filter(Boolean);

    if (action === "take") {
      if (names.includes(login)) return send(res, 200, { ok: true, unchanged: true });
      if (names.length) return send(res, 409, { error: "taken", message: `${role} is already taken by ${names.join(", ")}. Ask them or Abdulla first.` });
      cells[personCol] = login;
    } else {
      if (!names.includes(login)) return send(res, 409, { error: "not_yours", message: `You're not listed for ${role}.` });
      const rest = names.filter((n) => n !== login);
      cells[personCol] = rest.length ? rest.join(", ") : "_TBD_";
    }
    lines[rowIndex] = joinRow(cells);

    await gh(`/contents/${PLAN_PATH}`, {
      method: "PUT",
      body: {
        message: action === "take" ? `Mission Board: ${login} takes the ${role} role` : `Mission Board: ${login} leaves the ${role} role`,
        content: Buffer.from(lines.join("\n"), "utf8").toString("base64"),
        sha: file.sha,
      },
    });
    send(res, 200, { ok: true, role, login, action });
  } catch (e) {
    if (e.status === 404) return send(res, 409, { error: "no_plan", message: "The plan isn't on the main branch yet. Merge pull request #15 first." });
    const permission = e.status === 403;
    send(res, permission ? 403 : 502, {
      error: permission ? "no_permission" : "github_error",
      message: permission ? "The board's GitHub key can't make changes yet (it needs Contents: Read and write)." : e.message,
    });
  }
};

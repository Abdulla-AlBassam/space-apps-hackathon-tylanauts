# Mission Board (team dashboard)

A single web page that shows our plan, tasks and who is doing what. It is hosted on Vercel
and reads this GitHub repo **live**, so nobody has to update it by hand:

Teammates can also act **straight from the board**: pick your name under "You are", then press
**Take this** on a task (assigns you on GitHub) or **Take this role** on the Team tab (writes your
GitHub name into the Roles table in `docs/PLAN.md`).

| What happens on GitHub | What the board shows (within about a minute) |
| --- | --- |
| Someone is assigned to an issue (on GitHub or with "Take this") | The task moves to **In progress** under their name |
| Open a PR that says `Closes #7` | Task #7 gets a "PR" badge |
| The PR is merged (issue closes) | The task moves to **Done** |
| Someone edits `docs/PLAN.md` on `main` | The plan section updates |

## How it works (in plain terms)

- `index.html` is the page everyone sees.
- `api/board.js` is a tiny server function. Because the repo is private, the page can't read GitHub
  by itself. This function uses a GitHub token (kept secret on Vercel) to fetch the issues,
  open pull requests, teammates and `docs/PLAN.md`, and hands the page the result.
- `api/assign.js` and `api/role.js` do the two things the buttons can change: assign/unassign a
  teammate on an issue, and fill/clear a name in the Roles table. They only accept people who
  are collaborators on the repo. `lib/github.js` holds the shared GitHub code.
- `snapshot.json` is a saved copy the page falls back to if GitHub can't be reached.
- Vercel redeploys automatically whenever something is merged into `main`.

## One-time setup (Abdulla)

1. **Create a read-only GitHub token**: github.com → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
   - Repository access: *Only select repositories* → this repo.
   - Permissions: **Contents** and **Issues**: *Read and write* (for the buttons); **Pull requests**: *Read-only*.
2. **Add it to Vercel**: Vercel → the `tylanauts-board` project → Settings → Environment Variables →
   name `GITHUB_TOKEN`, paste the token, tick Production, Save.
3. **Redeploy once** (Deployments → ⋯ → Redeploy) so the function picks up the token.

Note: the board's web address is public to anyone who has the link. They can see task titles,
GitHub usernames and the plan, and they could press the buttons (which only assign teammates
or fill the Roles table; every change shows in GitHub's history). No code is exposed.

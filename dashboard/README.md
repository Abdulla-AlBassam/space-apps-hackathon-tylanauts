# Mission Board (team dashboard)

A single web page that shows our plan, tasks and who is doing what. It is hosted on Vercel
and reads this GitHub repo **live**, so nobody has to update it by hand:

| What you do on GitHub | What the board shows (within about a minute) |
| --- | --- |
| Assign yourself to an issue | The task moves to **In progress** under your name |
| Open a PR that says `Closes #7` | Task #7 gets a "PR" badge |
| The PR is merged (issue closes) | The task moves to **Done** |
| Someone edits `docs/PLAN.md` on `main` | The plan section updates |

## How it works (in plain terms)

- `index.html` is the page everyone sees.
- `api/board.js` is a tiny server function. Because the repo is private, the page can't read GitHub
  by itself. This function holds a read-only GitHub token (kept secret on Vercel), fetches the issues,
  open pull requests and `docs/PLAN.md`, and hands the page the result.
- `snapshot.json` is a saved copy the page falls back to if GitHub can't be reached.
- Vercel redeploys automatically whenever something is merged into `main`.

## One-time setup (Abdulla)

1. **Create a read-only GitHub token**: github.com → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
   - Repository access: *Only select repositories* → this repo.
   - Permissions: **Contents**, **Issues**, **Pull requests**: *Read-only* (Metadata is added automatically).
2. **Add it to Vercel**: Vercel → the `tylanauts-board` project → Settings → Environment Variables →
   name `GITHUB_TOKEN`, paste the token, tick Production, Save.
3. **Redeploy once** (Deployments → ⋯ → Redeploy) so the function picks up the token.

Note: the board's web address is public to anyone who has the link, so it shows task titles,
GitHub usernames and the plan. Nothing else from the repo (no code) is exposed.

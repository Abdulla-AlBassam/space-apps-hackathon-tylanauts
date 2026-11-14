# Notes for Claude (and anyone new)

This repo is Team Tylanauts' entry for NASA Space Apps 2026: a "Whoop for astronauts",
health-monitoring software that turns daily readings into simple scores and alerts.
Six people work on it in parallel, each on their own computer, each often with Claude.
Abdulla is the lead and merges everything.

## Where things are

- `docs/PLAN.md`: the goal, the MVP, roles, decisions, timeline. The source of truth for *what* we build.
- GitHub **Issues**: the task list. Each task is one issue, labelled by role (`frontend`, `backend`, `health-logic`, `pitch`, `lead`) and `mvp` if it's a must-have.
- `CONTRIBUTING.md`: how we use Git (branches, pull requests, avoiding conflicts).
- `dashboard/`: the team's live Mission Board website. It reads the Issues and `docs/PLAN.md` by itself. Don't change it unless asked.

## Before starting work

1. Pull the latest `main`.
2. Read `docs/PLAN.md` and the issue you're working on. If the person hasn't named an issue, help them pick an open, unassigned one that matches their role.
3. Make sure the person is **assigned** to that issue on GitHub (`gh issue edit <N> --add-assignee @me`, or the "Assignees" box on the issue page). This is what moves it to "In progress" on the board and stops two people doing the same task.
4. Work on a branch named after the issue, e.g. `7-dashboard-screen`. Never commit to `main`.

## While working

- Stay inside the issue's scope. If something else needs doing, suggest a new issue instead of doing it.
- Keep to your area's folder where possible, to avoid merge conflicts.
- If the work needs a decision listed under "Decisions" in `docs/PLAN.md` that is still TBD (tech stack, data shape, MVP scores), stop and ask the person to check with the team. Don't decide it alone.
- Explain changes in plain English; several teammates are still learning.

## Finishing

1. Open a pull request into `main`. Its description says what changed and includes `Closes #<N>`,
   so merging it closes the issue and the board moves the task to Done.
2. Ask Abdulla to review. Don't merge your own PR unless Abdulla says so.
3. If the work changed the plan (a decision got made, a role got filled), update `docs/PLAN.md` in the same PR.

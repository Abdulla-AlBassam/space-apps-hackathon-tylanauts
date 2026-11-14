# How we work together

This guide is for everyone on the team, including people new to Git.

## The one rule

**Never work directly on `main`.** `main` is always the version that works.
You make changes on your own **branch** (a safe copy) and ask to merge it with a
**pull request** (PR).

## One-time setup

1. Accept the GitHub invite you got by email (or at https://github.com/notifications).
2. Install Git: https://git-scm.com/downloads
3. Download the project:

   ```bash
   git clone https://github.com/Abdulla-AlBassam/space-apps-hackathon-tylanauts.git
   cd space-apps-hackathon-tylanauts
   ```

## Every time you start a task

```bash
# 1. Go back to main and download everyone's latest work
git checkout main
git pull

# 2. Make a branch for your task (use the issue number + a short name)
git checkout -b 7-dashboard-screen
```

## While you work

Save your progress often. A **commit** is a saved checkpoint.

```bash
git add .
git commit -m "Add heart rate card to dashboard"
```

Upload your branch to GitHub (the first time it needs `-u origin <branch>`):

```bash
git push -u origin 7-dashboard-screen
```

After the first time, plain `git push` is enough.

## When your task is done

1. Go to the repo on GitHub. It will show a button **"Compare & pull request"**. Click it.
2. In the description, write what you did and put `Closes #7` (your issue number). That closes the issue automatically when the PR is merged.
3. Ask someone (usually Abdulla) to look at it.
4. Once it's approved, it gets merged into `main`. Then start your next task from the top of this guide.

## Avoiding "merge conflicts"

A merge conflict happens when two people change the same lines of the same file,
and Git can't decide whose version to keep.

- **Pull often** (`git pull` on `main` before every new task).
- **Keep tasks small**, so branches don't live long.
- **Stay in your own area** where you can (e.g. frontend people in the frontend folder).
- If you do hit a conflict and aren't sure what to do, **stop and ask**. Don't delete things to make it go away.

## Commit messages

Short and in plain English, describing what the change does:

- Good: `Add recovery score calculation`
- Not helpful: `stuff`, `fix`, `asdf`

## Non-code work

Slides, research notes and the pitch can live in the `docs/` folder or a shared
drive. Link anything important from [docs/PLAN.md](docs/PLAN.md) so everyone can find it.

## Before the deadline

A few hours before the end we stop adding features (**feature freeze**). After that,
only bug fixes and demo polish get merged.

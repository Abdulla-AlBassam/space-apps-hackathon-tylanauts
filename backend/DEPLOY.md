# Deploying the backend (Vercel + Neon Postgres)

**Live:** https://tylanauts-api.vercel.app (docs at `/docs`). Vercel project `tylanauts-api` on
nayem-m's account, Neon database `tylanauts-db`. Deployed from the command line, not from GitHub,
so merging to `main` does **not** redeploy it (see "Redeploying" below).

The backend runs on Vercel like the dashboard and the Mission Board, as its own project, with a
Neon Postgres database. Vercel can't keep files, so the database must be Postgres there; without
`DATABASE_URL` the app refuses to start on Vercel instead of silently losing data.
`vercel.json` sets the framework to FastAPI; without it a project created from the command line
deploys as empty static files and every address returns 404.

## What's set up (14 Nov 2026)

| Piece | Details |
| --- | --- |
| Hosting | Vercel project **`tylanauts-api`**, on nayem-m's own Vercel account (team `nayem-ms-projects`, Hobby plan). Separate from Abdulla's account that hosts the dashboard and Mission Board |
| Address | https://tylanauts-api.vercel.app, interactive docs at `/docs` |
| Runtime | Python 3.12 (from `.python-version`), FastAPI detected through `vercel.json`, dependencies from `requirements.txt` |
| Database | **Neon Postgres**, resource **`tylanauts-db`**, added through the Vercel Marketplace and connected to the project. See it and its plan under the project's **Storage** tab |
| Tables | `ingestions` (every upload, its raw payload and its report) and `data_points` (one row per reading, the standard data point stored as JSONB), plus an index on subject, metric and time. Created automatically on the first request (`app/storage/postgres.py`) |
| Settings | Environment variables on the Vercel project, Production only (table below). No secrets are in the repo |
| Deploys | From a laptop with the Vercel CLI. **Not** connected to GitHub |

Environment variables on the project:

| Name | Set by | Used by the backend |
| --- | --- | --- |
| `DATABASE_URL` | Neon integration (pooled connection) | Yes: the database connection |
| `POSTGRES_URL` | Neon integration | Only as a fallback if `DATABASE_URL` is missing |
| `DATABASE_URL_UNPOOLED`, `POSTGRES_*`, `PG*`, `NEON_*` | Neon integration | No (other tools' spellings of the same connection) |
| `INGEST_API_KEY` | Us, as a Vercel secret | Yes: required in the `X-Api-Key` header to send data |
| `CORS_ORIGINS` | Us, as a Vercel secret | Yes: `https://tylanauts-crew-health.vercel.app`, `http://localhost:8000`, `http://127.0.0.1:8000` |

How it was created (for the record, or to rebuild it on another account), from `backend/`:

```bash
npx vercel login                                   # browser approval
npx vercel project create tylanauts-api
npx vercel link --yes --project tylanauts-api      # writes backend/.vercel/ (git-ignored)
npx vercel integration add neon --name tylanauts-db --no-env-pull
#   first run asks you to accept Neon's terms in the browser; run it again afterwards
npx vercel env add INGEST_API_KEY production       # pasted a random key
npx vercel env add CORS_ORIGINS production         # the addresses above
npx vercel deploy --prod
```

Checked on the live address after deploying:

- `/health` returns `{"status": "ok", "storage": "postgres", "version": "0.2.0"}` and `/docs` loads.
- Sending without the key returns `401`; with the key a reading is stored, and sending the same
  reading again is counted as a duplicate.
- The stored reading reads back with the right value and UTC time.
- The dashboard's address gets CORS access; other websites don't.
- `examples/readings-client.js` reads it back as dashboard rows.

That check left one heart-rate reading under the subject **`deploy-check`**. It is kept apart
from the crew ids, so it never shows up for `crew-01` and the others.

**Access:** only nayem-m's Vercel account can redeploy, change settings, or open the database.
The Hobby plan has no team members, so to share control, move the project to a Vercel team
(Project → Settings → Transfer) or rebuild it on Abdulla's account with the steps above.

## Redeploying (how the live one is run)

From `backend/`, logged in to the Vercel account that owns the project:

```bash
npx vercel login          # once per laptop
npx vercel link --yes --project tylanauts-api   # once per laptop
npx vercel deploy --prod  # every time you want the live API updated
```

Environment variables (`DATABASE_URL` from Neon, `INGEST_API_KEY`, `CORS_ORIGINS`) live in the
Vercel project, not in the repo. Change them with `npx vercel env add/rm` or in the dashboard, then
redeploy. `INGEST_API_KEY` is stored as a secret Vercel won't show again; the owner keeps a copy.

## Setting it up from scratch through GitHub instead (in the Vercel dashboard)

1. **Create the project.** Vercel → Add New → Project → import
   `space-apps-hackathon-tylanauts`.
   - **Root Directory:** `backend`
   - Framework: Vercel detects FastAPI by itself (it serves `app` from `app/main.py`).
   - Python: 3.12, from `backend/.python-version`.
   - Suggested project name: `tylanauts-api`.
2. **Add the database.** Project → Storage → Create Database → **Neon** (Postgres) → connect it
   to the project for all environments. This sets `DATABASE_URL` for you. Tables are created on
   the first request.
3. **Add environment variables.** Project → Settings → Environment Variables:

   | Name | Value |
   | --- | --- |
   | `INGEST_API_KEY` | A long random string. Make one with `python3 -c "import secrets; print(secrets.token_urlsafe(24))"`. Share it only with whoever runs the simulator |
   | `CORS_ORIGINS` | `https://tylanauts-crew-health.vercel.app` (add more addresses separated by commas, e.g. `,http://localhost:8000` for local dashboard work) |

4. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables apply.

## Check it worked

- `https://<project>.vercel.app/health` returns `{"status": "ok", "storage": "postgres", ...}`.
  If it says `sqlite`, `DATABASE_URL` isn't connected.
- `https://<project>.vercel.app/docs` shows every endpoint. Click **Authorize** and paste the
  key to try sending data.
- Sending without the key returns `401`.

## Things to know

- **Branches (GitHub setup only):** a GitHub-connected project builds unmerged branches as
  *preview* deployments with their own address, and `main` as production. The live
  command-line project ignores GitHub entirely.
- **Sending data** needs the header `X-Api-Key: <INGEST_API_KEY>`. Reading never does.
- **First request after a quiet spell** can take a second or two: Neon pauses idle databases
  and wakes them on demand.
- **Logs:** Project → Logs shows every request and error.
- **Changing the database later:** anything with a Postgres connection string works. Set
  `DATABASE_URL` and redeploy.

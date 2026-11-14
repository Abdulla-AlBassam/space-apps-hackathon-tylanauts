# Backend links

Everything runs on **https://tylanauts-api.vercel.app** (hosted on Vercel, data in Neon Postgres).

| Page | Link | What it's for |
| --- | --- | --- |
| **Live devices (simulation)** | https://tylanauts-api.vercel.app/live | Start or pause the 18 simulated devices (6 crew × smart watch, smart shirt, radiation badge) and move the levers: stress, low oxygen, radiation, solar storm, device on/off, faulty sensor |
| **Data viewer** | https://tylanauts-api.vercel.app/viewer | What's in the database: totals, readings per crew member and metric, charts, recent uploads and why readings were rejected |
| **API docs (interactive)** | https://tylanauts-api.vercel.app/docs | Every endpoint, with a "Try it out" button |
| **API schema** | https://tylanauts-api.vercel.app/openapi.json | The machine-readable API contract, for frontend code and AI tools |
| **Health check** | https://tylanauts-api.vercel.app/health | Is the server up; should say `"storage": "postgres"` |
| **API base address** | `https://tylanauts-api.vercel.app/api/v1` | What the dashboard's code calls |

Opening https://tylanauts-api.vercel.app on its own takes you to the data viewer.

## Good to know

- **Live devices only send while someone has `/live` open with "Start devices" pressed.**
  Press "Pause devices" when you're done. Their readings are deleted after 60 minutes, so the
  database stays small.
- **The levers are shared:** a slider moved by one person changes it for everyone.
- **Sending data** (forms, scripts) needs the header `X-Api-Key: 3MewV-3_MgznYQphRZqO9J0_vM-7azB8`.
  Reading needs nothing.
- **Browsers** can call the API from the dashboard on GitHub Pages
  (`https://abdulla-albassam.github.io`) and from `localhost:8000`. Ask nayem-m to add any
  other address.
- **How to use the API** (reading, sending, metrics, errors): [README.md](README.md).

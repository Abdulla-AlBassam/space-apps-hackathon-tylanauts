# Use of AI ("Super Intelligence") in Sirius

NASA Space Apps allows AI tools, but asks every team to say clearly **where and how** they
were used, to watermark AI-made images and videos, and to keep NASA branding out of
AI-made content. This page is that statement for everything in this repository.

## Summary

| Area | Did we use AI? | How it's marked |
| --- | --- | --- |
| Code (dashboard, simulator, tools, Mission Board) | **Yes.** Most of it was written with an AI coding assistant, **Claude** (by Anthropic), guided and reviewed by the team. | This page, a note at the top of the main files, a `<meta name="ai-assistance">` tag on every page, and a `Co-Authored-By: Claude` line in each AI-assisted commit (54 of the first 60 commits). |
| Debugging and troubleshooting | **Yes**, with Claude. | Same commit labels. |
| Documents (`docs/`, READMEs) | **Yes.** Most were drafted or edited with Claude from the team's notes and research. | Same commit labels. |
| Logo and motion logo video | **Yes.** Made with AI tools. | Every logo in the app has a small **"AI"** tag; the logo files in `app/brand/` say **"AI-GENERATED"** under the mark; the video has **"AI-GENERATED"** on every frame. |
| Demo slides (`docs/pitch/`) | **Yes.** Built with Claude. | "Made with AI assistance" on every slide, and in the file's properties. |
| Health data | **The data is simulated, not real.** It is produced by code that was written with Claude. Where NASA has published figures, they shape the numbers. | A "Simulated data" tag in the app, notes in `app/data.js` and `simulator/simulate.py`, and [DATA_SOURCES.md](DATA_SOURCES.md). |
| AI inside the product | **No.** Sirius runs no AI or machine-learning model. The scores and alerts are fixed rules, and the Sirius voice uses scripted answers with the browser's built-in speech. | — |

Not made with AI: the 3D anatomy model (BodyParts3D, CC BY 4.0), the icons (an open-source
icon set), and the screenshots of our own app in the slides.

The backend's code is kept in a separate repository, so it isn't covered by this page.

## NASA branding

- Sirius uses **no NASA logo, flag or insignia**, and has its own logo.
- The mission in the demo is made up: **"Sirius Deep Space Mission 3"**. It is not a real NASA
  mission name. (It was "Lunar Gateway Expedition 3" until 15 Nov 2026; we renamed it because
  Gateway is a real NASA programme.)
- We name NASA only when citing a source, for example NASA's 600 mSv career radiation limit
  (NASA-STD-3001).
- Sirius is an independent student project. It isn't made or endorsed by NASA.

"""Write the API schema (OpenAPI 3) to backend/openapi.json.

Run from backend/ after changing any endpoint:  .venv/bin/python scripts/export_openapi.py
The test suite fails if the committed file is out of date.
"""

import json
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

OUTPUT = BACKEND / "openapi.json"


def render() -> str:
    with tempfile.TemporaryDirectory() as tmp:
        app = create_app(Settings(database_url=None, db_path=str(Path(tmp) / "schema.db")))
        return json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    OUTPUT.write_text(render())
    print(f"wrote {OUTPUT}")

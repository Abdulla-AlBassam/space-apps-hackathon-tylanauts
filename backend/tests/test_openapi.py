import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))

from export_openapi import OUTPUT, render  # noqa: E402


def test_committed_openapi_is_up_to_date():
    assert OUTPUT.exists(), "run: .venv/bin/python scripts/export_openapi.py"
    assert json.loads(OUTPUT.read_text()) == json.loads(render()), (
        "backend/openapi.json is out of date. Run: .venv/bin/python scripts/export_openapi.py"
    )


def test_schema_has_readable_operation_ids():
    paths = json.loads(render())["paths"]
    ids = {op["operationId"] for methods in paths.values() for op in methods.values()}
    assert {"ingest", "query_data_points", "list_metrics", "list_adapters", "get_ingestion", "health"} <= ids

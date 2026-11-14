"""Download the official Open mHealth / IEEE 1752.1 schemas (and everything they $ref) into
app/standards/schemas/vendor so validation works fully offline.

Run from backend/:  .venv/bin/python scripts/fetch_schemas.py
"""

import json
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.domain.metrics import METRICS  # noqa: E402

SCHEMAS_DIR = Path(__file__).resolve().parents[1] / "app" / "standards" / "schemas"
VENDOR_DIR = SCHEMAS_DIR / "vendor"

ROOTS = [
    "https://w3id.org/ieee/ieee-1752-schema/data-point.json",
    *(m.schema_uri for m in METRICS.values() if m.schema_id.namespace == "omh"),
]


def fetch(uri: str) -> dict:
    request = urllib.request.Request(uri, headers={"User-Agent": "curl/8.5.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as resp:
        text = resp.read().decode("utf-8").strip()
    # Open mHealth's "*-1.x.json" files are git symlinks; GitHub serves them as the target file name.
    if text.endswith(".json") and not text.startswith("{"):
        return fetch(urljoin(uri, text))
    return json.loads(text)


def collect_refs(node, base: str, out: set[str]) -> None:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and not ref.startswith("#"):
            out.add(urldefrag(urljoin(base, ref)).url)
        for value in node.values():
            collect_refs(value, base, out)
    elif isinstance(node, list):
        for value in node:
            collect_refs(value, base, out)


def file_name_for(uri: str) -> str:
    parsed = urlparse(uri)
    return (parsed.netloc + parsed.path).replace("/", "__")


def main() -> None:
    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    index: dict[str, str] = {}
    queue, seen = list(ROOTS), set()
    for path in (SCHEMAS_DIR / "astro").glob("*.json"):
        doc = json.loads(path.read_text())
        refs: set[str] = set()
        collect_refs(doc, doc["$id"], refs)
        queue.extend(r for r in refs if not r.startswith("https://tylanauts.example/"))
    while queue:
        uri = queue.pop()
        if uri in seen:
            continue
        seen.add(uri)
        print("fetching", uri)
        doc = fetch(uri)
        name = file_name_for(uri)
        (VENDOR_DIR / name).write_text(json.dumps(doc, indent=2))
        index[uri] = name
        if isinstance(doc.get("$id"), str):
            index.setdefault(urldefrag(doc["$id"]).url, name)
        refs: set[str] = set()
        collect_refs(doc, uri, refs)
        queue.extend(refs - seen)
    (VENDOR_DIR / "index.json").write_text(json.dumps(dict(sorted(index.items())), indent=2))
    print(f"saved {len(seen)} schemas to {VENDOR_DIR}")


if __name__ == "__main__":
    main()

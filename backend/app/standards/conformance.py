"""Checks data points against the official IEEE 1752.1 / Open mHealth JSON schemas.

Schemas are bundled in schemas/vendor (refresh with scripts/fetch_schemas.py) and schemas/astro
(ours), so validation never needs the internet.
"""

import json
from functools import cache
from pathlib import Path

from jsonschema import FormatChecker
from jsonschema.validators import validator_for
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT7

SCHEMAS_DIR = Path(__file__).parent / "schemas"
DATA_POINT_URI = "https://w3id.org/ieee/ieee-1752-schema/data-point.json"


class ConformanceError(ValueError):
    pass


@cache
def _registry() -> Registry:
    resources: list[tuple[str, Resource]] = []
    vendor = SCHEMAS_DIR / "vendor"
    for uri, file_name in json.loads((vendor / "index.json").read_text()).items():
        contents = json.loads((vendor / file_name).read_text())
        # Some older schemas have no id, so their relative $refs need the URI they were fetched from.
        if "$id" not in contents and "id" not in contents:
            contents["id" if "draft-04" in contents.get("$schema", "") else "$id"] = uri
        resources.append((uri, Resource.from_contents(contents, default_specification=DRAFT7)))
    for path in (SCHEMAS_DIR / "astro").glob("*.json"):
        contents = json.loads(path.read_text())
        resources.append((contents["$id"], Resource.from_contents(contents, default_specification=DRAFT7)))
    return Registry().with_resources(resources)


@cache
def _validator(schema_uri: str):
    schema = _registry().contents(schema_uri)
    cls = validator_for(schema, default=validator_for({"$schema": "http://json-schema.org/draft-07/schema#"}))
    return cls(schema, registry=_registry(), format_checker=FormatChecker())


def _check(schema_uri: str, instance: dict, label: str) -> None:
    errors = sorted(_validator(schema_uri).iter_errors(instance), key=lambda e: list(e.absolute_path))
    if errors:
        details = "; ".join(f"{label}.{'.'.join(map(str, e.absolute_path)) or '(root)'}: {e.message}" for e in errors)
        raise ConformanceError(f"does not match {schema_uri}: {details}")


def validate_data_point(data_point: dict, body_schema_uri: str) -> None:
    """Raise ConformanceError unless the header and body both match their official schemas."""
    _check(DATA_POINT_URI, data_point, "data_point")
    _check(body_schema_uri, data_point["body"], "body")

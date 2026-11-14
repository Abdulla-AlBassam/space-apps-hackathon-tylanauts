"""The adapter contract. One adapter = one input format (a device export, a form, a CSV...).

To support a new device: create a file in app/adapters/, subclass Adapter, decorate it with
@register. It is discovered automatically, appears in GET /api/v1/adapters, and its `example`
is run through the whole pipeline by the test suite.
"""

import importlib
import pkgutil
from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import ClassVar

from pydantic import ValidationError

from app.domain.models import AdapterWarning, Measurement, RecordError

ParsedItem = Measurement | RecordError | AdapterWarning


class PayloadError(ValueError):
    """The payload as a whole is unreadable (e.g. not valid JSON), so nothing can be ingested."""


class Adapter(ABC):
    id: ClassVar[str]
    name: ClassVar[str]
    description: ClassVar[str]
    content_type: ClassVar[str] = "application/json"
    example: ClassVar[str]

    @abstractmethod
    def parse(self, payload: str) -> Iterable[ParsedItem]:
        """Read the raw payload and yield Measurements.

        Yield a RecordError for a single bad record (the rest still get ingested) and an
        AdapterWarning for anything skipped on purpose. Raise PayloadError only if nothing is readable.
        """


def describe(error: ValidationError) -> str:
    """Turn a pydantic error into one readable line, e.g. "value: Input should be a valid number"."""
    return "; ".join(f"{'.'.join(map(str, e['loc'])) or 'record'}: {e['msg']}" for e in error.errors())


_REGISTRY: dict[str, Adapter] = {}


def register(cls: type[Adapter]) -> type[Adapter]:
    if cls.id in _REGISTRY:
        raise ValueError(f"adapter id '{cls.id}' is registered twice")
    _REGISTRY[cls.id] = cls()
    return cls


def load_adapters() -> None:
    package = importlib.import_module("app.adapters")
    for module in pkgutil.iter_modules(package.__path__):
        if module.name != "base":
            importlib.import_module(f"app.adapters.{module.name}")


def get_adapter(adapter_id: str) -> Adapter | None:
    return _REGISTRY.get(adapter_id)


def all_adapters() -> list[Adapter]:
    return sorted(_REGISTRY.values(), key=lambda a: a.id)

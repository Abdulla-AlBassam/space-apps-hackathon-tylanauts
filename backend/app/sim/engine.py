"""Live device simulator: 6 crew members, each with a smart watch, a smart shirt and a radiation badge.

Vercel can't run a loop in the background, so the live page calls tick() every few seconds.
Each tick sends the readings that are due since the last tick (one per device every 10 seconds,
at most 3 per device to catch up) through the real device adapters into the database. Readings
land on a fixed 10-second grid, so ticks arriving close together never double the data: the
backend recognises the repeats as duplicates. Nothing is sent while nobody has the page open.

Simulated readings use device ids starting with "sim-" and are deleted after RETENTION, so the
database never fills up. The levers (stress, low oxygen, radiation, device on/off, faulty sensor)
change what the devices send, so the dashboard's scores and alerts can be shown reacting.
"""

import json
import random
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, Field, model_validator

from app.pipeline.build import iso
from app.pipeline.ingest import IngestionService
from app.storage.base import Repository

SIM_PREFIX = "sim-"
INTERVAL = timedelta(seconds=10)
MAX_CATCH_UP = 3
RETENTION = timedelta(minutes=60)
PRUNE_EVERY = timedelta(minutes=1)

CREW = [f"crew-{n:02d}" for n in range(1, 7)]
KINDS = {
    "watch": {"label": "Smart watch", "adapter": "smart-watch", "measures": ["heart-rate", "oxygen-saturation"]},
    "shirt": {
        "label": "Smart shirt",
        "adapter": "smart-shirt",
        "measures": ["respiratory-rate", "heart-rate-variability", "blood-pressure"],
    },
    "badge": {"label": "Radiation badge", "adapter": "dosimeter", "measures": ["radiation-dose"]},
}


def device_id(kind: str, crew_id: str) -> str:
    return f"{SIM_PREFIX}{kind}-{crew_id.split('-')[1]}"


DEVICES = {device_id(kind, crew): (kind, crew) for crew in CREW for kind in KINDS}


class CrewLevers(BaseModel):
    stress: float = Field(0, ge=0, le=1, description="Fatigue/stress: heart rate and blood pressure up, HRV down.")
    low_oxygen: float = Field(0, ge=0, le=1, description="Blood oxygen down, breathing and heart rate up.")
    radiation: float = Field(0, ge=0, le=1, description="Radiation exposure: up to 40x the normal daily dose.")


class DeviceLevers(BaseModel):
    on: bool = True
    faulty: bool = Field(False, description="Every other reading is an impossible value the backend rejects.")


class SimSettings(BaseModel):
    running: bool = False
    scenario: str | None = Field(None, max_length=60, description="Name of the preset last applied, if any.")
    crew: dict[str, CrewLevers] = Field(default_factory=lambda: {c: CrewLevers() for c in CREW})
    devices: dict[str, DeviceLevers] = Field(default_factory=lambda: {d: DeviceLevers() for d in DEVICES})

    @model_validator(mode="after")
    def _complete(self):
        if unknown := (set(self.crew) - set(CREW)) | (set(self.devices) - set(DEVICES)):
            raise ValueError(f"unknown crew or device ids: {', '.join(sorted(unknown))}")
        for c in CREW:
            self.crew.setdefault(c, CrewLevers())
        for d in DEVICES:
            self.devices.setdefault(d, DeviceLevers())
        return self


class DeviceStatus(BaseModel):
    id: str
    kind: str
    kind_label: str
    crew_id: str
    adapter_id: str
    measures: list[str]
    on: bool
    faulty: bool
    last_sent: datetime | None = None
    last_values: dict[str, float] = Field(default_factory=dict)
    sent_total: int = 0
    accepted_total: int = 0
    rejected_total: int = 0
    last_rejections: list[str] = Field(default_factory=list)


class SimView(BaseModel):
    settings: SimSettings
    devices: list[DeviceStatus]
    interval_seconds: int
    retention_minutes: int
    last_tick: datetime | None
    accepted_this_tick: int
    live_readings_kept: int
    pruned_total: int
    storage_bytes: int | None


# ---------- what each device measures ----------


def _baseline(crew_id: str) -> dict[str, float]:
    n = int(crew_id.split("-")[1]) - 3.5  # small personal differences
    return {
        "hr": 57 + 1.6 * n,
        "spo2": 97.6 - 0.1 * abs(n),
        "br": 14 + 0.3 * n,
        "hrv": 62 - 3 * n,
        "sys": 117 + 1.5 * n,
        "dia": 76 + 0.8 * n,
        "dose_usv_per_day": 450 + 12 * n,
    }


def _vitals(crew_id: str, levers: CrewLevers, rng: random.Random) -> dict[str, float]:
    b, s, o, r = _baseline(crew_id), levers.stress, levers.low_oxygen, levers.radiation
    return {
        "hr": round(b["hr"] + 28 * s + 12 * o + rng.gauss(0, 1.2), 1),
        "spo2": round(min(100.0, b["spo2"] - 12 * o + rng.gauss(0, 0.3)), 1),
        "br": round(b["br"] + 5 * s + 9 * o + rng.gauss(0, 0.4), 1),
        "hrv": round(max(8.0, b["hrv"] - 38 * s - 8 * o + rng.gauss(0, 2.5)), 1),
        "sys": round(b["sys"] + 28 * s + rng.gauss(0, 2)),
        "dia": round(b["dia"] + 14 * s + rng.gauss(0, 1.5)),
        "dose": round(b["dose_usv_per_day"] * (1 + 39 * r) * (1 + rng.gauss(0, 0.03)), 1),
    }


def _message(kind: str, dev: str, crew_id: str, times: list[datetime], settings: SimSettings, rng: random.Random):
    """Build one device message in that device's own format. Returns (payload, latest values)."""
    levers, faulty = settings.crew[crew_id], settings.devices[dev].faulty
    rows = []
    for t in times:
        v = _vitals(crew_id, levers, rng)
        broken = faulty and int(t.timestamp() // INTERVAL.total_seconds()) % 2 == 0  # every other reading
        rows.append((t, v, broken))
    latest = rows[-1][1]
    if kind == "watch":
        payload = {
            "device_id": dev,
            "model": "Siryius Band (simulated)",
            "battery_pct": 80,
            "readings": [
                {"ts": iso(t), "hr_bpm": 0 if broken else v["hr"], "spo2_pct": v["spo2"], "moving": False}
                for t, v, broken in rows
            ],
        }
        values = {"heart-rate": latest["hr"], "oxygen-saturation": latest["spo2"]}
    elif kind == "shirt":
        payload = {
            "device": {"model": "Astroskin (simulated)", "serial": dev},
            "session": {"id": "live"},
            "samples": [
                {
                    "t": iso(t),
                    "br": v["br"],
                    "hrv_rmssd": v["hrv"],
                    # A faulty cuff swaps the two pressures, which the backend rejects.
                    "sys": v["dia"] if broken else v["sys"],
                    "dia": v["sys"] if broken else v["dia"],
                }
                for t, v, broken in rows
            ],
        }
        values = {
            "respiratory-rate": latest["br"],
            "heart-rate-variability": latest["hrv"],
            "systolic": latest["sys"],
            "diastolic": latest["dia"],
        }
    else:
        t, v, broken = rows[-1]  # the badge reports its rolling 24-hour dose once per message
        payload = {
            "badge_id": dev,
            "windows": [{"start": iso(t - timedelta(days=1)), "end": iso(t), "dose_usv": -1 if broken else v["dose"]}],
        }
        values = {"radiation-dose-usv-24h": latest["dose"]}
    return json.dumps(payload), values


# ---------- state ----------


def load_settings(repo: Repository) -> SimSettings:
    return SimSettings.model_validate(repo.load_sim_state("settings") or {})


def save_settings(repo: Repository, settings: SimSettings) -> None:
    repo.save_sim_state("settings", settings.model_dump())


def _load_runtime(repo: Repository) -> dict:
    return repo.load_sim_state("runtime") or {"last_tick": None, "last_prune": None, "pruned_total": 0, "devices": {}}


def _floor(t: datetime) -> datetime:
    step = INTERVAL.total_seconds()
    return datetime.fromtimestamp((t.timestamp() // step) * step, tz=timezone.utc)


def view(repo: Repository, settings: SimSettings | None = None, runtime: dict | None = None, accepted: int = 0) -> SimView:
    settings = settings or load_settings(repo)
    runtime = runtime or _load_runtime(repo)
    devices = []
    for dev, (kind, crew_id) in DEVICES.items():
        saved = runtime["devices"].get(dev, {})
        devices.append(
            DeviceStatus(
                id=dev,
                kind=kind,
                kind_label=KINDS[kind]["label"],
                crew_id=crew_id,
                adapter_id=KINDS[kind]["adapter"],
                measures=KINDS[kind]["measures"],
                on=settings.devices[dev].on,
                faulty=settings.devices[dev].faulty,
                **saved,
            )
        )
    return SimView(
        settings=settings,
        devices=devices,
        interval_seconds=int(INTERVAL.total_seconds()),
        retention_minutes=int(RETENTION.total_seconds() // 60),
        last_tick=runtime["last_tick"],
        accepted_this_tick=accepted,
        live_readings_kept=repo.count_simulated(SIM_PREFIX),
        pruned_total=runtime["pruned_total"],
        storage_bytes=repo.storage_bytes(),
    )


# ---------- the tick ----------


def tick(repo: Repository, service: IngestionService, now: datetime | None = None) -> SimView:
    now = now or datetime.now(timezone.utc)
    settings = load_settings(repo)
    runtime = _load_runtime(repo)
    grid_now = _floor(now)
    accepted = 0

    if settings.running:
        last = datetime.fromisoformat(runtime["last_tick"]) if runtime["last_tick"] else grid_now - INTERVAL
        first = max(last + INTERVAL, grid_now - INTERVAL * (MAX_CATCH_UP - 1))
        times = []
        t = first
        while t <= grid_now:
            times.append(t)
            t += INTERVAL
        if times:
            rng = random.Random()
            for dev, (kind, crew_id) in DEVICES.items():
                if not settings.devices[dev].on:
                    continue
                payload, values = _message(kind, dev, crew_id, times, settings, rng)
                report = service.ingest(KINDS[kind]["adapter"], payload, subject_id=crew_id, device_id=dev)
                accepted += report.accepted
                saved = runtime["devices"].setdefault(dev, {"sent_total": 0, "accepted_total": 0, "rejected_total": 0})
                saved.update(
                    last_sent=iso(times[-1]),
                    last_values=values,
                    sent_total=saved["sent_total"] + report.received,
                    accepted_total=saved["accepted_total"] + report.accepted,
                    rejected_total=saved["rejected_total"] + len(report.rejected),
                    last_rejections=[f"{r.ref}: {r.reason}" for r in report.rejected][:3],
                )
            runtime["last_tick"] = iso(grid_now)
    else:
        # Paused: don't backfill the gap when it starts again.
        runtime["last_tick"] = None

    last_prune = datetime.fromisoformat(runtime["last_prune"]) if runtime["last_prune"] else None
    if last_prune is None or now - last_prune >= PRUNE_EVERY:
        runtime["pruned_total"] += repo.prune_simulated(SIM_PREFIX, now - RETENTION)
        runtime["last_prune"] = iso(now)

    repo.save_sim_state("runtime", runtime)
    return view(repo, settings, runtime, accepted)

import json
from datetime import datetime, timedelta, timezone

from app.sim import engine
from app.sim.engine import CREW, DEVICES, SIM_PREFIX, SimSettings

# "Now", rounded down to an even 10-second slot (where a faulty sensor sends a broken reading).
# Real time, because uploads are stamped with the real clock and clean-up compares against it.
_now = int(datetime.now(timezone.utc).timestamp())
T0 = datetime.fromtimestamp(_now - _now % 20, tz=timezone.utc)
PER_CREW_ONE_SAMPLE = 2 + 3 + 1  # watch (HR, SpO2) + shirt (breathing, HRV, BP) + badge (dose)


def _run(repository, **changes):
    settings = SimSettings(running=True, **changes)
    engine.save_settings(repository, settings)
    return settings


def _status(view, dev):
    return next(d for d in view.devices if d.id == dev)


def test_nothing_is_sent_while_paused(repository, service):
    view = engine.tick(repository, service, now=T0)
    assert view.accepted_this_tick == 0
    assert repository.count_simulated(SIM_PREFIX) == 0


def test_every_device_sends_through_its_adapter(repository, service):
    _run(repository)
    view = engine.tick(repository, service, now=T0)
    assert view.accepted_this_tick == PER_CREW_ONE_SAMPLE * len(CREW)
    adapters = {u.adapter_id for u in repository.list_ingestions(limit=100)}
    assert adapters == {"smart-watch", "smart-shirt", "dosimeter"}
    assert all(d.last_sent is not None for d in view.devices)
    [dose] = repository.query_data_points("crew-01", metric="radiation-dose")
    assert 0.3 < dose.values["value"] < 0.6  # µSv from the badge, stored as mSv


def test_ticks_never_double_the_data(repository, service):
    _run(repository)
    engine.tick(repository, service, now=T0)
    again = engine.tick(repository, service, now=T0 + timedelta(seconds=4))
    assert again.accepted_this_tick == 0
    later = engine.tick(repository, service, now=T0 + timedelta(seconds=25))
    # Two new 10-second slots: watch and shirt send 2 samples each, the badge one 24-hour window.
    assert later.accepted_this_tick == (2 * 2 + 2 * 3 + 1) * len(CREW)


def test_catch_up_is_capped(repository, service):
    _run(repository)
    engine.tick(repository, service, now=T0)
    view = engine.tick(repository, service, now=T0 + timedelta(minutes=10))
    assert view.accepted_this_tick == (3 * 2 + 3 * 3 + 1) * len(CREW)


def test_stress_lever_worsens_the_vitals(repository, service):
    settings = _run(repository)
    settings.crew["crew-01"].stress = 1.0
    engine.save_settings(repository, settings)
    view = engine.tick(repository, service, now=T0)
    stressed = _status(view, "sim-watch-01").last_values["heart-rate"]
    calm = _status(view, "sim-watch-02").last_values["heart-rate"]
    assert stressed > calm + 20
    assert _status(view, "sim-shirt-01").last_values["heart-rate-variability"] < 40


def test_device_off_and_faulty_sensor(repository, service):
    settings = _run(repository)
    settings.devices["sim-watch-03"].on = False
    settings.devices["sim-shirt-04"].faulty = True
    engine.save_settings(repository, settings)
    view = engine.tick(repository, service, now=T0)
    assert _status(view, "sim-watch-03").last_sent is None
    shirt = _status(view, "sim-shirt-04")
    assert shirt.rejected_total == 1
    assert "systolic must be higher" in shirt.last_rejections[0]


def test_old_simulated_data_is_deleted_and_real_data_kept(repository, service):
    real = json.dumps({"entries": [{"metric": "heart-rate", "value": 60, "time": "2026-11-14T08:00:00Z"}]})
    service.ingest("manual-entry", real, subject_id="crew-01", device_id="watch-01")
    _run(repository)
    engine.tick(repository, service, now=T0)
    assert repository.count_simulated(SIM_PREFIX) > 0

    engine.save_settings(repository, SimSettings(running=False))
    view = engine.tick(repository, service, now=T0 + engine.RETENTION + timedelta(minutes=1))
    assert view.live_readings_kept == 0
    assert view.pruned_total == PER_CREW_ONE_SAMPLE * len(CREW)
    assert [u.device_id for u in repository.list_ingestions(limit=100)] == ["watch-01"]
    assert len(repository.query_data_points("crew-01")) == 1


def test_api(client):
    assert client.get("/api/v1/sim").json()["settings"]["running"] is False
    settings = client.get("/api/v1/sim").json()["settings"]
    settings["running"] = True
    settings["crew"]["crew-02"]["low_oxygen"] = 0.8
    updated = client.put("/api/v1/sim/settings", json=settings).json()
    assert updated["settings"]["crew"]["crew-02"]["low_oxygen"] == 0.8
    tick = client.post("/api/v1/sim/tick").json()
    assert tick["accepted_this_tick"] == PER_CREW_ONE_SAMPLE * len(CREW)
    assert len(tick["devices"]) == len(DEVICES) == 18

    bad = {**settings, "crew": {"crew-99": {"stress": 0.5}}}
    assert client.put("/api/v1/sim/settings", json=bad).status_code == 422
    assert client.put("/api/v1/sim/settings", json={**settings, "crew": {"crew-01": {"stress": 3}}}).status_code == 422
    assert "Siryius live devices" in client.get("/live").text

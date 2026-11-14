"""
Device simulator (issue #3). Pretends to be each astronaut's wearables and sends 30 days of
readings to the backend, the same way real devices would.

What it does, in plain English:
1. Makes up 30 days of readings for six crew members (crew-01 to crew-06).
   crew-01 tells the dashboard's story: the last few days show HRV falling, resting heart
   rate rising and sleep getting shorter, plus one radiation spike on an earlier day.
   It uses the same random numbers as app/data.js, so the live numbers match the sample ones.
2. Sends each device's readings to the backend's manual-entry address, one upload per device.
3. Prints the backend's report: how many readings were stored, duplicates and rejections.

Sending the same days again is safe: the backend spots duplicates and stores nothing new.

Only the readings the backend understands are sent (heart rate, HRV, blood oxygen,
breathing rate, sleep, radiation dose, mood). Skin temperature, deep sleep and exercise
aren't supported by the backend yet, so the dashboard keeps showing sample data for those.

Run it (Python 3.9+, nothing to install):
    SIRIUS_INGEST_KEY=<key> python3 simulator/simulate.py
    SIRIUS_INGEST_KEY=<key> python3 simulator/simulate.py --end 2026-11-15 --crew crew-01
    python3 simulator/simulate.py --dry-run          # print what would be sent, send nothing

The key is the shared sending key from the backend (ask the backend owner where it lives).
"""

import argparse
import json
import math
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

API_BASE = "https://tylanauts-api.vercel.app/api/v1"
DAYS = 30
CREW = [f"crew-0{n}" for n in range(1, 7)]


class Random:
    """The same tiny random-number generator as app/data.js, so both make the same numbers."""

    def __init__(self, seed):
        self.seed = seed

    def rand(self):
        self.seed = (self.seed * 16807) % 2147483647
        return (self.seed - 1) / 2147483646

    def noise(self, size):
        return (self.rand() - 0.5) * 2 * size


def js_round(x):
    """JavaScript's Math.round (halves go up), which Python's round() doesn't do."""
    return math.floor(x + 0.5)


def tenth(x):
    return js_round(x * 10) / 10


def stress(day_index, story):
    """How rough each of the last few days was (0 = normal). Only crew-01 has the bad days."""
    if not story:
        return 0
    from_end = DAYS - 1 - day_index  # 0 = the last day
    return {0: 1.0, 1: 0.7, 2: 0.45, 3: 0.2}.get(from_end, 0)


def make_days(crew_id, end_date):
    """Return a list of 30 days, each a dict of the readings for that day."""
    number = int(crew_id.split("-")[1])
    story = number == 1
    # crew-01 uses seed 7 like app/data.js; the others get their own seeds so they differ.
    rng = Random(7 if story else 7 + number * 101)
    # Small personal differences so the six people don't look identical.
    offset = 0 if story else (number - 3.5)
    days = []
    for i in range(DAYS):
        date = end_date - timedelta(days=DAYS - 1 - i)
        s = stress(i, story)
        # Same order of random numbers as generateReadings() in app/data.js. Readings the
        # backend can't store yet are still drawn (and thrown away) to keep the order the same.
        day = {"time": date}
        day["resting_hr"] = tenth(56 + offset + rng.noise(2) + s * 9)
        day["hrv_rmssd"] = tenth(62 - offset * 2 + rng.noise(5) - s * 24)
        day["spo2"] = tenth(97.5 + rng.noise(0.6) - s * 0.8)
        rng.noise(0.15)  # skin temperature (not supported yet)
        day["resp_rate"] = tenth(14 + rng.noise(0.6) + s * 1.6)
        day["sleep_hours"] = tenth(7.4 + rng.noise(0.45) - s * 1.9)
        rng.noise(2.5)  # deep sleep (not supported yet)
        rng.noise(20)  # exercise minutes (not supported yet)
        rng.noise(6)  # exercise heart rate (not supported yet)
        # A spike on day 18 stands in for a solar particle event.
        day["radiation_dose"] = tenth(0.42 + rng.noise(0.05) + (0.9 if i == 18 else 0))
        days.append(day)
    # Mood (1 to 5) is typed in daily. Same formula and order as addScores() in app/data.js.
    for i, day in enumerate(days):
        from_end = DAYS - 1 - i
        mood = js_round(4 + rng.noise(0.6) - (1 if story and from_end <= 2 else 0) - (0.6 if story and from_end == 0 else 0))
        day["mood"] = max(1, min(5, mood))
    return days


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def uploads_for(days):
    """Group the readings by the device that would have sent them: {device_id: [entries]}."""
    by_device = {"watch-01": [], "strap-01": [], "band-01": [], "dosi-01": [], None: []}
    for d in days:
        t = iso(d["time"])
        sensed = {"time": t, "modality": "sensed"}
        by_device["watch-01"].append({"metric": "heart-rate", "value": d["resting_hr"], "unit": "bpm", **sensed})
        by_device["watch-01"].append({"metric": "oxygen-saturation", "value": d["spo2"], "unit": "%", **sensed})
        by_device["strap-01"].append({"metric": "heart-rate-variability", "value": d["hrv_rmssd"], "unit": "ms", **sensed})
        by_device["strap-01"].append({"metric": "respiratory-rate", "value": d["resp_rate"], "unit": "breaths/min", **sensed})
        # Sleep is a period: it ends at the morning reading time.
        start = d["time"] - timedelta(hours=d["sleep_hours"])
        by_device["band-01"].append({"metric": "sleep-duration", "value": d["sleep_hours"], "unit": "h",
                                     "start": iso(start), "end": t, "modality": "sensed"})
        by_device["dosi-01"].append({"metric": "radiation-dose", "value": d["radiation_dose"], "unit": "mSv", **sensed})
        # Mood is typed in by the astronaut, so it has no device.
        by_device[None].append({"metric": "mood", "value": d["mood"], "time": t})
    return by_device


def send(api_base, key, crew_id, device_id, entries):
    url = f"{api_base}/ingest/manual-entry?subject_id={crew_id}"
    if device_id:
        url += f"&device_id={device_id}"
    body = json.dumps({"entries": entries}).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-Api-Key": key})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"The backend said {e.code} for {url}: {e.read().decode()[:300]}")


def main():
    p = argparse.ArgumentParser(description="Send 30 days of simulated readings to the Sirius backend.")
    p.add_argument("--end", help="Last day to simulate, YYYY-MM-DD (default: today, UTC)")
    p.add_argument("--crew", nargs="*", default=CREW, help="Which crew ids (default: crew-01 to crew-06)")
    p.add_argument("--api", default=os.environ.get("SIRIUS_API_BASE", API_BASE), help="Backend address")
    p.add_argument("--dry-run", action="store_true", help="Print what would be sent, send nothing")
    args = p.parse_args()

    end_day = datetime.strptime(args.end, "%Y-%m-%d") if args.end else datetime.now(timezone.utc)
    # Readings are taken at 07:00 UTC each morning, like the dashboard's sample data.
    end_date = datetime(end_day.year, end_day.month, end_day.day, 7, 0, tzinfo=timezone.utc)

    key = os.environ.get("SIRIUS_INGEST_KEY", "")
    if not key and not args.dry_run:
        raise SystemExit("Set SIRIUS_INGEST_KEY to the backend's sending key first (or use --dry-run).")

    for crew_id in args.crew:
        uploads = uploads_for(make_days(crew_id, end_date))
        for device_id, entries in uploads.items():
            label = device_id or "typed in"
            if args.dry_run:
                print(f"{crew_id} {label}: {len(entries)} readings, first: {json.dumps(entries[0])}")
                continue
            r = send(args.api, key, crew_id, device_id, entries)
            rejected = r.get("rejected") or []
            print(f"{crew_id} {label}: {r.get('accepted')} stored, {r.get('duplicates')} duplicates, {len(rejected)} rejected")
            for bad in rejected:
                print(f"   rejected {bad}")


if __name__ == "__main__":
    sys.exit(main())

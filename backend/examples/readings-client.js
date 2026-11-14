// Talks to the live backend.
// fetchReadings(): drop-in replacement for generateReadings() in app/data.js. Fetches stored data
//   points and flattens them into the { astronaut_id, device_id, device_type, metric, value, unit, time }
//   rows the dashboard uses.
// sendEntries(): saves typed-in readings (check-in form, health log) and returns the backend's report.

const API_BASE = "https://tylanauts-api.vercel.app/api/v1";
// Key for sending data. Demo data only, so it's kept in the repo on purpose.
const API_KEY = "3MewV-3_MgznYQphRZqO9J0_vM-7azB8";

// Backend metric id -> name the dashboard already uses.
const DASHBOARD_NAMES = {
  "heart-rate": "resting_hr",
  "oxygen-saturation": "spo2",
  "heart-rate-variability": "hrv_rmssd",
  "respiratory-rate": "resp_rate",
  "sleep-duration": "sleep_hours",
  "radiation-dose": "radiation_dose",
  "mood": "mood",
  "blood-pressure": "blood_pressure",
  "body-temperature": "body_temp",
  "blood-glucose": "blood_glucose",
};

async function fetchReadings(astronautId) {
  const url = `${API_BASE}/subjects/${encodeURIComponent(astronautId)}/data-points?limit=5000`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Backend returned ${response.status} for ${url}`);
  const records = await response.json();

  return records.flatMap((record) => {
    const body = record.data_point.body;
    const unit = Object.values(body).find((v) => v && typeof v === "object" && "unit" in v)?.unit;
    const name = DASHBOARD_NAMES[record.metric] ?? record.metric;
    // Periods (sleep, daily dose) count for the day they end on.
    const time = record.effective_end ?? record.effective_start;
    const base = { astronaut_id: record.subject_id, device_id: record.device_id, device_type: record.adapter_id, unit, time };
    const parts = Object.entries(record.values);
    // Blood pressure has two values: becomes blood_pressure_systolic and blood_pressure_diastolic.
    return parts.map(([part, value]) => ({ ...base, metric: parts.length > 1 ? `${name}_${part}` : name, value }));
  });
}

// entries: [{ metric: "mood", value: 4, time: "2026-11-14T07:40:00Z", extras: { note: "..." } }, ...]
// Uses backend metric ids ("mood", "blood-pressure", "sleep-duration"...), not the dashboard's names.
// Returns { accepted, duplicates, rejected: [{ ref, reason }], warnings, ... }; show rejected[].reason to the user.
async function sendEntries(astronautId, entries) {
  const url = `${API_BASE}/ingest/manual-entry?subject_id=${encodeURIComponent(astronautId)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": API_KEY },
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}: ${await response.text()}`);
  return response.json();
}

if (typeof module !== "undefined") module.exports = { fetchReadings, sendEntries, API_BASE };

// Drop-in replacement for generateReadings() in app/data.js.
// Fetches stored data points from the backend and flattens them into the
// { astronaut_id, device_id, device_type, metric, value, unit, time } rows the dashboard uses.

const API_BASE = "http://localhost:8000/api/v1";

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

if (typeof module !== "undefined") module.exports = { fetchReadings, API_BASE };

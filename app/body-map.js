/*
 * BODY MAP: a 3D figure with glowing points where a health area needs attention.
 * SIMULATED DATA. Nothing here is a real astronaut's reading.
 *
 * What this file does, in plain English:
 * 1. Builds a list of body areas (heart, mind & sleep, eyes, radiation, bones, muscles).
 *    Numbers that the dashboard already simulates (heart rate, sleep, radiation, exercise)
 *    are read from window.HEALTH_DATA (data.js) so both pages tell the same story.
 *    The rest (mood score, eye exam, exercise plan) are made-up "hand-entered" results.
 * 2. Draws a see-through, glowing human figure with three.js. The figure is built here
 *    from simple shapes (spheres and capsules), so there is no 3D model file and no
 *    model licence to worry about. three.js itself is MIT-licensed and loaded from a CDN.
 * 3. Puts a clickable glowing point on the body for each area. Its colour is the status
 *    (blue = Normal, yellow = Watch, red = Act now). Clicking it turns the body to face
 *    you and opens the details panel on the right.
 *
 * To move this into the main dashboard later: copy the three parts of body-map.html
 * (#bm-list, #bm-stage, #bm-detail) into index.html and load this file the same way.
 */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const H = window.HEALTH_DATA;
const today = H.days[H.days.length - 1];
const base = H.baseline;
const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const deviceLabel = (id) => (H.devices.find((d) => d.id === id) || {}).label || id;
const round = (n, d = 0) => Number(n.toFixed(d));

/* ---------- 1. The body areas and their (simulated) status ---------- */

// Brand colours for each status (Space Apps brand kit).
const STATUS_COLOUR = { good: 0x2e96f5, watch: 0xeafe07, act: 0xe43700 };
const STATUS_WORD = { good: "Normal", watch: "Watch", act: "Act now" };
const ICONS = {
  good: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.2l2 2 4-4.2"/></svg>',
  watch: '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 1.8l6.6 12H1.4z" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.3"/></svg>',
  act: '<svg class="ico" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7.2"/><path d="M8 4v4.8M8 11v.4" stroke="#07173F" stroke-width="1.9" stroke-linecap="round"/></svg>',
};

// Is a reading outside the astronaut's own normal range?
const outside = (metric) => today[metric] < base[metric].low || today[metric] > base[metric].high;
const range = (metric, d = 0) => `${round(base[metric].low, d)}–${round(base[metric].high, d)}`;

// The heart's status comes from the dashboard's own alert, so both pages agree.
const recoveryAlert = H.alerts.find((a) => a.signals.includes("resting_hr"));
const heartStatus = recoveryAlert ? recoveryAlert.level : outside("hrv_rmssd") ? "watch" : "good";
const doseSpike = H.days.find((d) => d.radiation_dose > 1);
const CAREER_LIMIT_MSV = 600; // NASA's career radiation limit (NASA-STD-3001)

/*
 * Each area: where its glowing point sits on the body (x = sideways, y = height in metres,
 * z = front/back; the figure faces +z), which way that spot faces (used to dim points on
 * the far side), the readings, and what to do. "Hand-entered" = typed in by the astronaut.
 */
const AREAS = [
  {
    id: "heart",
    name: "Heart",
    category: "Heart",
    status: heartStatus,
    point: [0.035, 1.24, 0.13],
    facing: [0, 0, 1],
    summary: "Resting heart rate is up and heart rate variability is down. Recovery has fallen 3 days in a row.",
    readings: [
      { name: "Resting heart rate", value: round(today.resting_hr), unit: "bpm", normal: range("resting_hr"), out: outside("resting_hr"), source: deviceLabel(today.sources.resting_hr) },
      { name: "Heart rate variability", value: today.hrv_rmssd, unit: "ms", normal: range("hrv_rmssd"), out: outside("hrv_rmssd"), source: deviceLabel(today.sources.hrv_rmssd) },
      { name: "Blood pressure", value: "118/76", unit: "mmHg", normal: "below 130/80", out: false, source: "Hand-entered" },
    ],
    actions: recoveryAlert ? recoveryAlert.actions : ["No action needed."],
    link: ["index.html#trends", "See the 30-day heart trend"],
    help: "Without gravity, body fluids move toward the head and the heart does less work, so over a long mission it can lose some fitness. A resting heart rate above your normal, together with a low HRV, often means fatigue, stress or the start of an illness.",
  },
  {
    id: "mind",
    name: "Mind, mood & sleep",
    category: "Mind & mood, Sleep",
    status: outside("sleep_hours") ? "watch" : "good",
    point: [0, 1.75, 0.03],
    facing: [0, 0.7, 0.7],
    summary: "Short sleep for several nights and a lower mood score today. Worth keeping an eye on.",
    readings: [
      { name: "Sleep last night", value: today.sleep_hours, unit: "h", normal: range("sleep_hours", 1), out: outside("sleep_hours"), source: deviceLabel(today.sources.sleep_hours) },
      { name: "Mood check", value: 3, unit: "/ 5", normal: "4–5", out: true, source: "Hand-entered, today" },
      { name: "Cognitive test", value: "Normal", unit: "", normal: "monthly", out: false, source: "Hand-entered, 12 days ago" },
    ],
    actions: ["Aim for 8 hours in your sleep station tonight", "Log how you feel in today's check-in", "Raise it at your next private talk with the flight surgeon"],
    link: ["index.html#checkin", "Go to the daily check-in"],
    help: "Isolation, confinement, a packed schedule and disrupted sleep can wear down mood, focus and teamwork. NASA counts behavioural health among the main risks of long missions. Astronauts often sleep less in space than on Earth, so sleep and mood are tracked together here.",
  },
  {
    id: "eyes",
    name: "Eyes (SANS)",
    category: "Eyes",
    status: "good",
    point: [0.038, 1.64, 0.105],
    facing: [0, 0, 1],
    summary: "Last eye check found no swelling at the back of the eye. Next check is due in about 8 days.",
    readings: [
      { name: "Eye scan (optic disc)", value: "No swelling", unit: "", normal: "no swelling", out: false, source: "Hand-entered, flight day 90" },
      { name: "Eye chart", value: "20/20", unit: "", normal: "20/20", out: false, source: "Hand-entered, flight day 90" },
      { name: "Next eye check", value: "Day 150", unit: "", normal: "~30 days before return", out: false, source: "Reminder" },
    ],
    actions: ["No action needed. You'll get a reminder before the next check."],
    link: null,
    help: "SANS (Spaceflight Associated Neuro-ocular Syndrome): on long missions, fluid shifting toward the head can cause swelling at the back of the eye and changes in vision. NASA checks eyes on a schedule, for example on flight day 30, flight day 90 and about 30 days before return.",
  },
  {
    id: "radiation",
    name: "Radiation dose",
    category: "Radiation",
    status: "good",
    point: [0.11, 1.36, 0.125],
    facing: [0, 0, 1],
    summary: `Mission total is ${today.doseTotal} mSv, ${Math.round((today.doseTotal / CAREER_LIMIT_MSV) * 100)}% of the career limit.${doseSpike ? " One spike was recorded earlier." : ""}`,
    readings: [
      { name: "Today", value: today.radiation_dose, unit: "mSv", normal: "below 1", out: today.radiation_dose > 1, source: deviceLabel(today.sources.radiation_dose) },
      { name: "Mission total", value: today.doseTotal, unit: "mSv", normal: `career limit ${CAREER_LIMIT_MSV}`, out: false, source: deviceLabel(today.sources.radiation_dose) },
      ...(doseSpike ? [{ name: "Spike", value: doseSpike.radiation_dose, unit: "mSv", normal: "below 1", out: true, source: `Radiation badge, ${doseSpike.date}` }] : []),
    ],
    actions: ["No action needed now. Your flight surgeon can see these numbers."],
    link: null,
    help: "Outside Earth's protective magnetic field, astronauts get much more radiation than on the ground, which raises long-term health risks such as cancer. The badge on your chest measures the dose. NASA limits an astronaut's career total to 600 mSv.",
  },
  {
    id: "bone",
    name: "Bones (spine & hips)",
    category: "Bone & muscle",
    status: "watch",
    point: [0, 1.04, -0.125],
    facing: [0, 0, -1],
    summary: "Two resistance-exercise sessions were missed this week. These sessions are the main way to protect bone in space.",
    readings: [
      { name: "Resistance sessions this week", value: "4 of 6", unit: "", normal: "6 of 6", out: true, source: "Hand-entered" },
      { name: "Body mass", value: 78.4, unit: "kg", normal: "77–80", out: false, source: "Hand-entered, 3 days ago" },
    ],
    actions: ["Fit in the missed resistance session today or tomorrow", "Keep heavy lifting to the planned weights"],
    link: null,
    help: "Without gravity loading the skeleton, astronauts can lose about 1 to 1.5% of bone mass in the hips and spine each month. Bone density is scanned before and after the mission; during the mission, daily resistance exercise is the main protection, so it is tracked here.",
  },
  {
    id: "muscle",
    name: "Leg muscles",
    category: "Bone & muscle",
    status: "good",
    point: [-0.095, 0.66, 0.075],
    facing: [0, 0, 1],
    summary: "Leg strength is holding close to your pre-flight level.",
    readings: [
      { name: "Exercise today", value: Math.round(today.exercise_minutes), unit: "min", normal: "daily", out: false, source: deviceLabel(today.sources.exercise_minutes) },
      { name: "Leg strength test", value: 97, unit: "% of pre-flight", normal: "90% or more", out: false, source: "Hand-entered, monthly" },
    ],
    actions: ["No action needed. Keep up the daily treadmill and bike sessions."],
    link: null,
    help: "Leg and back muscles shrink when they aren't used, and in microgravity they barely work to hold you up. Daily treadmill, bike and resistance exercise keeps them strong for the return to gravity.",
  },
];

/* ---------- 2. Side panels (list + details) ---------- */

$("bm-astro").textContent = `${H.astronaut.name}   •   Day ${H.astronaut.missionDay} of ${H.astronaut.missionLength}`;

const listEl = $("bm-list");
listEl.innerHTML = AREAS.map(
  (a) => `<button type="button" class="bm-row" role="listitem" data-id="${a.id}" aria-pressed="false">
      <i class="dot is-${a.status}"></i>${a.name}<small class="is-${a.status}">${STATUS_WORD[a.status]}</small>
    </button>`
).join("");
listEl.addEventListener("click", (e) => {
  const row = e.target.closest(".bm-row");
  if (row) select(row.dataset.id === selectedId ? null : row.dataset.id);
});

const detailEl = $("bm-detail");
function renderOverview() {
  const count = (s) => AREAS.filter((a) => a.status === s).length;
  detailEl.innerHTML = `<div class="bm-overview">
      <div class="panel-head"><h2>Today at a glance</h2></div>
      <div class="bm-counts">
        <div class="bm-count"><b class="is-act">${count("act")}</b><span>Act now</span></div>
        <div class="bm-count"><b class="is-watch">${count("watch")}</b><span>Watch</span></div>
        <div class="bm-count"><b class="is-good">${count("good")}</b><span>Normal</span></div>
      </div>
      <p>Click a glowing point on the body, or a row in the list, to see what's going on and what to do.</p>
    </div>`;
}
function renderDetail(a) {
  const readings = a.readings
    .map(
      (r) => `<div class="bm-reading${r.out ? " out" + (a.status === "act" ? " act" : "") : ""}">
        <span class="name">${r.name}</span>
        <span class="val">${r.value}${r.unit ? `<small>${r.unit}</small>` : ""}</span>
        <span class="meta">Normal: ${r.normal}  •  ${r.source}</span>
      </div>`
    )
    .join("");
  detailEl.innerHTML = `
    <div class="bm-detail-top">
      <span class="alert-level is-${a.status}">${ICONS[a.status]}${STATUS_WORD[a.status]}</span>
      <button type="button" class="bm-close" aria-label="Close details">×</button>
    </div>
    <h2 class="bm-title">${a.name} <button type="button" class="help" data-help="${a.id}" aria-label="Why this matters">?</button></h2>
    <p class="bm-sub">Category: ${a.category}</p>
    <p class="bm-summary">${a.summary}</p>
    <div class="bm-readings">${readings}</div>
    <h3>What to do</h3>
    <ul class="bm-actions">${a.actions.map((x) => `<li>${x}</li>`).join("")}</ul>
    ${a.link ? `<a class="bm-link" href="${a.link[0]}">${a.link[1]} →</a>` : ""}`;
  detailEl.querySelector(".bm-close").addEventListener("click", () => select(null));
}

/* "?" help pop-ups (same look as the dashboard's) */
const HELP = { "bm-areas": ["Body areas", "Each row is a part of the body we track. Its colour is today's status: blue is Normal, yellow is Watch, red is Act now. The same colours glow on the 3D body."] };
AREAS.forEach((a) => (HELP[a.id] = [`Why ${a.name.toLowerCase()} matters in space`, a.help]));
const pop = $("help-pop");
let pinned = null;
function showHelp(btn) {
  const [title, text] = HELP[btn.dataset.help] || ["", ""];
  pop.innerHTML = `<b>${title}</b>${text}`;
  pop.classList.add("show");
  const r = btn.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), innerWidth - pw - 12) + "px";
  pop.style.top = (r.bottom + 10 + ph > innerHeight - 12 ? r.top - ph - 10 : r.bottom + 10) + "px";
}
const hideHelp = () => pop.classList.remove("show");
document.addEventListener("mouseover", (e) => { const b = e.target.closest(".help"); if (b && !pinned) showHelp(b); });
document.addEventListener("mouseout", (e) => { if (e.target.closest(".help") && !pinned) hideHelp(); });
document.addEventListener("click", (e) => {
  const b = e.target.closest(".help");
  if (b) { e.stopPropagation(); pinned = pinned === b ? null : b; pinned ? showHelp(b) : hideHelp(); }
  else if (pinned) { pinned = null; hideHelp(); }
});

/* ---------- 3. The 3D scene ---------- */

const stage = $("bm-stage");
const markerLayer = $("bm-markers");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (err) {
  $("bm-fallback").hidden = false;
  markerLayer.hidden = true;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const body = new THREE.Group(); // everything that turns with the figure
scene.add(body);

// The see-through "hologram" skin. It glows most at the edges (where the surface
// turns away from you), plus a bright band that sweeps up and down like a scanner.
const skinMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uBase: { value: new THREE.Color(0x0042a6) },
    uRim: { value: new THREE.Color(0x2e96f5) },
    uScan: { value: 0 },
  },
  vertexShader: `
    varying vec3 vNormal; varying vec3 vView; varying float vY;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec4 mv = viewMatrix * world;
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      vY = world.y;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uBase; uniform vec3 uRim; uniform float uScan;
    varying vec3 vNormal; varying vec3 vView; varying float vY;
    void main() {
      float edge = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
      float scan = smoothstep(0.035, 0.0, abs(vY - uScan));
      vec3 col = mix(uBase, uRim, edge) + uRim * scan * 0.8;
      float alpha = 0.10 + edge * 0.75 + scan * 0.25;
      gl_FragColor = vec4(col, alpha);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
// Invisible copy that only fills the depth buffer, so only the outermost skin glows
// (otherwise overlapping shapes like shoulder + arm would add up into bright seams).
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });

function addSkin(geometry, position, rotation, scale) {
  for (const [mat, order] of [[depthOnly, 0], [skinMaterial, 1]]) {
    const m = new THREE.Mesh(geometry, mat);
    m.renderOrder = order;
    if (position) m.position.set(...position);
    if (rotation) m.quaternion.copy(rotation);
    if (scale) m.scale.set(...scale);
    body.add(m);
  }
}
// A rounded tube from point a to point b (used for arms, legs, neck).
function limb(a, b, radius) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const dir = to.clone().sub(from);
  const geo = new THREE.CapsuleGeometry(radius, Math.max(dir.length() - radius, 0.01), 8, 20);
  const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  addSkin(geo, from.add(to).multiplyScalar(0.5).toArray(), rot);
}

// --- Build the figure (about 1.8 m tall, standing at y = 0, facing +z) ---
const sphere = new THREE.SphereGeometry(1, 40, 28);
addSkin(sphere, [0, 1.63, 0.005], null, [0.095, 0.118, 0.108]); // head
limb([0, 1.44, -0.01], [0, 1.55, 0], 0.048); // neck
// Torso: a shape spun around the vertical axis, then flattened front-to-back
const torsoProfile = [
  [0.0, 0.86], [0.13, 0.87], [0.165, 0.93], [0.16, 1.0], [0.142, 1.08], [0.145, 1.15],
  [0.165, 1.24], [0.182, 1.32], [0.18, 1.39], [0.14, 1.445], [0.07, 1.47], [0.0, 1.475],
].map(([r, y]) => new THREE.Vector2(r, y));
addSkin(new THREE.LatheGeometry(torsoProfile, 48), [0, 0, 0], null, [1, 1, 0.62]);
for (const s of [1, -1]) {
  addSkin(sphere, [0.185 * s, 1.385, -0.005], null, [0.062, 0.058, 0.06]); // shoulder
  limb([0.2 * s, 1.37, -0.01], [0.245 * s, 1.1, -0.02], 0.043); // upper arm
  limb([0.245 * s, 1.1, -0.02], [0.27 * s, 0.86, 0.03], 0.036); // forearm
  addSkin(sphere, [0.275 * s, 0.8, 0.035], null, [0.028, 0.06, 0.042]); // hand
  limb([0.088 * s, 0.9, 0], [0.098 * s, 0.5, 0.005], 0.07); // thigh
  limb([0.098 * s, 0.5, 0.005], [0.1 * s, 0.1, -0.015], 0.05); // lower leg
  limb([0.1 * s, 0.045, -0.03], [0.105 * s, 0.035, 0.1], 0.035); // foot
}

// --- Inside the body: faint organs and bones that light up with their area's status ---
const organs = {}; // area id -> list of materials to tint
function glowMaterial(opacity = 0.35) {
  return new THREE.MeshBasicMaterial({ color: 0x2e96f5, transparent: true, opacity, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
}
function organ(id, object) {
  object.renderOrder = 2;
  object.traverse((o) => { if (o.material) { o.renderOrder = 2; (organs[id] ||= []).push(o.material); } });
  body.add(object);
  return object;
}
// Brain: a wireframe ball inside the head
const brain = organ("mind", new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), Object.assign(glowMaterial(0.3), { wireframe: true })));
brain.scale.set(0.072, 0.06, 0.082);
brain.position.set(0, 1.665, -0.005);
// Eyes
for (const s of [1, -1]) organ("eyes", new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), glowMaterial(0.6))).position.set(0.036 * s, 1.638, 0.088);
// Heart: two overlapping blobs, tilted to the astronaut's left
const heart = new THREE.Group();
for (const [x, y, sx] of [[-0.016, 0.012, 0.034], [0.018, 0.012, 0.034], [0.002, -0.015, 0.042]]) {
  const m = new THREE.Mesh(sphere, glowMaterial(0.45));
  m.position.set(x, y, 0);
  m.scale.set(sx, sx * 1.15, sx * 0.9);
  heart.add(m);
}
heart.position.set(0.03, 1.24, 0.04);
heart.rotation.z = -0.5;
organ("heart", heart);
// Radiation badge: a small card clipped on the chest (outside the body)
const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.006), glowMaterial(0.55));
badge.position.set(0.11, 1.36, 0.118);
organ("radiation", badge);
// Spine: a stack of small vertebrae following a gentle S-curve, plus a simple pelvis
const spine = new THREE.Group();
const vertebra = new THREE.BoxGeometry(0.034, 0.016, 0.03);
for (let i = 0; i < 24; i++) {
  const t = i / 23;
  const v = new THREE.Mesh(vertebra, glowMaterial(0.45));
  v.position.set(0, 0.96 + t * 0.5, -0.07 + Math.sin(t * Math.PI * 1.6) * 0.018);
  v.scale.setScalar(1.25 - t * 0.5);
  spine.add(v);
}
const pelvis = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 32), glowMaterial(0.35));
pelvis.position.set(0, 0.93, -0.01);
pelvis.rotation.x = Math.PI / 2.4;
spine.add(pelvis);
organ("bone", spine);
// Ribs: thin rings around the chest
const ribs = new THREE.Group();
for (let i = 0; i < 7; i++) {
  const curve = new THREE.EllipseCurve(0, 0, 0.14 - Math.abs(i - 3) * 0.008, 0.088, 0, Math.PI * 2);
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineBasicMaterial({ color: 0x2e96f5, transparent: true, opacity: 0.25, depthTest: false, blending: THREE.AdditiveBlending }));
  line.rotation.x = Math.PI / 2 + 0.25;
  line.position.set(0, 1.16 + i * 0.033, 0.0);
  ribs.add(line);
}
ribs.renderOrder = 2;
ribs.children.forEach((l) => (l.renderOrder = 2));
body.add(ribs); // decorative only, so the chest stays readable
// Leg bones (femurs) and the thigh muscle that the "Leg muscles" point refers to
for (const s of [1, -1]) {
  const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 8), glowMaterial(0.35));
  femur.position.set(0.093 * s, 0.7, 0.002);
  organ("bone", femur);
  const quad = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.24, 6, 16), glowMaterial(0.18));
  quad.position.set(0.093 * s, 0.68, 0.025);
  organ("muscle", quad);
}

// --- Around the body: a glowing floor ring and a field of stars ---
const floor = new THREE.Group();
for (const [r, o] of [[0.32, 0.5], [0.45, 0.28], [0.62, 0.14]]) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.006, 96), new THREE.MeshBasicMaterial({ color: 0x2e96f5, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  floor.add(ring);
}
// A dashed outer ring that slowly turns
const dashes = new THREE.Group();
for (let i = 0; i < 36; i++) {
  const seg = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.535, 4, 1, (i / 36) * Math.PI * 2, (Math.PI * 2) / 72), floor.children[0].material.clone());
  seg.material.opacity = 0.4;
  seg.rotation.x = -Math.PI / 2;
  dashes.add(seg);
}
floor.add(dashes);
scene.add(floor);

const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 700; i++) {
  const v = new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 10);
  starPos.push(v.x, v.y + 1, v.z);
}
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false }));
scene.add(stars);

/* ---------- 4. Glowing points (HTML buttons that follow the 3D body) ---------- */

const markers = AREAS.map((a) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `bm-marker is-${a.status}`;
  el.setAttribute("aria-label", `${a.name}: ${STATUS_WORD[a.status]}`);
  el.innerHTML = `<span class="bm-ring"></span><span class="bm-core"></span><span class="label">${a.name}</span>`;
  el.addEventListener("click", (e) => { e.stopPropagation(); select(a.id === selectedId ? null : a.id); });
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  markerLayer.appendChild(el);
  // Colour the organ inside to match the status
  (organs[a.id] || []).forEach((m) => m.color.setHex(STATUS_COLOUR[a.status]));
  return { area: a, el, local: new THREE.Vector3(...a.point), facing: new THREE.Vector3(...a.facing).normalize() };
});

/* ---------- 5. Turning, zooming and selecting ---------- */

const view = { yaw: 0.35, pitch: 0, dist: 4.9, lookY: 0.93 }; // where we are now
const goal = { ...view }; // where we're easing towards
const HOME = { ...view };
let spinning = !reduceMotion;
let lastTouch = 0;
let selectedId = null;

function select(id) {
  selectedId = id;
  document.querySelectorAll(".bm-row").forEach((r) => r.setAttribute("aria-pressed", String(r.dataset.id === id)));
  markers.forEach((m) => m.el.classList.toggle("selected", m.area.id === id));
  hideHelp();
  pinned = null;
  if (!id) {
    renderOverview();
    Object.assign(goal, { dist: HOME.dist, lookY: HOME.lookY, pitch: 0 });
    return;
  }
  const m = markers.find((x) => x.area.id === id);
  renderDetail(m.area);
  // Turn the body so the chosen spot faces the camera (taking the shortest way round)
  const target = -Math.atan2(m.facing.x, m.facing.z);
  goal.yaw = view.yaw + Math.atan2(Math.sin(target - view.yaw), Math.cos(target - view.yaw));
  goal.pitch = 0;
  goal.dist = 3.4;
  goal.lookY = THREE.MathUtils.clamp(m.local.y, 0.75, 1.5);
  lastTouch = performance.now();
}

let drag = null;
stage.tabIndex = 0;
stage.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, yaw: goal.yaw, pitch: goal.pitch };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  goal.yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
  goal.pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * 0.004, -0.35, 0.35);
  lastTouch = performance.now();
});
stage.addEventListener("pointerup", () => (drag = null));
stage.addEventListener("pointercancel", () => (drag = null));
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  goal.dist = THREE.MathUtils.clamp(goal.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.4, 7.5);
  lastTouch = performance.now();
}, { passive: false });
stage.addEventListener("keydown", (e) => {
  const step = { ArrowLeft: -0.3, ArrowRight: 0.3 }[e.key];
  if (step) { goal.yaw += step; lastTouch = performance.now(); e.preventDefault(); }
  if (e.key === "+" || e.key === "=") goal.dist = Math.max(2.4, goal.dist * 0.9);
  if (e.key === "-") goal.dist = Math.min(7.5, goal.dist * 1.1);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { pinned = null; hideHelp(); select(null); } });
$("bm-reset").addEventListener("click", () => { select(null); Object.assign(goal, HOME, { yaw: view.yaw + Math.atan2(Math.sin(HOME.yaw - view.yaw), Math.cos(HOME.yaw - view.yaw)) }); });
const spinBtn = $("bm-spin");
spinBtn.setAttribute("aria-pressed", String(spinning));
spinBtn.addEventListener("click", () => { spinning = !spinning; spinBtn.setAttribute("aria-pressed", String(spinning)); lastTouch = 0; });

/* ---------- 6. Drawing every frame ---------- */

let width = 0, height = 0;
function resize() {
  width = stage.clientWidth;
  height = stage.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const tmp = new THREE.Vector3(), toCam = new THREE.Vector3(), normal = new THREE.Vector3();
let prev = performance.now();
function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;

  // Slowly turn by itself when nobody has touched it for a few seconds
  if (spinning && !selectedId && !drag && now - lastTouch > 3500) goal.yaw += dt * 0.25;

  // Ease the view towards the goal (smooth motion instead of jumps)
  const ease = 1 - Math.pow(0.002, dt);
  for (const k of ["yaw", "pitch", "dist", "lookY"]) view[k] += (goal[k] - view[k]) * ease;

  body.rotation.y = view.yaw;
  camera.position.set(0, view.lookY + Math.sin(view.pitch) * view.dist, Math.cos(view.pitch) * view.dist);
  camera.lookAt(0, view.lookY, 0);
  dashes.rotation.y = now * 0.00015;
  stars.rotation.y = now * 0.00002;
  skinMaterial.uniforms.uScan.value = reduceMotion ? -1 : ((now * 0.00035) % 2.4) - 0.2;

  // Pulse the organs of areas that need attention; brighten the selected one
  for (const m of markers) {
    const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now * (m.area.status === "act" ? 0.006 : 0.003));
    const strength = m.area.id === selectedId ? 1 : m.area.status === "good" ? 0.35 : 0.45 + pulse * 0.4;
    (organs[m.area.id] || []).forEach((mat) => (mat.opacity = mat.wireframe ? strength * 0.7 : strength * 0.75));
  }

  renderer.render(scene, camera);
  body.updateMatrixWorld();

  // Move each glowing point to where its spot on the body is on screen,
  // and dim it when that spot is on the far side of the body
  for (const m of markers) {
    tmp.copy(m.local);
    body.localToWorld(tmp);
    normal.copy(m.facing).applyQuaternion(body.quaternion);
    toCam.copy(camera.position).sub(tmp).normalize();
    const behind = normal.dot(toCam) < -0.1;
    tmp.project(camera);
    const x = (tmp.x * 0.5 + 0.5) * width;
    const y = (-tmp.y * 0.5 + 0.5) * height;
    m.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    m.el.classList.toggle("behind", behind && m.area.id !== selectedId);
  }
  requestAnimationFrame(frame);
}

renderOverview();
if (renderer) {
  stage.prepend(renderer.domElement);
  resize();
  new ResizeObserver(resize).observe(stage);
  requestAnimationFrame(frame);
}

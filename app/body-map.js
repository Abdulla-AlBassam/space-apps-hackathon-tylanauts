/*
 * BODY MAP: a 3D figure with glowing points where a health area needs attention.
 * SIMULATED DATA. Nothing here is a real astronaut's reading.
 *
 * What this file does, in plain English:
 * 1. Builds a list of body areas (heart, mind & sleep, eyes, radiation, bones, muscles).
 *    Numbers that the dashboard already simulates (heart rate, sleep, radiation, exercise)
 *    are read from window.HEALTH_DATA (data.js) so both pages tell the same story.
 *    The rest (mood score, eye exam, exercise plan) are made-up "hand-entered" results.
 * 2. Draws an X-ray style anatomy model with three.js: skeleton, heart, brain, eyes, thigh
 *    muscles and a faint skin outline. The model (models/body.glb) is made from BodyParts3D,
 *    © The Database Center for Life Science, licensed under CC BY 4.0 (see models/README.md).
 *    three.js itself is MIT-licensed and loaded from a CDN.
 * 3. Puts a clickable glowing point on the body for each area. Its colour is the status
 *    (blue = Normal, yellow = Watch, red = Act now). Clicking it turns the body to face
 *    you and opens the details panel on the right.
 *
 * To move this into the main dashboard later: copy the three parts of body-map.html
 * (#bm-list, #bm-stage, #bm-detail) into index.html and load this file the same way.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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
    point: [0.025, 1.29, 0.128],
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
    point: [0, 1.735, -0.01],
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
    point: [0.032, 1.596, 0.09],
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
    point: [0.105, 1.355, 0.108],
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
    point: [0, 1.0, -0.108],
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
    point: [-0.09, 0.68, 0.082],
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
const loadingEl = $("bm-loading");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (err) {
  $("bm-fallback").hidden = false;
  loadingEl.hidden = true;
  markerLayer.hidden = true;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const body = new THREE.Group(); // everything that turns with the figure
scene.add(body);

/*
 * The "X-ray" look. Each surface glows most at its edges (where it turns away from you)
 * and is almost clear where it faces you, so you can see through skin to bone and
 * through bone to the organs. A bright band sweeps up and down the body like a scanner.
 * Everything adds light on top of what's behind it, so draw order doesn't matter.
 */
function xray(colour, core, edge, { onTop = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColour: { value: new THREE.Color(colour) },
      uCore: { value: core },
      uEdge: { value: edge },
      uStrength: { value: 1 },
      uScan: { value: -1 },
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
      uniform vec3 uColour; uniform float uCore; uniform float uEdge; uniform float uStrength; uniform float uScan;
      varying vec3 vNormal; varying vec3 vView; varying float vY;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
        float scan = smoothstep(0.03, 0.0, abs(vY - uScan));
        float a = (uCore + rim * uEdge) * uStrength + scan * 0.12;
        gl_FragColor = vec4(uColour * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: !onTop,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// Materials for each part of the model. Bones are pale X-ray white, skin is a faint
// blue outline, and the parts linked to a body area take that area's status colour.
const statusOf = (id) => AREAS.find((a) => a.id === id).status;
const MATERIALS = {
  skin: xray(0x2e96f5, 0.0, 0.22),
  skeleton: xray(0xdce8ff, 0.035, 0.5),
  spine: xray(STATUS_COLOUR[statusOf("bone")], 0.05, 0.6),
  heart: xray(STATUS_COLOUR[statusOf("heart")], 0.12, 0.9, { onTop: true }),
  brain: xray(STATUS_COLOUR[statusOf("mind")], 0.05, 0.6, { onTop: true }),
  eyes: xray(STATUS_COLOUR[statusOf("eyes")], 0.15, 0.9, { onTop: true }),
  muscle: xray(STATUS_COLOUR[statusOf("muscle")], 0.02, 0.35),
};
// Which body area lights up which part of the model (used for pulsing and selecting)
const organs = {
  heart: [MATERIALS.heart],
  mind: [MATERIALS.brain],
  eyes: [MATERIALS.eyes],
  bone: [MATERIALS.spine],
  muscle: [MATERIALS.muscle],
};

// Radiation badge: a small card clipped on the chest (not part of the anatomy model)
const badgeMat = xray(STATUS_COLOUR[statusOf("radiation")], 0.5, 0.6, { onTop: true });
const badge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.006), badgeMat);
badge.position.set(0.105, 1.355, 0.1);
body.add(badge);
organs.radiation = [badgeMat];

/*
 * The anatomy model (models/body.glb). It comes from BodyParts3D, a free 3D atlas of an
 * adult male body: © The Database Center for Life Science, licensed under CC BY 4.0.
 * tools/build_body_model.py picks the bones, heart, brain, eyes, thigh muscles and skin
 * out of it, makes them lighter for the web, and saves them as named parts.
 */
const loader = new GLTFLoader();
loader.load(
  new URL("models/body.glb", import.meta.url).href,
  (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mat = MATERIALS[o.name];
      if (!mat) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.material = mat;
      o.renderOrder = mat.depthTest ? 1 : 2;
    });
    body.add(gltf.scene);
    loadingEl.hidden = true;
    markerLayer.hidden = false;
  },
  undefined,
  () => {
    loadingEl.textContent = "The 3D body model couldn't load. The list on the left still works.";
  }
);
markerLayer.hidden = true;

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
  return { area: a, el, local: new THREE.Vector3(...a.point), facing: new THREE.Vector3(...a.facing).normalize() };
});

/* ---------- 5. Turning, zooming and selecting ---------- */

const view = { yaw: 0.35, pitch: 0, dist: 4.7, lookY: 0.88 }; // where we are now
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
  const scanY = reduceMotion ? -1 : ((now * 0.00035) % 2.3) - 0.2;
  for (const mat of Object.values(MATERIALS)) mat.uniforms.uScan.value = scanY;

  // Pulse the organs of areas that need attention; brighten the selected one
  for (const m of markers) {
    const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now * (m.area.status === "act" ? 0.006 : 0.003));
    const strength = m.area.id === selectedId ? 1 : m.area.status === "good" ? 0.35 : 0.45 + pulse * 0.4;
    (organs[m.area.id] || []).forEach((mat) => (mat.uniforms.uStrength.value = 0.5 + strength));
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

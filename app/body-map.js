/*
 * BODY MAP: a 3D figure with glowing points where a health area needs attention.
 * SIMULATED DATA. Nothing here is a real astronaut's reading.
 *
 * What this file does, in plain English:
 * 1. Builds a list of body areas (heart, mind & sleep, eyes, radiation, body mass).
 *    Numbers that the dashboard already simulates (heart rate, sleep, radiation, exercise)
 *    are read from window.HEALTH_DATA (data.js) so both pages tell the same story.
 *    The rest (mood score, eye exam, exercise plan) are made-up "hand-entered" results.
 * 2. Draws an X-ray style anatomy model with three.js: skeleton, heart, brain, eyes
 *    and a faint skin outline. The model (models/body.glb) is made from BodyParts3D,
 *    © The Database Center for Life Science, licensed under CC BY 4.0 (see models/README.md).
 *    three.js itself is MIT-licensed and loaded from a CDN.
 * 3. Puts a clickable glowing point on the body for each area. Its colour is the status
 *    (bone = Steady, ember = Watch or Alert). Clicking it turns the body to face
 *    you and opens the details panel on the right.
 *
 * To move this into the main dashboard later: copy the three parts of body-map.html
 * (#bm-list, #bm-stage, #bm-detail) into index.html and load this file the same way.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const H = await window.HEALTH_READY; // data.js fetches live readings first
const today = H.days[H.days.length - 1];
const base = H.baseline;
const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const deviceLabel = (id) => (H.devices.find((d) => d.id === id) || {}).label || id;
const round = (n, d = 0) => Number(n.toFixed(d));

/* ---------- 1. The body areas and their (simulated) status ---------- */

// Sirius identity colours. Ember is the only colour that asks for attention, so an area
// that is fine stays a quiet bone-grey and only Watch and Alert areas light up in ember.
const BONE = 0xf2eee6, EMBER = 0xff5a36, SLATE = 0x5b6472, MUTED = 0xa9a59c;
const STATUS_COLOUR = { good: MUTED, watch: EMBER, act: EMBER };
const STATUS_WORD = { good: "Steady", watch: "Watch", act: "Alert" };
const ic = (name, cls) => (window.icon ? window.icon(name, cls) : "");
const ICONS = { good: ic("circle-check"), watch: ic("triangle-alert"), act: ic("octagon-alert") };

// Is a reading outside the astronaut's own normal range?
const outside = (metric) => today[metric] < base[metric].low || today[metric] > base[metric].high;
const range = (metric, d = 0) => `${round(base[metric].low, d)}–${round(base[metric].high, d)}`;

// The heart's status comes from the dashboard's own alert, so both pages agree.
const recoveryAlert = H.alerts.find((a) => a.signals.includes("resting_hr"));
const heartStatus = recoveryAlert ? recoveryAlert.level : outside("hrv_rmssd") ? "watch" : "good";
const doseSpike = H.days.find((d) => d.radiation_dose > 1);
const CAREER_LIMIT_MSV = 600; // NASA's career radiation limit (NASA-STD-3001)

// Body mass: weighed once a week on the station's mass-measuring device (docs/MONITORING_SCHEDULE.md).
// Made-up weekly weigh-ins for the demo; scales don't work in weightlessness, so the device
// works out mass from how fast a known spring force moves the astronaut.
const MASS = { preflight: 76.0, last: 74.9, previous: 75.1, daysSince: 3 };
const massChangePct = ((MASS.last - MASS.preflight) / MASS.preflight) * 100;
const massDevice = H.devices.find((d) => d.type === "scale");

/*
 * Each area: where its glowing point sits on the body (x = sideways, y = height in metres,
 * z = front/back; the figure faces +z), which way that spot faces (used to dim points on
 * the far side), the readings, and what to do. "Hand-entered" = typed in by the astronaut.
 */
const AREAS = [
  {
    id: "heart",
    side: "left",
    icon: "heart-pulse",
    name: "Heart",
    category: "Heart",
    status: heartStatus,
    point: [0.025, 1.29, 0.128],
    facing: [0, 0, 1],
    summary: "Resting heart rate is up and heart rate variability is down. Recovery has fallen 3 days in a row.",
    readings: [
      { name: "Resting heart rate", value: round(today.resting_hr), unit: "bpm", normal: range("resting_hr"), out: outside("resting_hr"), source: deviceLabel(today.sources.resting_hr), metric: "resting_hr" },
      { name: "Heart rate variability", value: today.hrv_rmssd, unit: "ms", normal: range("hrv_rmssd"), out: outside("hrv_rmssd"), source: deviceLabel(today.sources.hrv_rmssd), metric: "hrv_rmssd" },
      { name: "Blood pressure", value: "118/76", unit: "mmHg", normal: "below 130/80", out: false, source: "Hand-entered" },
    ],
    actions: recoveryAlert ? recoveryAlert.actions : ["No action needed."],
    link: ["index.html#trends", "See the 30-day heart trend"],
    help: "Without gravity, body fluids move toward the head and the heart does less work, so over a long mission it can lose some fitness. A resting heart rate above your normal, together with a low HRV, often means fatigue, stress or the start of an illness.",
  },
  {
    id: "mind",
    side: "left",
    icon: "brain",
    name: "Mind, mood & sleep",
    category: "Mind & mood, Sleep",
    status: outside("sleep_hours") ? "watch" : "good",
    point: [0, 1.735, -0.01],
    facing: [0, 0.7, 0.7],
    summary: "Short sleep for several nights and a lower mood score today. Worth keeping an eye on.",
    readings: [
      { name: "Sleep last night", value: today.sleep_hours, unit: "h", normal: range("sleep_hours", 1), out: outside("sleep_hours"), source: deviceLabel(today.sources.sleep_hours), metric: "sleep_hours" },
      { name: "Mood check", value: today.mood, unit: "/ 5", normal: "4–5", out: today.mood < 4, source: "Hand-entered, today", metric: "mood" },
      { name: "Cognitive test", value: "Normal", unit: "", normal: "monthly", out: false, source: "Hand-entered, 12 days ago" },
    ],
    actions: ["Aim for 8 hours in your sleep station tonight", "Log how you feel in today's check-in", "Raise it at your next private talk with the flight surgeon"],
    link: ["index.html#checkin", "Go to the daily check-in"],
    help: "Isolation, confinement, a packed schedule and disrupted sleep can wear down mood, focus and teamwork. NASA counts behavioural health among the main risks of long missions. Astronauts often sleep less in space than on Earth, so sleep and mood are tracked together here.",
  },
  {
    id: "eyes",
    side: "right",
    icon: "eye",
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
    side: "right",
    icon: "radiation",
    name: "Radiation dose",
    category: "Radiation",
    status: "good",
    point: [0.105, 1.355, 0.108],
    facing: [0, 0, 1],
    summary: `Mission total is ${today.doseTotal} mSv, ${Math.round((today.doseTotal / CAREER_LIMIT_MSV) * 100)}% of the career limit.${doseSpike ? " One spike was recorded earlier." : ""}`,
    readings: [
      { name: "Today", value: today.radiation_dose, unit: "mSv", normal: "below 1", out: today.radiation_dose > 1, source: deviceLabel(today.sources.radiation_dose), metric: "radiation_dose" },
      { name: "Mission total", value: today.doseTotal, unit: "mSv", normal: `career limit ${CAREER_LIMIT_MSV}`, out: false, source: deviceLabel(today.sources.radiation_dose), metric: "radiation_dose" },
      ...(doseSpike ? [{ name: "Spike", value: doseSpike.radiation_dose, unit: "mSv", normal: "below 1", out: true, source: `Radiation badge, ${doseSpike.date}`, metric: "radiation_dose" }] : []),
    ],
    actions: ["No action needed now. Your flight surgeon can see these numbers."],
    link: null,
    help: "Outside Earth's protective magnetic field, astronauts get much more radiation than on the ground, which raises long-term health risks such as cancer. The badge on your chest measures the dose. NASA limits an astronaut's career total to 600 mSv.",
  },
  {
    id: "mass",
    side: "right",
    icon: "scale",
    name: "Body mass",
    category: "Bone & muscle",
    status: Math.abs(massChangePct) > 3 ? "watch" : "good",
    point: [0, 1.08, 0.115],
    facing: [0, 0, 1],
    summary: `${MASS.last} kg at this week's weigh-in, ${massChangePct.toFixed(1)}% since launch. Next weigh-in in ${7 - MASS.daysSince} days.`,
    readings: [
      { name: "This week", value: MASS.last, unit: "kg", normal: `within 3% of pre-flight (${MASS.preflight} kg)`, out: Math.abs(massChangePct) > 3, source: `Hand-entered, ${MASS.daysSince} days ago` },
      { name: "Change since last week", value: (MASS.last - MASS.previous).toFixed(1), unit: "kg", normal: "small week to week", out: false, source: "Hand-entered" },
      { name: "Next weigh-in", value: `In ${7 - MASS.daysSince} days`, unit: "", normal: "weekly", out: false, source: massDevice ? `Reminder · ${massDevice.label}` : "Reminder" },
    ],
    actions: Math.abs(massChangePct) > 3
      ? ["Log everything you eat and drink this week", "Talk to your flight surgeon about your meal plan"]
      : ["No action needed. Keep logging meals and weigh in once a week."],
    link: null,
    help: "In space, losing weight can mean not eating enough, or losing muscle and bone. NASA sets each astronaut's food needs from their body mass (NASA-STD-3001, V1 4020), so a weekly weigh-in keeps the meal plan right. Bathroom scales don't work without gravity, so the station has a device that measures mass from movement instead.",
  },
];

/* ---------- 2. Side panels (list + details) ---------- */

const astroEl = $("bm-astro");
if (astroEl) astroEl.textContent = `${H.astronaut.name}   •   Day ${H.astronaut.missionDay} of ${H.astronaut.missionLength}`;

/*
 * Labels around the body (like an anatomy chart): one label per area (icon, name, status)
 * in a column on the left or right, joined to its glowing point by a thin line that follows
 * the body as it turns. Clicking a label (or the point) opens its details underneath it.
 */
const stageEl = $("bm-stage");
const cols = { left: document.createElement("div"), right: document.createElement("div") };
cols.left.className = "bm-col bm-col-left";
cols.right.className = "bm-col bm-col-right";
const leaderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
leaderSvg.setAttribute("class", "bm-leaders");
leaderSvg.setAttribute("aria-hidden", "true");
stageEl.append(leaderSvg, cols.left, cols.right);

// A reading is sample data if it has no live metric behind it (typed-in results and
// reminders aren't stored by the backend yet) or its metric has no live data today.
const isSample = (r) => !r.metric || H.isSample(r.metric);

function tagSummary(a) {
  const out = a.readings.filter((r) => r.out).length;
  return out ? `${out} of ${a.readings.length} readings outside normal` : `${a.readings.length} readings, all normal`;
}

function tagHtml(a, open) {
  const readings = a.readings
    .map(
      (r) => `<div class="bm-reading${r.out ? " out" + (a.status === "act" ? " act" : "") : ""}">
        <span class="name">${r.name}</span>
        <span class="val">${r.value}${r.unit ? `<small>${r.unit}</small>` : ""}</span>
        <span class="meta">Normal: ${r.normal}  •  ${r.source}${isSample(r) ? ` <span class="sample-tag">Sample data</span>` : ""}</span>
      </div>`
    )
    .join("");
  return `
    <button type="button" class="bm-tag-head" aria-expanded="${open}" title="${tagSummary(a)}">
      <span class="bm-tag-icon is-${a.status}">${ic(a.icon)}</span>
      <span class="bm-tag-text">
        <span class="bm-tag-name">${a.name}</span>
        <span class="bm-pill is-${a.status}">${ICONS[a.status]}${STATUS_WORD[a.status]}</span>
      </span>
    </button>
    ${open ? `<div class="bm-tag-body">
      <p class="bm-summary">${a.summary} <button type="button" class="help" data-help="${a.id}" aria-label="Why this matters">?</button></p>
      <div class="bm-readings">${readings}</div>
      <h3>${ic("clipboard-list")}What to do</h3>
      <ul class="bm-actions">${a.actions.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>` : ""}`;
}

// Labels go top to bottom in the same order as their points on the body (head first),
// so the lines to the body don't cross each other.
const tags = {};
[...AREAS].sort((a, b) => b.point[1] - a.point[1]).forEach((a) => {
  const el = document.createElement("div");
  el.className = `bm-tag is-${a.status}`;
  el.dataset.id = a.id;
  el.innerHTML = tagHtml(a, false);
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  el.addEventListener("wheel", (e) => e.stopPropagation());
  el.addEventListener("click", (e) => {
    if (e.target.closest(".bm-tag-head")) select(a.id === selectedId ? null : a.id);
  });
  cols[a.side].appendChild(el);
  tags[a.id] = el;
});

function renderTags() {
  AREAS.forEach((a) => {
    const open = a.id === selectedId;
    tags[a.id].classList.toggle("open", open);
    tags[a.id].innerHTML = tagHtml(a, open);
  });
}

/* "?" help texts. On the main dashboard, app.js shows them; on the standalone page, we do. */
const HELP = {};
AREAS.forEach((a) => (HELP[a.id] = [`Why ${a.name.toLowerCase()} matters in space`, a.help]));
window.BM_HELP = HELP;
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
const hideHelp = () => { if (!window.APP_HANDLES_HELP) pop.classList.remove("show"); };
if (!window.APP_HANDLES_HELP) {
  document.addEventListener("mouseover", (e) => { const b = e.target.closest(".help"); if (b && !pinned) showHelp(b); });
  document.addEventListener("mouseout", (e) => { if (e.target.closest(".help") && !pinned) hideHelp(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".help");
    if (b) { e.stopPropagation(); pinned = pinned === b ? null : b; pinned ? showHelp(b) : hideHelp(); }
    else if (pinned) { pinned = null; hideHelp(); }
  });
}

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

// Materials for each part of the model. Bones are bone-white, skin is a faint slate
// outline, and the parts linked to a body area take that area's status colour.
const statusOf = (id) => AREAS.find((a) => a.id === id).status;
const MATERIALS = {
  skin: xray(SLATE, 0.0, 0.5),
  skeleton: xray(BONE, 0.03, 0.42),
  heart: xray(STATUS_COLOUR[statusOf("heart")], 0.12, 0.9, { onTop: true }),
  brain: xray(STATUS_COLOUR[statusOf("mind")], 0.05, 0.6, { onTop: true }),
  eyes: xray(STATUS_COLOUR[statusOf("eyes")], 0.15, 0.9, { onTop: true }),
};
// The spine and hips are drawn like the rest of the skeleton.
MATERIALS.spine = MATERIALS.skeleton;
// Which body area lights up which part of the model (used for pulsing and selecting)
const organs = {
  heart: [MATERIALS.heart],
  mind: [MATERIALS.brain],
  eyes: [MATERIALS.eyes],
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
 * tools/build_body_model.py picks the bones, heart, brain, eyes and skin
 * out of it, makes them lighter for the web, and saves them as named parts.
 */
const loader = new GLTFLoader();
loader.load(
  new URL("models/body.glb", import.meta.url).href,
  (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === "muscle") { o.visible = false; return; } // muscles are not tracked, so they are not drawn
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

/* ---------- 4. Glowing points (HTML buttons that follow the 3D body) ---------- */

const markers = AREAS.map((a) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `bm-marker is-${a.status}`;
  el.setAttribute("aria-label", `${a.name}: ${STATUS_WORD[a.status]}`);
  el.innerHTML = `<span class="bm-ring"></span><span class="bm-core"></span>`;
  el.addEventListener("click", (e) => { e.stopPropagation(); select(a.id === selectedId ? null : a.id); });
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  markerLayer.appendChild(el);
  return { area: a, el, local: new THREE.Vector3(...a.point), facing: new THREE.Vector3(...a.facing).normalize() };
});

/* ---------- 5. Turning, zooming and selecting ---------- */

const view = { yaw: 0.35, pitch: 0, dist: 4.0, lookY: 0.9 }; // where we are now
const goal = { ...view }; // where we're easing towards
const HOME = { ...view };
const spinning = !reduceMotion;
let lastTouch = 0;
let selectedId = null;

function select(id) {
  selectedId = id;
  markers.forEach((m) => m.el.classList.toggle("selected", m.area.id === id));
  hideHelp();
  pinned = null;
  renderTags();
  if (!id) {
    Object.assign(goal, { dist: HOME.dist, lookY: HOME.lookY, pitch: 0 });
    return;
  }
  const m = markers.find((x) => x.area.id === id);
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
// Scrolling zooms on the full-screen page only. On the main dashboard the body sits in
// the middle of a long page, so scrolling there must keep scrolling the page.
const embedded = Boolean(window.APP_HANDLES_HELP);
stage.addEventListener("wheel", (e) => {
  if (embedded) return;
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
// There are no view buttons: the body turns slowly by itself, pauses while you drag it or
// have a label open, and Escape closes the open label and zooms back out.


// Thin lines from each label to its glowing point: out from the label, then an angled
// run to the point. Lines to points on the far side of the body are dashed and faint.
function drawLeaders() {
  if (!leaderSvg.isConnected || getComputedStyle(cols.left).position !== "absolute") { leaderSvg.innerHTML = ""; return; }
  const sr = stageEl.getBoundingClientRect();
  if (!sr.width || !sr.height) return; // the page with the body on it is hidden
  leaderSvg.setAttribute("viewBox", `0 0 ${sr.width} ${sr.height}`);
  let html = "";
  for (const m of markers) {
    if (!Number.isFinite(m.sx) || !Number.isFinite(m.sy)) continue;
    const tag = tags[m.area.id];
    const head = tag.querySelector(".bm-tag-head") || tag;
    const r = head.getBoundingClientRect();
    const left = m.area.side === "left";
    const ax = (left ? r.right + 10 : r.left - 10) - sr.left;
    const ay = r.top + r.height / 2 - sr.top;
    const elbow = ax + (left ? 28 : -28);
    const cls = `bm-leader is-${m.area.status}${m.behind && m.area.id !== selectedId ? " behind" : ""}${m.area.id === selectedId ? " selected" : ""}`;
    html += `<polyline class="${cls}" points="${ax.toFixed(1)},${ay.toFixed(1)} ${elbow.toFixed(1)},${ay.toFixed(1)} ${m.sx.toFixed(1)},${m.sy.toFixed(1)}"/>`;
  }
  leaderSvg.innerHTML = html;
}

/* ---------- 6. Drawing every frame ---------- */

let width = 0, height = 0;
function resize() {
  if (!stage.clientWidth || !stage.clientHeight) return; // hidden: keep the last good size
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
    m.sx = x; m.sy = y; m.behind = behind;
  }
  drawLeaders();
  requestAnimationFrame(frame);
}

if (renderer) {
  stage.prepend(renderer.domElement);
  resize();
  new ResizeObserver(resize).observe(stage);
  requestAnimationFrame(frame);
}

/*
 * Sirius brand pieces, shared by every page. Everything here follows the designer's
 * "Sirius visual identity" guide; the shapes and timings are copied from it exactly.
 *
 *   SIRIUS.mark(size)              the logo: a four-point star inside a dial of ticks,
 *                                  with one ember tick
 *   SIRIUS.mark(size, {motion})    the motion logo: the dial fills with ember, holds,
 *                                  then drains back (used for loading and "done" moments)
 *   SIRIUS.dial(percent, level, n) the health dial: a 0 to 100 speedometer of ticks
 *   SIRIUS.loading(text)           the motion logo with a line of text under it
 *
 * It also plays the motion logo video once per visit as an intro, on pages whose
 * <body> has data-intro.
 */
(function () {
  const STAR = "M50 4 C51.5 38 62 48.5 96 50 C62 51.5 51.5 62 50 96 C48.5 62 38 51.5 4 50 C38 48.5 48.5 38 50 4Z";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- The logo ---------- */
  // The guide: 24 tick dial at 32 px and above, 12 tick dial below that so the star stays clear.
  // The star's own points take the 12, 3, 6 and 9 o'clock places, so those get no tick.
  function mark(size, opts) {
    opts = opts || {};
    const small = size < 32 && !opts.motion;
    const step = small ? 30 : 15;
    const emberAt = small ? 30 : 45;
    const angles = [];
    for (let a = step; a < 360; a += step) if (a % 90) angles.push(a);
    // For the motion logo the ticks light up clockwise, starting just after the ember tick
    const fromEmber = angles.filter((a) => a > emberAt).concat(angles.filter((a) => a < emberAt));
    const ticks = angles.map((a) => {
      if (a === emberAt) {
        return small
          ? `<line x1="50" y1="3" x2="50" y2="19" stroke="#FF5A36" stroke-width="6" stroke-linecap="round" transform="rotate(30 50 50)"/>`
          : `<line x1="50" y1="3" x2="50" y2="18" stroke="#FF5A36" stroke-width="5" stroke-linecap="round" transform="rotate(45 50 50)"/>`;
      }
      const cls = opts.motion ? ` class="mt${fromEmber.indexOf(a)}"` : "";
      return small
        ? `<line x1="50" y1="5" x2="50" y2="14" stroke="currentColor" stroke-width="5" stroke-linecap="round" transform="rotate(${a} 50 50)"/>`
        : `<line${cls} x1="50" y1="5" x2="50" y2="12" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" transform="rotate(${a} 50 50)"/>`;
    }).join("");
    if (opts.motion) addMotionStyles();
    const label = opts.label === "" ? `aria-hidden="true"` : `role="img" aria-label="${opts.label || "Sirius"}"`;
    return `<svg class="sirius-mark${opts.motion ? " is-motion" : ""}" width="${size}" height="${size}" viewBox="0 0 100 100" ${label}>${ticks}<path d="${STAR}" fill="currentColor"/></svg>`;
  }

  /* ---------- The motion logo ----------
   * 5.4 seconds, looping: rest 0.7 s, fill 2.0 s (ticks turn ember one after another),
   * hold 0.5 s, drain 1.2 s, rest. Each tick fades colour over 0.12 s. Nothing pops,
   * scales, spins or glows.
   */
  let motionAdded = false;
  function addMotionStyles() {
    if (motionAdded) return;
    motionAdded = true;
    const total = 5.4, fade = 0.12, n = 19;
    const pct = (s) => ((s / total) * 100).toFixed(3) + "%";
    let css = "";
    for (let k = 0; k < n; k++) {
      const on = 0.7 + k * ((2.0 - fade) / (n - 1));   // when this tick starts turning ember
      const off = 3.2 + k * 0.06;                      // when it starts turning back
      css += `@keyframes mk${k}{0%,${pct(on)}{stroke:#F2EEE6}${pct(on + fade)},${pct(off)}{stroke:#FF5A36}${pct(off + fade)},100%{stroke:#F2EEE6}}` +
             `.sirius-mark .mt${k}{animation:mk${k} ${total}s infinite ease-in-out}`;
    }
    css += "@media (prefers-reduced-motion: reduce){.sirius-mark [class^=mt]{animation:none}}";
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  const loading = (text) =>
    `<div class="sirius-loading">${mark(64, { motion: true, label: "" })}${text ? `<span class="label">${text}</span>` : ""}</div>`;

  /* ---------- The health dial (speedometer) ----------
   * A speedometer: 25 ticks in an arc that reads left to right from 0 to 100, the
   * number in the middle and the score's icon under the number.
   * percent: how far along the arc is filled (0 to 100).
   * level:   "good" = filled ticks are bone
   *          "watch" = the last filled tick is ember ("where you are now")
   *          "act"  = every filled tick is ember
   * text:    what to write in the middle (normally the score).
   * size:    width and height in pixels.
   * unit:    optional small unit after the number, for a dial that is not a 0 to 100 score.
   * iconName: optional icon (from icons.js) drawn under the number.
   * maxLabel: what the right-hand end of the arc says (100 unless the dial measures something else).
   * The 0, 25, 50, 75 and 100 ticks are long, like the logo's star points.
   */
  function dial(percent, level, text, size, unit, iconName, maxLabel) {
    const N = 25, SWEEP = 240, CY = 56; // ticks, degrees of arc, centre of the arc
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    const filled = pct <= 0 ? 0 : Math.min(N, Math.floor((pct * (N - 1)) / 100) + 1);
    let lines = "";
    for (let i = 0; i < N; i++) {
      const long = i % 6 === 0;
      let colour = "var(--slate)";
      if (i < filled) colour = level === "act" || (level === "watch" && i === filled - 1) ? "var(--ember)" : "var(--bone)";
      const angle = -SWEEP / 2 + (i * SWEEP) / (N - 1);
      lines += `<line x1="50" y1="${CY - 47}" x2="50" y2="${CY - (long ? 33 : 38)}" stroke-width="${long ? 4.5 : 3.5}" style="--c:${colour};--i:${i}" transform="rotate(${angle} 50 ${CY})"/>`;
    }
    // 0 and the top of the scale under the two ends of the arc
    const ends = `<text class="dial-unit" x="13" y="91" font-size="7.5">0</text><text class="dial-unit" x="87" y="91" font-size="7.5">${maxLabel == null ? 100 : maxLabel}</text>`;
    const str = String(text == null ? "" : text);
    const fs = str.length > 3 ? 18 : str.length > 2 ? 22 : 26;
    const unitPart = unit ? `<tspan class="dial-unit" font-size="7.5" dx="1.5">${unit}</tspan>` : "";
    const num = `<text x="50" y="${CY + fs * 0.33 - 4}" font-size="${fs}">${str}${unitPart}</text>`;
    // The icon sits under the number, in the gap between the two ends of the arc
    let ico = "";
    if (iconName && window.icon) {
      ico = window.icon(iconName).replace('<svg class="ico ', '<svg x="42" y="66" width="16" height="16" class="dial-ico ');
    }
    return `<svg class="dial" width="${size || 112}" height="${size || 112}" viewBox="0 0 100 100" aria-hidden="true">${lines}${ends}${num}${ico}</svg>`;
  }

  /* ---------- Intro video ----------
   * Plays the designer's motion logo video once per browser tab, then fades into the page.
   * Click, tap or press any key to skip. Skipped entirely if the person asked their
   * device for less motion, or if the video can't play.
   */
  function intro() {
    let seen = false;
    try { seen = sessionStorage.getItem("sirius-intro") === "1"; sessionStorage.setItem("sirius-intro", "1"); } catch (e) { /* private mode: just play it */ }
    if (seen || reduceMotion || /[?&]intro=0\b/.test(location.search)) return;
    const el = document.createElement("div");
    el.className = "intro";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Sirius, health on board");
    el.innerHTML = `<video src="brand/sirius-motion.mp4" muted playsinline autoplay preload="auto"></video><p class="label">Click to skip</p>`;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      el.classList.add("out");
      document.removeEventListener("keydown", close);
      setTimeout(() => el.remove(), 500);
    };
    const video = el.querySelector("video");
    video.addEventListener("ended", close);
    video.addEventListener("error", close);
    el.addEventListener("click", close);
    document.addEventListener("keydown", close);
    setTimeout(close, 7000); // safety net if the video never starts
    document.body.appendChild(el);
    const p = video.play();
    if (p && p.catch) p.catch(close);
  }

  window.SIRIUS = { mark, dial, loading, intro };
  if (document.body && document.body.hasAttribute("data-intro")) intro();
})();

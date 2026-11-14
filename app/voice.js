/*
 * Sirius voice: the assistant that talks you through your health.
 * It replaces the old AI doctor chat box.
 *
 * What it does:
 *   - Click the round Sirius logo in the corner and it reads out a short summary of
 *     today. Click it again while it talks to stop it. It never starts by itself.
 *   - The mic button next to it listens to a question, like "what's my sleep?",
 *     and reads that number back.
 *
 * It uses the browser's own free voice tools (the Web Speech API), so there is no
 * AI model, no key and no cost:
 *   - speechSynthesis turns text into speech. It works in Chrome, Edge and Safari.
 *   - SpeechRecognition turns your voice into text. It works in Chrome and Edge.
 *     Chrome sends the audio to Google to do this, so it needs the internet.
 *     Where it isn't available, a small text box appears instead.
 *
 * The answers are scripted: answer() looks for key words in the question and
 * fills in today's numbers from window.HEALTH_DATA.
 */
window.HEALTH_READY.then(function () {
  const H = window.HEALTH_DATA;
  const { astronaut, days, baseline, alerts, tests, doctor, devices } = H;
  const today = days[days.length - 1];
  const $ = (id) => document.getElementById(id);
  const ic = (name) => window.icon(name);
  const synth = window.speechSynthesis;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ---------- The buttons and the caption ---------- */
  const root = $("voice");
  root.innerHTML = `
    <div class="voice-caption" id="voice-caption" aria-live="polite" hidden>
      <button type="button" class="voice-close" id="voice-close" aria-label="Close Sirius">${ic("x")}</button>
      <p class="label" id="voice-state">Sirius</p>
      <p class="voice-text" id="voice-text"></p>
      <form class="voice-type" id="voice-type" hidden>
        <input id="voice-input" autocomplete="off" placeholder="Type a question" aria-label="Ask Sirius">
        <button type="submit" class="voice-small" aria-label="Ask">${ic("send")}</button>
      </form>
    </div>
    <button type="button" class="voice-small voice-mic" id="voice-mic" aria-label="Ask Sirius a question">${ic("mic")}</button>
    <button type="button" class="voice-main" id="voice-main" aria-label="Stop Sirius talking">${window.SIRIUS.mark(38, { label: "" })}</button>`;
  const caption = $("voice-caption"), stateEl = $("voice-state"), textEl = $("voice-text");
  const mainBtn = $("voice-main"), micBtn = $("voice-mic");
  let hideTimer;

  // state is one of: "idle", "waiting" (for the first click), "speaking", "listening"
  let state = "idle";
  function setState(s, label) {
    state = s;
    root.dataset.state = s;
    stateEl.textContent = label || { speaking: "Sirius is speaking", listening: "Listening…", waiting: "Sirius", idle: "Sirius" }[s];
    // While speaking, the logo's dial fills with ember (the Sirius motion logo).
    mainBtn.innerHTML = window.SIRIUS.mark(38, { motion: s === "speaking", label: "" });
    mainBtn.setAttribute("aria-label", s === "speaking" ? "Stop Sirius talking" : "Hear today's summary");
    micBtn.setAttribute("aria-pressed", s === "listening");
    clearTimeout(hideTimer);
    if (s === "idle") hideTimer = setTimeout(() => (caption.hidden = true), 8000);
    else caption.hidden = false;
  }
  function show(text) {
    textEl.textContent = text;
    caption.hidden = false;
  }

  /* ---------- Talking ---------- */
  // Pick an English voice if the browser has one. Voices can load a moment late.
  let voice = null;
  function pickVoice() {
    const all = synth ? synth.getVoices() : [];
    const en = all.filter((v) => /^en/i.test(v.lang));
    voice = en.find((v) => /Google UK English Female|Samantha|Serena|Libby|Sonia/i.test(v.name)) || en.find((v) => v.default) || en[0] || null;
  }
  if (synth) { pickVoice(); synth.addEventListener && synth.addEventListener("voiceschanged", pickVoice); }

  // Long speech is split into sentences and queued one by one: Chrome can go quiet
  // partway through one very long sentence, and this also lets the caption follow along.
  function say(text) {
    stopListening();
    show(text);
    if (!synth) return setState("idle", "Sirius (no voice in this browser)");
    synth.cancel();
    const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/); // "12.5" stays in one piece
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      if (voice) u.voice = voice;
      u.rate = 1;
      u.onstart = () => { setState("speaking"); textEl.textContent = part.trim(); };
      if (i === parts.length - 1) u.onend = () => { if (state === "speaking") { setState("idle"); textEl.textContent = text; } };
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") setState("idle"); };
      synth.speak(u);
    });
  }
  function hush() {
    if (synth) synth.cancel();
    setState("idle", "Sirius (stopped)");
  }

  /* ---------- Listening ---------- */
  let rec = null;
  function listen() {
    if (synth) synth.cancel();
    if (!Recognition) return typeInstead("Voice questions need Chrome or Edge. You can type one here instead.");
    rec = new Recognition();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let heard = "";
    rec.onresult = (e) => {
      heard = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      show(`“${heard}”`);
    };
    rec.onerror = (e) => {
      rec = null;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") typeInstead("The microphone is blocked. Allow it in the address bar, or type your question here.");
      else if (e.error === "no-speech") { setState("idle"); show("I didn't hear anything. Tap the mic and try again."); }
      else typeInstead("I couldn't hear that. You can type your question here.");
    };
    rec.onend = () => {
      if (!rec) return;
      rec = null;
      if (heard) ask(heard);
      else if (state === "listening") { setState("idle"); show("I didn't hear anything. Tap the mic and try again."); }
    };
    setState("listening");
    show("Ask me to read back your recovery, sleep, heart rate, radiation, alerts or what's due.");
    rec.start();
  }
  function stopListening() {
    if (rec) { const r = rec; rec = null; r.onend = null; r.abort(); }
  }
  function typeInstead(message) {
    setState("idle", "Sirius");
    clearTimeout(hideTimer);
    show(message);
    $("voice-type").hidden = false;
    $("voice-input").focus();
  }
  function ask(question) {
    show(`“${question}”`);
    const reply = answer(question);
    if (reply === null) return hush();
    setTimeout(() => say(reply), 400);
  }

  /* ---------- What Sirius says ---------- */
  const usual = (m) => Math.round(baseline[m].mean);
  // "Cmdr. R. Haddad" is said as "Commander Haddad"
  const firstName = () => (/^Cmdr/i.test(astronaut.name) ? "Commander " : "") + astronaut.name.split(" ").pop();
  const WORD = { good: "steady", watch: "one to watch", act: "an alert" };
  const level = (score) => (score >= 67 ? "good" : score >= 34 ? "watch" : "act");
  const openAlerts = () => alerts.filter((a) => !a.done && a.level !== "info");
  const dueChecks = () => tests.filter((t) => t.dueInDays != null && t.dueInDays <= 0);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function summary() {
    const open = openAlerts();
    const due = dueChecks();
    return [
      `Hello ${firstName()}. Here's your health for day ${astronaut.missionDay}.`,
      `Recovery is ${today.recovery} out of 100, which is ${WORD[level(today.recovery)]}.`,
      `Your mind score is ${today.mindScore}, and radiation is at ${today.doseLimitPct} percent of your career limit.`,
      `You're at tier ${doctor.tier.n}, ${doctor.tier.word}.`,
      open.length ? `${plural(open.length, "thing")} need${open.length === 1 ? "s" : ""} your attention. The main one: ${open[0].title}. ${open[0].actions[0]}.` : "Nothing needs your attention today.",
      due.length ? `You also have ${plural(due.length, "health check")} due.` : "",
      "Tap the mic if you want me to read anything back.",
    ].filter(Boolean).join(" ");
  }

  function answer(question) {
    const q = question.toLowerCase();
    const has = (...words) => words.some((w) => q.includes(w));
    const open = openAlerts();

    // Mentioning a symptom changes the tier, using Mariam's escalation rules
    // when they are loaded (escalation.js).
    const symptom = window.ESCALATION && window.ESCALATION.symptomTier ? window.ESCALATION.symptomTier(q) : null;
    if (symptom && symptom.tier === 4)
      return `This sounds like an emergency. You mentioned ${symptom.symptom}. In the real system I would alert your crew, your flight surgeon and mission control now. Open the medical emergency checklist and stay where your crew can reach you.`;
    if (symptom && symptom.tier === 2)
      return `Thanks for telling me about the ${symptom.symptom}. A new symptom puts you at tier 2, caution. I'll ask again in about an hour, and it goes into your flight surgeon's daily summary.`;

    if (has("stop", "quiet", "shut up", "be quiet", "cancel")) return null;
    if (has("tier", "escalat", "serious", "how bad"))
      return `You're at tier ${doctor.tier.n}, ${doctor.tier.word}. Tiers go from 0, nominal, up to 4, emergency.`;
    if (has("alert", "attention", "warning", "wrong", "problem"))
      return open.length
        ? `You have ${plural(open.length, "alert")}. ${open.map((a, i) => `${i + 1}: ${a.title}.`).join(" ")}`
        : "You have no alerts right now.";
    if (has("recover"))
      return `Recovery is ${today.recovery} out of 100, which is ${WORD[level(today.recovery)]}. It comes from your resting heart rate, heart rate variability and sleep.`;
    if (has("variab", "hrv"))
      return `Heart rate variability is ${today.hrv_rmssd} milliseconds. Your usual is about ${usual("hrv_rmssd")}.`;
    if (has("heart", "pulse", "bpm"))
      return `Resting heart rate is ${Math.round(today.resting_hr)} beats a minute. Your usual is about ${usual("resting_hr")}.`;
    if (has("sleep", "slept", "rest"))
      return `You slept ${today.sleep_hours} hours last night. Your usual is about ${usual("sleep_hours")} hours.`;
    if (has("pressure", "bp"))
      return `Blood pressure is ${today.bp_systolic} over ${today.bp_diastolic}.`;
    if (has("oxygen", "spo2", "saturation"))
      return `Blood oxygen is ${Math.round(today.spo2)} percent.`;
    if (has("breath", "respir"))
      return `You're breathing ${Math.round(today.resp_rate)} times a minute. Your usual is about ${usual("resp_rate")}.`;
    if (has("radiation", "dose", "sievert"))
      return `You got ${today.radiation_dose} millisieverts today and ${Math.round(today.doseTotal)} this mission. That's ${today.doseLimitPct} percent of your ${H.careerLimit} millisievert career limit.`;
    if (has("mind", "mood", "stress", "feel", "mental"))
      return `Your mind score is ${today.mindScore} out of 100, and your last mood check-in was ${today.mood} out of 5.`;
    if (has("device", "battery", "sync", "watch", "connected"))
      return `You have ${plural(devices.length, "device")} connected: ${devices.map((d) => d.label).join(", ")}.`;
    if (has("due", "check", "log", "test", "task", "to do list"))
      return dueChecks().length
        ? `Due now: ${dueChecks().map((t) => t.name.replace(/\s*\(.*\)/, "")).join(", ")}.`
        : "Nothing is due right now.";
    if (has("should i", "what do i", "to do", "advice", "plan"))
      return open.length ? `For today: ${open[0].actions.join(". ")}.` : "Nothing special today. Keep to your normal exercise and sleep plan.";
    if (has("mission", "what day"))
      return `It's day ${astronaut.missionDay} of ${astronaut.missionLength} on ${astronaut.mission}.`;
    if (has("summary", "how am i", "doing", "overview", "status", "today", "again", "repeat"))
      return summary();
    return "I can read back your recovery, sleep, heart rate, blood pressure, radiation, mind score, alerts, tier, or what's due. Try asking for one of those.";
  }

  /* ---------- Wiring up the buttons ---------- */
  mainBtn.addEventListener("click", () => {
    if (state === "speaking") return hush();
    stopListening();
    say(summary());
  });
  // The X on the caption: stop talking or listening and close the caption.
  $("voice-close").addEventListener("click", () => {
    stopListening();
    if (synth) synth.cancel();
    setState("idle");
    clearTimeout(hideTimer);
    caption.hidden = true;
    $("voice-type").hidden = true;
  });
  micBtn.addEventListener("click", () => {
    if (state === "listening") { stopListening(); return setState("idle"); }
    listen();
  });
  $("voice-type").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("voice-input").value.trim();
    if (!v) return;
    $("voice-input").value = "";
    ask(v);
  });

  // For testing from the browser console: SIRIUS_VOICE.ask("what's my sleep")
  window.SIRIUS_VOICE = { ask, say, hush, summary, answer };

  // Sirius stays quiet until the logo is clicked.
  setState("idle");
  caption.hidden = true;
});

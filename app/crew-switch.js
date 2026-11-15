/*
 * Astronaut switcher: turns the name card at the top of Today into a button.
 * Clicking it opens a short list of the six crew members; picking one reloads the page
 * showing that person's vitals, scores, body map, alerts and charts.
 *
 * How it works, in plain English: data.js reads who to show from the address bar
 * (?crew=crew-02) or from the last choice saved in the browser, and builds everything for
 * that person. This file only draws the button and the list, and calls
 * SIRIUS_CREW.select(id), which saves the choice and reloads.
 */
window.HEALTH_READY.then(function () {
  const C = window.SIRIUS_CREW;
  const nameEl = document.getElementById("astro-name");
  if (!C || !nameEl) return;
  const ic = (name) => window.icon(name);
  const me = C.list.find((p) => p.id === C.current);

  // The role sits in front of the mission line, e.g. "Pilot · Sirius Deep Space Mission 3".
  const missionEl = document.getElementById("astro-mission");
  if (missionEl && me) missionEl.insertAdjacentHTML("beforeend", `<span class="who-role">· ${me.role}</span>`);

  nameEl.innerHTML = `<button type="button" class="crew-pick" id="crew-pick" aria-haspopup="listbox" aria-expanded="false"
      title="Switch astronaut">${me.name}<span class="crew-pick-chev">${ic("chevron-right")}</span></button>`;
  const button = document.getElementById("crew-pick");

  const menu = document.createElement("div");
  menu.className = "crew-menu";
  menu.id = "crew-menu";
  menu.hidden = true;
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Switch astronaut");
  menu.innerHTML =
    `<p class="crew-menu-head">Switch astronaut</p>` +
    C.list.map((p) => `
      <button type="button" role="option" data-id="${p.id}" aria-selected="${p.id === C.current}">
        <span class="crew-init">${p.initials}</span>
        <span class="crew-text"><b>${p.name}</b><small>${p.role}</small></span>
        ${p.id === C.current ? `<span class="crew-tick">${ic("check")}</span>` : ""}
      </button>`).join("");
  nameEl.parentElement.appendChild(menu);

  function open(show) {
    menu.hidden = !show;
    button.setAttribute("aria-expanded", show);
    if (show) (menu.querySelector('[aria-selected="true"]') || menu.querySelector("button")).focus();
  }
  button.addEventListener("click", (e) => { e.stopPropagation(); open(menu.hidden); });
  menu.addEventListener("click", (e) => {
    const pick = e.target.closest("button[data-id]");
    if (!pick) return;
    if (pick.dataset.id === C.current) return open(false);
    menu.classList.add("is-loading");
    C.select(pick.dataset.id);
  });
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) open(false); });
  document.addEventListener("keydown", (e) => {
    if (menu.hidden) return;
    if (e.key === "Escape") { open(false); button.focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...menu.querySelectorAll("button[data-id]")];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    }
  });
});

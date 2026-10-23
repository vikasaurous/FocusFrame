const DEFAULTS = {
  accent: "coral",
  order: ["focus", "links", "now", "goal", "quote"],
  visible: { focus: true, links: true, now: true, goal: true, quote: true },
  focus: "Make room for the work that matters.",
  links: [
    { name: "Gmail", url: "https://mail.google.com" },
    { name: "Notion", url: "https://www.notion.so" },
    { name: "YouTube", url: "https://www.youtube.com" },
    { name: "Calendar", url: "https://calendar.google.com" }
  ]
};

const moduleNames = { focus: "Today's focus", links: "Quick links", now: "Now", goal: "Momentum", quote: "A note to keep" };
const quotes = [
  ["Make room for the work that matters.", "FocusFrame"],
  ["The small things you return to become the shape of your days.", "FocusFrame"],
  ["Start where your feet are. Make the next hour count.", "FocusFrame"]
];
let state = structuredClone(DEFAULTS);
let editing = false;
let draggedId = null;

const $ = (selector) => document.querySelector(selector);
const dashboard = $("#dashboard");

async function load() {
  const saved = await chrome.storage.local.get("focusFrame");
  state = { ...structuredClone(DEFAULTS), ...(saved.focusFrame || {}) };
  state.visible = { ...DEFAULTS.visible, ...(saved.focusFrame?.visible || {}) };
  state.links = saved.focusFrame?.links || DEFAULTS.links;
  document.documentElement.dataset.accent = state.accent;
  render();
}

function save(message = "Saved") {
  chrome.storage.local.set({ focusFrame: state });
  $("#status").textContent = message;
  window.clearTimeout(save.timer);
  save.timer = window.setTimeout(() => { $("#status").textContent = "Your space is saved locally"; }, 1800);
}

function updateTime() {
  const now = new Date();
  const hour = now.getHours();
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - yearStart) / 86400000);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
  const daysInYear = Math.round((yearEnd - new Date(now.getFullYear(), 0, 1)) / 86400000);
  $("#greeting").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  $("#clock").textContent = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(now);
  $("#date").textContent = new Intl.DateTimeFormat([], { weekday: "long", month: "long", day: "numeric" }).format(now);
  $("#year").textContent = now.getFullYear();
  $("#day-of-year").textContent = String(dayOfYear).padStart(3, "0");
  $("#days-left").textContent = daysInYear - dayOfYear;
  $("#quote").textContent = quotes[now.getDate() % quotes.length][0];
  renderYearDots(dayOfYear, daysInYear);
}

function renderYearDots(dayOfYear, daysInYear) {
  const dots = $("#year-dots");
  if (!dots || dots.dataset.day === String(dayOfYear)) return;
  dots.dataset.day = String(dayOfYear);
  dots.innerHTML = Array.from({ length: daysInYear }, (_, index) => `<i class="${index < dayOfYear ? "is-complete" : ""}" aria-hidden="true"></i>`).join("");
}

function moduleMarkup(id) {
  const title = moduleNames[id];
  const handle = '<span class="drag-handle" aria-hidden="true">DRAG</span>';
  if (id === "focus") return `<article class="module" data-id="focus" draggable="${editing}">${handle}<p class="module-title">${title}</p><p class="focus-prompt">One thing, then the next.</p><input class="focus-input" id="focus-input" value="${escapeHtml(state.focus)}" aria-label="Today's focus" /></article>`;
  if (id === "links") return `<article class="module" data-id="links" draggable="${editing}">${handle}<p class="module-title">${title}</p><nav class="links" aria-label="Quick links">${state.links.map(link => `<a class="link-chip" href="${safeUrl(link.url)}">${escapeHtml(link.name)}</a>`).join("")}</nav></article>`;
  if (id === "now") return `<article class="module" data-id="now" draggable="${editing}">${handle}<p class="module-title">${title}</p><p class="now-copy">Building a home for your attention—one tab at a time.</p></article>`;
  if (id === "goal") return `<article class="module" data-id="goal" draggable="${editing}">${handle}<p class="module-title">${title}</p><p class="goal-number">64%</p><p class="goal-caption">of this week’s intention</p><div class="goal-line" aria-label="64 percent complete"><span></span></div></article>`;
  const quote = quotes[(new Date().getDate() + 1) % quotes.length];
  return `<article class="module" data-id="quote" draggable="${editing}">${handle}<p class="module-title">${title}</p><blockquote class="module-quote">“${quote[0]}”<cite>— ${quote[1]}</cite></blockquote></article>`;
}

function render() {
  dashboard.innerHTML = state.order.filter(id => state.visible[id]).map(moduleMarkup).join("");
  renderToggles();
  document.documentElement.dataset.accent = state.accent;
  document.body.classList.toggle("is-editing", editing);
  bindModuleEvents();
}

function renderToggles() {
  $("#module-toggles").innerHTML = state.order.map(id => `<label class="toggle-row"><span>${moduleNames[id]}</span><input type="checkbox" data-module-toggle="${id}" ${state.visible[id] ? "checked" : ""} /></label>`).join("");
  document.querySelectorAll(".swatch").forEach(button => button.classList.toggle("is-selected", button.dataset.accent === state.accent));
}

function bindModuleEvents() {
  const input = $("#focus-input");
  if (input) input.addEventListener("change", () => { state.focus = input.value.trim() || DEFAULTS.focus; save("Focus updated"); });
  dashboard.querySelectorAll(".module").forEach(module => {
    module.addEventListener("dragstart", () => { draggedId = module.dataset.id; module.classList.add("dragging"); });
    module.addEventListener("dragend", () => { draggedId = null; module.classList.remove("dragging"); });
    module.addEventListener("dragover", event => event.preventDefault());
    module.addEventListener("drop", event => {
      event.preventDefault();
      const targetId = module.dataset.id;
      if (!draggedId || draggedId === targetId) return;
      const from = state.order.indexOf(draggedId), to = state.order.indexOf(targetId);
      state.order.splice(from, 1); state.order.splice(to, 0, draggedId);
      save("Layout updated"); render();
    });
  });
}

function toggleEditor(force) {
  editing = typeof force === "boolean" ? force : !editing;
  $("#editor").classList.toggle("is-open", editing);
  $("#editor").setAttribute("aria-hidden", String(!editing));
  $("#scrim").hidden = !editing;
  $("#edit-toggle").setAttribute("aria-pressed", String(editing));
  $("#edit-toggle").setAttribute("aria-label", editing ? "Finish customizing dashboard" : "Customize dashboard");
  render();
}

function safeUrl(value) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; } }
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }

$("#edit-toggle").addEventListener("click", () => toggleEditor());
$("#close-editor").addEventListener("click", () => toggleEditor(false));
$("#scrim").addEventListener("click", () => toggleEditor(false));
$("#module-toggles").addEventListener("change", event => { if (!event.target.matches("[data-module-toggle]")) return; state.visible[event.target.dataset.moduleToggle] = event.target.checked; save("Modules updated"); render(); });
$(".swatches").addEventListener("click", event => { const button = event.target.closest("[data-accent]"); if (!button) return; state.accent = button.dataset.accent; save("Accent updated"); render(); });
$("#link-form").addEventListener("submit", event => { event.preventDefault(); const name = $("#link-name").value.trim(), url = $("#link-url").value.trim(); if (!name || safeUrl(url) === "#") return; state.links.push({ name, url }); event.target.reset(); save("Link added"); render(); });
$("#reset-button").addEventListener("click", () => { state = structuredClone(DEFAULTS); save("Starter layout restored"); render(); });

updateTime();
window.setInterval(updateTime, 1000);
load();

const DEFAULTS = {
  accent: "coral",
  searchEngine: "default",
  order: ["focus", "links", "now", "goal", "quote"],
  visible: { focus: true, links: true, now: true, goal: true, quote: true },
  focus: "What would make today feel finished?",
  focusNote: "Ship the onboarding notes.",
  scene: { enabled: true, pet: "cat" },
  now: "Learning to say no to good things. Running mornings. Rereading Stoner.",
  momentumDays: [true, true, false, true, true, true, false],
  links: [
    { name: "Mail", url: "https://mail.google.com" },
    { name: "Docs", url: "https://docs.google.com" },
    { name: "Calendar", url: "https://calendar.google.com" },
    { name: "Reading", url: "https://read.readwise.io" },
    { name: "Repo", url: "https://github.com" },
    { name: "Music", url: "https://open.spotify.com" },
  ],
};

// ── Personalized greetings by time of day ─────────────────────────
// Six time slots; greeting rotates daily so it never feels stale.
const GREETINGS = {
  // 0–3 — still up late
  lateNight: [
    "Still burning the midnight oil",
    "The world is quiet right now",
    "You and the night owls",
    "Late again — own it",
    "Some of the best ideas arrive this late",
    "The hours nobody talks about",
  ],
  // 4–6 — early riser
  earlyMorning: [
    "You're up before most of the world",
    "The day is entirely unwritten",
    "Early start, clear head",
    "Quiet hours — the best kind",
    "Caught the world still asleep",
    "A head start on the day",
  ],
  // 7–11 — morning
  morning: [
    "Let's make this morning count",
    "Fresh page, fresh start",
    "The morning belongs to you",
    "Ready when you are",
    "Something good is coming together",
    "Pick the one thing that matters today",
  ],
  // 12–13 — midday
  midday: [
    "Halfway there — keep the momentum",
    "How's the afternoon shaping up?",
    "Quick check — still on track?",
    "Good time to breathe and refocus",
    "The afternoon is still yours to shape",
    "Midday reset — what's the move?",
  ],
  // 14–17 — afternoon
  afternoon: [
    "Afternoon deep work hits different",
    "A little further to go",
    "The day isn't done with you yet",
    "Tie up the loose ends",
    "What's left on today's list?",
    "Make the last few hours matter",
  ],
  // 18–22 — evening
  evening: [
    "Wind down — you earned it",
    "How did today actually go?",
    "Evening light, quieter mind",
    "A good time to reflect",
    "Day's almost done — what'll you carry into tomorrow?",
    "Park the remaining thoughts and rest",
  ],
};

/**
 * Future premium gate. Currently always returns true.
 * NO payment code, NO network calls — swap the body here when billing is added.
 */
function isFeatureUnlocked(feature) {
  return true;
} // eslint-disable-line no-unused-vars

function getGreeting(hour, dayOfYear) {
  let pool;
  if (hour < 4) pool = GREETINGS.lateNight;
  else if (hour < 7) pool = GREETINGS.earlyMorning;
  else if (hour < 12) pool = GREETINGS.morning;
  else if (hour < 14) pool = GREETINGS.midday;
  else if (hour < 18) pool = GREETINGS.afternoon;
  else pool = GREETINGS.evening;
  return pool[dayOfYear % pool.length];
}

const moduleNames = {
  focus: "Daily Focus",
  links: "Quick Links",
  now: "Now",
  goal: "Weekly Momentum",
  quote: "Quote",
};
const quotes = [
  ["Make room for the work that matters.", "FocusFrame"],
  [
    "The small things you return to become the shape of your days.",
    "FocusFrame",
  ],
  ["Start where your feet are. Make the next hour count.", "FocusFrame"],
];
let state = structuredClone(DEFAULTS);
let editing = false;
let draggedId = null;
let sceneCtl = null;
const SCENE_PETS = ["cat", "dog", "dino"];

const $ = (selector) => document.querySelector(selector);
const dashboard = $("#dashboard");

async function load() {
  let savedData = {};
  if (window.chrome?.storage?.local) {
    const saved = await chrome.storage.local.get("focusFrame");
    savedData = saved.focusFrame || {};
  } else {
    try {
      const item = localStorage.getItem("focusFrame");
      if (item) savedData = JSON.parse(item);
    } catch {}
  }
  state = { ...structuredClone(DEFAULTS), ...savedData };
  state.visible = { ...DEFAULTS.visible, ...(savedData.visible || {}) };
  state.links = savedData.links || DEFAULTS.links;
  state.momentumDays = savedData.momentumDays || DEFAULTS.momentumDays;
  // Merge snake settings with safe defaults.
  state.snake = {
    enabled: false,
    speed: "slow",
    regrow: true,
    ...(savedData.snake || {}),
  };
  // Pixel scene settings with safe defaults.
  state.scene = {
    ...DEFAULTS.scene,
    ...(savedData.scene || {}),
  };
  if (!SCENE_PETS.includes(state.scene.pet)) state.scene.pet = "cat";
  // Command bar settings with safe defaults.
  state.commandBar = FFCommands.mergeSettings(savedData.commandBar);
  document.documentElement.dataset.accent = state.accent;
  render();
  applySnakeRenderer();
  if (window.CommandBar) {
    CommandBar.init({
      settings: state.commandBar,
      onChange(next) {
        state.commandBar = next;
        updateTeaser();
        save("Command bar updated");
      },
    });
  }
  updateTeaser();
  initScene();
}

// Pixel scene under the greeting.
function initScene() {
  const box = $("#scene");
  if (!box || !window.FFScene) return;
  const s = state.scene || {};
  sceneCtl = FFScene.init(box, {
    enabled: s.enabled !== false,
    pet: s.pet,
  });
}

// Small "Press Alt + K" hint at the top center.
function updateTeaser() {
  const teaser = $("#cb-teaser");
  if (!teaser) return;
  const cb = state.commandBar;
  teaser.hidden = !(window.CommandBar && cb && cb.enabled);
  if (teaser.hidden) return;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
  $("#cb-teaser-key").textContent = FFCommands.formatShortcut(
    cb.shortcut,
    isMac,
  );
}

function save(message = "Saved") {
  if (window.chrome?.storage?.local) {
    chrome.storage.local.set({ focusFrame: state });
  } else {
    try {
      localStorage.setItem("focusFrame", JSON.stringify(state));
    } catch {}
  }
  $("#status").textContent = message;
  window.clearTimeout(save.timer);
  save.timer = window.setTimeout(() => {
    $("#status").textContent = "Your space is saved locally";
  }, 1800);
}

function updateTime() {
  const now = new Date();
  const hour = now.getHours();
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - yearStart) / 86400000);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
  const daysInYear = Math.round(
    (yearEnd - new Date(now.getFullYear(), 0, 1)) / 86400000,
  );
  $("#greeting").textContent = getGreeting(hour, dayOfYear);

  const formatter = new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  let hourStr = "";
  let minStr = "";
  let periodStr = "";
  for (const part of parts) {
    if (part.type === "hour") hourStr = part.value;
    else if (part.type === "minute") minStr = part.value;
    else if (part.type === "dayPeriod") periodStr = part.value;
  }
  const hourEl = $("#clock-hour");
  const minEl = $("#clock-minute");
  const periodEl = $("#clock-period");
  if (hourEl && minEl) {
    if (hourEl.textContent !== hourStr) hourEl.textContent = hourStr;
    if (minEl.textContent !== minStr) minEl.textContent = minStr;
    if (periodEl) {
      const formattedPeriod = periodStr ? ` ${periodStr}` : "";
      if (periodEl.textContent !== formattedPeriod)
        periodEl.textContent = formattedPeriod;
    }
  } else {
    $("#clock").textContent = formatter.format(now);
  }

  $("#date").textContent = new Intl.DateTimeFormat([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  $("#year").textContent = now.getFullYear();
  $("#day-of-year").textContent = String(dayOfYear).padStart(3, "0");
  $("#days-left").textContent = daysInYear - dayOfYear;
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const msLeft = nextMidnight - now;
  const pad2 = (n) => String(n).padStart(2, "0");
  $("#time-left").textContent =
    `${pad2(Math.floor(msLeft / 3600000))}h ${pad2(Math.floor((msLeft % 3600000) / 60000))}m ${pad2(Math.floor((msLeft % 60000) / 1000))}s`;
  $("#quote").textContent = quotes[now.getDate() % quotes.length][0];
  renderYearDots(dayOfYear, daysInYear);
}

function renderYearDots(dayOfYear, daysInYear) {
  const dots = $("#year-dots");
  if (!dots || dots.dataset.day === String(dayOfYear)) return;
  dots.dataset.day = String(dayOfYear);
  dots.innerHTML = Array.from({ length: daysInYear }, (_, index) => {
    const classes = [
      index < dayOfYear ? "is-complete" : "",
      index === dayOfYear - 1 ? "is-today" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<i class="${classes}" aria-hidden="true"></i>`;
  }).join("");
  // Inform snake renderer that the grid was rebuilt (SVG re-attachment + coord refresh).
  if (window.SnakeRenderer) SnakeRenderer.notify(dots, dayOfYear);
}

function moduleMarkup(id) {
  const title = moduleNames[id];
  const handle = '<span class="drag-handle" aria-hidden="true">DRAG</span>';

  if (id === "focus") {
    return `<article class="module" data-id="focus" draggable="${editing}">${handle}
      <p class="module-title">${title}</p>
      <p class="focus-prompt">${escapeHtml(state.focus)}</p>
      <p class="focus-note">${escapeHtml(state.focusNote)}</p>
      <input class="focus-input" id="focus-input" value="${escapeHtml(state.focus)}" aria-label="Today's focus" placeholder="What would make today feel finished?" />
      <input class="focus-note-input" id="focus-note-input" value="${escapeHtml(state.focusNote)}" aria-label="Focus note" placeholder="Add a note..." />
    </article>`;
  }

  if (id === "links") {
    return `<article class="module" data-id="links" draggable="${editing}">${handle}
      <p class="module-title">${title}</p>
      <nav class="links-grid" aria-label="Quick links">${state.links
        .map(
          (link) =>
            `<a class="link-chip" href="${safeUrl(link.url)}">${escapeHtml(link.name)}</a>`,
        )
        .join("")}</nav>
    </article>`;
  }

  if (id === "now") {
    return `<article class="module" data-id="now" draggable="${editing}">${handle}
      <p class="module-title">${title}</p>
      <p class="now-copy" id="now-copy">${escapeHtml(state.now)}</p>
      <textarea class="now-input" id="now-input" aria-label="What I'm doing now" rows="3">${escapeHtml(state.now)}</textarea>
    </article>`;
  }

  if (id === "goal") {
    const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
    const DAY_NAMES = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const filledCount = state.momentumDays.filter(Boolean).length;
    const dots = DAY_LABELS.map((label, i) => {
      const filled = state.momentumDays[i];
      return `<button class="momentum-dot${filled ? " is-filled" : ""}" data-day="${i}" aria-label="${DAY_NAMES[i]}: ${filled ? "done" : "not done"}" aria-pressed="${filled}" type="button"><span class="momentum-dot-circle"></span><span class="momentum-label">${label}</span></button>`;
    }).join("");
    return `<article class="module" data-id="goal" draggable="${editing}">${handle}
      <p class="module-title">${title}</p>
      <div class="momentum-dots" role="group" aria-label="Days this week">${dots}</div>
      <p class="momentum-count">${filledCount} of 7 days</p>
    </article>`;
  }

  const quote = quotes[(new Date().getDate() + 1) % quotes.length];
  return `<article class="module" data-id="quote" draggable="${editing}">${handle}
    <p class="module-title">${title}</p>
    <blockquote class="module-quote">“${quote[0]}”<cite>— ${quote[1]}</cite></blockquote>
  </article>`;
}

function render() {
  dashboard.innerHTML = state.order
    .filter((id) => state.visible[id])
    .map(moduleMarkup)
    .join("");
  renderToggles();
  document.documentElement.dataset.accent = state.accent;
  document.body.classList.toggle("is-editing", editing);
  document
    .querySelectorAll(".engine-choice")
    .forEach((button) =>
      button.classList.toggle(
        "is-selected",
        button.dataset.engine === state.searchEngine,
      ),
    );
  bindModuleEvents();
}

function renderToggles() {
  $("#module-toggles").innerHTML = state.order
    .map(
      (id) =>
        `<label class="toggle-row"><span>${moduleNames[id]}</span><input type="checkbox" data-module-toggle="${id}" ${state.visible[id] ? "checked" : ""} /></label>`,
    )
    .join("");
  document
    .querySelectorAll(".swatch")
    .forEach((button) =>
      button.classList.toggle(
        "is-selected",
        button.dataset.accent === state.accent,
      ),
    );
  // Sync snake settings controls.
  const snakeEnabledEl = $("#snake-enabled");
  if (snakeEnabledEl) {
    snakeEnabledEl.checked = !!state.snake.enabled;
    const sub = $("#snake-subcontrols");
    if (sub) sub.hidden = !state.snake.enabled;
  }
  document.querySelectorAll('[name="snake-speed"]').forEach((r) => {
    r.checked = r.value === state.snake.speed;
  });
  const regrowEl = $("#snake-regrow");
  if (regrowEl) regrowEl.checked = !!state.snake.regrow;
  // Sync pixel scene controls.
  const sceneEnabledEl = $("#scene-enabled");
  if (sceneEnabledEl) sceneEnabledEl.checked = state.scene.enabled !== false;
  document.querySelectorAll('[name="scene-pet"]').forEach((r) => {
    r.checked = r.value === state.scene.pet;
  });
}

/** Starts or stops SnakeRenderer based on current state.snake settings. */
function applySnakeRenderer() {
  if (!window.SnakeRenderer) return;
  const dots = $("#year-dots");
  const now = new Date();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000,
  );
  if (isFeatureUnlocked("snake") && state.snake.enabled) {
    SnakeRenderer.setup(dots, dayOfYear, state.snake);
  } else {
    SnakeRenderer.teardown();
  }
}

function bindModuleEvents() {
  const focusInput = $("#focus-input");
  if (focusInput)
    focusInput.addEventListener("change", () => {
      state.focus = focusInput.value.trim() || DEFAULTS.focus;
      save("Focus updated");
      render();
    });

  const focusNoteInput = $("#focus-note-input");
  if (focusNoteInput)
    focusNoteInput.addEventListener("change", () => {
      state.focusNote = focusNoteInput.value.trim();
      save("Note updated");
      render();
    });

  const nowInput = $("#now-input");
  const nowCopy = $("#now-copy");
  if (nowInput) {
    nowInput.addEventListener("input", () => {
      if (nowCopy) nowCopy.textContent = nowInput.value;
    });
    nowInput.addEventListener("change", () => {
      state.now = nowInput.value.trim() || DEFAULTS.now;
      save("Now updated");
      render();
    });
  }

  dashboard.querySelectorAll(".momentum-dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const day = parseInt(btn.dataset.day, 10);
      state.momentumDays[day] = !state.momentumDays[day];
      save("Momentum updated");
      render();
    });
  });

  dashboard.querySelectorAll(".module").forEach((module) => {
    module.addEventListener("dragstart", () => {
      draggedId = module.dataset.id;
      module.classList.add("dragging");
    });
    module.addEventListener("dragend", () => {
      draggedId = null;
      module.classList.remove("dragging");
    });
    module.addEventListener("dragover", (event) => event.preventDefault());
    module.addEventListener("drop", (event) => {
      event.preventDefault();
      const targetId = module.dataset.id;
      if (!draggedId || draggedId === targetId) return;
      const from = state.order.indexOf(draggedId),
        to = state.order.indexOf(targetId);
      state.order.splice(from, 1);
      state.order.splice(to, 0, draggedId);
      save("Layout updated");
      render();
    });
  });
}

function toggleEditor(force) {
  editing = typeof force === "boolean" ? force : !editing;
  $("#editor").classList.toggle("is-open", editing);
  $("#editor").setAttribute("aria-hidden", String(!editing));
  $("#scrim").hidden = !editing;
  $("#edit-toggle").setAttribute("aria-pressed", String(editing));
  $("#edit-toggle").setAttribute(
    "aria-label",
    editing ? "Finish customizing dashboard" : "Customize dashboard",
  );
  render();
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}
function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

$("#edit-toggle").addEventListener("click", () => toggleEditor());
$("#close-editor").addEventListener("click", () => toggleEditor(false));
$("#scrim").addEventListener("click", () => toggleEditor(false));
$("#module-toggles").addEventListener("change", (event) => {
  if (!event.target.matches("[data-module-toggle]")) return;
  state.visible[event.target.dataset.moduleToggle] = event.target.checked;
  save("Modules updated");
  render();
});
$(".swatches").addEventListener("click", (event) => {
  const button = event.target.closest("[data-accent]");
  if (!button) return;
  state.accent = button.dataset.accent;
  save("Accent updated");
  render();
});
$("#link-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#link-name").value.trim(),
    url = $("#link-url").value.trim();
  if (!name || safeUrl(url) === "#") return;
  state.links.push({ name, url });
  event.target.reset();
  save("Link added");
  render();
});
$("#reset-button").addEventListener("click", () => {
  state = structuredClone(DEFAULTS);
  state.snake = { enabled: false, speed: "slow", regrow: true };
  state.commandBar = FFCommands.mergeSettings(null);
  save("Starter layout restored");
  render();
  applySnakeRenderer();
  if (sceneCtl) {
    sceneCtl.setPet(state.scene.pet);
    sceneCtl.setEnabled(state.scene.enabled);
  }
  if (window.CommandBar) CommandBar.setSettings(state.commandBar);
  updateTeaser();
});
$(".engine-row").addEventListener("click", (event) => {
  const button = event.target.closest("[data-engine]");
  if (!button) return;
  state.searchEngine = button.dataset.engine;
  save(`${button.textContent.trim()} selected`);
  render();
});
$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = $("#search-input").value.trim();
  if (!query) return;
  const engines = {
    default: "https://www.google.com/search?q=",
    google: "https://www.google.com/search?q=",
    duckduckgo: "https://duckduckgo.com/?q=",
    bing: "https://www.bing.com/search?q=",
    brave: "https://search.brave.com/search?q=",
  };
  window.location.assign(
    `${engines[state.searchEngine] || engines.default}${encodeURIComponent(query)}`,
  );
});

// ---- Snake settings event listeners --------------------------------
$("#snake-enabled").addEventListener("change", function () {
  state.snake.enabled = this.checked;
  $("#snake-subcontrols").hidden = !this.checked;
  save("Snake updated");
  applySnakeRenderer();
});
document.querySelectorAll('[name="snake-speed"]').forEach((r) => {
  r.addEventListener("change", function () {
    state.snake.speed = this.value;
    save("Speed updated");
    applySnakeRenderer();
  });
});
$("#snake-regrow").addEventListener("change", function () {
  state.snake.regrow = this.checked;
  save("Regrow updated");
  // regrow takes effect at the start of the next cycle; no re-setup needed.
});

// ---- Pixel scene settings event listeners --------------------------
$("#scene-enabled").addEventListener("change", function () {
  state.scene.enabled = this.checked;
  if (sceneCtl) sceneCtl.setEnabled(this.checked);
  save("Scene updated");
});
document.querySelectorAll('[name="scene-pet"]').forEach((r) => {
  r.addEventListener("change", function () {
    if (!SCENE_PETS.includes(this.value)) return;
    state.scene.pet = this.value;
    if (sceneCtl) sceneCtl.setPet(this.value);
    save("Companion updated");
  });
});

updateTime();
window.setInterval(updateTime, 1000);
load();

const DEFAULTS = {
  accent: "coral",
  searchEngine: "default",
  order: ["focus", "links", "now", "goal", "quote", "tasks", "countdown"],
  // Real rows, max 3 cards each. Cards in a row share its width equally.
  // New users see Focus, Tasks, Links, Habits. The rest are one click away.
  rows: [
    ["focus"],
    ["tasks", "links"],
    ["goal", "now", "quote"],
    ["countdown"],
  ],
  visible: {
    focus: true,
    links: true,
    now: false,
    goal: true,
    quote: false,
    tasks: true,
    countdown: false,
  },
  focus: "What would make today feel finished?",
  focusNote: "Hover to change this line.",
  scene: { enabled: true, pet: "cat" },
  now: "Write what you are working on right now.",
  habits: [], // up to 5 { id, name }
  habitLog: {}, // { "YYYY-MM-DD": [habit ids done that day] }
  quotesCustom: [], // [{ text, author }] added by the user
  quotePin: null, // { text, author } while a quote is pinned
  quoteOffset: 0, // moves the daily pick when the user shuffles
  tasks: { date: "", items: [] }, // up to 3 { text, done } for today
  countdown: { label: "", date: "" }, // date is YYYY-MM-DD
  links: [
    { name: "Mail", url: "https://mail.google.com" },
    { name: "Docs", url: "https://docs.google.com" },
    { name: "Calendar", url: "https://calendar.google.com" },
    { name: "Drive", url: "https://drive.google.com" },
    { name: "YouTube", url: "https://www.youtube.com" },
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
  goal: "Habits",
  quote: "Quote",
  tasks: "Top 3 Tasks",
  countdown: "Countdown",
};
const quotes = [
  ["Make room for the work that matters.", "FocusFrame"],
  [
    "The small things you return to become the shape of your days.",
    "FocusFrame",
  ],
  ["Start where your feet are. Make the next hour count.", "FocusFrame"],
  ["One finished thing beats ten started ones.", "FocusFrame"],
  ["Do the hard part while the tab is still new.", "FocusFrame"],
  ["Quiet progress is still progress.", "FocusFrame"],
  ["You do not need the whole plan. You need the next step.", "FocusFrame"],
  ["Protect the morning. The rest of the day follows.", "FocusFrame"],
  ["Rest is part of the work, not a break from it.", "FocusFrame"],
  ["Say no once today so you can say yes to the right thing.", "FocusFrame"],
  ["Small and daily beats big and rare.", "FocusFrame"],
];
let state = structuredClone(DEFAULTS);
let editing = false;
let draggedId = null;
let quoteFormOpen = false;
let ready = false; // true once saved data is loaded, so nothing overwrites it early
let dayKey = null; // today's date key, to spot midnight passing with the tab open
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
  delete state.momentumDays; // old 7-dot week, replaced by the habit log
  state.habits = (Array.isArray(savedData.habits) ? savedData.habits : [])
    .filter(
      (h) =>
        h &&
        typeof h.id === "string" &&
        h.id &&
        typeof h.name === "string" &&
        h.name.trim(),
    )
    .map((h) => ({ id: h.id.slice(0, 24), name: h.name.slice(0, 24) }))
    .slice(0, 5);
  state.habitLog = {};
  const oldest = new Date();
  oldest.setDate(oldest.getDate() - 400);
  const oldestKey = todayKey(oldest);
  const rawLog =
    savedData.habitLog && typeof savedData.habitLog === "object"
      ? savedData.habitLog
      : {};
  Object.keys(rawLog).forEach((day) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < oldestKey) return;
    if (!Array.isArray(rawLog[day])) return;
    const ids = [...new Set(rawLog[day])].filter((id) =>
      state.habits.some((h) => h.id === id),
    );
    if (ids.length) state.habitLog[day] = ids;
  });
  // Keep the user's saved order, but add cards that were released later.
  state.order = (savedData.order || []).filter((id) =>
    DEFAULTS.order.includes(id),
  );
  DEFAULTS.order.forEach((id) => {
    if (!state.order.includes(id)) state.order.push(id);
  });
  state.rows = normalizeRows(savedData, state.order);
  state.order = state.rows.flat();
  // Quote card data with safe defaults.
  state.quotesCustom = (
    Array.isArray(savedData.quotesCustom) ? savedData.quotesCustom : []
  )
    .filter((q) => q && typeof q.text === "string" && q.text.trim())
    .map((q) => ({
      text: q.text.slice(0, 160),
      author: typeof q.author === "string" ? q.author.slice(0, 30) : "",
    }))
    .slice(0, 50);
  const pin = savedData.quotePin;
  state.quotePin =
    pin && typeof pin.text === "string" && pin.text
      ? {
          text: pin.text,
          author: typeof pin.author === "string" ? pin.author : "",
        }
      : null;
  state.quoteOffset = Number.isInteger(savedData.quoteOffset)
    ? savedData.quoteOffset
    : 0;
  // Tasks: up to 3, rolled over to today below.
  const savedTasks = savedData.tasks;
  state.tasks = {
    date:
      savedTasks && typeof savedTasks.date === "string" ? savedTasks.date : "",
    items: Array.isArray(savedTasks && savedTasks.items)
      ? savedTasks.items
          .filter((i) => i && typeof i.text === "string" && i.text.trim())
          .map((i) => ({ text: i.text.slice(0, 80), done: !!i.done }))
          .slice(0, 3)
      : [],
  };
  // Countdown with safe defaults.
  const savedCountdown = savedData.countdown;
  state.countdown = {
    label:
      savedCountdown && typeof savedCountdown.label === "string"
        ? savedCountdown.label.slice(0, 24)
        : "",
    date:
      savedCountdown &&
      typeof savedCountdown.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(savedCountdown.date)
        ? savedCountdown.date
        : "",
  };
  if (rollTasks()) save("Saved");
  dayKey = todayKey();
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
  ready = true;
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
  $("#quote").textContent = currentQuote().text;
  renderYearDots(dayOfYear, daysInYear);
  // Midnight passed with the tab open: roll tasks, refresh the countdown.
  if (ready && todayKey() !== dayKey) {
    dayKey = todayKey();
    rollTasks();
    save("New day");
    render();
  }
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

// Saved rows -> clean rows. Old saves only had a flat order: chunk it by 3.
function normalizeRows(savedData, order) {
  const known = DEFAULTS.order;
  const seen = new Set();
  const clean = (row) => {
    const out = [];
    for (const id of row) {
      if (out.length >= 3) break;
      if (known.includes(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  };
  let rows = [];
  if (Array.isArray(savedData.rows)) {
    rows = savedData.rows.filter(Array.isArray).map(clean);
  } else if (Array.isArray(savedData.order)) {
    for (let i = 0; i < order.length; i += 3)
      rows.push(clean(order.slice(i, i + 3)));
  } else {
    rows = DEFAULTS.rows.map(clean);
  }
  rows = rows.filter((row) => row.length);
  known.forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const last = rows[rows.length - 1];
    if (last && last.length < 3) last.push(id);
    else rows.push([id]);
  });
  return rows;
}

// Rows as shown: hidden cards dropped, empty rows gone, never more than 3.
function visibleRows() {
  const rows = [];
  state.rows.forEach((row) => {
    const shown = row.filter((id) => state.visible[id]);
    for (let i = 0; i < shown.length; i += 3) rows.push(shown.slice(i, i + 3));
  });
  return rows;
}

// Drop zone from pointer spot: top/bottom edge = new row, left/right = same row.
function dropZone(event, el) {
  const r = el.getBoundingClientRect();
  const fy = (event.clientY - r.top) / r.height;
  const fx = (event.clientX - r.left) / r.width;
  if (fy < 0.25) return "top";
  if (fy > 0.75) return "bottom";
  return fx < 0.5 ? "left" : "right";
}

// What a drop would do: "move" the card, "swap" two cards, or null (nothing).
// Side drop into a full row from another row swaps, since the row cannot grow.
function dropMode(dragId, targetId, zone) {
  if (!dragId || dragId === targetId) return null;
  if (zone === "top" || zone === "bottom") return "move";
  const row = state.rows.find((r) => r.includes(targetId));
  if (!row) return null;
  if (row.includes(dragId)) return "move";
  return row.filter((id) => state.visible[id]).length < 3 ? "move" : "swap";
}

function swapCards(a, b) {
  state.rows = state.rows.map((row) =>
    row.map((id) => (id === a ? b : id === b ? a : id)),
  );
  state.order = state.rows.flat();
}

function moveCard(dragId, targetId, zone) {
  let rows = state.rows
    .map((row) => row.filter((id) => id !== dragId))
    .filter((row) => row.length);
  const ri = rows.findIndex((row) => row.includes(targetId));
  const ci = rows[ri].indexOf(targetId);
  if (zone === "left") rows[ri].splice(ci, 0, dragId);
  else if (zone === "right") rows[ri].splice(ci + 1, 0, dragId);
  else rows.splice(zone === "top" ? ri : ri + 1, 0, [dragId]);
  state.rows = rows;
  state.order = rows.flat();
}

// The 7 dates (YYYY-MM-DD) of this week, Monday first.
function weekDates() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return todayKey(day);
  });
}

function habitDone(id, day) {
  return (state.habitLog[day] || []).includes(id);
}

// Days in a row, counting back from today (or yesterday if today is not done).
function habitStreak(id) {
  const day = new Date();
  if (!habitDone(id, todayKey(day))) day.setDate(day.getDate() - 1);
  let n = 0;
  while (n < 400 && habitDone(id, todayKey(day))) {
    n += 1;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

function todayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// New day: finished tasks go, unfinished ones carry over. Returns true if changed.
function rollTasks() {
  const key = todayKey();
  if (state.tasks.date === key) return false;
  state.tasks = {
    date: key,
    items: state.tasks.items.filter((item) => !item.done),
  };
  return true;
}

// Whole days from today to a YYYY-MM-DD date. Negative once it has passed.
function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

function quotePool() {
  return quotes.concat(state.quotesCustom.map((q) => [q.text, q.author, true]));
}

// The quote on show: the pinned one, else today's pick moved by shuffles.
function currentQuote() {
  if (state.quotePin) {
    const { text, author } = state.quotePin;
    return {
      text,
      author,
      pinned: true,
      custom: state.quotesCustom.some((q) => q.text === text),
    };
  }
  const pool = quotePool();
  const day = new Date().getDate() + 1;
  const index =
    (((day + state.quoteOffset) % pool.length) + pool.length) % pool.length;
  const [text, author, custom] = pool[index];
  return { text, author, pinned: false, custom: !!custom };
}

function moduleMarkup(id) {
  const title = moduleNames[id];
  const handle = '<span class="drag-handle" aria-hidden="true">DRAG</span>';

  if (id === "focus") {
    return `<article class="module" data-id="focus" draggable="false">${handle}
      <p class="module-title">${title}</p>
      <p class="focus-prompt">${escapeHtml(state.focus)}</p>
      <p class="focus-note">${escapeHtml(state.focusNote)}</p>
      <input class="focus-input" id="focus-input" value="${escapeHtml(state.focus)}" aria-label="Today's focus" placeholder="What would make today feel finished?" />
      <input class="focus-note-input" id="focus-note-input" value="${escapeHtml(state.focusNote)}" aria-label="Focus note" placeholder="Add a note..." />
    </article>`;
  }

  if (id === "links") {
    return `<article class="module" data-id="links" draggable="false">${handle}
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
    return `<article class="module" data-id="now" draggable="false">${handle}
      <p class="module-title">${title}</p>
      <p class="now-copy" id="now-copy">${escapeHtml(state.now)}</p>
      <textarea class="now-input" id="now-input" aria-label="What I'm doing now" rows="3">${escapeHtml(state.now)}</textarea>
    </article>`;
  }

  if (id === "goal") {
    const LABELS = ["M", "T", "W", "T", "F", "S", "S"];
    const NAMES = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const week = weekDates();
    const today = todayKey();
    const head = state.habits.length
      ? `<div class="habit-days habit-head" aria-hidden="true">${LABELS.map((label, i) => `<span class="habit-day-label${week[i] === today ? " is-today" : ""}">${label}</span>`).join("")}</div>`
      : "";
    const rows = state.habits
      .map((habit) => {
        const dots = week
          .map((day, i) => {
            const on = habitDone(habit.id, day);
            return `<button class="habit-dot${on ? " is-filled" : ""}${day === today ? " is-today" : ""}" type="button" data-habit-id="${escapeHtml(habit.id)}" data-date="${day}" aria-pressed="${on}" aria-label="${escapeHtml(habit.name)}, ${NAMES[i]}: ${on ? "done" : "not done"}"${day > today ? " disabled" : ""}></button>`;
          })
          .join("");
        const count = week.filter((day) => habitDone(habit.id, day)).length;
        const streak = habitStreak(habit.id);
        return `<div class="habit"><div class="habit-top"><span class="habit-name">${escapeHtml(habit.name)}</span><span class="habit-meta">${count}/7${streak > 1 ? ` · ${streak} day streak` : ""}</span><button class="habit-remove" type="button" data-habit-remove="${escapeHtml(habit.id)}" aria-label="Remove habit: ${escapeHtml(habit.name)}">&times;</button></div><div class="habit-days">${dots}</div></div>`;
      })
      .join("");
    const form =
      state.habits.length < 5
        ? `<form class="habit-form" id="habit-form"><input class="field-input" id="habit-input" maxlength="24" autocomplete="off" aria-label="Add a habit" placeholder="${state.habits.length ? "Add another habit" : "Name a habit to track"}" /></form>`
        : "";
    return `<article class="module" data-id="goal" draggable="false">${handle}
      <p class="module-title">${title}</p>
      ${head}
      ${rows}
      ${form}
      ${state.habits.length ? "" : '<p class="empty-hint">Track up to 5 habits. Streaks build from today.</p>'}
    </article>`;
  }

  if (id === "tasks") {
    const items = state.tasks.items;
    const doneCount = items.filter((item) => item.done).length;
    const list = items
      .map(
        (item, i) =>
          `<li class="task-item${item.done ? " is-done" : ""}"><button class="task-check" type="button" data-task="${i}" aria-pressed="${item.done}" aria-label="${item.done ? "Mark not done" : "Mark done"}: ${escapeHtml(item.text)}"></button><span class="task-text">${escapeHtml(item.text)}</span><button class="task-remove" type="button" data-task-remove="${i}" aria-label="Remove task: ${escapeHtml(item.text)}">&times;</button></li>`,
      )
      .join("");
    const form =
      items.length < 3
        ? `<form class="task-form" id="task-form"><input class="field-input" id="task-input" maxlength="80" autocomplete="off" aria-label="Add a task" placeholder="${items.length ? "Add another task" : "What are your top 3 for today?"}" /></form>`
        : "";
    const count = items.length
      ? `<p class="task-count">${doneCount} of ${items.length} done${items.length < 3 ? "" : doneCount === 3 ? " · all clear" : ""}</p>`
      : "";
    return `<article class="module" data-id="tasks" draggable="false">${handle}
      <p class="module-title">${title}</p>
      ${items.length ? `<ul class="task-list">${list}</ul>` : ""}
      ${form}
      ${items.length ? "" : '<p class="empty-hint">Pick up to 3 things that would make today count.</p>'}
      ${count}
    </article>`;
  }

  if (id === "countdown") {
    const { label, date } = state.countdown;
    if (!date) {
      return `<article class="module" data-id="countdown" draggable="false">${handle}
        <p class="module-title">${title}</p>
        <form class="countdown-form" id="countdown-form">
          <input class="field-input" id="countdown-label" maxlength="24" autocomplete="off" aria-label="Countdown label" placeholder="What are you counting to?" />
          <input class="field-input" id="countdown-date" type="date" required aria-label="Countdown date" />
          <button class="mini-btn" type="submit">Start countdown</button>
        </form>
        <p class="empty-hint">An exam, a trip, a launch. Watch the days tick down.</p>
      </article>`;
    }
    const days = daysUntil(date);
    const [y, m, d] = date.split("-").map(Number);
    const pretty = new Intl.DateTimeFormat([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
    const big = days === 0 ? "Today" : String(Math.abs(days));
    const unit =
      days === 0
        ? ""
        : `${Math.abs(days) === 1 ? "day" : "days"} ${days > 0 ? "to go" : "ago"}`;
    return `<article class="module" data-id="countdown" draggable="false">${handle}
      <p class="module-title">${title}</p>
      <p class="countdown-number">${big}<span class="countdown-unit">${unit}</span></p>
      <p class="countdown-label">${escapeHtml(label || "Countdown")}</p>
      <p class="countdown-date">${pretty}</p>
      <button class="mini-btn" type="button" data-countdown-clear>Change</button>
    </article>`;
  }

  const quote = currentQuote();
  const cite = quote.author ? `<cite>— ${escapeHtml(quote.author)}</cite>` : "";
  const quoteForm = quoteFormOpen
    ? `<form class="quote-form" id="quote-form">
        <input class="field-input" id="quote-text" maxlength="160" required autocomplete="off" aria-label="Quote text" placeholder="Your quote" />
        <input class="field-input" id="quote-author" maxlength="30" autocomplete="off" aria-label="Quote author (optional)" placeholder="Author (optional)" />
        <button class="mini-btn" type="submit">Save quote</button>
      </form>`
    : "";
  return `<article class="module" data-id="quote" draggable="false">${handle}
    <p class="module-title">${title}</p>
    <blockquote class="module-quote">“${escapeHtml(quote.text)}”${cite}</blockquote>
    <div class="quote-actions">
      <button class="mini-btn" type="button" data-quote-action="shuffle">Shuffle</button>
      <button class="mini-btn${quote.pinned ? " is-active" : ""}" type="button" data-quote-action="pin" aria-pressed="${quote.pinned}">${quote.pinned ? "Unpin" : "Pin"}</button>
      <button class="mini-btn" type="button" data-quote-action="add" aria-expanded="${quoteFormOpen}">Add own</button>
      ${quote.custom ? '<button class="mini-btn" type="button" data-quote-action="delete">Delete</button>' : ""}
    </div>
    ${quoteForm}
  </article>`;
}

function render() {
  dashboard.innerHTML = visibleRows()
    .map(
      (row) =>
        `<div class="module-row">${row.map(moduleMarkup).join("")}</div>`,
    )
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

  // ---- Habits ----
  dashboard.querySelectorAll(".habit-dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { habitId, date } = btn.dataset;
      const ids = state.habitLog[date] || [];
      const next = ids.includes(habitId)
        ? ids.filter((id) => id !== habitId)
        : [...ids, habitId];
      if (next.length) state.habitLog[date] = next;
      else delete state.habitLog[date];
      save("Habit updated");
      render();
    });
  });
  dashboard.querySelectorAll("[data-habit-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.habitRemove;
      state.habits = state.habits.filter((h) => h.id !== id);
      Object.keys(state.habitLog).forEach((day) => {
        state.habitLog[day] = state.habitLog[day].filter((x) => x !== id);
        if (!state.habitLog[day].length) delete state.habitLog[day];
      });
      save("Habit removed");
      render();
    });
  });
  const habitForm = $("#habit-form");
  if (habitForm)
    habitForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#habit-input").value.trim().slice(0, 24);
      if (!name || state.habits.length >= 5) return;
      const id =
        "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      state.habits.push({ id, name });
      save("Habit added");
      render();
      const next = $("#habit-input");
      if (next) next.focus();
    });

  // ---- Top 3 tasks ----
  const taskForm = $("#task-form");
  if (taskForm)
    taskForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("#task-input");
      const text = input.value.trim();
      if (!text || state.tasks.items.length >= 3) return;
      if (!state.tasks.date) state.tasks.date = todayKey();
      state.tasks.items.push({ text, done: false });
      save("Task added");
      render();
      const next = $("#task-input");
      if (next) next.focus();
    });
  dashboard.querySelectorAll("[data-task]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = state.tasks.items[parseInt(btn.dataset.task, 10)];
      if (!item) return;
      item.done = !item.done;
      save(item.done ? "Task done" : "Task reopened");
      render();
    });
  });
  dashboard.querySelectorAll("[data-task-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tasks.items.splice(parseInt(btn.dataset.taskRemove, 10), 1);
      save("Task removed");
      render();
    });
  });

  // ---- Countdown ----
  const countdownForm = $("#countdown-form");
  if (countdownForm)
    countdownForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const date = $("#countdown-date").value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      state.countdown = {
        label: $("#countdown-label").value.trim().slice(0, 24),
        date,
      };
      save("Countdown set");
      render();
    });
  const countdownClear = dashboard.querySelector("[data-countdown-clear]");
  if (countdownClear)
    countdownClear.addEventListener("click", () => {
      state.countdown = { label: "", date: "" };
      save("Countdown cleared");
      render();
      const label = $("#countdown-label");
      if (label) label.focus();
    });

  // ---- Quote ----
  dashboard.querySelectorAll("[data-quote-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.quoteAction;
      const current = currentQuote();
      if (action === "shuffle") {
        state.quotePin = null;
        state.quoteOffset += 1;
        save("Quote shuffled");
      } else if (action === "pin") {
        state.quotePin = current.pinned
          ? null
          : { text: current.text, author: current.author };
        save(current.pinned ? "Quote unpinned" : "Quote pinned");
      } else if (action === "delete") {
        state.quotesCustom = state.quotesCustom.filter(
          (q) => q.text !== current.text,
        );
        if (state.quotePin && state.quotePin.text === current.text)
          state.quotePin = null;
        save("Quote deleted");
      } else if (action === "add") {
        quoteFormOpen = !quoteFormOpen;
        render();
        const field = $("#quote-text");
        if (field) field.focus();
        return;
      }
      render();
    });
  });
  const quoteFormEl = $("#quote-form");
  if (quoteFormEl)
    quoteFormEl.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = $("#quote-text").value.trim().slice(0, 160);
      const author = $("#quote-author").value.trim().slice(0, 30);
      if (!text || state.quotesCustom.length >= 50) return;
      state.quotesCustom.push({ text, author });
      // Show the new quote right away.
      state.quotePin = null;
      const poolSize = quotePool().length;
      const day = new Date().getDate() + 1;
      state.quoteOffset =
        (((poolSize - 1 - day) % poolSize) + poolSize) % poolSize;
      quoteFormOpen = false;
      save("Quote added");
      render();
    });

  const ZONES = [
    "drop-left",
    "drop-right",
    "drop-top",
    "drop-bottom",
    "drop-swap",
  ];
  const clearTargets = () =>
    dashboard
      .querySelectorAll(ZONES.map((z) => "." + z).join(","))
      .forEach((el) => el.classList.remove(...ZONES));
  dashboard.querySelectorAll(".module").forEach((module) => {
    // Only the DRAG handle starts a drag, so typing and selecting text still work.
    const handle = module.querySelector(".drag-handle");
    if (handle)
      handle.addEventListener("pointerdown", () =>
        module.setAttribute("draggable", "true"),
      );
    module.addEventListener("dragstart", (event) => {
      draggedId = module.dataset.id;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedId);
      }
      module.classList.add("dragging");
    });
    module.addEventListener("dragend", () => {
      draggedId = null;
      module.setAttribute("draggable", "false");
      module.classList.remove("dragging");
      clearTargets();
    });
    module.addEventListener("dragover", (event) => {
      if (!draggedId) return;
      const zone = dropZone(event, module);
      module.classList.remove(...ZONES);
      const mode = dropMode(draggedId, module.dataset.id, zone);
      if (!mode) return;
      event.preventDefault();
      module.classList.add(mode === "swap" ? "drop-swap" : "drop-" + zone);
    });
    module.addEventListener("dragleave", (event) => {
      if (!module.contains(event.relatedTarget))
        module.classList.remove(...ZONES);
    });
    module.addEventListener("drop", (event) => {
      event.preventDefault();
      clearTargets();
      const zone = dropZone(event, module);
      const mode = dropMode(draggedId, module.dataset.id, zone);
      if (!mode) return;
      if (mode === "swap") swapCards(draggedId, module.dataset.id);
      else moveCard(draggedId, module.dataset.id, zone);
      save(mode === "swap" ? "Cards swapped" : "Layout updated");
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

// A press on the DRAG handle arms dragging; if no drag follows, disarm it.
document.addEventListener("pointerup", () => {
  dashboard
    .querySelectorAll('.module[draggable="true"]')
    .forEach((m) => m.setAttribute("draggable", "false"));
});

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
  state.order = state.rows.flat();
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

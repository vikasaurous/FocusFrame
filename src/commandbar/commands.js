/**
 * commands.js
 *
 * Pure logic for the FocusFrame command bar. No DOM. Testable in Node.
 * Exposes window.FFCommands in the browser, module.exports in Node.
 *
 * A command = { id, label, aliases[], group, template, homeUrl, supportsPrefill, builtin }
 *   template  URL with one {query} placeholder (or plain URL if no prefill)
 *   homeUrl   where to go when there is no query, or when prefill is impossible
 *
 * IMPORTANT: providers change URL params without notice. Test each built-in
 * by hand now and then. Users can disable built-ins and (later) add custom
 * templates, so a broken param never needs an extension update.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.FFCommands = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PLACEHOLDER = "{query}";
  var MAX_URL_LENGTH = 1900; // beyond this, fall back to clipboard

  var BUILTINS = [
    {
      id: "wikipedia",
      label: "Wikipedia",
      aliases: ["wikipedia", "wiki", "w"],
      group: "search",
      template: "https://en.wikipedia.org/w/index.php?search={query}",
      homeUrl: "https://en.wikipedia.org/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "reddit",
      label: "Reddit",
      aliases: ["reddit", "r"],
      group: "search",
      template: "https://www.reddit.com/search/?q={query}",
      homeUrl: "https://www.reddit.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "github",
      label: "GitHub",
      aliases: ["github", "gh"],
      group: "search",
      template: "https://github.com/search?q={query}",
      homeUrl: "https://github.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "stackoverflow",
      label: "Stack Overflow",
      aliases: ["stackoverflow", "so"],
      group: "search",
      template: "https://stackoverflow.com/search?q={query}",
      homeUrl: "https://stackoverflow.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "maps",
      label: "Google Maps",
      aliases: ["maps", "map"],
      group: "search",
      template: "https://www.google.com/maps/search/?api=1&query={query}",
      homeUrl: "https://www.google.com/maps",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "images",
      label: "Google Images",
      aliases: ["images", "img"],
      group: "search",
      template: "https://www.google.com/search?tbm=isch&q={query}",
      homeUrl: "https://www.google.com/imghp",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "translate",
      label: "Google Translate",
      aliases: ["translate", "tr"],
      group: "search",
      template:
        "https://translate.google.com/?sl=auto&tl=en&text={query}&op=translate",
      homeUrl: "https://translate.google.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "spotify",
      label: "Spotify",
      aliases: ["spotify", "sp"],
      group: "search",
      template: "https://open.spotify.com/search/{query}",
      homeUrl: "https://open.spotify.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "amazon",
      label: "Amazon",
      aliases: ["amazon", "az"],
      group: "search",
      template: "https://www.amazon.in/s?k={query}",
      homeUrl: "https://www.amazon.in/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      aliases: ["chatgpt", "gpt"],
      group: "ask",
      template: "https://chatgpt.com/?q={query}",
      homeUrl: "https://chatgpt.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "claude",
      label: "Claude",
      aliases: ["claude", "c"],
      group: "ask",
      template: "https://claude.ai/new?q={query}",
      homeUrl: "https://claude.ai/new",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "gemini",
      label: "Gemini",
      aliases: ["gemini", "gem"],
      group: "ask",
      template: "https://gemini.google.com/app",
      homeUrl: "https://gemini.google.com/app",
      supportsPrefill: false,
      builtin: true,
    }, // no known working URL prefill: clipboard fallback
    {
      id: "perplexity",
      label: "Perplexity",
      aliases: ["perplexity", "pplx"],
      group: "ask",
      template: "https://www.perplexity.ai/search?q={query}",
      homeUrl: "https://www.perplexity.ai/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "grok",
      label: "Grok",
      aliases: ["grok"],
      group: "ask",
      template: "https://grok.com/?q={query}",
      homeUrl: "https://grok.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "google",
      label: "Google",
      aliases: ["google"],
      group: "search",
      template: "https://www.google.com/search?q={query}",
      homeUrl: "https://www.google.com/",
      supportsPrefill: true,
      builtin: true,
    },
    {
      id: "youtube",
      label: "YouTube",
      aliases: ["youtube", "yt"],
      group: "search",
      template: "https://www.youtube.com/results?search_query={query}",
      homeUrl: "https://www.youtube.com/",
      supportsPrefill: true,
      builtin: true,
    },
  ];

  var DEFAULT_SETTINGS = {
    enabled: true,
    defaultCommandId: "chatgpt",
    openIn: "same", // 'same' | 'new'
    disabledIds: [],
    customCommands: [], // [{ id, label, aliases[], template }]  (UI comes later)
    shortcut: { mod: false, alt: true, shift: false, code: "KeyK" }, // Alt + K
  };

  // ---- URL safety --------------------------------------------------

  function _parse(u) {
    try {
      return new URL(u);
    } catch (e) {
      return null;
    }
  }

  /** https only, no embedded credentials (blocks https://user@evil.com tricks). */
  function isSafeUrl(url) {
    var u = _parse(url);
    return (
      !!u &&
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !!u.hostname
    );
  }

  function hasPlaceholder(t) {
    if (typeof t !== "string") return false;
    return t.split(PLACEHOLDER).length === 2; // exactly one
  }

  /** Valid custom template: one {query}, https, safe once filled in. */
  function validateTemplate(t) {
    if (!hasPlaceholder(t)) return false;
    return isSafeUrl(t.replace(PLACEHOLDER, "x"));
  }

  function domainOf(cmd) {
    var u = _parse(cmd && (cmd.homeUrl || cmd.template));
    return u ? u.hostname.replace(/^www\./, "") : "";
  }

  // ---- Building the destination ------------------------------------

  /**
   * buildUrl(cmd, query) -> { url, copyText, reason }
   *   copyText non-null means: copy it to the clipboard, because the URL
   *   cannot carry the text (no prefill support, or query too long).
   */
  function buildUrl(cmd, query) {
    var q = String(query == null ? "" : query).trim();
    var home = cmd.homeUrl || cmd.template;
    if (!q) return { url: home, copyText: null, reason: "empty" };

    if (cmd.supportsPrefill && hasPlaceholder(cmd.template)) {
      var enc = encodeURIComponent(q);
      var url = cmd.template.replace(PLACEHOLDER, function () {
        return enc;
      });
      if (url.length <= MAX_URL_LENGTH)
        return { url: url, copyText: null, reason: "prefill" };
      return { url: home, copyText: q, reason: "too-long" };
    }
    return { url: home, copyText: q, reason: "no-prefill" };
  }

  // ---- Command list ------------------------------------------------

  function _cleanAlias(a) {
    return String(a || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
  }

  /** Built-ins minus disabled, plus valid custom commands. Aliases are unique (first wins). */
  function getCommands(settings) {
    var s = settings || DEFAULT_SETTINGS;
    var disabled = Array.isArray(s.disabledIds) ? s.disabledIds : [];
    var out = [];
    var i;
    for (i = 0; i < BUILTINS.length; i++) {
      if (disabled.indexOf(BUILTINS[i].id) === -1) out.push(copy(BUILTINS[i]));
    }
    var customs = Array.isArray(s.customCommands) ? s.customCommands : [];
    for (i = 0; i < customs.length; i++) {
      var c = customs[i];
      if (!c || !c.id || !c.label || !validateTemplate(c.template)) continue;
      var u = _parse(c.template.replace(PLACEHOLDER, "x"));
      out.push({
        id: String(c.id),
        label: String(c.label).slice(0, 24),
        aliases: (c.aliases || []).map(_cleanAlias).filter(Boolean),
        group: "custom",
        template: c.template,
        homeUrl: u.origin + "/",
        supportsPrefill: true,
        builtin: false,
      });
    }
    // unique aliases
    var seen = {};
    for (i = 0; i < out.length; i++) {
      var keep = [];
      for (var j = 0; j < out[i].aliases.length; j++) {
        var al = out[i].aliases[j];
        if (!seen[al]) {
          seen[al] = true;
          keep.push(al);
        }
      }
      out[i].aliases = keep;
    }
    return out;
  }

  function copy(o) {
    return {
      id: o.id,
      label: o.label,
      aliases: o.aliases.slice(),
      group: o.group,
      template: o.template,
      homeUrl: o.homeUrl,
      supportsPrefill: o.supportsPrefill,
      builtin: o.builtin,
    };
  }

  function findById(commands, id) {
    for (var i = 0; i < commands.length; i++)
      if (commands[i].id === id) return commands[i];
    return null;
  }

  function findByAlias(commands, token) {
    var t = _cleanAlias(token);
    if (!t) return null;
    for (var i = 0; i < commands.length; i++) {
      if (commands[i].aliases.indexOf(t) !== -1) return commands[i];
    }
    return null;
  }

  /** Commands matching a typed token: alias/label prefix first, then substring. */
  function filterCommands(commands, token) {
    var t = String(token || "").toLowerCase();
    if (!t) return commands.slice();
    var starts = [],
      contains = [];
    for (var i = 0; i < commands.length; i++) {
      var c = commands[i];
      var hay = c.aliases.concat([c.label.toLowerCase()]);
      var s = false,
        m = false;
      for (var j = 0; j < hay.length; j++) {
        if (hay[j].indexOf(t) === 0) s = true;
        else if (hay[j].indexOf(t) !== -1) m = true;
      }
      if (s) starts.push(c);
      else if (m) contains.push(c);
    }
    return starts.concat(contains);
  }

  /** "/claude hello world" -> { command, rest: "hello world" }, else null. */
  function parseLeadingCommand(raw, commands) {
    var m = /^\/(\S+)\s([\s\S]*)$/.exec(String(raw || ""));
    if (!m) return null;
    var cmd = findByAlias(commands, m[1]);
    return cmd ? { command: cmd, rest: m[2] } : null;
  }

  // ---- Open shortcut -------------------------------------------------------

  // Allowed: Ctrl/Cmd + a punctuation key, or Alt + a letter. Everything else is
  // already used by Chrome or the OS (Ctrl+letter, Ctrl+Shift+..., Alt+F/E/D, ...).
  var PUNCT_CODES = [
    "Slash",
    "Period",
    "Comma",
    "Semicolon",
    "Quote",
    "Backquote",
    "Backslash",
  ];
  var ALT_BLOCKED = ["KeyF", "KeyE", "KeyD"];
  var CODE_LABELS = {
    Slash: "/",
    Period: ".",
    Comma: ",",
    Semicolon: ";",
    Quote: "'",
    Backquote: "`",
    Backslash: "\\",
  };

  /** -> { ok: true } or { ok: false, reason } */
  function validateShortcut(sc) {
    if (!sc || typeof sc.code !== "string" || !sc.code)
      return { ok: false, reason: "Not a valid shortcut." };
    var mod = !!sc.mod,
      alt = !!sc.alt,
      shift = !!sc.shift;
    if (!mod && !alt)
      return {
        ok: false,
        reason: "Hold Ctrl (Cmd) or Alt together with a key.",
      };
    if (mod && alt)
      return {
        ok: false,
        reason:
          "Ctrl+Alt can type characters on some keyboards. Use Ctrl or Alt, not both.",
      };
    if (shift)
      return {
        ok: false,
        reason:
          "Shift combos are mostly used by the browser. Try Ctrl + / or Alt + a letter.",
      };
    if (mod) {
      if (PUNCT_CODES.indexOf(sc.code) === -1) {
        return {
          ok: false,
          reason:
            "Ctrl + letter or number is used by the browser. Try Ctrl + / (or . , ; ').",
        };
      }
      return { ok: true };
    }
    if (!/^Key[A-Z]$/.test(sc.code))
      return { ok: false, reason: "With Alt, use a letter key." };
    if (ALT_BLOCKED.indexOf(sc.code) !== -1)
      return { ok: false, reason: "Alt + F, E and D are used by the browser." };
    return { ok: true };
  }

  /** Keyboard event -> shortcut object. Layout-independent (uses e.code). */
  function shortcutFromEvent(e) {
    return {
      mod: !!(e.ctrlKey || e.metaKey),
      alt: !!e.altKey,
      shift: !!e.shiftKey,
      code: String(e.code || ""),
    };
  }

  function matchShortcut(e, sc) {
    if (!sc) return false;
    return (
      e.code === sc.code &&
      !!(e.ctrlKey || e.metaKey) === !!sc.mod &&
      !!e.altKey === !!sc.alt &&
      !!e.shiftKey === !!sc.shift
    );
  }

  /** "Ctrl + /" on Windows/Linux, "⌘ /" on Mac. */
  function formatShortcut(sc, isMac) {
    if (!sc) return "";
    var key =
      CODE_LABELS[sc.code] ||
      String(sc.code)
        .replace(/^Key/, "")
        .replace(/^Digit/, "");
    var parts = [];
    if (sc.mod) parts.push(isMac ? "⌘" : "Ctrl");
    if (sc.alt) parts.push(isMac ? "⌥" : "Alt");
    if (sc.shift) parts.push(isMac ? "⇧" : "Shift");
    parts.push(key);
    return parts.join(isMac ? " " : " + ");
  }

  /** Merge saved settings over defaults; fix bad types. */
  function mergeSettings(saved) {
    var s = saved && typeof saved === "object" ? saved : {};
    // Migrate: the old default (Ctrl/Cmd + /) is replaced by the new default.
    var old = s.shortcut;
    if (old && old.code === "Slash" && old.mod && !old.alt && !old.shift) {
      s = Object.assign({}, s, { shortcut: null });
    }
    return {
      enabled: s.enabled !== false,
      defaultCommandId:
        typeof s.defaultCommandId === "string"
          ? s.defaultCommandId
          : DEFAULT_SETTINGS.defaultCommandId,
      openIn: s.openIn === "new" ? "new" : "same",
      disabledIds: Array.isArray(s.disabledIds) ? s.disabledIds.slice() : [],
      customCommands: Array.isArray(s.customCommands)
        ? s.customCommands.slice()
        : [],
      shortcut:
        s.shortcut && validateShortcut(s.shortcut).ok
          ? {
              mod: !!s.shortcut.mod,
              alt: !!s.shortcut.alt,
              shift: !!s.shortcut.shift,
              code: s.shortcut.code,
            }
          : {
              mod: DEFAULT_SETTINGS.shortcut.mod,
              alt: DEFAULT_SETTINGS.shortcut.alt,
              shift: DEFAULT_SETTINGS.shortcut.shift,
              code: DEFAULT_SETTINGS.shortcut.code,
            },
    };
  }

  return {
    BUILTINS: BUILTINS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    MAX_URL_LENGTH: MAX_URL_LENGTH,
    isSafeUrl: isSafeUrl,
    hasPlaceholder: hasPlaceholder,
    validateTemplate: validateTemplate,
    domainOf: domainOf,
    buildUrl: buildUrl,
    getCommands: getCommands,
    findById: findById,
    findByAlias: findByAlias,
    filterCommands: filterCommands,
    parseLeadingCommand: parseLeadingCommand,
    mergeSettings: mergeSettings,
    validateShortcut: validateShortcut,
    shortcutFromEvent: shortcutFromEvent,
    matchShortcut: matchShortcut,
    formatShortcut: formatShortcut,
  };
});

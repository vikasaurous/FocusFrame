/**
 * commandBar.js  (v3: minimal)
 *
 * One input box that slides up from the bottom. Type a prompt, press Enter,
 * and it opens your chosen AI site with the text filled in.
 * Load order: commands.js, ripple.js (optional), commandBar.js.
 *
 * Open:   Alt + K by default. Change it in Customize > Command bar.
 * Switch: type "/" then a name (/claude, /gemini, ...). Tab or Enter picks it.
 * Send:   Enter = same tab, Ctrl/Cmd+Enter = new tab, Shift+Enter = newline, Esc = close.
 *
 * Open/close are CSS transitions on the .cb-open class. The ocean-wave effect
 * (ripple.js) plays on open and is skipped when reduced motion is on.
 *
 * API
 *   CommandBar.init({ settings, onChange(settings), navigate(url, {newTab}) })
 *   CommandBar.setSettings(settings)
 *   CommandBar.open() / close() / isOpen() / destroy()
 *
 * Privacy: nothing is stored or sent except on Enter, and then only to the
 * destination named in the footer of the box.
 */
(function (root, factory) {
  root.CommandBar = factory(root.FFCommands, root.FFRipple);
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (FFCommands, FFRipple) {
    "use strict";

    var DEFAULT_SETTINGS = FFCommands
      ? FFCommands.mergeSettings(null)
      : { enabled: false };
    var TOAST_MS = 4500;
    var IS_MAC =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/.test(navigator.platform || "");
    var MOD = IS_MAC ? "⌘" : "Ctrl";
    var GROUP_LABELS = { ask: "Ask AI", search: "Search", custom: "Custom" };
    // App logos. Every command gets the same dark round badge with its logo in
    // brand colors. These are built-in drawings (no network, no extra files).
    // Run tools/fetch-logos.mjs once to swap in the official artwork: files in
    // icons/brands/ (listed in icons/brands/index.json) win over these drawings.
    // Commands without a logo (custom ones) show their first letter.
    var BRAND_GLYPHS = {
      chatgpt:
        '<g fill="none" stroke="#fff" stroke-width="1.7"><rect x="9.6" y="0.9" width="4.8" height="11.8" rx="2.4" transform="rotate(0 12 12)"/><rect x="9.6" y="0.9" width="4.8" height="11.8" rx="2.4" transform="rotate(60 12 12)"/><rect x="9.6" y="0.9" width="4.8" height="11.8" rx="2.4" transform="rotate(120 12 12)"/><rect x="9.6" y="0.9" width="4.8" height="11.8" rx="2.4" transform="rotate(180 12 12)"/><rect x="9.6" y="0.9" width="4.8" height="11.8" rx="2.4" transform="rotate(240 12 12)"/><rect x="9.6" y="0.9" width="4.8" height="11.8" rx="2.4" transform="rotate(300 12 12)"/></g>',
      claude:
        '<path d="M12 9L12 0.6M13.5 9.4L16.3 4.55M14.6 10.5L21.18 6.7M15 12L20.2 12M14.6 13.5L21.7 17.6M13.5 14.6L16.4 19.62M12 15L12 22.8M10.5 14.6L7.8 19.27M9.4 13.5L2.21 17.65M9 12L3.3 12M9.4 10.5L2.91 6.75M10.5 9.4L7.85 4.81" stroke="#D97757" stroke-width="2.7" stroke-linecap="round" fill="none"/>',
      gemini:
        '<path fill="url(#cb-grad-gemini)" d="M12 0C12 6.63 17.37 12 24 12C17.37 12 12 17.37 12 24C12 17.37 6.63 12 0 12C6.63 12 12 6.63 12 0Z"/>',
      perplexity:
        '<g fill="none" stroke="#20B8CD" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M12 1.5 21 6.8v10.4L12 22.5 3 17.2V6.8z"/><path d="M12 1.5V22.5M3 6.8 12 12l9-5.2M3 17.2 12 12l9 5.2" stroke-width="1.35"/></g>',
      grok: '<g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="10.6" cy="13.4" r="7.2"/><path d="M8 19.6 21.6 3.4"/></g>',
      google:
        '<path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>',
      ddg: '<circle cx="12" cy="12" r="11.5" fill="#DE5833"/><circle cx="11.4" cy="11.2" r="6.9" fill="#fff"/><circle cx="9.6" cy="9.3" r="1.2" fill="#2D4F8E"/><path d="M14.6 10.2 19.6 11.8 15 13.9z" fill="#FDD20A"/><path d="M7.8 15.6c1.7 1.3 3.9 1.4 5.6.2" fill="none" stroke="#65BC46" stroke-width="1.4" stroke-linecap="round"/>',
      youtube:
        '<rect x=".6" y="4" width="22.8" height="16" rx="4.8" fill="#FF0000"/><path d="M9.7 8.5v7L15.9 12z" fill="#fff"/>',
      reddit:
        '<circle cx="12" cy="12" r="11.5" fill="#FF4500"/><ellipse cx="12" cy="13.8" rx="6.6" ry="4.6" fill="#fff"/><circle cx="5.9" cy="11.8" r="1.7" fill="#fff"/><circle cx="18.1" cy="11.8" r="1.7" fill="#fff"/><circle cx="9.6" cy="13.3" r="1.15" fill="#FF4500"/><circle cx="14.4" cy="13.3" r="1.15" fill="#FF4500"/><path d="M9.5 16.1c1.5 1.1 3.5 1.1 5 0" fill="none" stroke="#FF4500" stroke-width="1" stroke-linecap="round"/><path d="M12 9.2l1.1-3.6 2.8.7" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16.6" cy="6.5" r="1.3" fill="#fff"/>',
      wikipedia:
        '<path d="M1 5.2h6M16.5 5.2h6.2M4.4 5.4 9 18.6 12.2 9.4l3.2 9.2L19.6 5.4M10.2 5.4h3" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
      github:
        '<path fill="#fff" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>',
      stackoverflow:
        '<path fill="#F48024" d="M15.725 0l-1.72 1.277 6.39 8.588 1.716-1.277L15.725 0zm-3.94 3.418l-1.369 1.644 8.225 6.85 1.369-1.644-8.225-6.85zm-3.15 4.465l-.905 1.94 9.702 4.517.904-1.94-9.701-4.517zm-1.85 4.86l-.44 2.093 10.473 2.201.44-2.092-10.473-2.203zM1.89 15.47V24h19.19v-8.53h-2.133v6.397H4.021v-6.396H1.89zm4.265 2.133v2.13h10.66v-2.13H6.154Z"/>',
      maps: '<path fill="#EA4335" d="M12 .8C7.3.8 3.6 4.5 3.6 9.1c0 6 8.4 14.1 8.4 14.1s8.4-8.1 8.4-14.1C20.4 4.5 16.7.8 12 .8z"/><circle cx="12" cy="9.1" r="3.3" fill="#fff"/>',
      images:
        '<rect x="1.8" y="3.4" width="20.4" height="17.2" rx="3" fill="none" stroke="#4285F4" stroke-width="1.9"/><path d="M3.2 18.6 9 11.4l3.8 4.4 2.6-3 5.4 5.8z" fill="#34A853"/><circle cx="16.6" cy="8.6" r="2" fill="#FBBC05"/>',
      translate:
        '<rect x="1" y="1" width="22" height="22" rx="4.5" fill="#4285F4"/><path d="M6 17.4 9.6 7.2h1.2l3.6 10.2M7.5 13.6h5.4" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.6 11.2h4.6M16.9 9.2v2c0 2.2-1 3.8-2.6 5M15.4 13.4c.6 1.6 1.8 2.7 3.4 3.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>',
      spotify:
        '<path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>',
      amazon:
        '<path d="M2.4 16.2c5 3.6 13.2 3.9 19-.3" fill="none" stroke="#FF9900" stroke-width="2.1" stroke-linecap="round"/><path d="M17.6 13.2l4.4 2.3-1.2 4.2" fill="none" stroke="#FF9900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10.8" cy="9" r="4" fill="none" stroke="#fff" stroke-width="2"/><path d="M14.8 5.2v7.4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
      flipkart:
        '<path d="M3.5 6.2h17l-1.3 15.3H4.8z" fill="#2874F0"/><path d="M8.3 6.2C8.3 3.8 9.9 2.3 12 2.3s3.7 1.5 3.7 3.9" fill="none" stroke="#2874F0" stroke-width="1.7" stroke-linecap="round"/><path d="M9.6 18.3V9.6h5.6v1.9h-3.5v1.7h3v1.8h-3v3.3z" fill="#FFE11B"/>',
      x: '<path fill="#fff" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>',
      imdb: '<rect x=".6" y="5" width="22.8" height="14" rx="2.6" fill="#F5C518"/><text x="12" y="15.7" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="8.6" fill="#000">IMDb</text>',
      mdn: '<path d="M2 18V7.4l4.6 6.2 4.6-6.2V18M14.4 18V6h3.4c3 0 4.7 2.4 4.7 6s-1.7 6-4.7 6z" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
      npm: '<rect x="1" y="1" width="22" height="22" rx="2.2" fill="#CB3837"/><path d="M5.2 5.2h13.6v13.6h-3.4V8.6h-3.4v10.2H5.2z" fill="#fff"/>',
    };
    var _realLogos = {}; // ids that have an official file in icons/brands/
    // Shared gradient for the Gemini logo. Lives outside any hidden element so it always renders.
    var ICON_DEFS =
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="cb-grad-gemini" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4285F4"/><stop offset=".55" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs></svg>';

    var _settings = null;
    var _commands = [];
    var _onChange = null;
    var _navigate = null;

    var _root,
      _panel,
      _input,
      _destEl,
      _listEl,
      _hintEl,
      _toastEl,
      _liveEl,
      _water,
      _box,
      _sendBtn;
    var _settingsSection = null;
    var _enabledBox, _defaultSelect, _openInSelect, _keyBtn, _keyMsg;

    var _open = false;
    var _chip = null; // command picked with /name, or null (then the default is used)
    var _items = []; // commands shown in the slash list
    var _active = 0;
    var _returnFocus = null;
    var _toastTimer = null;
    var _capturing = false; // true while the user is recording a new shortcut
    var _ready = false;

    // ---- Helpers ---------------------------------------------------------------

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }

    function reducedMotion() {
      return !!(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }

    function _defaultCommand() {
      return (
        FFCommands.findById(_commands, _settings.defaultCommandId) ||
        _commands[0] ||
        null
      );
    }
    function _current() {
      return _chip || _defaultCommand();
    }
    function _recompute() {
      _commands = FFCommands.getCommands(_settings);
    }
    function _commit() {
      if (typeof _onChange === "function")
        _onChange(JSON.parse(JSON.stringify(_settings)));
    }
    function _shortcutText() {
      return FFCommands.formatShortcut(_settings.shortcut, IS_MAC);
    }

    // ---- Build DOM ---------------------------------------------------------------

    function _build() {
      _root = el("div", "cb-root");
      _root.inert = true; // closed: not focusable

      var scrim = el("div", "cb-scrim");
      scrim.addEventListener("mousedown", function (e) {
        e.preventDefault();
        close();
      });

      _water = el("canvas", "cb-water");
      _water.setAttribute("aria-hidden", "true");

      _panel = el("div", "cb-panel");
      _panel.setAttribute("role", "dialog");
      _panel.setAttribute("aria-modal", "true");
      _panel.setAttribute("aria-label", "Command bar");

      _listEl = el("ul", "cb-list");
      _listEl.id = "cb-listbox";
      _listEl.setAttribute("role", "listbox");
      _listEl.setAttribute("aria-label", "Destinations");
      _listEl.hidden = true;

      _box = el("div", "cb-box");
      var main = el("div", "cb-main");

      // Destination pill: shows where Enter will send. Click it to switch.
      _destEl = el("button", "cb-dest");
      _destEl.type = "button";
      _destEl.addEventListener("mousedown", function (e) {
        e.preventDefault(); // keep the cursor in the text box
      });
      _destEl.addEventListener("click", _onDestClick);

      _input = el("textarea", "cb-input");
      _input.rows = 1;
      _input.spellcheck = true;
      _input.autocomplete = "off";
      _input.setAttribute("role", "combobox");
      _input.setAttribute("aria-autocomplete", "list");
      _input.setAttribute("aria-controls", "cb-listbox");
      _input.setAttribute("aria-expanded", "false");
      _input.setAttribute("aria-label", "Command bar input");

      _sendBtn = el("button", "cb-send");
      _sendBtn.type = "button";
      _sendBtn.setAttribute("aria-label", "Send");
      _sendBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
      _sendBtn.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      _sendBtn.addEventListener("click", function (e) {
        _submit(e.ctrlKey || e.metaKey);
      });

      main.appendChild(_destEl);
      main.appendChild(_input);
      main.appendChild(_sendBtn);

      // Footer inside the box: key hints on the left, where it goes on the right.
      _hintEl = el("div", "cb-foot");
      _box.appendChild(main);
      _box.appendChild(_hintEl);

      _liveEl = el("p", "sr-only");
      _liveEl.setAttribute("aria-live", "polite");

      _panel.appendChild(_listEl);
      _panel.appendChild(_box);
      _panel.appendChild(_liveEl);

      var defs = el("div", "cb-defs");
      defs.innerHTML = ICON_DEFS;
      _root.appendChild(defs);
      _root.appendChild(scrim);
      _root.appendChild(_water);
      _root.appendChild(_panel);
      document.body.appendChild(_root);

      _toastEl = el("div", "cb-toast");
      _toastEl.hidden = true;
      _toastEl.setAttribute("role", "status");
      document.body.appendChild(_toastEl);

      _input.addEventListener("input", _onInput);
      _input.addEventListener("keydown", _onInputKeydown);
      document.addEventListener("keydown", _onDocKeydown);
      document.addEventListener("keydown", _onCaptureKey, true); // capture phase
    }

    // ---- Settings section (in the Customize panel) ---------------------------------

    function _buildSettings() {
      var editor = document.getElementById("editor");
      if (!editor) return;
      var anchor = document.getElementById("reset-button");

      _settingsSection = el("div", "editor-section");
      _settingsSection.id = "commandbar-section";
      _settingsSection.appendChild(el("h2", null, "Command bar"));

      var toggleRow = el("label", "toggle-row");
      var toggleText = el("span", null, "Enable command bar");
      toggleText.id = "cb-enabled-label";
      _enabledBox = el("input");
      _enabledBox.type = "checkbox";
      _enabledBox.setAttribute("aria-labelledby", "cb-enabled-label");
      _enabledBox.addEventListener("change", function () {
        _settings.enabled = _enabledBox.checked;
        if (!_settings.enabled && _open) close();
        _commit();
      });
      toggleRow.appendChild(toggleText);
      toggleRow.appendChild(_enabledBox);

      // Shortcut recorder
      var fKey = el("div", "cb-field");
      fKey.appendChild(el("span", null, "Open shortcut"));
      _keyBtn = el("button", "cb-keybtn");
      _keyBtn.type = "button";
      _keyBtn.setAttribute("aria-label", "Change open shortcut");
      _keyBtn.addEventListener("click", _startCapture);
      _keyBtn.addEventListener("blur", function () {
        if (_capturing) _stopCapture();
      });
      fKey.appendChild(_keyBtn);
      _keyMsg = el("p", "cb-note");
      _keyMsg.setAttribute("role", "status");
      _keyMsg.hidden = true;

      var f1 = el("label", "cb-field");
      f1.appendChild(el("span", null, "Default destination"));
      _defaultSelect = el("select", "cb-select");
      _defaultSelect.addEventListener("change", function () {
        _settings.defaultCommandId = _defaultSelect.value;
        _commit();
        _renderCurrent();
      });
      f1.appendChild(_defaultSelect);

      var f2 = el("label", "cb-field");
      f2.appendChild(el("span", null, "Open results in"));
      _openInSelect = el("select", "cb-select");
      [
        ["same", "Same tab"],
        ["new", "New tab"],
      ].forEach(function (o) {
        var opt = el("option", null, o[1]);
        opt.value = o[0];
        _openInSelect.appendChild(opt);
      });
      _openInSelect.addEventListener("change", function () {
        _settings.openIn = _openInSelect.value === "new" ? "new" : "same";
        _commit();
      });
      f2.appendChild(_openInSelect);

      var note = el(
        "p",
        "cb-note",
        "Your text is sent only to the site named under the box, and only when you press Enter.",
      );

      _settingsSection.appendChild(toggleRow);
      _settingsSection.appendChild(fKey);
      _settingsSection.appendChild(_keyMsg);
      _settingsSection.appendChild(f1);
      _settingsSection.appendChild(f2);
      _settingsSection.appendChild(note);

      if (anchor && anchor.parentNode === editor)
        editor.insertBefore(_settingsSection, anchor);
      else editor.appendChild(_settingsSection);
    }

    function _syncSettingsUi() {
      if (!_settingsSection) return;
      _enabledBox.checked = !!_settings.enabled;
      _openInSelect.value = _settings.openIn;
      if (!_capturing) _keyBtn.textContent = _shortcutText();
      while (_defaultSelect.firstChild)
        _defaultSelect.removeChild(_defaultSelect.firstChild);
      _commands.forEach(function (c) {
        var opt = el("option", null, c.label);
        opt.value = c.id;
        _defaultSelect.appendChild(opt);
      });
      var def = _defaultCommand();
      if (def) _defaultSelect.value = def.id;
    }

    // ---- Shortcut recording ------------------------------------------------------------

    function _startCapture() {
      _capturing = true;
      _keyBtn.textContent = "Press keys…";
      _keyBtn.classList.add("is-recording");
      _keyMsg.hidden = false;
      _keyMsg.textContent =
        "Hold Ctrl (Cmd) or Alt and press a key. Esc cancels.";
    }

    function _stopCapture() {
      _capturing = false;
      _keyBtn.classList.remove("is-recording");
      _keyBtn.textContent = _shortcutText();
      _keyMsg.hidden = true;
    }

    function _onCaptureKey(e) {
      if (!_capturing) return;
      if (["Control", "Alt", "Shift", "Meta"].indexOf(e.key) !== -1) return; // wait for the real key
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        _stopCapture();
        return;
      }
      var sc = FFCommands.shortcutFromEvent(e);
      var v = FFCommands.validateShortcut(sc);
      if (!v.ok) {
        _keyMsg.hidden = false;
        _keyMsg.textContent = v.reason;
        return;
      } // keep recording
      _settings.shortcut = sc;
      _commit();
      _stopCapture();
    }

    // ---- Destination label, placeholder, hint -----------------------------------------

    function _placeholderFor(cmd) {
      if (!cmd) return "Type here";
      if (cmd.group === "ask") return "Ask " + cmd.label + " anything…";
      return "Search " + cmd.label + "…";
    }

    // Logo if we have one for this command, otherwise its first letter.
    function _badge(cmd) {
      var id = cmd.id;
      if (cmd.builtin && (_realLogos[id] || BRAND_GLYPHS[id])) {
        var b = el("span", "cb-badge has-logo");
        if (_realLogos[id]) {
          var img = document.createElement("img");
          img.src = "icons/brands/" + id + ".svg";
          img.alt = "";
          img.draggable = false;
          b.appendChild(img);
        } else {
          b.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            BRAND_GLYPHS[id] + // static strings from this file only
            "</svg>";
        }
        return b;
      }
      return el("span", "cb-badge", cmd.label.charAt(0).toUpperCase());
    }

    // Official logo files are optional. icons/brands/index.json lists the ones present.
    function _loadRealLogos() {
      if (typeof fetch !== "function") return;
      fetch("icons/brands/index.json")
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (ids) {
          if (!Array.isArray(ids)) return;
          ids.forEach(function (i) {
            if (/^[a-z0-9_-]+$/.test(i)) _realLogos[i] = true;
          });
          if (_ready) _renderCurrent();
        })
        .catch(function () {
          /* no official logos installed: keep the built-in drawings */
        });
    }

    function _clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function _renderDest(cmd) {
      _clear(_destEl);
      _destEl.classList.toggle("is-chip", !!_chip);
      _destEl.appendChild(_badge(cmd));
      _destEl.appendChild(el("span", "cb-dest-name", cmd.label));
      if (_chip) {
        _destEl.appendChild(el("span", "cb-dest-x", "×"));
        _destEl.setAttribute(
          "aria-label",
          "Remove " + cmd.label + " destination",
        );
        _destEl.title = "Back to default (Backspace)";
      } else {
        _destEl.appendChild(el("span", "cb-dest-caret"));
        _destEl.setAttribute(
          "aria-label",
          "Destination: " + cmd.label + ". Choose another.",
        );
        _destEl.title = "Choose another destination (/)";
      }
    }

    function _renderFoot(cmd) {
      _clear(_hintEl);
      var keys = el("div", "cb-keys");
      [
        [["↵"], "Send"],
        [[MOD, "↵"], "New tab"],
        [["/"], "Switch"],
        [["Esc"], "Close"],
      ].forEach(function (k) {
        var g = el("span", "cb-keygroup");
        k[0].forEach(function (t) {
          g.appendChild(el("kbd", "cb-key", t));
        });
        g.appendChild(el("span", "cb-keylabel", k[1]));
        keys.appendChild(g);
      });
      var domain = FFCommands.domainOf(cmd);
      var route = el(
        "div",
        "cb-route" + (cmd.supportsPrefill ? "" : " is-warn"),
        cmd.supportsPrefill
          ? "→ " + domain
          : "Copies text · paste with " + MOD + "+V",
      );
      _hintEl.appendChild(keys);
      _hintEl.appendChild(route);
    }

    function _renderCurrent() {
      var cmd = _current();
      if (!cmd || !_input) return;
      _input.placeholder = _placeholderFor(cmd);
      _box.classList.toggle("has-chip", !!_chip);
      _renderDest(cmd);
      _renderFoot(cmd);
    }

    function _onDestClick() {
      if (_chip) {
        _setChip(null);
      } else {
        _input.value = "/";
        _onInput(); // opens the destination list
      }
      _input.focus({ preventScroll: true });
    }

    function _setChip(cmd) {
      var changed = _chip && cmd ? _chip.id !== cmd.id : _chip !== cmd;
      _chip = cmd;
      _renderCurrent();
      if (changed && cmd)
        _liveEl.textContent =
          cmd.label + " selected. Opens " + FFCommands.domainOf(cmd) + ".";
    }

    // ---- Slash list ----------------------------------------------------------------------

    function _listVisible() {
      return !_listEl.hidden;
    }

    function _hideList() {
      _listEl.hidden = true;
      _items = [];
      _active = 0;
      _input.setAttribute("aria-expanded", "false");
      _input.removeAttribute("aria-activedescendant");
    }

    function _showList(token) {
      _items = FFCommands.filterCommands(_commands, token);
      if (_items.length === 0) {
        _hideList();
        return;
      }
      _active = 0;
      _clear(_listEl);
      var def = _defaultCommand();
      var lastGroup = null;
      _items.forEach(function (c, i) {
        var g = token ? "Matches" : GROUP_LABELS[c.group] || "Other";
        if (g !== lastGroup) {
          lastGroup = g;
          var h = el("li", "cb-group", g);
          h.setAttribute("role", "presentation");
          _listEl.appendChild(h);
        }
        var li = el("li", "cb-item");
        li.id = "cb-opt-" + i;
        li.setAttribute("role", "option");
        li.appendChild(_badge(c));
        var txt = el("span", "cb-item-text");
        txt.appendChild(el("span", "cb-item-label", c.label));
        txt.appendChild(
          el(
            "span",
            "cb-item-domain",
            c.supportsPrefill
              ? FFCommands.domainOf(c)
              : "Copies text, then opens " + FFCommands.domainOf(c),
          ),
        );
        li.appendChild(txt);
        if (def && def.id === c.id)
          li.appendChild(el("span", "cb-item-tag", "default"));
        li.appendChild(
          el("kbd", "cb-item-alias", "/" + (c.aliases[0] || c.id)),
        );
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
        });
        li.addEventListener("click", function () {
          _active = i;
          _chooseActive();
        });
        _listEl.appendChild(li);
      });
      var foot = el("li", "cb-list-foot");
      foot.setAttribute("role", "presentation");
      [
        [["↑", "↓"], "Navigate"],
        [["↵"], "Select"],
        [["Esc"], "Close"],
      ].forEach(function (k) {
        var gp = el("span", "cb-keygroup");
        k[0].forEach(function (t) {
          gp.appendChild(el("kbd", "cb-key", t));
        });
        gp.appendChild(el("span", "cb-keylabel", k[1]));
        foot.appendChild(gp);
      });
      _listEl.appendChild(foot);
      _listEl.hidden = false;
      _input.setAttribute("aria-expanded", "true");
      _paintActive();
    }

    function _paintActive() {
      var kids = _listEl.querySelectorAll(".cb-item");
      for (var i = 0; i < kids.length; i++)
        kids[i].setAttribute("aria-selected", i === _active ? "true" : "false");
      if (kids[_active]) {
        _input.setAttribute("aria-activedescendant", kids[_active].id);
        if (kids[_active].scrollIntoView)
          kids[_active].scrollIntoView({ block: "nearest" });
      }
    }

    function _moveActive(delta) {
      if (_items.length === 0) return;
      _active = (_active + delta + _items.length) % _items.length;
      _paintActive();
    }

    function _chooseActive() {
      var cmd = _items[_active];
      if (!cmd) return;
      _setChip(cmd);
      _input.value = "";
      _autogrow();
      _hideList();
      _input.focus();
    }

    function _autogrow() {
      _input.style.height = "auto";
      _input.style.height = Math.min(_input.scrollHeight, 180) + "px";
    }

    // ---- Events -------------------------------------------------------------------------

    function _onInput() {
      var v = _input.value;
      var parsed = FFCommands.parseLeadingCommand(v, _commands);
      if (parsed) {
        _setChip(parsed.command);
        _input.value = parsed.rest;
        _autogrow();
        _hideList();
        return;
      }
      if (/^\/\S*$/.test(v)) _showList(v.slice(1));
      else _hideList();
      _autogrow();
    }

    function _onInputKeydown(e) {
      if (e.isComposing || e.keyCode === 229) return; // IME in progress

      if (e.key === "ArrowDown" && _listVisible()) {
        e.preventDefault();
        _moveActive(1);
        return;
      }
      if (e.key === "ArrowUp" && _listVisible()) {
        e.preventDefault();
        _moveActive(-1);
        return;
      }
      if (e.key === "Tab" && _listVisible()) {
        e.preventDefault();
        _chooseActive();
        return;
      }

      if (e.key === "Enter") {
        if (e.shiftKey) return; // newline
        e.preventDefault();
        var mod = e.ctrlKey || e.metaKey;
        if (_listVisible() && !mod) {
          _chooseActive();
          return;
        }
        _submit(mod);
        return;
      }

      // Backspace on an empty box: back to the default destination.
      if (e.key === "Backspace" && _input.value === "" && _chip) {
        e.preventDefault();
        _setChip(null);
      }
    }

    function _onDocKeydown(e) {
      if (_capturing) return;
      if (!_settings || !_settings.enabled) return;
      if (_open) {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        return;
      }
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      if (FFCommands.matchShortcut(e, _settings.shortcut)) {
        e.preventDefault();
        open();
      }
    }

    // ---- Submit --------------------------------------------------------------------------

    function _toast(msg) {
      _toastEl.textContent = msg;
      _toastEl.hidden = false;
      if (_toastTimer) clearTimeout(_toastTimer);
      _toastTimer = setTimeout(function () {
        _toastEl.hidden = true;
      }, TOAST_MS);
    }

    function _go(url, newTab) {
      if (typeof _navigate === "function") {
        _navigate(url, { newTab: newTab });
        return;
      }
      if (newTab) window.open(url, "_blank", "noopener");
      else window.location.assign(url);
    }

    function _submit(newTabRequested) {
      var cmd = _current();
      if (!cmd) return;
      var q = _input.value.trim();
      if (!q && !_chip) return; // nothing typed, nothing picked

      var r = FFCommands.buildUrl(cmd, q);
      if (!FFCommands.isSafeUrl(r.url)) {
        _toast("Blocked: link is not a safe https address.");
        return;
      }

      var newTab =
        !!newTabRequested || _settings.openIn === "new" || r.copyText !== null;

      if (r.copyText !== null) {
        // The URL cannot carry the text. Copy it, open a NEW tab so this message stays visible.
        var done = function (ok) {
          _toast(
            ok
              ? "Copied. Paste with " + MOD + "+V in " + cmd.label + "."
              : "Could not copy. Your text is still in the box.",
          );
          _go(r.url, true);
          if (ok) close();
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(r.copyText).then(
              function () {
                done(true);
              },
              function () {
                done(false);
              },
            );
          } else {
            done(false);
          }
        } catch (err) {
          done(false);
        }
        return;
      }

      _go(r.url, newTab);
      if (newTab) close(); // same-tab navigation leaves the page anyway
    }

    // ---- Open / close (CSS animates) --------------------------------------------------------

    function _setInert(on) {
      [
        document.querySelector("main.frame"),
        document.getElementById("editor"),
      ].forEach(function (t) {
        if (t) t.inert = on;
      });
    }

    function open() {
      if (!_ready || _open || !_settings.enabled) return;
      _open = true;
      _returnFocus = document.activeElement;
      _setInert(true);

      _chip = null;
      _input.value = "";
      _hideList();
      _renderCurrent();
      _autogrow();

      _root.inert = false;
      _root.classList.add("cb-open"); // starts the slide-up transition
      void _root.offsetWidth; // flush styles so the input can take focus now
      _input.focus({ preventScroll: true });

      if (FFRipple && !reducedMotion()) {
        FFRipple.play(_water, {
          color: getComputedStyle(document.documentElement).getPropertyValue(
            "--accent",
          ),
          delay: 0,
        });
      }
    }

    function close() {
      if (!_open) return;
      _open = false;
      _root.classList.remove("cb-open"); // starts the slide-down transition
      _root.inert = true;
      if (FFRipple) FFRipple.stop(_water);
      _hideList();
      _setInert(false);
      var back = _returnFocus;
      _returnFocus = null;
      if (back && back.focus && document.contains(back)) {
        try {
          back.focus();
        } catch (e) {
          /* ignore */
        }
      }
    }

    // ---- Public API -----------------------------------------------------------------------------

    function setSettings(s) {
      _settings = FFCommands.mergeSettings(s);
      _recompute();
      _syncSettingsUi();
      if (_ready) {
        if (_chip && !FFCommands.findById(_commands, _chip.id)) _chip = null;
        _renderCurrent();
      }
      if (!_settings.enabled && _open) close();
    }

    function init(opts) {
      if (!FFCommands) return;
      if (_ready) destroy();
      var o = opts || {};
      _onChange = o.onChange || null;
      _navigate = o.navigate || null;
      _settings = FFCommands.mergeSettings(o.settings);
      _recompute();
      _build();
      _buildSettings();
      _syncSettingsUi();
      _ready = true;
      _renderCurrent();
      _loadRealLogos();
    }

    function destroy() {
      document.removeEventListener("keydown", _onDocKeydown);
      document.removeEventListener("keydown", _onCaptureKey, true);
      if (_open) {
        _setInert(false);
        _open = false;
      }
      _capturing = false;
      if (_toastTimer) {
        clearTimeout(_toastTimer);
        _toastTimer = null;
      }
      if (FFRipple) FFRipple.stop(null);
      [_root, _toastEl, _settingsSection].forEach(function (n) {
        if (n && n.parentNode) n.parentNode.removeChild(n);
      });
      _root =
        _panel =
        _input =
        _destEl =
        _listEl =
        _hintEl =
        _toastEl =
        _liveEl =
        _box =
        _sendBtn =
        _water =
          null;
      _settingsSection = null;
      _chip = null;
      _ready = false;
    }

    function isOpen() {
      return _open;
    }

    return {
      DEFAULT_SETTINGS: DEFAULT_SETTINGS,
      init: init,
      setSettings: setSettings,
      open: open,
      close: close,
      isOpen: isOpen,
      destroy: destroy,
    };
  },
);

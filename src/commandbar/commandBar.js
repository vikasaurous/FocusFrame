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

    function _clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function _renderDest(cmd) {
      _clear(_destEl);
      _destEl.classList.toggle("is-chip", !!_chip);
      _destEl.appendChild(
        el("span", "cb-badge", cmd.label.charAt(0).toUpperCase()),
      );
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
        li.appendChild(el("span", "cb-badge", c.label.charAt(0).toUpperCase()));
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

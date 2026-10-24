/**
 * snakeRenderer.js
 *
 * SVG overlay renderer for the FocusFrame year-dot calendar snake.
 * Plain classic script (no ES modules). Exposes window.SnakeRenderer.
 * Must be loaded after snakeEngine.js.
 *
 * API
 *   SnakeRenderer.setup(dotsEl, dayOfYear, opts)  opts: { enabled, speed, regrow }
 *   SnakeRenderer.notify(dotsEl, dayOfYear)       call after renderYearDots() rebuilds innerHTML
 *   SnakeRenderer.setRegrow(bool)                 live regrow toggle
 *   SnakeRenderer.teardown()
 *   SnakeRenderer.isActive()
 *
 * Look: one smooth path with round caps/joins and curved bends, a round head,
 * and a tapered (but never pointed) tail. Color is var(--accent), so it
 * follows the accent theme live.
 */
(function (root, factory) {
  root.SnakeRenderer = factory(root.SnakeEngine);
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (SnakeEngine) {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var COLS = 26; // must match CSS: .year-dots grid-template-columns: repeat(26, 1fr)
    var REGROW_DELAY = 1500; // ms between cycle end and restart / hide
    var SPEEDS = { slow: 220, medium: 140, fast: 90 };

    // ---- Singleton state ---------------------------------------------
    var _dotsEl = null;
    var _engine = null;
    var _svg = null;
    var _bodyPath = null;
    var _headEl = null;
    var _tailEls = [];
    var _coords = []; // { x, y } per dot, relative to _dotsEl
    var _dotEls = [];
    var _dotSize = 0;
    var _timer = null;
    var _resizeObs = null;
    var _resizeRaf = 0;
    var _active = false;
    var _paused = false; // true while the tab is hidden
    var _reduced = false; // prefers-reduced-motion at setup time
    var _regrow = true;
    var _phase = "rest"; // 'tick' | 'restart' | 'rest'
    var _speed = SPEEDS.slow;
    var _lastDay = 0;
    var _lastDateStr = "";

    // ---- Small helpers -----------------------------------------------

    function _walkable() {
      return Math.max(0, _lastDay - 1);
    } // today dot excluded

    function _clearTimer() {
      if (_timer) {
        clearTimeout(_timer);
        _timer = null;
      }
    }

    function _schedule(ms, fn) {
      _clearTimer();
      _timer = setTimeout(fn, ms);
    }

    function _fmt(n) {
      return n.toFixed(1);
    }

    // ---- SVG construction --------------------------------------------

    function _makePath() {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("fill", "none");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      p.style.stroke = "var(--accent)";
      return p;
    }

    function _buildSvg() {
      var svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.classList.add("snake-svg");

      // Paint order (back to front): thinnest tail, mid tail, body, head.
      var t2 = _makePath();
      var t1 = _makePath();
      var body = _makePath();
      var head = document.createElementNS(SVG_NS, "circle");
      head.style.fill = "var(--accent)";
      head.style.opacity = "0.82"; // slightly different from the today dot
      head.setAttribute("r", "0");

      svg.appendChild(t2);
      svg.appendChild(t1);
      svg.appendChild(body);
      svg.appendChild(head);
      return { svg: svg, body: body, tail1: t1, tail2: t2, head: head };
    }

    function _attachSvg() {
      if (_dotsEl && _svg && _svg.parentNode !== _dotsEl)
        _dotsEl.appendChild(_svg);
    }

    // ---- Coordinates -------------------------------------------------

    /**
     * Centers come from bounding rects (a scale() transform keeps the center
     * fixed). Size comes from offsetWidth, which ignores transforms, so an
     * "eaten" dot (scaled to .7) does not shrink the snake.
     */
    function _cacheCoords() {
      _dotEls = Array.prototype.slice.call(_dotsEl.querySelectorAll("i"));
      _coords = [];
      _dotSize = 0;
      if (_dotEls.length === 0) return;
      var box = _dotsEl.getBoundingClientRect();
      for (var i = 0; i < _dotEls.length; i++) {
        var r = _dotEls[i].getBoundingClientRect();
        _coords.push({
          x: r.left - box.left + r.width * 0.5,
          y: r.top - box.top + r.height * 0.5,
        });
      }
      _dotSize =
        _dotEls[0].offsetWidth || _dotEls[0].getBoundingClientRect().width || 0;
    }

    // ---- Path building -----------------------------------------------

    /** Smooth polyline through cell centers: straight runs, rounded bends. */
    function _smoothPath(indices) {
      var pts = [];
      for (var i = 0; i < indices.length; i++) {
        var c = _coords[indices[i]];
        if (c) pts.push(c);
      }
      var n = pts.length;
      if (n === 0) return "";
      if (n === 1) {
        // Zero-length segment: a round cap renders it as a dot.
        return (
          "M " +
          _fmt(pts[0].x) +
          " " +
          _fmt(pts[0].y) +
          " L " +
          _fmt(pts[0].x) +
          " " +
          _fmt(pts[0].y)
        );
      }
      if (n === 2) {
        return (
          "M " +
          _fmt(pts[0].x) +
          " " +
          _fmt(pts[0].y) +
          " L " +
          _fmt(pts[1].x) +
          " " +
          _fmt(pts[1].y)
        );
      }
      function mid(a, b) {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      var m = mid(pts[0], pts[1]);
      var d =
        "M " +
        _fmt(pts[0].x) +
        " " +
        _fmt(pts[0].y) +
        " L " +
        _fmt(m.x) +
        " " +
        _fmt(m.y);
      for (var k = 1; k < n - 1; k++) {
        var mm = mid(pts[k], pts[k + 1]);
        d +=
          " Q " +
          _fmt(pts[k].x) +
          " " +
          _fmt(pts[k].y) +
          " " +
          _fmt(mm.x) +
          " " +
          _fmt(mm.y);
      }
      d += " L " + _fmt(pts[n - 1].x) + " " + _fmt(pts[n - 1].y);
      return d;
    }

    function _clearSnakeVisual() {
      if (!_bodyPath) return;
      _bodyPath.setAttribute("d", "");
      _tailEls[0].setAttribute("d", "");
      _tailEls[1].setAttribute("d", "");
      _headEl.setAttribute("r", "0");
    }

    function _draw() {
      if (!_svg) return;
      var body = _engine ? _engine.getBody() : [];
      var len = body.length;

      if (len === 0 || _coords.length === 0 || _dotSize <= 0) {
        _clearSnakeVisual();
        return;
      }

      // Widths: body 80% of dot, tail steps 60% then 40% (round caps, no point).
      var bw = _fmt(_dotSize * 0.8);
      var tw1 = _fmt(_dotSize * 0.6);
      var tw2 = _fmt(_dotSize * 0.4);
      var hr = _fmt(_dotSize * 0.46);

      var mainEnd = Math.max(0, len - 3);
      _bodyPath.setAttribute("stroke-width", bw);
      _bodyPath.setAttribute("d", _smoothPath(body.slice(0, mainEnd + 1)));

      if (len >= 3) {
        _tailEls[0].setAttribute("stroke-width", tw1);
        _tailEls[0].setAttribute(
          "d",
          _smoothPath([body[len - 3], body[len - 2]]),
        );
      } else {
        _tailEls[0].setAttribute("d", "");
      }
      if (len >= 2) {
        _tailEls[1].setAttribute("stroke-width", tw2);
        _tailEls[1].setAttribute(
          "d",
          _smoothPath([body[len - 2], body[len - 1]]),
        );
      } else {
        _tailEls[1].setAttribute("d", "");
      }

      var hc = _coords[body[0]];
      if (hc) {
        _headEl.setAttribute("cx", _fmt(hc.x));
        _headEl.setAttribute("cy", _fmt(hc.y));
        _headEl.setAttribute("r", hr);
      }
    }

    // ---- Eaten-dot classes -------------------------------------------

    function _clearEatenClasses() {
      for (var i = 0; i < _dotEls.length; i++)
        _dotEls[i].classList.remove("dot--eaten");
    }

    /** Make DOM classes match the engine (used after setup, reset, rebuild). */
    function _syncEaten() {
      if (!_engine) return;
      var eaten = _engine.getEaten();
      for (var i = 0; i < _dotEls.length; i++) {
        _dotEls[i].classList.toggle("dot--eaten", eaten.has(i));
      }
    }

    // ---- Loop --------------------------------------------------------

    function _checkRollover() {
      var todayStr = new Date().toDateString();
      if (todayStr === _lastDateStr) return;
      _lastDateStr = todayStr;
      var now = new Date();
      var newDay = Math.floor(
        (now - new Date(now.getFullYear(), 0, 0)) / 86400000,
      );
      if (newDay !== _lastDay) {
        _lastDay = newDay;
        _engine.updateWalkable(_walkable());
      }
    }

    function _tick() {
      if (!_active || _paused || _phase !== "tick" || !_engine) return;
      _checkRollover();

      var result = _engine.step();

      if (result.moved && result.eatenAdded) {
        var dotEl = _dotEls[result.head];
        if (dotEl) dotEl.classList.add("dot--eaten");
      }
      _draw();

      if (result.cycleComplete) {
        _phase = "restart";
        _schedule(REGROW_DELAY, _afterComplete);
        return;
      }
      _schedule(_speed, _tick);
    }

    /** Runs REGROW_DELAY after a cycle ends. Reads _regrow at fire time. */
    function _afterComplete() {
      if (!_active || !_engine) return;
      if (_regrow) {
        _restart();
      } else {
        // Keep eaten dots; fade the snake itself out and rest.
        _phase = "rest";
        _clearSnakeVisual();
      }
    }

    function _restart() {
      if (!_active || !_engine) return;
      _clearEatenClasses();
      _engine.reset(COLS, _walkable());
      _syncEaten();
      _draw();
      _phase = "tick";
      if (!_paused) _schedule(_speed, _tick);
    }

    function _resume() {
      if (!_active || _paused || _reduced) return;
      if (_phase === "tick") _schedule(_speed, _tick);
      else if (_phase === "restart") _schedule(REGROW_DELAY, _afterComplete);
    }

    // ---- Event handlers ----------------------------------------------

    function _onVisibility() {
      if (!_active) return;
      if (document.hidden) {
        _paused = true;
        _clearTimer();
      } else {
        _paused = false;
        _resume();
      }
    }

    /** Layout changed (resize, font swap, panel open): recache + redraw. Engine is NOT reset. */
    function _onLayout() {
      if (_resizeRaf) return;
      var raf =
        window.requestAnimationFrame ||
        function (f) {
          return setTimeout(f, 16);
        };
      _resizeRaf = raf(function () {
        _resizeRaf = 0;
        if (!_active || !_dotsEl) return;
        _cacheCoords();
        if (!_reduced) _syncEaten();
        _draw();
      });
    }

    // ---- Public API --------------------------------------------------

    function setup(dotsEl, dayOfYear, opts) {
      teardown();
      var o = opts || {};
      _speed = SPEEDS[o.speed] || SPEEDS.slow;
      _regrow = o.regrow !== false;
      _dotsEl = dotsEl;
      _lastDay = dayOfYear || 0;
      if (!o.enabled || !SnakeEngine || !_dotsEl) return;
      _active = true;

      _engine = SnakeEngine.createSnake({
        cols: COLS,
        walkableCount: _walkable(),
      });

      var els = _buildSvg();
      _svg = els.svg;
      _bodyPath = els.body;
      _headEl = els.head;
      _tailEls = [els.tail1, els.tail2];

      _cacheCoords();
      _attachSvg();

      _lastDateStr = new Date().toDateString();
      _reduced = !!(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
      _paused = !!document.hidden;

      document.addEventListener("visibilitychange", _onVisibility);
      if (typeof ResizeObserver !== "undefined") {
        _resizeObs = new ResizeObserver(_onLayout);
        _resizeObs.observe(_dotsEl);
      } else {
        window.addEventListener("resize", _onLayout);
      }

      if (_reduced) {
        // Static snake, placed once. No tick loop, no dimmed dots.
        _phase = "rest";
        _draw();
        return;
      }

      _syncEaten();
      _draw();
      _phase = "tick";
      if (!_paused) _schedule(_speed, _tick);
    }

    /** Called by newtab.js right after renderYearDots() rebuilt the dots. */
    function notify(dotsEl, dayOfYear) {
      if (!_active || !_svg || !_engine) return;
      _dotsEl = dotsEl;
      _lastDay = dayOfYear || 0;
      _cacheCoords();
      _attachSvg();
      _engine.updateWalkable(_walkable());
      if (!_reduced) _syncEaten();
      _draw();
      // A new finished day may re-open a completed cycle.
      if (!_reduced && _phase !== "tick" && !_engine.isComplete()) {
        _phase = "tick";
        if (!_paused) _schedule(_speed, _tick);
      }
    }

    /** Live toggle from the settings panel. */
    function setRegrow(value) {
      _regrow = value !== false;
      if (
        _active &&
        !_paused &&
        !_reduced &&
        _phase === "rest" &&
        _regrow &&
        _engine &&
        _engine.isComplete()
      ) {
        _restart();
      }
    }

    function teardown() {
      _clearTimer();
      _active = false;
      _paused = false;
      _phase = "rest";
      document.removeEventListener("visibilitychange", _onVisibility);
      window.removeEventListener("resize", _onLayout);
      if (_resizeObs) {
        _resizeObs.disconnect();
        _resizeObs = null;
      }
      _resizeRaf = 0;
      _clearEatenClasses();
      if (_svg && _svg.parentNode) _svg.parentNode.removeChild(_svg);
      _svg = null;
      _bodyPath = null;
      _headEl = null;
      _tailEls = [];
      _dotEls = [];
      _coords = [];
      _dotSize = 0;
      _engine = null;
      _lastDateStr = "";
    }

    function isActive() {
      return _active;
    }

    return {
      setup: setup,
      notify: notify,
      setRegrow: setRegrow,
      teardown: teardown,
      isActive: isActive,
      SPEEDS: SPEEDS,
    };
  },
);

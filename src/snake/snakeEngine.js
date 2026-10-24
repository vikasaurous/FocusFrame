/**
 * snakeEngine.js
 *
 * Pure-logic Snake engine for the FocusFrame year-dot calendar.
 * No DOM access -- fully testable in Node.js.
 *
 * Behaviour
 *   - Starts at a RANDOM walkable cell (not always the same corner).
 *   - Wanders like a real snake: keeps going straight most of the time,
 *     prefers uneaten neighbours, and when none are adjacent it heads
 *     toward the nearest uneaten dot (BFS), so a full cycle always ends.
 *   - Never overlaps its own body and never leaves walkable cells
 *     (index < walkableCount, i.e. finished days only).
 *   - If boxed in by its own body it reverses (head <-> tail).
 *   - Eaten dots are passable; only the snake body blocks.
 *
 * Grid: row-major, `cols` columns. Cell i -> row floor(i/cols), col i%cols.
 *
 * UMD wrapper: window.SnakeEngine in the browser, module.exports in Node.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.SnakeEngine = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var INITIAL_LENGTH = 3;
  var MAX_LENGTH = 10;
  var STRAIGHT_BIAS = 0.65; // chance to keep heading straight when possible
  var STEP_CAP_MULT = 30; // safety: give up a cycle after wc * 30 steps

  /**
   * createSnake({ cols, walkableCount, rng })
   *   cols           grid columns (26 for the calendar)
   *   walkableCount  cells 0..walkableCount-1 are walkable
   *   rng            optional () => [0,1); defaults to Math.random
   */
  function createSnake(opts) {
    var _cols = opts.cols;
    var _wc = opts.walkableCount;
    var _rng = typeof opts.rng === "function" ? opts.rng : Math.random;

    var _body = []; // head first
    var _bodySet = new Set();
    var _eaten = new Set();
    var _pendingGrowth = 0;
    var _complete = false;
    var _stuck = false;
    var _dir = 0; // last delta: -1, +1, -cols, +cols
    var _steps = 0;

    // ---- helpers ----------------------------------------------------

    function _rand(n) {
      var v = Math.floor(_rng() * n);
      return v >= n ? n - 1 : v;
    }

    function _shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = _rand(i + 1);
        var t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    }

    /** Walkable orthogonal neighbours of cell i (body not considered). */
    function _neighbors(i) {
      var out = [];
      var c = i % _cols;
      if (c > 0 && i - 1 >= 0) out.push(i - 1);
      if (c < _cols - 1 && i + 1 < _wc) out.push(i + 1);
      if (i - _cols >= 0) out.push(i - _cols);
      if (i + _cols < _wc) out.push(i + _cols);
      return out;
    }

    function _isFree(n) {
      return !_bodySet.has(n);
    }

    /** Number of free (non-body) neighbours of n. */
    function _onward(n) {
      var ns = _neighbors(n),
        k = 0;
      for (var i = 0; i < ns.length; i++) if (_isFree(ns[i])) k++;
      return k;
    }

    /**
     * BFS from the head across non-body walkable cells to the nearest
     * uneaten cell. Returns the FIRST step cell, or null if unreachable.
     */
    function _towardUneaten() {
      var head = _body[0];
      var prev = new Map();
      var queue = [head];
      var qi = 0;
      prev.set(head, -1);
      while (qi < queue.length) {
        var cur = queue[qi++];
        var ns = _shuffle(_neighbors(cur));
        for (var i = 0; i < ns.length; i++) {
          var n = ns[i];
          if (prev.has(n) || _bodySet.has(n)) continue;
          prev.set(n, cur);
          if (!_eaten.has(n)) {
            var s = n;
            while (prev.get(s) !== head) s = prev.get(s);
            return s;
          }
          queue.push(n);
        }
      }
      return null;
    }

    /** Choose the next head cell, or null when boxed in. */
    function _pickNext() {
      var head = _body[0];
      var free = [];
      var ns = _neighbors(head);
      for (var i = 0; i < ns.length; i++) if (_isFree(ns[i])) free.push(ns[i]);
      if (free.length === 0) return null;

      var pool = [];
      for (var a = 0; a < free.length; a++)
        if (!_eaten.has(free[a])) pool.push(free[a]);

      if (pool.length === 0) {
        var t = _towardUneaten();
        pool = t !== null ? [t] : free;
      }

      // Avoid dead ends when a safer option exists.
      var safe = [];
      for (var b = 0; b < pool.length; b++)
        if (_onward(pool[b]) > 0) safe.push(pool[b]);
      if (safe.length > 0) pool = safe;

      // Keep going straight most of the time.
      if (_dir !== 0 && pool.length > 1) {
        for (var c = 0; c < pool.length; c++) {
          if (pool[c] - head === _dir && _rng() < STRAIGHT_BIAS) return pool[c];
        }
      }
      return pool[_rand(pool.length)];
    }

    function _reverseBody() {
      _body.reverse();
      _dir = 0;
    }

    // ---- init ---------------------------------------------------------

    function _init() {
      _body = [];
      _bodySet = new Set();
      _eaten = new Set();
      _pendingGrowth = 0;
      _complete = false;
      _stuck = false;
      _dir = 0;
      _steps = 0;

      if (_wc <= 0 || _cols <= 0) {
        _complete = true;
        return;
      }

      var start = _rand(_wc);
      _body.push(start);
      _bodySet.add(start);
      _eaten.add(start);
      _pendingGrowth = Math.min(INITIAL_LENGTH, _wc) - 1;
      if (_eaten.size >= _wc) _complete = true;
    }

    _init();

    // ---- step ---------------------------------------------------------

    /**
     * Advance one cell.
     * Returns { moved, head, tail, eatenAdded, stuck, cycleComplete, reversed }
     *   tail is the freed cell, or null while growing.
     */
    function step() {
      if (_complete || _body.length === 0) {
        return {
          moved: false,
          head: _body.length > 0 ? _body[0] : null,
          tail: null,
          eatenAdded: false,
          stuck: _stuck,
          cycleComplete: true,
          reversed: false,
        };
      }

      var reversed = false;
      var next = _pickNext();
      if (next === null) {
        _reverseBody();
        reversed = true;
        next = _pickNext();
        // Still boxed in (coiled in a tight spot): shorten from the tail
        // until a move opens up. Rare; keeps the cycle from dying early.
        while (next === null && _body.length > 1) {
          _bodySet.delete(_body.pop());
          next = _pickNext();
        }
        if (next === null) {
          _complete = true;
          _stuck = true;
          return {
            moved: false,
            head: _body[0],
            tail: null,
            eatenAdded: false,
            stuck: true,
            cycleComplete: true,
            reversed: true,
          };
        }
      }

      var head = _body[0];
      var eatenAdded = !_eaten.has(next);
      if (eatenAdded) {
        _eaten.add(next);
        if (_body.length + _pendingGrowth < MAX_LENGTH) _pendingGrowth++;
      }

      var freedTail = null;
      if (_pendingGrowth > 0) {
        _pendingGrowth--;
      } else {
        freedTail = _body.pop();
        _bodySet.delete(freedTail);
      }
      _body.unshift(next);
      _bodySet.add(next);
      _dir = next - head;
      _steps++;

      if (_eaten.size >= _wc || _steps > _wc * STEP_CAP_MULT) _complete = true;

      return {
        moved: true,
        head: next,
        tail: freedTail,
        eatenAdded: eatenAdded,
        stuck: false,
        cycleComplete: _complete,
        reversed: reversed,
      };
    }

    // ---- updateWalkable -------------------------------------------------

    /** Midnight: a new day finished, so one more cell becomes walkable. */
    function updateWalkable(newCount) {
      if (newCount <= _wc) return;
      _wc = newCount;
      if (_body.length === 0) {
        _init();
        return;
      }
      if (_complete && !_stuck && _eaten.size < _wc) {
        _complete = false;
        _steps = 0;
      }
    }

    // ---- reset ----------------------------------------------------------

    function reset(newCols, newWalkableCount) {
      _cols = newCols;
      _wc = newWalkableCount;
      _init();
    }

    function getBody() {
      return _body.slice();
    }
    function getEaten() {
      return new Set(_eaten);
    }
    function isStuck() {
      return _stuck;
    }
    function isComplete() {
      return _complete;
    }

    return {
      step: step,
      updateWalkable: updateWalkable,
      reset: reset,
      getBody: getBody,
      getEaten: getEaten,
      isStuck: isStuck,
      isComplete: isComplete,
    };
  }

  return { createSnake: createSnake };
});

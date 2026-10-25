/**
 * ripple.js  (name kept so script tags do not change)
 *
 * Water-arc effect for the command bar.
 *
 * Sequence on open:
 *   1. A bright arc of water forms at the bottom center and swells outward.
 *   2. The command bar slides up through it (CSS delays the bar to match).
 *   3. More arcs follow, rolling out across the whole screen and fading.
 *
 * Nothing is uniform: every arc has its own speed, thickness and brightness,
 * and its edge wobbles along the curve using a mix of three wave sizes, so it
 * reads as moving water, not a perfect circle. A new random set every open.
 *
 * Draws on a canvas at reduced resolution (soft by design, cheap to render).
 *
 * Exposes window.FFRipple (browser) / module.exports (Node, tests).
 *   FFRipple.play(canvas, { color, delay })
 *   FFRipple.stop(canvas)
 *   FFRipple.makeWaves(seed)
 *   FFRipple.draw(ctx, w, h, t, { rgb, k, waves })   one frame (tests / previews)
 *   FFRipple.parseColor(str)
 *   FFRipple.BAR_DELAY   seconds before the bar should appear (used by CSS)
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.FFRipple = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SCALE = 0.6; // canvas resolution vs CSS px
  var ARCS = 4;
  var FILL_ALPHA = 0.2; // water body behind each crest
  var LINE_ALPHA = 0.6; // crest line
  var BAR_DELAY = 0.28; // keep in sync with the delay in commandBar.css
  var TWO_PI = Math.PI * 2;
  var STEPS = 120; // points along each arc

  var _raf = 0;
  var _clearTimer = 0;

  // ---- Helpers --------------------------------------------------------------

  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parseColor(str) {
    var s = String(str || "").trim();
    var m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m)
      return [
        parseInt(m[1].slice(0, 2), 16),
        parseInt(m[1].slice(2, 4), 16),
        parseInt(m[1].slice(4, 6), 16),
      ];
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m)
      return [
        parseInt(m[1][0] + m[1][0], 16),
        parseInt(m[1][1] + m[1][1], 16),
        parseInt(m[1][2] + m[1][2], 16),
      ];
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
    if (m)
      return [Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])];
    return [239, 103, 88];
  }

  function rgba(c, a) {
    return (
      "rgba(" +
      Math.round(c[0]) +
      "," +
      Math.round(c[1]) +
      "," +
      Math.round(c[2]) +
      "," +
      Math.max(0, a).toFixed(3) +
      ")"
    );
  }

  function lighten(c, amt) {
    return [
      c[0] + (255 - c[0]) * amt,
      c[1] + (255 - c[1]) * amt,
      c[2] + (255 - c[2]) * amt,
    ];
  }

  /** Random but reproducible arcs. Arc 0 is the lead arc: brightest, thickest. */
  function makeWaves(seed) {
    var rnd = mulberry32(seed >>> 0 || 1);
    var out = [];
    for (var i = 0; i < ARCS; i++) {
      out.push({
        delay: i === 0 ? 0 : 0.1 + i * 0.15 + rnd() * 0.12,
        dur: 1.55 + rnd() * 0.5,
        amp: 0.016 + rnd() * 0.026, // edge wobble as a fraction of the radius
        f1: 2.2 + rnd() * 2.0, // big swell along the arc
        f2: 6.5 + rnd() * 4.0, // medium chop
        f3: 15 + rnd() * 7, // fine ripple
        p1: rnd() * TWO_PI,
        p2: rnd() * TWO_PI,
        p3: rnd() * TWO_PI,
        w1: (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 1.0), // drift speed and direction
        w2: (rnd() < 0.5 ? -1 : 1) * (0.9 + rnd() * 1.3),
        mod: rnd() * TWO_PI, // wobble strength varies along the arc
        band: i === 0 ? 0.17 : 0.07 + rnd() * 0.07, // water body thickness (fraction of screen height)
        alpha: i === 0 ? 1 : 0.8 - i * 0.14 + rnd() * 0.1,
      });
    }
    return out;
  }

  function totalDuration(waves) {
    var d = 0;
    for (var i = 0; i < waves.length; i++)
      d = Math.max(d, waves[i].delay + waves[i].dur);
    return d + 0.05;
  }

  // ---- One frame ----------------------------------------------------------------

  /**
   * ctx, w, h  canvas context and size (canvas px)
   * t          seconds since start
   * o          { rgb, k (canvas px per CSS px), waves }
   * Arcs are centered on the bottom edge, middle of the screen.
   */
  function draw(ctx, w, h, t, o) {
    ctx.clearRect(0, 0, w, h);
    var waves = o.waves;
    if (!waves || t < 0 || t > totalDuration(waves)) return;
    var rgb = o.rgb,
      k = o.k || 1;
    var cx = w / 2,
      cy = h;
    var maxR = Math.sqrt(cx * cx + cy * cy) * 1.08;
    var crestColor = lighten(rgb, 0.45);

    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (var i = 0; i < waves.length; i++) {
      var wv = waves[i];
      var u = (t - wv.delay) / wv.dur;
      if (u <= 0 || u >= 1) continue;

      var rise = 1 - Math.pow(1 - u, 1.9); // forms quickly, glides outward
      var R = rise * maxR;
      var env = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.1) * wv.alpha;
      if (R < 3 || env < 0.01) continue;

      // Outer edge points (upper half circle, left to right) with a wobbly radius.
      var band = wv.band * h;
      var outer = [],
        inner = [];
      for (var s = 0; s <= STEPS; s++) {
        var a = Math.PI + (s / STEPS) * Math.PI; // PI .. 2*PI
        var strength = 0.6 + 0.4 * Math.sin(a * 2.3 + wv.mod + t * 0.6);
        var wob =
          wv.amp *
          strength *
          (Math.sin(a * wv.f1 + wv.p1 + wv.w1 * t) +
            0.45 * Math.sin(a * wv.f2 + wv.p2 + wv.w2 * t) +
            0.18 * Math.sin(a * wv.f3 + wv.p3 + t * 1.4));
        var r = R * (1 + wob);
        var ri = Math.max(0, r - band);
        var ca = Math.cos(a),
          sa = Math.sin(a);
        outer.push(cx + r * ca, cy + r * sa);
        inner.push(cx + ri * ca, cy + ri * sa);
      }

      // Water body: fades inward from the crest.
      var rOut = R * (1 + wv.amp * 1.8) + 4 * k;
      var rIn = Math.max(0, R - band);
      var g = ctx.createRadialGradient(cx, cy, rIn, cx, cy, rOut);
      var crestPos = Math.min(0.98, (R - rIn) / (rOut - rIn));
      g.addColorStop(0, rgba(rgb, 0));
      g.addColorStop(crestPos, rgba(rgb, env * FILL_ALPHA));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(outer[0], outer[1]);
      for (var j = 2; j < outer.length; j += 2)
        ctx.lineTo(outer[j], outer[j + 1]);
      for (var m = inner.length - 2; m >= 0; m -= 2)
        ctx.lineTo(inner[m], inner[m + 1]);
      ctx.closePath();
      ctx.fill();

      // Crest: soft wide glow stroke, then a thin bright line, then a faint echo inside.
      ctx.beginPath();
      ctx.moveTo(outer[0], outer[1]);
      for (var n = 2; n < outer.length; n += 2)
        ctx.lineTo(outer[n], outer[n + 1]);
      ctx.lineWidth = 8 * k;
      ctx.strokeStyle = rgba(rgb, env * LINE_ALPHA * 0.16);
      ctx.stroke();
      ctx.lineWidth = 2 * k;
      ctx.strokeStyle = rgba(crestColor, env * LINE_ALPHA);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      for (var p = 2; p < inner.length; p += 2) {
        var ex = cx + (inner[p] - cx) * 0.985,
          ey = cy + (inner[p + 1] - cy) * 0.985;
        ctx.lineTo(ex, ey);
      }
      ctx.lineWidth = 1 * k;
      ctx.strokeStyle = rgba(rgb, env * LINE_ALPHA * 0.28);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ---- Playback ----------------------------------------------------------------------

  function _clear(canvas) {
    var ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function stop(canvas) {
    if (_raf) {
      cancelAnimationFrame(_raf);
      _raf = 0;
    }
    if (!canvas) return;
    canvas.style.transition = "opacity .3s ease";
    canvas.style.opacity = "0";
    if (_clearTimer) clearTimeout(_clearTimer);
    _clearTimer = setTimeout(function () {
      _clear(canvas);
      _clearTimer = 0;
    }, 340);
  }

  /** play(canvas, { color, delay }) -- new random arcs on every call. */
  function play(canvas, opts) {
    var o = opts || {};
    if (_raf) {
      cancelAnimationFrame(_raf);
      _raf = 0;
    }
    if (_clearTimer) {
      clearTimeout(_clearTimer);
      _clearTimer = 0;
    }

    var w = Math.max(2, Math.ceil(window.innerWidth * SCALE));
    var h = Math.max(2, Math.ceil(window.innerHeight * SCALE));
    canvas.width = w;
    canvas.height = h;
    canvas.style.transition = "none";
    canvas.style.opacity = "1";

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var params = {
      rgb: parseColor(o.color),
      k: SCALE,
      waves: makeWaves(Math.floor(Math.random() * 4294967295)),
    };
    var end = totalDuration(params.waves);
    var delay = o.delay || 0;
    var start = null;

    function frame(now) {
      if (start === null) start = now;
      var t = (now - start) / 1000 - delay;
      if (t > end) {
        _clear(canvas);
        _raf = 0;
        return;
      }
      draw(ctx, w, h, t, params);
      _raf = requestAnimationFrame(frame);
    }
    _raf = requestAnimationFrame(frame);
  }

  return {
    play: play,
    stop: stop,
    draw: draw,
    makeWaves: makeWaves,
    totalDuration: totalDuration,
    parseColor: parseColor,
    SCALE: SCALE,
    BAR_DELAY: BAR_DELAY,
  };
});

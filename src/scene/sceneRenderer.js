/**
 * sceneRenderer.js
 *
 * Puts the pixel scene on the page. Needs sceneSprites.js and sceneEngine.js.
 * Exposes window.FFScene (browser) / module.exports (Node, for loading only).
 *
 *   var ctl = FFScene.init(document.getElementById("scene"), { pet: "cat" });
 *   ctl.setPet("dog");
 *   ctl.setEnabled(false);
 *   ctl.destroy();
 *
 * What it does
 *   - draws the scene on a small canvas, scaled up by whole numbers (crisp pixels)
 *   - runs the engine about 10 times a second
 *   - invisible buttons over the boy and the pet (mouse, keyboard and touch)
 *   - a pixel thought bubble that links to the GitHub repo (boy) or donate page (pet)
 *   - pauses while the tab is hidden or the command bar is open
 *   - follows the system "reduce motion" setting
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./sceneSprites.js"),
      require("./sceneEngine.js"),
    );
  } else {
    root.FFScene = factory(root.FFSceneSprites, root.FFSceneEngine);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (SP, E) {
  "use strict";

  var TICK_MS = 100;
  var MIN_SCALE = 2;
  var TARGET_SCALE = 3; // one logical pixel = 3 screen pixels (2 on narrow screens)
  var MAX_HEIGHT = 96; // logical rows; anything above the art is open sky
  var MIN_LOGICAL_WIDTH = 130;
  var LEAVE_DELAY_MS = 220; // lets the pointer travel from the boy to his bubble

  // ---- Sprite cache: each sprite is painted once, then copied ---------------

  var _cache = {};

  function sprite(name) {
    if (_cache[name]) return _cache[name];
    var rows = SP.SPRITES[name];
    var c = document.createElement("canvas");
    c.width = rows[0].length;
    c.height = rows.length;
    var x = c.getContext("2d");
    for (var j = 0; j < rows.length; j++) {
      for (var i = 0; i < rows[j].length; i++) {
        var ch = rows[j].charAt(i);
        if (ch === ".") continue;
        x.fillStyle = SP.PALETTE[ch];
        x.fillRect(i, j, 1, 1);
      }
    }
    _cache[name] = c;
    return c;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ---- init ----------------------------------------------------------------------

  function init(container, opts) {
    var o = opts || {};
    var H = SP.SCENE_H;
    var scale = 4;
    var W = 180;
    var enabled = o.enabled !== false;
    var timer = 0;
    var leaveTimer = 0;
    var last = 0;
    var armed = null; // touch: first tap shows the bubble, second tap opens the link
    var lastPointerType = "mouse";

    var mq =
      typeof matchMedia === "function"
        ? matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    var scene = E.createScene({
      width: W,
      pet: o.pet,
      reducedMotion: !!(mq && mq.matches),
    });

    // DOM
    var stage = el("div", "scene-stage");
    var canvas = el("canvas", "scene-canvas");
    canvas.setAttribute("aria-hidden", "true");
    var ctx = canvas.getContext("2d");
    var hitBoy = el("button", "scene-hit");
    hitBoy.type = "button";
    hitBoy.dataset.target = "boy";
    hitBoy.setAttribute(
      "aria-label",
      "Say hi to the developer. Opens the FocusFrame GitHub page.",
    );
    var hitPet = el("button", "scene-hit");
    hitPet.type = "button";
    hitPet.dataset.target = "pet";
    hitPet.setAttribute("aria-label", "Pet the pet. Opens the donate page.");

    var bubbleWrap = el("div", "scene-bubble-wrap");
    bubbleWrap.hidden = true;
    var bubble = el("a", "scene-bubble");
    bubble.target = "_blank";
    bubble.rel = "noopener noreferrer";
    var bubbleText = el("span", "scene-bubble-text");
    bubble.appendChild(bubbleText);
    var dot1 = el("span", "scene-dot scene-dot-1");
    var dot2 = el("span", "scene-dot scene-dot-2");
    bubbleWrap.appendChild(bubble);
    bubbleWrap.appendChild(dot1);
    bubbleWrap.appendChild(dot2);

    stage.appendChild(canvas);
    stage.appendChild(hitBoy);
    stage.appendChild(hitPet);
    stage.appendChild(bubbleWrap);
    container.appendChild(stage);

    // ---- layout: pick a whole-number scale that fits the box ----------------------

    function layout() {
      var cw = container.clientWidth;
      var ch = container.clientHeight;
      if (!cw || !ch) return;
      // Small, crisp pixels. Whatever height is left over becomes sky above the art
      // (the stage may overhang the top by up to 12px; that part is empty sky).
      var s = clamp(
        Math.floor((ch + 12) / SP.SCENE_H),
        MIN_SCALE,
        TARGET_SCALE,
      );
      while (s > MIN_SCALE && cw / s < MIN_LOGICAL_WIDTH) s--;
      scale = s;
      W = Math.max(MIN_LOGICAL_WIDTH, Math.floor(cw / scale));
      H = clamp(Math.floor((ch + 12) / scale), SP.SCENE_H, MAX_HEIGHT);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = W * scale + "px";
      canvas.style.height = H * scale + "px";
      stage.style.width = W * scale + "px";
      stage.style.height = H * scale + "px";
      ctx.imageSmoothingEnabled = false;
      scene.setSize(W, H);
      render();
    }

    // ---- drawing ---------------------------------------------------------------------

    function spr(name, x, y, flip) {
      var s = sprite(name);
      if (flip) {
        ctx.save();
        ctx.translate(x + s.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(s, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(s, x, y);
      }
    }

    function glow(cx, cy, r, rgb, alpha) {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(" + rgb + "," + alpha + ")");
      g.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // Erase the top rows with a smooth ramp (only the glow exists at this point).
    function fadeTop(rows) {
      var g = ctx.createLinearGradient(0, 0, 0, rows);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, rows);
      ctx.globalCompositeOperation = "source-over";
    }

    function drawGround(gy) {
      ctx.fillStyle = SP.GROUND.body;
      ctx.fillRect(0, gy, W, H - gy);
      ctx.fillStyle = SP.GROUND.top;
      ctx.fillRect(0, gy, W, 1);
      ctx.fillStyle = SP.GROUND.dot;
      for (var x = 3; x < W; x += 7) {
        ctx.fillRect(x, gy + 2, 2, 1);
        ctx.fillRect(x + 3, gy + 4, 2, 1);
      }
    }

    function draw(f) {
      ctx.clearRect(0, 0, W, H);

      // sky: soft light, then the sun or moon, then stars
      var sk = f.sky;
      glow(
        sk.x + sk.w / 2,
        sk.y + sk.h / 2,
        sk.glow.r,
        sk.glow.rgb,
        sk.glow.alpha,
      );
      fadeTop(18); // the glow is wider than the sky, so melt it away before the top edge
      spr(sk.sprite, sk.x, sk.y);
      for (var i = 0; i < f.stars.length; i++)
        spr(f.stars[i].sprite, f.stars[i].x, f.stars[i].y);

      drawGround(f.groundY);

      // grass tufts and the flower
      spr("tuft", f.boy.benchX + SP.BOY.benchW + 2, f.groundY - 4);
      spr("tuft", W - 24, f.groundY - 4);
      spr(f.flower.sprite, f.flower.x, f.flower.y);

      // the boy: bench, body, arms, laptop lid, head
      var b = f.boy;
      spr("bench", b.benchX, b.benchY);
      spr("body", b.bodyX, b.bodyY);
      spr(b.arms, b.bodyX, b.bodyY);
      spr("lid", b.bodyX + SP.BOY.lidDX, b.bodyY + SP.BOY.lidDY);
      spr(b.head, b.bodyX + SP.BOY.headDX, b.headY);

      // the pet (sprites face right; flip to face left)
      spr(f.pet.sprite, f.pet.x, f.pet.y, f.pet.flip);
    }

    function place(btn, box) {
      btn.style.left = box.x * scale + "px";
      btn.style.top = box.y * scale + "px";
      btn.style.width = box.w * scale + "px";
      btn.style.height = box.h * scale + "px";
    }

    function positionBubble(f) {
      var bb = f.bubble;
      if (!bb) {
        bubbleWrap.hidden = true;
        return;
      }
      if (bubbleText.textContent !== bb.text) bubbleText.textContent = bb.text;
      if (bb.href) {
        bubble.href = bb.href;
        bubble.removeAttribute("aria-disabled");
      } else {
        bubble.removeAttribute("href");
        bubble.setAttribute("aria-disabled", "true");
      }
      var stageW = W * scale;
      var stageH = H * scale;
      bubbleWrap.dataset.target = bb.target;
      bubbleWrap.hidden = false;

      if (bb.target === "boy") {
        // up and to the right of his head, like a thought
        var left = (f.boy.bodyX + SP.BOY.headDX + 12) * scale + 22;
        bubbleWrap.style.left = left + "px";
        bubbleWrap.style.right = "auto";
        bubbleWrap.style.bottom = stageH - (f.boy.headY + 5) * scale + "px";
        bubbleWrap.style.maxWidth =
          Math.max(120, Math.min(280, stageW - left - 6)) + "px";
        bubbleWrap.style.transform = "none";
      } else {
        // centered above the pet, kept inside the scene
        var cx = bb.anchorX * scale;
        bubbleWrap.style.left = clamp(cx, 60, stageW - 60) + "px";
        bubbleWrap.style.right = "auto";
        bubbleWrap.style.bottom = stageH - bb.anchorY * scale + 16 + "px";
        bubbleWrap.style.maxWidth = "200px";
        bubbleWrap.style.transform = "translateX(-50%)";
      }
    }

    function render() {
      var f = scene.getFrame();
      draw(f);
      place(hitBoy, f.boxes.boy);
      place(hitPet, f.boxes.pet);
      positionBubble(f);
    }

    // ---- loop ------------------------------------------------------------------------

    function paused() {
      return (
        document.hidden || !!document.querySelector(".cb-root.cb-open") // command bar is open
      );
    }

    function tick() {
      var now = performance.now();
      var dt = (now - last) / 1000;
      last = now;
      if (paused()) return;
      scene.step(dt, new Date());
      render();
    }

    function start() {
      if (timer || !enabled) return;
      last = performance.now();
      timer = setInterval(tick, TICK_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = 0;
    }

    // ---- hover, focus, click ------------------------------------------------------

    function setHover(target) {
      if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = 0;
      }
      scene.setHover(target);
      scene.step(0, new Date());
      render();
    }

    function leave() {
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () {
        leaveTimer = 0;
        armed = null;
        scene.setHover(null);
        render();
      }, LEAVE_DELAY_MS);
    }

    function openFor(target) {
      var f = scene.getFrame();
      var href = f.bubble && f.bubble.target === target ? f.bubble.href : null;
      if (href && E.isSafeLink(href))
        window.open(href, "_blank", "noopener,noreferrer");
    }

    function wire(btn, target) {
      btn.addEventListener("pointerenter", function (e) {
        lastPointerType = e.pointerType || "mouse";
        setHover(target);
      });
      btn.addEventListener("pointerleave", leave);
      btn.addEventListener("focus", function () {
        setHover(target);
      });
      btn.addEventListener("blur", leave);
      btn.addEventListener("click", function () {
        // On touch screens the first tap only shows the bubble.
        if (lastPointerType === "touch" && armed !== target) {
          armed = target;
          setHover(target);
          return;
        }
        openFor(target);
      });
    }
    wire(hitBoy, "boy");
    wire(hitPet, "pet");

    // keep the bubble open while the pointer is on it
    bubbleWrap.addEventListener("pointerenter", function () {
      var t = bubbleWrap.dataset.target;
      if (t) setHover(t);
    });
    bubbleWrap.addEventListener("pointerleave", leave);
    bubble.addEventListener("click", function (e) {
      if (!bubble.getAttribute("href")) e.preventDefault();
    });

    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape" && scene.getHover()) {
        setHover(null);
      }
    });

    // ---- environment ----------------------------------------------------------------

    var ro = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(layout);
      ro.observe(container);
    } else {
      window.addEventListener("resize", layout);
    }

    function onMotion() {
      scene.setReducedMotion(!!(mq && mq.matches));
      render();
    }
    if (mq && mq.addEventListener) mq.addEventListener("change", onMotion);

    document.addEventListener("visibilitychange", function () {
      last = performance.now(); // no big jump when the tab comes back
    });

    layout();
    start();

    var api = {
      setPet: function (name) {
        scene.setPet(name);
        render();
      },
      setEnabled: function (on) {
        enabled = !!on;
        container.hidden = !enabled;
        if (enabled) {
          layout();
          start();
        } else {
          stop();
        }
      },
      destroy: function () {
        stop();
        if (ro) ro.disconnect();
        if (container.contains(stage)) container.removeChild(stage);
      },
      scene: scene,
    };
    container.hidden = !enabled;
    return (init.current = api);
  }

  return { init: init };
});

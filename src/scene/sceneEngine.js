/**
 * sceneEngine.js
 *
 * Behavior of the home-screen pixel scene. Pure logic, no DOM, testable in Node.
 * Exposes window.FFSceneEngine in the browser, module.exports in Node.
 *
 *   var scene = FFSceneEngine.createScene({ width: 180, height: 76, pet: "cat" });
 *   // height (logical px) can be taller than the art (56). The extra rows are sky above.
 *   scene.step(dtSeconds, new Date());   // call ~10 times per second
 *   var f = scene.getFrame();            // what to draw + where (logical pixels)
 *   scene.setHover("boy" | "pet" | null);
 *
 * Time of day uses the Date you pass in, which is the device's local time, so it
 * follows the user's timezone with no permission needed.
 *   06:00 - 18:00  sun       18:00 - 06:00  moon and stars
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./sceneSprites.js"));
  } else {
    root.FFSceneEngine = factory(root.FFSceneSprites);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (SP) {
  "use strict";

  // ---- Links and messages (change these in one place) ----------------------

  var LINKS = {
    repo: "https://github.com/vikasaurous/FocusFrame",
    donate: "https://buymeacoffee.com/vikasaurous",
  };

  var MESSAGES = {
    boy: [
      "Enjoying FocusFrame? Tell me what to build next",
      "Found a bug? Let me know on GitHub",
      "Got an idea? Open an issue",
      "Like it? A star on GitHub helps a lot",
      "Feedback makes this better. Say hi on GitHub",
    ],
    pet: ["Donate"],
  };

  // ---- Tunables ------------------------------------------------------------

  var CONFIG = {
    benchX: 6, // left edge of the bench
    petMinX: 62, // pet never walks left of this (stays clear of the flower)
    petMaxSpan: 150, // pet never walks further than this from petMinX
    petRightMargin: 4,
    petSpeed: 12, // logical px per second
    petWalkFrame: 0.2, // seconds per walk frame
    petSitFrame: 0.7, // seconds per sit frame (tail swap)
    petSitFrameHover: 0.3,
    petResumeDelay: 0.5, // seconds after hover ends before walking again
    typingFrame: 0.28, // seconds per arm frame
    blinkLength: 0.16,
    flowerFrame: 1.4,
    sunFrame: 0.9, // seconds per sun frame (4 frames = one ray step)
    skyMinX: 72, // sun and moon stay right of this
    skyRightMargin: 8,
    skyTopY: 2, // highest point of the sun / moon arc
    skyHorizonY: 15, // lowest point (sunrise, sunset)
    sunrise: 6, // hours
    sunset: 18,
    starCount: 7,
  };

  // ---- Helpers -------------------------------------------------------------

  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function between(rnd, lo, hi) {
    return lo + rnd() * (hi - lo);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /** https only, no embedded credentials. Same rule as the command bar. */
  function isSafeLink(url) {
    try {
      var u = new URL(url);
      return (
        u.protocol === "https:" && !u.username && !u.password && !!u.hostname
      );
    } catch (e) {
      return false;
    }
  }

  // ---- Time of day: sun and moon -----------------------------------------

  function isNight(date) {
    var h = date.getHours() + date.getMinutes() / 60;
    return h < CONFIG.sunrise || h >= CONFIG.sunset;
  }

  /**
   * Where the sun (day) or moon (night) is. It crosses the sky left to right
   * and rises and sets along a gentle arc. Returns logical pixels (sprite top-left).
   */
  function celestial(date, width, height) {
    var dy = Math.max(0, Math.floor((height || SP.SCENE_H) - SP.SCENE_H));
    var h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    var night = isNight(date);
    var t;
    if (!night) {
      t = (h - CONFIG.sunrise) / (CONFIG.sunset - CONFIG.sunrise);
    } else {
      var since =
        h >= CONFIG.sunset ? h - CONFIG.sunset : h + (24 - CONFIG.sunset);
      t = since / (24 - (CONFIG.sunset - CONFIG.sunrise));
    }
    t = clamp(t, 0, 1);
    var kind = night ? "moon" : "sun";
    var sz = SP.SKY[kind];
    var x0 = CONFIG.skyMinX;
    var x1 = Math.max(x0, width - CONFIG.skyRightMargin - sz.w);
    var arc = Math.sin(Math.PI * t);
    return {
      kind: kind,
      sprite: sz.sprite,
      w: sz.w,
      h: sz.h,
      glow: sz.glow,
      progress: t,
      x: Math.round(x0 + (x1 - x0) * t),
      y: Math.round(
        CONFIG.skyHorizonY +
          dy -
          (CONFIG.skyHorizonY + dy - CONFIG.skyTopY) * arc,
      ),
    };
  }

  /** A few fixed stars for a given width. Same width gives the same stars. */
  function makeStars(width, height) {
    var dy = Math.max(0, Math.floor((height || SP.SCENE_H) - SP.SCENE_H));
    var rnd = mulberry32(width * 7919 + 13 + dy * 31);
    var kinds = ["starA", "starB", "starC", "starB"];
    var out = [];
    var tries = 0;
    while (out.length < CONFIG.starCount && tries < 200) {
      tries++;
      var x = Math.round(between(rnd, CONFIG.skyMinX - 14, width - 8));
      var y = Math.round(between(rnd, 2, 26 + dy));
      var ok = true;
      for (var i = 0; i < out.length; i++) {
        if (Math.abs(out[i].x - x) < 9 && Math.abs(out[i].y - y) < 7)
          ok = false;
      }
      if (ok)
        out.push({
          x: x,
          y: y,
          kind: kinds[out.length % kinds.length],
          phase: rnd() * Math.PI * 2,
        });
    }
    return out;
  }

  // ---- Pet -------------------------------------------------------------------

  function petRange(kind, width) {
    var w = SP.PETS[kind].w;
    var min = CONFIG.petMinX;
    var max = Math.min(
      width - w - CONFIG.petRightMargin,
      min + CONFIG.petMaxSpan,
    );
    if (max < min) max = min;
    return { min: min, max: max };
  }

  function newPet(kind, width, rnd) {
    var r = petRange(kind, width);
    return {
      kind: kind,
      x: between(rnd, r.min, r.max),
      dir: rnd() < 0.5 ? -1 : 1, // -1 faces left, 1 faces right
      mode: "walk",
      modeLeft: between(rnd, 3, 7),
      anim: 0,
      resume: 0,
    };
  }

  function stepPet(p, dt, width, hovered, reduced, rnd) {
    var r = petRange(p.kind, width);
    p.anim += dt;

    if (reduced) {
      p.mode = "sit";
      p.x = clamp(p.x, r.min, r.max);
      return;
    }

    if (hovered) {
      p.mode = "sit";
      p.resume = CONFIG.petResumeDelay;
      return;
    }

    if (p.resume > 0) {
      p.resume -= dt;
      return;
    }

    p.modeLeft -= dt;
    if (p.mode === "walk") {
      p.x += p.dir * CONFIG.petSpeed * dt;
      if (p.x <= r.min) {
        p.x = r.min;
        p.dir = 1;
        if (rnd() < 0.5) _toSit(p, rnd);
      } else if (p.x >= r.max) {
        p.x = r.max;
        p.dir = -1;
        if (rnd() < 0.5) _toSit(p, rnd);
      }
      if (p.mode === "walk" && p.modeLeft <= 0) _toSit(p, rnd);
    } else if (p.modeLeft <= 0) {
      p.mode = "walk";
      p.modeLeft = between(rnd, 3, 8);
      if (rnd() < 0.3) p.dir = -p.dir;
    }
    p.x = clamp(p.x, r.min, r.max);
  }

  function _toSit(p, rnd) {
    p.mode = "sit";
    p.modeLeft = between(rnd, 1.5, 4);
  }

  // ---- Boy ----------------------------------------------------------------------

  function newBoy(rnd) {
    return {
      anim: 0,
      nextBlink: between(rnd, 2, 5),
      blinkLeft: 0,
      nextLook: between(rnd, 5, 10),
      lookLeft: 0,
    };
  }

  function stepBoy(b, dt, hovered, reduced, rnd) {
    b.anim += dt;

    if (hovered) {
      b.lookLeft = Math.max(b.lookLeft, 0.35); // keep looking while hovered, then a moment more
    } else if (b.lookLeft > 0) {
      b.lookLeft -= dt;
    } else if (!reduced) {
      b.nextLook -= dt;
      if (b.nextLook <= 0) {
        b.lookLeft = between(rnd, 1.2, 2);
        b.nextLook = between(rnd, 9, 16);
      }
    }

    if (reduced) {
      b.blinkLeft = 0;
      return;
    }
    if (b.blinkLeft > 0) {
      b.blinkLeft -= dt;
    } else {
      b.nextBlink -= dt;
      if (b.nextBlink <= 0) {
        b.blinkLeft = CONFIG.blinkLength;
        b.nextBlink = between(rnd, 2.2, 5.7);
      }
    }
  }

  // ---- The scene ------------------------------------------------------------------

  /**
   * opts: { width (logical px), pet: "cat"|"dog", reducedMotion, seed, rnd }
   */
  function createScene(opts) {
    var o = opts || {};
    var rnd =
      o.rnd || (o.seed != null ? mulberry32(o.seed >>> 0) : Math.random);
    var width = Math.max(120, Math.floor(o.width || 180));
    var height = Math.max(SP.SCENE_H, Math.floor(o.height || SP.SCENE_H));
    var kind = SP.PETS[o.pet] ? o.pet : "cat";
    var reduced = !!o.reducedMotion;

    var time = 0;
    var date = new Date();
    var hover = null; // "boy" | "pet" | null
    var bubble = null; // { target, text, href }
    var lastMsg = {};

    var pet = newPet(kind, width, rnd);
    var boy = newBoy(rnd);
    var stars = makeStars(width, height);

    function pickMessage(target) {
      var pool = MESSAGES[target];
      if (!pool || !pool.length) return "";
      if (pool.length === 1) return pool[0];
      var i = Math.floor(rnd() * pool.length);
      if (pool[i] === lastMsg[target]) i = (i + 1) % pool.length;
      lastMsg[target] = pool[i];
      return pool[i];
    }

    function linkFor(target) {
      var u = target === "boy" ? LINKS.repo : LINKS.donate;
      return isSafeLink(u) ? u : null;
    }

    return {
      step: function (dt, now) {
        dt = clamp(Number(dt) || 0, 0, 0.5); // a long pause (hidden tab) must not teleport anything
        if (now instanceof Date) date = now;
        time += dt;
        stepBoy(boy, dt, hover === "boy", reduced, rnd);
        stepPet(pet, dt, width, hover === "pet", reduced, rnd);
      },

      setHover: function (target) {
        var next = target === "boy" || target === "pet" ? target : null;
        if (next === hover) return;
        hover = next;
        bubble = next
          ? { target: next, text: pickMessage(next), href: linkFor(next) }
          : null;
      },

      setPet: function (name) {
        if (!SP.PETS[name] || name === pet.kind) return;
        var oldX = pet.x;
        var dir = pet.dir;
        pet = newPet(name, width, rnd);
        pet.dir = dir;
        pet.x = clamp(
          oldX,
          petRange(name, width).min,
          petRange(name, width).max,
        );
      },

      setWidth: function (w) {
        this.setSize(w, height);
      },

      setSize: function (w, h) {
        width = Math.max(120, Math.floor(w || width));
        height = Math.max(SP.SCENE_H, Math.floor(h || height));
        stars = makeStars(width, height);
        var r = petRange(pet.kind, width);
        pet.x = clamp(pet.x, r.min, r.max);
      },

      setReducedMotion: function (v) {
        reduced = !!v;
      },

      getHover: function () {
        return hover;
      },

      /** Everything the renderer needs. Positions are logical pixels. */
      getFrame: function () {
        var looking = hover === "boy" || boy.lookLeft > 0;
        var headBase = looking ? "headFront" : "headDown";
        var head = headBase + (boy.blinkLeft > 0 ? "Blink" : "");
        var typing = !looking && !reduced;
        var arms =
          typing && Math.floor(boy.anim / CONFIG.typingFrame) % 2 === 1
            ? "armsB"
            : "armsA";

        var def = SP.PETS[pet.kind];
        var moving = pet.mode === "walk" && pet.resume <= 0 && !reduced;
        var seq = moving ? def.walk : def.sit;
        var period = moving
          ? CONFIG.petWalkFrame
          : hover === "pet"
            ? CONFIG.petSitFrameHover
            : CONFIG.petSitFrame;
        var idx = reduced ? 0 : Math.floor(pet.anim / period) % seq.length;
        var dy = height - SP.SCENE_H; // extra sky rows above the art
        var groundY = SP.GROUND_Y + dy;
        var petX = Math.round(pet.x);
        var petY = groundY - def.h;

        var night = isNight(date);
        var sky = celestial(date, width, height);
        if (sky.kind === "sun")
          sky.sprite =
            SP.SUN_FRAMES[
              reduced
                ? 0
                : Math.floor(time / CONFIG.sunFrame) % SP.SUN_FRAMES.length
            ];
        var starList = [];
        if (night) {
          for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            // keep stars off the moon
            if (
              Math.abs(s.x - (sky.x + 6)) < 10 &&
              Math.abs(s.y - (sky.y + 6)) < 10
            )
              continue;
            var bright = reduced
              ? true
              : Math.sin(time * 1.3 + s.phase) > -0.35;
            starList.push({
              x: s.x,
              y: s.y,
              sprite: bright ? s.kind : "starC",
            });
          }
        }

        var bx = CONFIG.benchX;
        return {
          width: width,
          height: height,
          dy: dy,
          groundY: groundY,
          night: night,
          sky: sky,
          stars: starList,
          boy: {
            benchX: bx,
            benchY: SP.BOY.benchY + dy,
            bodyX: bx + SP.BOY.bodyDX,
            bodyY: SP.BOY.bodyY + dy,
            head: head,
            arms: arms,
            looking: looking,
            headY: SP.BOY.headY[looking ? "front" : "down"] + dy,
          },
          flower: {
            x: bx + SP.FLOWER.dx,
            y: SP.FLOWER.y + dy,
            sprite:
              SP.FLOWER.frames[
                reduced ? 0 : Math.floor(time / CONFIG.flowerFrame) % 2
              ],
          },
          pet: {
            kind: pet.kind,
            sprite: seq[idx],
            x: petX,
            y: petY,
            w: def.w,
            h: def.h,
            flip: pet.dir < 0, // sprites face right; flip to face left
            moving: moving,
          },
          boxes: {
            boy: {
              x: bx,
              y: 10 + dy,
              w: SP.BOY.benchW,
              h: groundY - (10 + dy),
            },
            pet: { x: petX, y: petY, w: def.w, h: def.h },
          },
          bubble: bubble
            ? {
                target: bubble.target,
                text: bubble.text,
                href: bubble.href,
                // x/y the bubble tail points at (top-center of the thing hovered)
                anchorX:
                  bubble.target === "boy"
                    ? bx + SP.BOY.bodyDX + 10
                    : petX + def.w / 2,
                anchorY: bubble.target === "boy" ? 9 + dy : petY - 2,
              }
            : null,
        };
      },
    };
  }

  return {
    LINKS: LINKS,
    MESSAGES: MESSAGES,
    CONFIG: CONFIG,
    isSafeLink: isSafeLink,
    isNight: isNight,
    celestial: celestial,
    makeStars: makeStars,
    petRange: petRange,
    createScene: createScene,
  };
});

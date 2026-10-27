/**
 * sceneEngine.test.js
 * Run:  node --test src/scene/sceneEngine.test.js
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const SP = require("./sceneSprites.js");
const E = require("./sceneEngine.js");

// Local-time dates, so the tests pass in any timezone.
const at = (h, m = 0, s = 0) => new Date(2026, 9, 26, h, m, s);

function run(scene, seconds, date, dt = 0.1) {
  const frames = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    scene.step(dt, date);
    frames.push(scene.getFrame());
  }
  return frames;
}

test("every sprite name the engine can output exists", () => {
  const names = new Set();
  for (const pet of ["cat", "dog", "dino"]) {
    const scene = E.createScene({ width: 180, pet, seed: 3 });
    for (const hover of [null, "boy", "pet"]) {
      scene.setHover(hover);
      for (const f of run(scene, 40, at(12))) {
        names.add(f.boy.head);
        names.add(f.boy.arms);
        names.add(f.pet.sprite);
        names.add(f.flower.sprite);
        names.add(f.sky.sprite);
      }
    }
    const night = E.createScene({ width: 180, pet, seed: 3 });
    for (const f of run(night, 30, at(23)))
      f.stars.forEach((s) => names.add(s.sprite));
  }
  for (const n of names) assert.ok(SP.SPRITES[n], `missing sprite: ${n}`);
  assert.ok(names.size > 10);
});

test("isNight: sunrise 06:00 and sunset 18:00", () => {
  assert.equal(E.isNight(at(5, 59)), true);
  assert.equal(E.isNight(at(6, 0)), false);
  assert.equal(E.isNight(at(12)), false);
  assert.equal(E.isNight(at(17, 59)), false);
  assert.equal(E.isNight(at(18, 0)), true);
  assert.equal(E.isNight(at(0, 0)), true);
});

test("celestial: sun by day, moon by night", () => {
  assert.equal(E.celestial(at(9), 180).kind, "sun");
  assert.equal(E.celestial(at(21), 180).kind, "moon");
  assert.equal(E.celestial(at(3), 180).kind, "moon");
});

test("celestial: crosses the sky left to right, highest at the middle", () => {
  const W = 200;
  const morning = E.celestial(at(6, 1), W);
  const noon = E.celestial(at(12), W);
  const evening = E.celestial(at(17, 58), W);
  assert.ok(morning.x < noon.x && noon.x < evening.x);
  assert.ok(noon.y < morning.y && noon.y < evening.y); // smaller y is higher
  assert.equal(noon.y, E.CONFIG.skyTopY);

  const dusk = E.celestial(at(18, 1), W);
  const midnight = E.celestial(at(0), W);
  const dawn = E.celestial(at(5, 58), W);
  assert.ok(dusk.x < midnight.x && midnight.x < dawn.x);
  assert.ok(midnight.y < dusk.y && midnight.y < dawn.y);
});

test("celestial: stays inside the sky area and clear of the boy, every minute of the day", () => {
  for (const W of [120, 180, 260]) {
    for (let m = 0; m < 24 * 60; m++) {
      const c = E.celestial(at(Math.floor(m / 60), m % 60), W);
      assert.ok(c.x >= E.CONFIG.skyMinX, `x too far left at ${m}`);
      assert.ok(
        c.x + c.w <=
          Math.max(W - E.CONFIG.skyRightMargin, E.CONFIG.skyMinX + c.w),
        `x too far right at ${m}`,
      );
      assert.ok(
        c.y >= E.CONFIG.skyTopY && c.y <= E.CONFIG.skyHorizonY,
        `y out of range at ${m}`,
      );
    }
  }
});

test("stars: only at night, deterministic, never on the moon", () => {
  const day = E.createScene({ width: 180, seed: 1 });
  day.step(0.1, at(13));
  assert.equal(day.getFrame().stars.length, 0);

  const a = E.createScene({ width: 180, seed: 1 });
  const b = E.createScene({ width: 180, seed: 9 }); // different seed, same width: same stars
  a.step(0.1, at(22));
  b.step(0.1, at(22));
  const fa = a.getFrame();
  assert.ok(fa.stars.length >= 4);
  assert.deepEqual(
    fa.stars.map((s) => [s.x, s.y]),
    b.getFrame().stars.map((s) => [s.x, s.y]),
  );
  for (const s of fa.stars) {
    const far =
      Math.abs(s.x - (fa.sky.x + 6)) >= 10 ||
      Math.abs(s.y - (fa.sky.y + 6)) >= 10;
    assert.ok(far, "star overlaps the moon");
    assert.ok(s.x >= E.CONFIG.skyMinX - 14, "star over the boy");
  }
});

test("pet: stays inside its range, turns around, and keeps both feet on the ground", () => {
  for (const pet of ["cat", "dog"]) {
    for (const W of [130, 180, 400]) {
      const scene = E.createScene({ width: W, pet, seed: 5 });
      const r = E.petRange(pet, W);
      let turns = 0;
      let last = null;
      let minSeen = Infinity;
      let maxSeen = -Infinity;
      for (const f of run(scene, 400, at(12))) {
        assert.ok(
          f.pet.x >= r.min && f.pet.x <= r.max,
          `${pet} left its range at W=${W}`,
        );
        assert.equal(f.pet.y + f.pet.h, f.groundY);
        if (last !== null && f.pet.flip !== last) turns++;
        last = f.pet.flip;
        minSeen = Math.min(minSeen, f.pet.x);
        maxSeen = Math.max(maxSeen, f.pet.x);
      }
      assert.ok(turns >= 2, `${pet} never turned around at W=${W}`);
      assert.ok(maxSeen - minSeen > 20, `${pet} barely moved at W=${W}`);
    }
  }
});

test("pet: range is capped on very wide screens and never overlaps the flower", () => {
  const r = E.petRange("cat", 2000);
  assert.equal(r.max - r.min, E.CONFIG.petMaxSpan);
  const flowerRight = E.CONFIG.benchX + SP.FLOWER.dx + SP.sizeOf("flowerA").w;
  assert.ok(r.min > flowerRight);
});

test("pet: both walk frames show up while walking, and the sprite flips with direction", () => {
  const scene = E.createScene({ width: 180, pet: "cat", seed: 2 });
  const seen = new Set();
  let flipped = false;
  for (const f of run(scene, 120, at(12))) {
    if (f.pet.moving) {
      seen.add(f.pet.sprite);
      if (f.pet.flip) flipped = true;
    }
  }
  assert.ok(seen.has("catWalkA") && seen.has("catWalkB"));
  assert.ok(flipped);
});

test("pet: hovering stops it and sits it down; it walks again afterwards", () => {
  const scene = E.createScene({ width: 180, pet: "dog", seed: 4 });
  run(scene, 2, at(12)); // let it get going
  scene.setHover("pet");
  scene.step(0.1, at(12));
  const x0 = scene.getFrame().pet.x;
  const frames = run(scene, 3, at(12));
  assert.ok(
    frames.every((f) => f.pet.x === x0),
    "pet moved while hovered",
  );
  assert.ok(frames.every((f) => !f.pet.moving));
  assert.ok(frames.every((f) => SP.PETS.dog.sit.includes(f.pet.sprite)));

  scene.setHover(null);
  const after = run(scene, 4, at(12));
  assert.ok(
    after.some((f) => f.pet.moving),
    "pet never resumed walking",
  );
});

test("boy: types with his head down, and looks at you now and then", () => {
  const scene = E.createScene({ width: 180, seed: 11 });
  const frames = run(scene, 180, at(12));
  assert.equal(frames[0].boy.head.startsWith("headDown"), true);
  // count separate looks, and measure how long each lasts
  let looks = 0;
  let run0 = 0;
  let longest = 0;
  let prev = false;
  for (const f of frames) {
    if (f.boy.looking) {
      run0 += 0.1;
      if (!prev) looks++;
    } else {
      longest = Math.max(longest, run0);
      run0 = 0;
    }
    prev = f.boy.looking;
  }
  assert.ok(looks >= 6 && looks <= 25, `unexpected number of looks: ${looks}`);
  assert.ok(longest <= 2.4, `a look lasted too long: ${longest}`);
  assert.ok(longest >= 1, `looks are too short: ${longest}`);
});

test("boy: both typing frames and blinks appear", () => {
  const scene = E.createScene({ width: 180, seed: 6 });
  const arms = new Set();
  const heads = new Set();
  for (const f of run(scene, 60, at(12))) {
    arms.add(f.boy.arms);
    heads.add(f.boy.head);
  }
  assert.ok(arms.has("armsA") && arms.has("armsB"));
  assert.ok(heads.has("headDown") && heads.has("headDownBlink"));
});

test("boy: hovering makes him look at you right away, and he goes back to work after", () => {
  const scene = E.createScene({ width: 180, seed: 8 });
  run(scene, 1, at(12));
  scene.setHover("boy");
  scene.step(0.1, at(12));
  assert.equal(scene.getFrame().boy.looking, true);
  assert.ok(scene.getFrame().boy.head.startsWith("headFront"));
  run(scene, 5, at(12));
  assert.equal(scene.getFrame().boy.looking, true); // still looking while hovered
  scene.setHover(null);
  const after = run(scene, 1.2, at(12));
  assert.equal(after[after.length - 1].boy.looking, false);
});

test("reduced motion: nothing moves on its own, hover still works", () => {
  const scene = E.createScene({
    width: 180,
    pet: "cat",
    seed: 7,
    reducedMotion: true,
  });
  const frames = run(scene, 120, at(23));
  const x0 = frames[0].pet.x;
  assert.ok(frames.every((f) => f.pet.x === x0));
  assert.ok(frames.every((f) => !f.pet.moving));
  assert.ok(frames.every((f) => !f.boy.looking));
  assert.ok(
    frames.every((f) => f.boy.head === "headDown" && f.boy.arms === "armsA"),
  );
  assert.ok(frames.every((f) => f.flower.sprite === "flowerA"));
  assert.ok(frames.every((f) => f.stars.length > 0)); // night: stars are shown, and never twinkle off
  scene.setHover("boy");
  scene.step(0.1, at(23));
  assert.equal(scene.getFrame().boy.looking, true);
});

test("bubbles: boy shows feedback text and the repo link, pet says Donate", () => {
  const scene = E.createScene({ width: 180, seed: 1 });
  assert.equal(scene.getFrame().bubble, null);

  scene.setHover("boy");
  let b = scene.getFrame().bubble;
  assert.equal(b.target, "boy");
  assert.ok(E.MESSAGES.boy.includes(b.text));
  assert.equal(b.href, E.LINKS.repo);
  assert.ok(E.isSafeLink(b.href));

  scene.setHover("pet");
  b = scene.getFrame().bubble;
  assert.equal(b.target, "pet");
  assert.equal(b.text, "Donate");
  assert.equal(b.href, E.LINKS.donate);

  scene.setHover(null);
  assert.equal(scene.getFrame().bubble, null);
});

test("bubbles: the boy never repeats the same message twice in a row", () => {
  const scene = E.createScene({ width: 180, seed: 12 });
  let prev = null;
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    scene.setHover("boy");
    const t = scene.getFrame().bubble.text;
    assert.notEqual(t, prev);
    prev = t;
    seen.add(t);
    scene.setHover(null);
  }
  assert.ok(seen.size >= 3);
});

test("bubbles: anchor points sit above what you hover", () => {
  const scene = E.createScene({ width: 180, seed: 1 });
  scene.step(0.1, at(12));
  scene.setHover("boy");
  const f1 = scene.getFrame();
  assert.ok(f1.bubble.anchorY < f1.boxes.boy.y + 2);
  scene.setHover("pet");
  const f2 = scene.getFrame();
  assert.ok(f2.bubble.anchorY < f2.boxes.pet.y);
  assert.ok(
    f2.bubble.anchorX >= f2.boxes.pet.x &&
      f2.bubble.anchorX <= f2.boxes.pet.x + f2.boxes.pet.w,
  );
});

test("isSafeLink: https only, no credentials", () => {
  assert.ok(E.isSafeLink("https://github.com/vikasaurous/FocusFrame"));
  assert.ok(!E.isSafeLink("http://github.com"));
  assert.ok(!E.isSafeLink("javascript:alert(1)"));
  assert.ok(!E.isSafeLink("https://user:pw@example.com"));
  assert.ok(!E.isSafeLink(""));
  assert.ok(!E.isSafeLink(null));
});

test("shipped links are safe", () => {
  assert.ok(E.isSafeLink(E.LINKS.repo));
  assert.ok(E.isSafeLink(E.LINKS.donate));
});

test("setPet swaps the pet and keeps it in range; setWidth re-clamps it", () => {
  const scene = E.createScene({ width: 300, pet: "cat", seed: 3 });
  run(scene, 20, at(12));
  scene.setPet("dog");
  const f = scene.getFrame();
  assert.equal(f.pet.kind, "dog");
  assert.ok(SP.PETS.dog.walk.concat(SP.PETS.dog.sit).includes(f.pet.sprite));
  scene.setPet("unicorn"); // ignored
  assert.equal(scene.getFrame().pet.kind, "dog");

  scene.setWidth(130);
  const r = E.petRange("dog", 130);
  const f2 = scene.getFrame();
  assert.ok(f2.pet.x >= r.min && f2.pet.x <= r.max);
  assert.equal(f2.width, 130);
});

test("a long pause (hidden tab) does not teleport anything", () => {
  const scene = E.createScene({ width: 180, pet: "cat", seed: 2 });
  run(scene, 1, at(12));
  const x0 = scene.getFrame().pet.x;
  scene.step(600, at(12)); // ten minutes in one step: capped
  assert.ok(
    Math.abs(scene.getFrame().pet.x - x0) <= E.CONFIG.petSpeed * 0.5 + 1,
  );
});

test("same seed gives the same scene", () => {
  const a = E.createScene({ width: 180, pet: "dog", seed: 77 });
  const b = E.createScene({ width: 180, pet: "dog", seed: 77 });
  const fa = run(a, 60, at(12)).map((f) => [
    f.pet.x,
    f.pet.sprite,
    f.boy.head,
    f.boy.arms,
  ]);
  const fb = run(b, 60, at(12)).map((f) => [
    f.pet.x,
    f.pet.sprite,
    f.boy.head,
    f.boy.arms,
  ]);
  assert.deepEqual(fa, fb);
});

test("hit boxes cover the boy and the pet, and stay inside the scene", () => {
  const scene = E.createScene({ width: 180, pet: "cat", seed: 1 });
  for (const f of run(scene, 60, at(12))) {
    for (const k of ["boy", "pet"]) {
      const b = f.boxes[k];
      assert.ok(
        b.x >= 0 &&
          b.y >= 0 &&
          b.x + b.w <= f.width &&
          b.y + b.h <= f.height + 1,
        `${k} box outside scene`,
      );
    }
  }
});

test("taller scene: everything stays standing on the ground, which moves down with the extra sky", () => {
  for (const height of [56, 76, 96]) {
    const scene = E.createScene({ width: 180, height, pet: "dog", seed: 3 });
    const dy = height - SP.SCENE_H;
    for (const f of run(scene, 30, at(12))) {
      assert.equal(f.height, height);
      assert.equal(f.dy, dy);
      assert.equal(f.groundY, SP.GROUND_Y + dy);
      assert.equal(f.pet.y + f.pet.h, f.groundY, "pet not on the ground");
      assert.equal(
        f.flower.y + SP.sizeOf(f.flower.sprite).h,
        f.groundY,
        "flower not on the ground",
      );
      assert.equal(
        f.boy.benchY + SP.sizeOf("bench").h,
        f.groundY,
        "bench not on the ground",
      );
      for (const k of ["boy", "pet"]) {
        const b = f.boxes[k];
        assert.ok(
          b.y >= 0 && b.y + b.h <= f.height + 1,
          `${k} box outside the scene at height ${height}`,
        );
      }
    }
  }
});

test("taller scene: the sun and moon use the extra sky, and still stay clear of the ground and the boy", () => {
  for (const height of [56, 76, 96]) {
    const dy = height - SP.SCENE_H;
    let lowest = 0;
    for (let m = 0; m < 24 * 60; m += 5) {
      const c = E.celestial(at(Math.floor(m / 60), m % 60), 200, height);
      assert.ok(c.y >= E.CONFIG.skyTopY, "above the scene");
      assert.ok(c.y <= E.CONFIG.skyHorizonY + dy, "below its horizon");
      assert.ok(c.y + c.h <= SP.GROUND_Y + dy, "sinks into the ground");
      assert.ok(c.x >= E.CONFIG.skyMinX, "over the boy");
      lowest = Math.max(lowest, c.y);
    }
    assert.ok(
      lowest >= E.CONFIG.skyHorizonY + dy - 3,
      "never gets near its horizon",
    );
  }
  const noon = E.celestial(at(12), 200, 96);
  assert.equal(noon.y, E.CONFIG.skyTopY);
});

test("taller scene: stars use the taller sky and still avoid the boy", () => {
  const stars = E.makeStars(200, 96);
  assert.ok(stars.length >= 5);
  assert.ok(
    Math.max(...stars.map((s) => s.y)) > 26,
    "stars never use the extra sky",
  );
  for (const s of stars) assert.ok(s.x >= E.CONFIG.skyMinX - 14);
});

test("setSize resizes the scene and re-clamps the pet", () => {
  const scene = E.createScene({ width: 300, height: 56, pet: "cat", seed: 3 });
  run(scene, 10, at(12));
  scene.setSize(130, 80);
  const f = scene.getFrame();
  assert.equal(f.width, 130);
  assert.equal(f.height, 80);
  const r = E.petRange("cat", 130);
  assert.ok(f.pet.x >= r.min && f.pet.x <= r.max);
  scene.setSize(200, 10); // can never be shorter than the art
  assert.equal(scene.getFrame().height, SP.SCENE_H);
});

test("sun art: bigger, with lighter circles around the core and no rays", () => {
  const sun = SP.SPRITES.sunDisc;
  assert.ok(sun.length >= 21 && sun[0].length >= 21, "sun is not bigger");
  // symmetrical, and the very middle is the pale core
  const mid = sun[Math.floor(sun.length / 2)];
  assert.equal(mid, mid.split("").reverse().join(""));
  assert.equal(mid[Math.floor(mid.length / 2)], "q");
  // going outward from the edge of the core, each circle is a lighter shade
  const lum = (hex) => {
    const n = parseInt(hex.slice(1, 7), 16);
    return (
      0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
    );
  };
  const order = ["v", "z", "Z", "Q"];
  for (let i = 1; i < order.length; i++)
    assert.ok(
      lum(SP.PALETTE[order[i]]) > lum(SP.PALETTE[order[i - 1]]),
      `${order[i]} should be lighter than ${order[i - 1]}`,
    );
  // no rays: every row has one unbroken run of pixels (no lone pixels floating outside the circle)
  for (const row of sun) {
    const runs = row
      .replace(/^\.+|\.+$/g, "")
      .split(/\.+/)
      .filter(Boolean);
    assert.ok(runs.length <= 1, `row has separate pieces (a ray?): ${row}`);
  }
});

test("art: the flower is small next to the boy, and the bench is darker than the hoodie", () => {
  const flower = SP.sizeOf("flowerA");
  const bench = SP.sizeOf("bench");
  assert.ok(flower.h <= 12, "flower is too tall");
  assert.ok(
    flower.h < bench.h / 2,
    "flower should be well under half the bench height",
  );
  const lum = (hex) => {
    const n = parseInt(hex.slice(1, 7), 16);
    return (
      0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
    );
  };
  for (const ch of ["w", "x", "X"])
    assert.ok(lum(SP.PALETTE[ch]) < 150, `bench color ${ch} is too light`);
  assert.ok(lum(SP.PALETTE.H) > 220); // the hoodie stays white
});

/**
 * snakeEngine.test.js
 *
 * Run:  node --test src/snake/snakeEngine.test.js
 * Node built-in test runner, no dependencies. Seeded RNG keeps it deterministic.
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSnake } = require("./snakeEngine.js");

const COLS = 26;

function seededRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function adjacent(a, b) {
  const d =
    Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) +
    Math.abs((a % COLS) - (b % COLS));
  return d === 1;
}

/** Body invariants: in range, no overlap, max length, consecutive cells adjacent. */
function assertBody(snake, wc, label) {
  const body = snake.getBody();
  assert.ok(body.length <= 10, `${label}: body longer than 10`);
  assert.equal(
    new Set(body).size,
    body.length,
    `${label}: body overlaps itself`,
  );
  for (let i = 0; i < body.length; i++) {
    assert.ok(
      body[i] >= 0 && body[i] < wc,
      `${label}: cell ${body[i]} outside [0, ${wc})`,
    );
    if (i < body.length - 1) {
      assert.ok(
        adjacent(body[i], body[i + 1]),
        `${label}: cells ${body[i]} and ${body[i + 1]} not adjacent`,
      );
    }
  }
}

function runToEnd(snake, wc, label, cap = 20000) {
  let n = 0;
  while (!snake.isComplete() && n < cap) {
    const r = snake.step();
    n++;
    assertBody(snake, wc, `${label} step ${n}`);
    if (r.cycleComplete) break;
  }
  return n;
}

test("walkableCount=0: complete immediately, no body", () => {
  const s = createSnake({ cols: COLS, walkableCount: 0, rng: seededRng(1) });
  assert.ok(s.isComplete());
  assert.equal(s.getBody().length, 0);
  const r = s.step();
  assert.ok(r.cycleComplete);
  assert.ok(!r.moved);
  assert.equal(r.head, null);
});

test("walkableCount=1: complete immediately on the single cell", () => {
  const s = createSnake({ cols: COLS, walkableCount: 1, rng: seededRng(1) });
  assert.deepEqual(s.getBody(), [0]);
  assert.ok(s.isComplete());
  assert.ok(!s.step().moved);
});

test("walkableCount=2: eats both cells then completes", () => {
  const s = createSnake({ cols: COLS, walkableCount: 2, rng: seededRng(5) });
  runToEnd(s, 2, "wc=2");
  assert.equal(s.getEaten().size, 2);
  assert.ok(s.isComplete());
});

test("start cell is random: different seeds give different starts", () => {
  const starts = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    starts.add(
      createSnake({
        cols: COLS,
        walkableCount: 296,
        rng: seededRng(seed),
      }).getBody()[0],
    );
  }
  assert.ok(
    starts.size > 10,
    `only ${starts.size} distinct starts across 30 seeds`,
  );
});

test("start cell is always walkable", () => {
  for (const wc of [1, 2, 3, 26, 27, 100, 296, 365]) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createSnake({
        cols: COLS,
        walkableCount: wc,
        rng: seededRng(seed),
      });
      const head = s.getBody()[0];
      assert.ok(head >= 0 && head < wc, `wc=${wc}: start ${head} out of range`);
    }
  }
});

test("invariants hold and cycle completes for many sizes and seeds", () => {
  const sizes = [3, 4, 5, 10, 25, 26, 27, 28, 52, 53, 100, 200, 296, 364, 365];
  for (const wc of sizes) {
    for (let seed = 1; seed <= 15; seed++) {
      const s = createSnake({
        cols: COLS,
        walkableCount: wc,
        rng: seededRng(seed * 13 + wc),
      });
      runToEnd(s, wc, `wc=${wc} seed=${seed}`);
      assert.ok(s.isComplete(), `wc=${wc} seed=${seed}: not complete`);
      assert.equal(
        s.getEaten().size,
        wc,
        `wc=${wc} seed=${seed}: eaten ${s.getEaten().size}`,
      );
    }
  }
});

test("never steps onto future or today cells", () => {
  const wc = 100;
  const s = createSnake({ cols: COLS, walkableCount: wc, rng: seededRng(13) });
  let n = 0;
  while (!s.isComplete() && n++ < 5000) {
    const r = s.step();
    if (r.head !== null) assert.ok(r.head < wc, `head ${r.head} >= ${wc}`);
  }
});

test("eatenAdded is true only on first visit to a cell", () => {
  const s = createSnake({ cols: COLS, walkableCount: 60, rng: seededRng(3) });
  const visited = new Set(s.getBody());
  let n = 0;
  while (!s.isComplete() && n++ < 5000) {
    const r = s.step();
    if (!r.moved) break;
    if (visited.has(r.head)) {
      assert.ok(!r.eatenAdded, `revisit of ${r.head} marked as eaten`);
    } else {
      assert.ok(r.eatenAdded, `first visit of ${r.head} not marked as eaten`);
      visited.add(r.head);
    }
  }
});

test("snake grows to 10 and stays capped", () => {
  const s = createSnake({ cols: COLS, walkableCount: 296, rng: seededRng(17) });
  let max = 0,
    n = 0;
  while (!s.isComplete() && n++ < 5000) {
    s.step();
    max = Math.max(max, s.getBody().length);
  }
  assert.equal(max, 10);
});

test("eaten set grows monotonically within a cycle", () => {
  const s = createSnake({ cols: COLS, walkableCount: 80, rng: seededRng(19) });
  let prev = s.getEaten().size,
    n = 0;
  while (!s.isComplete() && n++ < 5000) {
    s.step();
    const size = s.getEaten().size;
    assert.ok(size >= prev, "eaten set shrank");
    prev = size;
  }
});

test("thin last row (wc=27, one cell on row 2) still completes", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = createSnake({
      cols: COLS,
      walkableCount: 27,
      rng: seededRng(seed),
    });
    runToEnd(s, 27, `wc=27 seed=${seed}`);
    assert.equal(s.getEaten().size, 27, `seed ${seed}: left cell 26 uneaten`);
  }
});

test("updateWalkable: re-opens a completed cycle when a new day appears", () => {
  const s = createSnake({ cols: COLS, walkableCount: 10, rng: seededRng(31) });
  runToEnd(s, 10, "phase 1");
  assert.ok(s.isComplete());
  s.updateWalkable(11);
  assert.ok(!s.isComplete(), "new walkable cell should re-open the cycle");
  runToEnd(s, 11, "phase 2");
  assert.equal(s.getEaten().size, 11);
});

test("updateWalkable: ignores equal or smaller counts", () => {
  const s = createSnake({ cols: COLS, walkableCount: 50, rng: seededRng(7) });
  const before = s.getBody();
  s.updateWalkable(50);
  s.updateWalkable(10);
  assert.deepEqual(s.getBody(), before);
  assert.ok(!s.isComplete());
});

test("updateWalkable from 0 starts a fresh snake", () => {
  const s = createSnake({ cols: COLS, walkableCount: 0, rng: seededRng(2) });
  assert.ok(s.isComplete());
  s.updateWalkable(5);
  assert.ok(s.getBody().length >= 1);
  assert.ok(!s.isComplete());
});

test("reset: clears state and respects the new size", () => {
  const s = createSnake({ cols: COLS, walkableCount: 50, rng: seededRng(23) });
  for (let i = 0; i < 100; i++) s.step();
  s.reset(10, 20);
  assert.ok(!s.isComplete());
  assert.equal(s.getEaten().size, 1);
  for (const cell of s.getBody()) assert.ok(cell >= 0 && cell < 20);
});

test("determinism: same seed gives same path", () => {
  const a = createSnake({ cols: COLS, walkableCount: 100, rng: seededRng(42) });
  const b = createSnake({ cols: COLS, walkableCount: 100, rng: seededRng(42) });
  assert.deepEqual(a.getBody(), b.getBody());
  for (let i = 0; i < 80; i++) {
    const ra = a.step(),
      rb = b.step();
    assert.equal(ra.head, rb.head, `head mismatch at step ${i}`);
  }
});

test("snake is not a raster sweep: it turns", () => {
  // Over a full cycle a wandering snake must make many direction changes.
  const s = createSnake({ cols: COLS, walkableCount: 296, rng: seededRng(8) });
  let turns = 0,
    lastDelta = null,
    n = 0;
  while (!s.isComplete() && n++ < 5000) {
    const before = s.getBody()[0];
    const r = s.step();
    if (!r.moved || r.reversed) {
      lastDelta = null;
      continue;
    }
    const delta = r.head - before;
    if (lastDelta !== null && delta !== lastDelta) turns++;
    lastDelta = delta;
  }
  assert.ok(turns > 20, `only ${turns} turns`);
});

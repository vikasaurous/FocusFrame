/**
 * tools/make-banner.mjs
 *
 * Writes docs/banner.svg, the README banner. Every pixel of the scene is
 * drawn from the extension's own sprite data (src/scene/sceneSprites.js), so
 * the banner always matches the real art. The wordmark uses a small built-in
 * 5x7 pixel font, so the SVG needs no web fonts and renders the same everywhere.
 *
 * Run from the project folder:   node tools/make-banner.mjs
 * No dependencies. Needs Node 22 or newer.
 */
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = require(path.join(root, "src/scene/sceneSprites.js"));
const Engine = require(path.join(root, "src/scene/sceneEngine.js"));

// ---- layout ----------------------------------------------------------------
const VIEW_W = 1200;
const VIEW_H = 340;
const BG = "#0d0e0f"; // --ground in styles.css
const PAPER = "#f2f1ed"; // --paper
const ACCENT = "#ef6758"; // --accent (coral)
const MUTED = "#a6a6a9"; // --soft

const SCENE_W = 130; // logical pixels
const SCENE_SCALE = 4;
const SCENE_X = VIEW_W - SCENE_W * SCENE_SCALE - 40;
const SCENE_Y = Math.round((VIEW_H - SP.SCENE_H * SCENE_SCALE) / 2);

// ---- tiny SVG helpers --------------------------------------------------------
function colorParts(hex) {
  // "#rrggbb" or "#rrggbbaa" -> { fill, opacity }
  const h = hex.replace("#", "");
  const fill = "#" + h.slice(0, 6);
  const alpha = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
  return { fill, opacity: alpha };
}

// Merge each row's runs of one color into a single rect; group by color.
function pixelsToPaths(cells) {
  // cells: Map<"fill|opacity", Array<[x, y, w]>>
  let out = "";
  for (const [key, runs] of cells) {
    const [fill, opacity] = key.split("|");
    const d = runs.map(([x, y, w]) => `M${x} ${y}h${w}v1h-${w}z`).join("");
    out += `<path fill="${fill}"${opacity === "1" ? "" : ` fill-opacity="${opacity}"`} d="${d}"/>`;
  }
  return out;
}

function addRun(cells, color, x, y, w) {
  const { fill, opacity } = colorParts(color);
  const key = `${fill}|${Number(opacity.toFixed(3))}`;
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push([x, y, w]);
}

function addSprite(cells, name, ox, oy, flip) {
  const rows = SP.SPRITES[name];
  const width = rows[0].length;
  rows.forEach((row, y) => {
    let x = 0;
    while (x < width) {
      const ch = row[x];
      if (ch === "." || !SP.PALETTE[ch]) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < width && row[end] === ch) end += 1;
      const px = flip ? ox + (width - end) : ox + x;
      addRun(cells, SP.PALETTE[ch], px, oy + y, end - x);
      x = end;
    }
  });
}

function addRect(cells, color, x, y, w, h) {
  for (let j = 0; j < h; j++) addRun(cells, color, x, y + j, w);
}

// ---- 5x7 pixel font (only the characters the banner uses) --------------------
const FONT = {
  A: [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  B: ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."],
  C: [".XXXX", "X....", "X....", "X....", "X....", "X....", ".XXXX"],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  F: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "X...."],
  I: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "XXXXX"],
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  M: ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"],
  N: ["X...X", "XX..X", "X.X.X", "X..XX", "X...X", "X...X", "X...X"],
  O: [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  P: ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."],
  R: ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
  U: ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  W: ["X...X", "X...X", "X...X", "X.X.X", "X.X.X", "XX.XX", "X...X"],
  X: ["X...X", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "X...X"],
  "-": [".....", ".....", ".....", ".XXX.", ".....", ".....", "....."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

function addText(cells, text, x, y, scale, color) {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) throw new Error(`No glyph for "${ch}" in the banner font`);
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < 5; gx++) {
        if (row[gx] === "X") addRect(cells, color, cx + gx * scale, y + gy * scale, scale, scale);
      }
    });
    cx += 6 * scale;
  }
}

// ---- compose -----------------------------------------------------------------
function buildScene(spriteOverrides = {}) {
  // Use the real engine for placement, at midday so the sun is out.
  const scene = Engine.createScene({ width: SCENE_W, height: SP.SCENE_H });
  for (let i = 0; i < 20; i++) scene.step(0.1, new Date(2026, 5, 21, 13, 0, 0));
  const f = scene.getFrame();
  const cells = new Map();

  // sky body
  addSprite(cells, spriteOverrides.sky || f.sky.sprite, f.sky.x, f.sky.y);
  // ground, same recipe as sceneRenderer.drawGround
  addRect(cells, SP.GROUND.body, 0, f.groundY, SCENE_W, SP.SCENE_H - f.groundY);
  addRect(cells, SP.GROUND.top, 0, f.groundY, SCENE_W, 1);
  for (let x = 3; x < SCENE_W; x += 7) {
    addRect(cells, SP.GROUND.dot, x, f.groundY + 2, 2, 1);
    addRect(cells, SP.GROUND.dot, x + 3, f.groundY + 4, 2, 1);
  }
  const b = f.boy;
  addSprite(cells, "tuft", b.benchX + SP.BOY.benchW + 2, f.groundY - 4);
  addSprite(cells, "tuft", SCENE_W - 24, f.groundY - 4);
  addSprite(cells, f.flower.sprite, f.flower.x, f.flower.y);
  addSprite(cells, "bench", b.benchX, b.benchY);
  addSprite(cells, "body", b.bodyX, b.bodyY);
  addSprite(cells, b.arms, b.bodyX, b.bodyY);
  addSprite(cells, "lid", b.bodyX + SP.BOY.lidDX, b.bodyY + SP.BOY.lidDY);
  addSprite(cells, b.head, b.bodyX + SP.BOY.headDX, b.headY);
  addSprite(cells, f.pet.sprite, f.pet.x, f.pet.y, f.pet.flip);
  return { cells, sky: f.sky };
}

function buildSvg() {
  // Four sun frames cycle like the real extension (rays turn a quarter step each).
  const frames = SP.SUN_FRAMES.map((name) => buildScene({ sky: name }));
  const dur = 3.6; // seconds per full cycle
  const step = dur / frames.length;

  const sceneGroups = frames
    .map(({ cells }, i) => {
      // Frame i is visible only during its quarter of the cycle.
      const values = frames.map((_, k) => (k === i ? "1" : "0")).join(";");
      const anim = `<animate attributeName="opacity" values="${values}" keyTimes="0;0.25;0.5;0.75" calcMode="discrete" dur="${dur}s" repeatCount="indefinite"/>`;
      return `<g opacity="${i === 0 ? 1 : 0}">${anim}${pixelsToPaths(cells)}</g>`;
    })
    .join("");
  void step;

  const text = new Map();
  const markScale = 8;
  const markY = 118;
  const markX = 56;
  addText(text, "FOCUS", markX, markY, markScale, PAPER);
  addText(text, "FRAME", markX + 5 * 6 * markScale, markY, markScale, ACCENT);
  const tag = "A CALM PIXEL-ART NEW TAB";
  const tagScale = 3;
  addText(text, tag, markX, markY + 7 * markScale + 28, tagScale, MUTED);
  void textWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${VIEW_W}" height="${VIEW_H}" role="img" aria-labelledby="t d" shape-rendering="crispEdges">
<title id="t">FocusFrame</title>
<desc id="d">FocusFrame, a calm pixel-art new tab. A pixel person types on a laptop on a bench beside a flower and a cat, under a slowly turning sun.</desc>
<rect width="${VIEW_W}" height="${VIEW_H}" fill="${BG}"/>
${pixelsToPaths(text)}
<g transform="translate(${SCENE_X} ${SCENE_Y}) scale(${SCENE_SCALE})">${sceneGroups}</g>
</svg>
`;
}

const outDir = path.join(root, "docs");
await mkdir(outDir, { recursive: true });
const svg = buildSvg();
await writeFile(path.join(outDir, "banner.svg"), svg);
console.log(`docs/banner.svg written (${(svg.length / 1024).toFixed(1)} KB)`);

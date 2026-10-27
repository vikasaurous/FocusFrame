/**
 * sceneSprites.js
 *
 * Pixel art for the home-screen scene. Data only, no DOM. Testable in Node.
 * Exposes window.FFSceneSprites in the browser, module.exports in Node.
 *
 * Each sprite is an array of equal-length strings, one character per pixel.
 * "." is transparent. Other characters are looked up in PALETTE.
 *
 * Look: everything is white / silver. Only the sun is warm (a yellow core with
 * soft, lighter circles around it). Nothing here depends on the page accent color.
 * All art is original. Pets face RIGHT; flip them at draw time to face left.
 *
 * Scene layout (logical pixels; the canvas is scaled up with crisp pixels):
 *   SCENE_H = 56 tall, ground surface at y = GROUND_Y (50).
 *   Boy draw order: bench, body, arms, lid, head.
 *   Sky things (sun, moon, stars) are drawn first, behind everything.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.FFSceneSprites = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SCENE_H = 56;
  var GROUND_Y = 50;

  var PALETTE = {
    k: "#6c717d",
    K: "#8f95a2",
    s: "#eceef2",
    S: "#c6cad3",
    e: "#1b1d22",
    m: "#6b707b",
    P: "#d3d6dd",
    H: "#f3f4f6",
    h: "#b7bcc7",
    A: "#ffffff",
    J: "#9aa0ad",
    j: "#757b88",
    F: "#fbfbfc",
    f: "#a3a9b6",
    l: "#d2d6dd",
    W: "#fafafb",
    D: "#7b818d",
    w: "#5b6070",
    x: "#757b8b",
    X: "#3b3f4b",
    o: "#c3c7cf",
    O: "#9399a5",
    p: "#e3e5ea",
    n: "#aeb3bd",
    c: "#f6f7f9",
    b: "#eceef1",
    B: "#a7adb9",
    N: "#3b3e46",
    C: "#c2c6cf",
    g: "#f6f7f9",
    G: "#c7ccd6",
    y: "#9aa0ad",
    t: "#8b919e",
    q: "#fff4be",
    u: "#ffdb68",
    v: "#f8b640",
    z: "#ffd98a",
    Z: "#ffe7ad",
    Q: "#fff2cfbf",
    M: "#f4f5f8",
    L: "#c6cbd5",
    E: "#262a31",
    a: "#f4f5f8",
    r: "#8f95a2",
  };

  var SPRITES = {
    bench: [
      ".XXX............................XXX.",
      ".XXX............................XXX.",
      ".XXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxXXX.",
      ".XXXwwwwwwwwwwwwwwwwwwwwwwwwwwwwXXX.",
      ".XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.",
      ".XXX............................XXX.",
      ".XXX............................XXX.",
      ".XXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxXXX.",
      ".XXXwwwwwwwwwwwwwwwwwwwwwwwwwwwwXXX.",
      ".XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.",
      ".XXX............................XXX.",
      ".XXX............................XXX.",
      ".XXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxXXX.",
      ".XXXwwwwwwwwwwwwwwwwwwwwwwwwwwwwXXX.",
      ".XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.",
      ".XXX............................XXX.",
      ".XXX............................XXX.",
      ".XXX............................XXX.",
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
      "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
      "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      ".XXXXX........................XXXXX.",
      ".XXXXX........................XXXXX.",
      ".XXXXX........................XXXXX.",
      ".XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.",
      ".XXXXX........................XXXXX.",
      ".XXXXX........................XXXXX.",
      ".XXXXX........................XXXXX.",
      ".XXXXX........................XXXXX.",
    ],
    body: [
      "......hh.SS.hh......",
      "....HHHHHHHHHHHH....",
      "...HHHHHFHHFHhhhh...",
      "...HHHHHFHHFHhhhh...",
      "...HHHHHHHHHHhhhh...",
      "...HHHHHHHHHHhhhh...",
      "...HHHHHHHHHHhhhh...",
      "...HHHHHHHHHHhhhh...",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "...JJJJJJJJJJJJJJ...",
      "...JJJJJJJJJJJJJJ...",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "....JJJj....JJJj....",
      "...FFFFF....FFFFF...",
      "...fffff....fffff...",
    ],
    armsA: [
      "....................",
      "....................",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "HHH..............HHH",
      "HHH..............HHH",
      ".ss..............ss.",
      "....................",
      "....................",
      "....................",
    ],
    armsB: [
      "....................",
      "....................",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "hHH..............HHH",
      "HHH..............HHH",
      ".ss..............HHH",
      ".................HHH",
      ".................ss.",
      "....................",
      "....................",
    ],
    lid: [
      ".WWWWWWWWWWWWWWWD.",
      ".WllllllllllllllD.",
      ".WllllllllllllllD.",
      ".WllllllllllllllD.",
      ".WllllllAAllllllD.",
      ".WllllllAAllllllD.",
      ".WllllllllllllllD.",
      ".WllllllllllllllD.",
      ".DDDDDDDDDDDDDDDD.",
      "DDDDDDDDDDDDDDDDDD",
    ],
    headFront: [
      "...kkkkkk...",
      "..kkKKkkkk..",
      ".kkkKkkkkkk.",
      ".kkkkkkkkkk.",
      ".kkskskkskk.",
      ".kssssssssk.",
      ".SssessessS.",
      ".SssessessS.",
      ".SsPssssPsS.",
      "..ssmssmss..",
      "...ssmmss...",
    ],
    headFrontBlink: [
      "...kkkkkk...",
      "..kkKKkkkk..",
      ".kkkKkkkkkk.",
      ".kkkkkkkkkk.",
      ".kkskskkskk.",
      ".kssssssssk.",
      ".SssssssssS.",
      ".SssessessS.",
      ".SsPssssPsS.",
      "..ssmssmss..",
      "...ssmmss...",
    ],
    headDown: [
      "...kkkkkk...",
      "..kkKKkkkk..",
      ".kkkKkkkkkk.",
      ".kkkkkkkkkk.",
      ".kkkkkkkkkk.",
      ".kkskkkkskk.",
      ".SssssssssS.",
      ".SsSSSSSSsS.",
      ".SssessessS.",
      "..ssssssss..",
      "...ssmmss...",
    ],
    headDownBlink: [
      "...kkkkkk...",
      "..kkKKkkkk..",
      ".kkkKkkkkkk.",
      ".kkkkkkkkkk.",
      ".kkkkkkkkkk.",
      ".kkskkkkskk.",
      ".SssssssssS.",
      ".SsSSSSSSsS.",
      ".SssSssSssS.",
      "..ssssssss..",
      "...ssmmss...",
    ],
    catWalkA: [
      "............oo..oo",
      "............op..po",
      "Oo..........oooooo",
      "oo..........ooooeo",
      "oo..........oooooo",
      "oooooooooooooooccn",
      "...oOOooOOoooooccc",
      "...oOOooOOoooooccc",
      "...oooooooooo.....",
      "...oOOOOOOOOo.....",
      "....ooOO..ooOO....",
      "....ooOO..ooOO....",
      "....cc....cc......",
    ],
    catWalkB: [
      "............oo..oo",
      "............op..po",
      "Oo..........oooooo",
      "oo..........ooooeo",
      "oo..........oooooo",
      "oooooooooooooooccn",
      "...oOOooOOoooooccc",
      "...oOOooOOoooooccc",
      "...oooooooooo.....",
      "...oOOOOOOOOo.....",
      "....OOoo..OOoo....",
      "....OOoo..OOoo....",
      "......cc....cc....",
    ],
    catSitA: [
      "........oo..oo....",
      "........opoopo....",
      "........ooooeo....",
      "........oooccn....",
      ".....ooooooccc....",
      ".....ooooooccc....",
      ".....ooooooooo....",
      ".....oOOooo.......",
      ".....oOOoocc......",
      ".....oOOoocc......",
      ".....ooooocc......",
      ".OoooooOOOcc......",
      ".ooooooOOOcc......",
    ],
    catSitB: [
      "........oo..oo....",
      "........opoopo....",
      "........ooooeo....",
      "........oooccn....",
      ".....ooooooccc....",
      "..Oo.ooooooccc....",
      "..oo.ooooooooo....",
      "..oo.oOOooo.......",
      "..oo.oOOoocc......",
      "..oo.oOOoocc......",
      "..oo.ooooocc......",
      "..ooooOOOOcc......",
      "..ooooOOOOcc......",
    ],
    dogWalkA: [
      "....................",
      "....................",
      ".Bb..........bbbbbb.",
      ".bb..........BBbbbb.",
      ".bb..........BBebccN",
      ".bbbbbbbbbbbbBBbbccc",
      ".bbbbBBBbbbbbBBbbccc",
      "...bbBBBbbbbbbbbbbb.",
      "...bbbbbbbbbCCC.....",
      "...bBBBBBBBBBb......",
      "....bbBB...bbBB.....",
      "....bbBB...bbBB.....",
      "....bbBB...bbBB.....",
      "....cc.....cc.......",
    ],
    dogWalkB: [
      "....................",
      "....................",
      ".............bbbbbb.",
      ".............BBbbbb.",
      "Bbb..........BBebccN",
      "bbbbbbbbbbbbbBBbbccc",
      "bbbbbBBBbbbbbBBbbccc",
      "...bbBBBbbbbbbbbbbb.",
      "...bbbbbbbbbCCC.....",
      "...bBBBBBBBBBb......",
      "....BBbb...BBbb.....",
      "....BBbb...BBbb.....",
      "....BBbb...BBbb.....",
      "......cc.....cc.....",
    ],
    dogSit: [
      "........bbbbbbb.....",
      "........BBbbbbb.....",
      "........BBbebbb.....",
      "........BBbbbcccN...",
      "........BBbbbcccc...",
      "....bbbbBBbbbcccc...",
      "....bbbbCCCCbbb.....",
      "....bBBBbbb.........",
      "....bBBBbbcc........",
      "....bBBBbbcc........",
      "....bbbbbbcc........",
      "....bbbbbbcc........",
      "Bbbbbbbbbbcc........",
      "bbbbbbbbbbcc........",
    ],
    dogSitB: [
      "........bbbbbbb.....",
      "........BBbbbbb.....",
      "........BBbebbb.....",
      "........BBbbbcccN...",
      "Bb......BBbbbcccc...",
      "bb..bbbbBBbbbcccc...",
      "bbb.bbbbCCCCbbb.....",
      "bbb.bBBBbbb.........",
      "....bBBBbbcc........",
      "....bBBBbbcc........",
      "....bbbbbbcc........",
      "....bbbbbbcc........",
      "...bbbbbbbcc........",
      "...bbbbbbbcc........",
    ],
    dinoWalkA: [
      "...........oooooooo.",
      "...........ooeooooo.",
      "...........oooooooo.",
      "...........oooooooo.",
      "...........ooooo....",
      "..........oooooo....",
      "oo.......oooooooOo..",
      "ooooooooooooooo.....",
      ".oooooOOOOooooo.....",
      "..ooooooooooo.......",
      "...oooooooooo.......",
      "....oO..oO..........",
      "....oO..oO..........",
      "....ccc..ccc........",
    ],
    dinoWalkB: [
      "...........oooooooo.",
      "...........ooeooooo.",
      "...........oooooooo.",
      "...........oooooooo.",
      "...........ooooo....",
      "..........oooooo....",
      "oo.......oooooooOo..",
      "ooooooooooooooo.....",
      ".oooooOOOOooooo.....",
      "..ooooooooooo.......",
      "...oooooooooo.......",
      "....oO...oO.........",
      "....oO...oO.........",
      "....ccc...ccc.......",
    ],
    dinoSitA: [
      "...........oooooooo.",
      "...........ooeooooo.",
      "...........oooooooo.",
      "...........oooooooo.",
      "...........ooooo....",
      "..........oooooo....",
      "........oooooooOo...",
      ".......ooooooooo....",
      "......oooooooooo....",
      "......oooOOooooo....",
      "....oooooooooooo....",
      "..oooooooooooooo....",
      "ooooooooooooooooo...",
      "oooooooooooccccc....",
    ],
    dinoSitB: [
      "...........oooooooo.",
      "...........ooeooooo.",
      "...........oooooooo.",
      "...........oooooooo.",
      "...........ooooo....",
      "..........oooooo....",
      "........oooooooOo...",
      ".......ooooooooo....",
      "......oooooooooo....",
      "......oooOOooooo....",
      "o...oooooooooooo....",
      "oo.ooooooooooooo....",
      "ooooooooooooooooo...",
      "oooooooooooccccc....",
    ],
    flowerA: [
      "...ggg...",
      ".ggyyyGG.",
      ".ggyGyGG.",
      ".ggyyyGG.",
      "...GGG...",
      "....t....",
      "....t....",
      "..t.t....",
      "...tt.t..",
      "....tt...",
      "....t....",
    ],
    flowerB: [
      "....ggg..",
      "..ggyyyGG",
      "..ggyGyGG",
      "..ggyyyGG",
      "....GGG..",
      "....t....",
      "....t....",
      "..t.t....",
      "...tt.t..",
      "....tt...",
      "....t....",
    ],
    tuft: ["......", "..t...", ".tt.t.", "tttttt"],
    sunDisc: [
      ".......................",
      ".......................",
      ".......................",
      ".........QQQQQ.........",
      ".......QQzzzzzQQ.......",
      "......QzzzzzzzzzQ......",
      ".....QzzzvvvvvzzzQ.....",
      ".....QzzvvuuuvvzzQ.....",
      "....QzzvvuuuuuvvzzQ....",
      "....QzzvuuqqquuvzzQ....",
      "....QzzvuuqqquuvzzQ....",
      "....QzzvuuqqquuvzzQ....",
      "....QzzvvuuuuuvvzzQ....",
      ".....QzzvvuuuvvzzQ.....",
      ".....QzzzvvvvvzzzQ.....",
      "......QzzzzzzzzzQ......",
      ".......QQzzzzzQQ.......",
      ".........QQQQQ.........",
      ".......................",
      ".......................",
      ".......................",
    ],
    moon: [
      ".....LMM.....",
      "...EELLMMM...",
      "..E....LMMM..",
      ".E......LMMM.",
      ".E......LMMM.",
      "E.......LMMMM",
      "E........MMMM",
      "E.......LMMMM",
      ".E......LMMM.",
      ".E......LMMM.",
      "..E....LMMM..",
      "...EELLMMM...",
      ".....LMM.....",
    ],
    starA: [".r.", "rar", ".r."],
    starB: ["a"],
    starC: ["r"],
  };

  // Sun frames: disc + 8 rays. Each frame turns rays 1/4 of a ray gap,
  // so frame D flows back into frame A with no jump.
  function buildSun(step) {
    var disc = SPRITES.sunDisc;
    var N = 23,
      C = 11,
      RAYS = 8;
    var g = [];
    for (var y = 0; y < N; y++) {
      g.push([]);
      for (var x = 0; x < N; x++) g[y].push(".");
    }
    for (y = 0; y < disc.length; y++)
      for (x = 0; x < N; x++)
        if (disc[y].charAt(x) !== ".") g[y + 1][x] = disc[y].charAt(x);
    var off = (step / 4) * ((2 * Math.PI) / RAYS);
    for (var i = 0; i < RAYS; i++) {
      var a = off + (i * 2 * Math.PI) / RAYS;
      for (var k = 0; k < 3; k++) {
        var r = 9 + k;
        var px = Math.round(C + Math.cos(a) * r);
        var py = Math.round(C + Math.sin(a) * r);
        if (px >= 0 && px < N && py >= 0 && py < N)
          g[py][px] = k === 0 ? "Z" : "Q";
      }
    }
    return g.map(function (row) {
      return row.join("");
    });
  }
  var SUN_FRAMES = ["sunA", "sunB", "sunC", "sunD"];
  for (var s = 0; s < SUN_FRAMES.length; s++)
    SPRITES[SUN_FRAMES[s]] = buildSun(s);

  // Where the boy's pieces sit relative to the bench.
  var BOY = {
    benchW: 36,
    benchY: 20,
    bodyDX: 8, // body x offset from bench x
    bodyY: 22,
    lidDX: 1, // lid offset from body
    lidDY: 6,
    headDX: 4, // head offset from body
    headY: { front: 11, down: 12 },
  };

  // The flower stands just right of the bench.
  var FLOWER = {
    dx: 40,
    y: GROUND_Y - SPRITES.flowerA.length,
    frames: ["flowerA", "flowerB"],
  };

  var PETS = {
    cat: {
      label: "Cat",
      walk: ["catWalkA", "catWalkB"],
      sit: ["catSitA", "catSitB"],
      w: 18,
      h: 13,
    },
    dog: {
      label: "Dog",
      walk: ["dogWalkA", "dogWalkB"],
      sit: ["dogSit", "dogSitB"],
      w: 20,
      h: 14,
    },
    dino: {
      label: "Dino",
      walk: ["dinoWalkA", "dinoWalkB"],
      sit: ["dinoSitA", "dinoSitB"],
      w: 20,
      h: 14,
    },
  };

  var GROUND = { top: "#3b3f47", body: "#1b1d22", dot: "#262a31" };

  // Soft light behind the sun and moon: rgb + alpha + radius (logical px).
  var SKY = {
    sun: {
      sprite: "sunA",
      w: 23,
      h: 23,
      glow: { rgb: "255,190,80", alpha: 0.05, r: 36 },
    },
    moon: {
      sprite: "moon",
      w: 13,
      h: 13,
      glow: { rgb: "190,200,225", alpha: 0.08, r: 34 },
    },
  };

  function sizeOf(name) {
    var s = SPRITES[name];
    return s ? { w: s[0].length, h: s.length } : { w: 0, h: 0 };
  }

  return {
    SCENE_H: SCENE_H,
    GROUND_Y: GROUND_Y,
    PALETTE: PALETTE,
    SPRITES: SPRITES,
    BOY: BOY,
    FLOWER: FLOWER,
    PETS: PETS,
    GROUND: GROUND,
    SKY: SKY,
    SUN_FRAMES: SUN_FRAMES,
    sizeOf: sizeOf,
  };
});

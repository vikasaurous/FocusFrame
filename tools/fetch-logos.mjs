/**
 * tools/fetch-logos.mjs
 *
 * Downloads the official brand logos for the command bar from Simple Icons
 * (https://simpleicons.org) and saves them in icons/brands/.
 *
 * Run once from the project folder:   node tools/fetch-logos.mjs
 * Needs Node 18+ (built-in fetch) and an internet connection.
 *
 * What it does
 *   - tries each logo name below until one downloads (names sometimes change)
 *   - colors each logo for the dark badge (brand color, or white for black logos)
 *   - writes icons/brands/<command id>.svg and icons/brands/index.json
 *   - anything that fails is skipped, and the bar keeps its built-in drawing
 *
 * Gemini, Google and Images are skipped on purpose: their built-in drawings
 * are multi-colored and look better than the one-color downloads.
 *
 * Logos belong to their owners. Check each brand's guidelines before you
 * publish the extension: https://simpleicons.org/styleguide
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// command id -> { names to try, color (hex, no #) }
const LOGOS = {
  chatgpt: { names: ["chatgpt", "openai"], color: "ffffff" },
  claude: { names: ["claude"], color: "D97757" },
  perplexity: { names: ["perplexity"], color: "20B8CD" },
  grok: { names: ["grok", "xai"], color: "ffffff" },
  ddg: { names: ["duckduckgo"], color: "DE5833" },
  youtube: { names: ["youtube"], color: "FF0000" },
  reddit: { names: ["reddit"], color: "FF4500" },
  wikipedia: { names: ["wikipedia"], color: "ffffff" },
  github: { names: ["github"], color: "ffffff" },
  stackoverflow: { names: ["stackoverflow"], color: "F48024" },
  maps: { names: ["googlemaps"], color: "EA4335" },
  translate: { names: ["googletranslate"], color: "4285F4" },
  spotify: { names: ["spotify"], color: "1DB954" },
  amazon: { names: ["amazon"], color: "FF9900" },
  flipkart: { names: ["flipkart"], color: "2874F0" },
  x: { names: ["x"], color: "ffffff" },
  imdb: { names: ["imdb"], color: "F5C518" },
  mdn: { names: ["mdnwebdocs", "mdn"], color: "ffffff" },
  npm: { names: ["npm"], color: "CB3837" },
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "icons", "brands");
await mkdir(outDir, { recursive: true });

async function download(name, color) {
  const url = `https://cdn.simpleicons.org/${name}/${color}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = (await res.text()).trim();
  if (!text.startsWith("<svg") || text.length > 30000) return null;
  return text;
}

const saved = [];
const missed = [];
for (const [id, { names, color }] of Object.entries(LOGOS)) {
  let svg = null;
  for (const name of names) {
    try {
      svg = await download(name, color);
    } catch {
      svg = null;
    }
    if (svg) break;
  }
  if (svg) {
    await writeFile(path.join(outDir, `${id}.svg`), svg + "\n");
    saved.push(id);
    console.log("  ok      " + id);
  } else {
    missed.push(id);
    console.log("  missing " + id + " (keeps the built-in drawing)");
  }
}

await writeFile(
  path.join(outDir, "index.json"),
  JSON.stringify(saved, null, 2) + "\n",
);
console.log(`\nSaved ${saved.length} logo(s) to icons/brands/.`);
if (missed.length) console.log(`Skipped: ${missed.join(", ")}`);
console.log("Reload the extension, then open a new tab.");

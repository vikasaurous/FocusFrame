# Architecture

FocusFrame is a Manifest V3 extension that replaces the browser's new tab page. It is plain HTML, CSS and JavaScript with no build step and no runtime dependency. This document explains how the pieces fit together.

## Layout of the repository

```text
manifest.json         Manifest V3 entry point. Permission: storage.
newtab.html           The new tab page. Loads every script, in order, with plain <script> tags.
newtab.js             Cards, layout, storage, customize panel, wiring of the modules below.
styles.css            Global styles and the card layout.

src/scene/            Pixel scene
  sceneSprites.js       Sprite data (rows of palette letters) and palette.
  sceneEngine.js        Pure logic: sky, sun and moon, pet, person, hover reactions.
  sceneRenderer.js      Draws a frame onto a canvas and handles pointer hit boxes.
  scene.css             Scene styles.
  sceneEngine.test.js   Tests.

src/commandbar/       Alt + K command bar
  commands.js           Pure logic: built-in destinations, parsing, URL building, settings.
  commandBar.js         The bar's UI: input, picker, keyboard handling.
  ripple.js             Small click-ripple helper.
  commandBar.css        Styles.
  commands.test.js      Tests.

src/snake/            Optional year-dot snake
  snakeEngine.js        Pure logic.
  snakeRenderer.js      Draws it over the year dots.
  snakeEngine.test.js   Tests.

icons/                Extension icons (16, 32, 48 px) and brand logos in icons/brands/.
tools/                Developer helpers, not shipped to users.
docs/                 Banner, screenshots, and project documents.
.github/              CI workflow, issue forms, pull request template.
```

## How a new tab loads

1. Chrome opens `newtab.html` (declared under `chrome_url_overrides` in the manifest).
2. The page loads its stylesheets, then its scripts in this order: snake, command bar, scene, then `newtab.js` last.
3. Each module is a small script that exposes one browser global (`SnakeEngine`, `FFCommands`, `FFSceneEngine` and so on). `newtab.js` reads them and wires everything together.
4. `newtab.js` loads saved state, renders the cards, starts the scene and, if enabled, the snake and the command bar.

There are no ES module imports, no bundler and no transpilation. What is in the repository is what runs.

## Pure engines and renderers

The most testable code is kept free of the DOM:

- **Engine files** (`*Engine.js`, `commands.js`) hold logic only. They use a small UMD wrapper: in the browser they set a global; in Node they set `module.exports`. That is what lets `node --test` load them without a browser.
- **Renderer and UI files** (`*Renderer.js`, `commandBar.js`, `newtab.js`) touch the DOM and `chrome.*`. They are not covered by automated tests and are checked by loading the extension unpacked.

Only `newtab.js` reads or writes extension storage.

## Storage

All user data lives in one object, saved under the key `focusFrame` with `chrome.storage.local`. When the page is opened outside an extension (for example from a local web server during development), it uses `localStorage` under the same key instead.

The object holds, among other things:

| Field | Meaning |
| --- | --- |
| `accent`, `searchEngine` | Appearance and search settings. |
| `focus`, `focusNote`, `now` | Text for the Daily Focus and Now cards. |
| `rows`, `order`, `visible` | Card layout: rows of card ids (up to three per row), a flat order, and which cards are shown. |
| `tasks` | `{ date, items }`: up to three `{ text, done }` for today. Rolled over when the date changes. |
| `habits`, `habitLog` | Up to five `{ id, name }`, and a map from `YYYY-MM-DD` to the habit ids done that day. Entries older than 400 days are dropped on load. |
| `quotesCustom`, `quotePin`, `quoteOffset` | Quote card state. |
| `countdown` | `{ label, date }`. |
| `links` | Quick links, `{ name, url }`. |
| `scene`, `snake` | Scene and year-snake settings. |
| `commandBar` | Command bar settings, merged with defaults by `FFCommands.mergeSettings`. |

On load, `newtab.js` merges saved data with defaults and sanitizes each field, so older saves keep working when new fields are added.

The command bar fetches `icons/brands/index.json` from the extension's own files to find brand logos. That is a local file, not a network request.

## Card layout

The dashboard is a column of rows. Each row is a flex container holding one to three cards, and each card is allowed to grow, so a row always fills its width: one card is full width, two share it equally, three take a third each. Cards use container queries to restyle themselves by their own width.

Drag and drop uses native browser drag events. Only the card's drag handle starts a drag, so typing and selecting text inside cards keeps working. A drop on the left or right half of a card places the dragged card beside it; a drop on the top or bottom edge makes a new row; dropping onto a full row from another row swaps the two cards.

## The pixel scene

`sceneEngine.js` exposes `createScene({ width, height, pet })`. A caller advances it with `step(dt, date)` about ten times a second and reads `getFrame()`, which says which sprites to draw and where, in logical pixels. The engine decides the sun or moon position from the real clock, moves the pet, and handles the person's typing and looking-up cycle. `sceneRenderer.js` draws that frame onto a canvas, scaled up with crisp pixels, and adds invisible hit boxes for hover and click.

Sprites are rows of characters; each character maps to a color in the palette in `sceneSprites.js`. The sun has four frames that show the rays turning a quarter step each.

`tools/make-banner.mjs` reuses the same engine and sprite data to draw the README banner, so the banner always matches the real art.

## Tests and CI

Tests use Node's built-in runner (`node --test`) and need no packages. They cover the engine files. GitHub Actions runs them on every push and pull request. See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to run and extend them.

## Design constraints

- No build system and no runtime dependencies unless there is a concrete need.
- The only extension permission is `storage`.
- User data stays on the device. The one external request is Google Fonts, which is on the roadmap to bundle locally.
- No remote code is loaded or executed.

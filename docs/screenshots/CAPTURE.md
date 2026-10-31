# Screenshots and recordings

Everything in this folder must be a real capture of FocusFrame running in a browser. Do not use mock-ups, AI-generated screens or edited UI. Cropping is fine.

## Current assets

| File | Used in | What it shows |
| --- | --- | --- |
| `hero.png` | README, top | The new tab at night: clock, scene, year dots, search box, Daily Focus card. Starter content. |
| `commandbar.png` | README, Search and command bar | The `Alt + K` command bar open over the dimmed page. |

The banner is not a screenshot. It is generated from the extension's own sprite data by `node tools/make-banner.mjs` and lives at `docs/banner.svg`. `docs/social-preview.png` (1280 × 640) is the same banner on a dark canvas, ready to upload as the repository's social preview in **Settings → General → Social preview**.

## Wanted captures

These are not in the repository yet. Add them and reference them in the README when they exist.

| File | Capture |
| --- | --- |
| `cards.png` | The four default cards (Daily Focus, Top 3 Tasks, Quick Links, Habits) with a couple of tasks ticked and one habit with a streak. |
| `layout.png` | A card mid-drag, showing the accent bar where it will land. |
| `customize.png` | The customize panel open. |
| `demo.webp` or `demo.mp4` | A 10 to 15 second recording: new tab, tick a task, drag a card beside another, open the command bar. |

## How to capture a clean screenshot

1. Use a fresh browser profile, or clear stored data so the starter content shows. On the new tab page open DevTools (`F12`), go to the Console and run:

   ```js
   chrome.storage.local.clear().then(() => location.reload());
   ```

2. Stay online so the fonts load from Google Fonts. Without them the page falls back to system fonts and the capture will not look like the real thing.
3. Load FocusFrame unpacked (`chrome://extensions` → **Developer mode** → **Load unpacked**) and open a new tab.
4. In DevTools press `Ctrl + Shift + M` for the device toolbar, choose **Responsive**, and set the size to 1440 × 900.
5. Press `Ctrl + Shift + P`, type `screenshot`, and choose **Capture screenshot** (visible area) or **Capture full size screenshot**. This avoids the glow or border some operating system screenshot tools add around the edges.
6. Save as PNG in this folder with a descriptive name.

## Before you commit a capture

- No personal data: no real tasks, habit names, notes, links, bookmarks, profile pictures or open tabs.
- Starter content or neutral sample text only.
- PNG for screenshots, not JPEG. Keep each file under about 500 KB; run it through an optimizer if it is larger.
- Add a short alt text when you reference it in the README.
- If a capture shows the Chrome footer, crop it out.

## Recording a demo

1. Record the browser window only, at 1280 × 720 or smaller, for no more than 15 seconds.
2. Trim the start so the first frame is the finished page, not a loading state.
3. Keep the frame size constant. No black bars, no player or recorder controls.
4. Export an animated WebP or a short MP4 under 3 MB. A 3 MB limit keeps the README loading quickly.
5. Reference it from the README only after you have watched it through.

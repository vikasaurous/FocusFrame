# Screenshot Assets & Capture Guide

This folder contains genuine screenshot assets of FocusFrame running in a browser.

## Current assets

| File | Status | Description |
|------|--------|-------------|
| `banner.png` | Committed | Pixel-art banner matching FocusFrame's calm visual identity |
| `hero.png` | Committed | Real capture of running extension dashboard (nighttime scene, clock, year dots, search, Daily Focus) |
| `commandbar.png` | Committed | Real capture of the command bar modal over darkened backdrop |
| `demo.webp` | Committed | Session recording of browser interactions |
| `customize.png` | Optional | Customize panel open on the right side |
| `habits.png` | Optional | Habits card with checked days and streaks |


## Capture steps

1. Load FocusFrame as an unpacked extension (`chrome://extensions` → **Load unpacked** → select repository folder).
2. Open a new tab.
3. Use your OS screenshot tool or the Chrome DevTools device toolbar to capture at 1440×900 (or similar 16:9 resolution).
4. Save as PNG and place the file in this `docs/screenshots/` folder.
5. Commit with a message such as `docs: add hero screenshot`.

## Notes

- Do not capture screenshots that contain real personal data (real tasks, real habit names, real links).
- Use placeholder text or the default starter content.
- PNG is preferred over JPEG for UI screenshots.
- The banner (`banner.png`) is already committed and does not need to be replaced.

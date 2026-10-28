<div align="center">

# FocusFrame

**A calm, pixel-art new tab for people who want their first screen of the day to say what matters.**

A small living scene, one daily focus, three tasks, a few habits, and your links. All on your device.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-1f6feb)
![No tracking](https://img.shields.io/badge/tracking-none-2ea043)
![No account](https://img.shields.io/badge/account-not%20needed-2ea043)
![Dependencies](https://img.shields.io/badge/dependencies-0-lightgrey)

<!-- Add a hero screenshot or short GIF here: docs/screenshots/hero.png -->
<!-- ![FocusFrame](docs/screenshots/hero.png) -->

</div>

---

## Why FocusFrame

Most new tab pages are a wall of widgets. FocusFrame is the opposite: a few things that help you start your day, and a small pixel scene that keeps you company.

- **One line for today.** Write what would make today feel finished.
- **Three tasks, not thirty.** A hard limit keeps the list honest.
- **Habits that reset by the calendar.** Weekly view, streaks, no guilt.
- **Everything stays on your device.** No account, no sync service, no analytics.

## Features

### Pixel scene

A hand-drawn pixel scene sits at the top of every new tab: a person coding on a bench, a pet walking by, a flower, and a sky that follows your real local time.

- Sun by day, moon and stars by night, crossing the sky as the day goes by.
- Sun rays animate frame by frame, like the pet.
- Choose your pet: cat, dog, or dino.
- Hover over the person or the pet and they react.
- Honors the system *reduced motion* setting. Nothing moves on its own when it is on.
- Turn the whole scene off in the customize panel.

### Year in dots

A 365-dot calendar shows how far through the year you are, with days left and a live countdown to midnight. An optional snake can eat through the finished days (off by default; speed and regrow are adjustable).

### Cards

| Card | What it does |
| --- | --- |
| **Daily Focus** | One line for today, plus a short note. Hover to edit. |
| **Top 3 Tasks** | Up to three tasks. Finished tasks clear the next day, unfinished ones carry over. |
| **Habits** | Up to five named habits, Monday to Sunday. Streaks, weekly count, late check-ins for earlier days this week. Future days are locked. |
| **Quick Links** | Shortcuts to your favorite sites. Add your own from the customize panel. |
| **Now** | A short note about what you are doing right now. |
| **Quote** | A daily quote. Shuffle, pin one, or add your own. |
| **Countdown** | Days to an exam, a trip, or a launch. |

New installs start with Daily Focus, Top 3 Tasks, Quick Links, and Habits visible. Now, Quote, and Countdown are one click away in the customize panel.

### Layout you control

- Drag a card by its **DRAG** handle (appears on hover).
- Drop on the **left or right half** of another card to place it beside that card.
- Drop on the **top or bottom edge** to start a new row.
- A row holds **up to three cards** and splits the width equally: one card is full width, two are half each, three are a third each.
- Dropping onto a full row from another row **swaps** the two cards.
- Cards restyle themselves to their width, and wrap on narrow windows.

### Search and command bar

- Search box with a choice of engine: browser default, Google, DuckDuckGo, Bing, or Brave.
- Press **Alt + K** to open the command bar. Type a command prefixed with `/` and your query, for example `/wiki cats` or `/r python`.
- 16 built-in destinations: Wikipedia, Reddit, GitHub, Stack Overflow, Google Maps, Google Images, Google Translate, Spotify, Amazon, ChatGPT, Claude, Gemini, Perplexity, Grok, Google, and YouTube.
- In the customize panel: turn the command bar on or off, pick the default destination, choose whether results open in the same or a new tab, and change the shortcut key.

### Customize

- Show or hide any card.
- Four accent colors: coral, cobalt, moss, plum.
- **Reset to starter layout** puts everything back to the defaults.
- Scene, pet, and year-snake settings.
- Keyboard accessible, with visible focus states and labelled controls.

## Install

FocusFrame is not on a browser store yet. Until then, install it as an unpacked extension.

1. Download this repository as a ZIP (**Code → Download ZIP**) and unzip it, or clone it:

   ```bash
   git clone https://github.com/vikasaurous/FocusFrame.git
   ```

2. Open your browser's extensions page:

   | Browser | Address |
   | --- | --- |
   | Chrome | `chrome://extensions` |
   | Edge | `edge://extensions` |
   | Brave | `brave://extensions` |

3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the folder that contains `manifest.json`.
5. Open a new tab.

**Notes**

- Chrome may show a reminder about developer-mode extensions when it starts. That is normal for unpacked installs.
- Since Chrome 138, Chrome shows its own footer on new tab pages provided by an extension. It holds a link to the extension and a **Customize Chrome** button. It is not part of FocusFrame. To hide it, right-click the footer and choose **Hide footer on New Tab page**, or turn off **Show footer on New tab page** in Customize Chrome.
- Firefox is not supported yet.

## Privacy

FocusFrame is built to keep your data with you.

- **Local only.** Settings, tasks, habits, notes, and links are stored with `chrome.storage.local` in your browser.
- **One permission.** The extension asks only for `storage`.
- **No accounts, no analytics, no ads, no remote code.**
- **Searches go where you send them.** When you search or use the command bar, your browser opens the site you picked. FocusFrame does not see or store those queries.
- **Fonts.** The page currently loads its fonts from Google Fonts, so your browser makes a request to Google when a new tab opens. Bundling the fonts locally is on the roadmap.

## Development

FocusFrame is plain HTML, CSS, and JavaScript. There is no build step and no runtime dependencies.

```text
manifest.json        Extension manifest (Manifest V3)
newtab.html          New tab page
newtab.js            Cards, layout, storage, customize panel
styles.css           Styles
icons/               Extension and brand icons
src/
  scene/             Pixel scene: engine, sprites, renderer
  commandbar/        Alt+K command bar
  snake/             Optional year-dot snake
tools/               Helper scripts
```

Run the tests (Node 20 or newer):

```bash
node --test
```

The scene, command bar, and snake each keep their logic in a pure engine file with its own tests, so they can be checked without a browser.

## Roadmap

Ideas, not promises:

- Bundle fonts locally.
- Backup and restore as a JSON file.
- Firefox and Edge store builds.
- Habit history beyond the current week.
- A scene that reacts to finished tasks and habit streaks.

Suggestions are welcome. Open an issue.

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/your-change`.
2. Keep changes small and focused.
3. Run `node --test` and load the extension to check the page by eye.
4. Open a pull request that says what changed and why.

## License

No license has been chosen yet. Until a `LICENSE` file is added, all rights are reserved by the author.
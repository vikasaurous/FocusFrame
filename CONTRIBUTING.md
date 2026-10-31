# Contributing to FocusFrame

Thank you for your interest in contributing. FocusFrame is a small, dependency-free browser extension, and contributions should stay in that spirit.

## Before you start

- **Check the issues list.** Someone may already be working on the same thing.
- **Open an issue first** for anything larger than a small bug fix or a typo. Describe what you want to change and why, so we can agree on the approach before you write the code.

## Setting up

FocusFrame has no build step and no package manager dependencies.

```bash
git clone https://github.com/vikasaurous/FocusFrame.git
cd FocusFrame
```

Load it in Chrome, Edge or Brave as an unpacked extension:

1. Go to `chrome://extensions` (or `edge://extensions`, `brave://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select the repository folder

To run the tests (Node 22 or newer required):

```bash
node --test
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Making a change

1. Fork the repository.
2. Create a branch: `git checkout -b fix/my-bug` or `git checkout -b feature/my-feature`.
3. Make your changes. Keep them small and focused.
4. Run `node --test` — all tests must pass.
5. Load the extension and check the page manually in at least one Chromium-based browser.
6. Open a pull request and fill in the PR template.

## Code style

- Plain HTML, CSS, and JavaScript — no TypeScript, no transpilation.
- No new runtime dependencies. If you think a dependency is genuinely needed, discuss it in an issue first.
- No build system.
- Keep existing comments and docstrings that are unrelated to your change.
- Follow the existing file structure:
  - Pure logic lives in engine files (`*Engine.js`) with matching test files (`*.test.js`).
  - DOM interaction lives in renderer files (`*Renderer.js`) or `newtab.js`.
  - Styles live in `styles.css` or the relevant `*.css` in `src/`.

## What makes a good pull request

- It solves a clearly described problem.
- It is the smallest sensible change that solves the problem.
- It includes tests for any new engine logic.
- It does not change unrelated code.
- It does not change the extension's core behavior unintentionally.

## What we will not merge

- Changes that add dependencies or a build step without prior discussion.
- AI-generated content without review (screenshots, copy, documentation).
- Changes that collect, transmit, or expose user data.
- Unrelated cleanups bundled into a feature or bug fix.

## License note

FocusFrame does not yet have a license file. All rights are reserved by the author until a license is chosen. Contributions submitted as pull requests are accepted on the understanding that the maintainer retains the right to choose a license for the project.

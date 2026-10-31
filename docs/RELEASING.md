# Releasing FocusFrame

This is the checklist for packaging a version and keeping the public status statements honest. FocusFrame has no automated release pipeline; a release is a few manual steps.

## Current status

No release has been published yet, and FocusFrame is not listed on any browser store. The only way to run it today is to load the repository unpacked (see the README).

Use these status words and nothing stronger:

| Word | Meaning |
| --- | --- |
| Not submitted | Nothing has been sent to the store. |
| Submitted | Sent to the store; no decision yet. |
| Under review | The store has acknowledged it and is reviewing. |
| Approved | The store accepted it, but it may not be visible to users yet. |
| Public | Users can find and install it from the store listing. |

Update the **Release status** table in `README.md` in the same pull request that changes a status. Do not link a store listing until it is public, and never publish store review correspondence.

## Before you release

1. Make sure `main` is the commit you want to ship and that the **Tests** workflow is green.
2. Run the tests locally:

   ```bash
   node --test
   ```

3. Load the extension unpacked from a clean checkout and check the page by eye: new tab, add a task and a habit, drag a card, open the command bar with `Alt + K`.
4. Decide the version number and update `"version"` in `manifest.json`. Use `MAJOR.MINOR.PATCH`. Stores reject a version that is not higher than the last one they saw.
5. Check the README for stale statements: browser support, known limitations, privacy table (especially network requests) and the roadmap.
6. Confirm a license has been chosen and `LICENSE` exists. This is a maintainer decision; see the README.

## Build the zip

The package must contain only what the extension needs at runtime. From the repository root, after committing:

```bash
git archive --format=zip --output focusframe-0.1.0.zip HEAD \
  manifest.json newtab.html newtab.js styles.css icons src ':(exclude)*.test.js'
```

On Windows PowerShell, write it on one line:

```powershell
git archive --format=zip --output focusframe-0.1.0.zip HEAD manifest.json newtab.html newtab.js styles.css icons src ':(exclude)*.test.js'
```

`git archive` packs tracked files from the commit, so uncommitted changes are not included. Replace `0.1.0` with the version you are shipping. Do not commit the zip; `*.zip` is ignored.

Check the result:

```bash
unzip -l focusframe-0.1.0.zip
```

`manifest.json` must be at the top level of the zip (not inside a folder).

## Publish on GitHub

1. Tag the commit and push the tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. On GitHub choose **Releases → Draft a new release**, pick the tag, and write short notes: what is new, what changed, and any known issue.
3. Attach `focusframe-0.1.0.zip` and publish.
4. Update the **Release status** table in the README: "GitHub Releases" becomes the release link.

## Browser stores

Each store has its own account, review and policies. Check the store's current rules before submitting, as fees and requirements change.

- **Chrome Web Store.** Needs a developer account. The manifest must be Manifest V3. The listing needs a privacy statement that matches the README privacy table, including the Google Fonts request.
- **Edge Add-ons.** Microsoft's store accepts Chromium extensions. Check its current requirements.
- **Firefox Add-ons.** Not supported yet. The extension is not packaged or tested for Firefox, and the manifest has no Firefox settings.

For every listing:

- Describe permissions exactly: `storage` only.
- State plainly that the new tab page is replaced.
- Use real screenshots (see [`screenshots/CAPTURE.md`](screenshots/CAPTURE.md)). Do not use mock-ups.
- Do not claim user numbers, ratings or reviews you do not have.

## After releasing

- Update the README release table and roadmap.
- Close the issues the release fixed and mention the version.
- Delete merged feature branches.

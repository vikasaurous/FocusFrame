# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in FocusFrame, please **do not open a public issue**.

Report it privately with GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. If that option is not available, open a public issue that says only that you have a security report, with no technical details, and the maintainer will arrange a private way to receive it.

Please include:

- A description of the problem and its potential impact.
- Steps to reproduce, or a proof of concept.
- Any mitigation you suggest.

You can expect an acknowledgement within a few days. A fix will follow once the issue is confirmed.

## What FocusFrame does

FocusFrame is a browser extension that runs on your device. As of the current code it:

- Stores its data with `chrome.storage.local` (or the page's `localStorage` when opened outside an extension, for development).
- Asks for one extension permission: `storage`.
- Loads fonts from Google Fonts. This is the only external request the page makes.
- Does not load or execute remote code.
- Does not send your data anywhere.

## What is most useful to report

- Script injection or cross-site scripting through user-supplied text: focus and note text, task and habit names, quote text and author, countdown label, quick-link names and URLs, command bar input.
- Ways a web page or another extension could read or change FocusFrame's stored data.
- Any request that sends user data to a third party.

## Supported versions

Only the latest commit on `main` is supported. There are no published releases yet.

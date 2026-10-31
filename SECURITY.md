# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in FocusFrame, please **do not open a public GitHub issue**.

Instead, report it privately by emailing the maintainer or by using [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) feature on this repository.

Please include:

- A description of the vulnerability and the potential impact
- Steps to reproduce or proof-of-concept
- Any suggested mitigations, if you have them

You can expect an acknowledgement within a few days and a fix as soon as the issue is confirmed.

## Scope

FocusFrame is a browser extension that runs entirely on your device. It:

- Stores all data in `chrome.storage.local`
- Makes no authenticated requests
- Loads fonts from Google Fonts (the only external request)
- Does not execute remote code

Security reports are most relevant to:

- Content injection or XSS via user-supplied input (focus text, task names, habit names, custom links, custom commands)
- Privilege escalation via the `storage` permission
- Data leakage to third-party origins

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes     |
| Earlier | ❌ No      |

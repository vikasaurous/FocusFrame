# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: plain HTML, CSS, and JavaScript with Chrome Extension Manifest V3, selected for a small, dependency-free local-first MVP.

## Users

People who want the first browser screen of their day to reflect their current priorities, personality, and useful information. The initial MVP targets a private, personal dashboard; creator, founder, and public-showcase use cases remain future expansion paths.

## Product Purpose

FocusFrame replaces Chrome's new-tab page with a configurable dashboard that helps a user orient themselves quickly through meaningful personal information, links, and a visual environment they control.

## Positioning

Rather than a fixed collection of generic widgets, FocusFrame gives users a modular personal canvas: they choose what appears, arrange it, and shape how it feels without sending their dashboard data to a service.

## Operating Context

The dashboard opens whenever the user creates a browser tab. Configuration happens locally through an in-extension editing experience. The user should be able to change the page without accounts, onboarding services, or external API connections.

## Capabilities and Constraints

- MVP modules: time/date, motivational quote, quick links, daily focus, progress goal, and a personal "Now" card.
- Users can show, hide, reorder, and customize modules, background, and theme.
- Data is stored in Chrome local storage.
- No authentication, publishing, cloud sync, or third-party analytics integrations in the MVP.
- Future possibilities include creator analytics, product metrics, integrations, shareable dashboards, saved scenes, and dashboard import/export.

## Brand Commitments

The name is FocusFrame. It should feel personal, deliberate, calm, and expressive rather than like a generic productivity dashboard.

## Evidence on Hand

No existing assets, product data, testimonials, integrations, or brand system have been supplied. The MVP must not imply real analytics or external data connections.

## Product Principles

- Start useful in seconds.
- Make personalization tangible, not buried in settings.
- Keep users in control of their data and visual environment.
- Favor a few meaningful modules over dense, generic widgets.
- Leave a clean extension path for future creator and founder data modules.

## Accessibility & Inclusion

Support keyboard navigation, visible focus states, readable contrast, semantic controls, and reduced-motion preferences.

## Snake Visual Mode

### What it is

An optional animation that makes a snake travel across the 365-day dot calendar in the page header. The snake moves through dots representing days that have already passed this year, "eating" them as it goes. When it has consumed all finished-day dots it pauses briefly, the eaten dots fade back in, and the cycle restarts.

### Decorative only

The snake is purely visual. It never writes to storage, never modifies the calendar data, and has no effect on any other module. Disabling it returns the calendar to its normal static appearance instantly.

### Data and privacy

No personal data is collected, transmitted, or stored as a result of this feature. The snake's position is not persisted between sessions — it always restarts fresh. The only stored values are the three user preferences (enabled, speed, regrow), saved alongside all other FocusFrame settings in Chrome local storage on the user's own device.

### Controls (Customize panel → Year dot snake)

| Setting | Options | Default |
|---|---|---|
| Animate finished days | On / Off | Off |
| Speed | Slow · Medium · Fast | Slow |
| Regrow after cycle | On / Off | On |

### Accessibility

- Snake visuals are `aria-hidden`; the calendar's existing text alternative ("Calendar progress through the current year") is unchanged.
- When `prefers-reduced-motion` is set the snake is placed statically once with no tick loop, even if the user has enabled it.
- All controls in the settings panel have proper labels and are keyboard-navigable.

### Premium plan (future)

Snake Visual Mode is planned as a premium feature. The codebase contains a single `isFeatureUnlocked("snake")` gate in `newtab.js` that currently always returns `true`. No payment, licensing, or network code exists. Billing integration will only require updating that one function.

# Implementation Status

## Status summary

The current roadmap state is:

- `M0` through `M11` are closed for the current alpha target
- the roadmap no longer points at a new major milestone package after `M11`
- the next recommended implementation target in the roadmap is a post-`M11` mobile polish sprint

## Closed milestone inventory

### `M0-M5`

These cover browser feasibility, app skeleton, core editor, desktop polish, export/fallback UX, and alpha hosting. They are closed and are now baseline platform assumptions rather than active workstreams.

### `M6`

Closed for the current alpha target.

Major shipped areas:

- canvas bounds and crop
- image layers and transforms
- adjustments, effects, and watermark system

### `M7`

Closed for the current alpha target.

Major shipped areas:

- draw and erase
- selection and extraction
- narrow local-only clone-stamp experiment
- explicit deferral of healing/content-aware retouch

### `M8`

Closed for the current milestone path.

Major shipped areas:

- starter template foundations
- text/image slot metadata
- template picker and curator
- native `.melf` scene format
- local save/reopen flow
- repo-backed shipped template catalog and publish workflow

### `M9`

Closed for the current alpha target.

Major shipped areas:

- installability
- app manifest and icons
- shell-focused service worker
- standalone update affordance

### `M10`

Closed for the current alpha target.

Major shipped areas:

- mobile shell changes
- touch/gesture ownership rules
- mobile import/export fallbacks
- mobile crop/retouch/layout adaptations
- large-image and interrupted-session recovery posture

## Active forward path

### `M11: Telegram Mini App`

Closed epics:

1. `11A Route Surface and Runtime Contract`
2. `11B Telegram SDK Adapter and Lifecycle`
3. `11C Telegram Fullscreen Shell and Insets`
4. `11D Telegram Export, Share, and Fallback UX`
5. `11E Telegram Deployment Surface and Operations`

Current status:

- route and host-mode contract are shipped on `/t`
- Telegram SDK loading and host lifecycle wiring are shipped
- Telegram fullscreen and inset handling are shipped on the shared shell
- Telegram export fallback policy and messaging are shipped
- milestone is closed for the current alpha target

### Post-`M11` mobile polish

Current posture:

- the roadmap points here as the next likely continuation area
- the latest shipped polish removed mobile clipboard-import affordances from the phone shell, kept mobile debug status details localhost-only, restored one-line text rows in the `Layers` inspector, and closed the Telegram bottom-gap regression
- there is not yet a separate fully approved milestone package for the next mobile sprint

## Where to verify exact state

For any disputed or recently changed status, verify against:

- [2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)
- the relevant milestone spec or plan under [docs/superpowers/](/D:/PETS/meme-elf/docs/superpowers/)

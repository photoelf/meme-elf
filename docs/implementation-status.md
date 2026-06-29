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
- the latest shipped polish removed mobile clipboard-import affordances from the phone shell, kept mobile debug status details localhost-only, restored one-line text rows in the `Layers` inspector, closed the Telegram bottom-gap regression, and taught the phone `Tools` toggle to scroll to the inspector tabs on open and back to the top bar on close
- direct mobile layer manipulation is now shipped: one finger moves the active layer, a second finger upgrades that session into layer scale plus rotation, and that active layer transform no longer falls through into preview pinch zoom
- `Prepare image` crop is now touch-safe on phone with one-finger create, move, and resize interactions plus scroll suppression during handle drags
- the editor now has a top-bar `New canvas` reset action, and loading a new base image, reopening a scene, or starting a new canvas clears transient mobile recovery snapshots so stale scene state cannot resurrect unexpectedly
- there is not yet a separate fully approved milestone package for the next mobile sprint

## Where to verify exact state

For any disputed or recently changed status, verify against:

- [2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)
- the relevant milestone spec or plan under [docs/superpowers/](/D:/PETS/meme-elf/docs/superpowers/)

# Current State

## Executive summary

`meme-elf` is already a working production alpha deployed as a static browser app.

It is no longer just a top/bottom-text generator. The current shipped baseline includes:

- local image import from clipboard, direct image URL, and file upload
- multiple text layers with inline editing
- image layers, crop, scene transforms, canvas expansion, effects, watermarking
- draw, erase, selection, extraction, and narrow clone-stamp experimentation
- native `.melf` save/reopen flow
- shipped template catalog plus localhost-only template curation/publish tooling
- phone-oriented editing posture
- PWA installability and app-shell caching
- Telegram Mini App support on `/t`

## What is considered closed

The roadmap currently treats these milestones as closed for the current alpha target:

- `Milestone 0`
- `Milestone 1`
- `Milestone 2`
- `Milestone 3`
- `Milestone 4`
- `Milestone 5`
- `Milestone 6`
- `Milestone 7`
- `Milestone 8`
- `Milestone 9`
- `Milestone 10`
- `Milestone 11`

There is no newer fully packaged milestone after `M11` yet. The roadmap currently points to a post-`M11` mobile polish sprint as the next likely continuation area.

## Important shipped seams

These are the product seams that matter most when continuing development:

- `Quick meme` must stay fast.
- Advanced editing must remain progressively disclosed in the inspector.
- Mobile behavior is intentionally different where needed, especially around touch ownership, export fallbacks, and recovery.
- Telegram is a route-scoped host seam, not a forked product: `/` stays web/PWA, `/t` stays Telegram.
- Template publishing is a two-surface workflow: normal `Templates` for shipped assets, localhost `Experimental` curator for maintenance.
- Saved-work behavior is local-only and based on `.melf`.
- PWA support is intentionally narrow and shell-focused, not a blanket offline-first promise.

## Known limitations and posture

- Clipboard capabilities vary by browser and secure context, so copy/paste behavior must stay best-effort with explicit fallback UX.
- Mobile interruption recovery is intentionally lossy for non-text content when storage pressure is high.
- Clone stamp is narrow and local-only; healing/content-aware retouch remains deferred.
- Telegram fullscreen behavior is validated on the shared editor shell, but export remains capability-driven and host-dependent.

## Audience note

If you need:

- business/product context, read [project-overview.md](/D:/PETS/meme-elf/docs/project-overview.md)
- exact milestone state, read [implementation-status.md](/D:/PETS/meme-elf/docs/implementation-status.md)
- detailed roadmap wording, read [2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)

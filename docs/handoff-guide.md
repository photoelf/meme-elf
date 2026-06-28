# Handoff Guide

## Goal

This guide is for the next developer picking up `meme-elf`.

It explains:

- what to read first
- how to avoid drifting away from the real source of truth
- where the main code seams live
- how to choose the next safe implementation target

## First reading order

Read in this order:

1. [AGENTS.md](/D:/PETS/meme-elf/AGENTS.md)
2. [docs/README.md](/D:/PETS/meme-elf/docs/README.md)
3. [design.md](/D:/PETS/meme-elf/design.md)
4. [docs/2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)
5. [docs/current-state.md](/D:/PETS/meme-elf/docs/current-state.md)
6. [docs/architecture-map.md](/D:/PETS/meme-elf/docs/architecture-map.md)

After that, read the spec/plan files only for the milestone area you are actually touching.

## How to pick up the next task

If the user names a roadmap chunk, epic, or milestone:

1. open the roadmap and confirm the exact status/order
2. open the matching detailed plan/spec in `docs/superpowers/`
3. verify the current implementation state in code before assuming the docs are perfectly current
4. update tracked docs in the same stream if behavior or status changes

If no exact task is named, the current default next major direction is:

- roadmap-guided post-`M11` mobile polish
- but only after confirming whether a fresh dedicated plan/spec package is needed first

## Rules that should not be broken casually

- Keep the fast meme flow fast.
- Keep the app static-host friendly.
- Do not add backend or auth requirements by inertia.
- Prefer browser capability detection over UA logic.
- Keep advanced controls in the right inspector unless the existing design clearly chooses another seam.
- Treat clipboard workflows as enhancements with clear fallbacks.
- Keep docs synchronized with shipped behavior.

## Codebase expectations

The repo favors:

- focused modules
- browser-side utilities per feature
- tests next to feature utilities and UI seams
- a large orchestration layer in `src/app/App.tsx`, with behavior delegated to feature modules

If you touch a feature family, expect to update:

- runtime code
- tests
- roadmap/docs if milestone status or user-facing behavior changed

## Verification expectations

At minimum, before calling work complete:

- run targeted tests for the touched area if they exist
- run a build
- if the task is UI-heavy, perform a quick local smoke where practical
- if the task affects mobile/PWA/template publish seams, verify the exact workflow described in `docs/workflows.md`

## Where contributors usually get confused

- `docs/` now has a handoff layer, but the roadmap still carries canonical milestone status.
- `docs/superpowers/specs/*` and `docs/superpowers/plans/*` are not noise; they hold the reasoning and batch details.
- localhost-only maintenance surfaces are intentional and not necessarily bugs or unfinished production UX.
- `.melf` is the current save/template truth; PSD is not the active milestone path.
- Telegram is already shipped on `/t`; future Telegram work is maintenance and polish, not first-pass route introduction.

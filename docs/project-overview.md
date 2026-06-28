# Project Overview

## What `meme-elf` is

`meme-elf` is a browser-only meme editor for fast personal-use image editing and meme creation.

The product started as a narrow Imgflip-style flow:

- import an image
- add text quickly
- move text quickly
- export quickly

It has since expanded into a broader static editor, but the fast meme flow is still the product anchor and must not be sacrificed for advanced tooling.

## Product modes

The roadmap now treats the product as three overlapping usage modes:

1. `Quick meme`
2. `Image edit++`
3. `Template meme`

Current shipped work already covers all three at alpha level, but the first mode is the non-negotiable baseline.

## Product boundaries

Keep these constraints unless the roadmap explicitly changes them:

- static-host friendly
- browser-only implementation
- no required backend
- no required auth
- best-effort clipboard enhancements with graceful fallbacks
- mobile and PWA support, but without turning the product into an infra-heavy app

Do not expand by default into:

- accounts
- cloud save
- public gallery
- AI helpers
- animation or video formats

## Core concept decisions

These decisions matter for future work:

- `React + TypeScript + Vite` is the default stack.
- The desktop shell is `top action bar + large preview workspace + right-side inspector`.
- Advanced tools belong in dedicated right-inspector tabs rather than a left rail.
- Watermark controls are scene-wide and live in a dedicated `Watermark` tab.
- The app is allowed to use capability-gated or localhost-only surfaces for experimental or maintenance tooling.
- The native `.melf` format is the save/template source of truth for the current product direction.

## Delivery philosophy

This repo optimizes for:

- fastest path to a useful shipped alpha
- low operational overhead
- static deployment portability
- progressive enhancement instead of brittle browser-specific hacks

That means product and architecture choices should prefer:

- simple local/browser workflows
- narrow, explicit fallbacks
- small modules with clear seams
- documentation updates in the same stream as shipped behavior changes

## Read next

- [current-state.md](/D:/PETS/meme-elf/docs/current-state.md)
- [implementation-status.md](/D:/PETS/meme-elf/docs/implementation-status.md)
- [architecture-map.md](/D:/PETS/meme-elf/docs/architecture-map.md)

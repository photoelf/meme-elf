# CLAUDE.md

## What this project is

`meme-elf` is a browser-only static web app for fast meme creation and lightweight image editing. Working alpha, deployed as static assets (Cloudflare Pages, production branch `main`). No backend, no auth, no server-side rendering.

Three overlapping product modes, in priority order:

1. `Quick meme` — import image, add text, move text, export. This flow is the non-negotiable anchor; never slow it down for advanced tooling.
2. `Image edit++` — crop, canvas expansion, adjustments, effects, watermark, draw/erase, selection/extraction, narrow clone stamp.
3. `Template meme` — shipped template catalog plus localhost-only curator tooling.

Shipped functionality highlights:

- image import from clipboard, direct URL, and file upload, with a pre-insert `Prepare image` modal (crop/rotate/flip)
- multiple text layers with inline canvas editing; image layers; draw layers
- native `.melf` format for local save/reopen and templates; `Saves` inspector tab with recent scenes and mobile recovery drafts
- export via clipboard copy (best-effort with fallbacks) and PNG download
- PWA installability with a narrow shell-only service worker contract
- Telegram Mini App on the `/t` route (same SPA, route-scoped host behavior)
- phone-first mobile posture: gesture arbitration, touch crop, bottom action bars, recovery snapshots

Roadmap state: milestones `M0`–`M11` are closed. Next likely direction is post-`M11` mobile polish (no approved milestone package yet).

## Commands

- `npm run dev` — local dev server (Vite)
- `npm run dev:lan` — dev server on `0.0.0.0` for phone testing over LAN
- `npm run build` — `tsc -b && vite build`, output in `dist/`
- `npm test` — Vitest watch mode
- `npm test -- --run <paths>` — targeted one-shot test run

## Architecture

React 19 + TypeScript + Vite SPA.

- `src/app/App.tsx` — the main orchestration layer: editor state, preview interactions, import/export, inspector wiring. Most work either adds a feature-module helper consumed here, or extends a feature module and wires it through here.
- `src/app/types.ts`, `src/app/default-state.ts` — shared types and baseline state
- `src/features/<area>/` — feature modules: `bounds` (crop/scene geometry), `canvas` (render pipeline, mobile guardrails), `clipboard`, `controls`, `draw`, `selection`, `image` (import, transforms, effects, watermark), `mobile`, `preview`, `pwa`, `telegram`, `templates`, `toast`
- `src/dev/template-catalog-promote.ts` — localhost-only template promote tooling
- `public/templates/` — shipped template catalog assets (`catalog.json` + per-template dirs)

Tests are Vitest + Testing Library, colocated next to the feature seams they cover, plus integration coverage in `src/app/App.test.tsx`.

## Source-of-truth documents

Read in this order when context is needed; do not duplicate them here:

1. `docs/README.md` — handoff index
2. `design.md` — original product design
3. `docs/2026-06-04-roadmap.md` — **canonical milestone status**; always confirm status here first
4. `docs/current-state.md`, `docs/architecture-map.md` — shipped-state and code map summaries
5. `docs/superpowers/specs/` and `docs/superpowers/plans/` — detailed design reasoning and execution plans per milestone
6. `docs/workflows.md`, `docs/template-publishing-workflow.md` — operational runbooks

When shipped behavior or milestone status changes, update the roadmap and affected docs in the same workstream. New design/plan docs go under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Rules that should not be broken casually

- Keep the fast meme flow fast.
- Keep the app static-host friendly: no backend, no auth, no upload service.
- Do not expand scope by default into accounts, cloud save, public gallery, AI helpers, or animation/video.
- Prefer browser capability detection over user-agent branching.
- Clipboard workflows are best-effort enhancements with explicit fallback UX, never hard requirements.
- Localhost-only maintenance surfaces (`Experimental` tab, template curator, mobile debug status) are intentional, not unfinished production UX.
- `.melf` is the save/template source of truth; PSD is not an active path.
- Validate on desktop Chrome first, then Safari/mobile touch behavior.

## Layout conventions

- Desktop shell: top action bar (icon-only actions with delayed tooltips) + large preview workspace + right-side inspector.
- Advanced editing lives in right-inspector tabs, one dedicated tab per tool — never a left tool rail. Current tabs: `Layers`, `Crop`, `Adjustments`, `Draw`, `Effects`, `Watermark`, `Templates`, `Saves`, plus localhost `Experimental`.
- Scene-wide watermark controls stay in the `Watermark` tab, not in text-layer settings.
- Keep the inspector compact and free-floating; no oversized padded cards or tall nested sidebar shells.
- Text-labeled buttons stay inside inspector panels unless intentionally compact icon actions.

## Telegram route contract

- `/` is the normal web/PWA surface; `/t` is the Telegram Mini App surface.
- `/t` reuses the same SPA and editor core — never fork the product.
- Telegram SDK loading and Telegram-only host behavior stay scoped to `/t`; `/` must stay free of Telegram regressions.
- Direct browser opens of `/t` keep working for smoke testing.
- Bot registration points at the deployed `/t` URL, not `/`.

## Verification before calling work complete

- Run targeted tests for the touched area, then `npm run build`.
- UI-heavy work: quick local smoke via `npm run dev`.
- Mobile-, PWA-, or Telegram-affecting changes: follow the checklists in the `verifying-platform-seams` skill (`.claude/skills/verifying-platform-seams/`).
- Template catalog changes: follow the `publishing-templates` skill, backed by `docs/template-publishing-workflow.md`.
- Named roadmap chunks/epics/milestones: follow the `continuing-roadmap-work` skill.

## When a new plan is needed before coding

Write a new design/plan doc first when the work is a new feature family, changes product boundaries, reopens deferred areas (auth, cloud, AI, advanced retouch), or current docs do not describe the intended behavior clearly enough to implement safely.

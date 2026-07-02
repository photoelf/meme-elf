---
name: publishing-templates
description: Use when adding, updating, reordering, or publishing meme templates to the shipped Templates catalog — anything touching .melf template drafts, Template Curator, public/templates, or catalog.json
---

# Publishing Templates

## Overview

Template publishing is a two-surface workflow: the localhost-only `Experimental` → `Template Curator` edits a draft state; `Promote shipped catalog` writes it into repo-backed assets under `public/templates/`. Until promote runs and `main` deploys, a template is not published.

**Authoritative runbook:** `docs/template-publishing-workflow.md` — follow it step by step for the full flow.

## Quick reference

1. `npm run dev`, open localhost (curator is localhost-only; production builds do not expose it).
2. `Experimental` → `Template Curator` → `Import .melf templates`.
3. Fix `Title`, `Tags`, and card order in the draft list.
4. `Promote shipped catalog` — writes `public/templates/catalog.json` and `public/templates/<template-id>/` (at minimum `template.melf`, plus `preview.png` / `base.png` when artifacts are split out).
5. Verify with `git diff -- public/templates` and by applying the template from the normal `Templates` tab.
6. Run before committing:
   ```bash
   npm test -- --run src/app/App.test.tsx src/features/templates/template-curator.test.tsx src/features/templates/shipped-template-catalog.test.ts
   npm run build
   ```
7. Commit `public/templates` (plus any touched docs/src), push to `main`, verify the `Templates` tab on production after deploy.

## Common mistakes

- Editing `public/templates/` by hand instead of promoting through the curator.
- Expecting the curator on a deployed URL — it is localhost-only by design.
- Calling a template "published" before promote + deploy of `main`.

# Workflows

## Purpose

This file collects the recurring human workflows for continuing and maintaining `meme-elf`.

## Workflow: continue a roadmap chunk

Use this when a developer is asked to execute a named chunk, epic, or milestone.

1. Open [2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md).
2. Confirm the exact chunk id, milestone order, and current status.
3. Open the matching spec/plan under [docs/superpowers/](/D:/PETS/meme-elf/docs/superpowers/).
4. Inspect current code before assuming the plan is still perfectly aligned.
5. Implement the named slice.
6. Update tracked docs if shipped behavior or status changed.
7. Verify with tests/build and any seam-specific smoke that applies.

## Workflow: template publishing

Use the dedicated runbook:

- [template-publishing-workflow.md](/D:/PETS/meme-elf/docs/template-publishing-workflow.md)

This is the authoritative human workflow for moving templates from localhost curator state into shipped repo assets.

## Workflow: mobile-sensitive changes

If a change affects phone behavior:

1. check the roadmap plus `M10` planning package for precedent
2. verify touch ownership, inspector posture, and fallback UX
3. ensure the fast path around import, edit, and export still works
4. confirm no desktop-only assumptions leaked into phone behavior

Relevant package:

- [2026-06-14-m10-mobile-optimization/README.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-14-m10-mobile-optimization/README.md)

## Workflow: PWA-sensitive changes

If a change affects installability, update behavior, or app-shell assumptions:

1. verify that the narrow shell-caching contract still holds
2. avoid turning current PWA support into a misleading offline-first promise
3. test build output and basic runtime behavior
4. re-check the relevant `M9` roadmap sections

## Workflow: Telegram-sensitive changes

When a change touches `/t`, Telegram host behavior, or bot-registration/runtime expectations:

1. read [2026-06-24-m11-telegram-mini-app-design.md](/D:/PETS/meme-elf/docs/superpowers/specs/2026-06-24-m11-telegram-mini-app-design.md)
2. read [2026-06-24-m11-telegram-mini-app.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-24-m11-telegram-mini-app.md)
3. preserve the `/` normal app path while changing `/t`
4. verify that Telegram-only runtime behavior remains route-scoped
5. re-check the Telegram release checklist in [README.md](/D:/PETS/meme-elf/README.md) if deploy/runtime behavior changed

## Workflow: documentation sync after shipped behavior changes

When behavior changes materially:

1. update the code
2. update the roadmap if status or milestone wording changed
3. update any affected handoff summaries in `docs/`
4. update workflow docs only if the human operating routine changed

## Workflow: deciding whether a new plan is needed

Write a new design/plan before coding when:

- the work is a new feature family
- the work changes product boundaries
- the work reopens previously deferred areas like auth, cloud, AI, or advanced retouch
- the current docs do not describe the intended behavior clearly enough to implement safely

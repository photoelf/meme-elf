---
name: continuing-roadmap-work
description: Use when asked to continue, implement, or execute a named meme-elf roadmap chunk, epic, or milestone, or when picking the next implementation target without a named task
---

# Continuing Roadmap Work

## Overview

The roadmap is the canonical milestone-status document. Specs and plans under `docs/superpowers/` hold the reasoning and batch details. Never assume docs are perfectly current — verify against code before implementing.

## Workflow

1. Open `docs/2026-06-04-roadmap.md`. Confirm the exact chunk id, milestone order, and current status.
2. Open the matching spec under `docs/superpowers/specs/` and plan under `docs/superpowers/plans/`. The most structured package is `docs/superpowers/plans/2026-06-14-m10-mobile-optimization/` (see its `README.md` and `catalog.md`).
3. Inspect the current code before assuming the plan is still aligned with reality.
4. Implement the named slice only — do not expand scope into adjacent batches.
5. Update tracked docs in the same stream if shipped behavior or status changed: roadmap first, then handoff summaries in `docs/` if they would become misleading.
6. Verify: targeted tests for the touched area, `npm run build`, and any seam-specific smoke from the `verifying-platform-seams` skill.

## No named task

If no exact task is named, the default direction is post-`M11` mobile polish — but first confirm whether a fresh design/plan package is needed (see "When a new plan is needed" in `CLAUDE.md`).

## Common mistakes

- Treating handoff summaries in `docs/` as milestone truth — the roadmap is canonical.
- Creating a second roadmap or status list — update the real one.
- Assuming localhost-only surfaces are bugs — they are intentional maintenance tooling.

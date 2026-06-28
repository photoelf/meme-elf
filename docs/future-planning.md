# Future Planning

## Purpose

This file separates:

- work that is already designed or planned
- work that is only lightly sketched
- work that still needs explicit planning before implementation

## Already planned in meaningful detail

### Telegram Mini App history

This workstream is already designed, executed, and now useful as the maintenance baseline:

- design: [2026-06-24-m11-telegram-mini-app-design.md](/D:/PETS/meme-elf/docs/superpowers/specs/2026-06-24-m11-telegram-mini-app-design.md)
- roadmap milestone: [2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)
- execution plan: [2026-06-24-m11-telegram-mini-app.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-24-m11-telegram-mini-app.md)

Use these docs when changing `/t`, Telegram host behavior, or Telegram deployment/registration steps.

### Mobile optimization history

The most fully decomposed execution package in the repo is:

- [2026-06-14-m10-mobile-optimization/README.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-14-m10-mobile-optimization/README.md)
- [2026-06-14-m10-mobile-optimization/catalog.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-14-m10-mobile-optimization/catalog.md)

That package matters as a template for future deeply structured milestone planning.

### Template/save/template-catalog work

The `M8` area is already covered by multiple plans and specs, including:

- template foundation
- text slot metadata
- image slot metadata
- template UX
- shipped template catalog
- local save/reopen

Use the roadmap plus these plans before reopening or extending that area.

## Planned but likely needing refresh before implementation

### Post-`M11` mobile polish follow-up

The roadmap points to a new mobile polish sprint after `M11`, but that work is not yet packaged as a dedicated approved spec/plan set.

The latest shipped adjustments already include:

- phone-shell removal of clipboard import actions
- localhost-only mobile debug status details
- compact one-line text rows in the `Layers` inspector on phone
- Telegram-safe bottom action bar coverage without inspector bleed-through

If the next sprint expands beyond that narrow follow-up, write a fresh package instead of treating the old `M10` and `M11` notes as a complete execution plan.

### PWA follow-up

`M9` is marked complete for the current alpha target, but future PWA work would likely need a fresh design if any of these become goals:

- broader offline durability
- more aggressive install flows
- stronger recovery guarantees
- background/update policies beyond the current shell posture

### Template ecosystem expansion

The current shipped template system is intentionally narrow. If the project later wants:

- a larger shipped library
- richer preview assets
- multi-image templates
- template import/export beyond current local workflows

then the current `M8` docs are a base, not a full future-product plan.

## Not yet properly planned and should be planned before coding

These areas do not appear to have an equivalent fully approved next-step package in `docs/`:

- any post-`M11` milestone or formal post-`M11` mobile sprint package
- any re-entry into auth, cloud save, gallery, or AI-assisted workflows
- any advanced retouch system beyond the current narrow clone-stamp posture
- any major monetization or service-backed product expansion

If one of those directions becomes active, write a new spec and plan instead of piggybacking on alpha-era assumptions.

## Planning rule for future contributors

Before implementing a non-trivial new feature family:

1. verify whether the work is already covered by roadmap/spec/plan docs
2. if not, create a new design doc
3. create or update the implementation plan
4. only then treat the work as active execution

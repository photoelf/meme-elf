# Document Map

## Source-of-truth hierarchy

Use the documentation in this order.

### 1. Product intent and hard constraints

- [design.md](/D:/PETS/meme-elf/design.md)
- [2026-06-04-meme-generator-alpha-design.md](/D:/PETS/meme-elf/docs/superpowers/specs/2026-06-04-meme-generator-alpha-design.md)

Use these to understand original product direction, MVP boundaries, stack choice, and hosting posture.

### 2. Current product and milestone truth

- [2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)

This is the main tracked status document for:

- milestone state
- epic/batch sequencing
- next recommended implementation target
- current product direction changes

### 3. Detailed design history

- [docs/superpowers/specs/](/D:/PETS/meme-elf/docs/superpowers/specs/)

Use these when you need the reasoning behind a feature family or milestone-level design decision. They are especially useful for:

- post-alpha editor evolution
- mobile optimization
- template UX and save/template format decisions
- Telegram Mini App planning

### 4. Detailed execution plans

- [docs/superpowers/plans/](/D:/PETS/meme-elf/docs/superpowers/plans/)

Use these for milestone execution details, epic breakdowns, and batch definitions. The most structured package currently is:

- [2026-06-14-m10-mobile-optimization/README.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-14-m10-mobile-optimization/README.md)
- [2026-06-14-m10-mobile-optimization/catalog.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-14-m10-mobile-optimization/catalog.md)

### 5. Operational runbooks

- [template-publishing-workflow.md](/D:/PETS/meme-elf/docs/template-publishing-workflow.md)
- [workflows.md](/D:/PETS/meme-elf/docs/workflows.md)

Use these for repeated human workflows rather than product design decisions.

## What this handoff layer adds

The new handoff files in `docs/` do not replace the documents above. They provide:

- fast onboarding
- status compression
- architecture and file-map context
- planning gap analysis
- explicit guidance on where to look next

## What not to do

Do not create a second roadmap here.

If a milestone state changes:

- update the real roadmap first
- then update the handoff summary if it would become misleading

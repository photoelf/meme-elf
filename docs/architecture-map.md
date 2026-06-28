# Architecture Map

## High-level shape

`meme-elf` is a React + TypeScript + Vite SPA.

The codebase follows a practical split:

- `src/app/` for app-level state, top-level wiring, and shared types
- `src/features/` for feature-specific logic and UI
- `src/styles/` for global styling
- `public/` for static shipped assets, including template catalog assets

## Main orchestration layer

- [src/app/App.tsx](/D:/PETS/meme-elf/src/app/App.tsx)

This is the main integration surface. It coordinates:

- editor state
- preview interactions
- import/export actions
- inspector panels
- feature-module calls
- environment-specific behavior seams

Most new product work will either:

- add a new helper/module consumed by `App.tsx`, or
- extend an existing feature module and then wire it through `App.tsx`

## App-level files

- [src/app/default-state.ts](/D:/PETS/meme-elf/src/app/default-state.ts): baseline editor state
- [src/app/types.ts](/D:/PETS/meme-elf/src/app/types.ts): shared app data types
- [src/app/App.test.tsx](/D:/PETS/meme-elf/src/app/App.test.tsx): integration coverage for core editor flows

## Feature areas

### Bounds and scene geometry

- [src/features/bounds/](/D:/PETS/meme-elf/src/features/bounds/)

Owns crop overlays, scene bounds math, and fill modes for canvas expansion.

### Canvas and rendering

- [src/features/canvas/](/D:/PETS/meme-elf/src/features/canvas/)

Owns render-pipeline logic and mobile preview guardrails.

### Clipboard

- [src/features/clipboard/](/D:/PETS/meme-elf/src/features/clipboard/)

Owns clipboard reads/writes and related browser capability handling.

### Controls and layout

- [src/features/controls/](/D:/PETS/meme-elf/src/features/controls/)

Owns control-panel structure and mobile/tooltip behavior helpers.

### Draw and raster editing

- [src/features/draw/](/D:/PETS/meme-elf/src/features/draw/)
- [src/features/selection/](/D:/PETS/meme-elf/src/features/selection/)

Owns brush engine, draw-layer logic, selection extraction, and clone-stamp experimentation.

### Image import and transforms

- [src/features/image/](/D:/PETS/meme-elf/src/features/image/)

Owns loading, pre-insert flow, crop helpers, scene image transforms, effects, and watermark utilities.

### Mobile-specific fallbacks

- [src/features/mobile/](/D:/PETS/meme-elf/src/features/mobile/)
- [src/features/preview/](/D:/PETS/meme-elf/src/features/preview/)

Owns mobile export fallbacks, gesture policy, and preview-canvas behavior.

### PWA

- [src/features/pwa/](/D:/PETS/meme-elf/src/features/pwa/)

Owns narrow PWA shell/runtime behavior.

### Telegram host integration

- [src/features/telegram/](/D:/PETS/meme-elf/src/features/telegram/)

Owns `/t` route detection, Telegram SDK loading, host snapshot/lifecycle wiring, and Telegram-specific export capability policy.

### Templates and saves

- [src/features/templates/](/D:/PETS/meme-elf/src/features/templates/)
- [src/dev/template-catalog-promote.ts](/D:/PETS/meme-elf/src/dev/template-catalog-promote.ts)

Owns `.melf` scene/template handling, curator storage, shipped catalog loading, recent scene storage, template picker/curator UI, and promote tooling.

## Static assets and shipped content

- [public/](/D:/PETS/meme-elf/public/)

Important shipped assets live here, especially the template catalog under `public/templates/`.

## Testing posture

The repo already has substantial Vitest coverage around utility-heavy areas. Expect targeted tests near the feature seam you touch, plus broader integration coverage in app-level tests.

## Architectural guidance for new work

- Prefer extending existing feature modules over adding new app-global complexity.
- Keep browser capability logic near the feature seam that needs it.
- Add new documentation when product behavior changes shape, not only when code changes.

# meme-elf

Minimal browser-only meme generator for personal use.

The goal is a fast editor in the spirit of Imgflip:
- paste an image from the clipboard or upload a file
- add top and bottom text
- drag text layers on the image
- copy the result as an image or download PNG

## Status

Project is in working alpha.

Current repo state:
- React + TypeScript + Vite static app
- clipboard paste and file upload
- top action bar with compact icon-only actions and delayed tooltips
- right-side inspector with full-width tabs for `Layers`, `Crop`, `Adjustments`, `Draw`, and `Effects`, plus localhost-only `Watermark` and `Experimental` tabs in the current workspace build
- advanced `Upload Image` / `Advanced import` pre-insert modal with crop, rotate, and flip
- scene crop with draggable crop box, resize handles, and scene-level rotate / flip actions for the image stack
- canvas expansion with transparent, solid, sampled-edge, and average-border fill
- expansion presets for equal margin, top caption space, bottom caption space, and square canvas
- split image controls with fixed-order `Adjustments` and reorderable `Effects`
- scene-wide `Adjustments` for brightness, contrast, saturation, hue, grayscale, sepia, and invert, with `Apply to text` scope toggle
- reorderable `Effects` stack for blur, sharpen, threshold, pixelate, noise, grain, posterize, and JPEG degrade
- scene-wide watermark modes for centered, corner, tiled, and diagonal text overlays with dedicated corner selection, tile rotation, and independent color, opacity, and size controls
- text layer editing, reorder, move, resize, and rotate
- inline canvas text editing with multiline entry and live box-fit recovery after line removal
- image layer insert, reorder, move, resize, rotate, and remove
- draw layers with committed raster strokes in preview, clipboard copy, and PNG export
- draw and erase modes with draft stroke preview, draw-layer-only erase commits, stroke undo, and pointer-cancel cleanup
- draw inspector controls for `Draw`, `Erase`, `New draw layer`, brush color, size, opacity, soft edge, and eyedropper color sampling
- rectangular marquee selection scoped to one raster target at a time
- immediate rectangular selection commit with `Copy to new layer` and `Cut to new layer`
- keyboard `Ctrl/Cmd+C`, `Ctrl/Cmd+X`, and `Ctrl/Cmd+V` extraction flow for selection copy, cut, and paste
- extraction from the base image, image layers, and draw layers into normal image layers
- local-only `Experimental` tab with a shipped local-only narrow `Clone Stamp` tool using `Alt+click` source sampling, layer-scoped stamping, undoable stroke commits, and no healing or seamless-patch automation
- preview zoom and middle-mouse pan for desktop editing
- undo / redo with physical-key `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`
- copy to clipboard and PNG download
- Vitest coverage for the core editor flows

Known alpha behavior:
- when `Apply to text` is disabled, scene effects apply only to non-text content and text stays above the filtered image stack
- when `Apply to text` is enabled, text joins the filtered scene pass and can render behind imported image layers; this is currently accepted for alpha and the default remains `off`
- effects process in the order shown in the `Effects` block; drag cards to change the pipeline order for preview, copy, and PNG export
- watermarks render as a separate scene-level overlay in their own `Watermark` tab instead of becoming normal text layers
- watermark defaults now start from `meme-elf` in gray `Arial` at `50%` opacity with no outline, using the lower-left corner preset
- healing, seamless patch, and content-aware repair remain deferred research outcomes rather than shipped editor tools

Current desktop layout conventions:
- global actions live in the top bar as icon-only buttons with delayed tooltips
- preview-local undo/redo and zoom controls stay with the preview header
- advanced editing lives in the right inspector rather than a left tool rail
- inspector navigation uses one dedicated full-width icon tab per tool, while selection starts from the preview toolbar and extraction actions stay adjacent to that canvas-local control
- scene-level rotate / flip actions in `Crop` affect only the image stack; text layers stay in place
- text buttons inside inspector sections should stay readable unless they are intentionally compact icon actions

Current source documents:
- [design.md](/D:/PETS/meme-elf/design.md)
- [docs/2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)
- [docs/superpowers/specs/2026-06-04-meme-generator-alpha-design.md](/D:/PETS/meme-elf/docs/superpowers/specs/2026-06-04-meme-generator-alpha-design.md)
- [docs/superpowers/specs/2026-06-05-post-alpha-editor-evolution-design.md](/D:/PETS/meme-elf/docs/superpowers/specs/2026-06-05-post-alpha-editor-evolution-design.md)
- [docs/superpowers/plans/2026-06-05-m6-image-edit-plus.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-05-m6-image-edit-plus.md)
- [docs/superpowers/plans/2026-06-05-m6-post-playtest-polish.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-05-m6-post-playtest-polish.md)
- [docs/superpowers/plans/2026-06-12-m6-effects-watermarks.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-12-m6-effects-watermarks.md)

## Planned Stack

- TypeScript
- React
- Vite
- Static hosting

## Local Development

1. `npm install`
2. `npm run dev`
3. Open the local URL shown by Vite

## Hosting Direction

Primary alpha hosting options, in order:
1. `pages.dev`
2. `Render Static Site`
3. local host on `Steam Deck` over `Tailscale`

The app should remain a static frontend with no backend dependency in MVP.

## Alpha Deployment Note

Prefer `pages.dev` first, then `Render Static Site`. Keep the app deployable as plain static assets.

## Cloudflare Pages Deploy

Recommended Pages settings for this repo:
- Framework preset: `Vite` or `None`
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: leave empty unless you later move the app into a monorepo

Manual deploy checklist:
1. Push the repo to GitHub.
2. In Cloudflare, open Workers & Pages and create a new Pages application from the Git repository.
3. Select the `photoelf/meme-elf` repository.
4. Set:
   - Production branch: `main`
   - Build command: `npm run build`
   - Build directory: `dist`
5. Start the first deploy.
6. After the `*.pages.dev` URL is live, verify:
   - clipboard paste
   - file upload
   - text editing
   - move / resize / rotate
   - `Copy Image`
   - `Download PNG`

Notes:
- `meme-elf` is a static frontend and does not need Pages Functions.
- Clipboard features should be validated on the final `HTTPS` Pages URL, not only on localhost.

## MVP Scope

Included:
- clipboard image paste
- file upload fallback
- multiple editable text layers
- basic text styling
- image layers and pre-insert preparation for UI imports
- scene crop and canvas bounds expansion
- draw layers and desktop brush painting
- selection/extraction into new layers
- desktop mouse interactions
- copy/export as PNG

Excluded:
- auth
- meme history
- GIF/video editing
- AI features
- healing, seamless patch, and content-aware repair beyond the current narrow clone-stamp experiment

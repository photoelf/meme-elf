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
- advanced `Upload Image` / `Advanced import` pre-insert modal with crop, rotate, and flip
- text layer editing, reorder, move, resize, and rotate
- image layer insert, reorder, move, resize, rotate, and remove
- preview zoom and middle-mouse pan for desktop editing
- copy to clipboard and PNG download
- Vitest coverage for the core editor flows

Current source documents:
- [design.md](/D:/PETS/meme-elf/design.md)
- [docs/2026-06-04-roadmap.md](/D:/PETS/meme-elf/docs/2026-06-04-roadmap.md)
- [docs/superpowers/specs/2026-06-04-meme-generator-alpha-design.md](/D:/PETS/meme-elf/docs/superpowers/specs/2026-06-04-meme-generator-alpha-design.md)
- [docs/superpowers/specs/2026-06-05-post-alpha-editor-evolution-design.md](/D:/PETS/meme-elf/docs/superpowers/specs/2026-06-05-post-alpha-editor-evolution-design.md)
- [docs/superpowers/plans/2026-06-05-m6-image-edit-plus.md](/D:/PETS/meme-elf/docs/superpowers/plans/2026-06-05-m6-image-edit-plus.md)

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
- desktop mouse interactions
- copy/export as PNG

Excluded:
- auth
- meme history
- GIF/video editing
- AI features

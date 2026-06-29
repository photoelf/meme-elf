# meme-elf

Minimal browser-only meme generator for personal use.

The goal is a fast editor in the spirit of Imgflip:
- paste an image from the clipboard, load a direct image URL, or upload a file
- add top and bottom text
- drag text layers on the image
- copy the result as an image or download PNG

## Status

Project is in working alpha.

Current repo state:
- React + TypeScript + Vite static app
- clipboard paste, direct image URL import, and file upload
- top action bar with compact icon-only actions and delayed tooltips
- right-side inspector with full-width tabs for `Layers`, `Crop`, `Adjustments`, `Draw`, `Effects`, `Watermark`, `Experimental`, and a right-edge `Templates` tab kept outside the main canvas flow during local QC
- advanced `Upload Image` / `Paste image URL` / `Advanced import` pre-insert modal with crop, rotate, and flip, including touch-safe one-finger crop editing on phone
- scene crop with draggable crop box, resize handles, and scene-level rotate / flip actions for the image stack
- canvas expansion with transparent, solid, sampled-edge, and average-border fill
- expansion presets for equal margin, top caption space, bottom caption space, and square canvas
- split image controls with fixed-order `Adjustments` and reorderable `Effects`
- scene-wide `Adjustments` for brightness, contrast, saturation, hue, grayscale, sepia, and invert, with `Apply to text` scope toggle
- reorderable `Effects` stack for blur, sharpen, threshold, pixelate, noise, grain, posterize, and JPEG degrade
- scene-wide watermark modes for centered, corner, tiled, and diagonal text overlays with dedicated corner selection, tile rotation, and independent color, opacity, and size controls
- text layer editing, reorder, one-finger move, two-finger scale / rotate, resize, and rotate-handle support
- inline canvas text editing with multiline entry and live box-fit recovery after line removal
- image layer insert, reorder, one-finger move, two-finger scale / rotate, resize, rotate, and remove
- draw layers with committed raster strokes in preview, clipboard copy, and PNG export
- draw and erase modes with draft stroke preview, draw-layer-only erase commits, stroke undo, and pointer-cancel cleanup
- draw inspector controls for `Draw`, `New draw layer`, conditional `Erase`, and brush color, size, opacity, and soft edge
- rectangular marquee selection scoped to one raster target at a time
- immediate rectangular selection commit with `Copy to new layer` and `Cut to new layer`
- keyboard `Ctrl/Cmd+C`, `Ctrl/Cmd+X`, and `Ctrl/Cmd+V` extraction flow for selection copy, cut, and paste
- extraction from the base image, image layers, and draw layers into normal image layers
- local-only `Experimental` tab with a shipped local-only narrow `Clone Stamp` tool plus a dev-only meme template curator for importing `.melf` templates, editing `title` and `tags`, reordering the curated set, removing draft entries, and promoting the current localhost draft library into repo-backed shipped assets under `public/templates/`
- meme template picker with square preview tiles in a dedicated inspector `Templates` tab that applies whatever is currently in the shipped catalog, while localhost curation remains a separate draft workflow instead of forcing starter presets into the workspace
- native `.melf` scene document normalization for local save/reopen work, covering embedded base-image payloads plus editable text, image, and draw layers without serializing transient editor UI state
- top-bar `Open .melf` and `Save .melf` actions for native local save/reopen, preferring browser file-picker handles for overwrite and falling back to hidden file-input open plus downloadable `.melf` files when needed
- top-bar `New canvas` action that resets the current scene to a clean default canvas without reviving stale recovery state
- dedicated inspector `Saves` tab for reopening recent local `.melf` scenes from browser storage, removing stale recent entries, and recovering or dismissing interrupted mobile recovery drafts without putting saved-work UX into the main canvas flow
- preview zoom with `1:1`, `Fit`, mouse-wheel zoom, and middle-mouse pan for desktop editing
- responsive mobile shell foundation with phone preview-first stacking, collapsed inspector access, phone top-bar `Upload` / `Paste URL` / theme actions kept inline, fixed bottom mobile primary actions, a single-row phone `preview-toolbar` with the `MEME` title removed from that compact header, touch taps that clear delayed-tooltip focus state on icon buttons, placeholder-and-import preview auto-fit, viewport-height / keyboard-aware layout state, and a `Tools` toggle flow that scrolls to the inspector tab row on open and back to the top bar on close
- mobile interaction policy helpers that explicitly arbitrate touch pan, draw, crop, selection, and transform ownership
- explicit preview touch scroll suppression so active canvas gestures stay on the canvas instead of turning into page scroll on phone
- touch-oriented focus cues with larger preview handles for crop and transform work, localhost-only mobile debug status details, direct touch crop handles in `Prepare image`, and gesture ownership that keeps active layer transforms from falling through into preview pinch zoom
- phone retouch session bars that move `Draw`, `Erase`, `Pick color`, `Select`, and selection extraction actions to the bottom edge while keeping brush settings in the `Draw` tab
- experimental retouch now has an explicit phone fallback posture: clone stamp stays desktop-only on phone instead of exposing a brittle touch flow
- mobile clipboard import fallback guidance, touch-tap inline text editing on the active text layer, outside-tap dismissal for active text focus and inline editing, canvas-first phone text editing that keeps `Tools` collapsed until explicitly opened, and phone copy fallback that opens a long-press-ready finished-image modal with bottom-edge download and close icon actions when direct clipboard image write is unavailable or blocked
- pasted `http/https` URLs now auto-try direct image fetch when the clipboard does not contain an image payload, and the same URL import flow is available from the top bar and `Layers`
- the URL input inside `Prepare image` remains a normal editable field, so regular text paste works there even while the modal owns background clipboard actions
- mobile preview guardrails that reduce expensive raster-effect passes on phone before preview responsiveness falls off, without changing export output
- phone image imports now downscale oversized working canvases with explicit recovery messaging instead of silently capping them
- mobile clipboard import/export stays progressive enhancement: async clipboard actions require a secure context, phone export keeps `Download PNG` primary, and interrupted phone sessions restore the latest mobile draft as flattened non-text content with editable text preserved where recovery storage allows, falling back to text-only recovery instead of a blank session when phone storage is too tight
- undo / redo with physical-key `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`
- copy to clipboard and PNG download
- Vitest coverage for the core editor flows

Known alpha behavior:
- when `Apply to text` is disabled, scene effects apply only to non-text content and text stays above the filtered image stack
- when `Apply to text` is enabled, text joins the filtered scene pass and can render behind imported image layers; this is currently accepted for alpha and the default remains `off`
- effects process in the order shown in the `Effects` block; drag cards to change the pipeline order for preview, copy, and PNG export
- watermarks render as a separate scene-level overlay in their own `Watermark` tab instead of becoming normal text layers
- watermark defaults now start enabled with `создано в программе meme-elf` in gray `Arial` at `50%` opacity and `12px`, using the lower-left corner preset
- if a phone browser interrupts or reloads the session, the app restores the latest mobile draft as a flattened base image rather than reconstructing the full editable layer stack
- loading a new base image, opening a saved scene, or pressing `New canvas` clears the transient mobile recovery snapshot so stale image/text state cannot reappear in the next session
- healing, seamless patch, and content-aware repair remain deferred research outcomes rather than shipped editor tools

Current desktop layout conventions:
- global actions live in the top bar as icon-only buttons with delayed tooltips
- preview-local undo/redo and zoom controls stay with the preview header
- advanced editing lives in the right inspector rather than a left tool rail
- inspector navigation uses one dedicated full-width icon tab per tool, while selection starts from the preview toolbar and extraction actions stay adjacent to that canvas-local control
- scene-level rotate / flip actions in `Crop` affect only the image stack; text layers stay in place
- text buttons inside inspector sections should stay readable unless they are intentionally compact icon actions

Current source documents:
- [docs/README.md](/D:/PETS/meme-elf/docs/README.md)
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

For local-network manual testing on a phone or tablet:
1. `npm run dev:lan`
2. Open `http://<your-lan-ip>:5173` from the other device on the same network

## Install on iPhone

1. Open the deployed `HTTPS` app URL in Safari.
2. Tap `Share`.
3. Tap `Add to Home Screen`.
4. Confirm the app name is `meme-elf`, then tap `Add`.

Installed mode launches the editor from `/` in standalone mode, so it opens like a tool instead of reopening inside a normal Safari tab.
The standalone-launch helper checks both `(display-mode: standalone)` and Safari `navigator.standalone`, so this install path has an explicit detection contract for later runtime wiring.
When the app is opened in normal iPhone Safari on the deployed `HTTPS` URL, the editor shows a passive `Share` -> `Add to Home Screen` reminder in the status strip. That copy stays hidden in standalone mode and outside the iPhone Safari install path so the normal quick-meme flow stays quiet.
The installed phone shell now adds standalone-specific safe-area padding for the iPhone top inset and keeps the fixed bottom action bars aligned to left/right safe-area edges, so launch-from-icon mode does not crowd the notch or clip the persistent action chrome.

Installability is supported in `9A-1`, and Milestone `9B-1` now defines and registers a narrow offline shell contract:
- cached after the first successful online load: the HTML shell, built JS/CSS bundles referenced by that shell, the web manifest, install icons, and same-origin static assets needed to render the base editor UI
- explicitly out of offline scope: direct image URL fetches, remote images that were not already available locally, and any promise that user-generated scenes or edits are durable offline storage

This is intentionally not a `cache everything` posture. The registered service worker boundary is limited to shipped shell assets so future work can add offline messaging and update UX without pretending the whole editor or imported content is offline-first.
When a new shell update is waiting, the status strip shows a compact `Refresh app` action. That button tells the waiting service worker to activate immediately and then reloads into the updated shell when control changes.

Current verification status for the installed iPhone flow:
- locally covered by automated tests: standalone detection, standalone shell marker wiring, update-available status-strip affordance, `SKIP_WAITING` activation request, and single reload on `controllerchange`
- still requires real-device iPhone smoke before calling the installed flow fully closed: launch from icon, import from supported local paths, edit text, and export through the preferred and fallback routes

## Telegram Mini App

- Telegram launch route: `/t`
- Normal web and PWA route: `/`
- `/t` uses the same SPA and editor core as `/`
- Telegram SDK behavior loads only on `/t`
- direct browser opens of `/t` stay supported for smoke testing and route validation outside Telegram

Current runtime contract:
- Telegram-only host behavior stays capability-gated behind the `/t` route boundary
- normal web and installed PWA behavior on `/` must stay free of Telegram regressions
- export fallback messaging on `/t` may differ from normal web fallback messaging when Telegram host capabilities are detected

Telegram registration/config guide:
1. Deploy the branch preview or production build to an `HTTPS` URL.
2. In BotFather, create or open the target bot.
3. Set the Mini App / main web app URL to the deployed `/t` route, not `/`.
4. Use the same `/t` URL for Telegram smoke tests outside the bot first.
5. Re-check the bot launch after each preview or production deploy that changes Telegram host behavior.

Telegram release checklist:
1. Confirm `/t` opens from a direct browser visit.
2. Confirm `/t` opens inside Telegram with the SDK present.
3. Confirm fullscreen and safe-area layout remain usable on phone.
4. Confirm export still reaches at least one successful user path.
5. Confirm `/` still behaves like the normal web/PWA surface.

Current Telegram verification status:
- branch preview launch via bot is smoke-validated
- iPhone fullscreen layout and Telegram chrome spacing are smoke-validated on the current shared shell
- swipe-down no longer hides the Mini App in the validated Telegram mobile path
- `/t` export currently has at least one successful user path through the shipped capability ladder

Current known limits:
- Telegram iOS may render its own fullscreen overlay chrome above the webview; the `/t` shell now carries an explicit top guard for that host chrome.
- Telegram fullscreen behavior is validated against the current shared editor shell, not a Telegram-specific fork.
- Export in `/t` is still capability-driven: direct clipboard copy may fail, and the user may fall back to Telegram share, file download, or the image fallback modal depending on host support.

Install audit note:
- Missing assets before `9A-1`: no `manifest.webmanifest`, no Apple touch icon, and no dedicated 192px or 512px PWA icons.
- Weak defaults before `9A-1`: only a generic SVG favicon was linked, there was no explicit install name/start URL/theme color contract, and standalone launch metadata was absent.
- Duplicated or conflicting meta tags before `9A-1`: none found; install-facing tags were missing rather than conflicting.

Template publishing workflow:
1. On localhost, open `Experimental` -> `Template Curator`
2. Import or edit `.melf` template drafts
3. Click `Promote shipped catalog`
4. Review the repo diff under `public/templates/`
5. Commit and deploy so the updated shipped catalog appears for normal users in `Templates`

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
- direct image URL import with browser-side `content-type` validation
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

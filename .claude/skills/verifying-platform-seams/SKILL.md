---
name: verifying-platform-seams
description: Use when a meme-elf change affects phone/mobile behavior, touch gestures, PWA installability or the service worker, or the Telegram /t route — before calling the work complete
---

# Verifying Platform Seams

## Overview

Mobile, PWA, and Telegram behavior are intentional, separately-designed seams. Each has its own checklist. Run the checklist(s) matching what the change touches before claiming completion.

## Mobile-sensitive changes

1. Check the roadmap plus the `M10` package for precedent: `docs/superpowers/plans/2026-06-14-m10-mobile-optimization/README.md`.
2. Verify touch ownership (pan vs draw vs crop vs selection vs transform), inspector posture, and fallback UX.
3. Ensure the fast path (import → edit → export) still works on phone.
4. Confirm no desktop-only assumptions leaked into phone behavior.
5. For real-device smoke over LAN: `npm run dev:lan`, open `http://<lan-ip>:5173` from the phone.

Mobile posture reminders: clipboard import/export is progressive enhancement (secure context required, `Download PNG` stays primary); interruption recovery is intentionally lossy for non-text content under storage pressure; clone stamp stays desktop-only.

## PWA-sensitive changes

1. Verify the narrow shell-caching contract still holds: only the HTML shell, built bundles, manifest, icons, and same-origin static assets — not user content or remote images.
2. Do not turn PWA support into an offline-first promise.
3. Test build output and basic runtime behavior.
4. Re-check the relevant `M9` roadmap sections.

## Telegram-sensitive changes

1. Read `docs/superpowers/specs/2026-06-24-m11-telegram-mini-app-design.md` and `docs/superpowers/plans/2026-06-24-m11-telegram-mini-app.md`.
2. Preserve the `/` path while changing `/t`; keep Telegram-only runtime behavior route-scoped.
3. Release checklist before calling Telegram work shipped:
   - direct browser open of `/t` works
   - Telegram launch of `/t` with the SDK present
   - fullscreen and safe-area layout usable on phone (Telegram iOS may need explicit chrome guards beyond reported safe-area values, scoped to `/t`)
   - at least one successful export path from `/t`
   - normal `/` web and PWA behavior intact
4. If deploy/runtime behavior changed, re-check the Telegram registration/checklist sections in `README.md`.

## Common mistakes

- Testing only in desktop Chrome and skipping the touch/gesture pass.
- Widening the service worker cache "while at it".
- Letting Telegram host behavior leak outside the `/t` route boundary.

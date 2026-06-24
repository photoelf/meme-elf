# M9 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an iPhone/Safari-first PWA layer for `meme-elf` so the app can be added to the home screen, launched in standalone mode, and reopen the basic editor shell offline after the first successful online load.

**Architecture:** Keep the existing static React/Vite app as the single product surface, then add a minimal PWA layer around it: install metadata, standalone-safe shell rules, and a tightly scoped offline cache for app code and core assets only. Do not broaden into cloud sync or full offline content workflows; user-generated state stays explicitly local and best-effort.

**Tech Stack:** React, TypeScript, Vite, static hosting, Web App Manifest, Service Worker, Safari/iPhone standalone mode, Vitest

---

## Milestone framing

**Primary target:** iPhone Safari and iPhone home-screen launch path

**Secondary target:** Android installability smoke only; non-critical Android issues become follow-up bugfixes unless they reveal a broken core PWA assumption

**Required milestone exit:**
- the user can add `meme-elf` to the iPhone home screen
- the app launches from the icon in standalone mode
- after one successful online load, the base editor shell reopens without network
- the quick flow remains understandable in standalone mode

## File structure

### PWA metadata and shell

- Modify: `index.html`
  - add or verify iOS/standalone meta tags, manifest link, and install-related metadata
- Create or modify: `public/manifest.webmanifest`
  - define app name, short name, start URL, display mode, theme colors, and icon entries
- Create or modify: `public/icons/*`
  - store installable icon assets sized for iPhone and general PWA use

### Service worker and runtime wiring

- Create: `public/sw.js`
  - own the minimal shell precache and update policy
- Modify: `src/main.tsx`
  - register the service worker and expose update notifications into the app
- Create: `src/features/pwa/pwa-service.ts`
  - wrap registration state, update detection, and standalone detection
- Create: `src/features/pwa/pwa-service.test.ts`
  - cover standalone detection and update-state normalization

### Standalone UI and update UX

- Modify: `src/app/App.tsx`
  - surface update state and standalone-specific UX adjustments
- Modify: `src/app/App.test.tsx`
  - cover update banner/refresh affordance and standalone-specific UI conditions
- Modify: `src/features/mobile/*` or the existing mobile-shell files discovered during implementation
  - apply standalone-safe viewport, safe-area, and chrome tweaks where the current phone shell already lives
- Modify: `src/styles.css` and/or existing shell styles
  - add PWA/standalone CSS hooks without disturbing desktop flow

### Verification and docs

- Modify: `README.md`
  - document iPhone install steps and current offline boundaries
- Modify: `AGENTS.md`
  - keep project guidance aligned if install/offline posture becomes part of expected product behavior
- Modify: `docs/2026-06-04-roadmap.md`
  - update `M9` status when batches ship
- Modify: `docs/superpowers/plans/2026-06-23-m9-pwa-m10-telegram-mini-app.md`
  - keep the rough milestone summary aligned with this execution plan

## Epic 9A: Installability and iOS Entry Path

**Value added:**
- creates the actual home-screen app entry path for the product
- turns `meme-elf` into something the user can launch like a tool, not just reopen as a Safari tab

**Acceptance gates:**
- install metadata does not break the normal browser path
- the iPhone `Add to Home Screen` path is explicit and reproducible
- app icon, name, and start URL are intentional and stable
- standalone launch reaches the correct app surface rather than a broken or partial route

**Epic exit criteria:**
- an iPhone user can add the app to the home screen
- launching from the icon opens the intended editor shell
- install-facing metadata looks deliberate enough to ship

### Task 1: `9A-1` Manifest and icon audit

**Files:**
- Modify: `index.html`
- Create or modify: `public/manifest.webmanifest`
- Create or modify: `public/icons/*`
- Modify: `README.md`

- [ ] **Step 1: Audit existing install metadata and icon assets**

Check:
- whether `index.html` already links a manifest
- whether Apple touch icons already exist
- whether the current app name, short name, start URL, and theme colors match the intended installed product

Expected outcome:
- a short implementation note listing missing assets, weak defaults, and any duplicated/conflicting meta tags

- [ ] **Step 2: Define the install metadata contract**

Write down the exact values before editing:

```ts
const PWA_METADATA = {
  name: 'meme-elf',
  shortName: 'meme-elf',
  startUrl: '/',
  display: 'standalone',
  backgroundColor: '#f5f1e8',
  themeColor: '#f5f1e8',
  orientation: 'portrait',
};
```

Expected outcome:
- one agreed manifest contract used consistently by `index.html`, the manifest file, and docs

- [ ] **Step 3: Add or normalize manifest and icon assets**

Implementation target:
- add `manifest.webmanifest`
- add touch icons and standard PWA icons
- add the manifest link and any missing Apple/mobile-web-app meta tags to `index.html`

Verification:
- `npm run build`
Expected: PASS

- [ ] **Step 4: Document the iPhone install path**

Add a compact section to `README.md` that explains:
- how to add the app to the home screen on iPhone
- what “installed mode” changes
- that offline support is limited to the already loaded app shell

- [ ] **Step 5: Commit `9A-1`**

```bash
git add index.html public/manifest.webmanifest public/icons README.md
git commit -m "feat: add pwa manifest and install assets"
```

### Task 2: `9A-2` Standalone launch validation

**Files:**
- Modify: `src/features/pwa/pwa-service.ts`
- Modify: `src/features/pwa/pwa-service.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing standalone-detection tests**

```ts
it('detects ios standalone mode from navigator.standalone', () => {
  expect(detectStandaloneMode({
    matchMediaStandalone: false,
    navigatorStandalone: true,
  })).toBe(true);
});

it('detects standard standalone mode from display-mode media query', () => {
  expect(detectStandaloneMode({
    matchMediaStandalone: true,
    navigatorStandalone: false,
  })).toBe(true);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/features/pwa/pwa-service.test.ts`

Expected: FAIL because the PWA service module does not exist yet.

- [ ] **Step 3: Implement standalone-mode detection and launch-state helpers**

```ts
export function detectStandaloneMode(input: {
  matchMediaStandalone: boolean;
  navigatorStandalone: boolean;
}) {
  return input.matchMediaStandalone || input.navigatorStandalone;
}
```

Expected outcome:
- the app can reliably branch on standalone mode without hardcoding iPhone-only behavior everywhere

- [ ] **Step 4: Re-run focused tests**

Run: `npm test -- --run src/features/pwa/pwa-service.test.ts`

Expected: PASS

- [ ] **Step 5: Commit `9A-2`**

```bash
git add src/features/pwa/pwa-service.ts src/features/pwa/pwa-service.test.ts README.md
git commit -m "feat: detect standalone launch mode"
```

### Task 3: `9A-3` Install entrypoint UX and fallback copy

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `README.md`

- [ ] **Step 1: Define the install UX boundary**

Rules:
- do not add noisy install prompts to the default quick-meme flow
- prefer passive guidance for iPhone because Safari install is user-driven
- show install help only when it materially helps the user find the home-screen path

- [ ] **Step 2: Write failing UI tests for passive install guidance**

```ts
it('does not show install help once the app is already in standalone mode', () => {
  render(<App />, { standalone: true });
  expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Implement minimal install guidance**

Expected outcome:
- installed users do not see irrelevant install copy
- non-installed iPhone users can still find the path if needed

- [ ] **Step 4: Re-run app tests**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit `9A-3`**

```bash
git add src/app/App.tsx src/app/App.test.tsx README.md
git commit -m "feat: add passive ios install guidance"
```

## Epic 9B: Offline Shell and Asset Caching

**Value added:**
- makes the installed app dependable after first load
- narrows offline support to something honest and shippable instead of pretending the whole editor is offline-first

**Acceptance gates:**
- app shell assets are cached after first successful online load
- external URL import and other network-bound paths remain explicitly out of offline scope
- cache invalidation avoids broken mixed-version states
- user-generated content is not silently treated as guaranteed offline storage

**Epic exit criteria:**
- with the network disabled after one successful online visit, the base editor shell still opens
- offline boundaries are explicit and documented

### Task 4: `9B-1` Service worker strategy and scope contract

**Files:**
- Create: `public/sw.js`
- Create: `src/features/pwa/pwa-service.ts`
- Modify: `src/main.tsx`
- Modify: `README.md`

- [ ] **Step 1: Define the cache boundary before implementation**

Cache:
- HTML shell
- JS/CSS bundles
- manifest and icon assets
- any static editor assets required to render the base UI

Do not promise offline support for:
- direct image URL fetches
- remote images not previously available locally
- cloud-like persistence that does not exist

- [ ] **Step 2: Write the service worker scope contract in docs/comments**

Expected outcome:
- later implementation work cannot accidentally sprawl into “cache everything”

- [ ] **Step 3: Implement a minimal shell-first service worker**

Policy:
- precache a minimal app shell
- use network-first or update-aware handling for HTML entry
- use cache-first or stale-while-revalidate only where it does not create confusing old state
- register `/sw.js` at runtime only when service workers are available so the shell cache can actually take effect after the first successful online load

- [ ] **Step 4: Build and inspect generated asset references**

Run: `npm run build`

Expected: PASS

- [ ] **Step 5: Commit `9B-1`**

```bash
git add public/sw.js src/main.tsx src/features/pwa/pwa-service.ts README.md
git commit -m "feat: add minimal pwa shell service worker"
```

### Task 5: `9B-2` Static shell precache and asset versioning

**Files:**
- Modify: `public/sw.js`
- Modify: `src/main.tsx`
- Modify: `src/features/pwa/pwa-service.ts`
- Modify: `src/features/pwa/pwa-service.test.ts`

- [ ] **Step 1: Write failing tests for update-state normalization**

```ts
it('marks an update as available when a waiting service worker exists', () => {
  expect(normalizeServiceWorkerState({
    hasRegistration: true,
    hasWaitingWorker: true,
  })).toEqual({ updateAvailable: true });
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/features/pwa/pwa-service.test.ts`

Expected: FAIL because update normalization is not implemented yet.

- [ ] **Step 3: Add version-aware shell precache follow-up and update detection**

Expected outcome:
- the installed app keeps a stable shell across shell updates after first successful online load
- the app can detect when a newer cached shell is waiting

- [ ] **Step 4: Re-run focused tests and build**

Run: `npm test -- --run src/features/pwa/pwa-service.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit `9B-2`**

```bash
git add public/sw.js src/main.tsx src/features/pwa/pwa-service.ts src/features/pwa/pwa-service.test.ts
git commit -m "feat: precache app shell and detect updates"
```

### Task 6: `9B-3` Offline messaging and network-boundary rules

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Define the offline messaging contract**

Rules:
- say what still works offline
- say what requires network only when the user hits those paths or when it is otherwise unclear
- do not over-message users during the fast default flow

- [ ] **Step 2: Write failing tests for offline-state messaging**

```ts
it('shows a minimal offline-shell message when the app is offline but loaded', () => {
  render(<App />, { online: false, offlineShellReady: true });
  expect(screen.getByText(/offline/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Implement minimal offline boundary messaging**

Expected outcome:
- users understand that the shell is available offline
- users are not misled into expecting remote URL imports to work without network

- [ ] **Step 4: Re-run app tests**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit `9B-3`**

```bash
git add src/app/App.tsx src/app/App.test.tsx README.md AGENTS.md
git commit -m "feat: clarify offline shell boundaries"
```

## Epic 9C: Standalone Mobile Shell and Update UX

**Value added:**
- makes installed-mode behavior feel intentional on iPhone
- prevents PWA hardening from degrading the existing quick editor flow

**Acceptance gates:**
- standalone viewport, safe-area, and chrome behavior are stable
- update UX is understandable but non-intrusive
- installed mode does not regress import, edit, and export entry points

**Epic exit criteria:**
- launched-from-icon usage feels stable enough for daily use
- update handling is visible and actionable without being noisy

### Task 7: `9C-1` Standalone shell audit and CSS/runtime tweaks

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`
- Modify: the current phone-shell files under `src/features/mobile/` or equivalent

- [ ] **Step 1: Audit current phone-shell assumptions against standalone mode**

Check:
- safe-area insets
- viewport height assumptions
- top bar spacing
- keyboard overlap behavior
- whether any browser-chrome assumptions break when opened from the icon

- [ ] **Step 2: Implement standalone-safe shell tweaks**

Expected outcome:
- installed mode does not produce clipped header, broken viewport sizing, or awkward empty chrome gaps

- [ ] **Step 3: Build and smoke-check the shell**

Run: `npm run build`

Expected: PASS

- [ ] **Step 4: Commit `9C-1`**

```bash
git add src/app/App.tsx src/styles.css src/features/mobile
git commit -m "fix: tune shell for standalone pwa mode"
```

### Task 8: `9C-2` Update detection and refresh affordance

**Files:**
- Modify: `src/features/pwa/pwa-service.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Write failing tests for update affordance**

```ts
it('shows a refresh action when a waiting service worker update exists', () => {
  render(<App />, { updateAvailable: true });
  expect(screen.getByRole('button', { name: /refresh app/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused app tests and verify failure**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: FAIL because update UI is not yet surfaced.

- [ ] **Step 3: Implement a small update-ready affordance**

Rules:
- visible but compact
- not modal
- safe to ignore during an active quick edit

- [ ] **Step 4: Re-run app tests**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit `9C-2`**

```bash
git add src/features/pwa/pwa-service.ts src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: surface pwa update refresh action"
```

### Task 9: `9C-3` Standalone regression sweep across import/export flows

**Files:**
- Modify: `README.md`
- Modify: `docs/2026-06-04-roadmap.md`

- [ ] **Step 1: Run focused verification in standalone mode**

Manual checks:
- launch from icon
- open editor shell
- paste/import from supported local paths
- edit text
- export through the existing preferred/fallback paths

Expected outcome:
- a short verified matrix of what still works, what differs, and what stays acceptable

- [ ] **Step 2: Document any accepted standalone differences**

Document:
- iPhone/Safari-specific behavior
- anything intentionally different from in-browser mode
- any deferred issues that are non-blocking

- [ ] **Step 3: Commit `9C-3`**

```bash
git add README.md docs/2026-06-04-roadmap.md
git commit -m "docs: record standalone pwa regression findings"
```

## Epic 9D: Real-Device Reliability and Recovery

**Value added:**
- closes the milestone against real phone behavior rather than desktop assumptions
- captures known limits before they become surprise bugs

**Acceptance gates:**
- real-device iPhone validation is completed
- the install/reopen/offline-reopen loop is proven on the target device path
- accepted platform limits are documented
- Android smoke is secondary and does not block the milestone

**Epic exit criteria:**
- the iPhone target path is verified end-to-end
- recovery and known-limits notes are documented and acceptable

### Task 10: `9D-1` iPhone install and launch validation

**Files:**
- Modify: `README.md`
- Modify: `docs/2026-06-04-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-23-m9-pwa-m10-telegram-mini-app.md`

- [ ] **Step 1: Run real iPhone install validation**

Manual checks:
- open Safari
- add to home screen
- launch from icon
- kill and relaunch
- verify standalone shell layout

Expected outcome:
- pass/fail notes with exact observed behavior on the real device

- [ ] **Step 2: Record the validated iPhone path**

Document:
- exact supported install path
- any caveats the user should know
- whether the outcome is strong enough to call the epic closed

- [ ] **Step 3: Commit `9D-1`**

```bash
git add README.md docs/2026-06-04-roadmap.md docs/superpowers/plans/2026-06-23-m9-pwa-m10-telegram-mini-app.md
git commit -m "docs: record iphone pwa install validation"
```

### Task 11: `9D-2` Basic offline reopen validation

**Files:**
- Modify: `README.md`
- Modify: `docs/2026-06-04-roadmap.md`

- [ ] **Step 1: Validate offline reopen after first successful online load**

Manual checks:
- open app online once
- fully close the app
- disable network
- relaunch from the icon
- verify the base shell/editor still loads

Expected outcome:
- confirmation that the milestone’s chosen offline baseline is truly met

- [ ] **Step 2: Record the exact offline boundary**

Document:
- what reopened successfully
- what still requires network
- any caveats around stale content or update timing

- [ ] **Step 3: Commit `9D-2`**

```bash
git add README.md docs/2026-06-04-roadmap.md
git commit -m "docs: record offline reopen validation"
```

### Task 12: `9D-3` Recovery, Android smoke, and known-limits closeout

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/2026-06-04-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-23-m9-pwa-m10-telegram-mini-app.md`

- [ ] **Step 1: Run recovery and interruption checks**

Manual checks:
- background and foreground the app
- relaunch after Safari/process eviction if possible
- verify the shell still comes back acceptably

- [ ] **Step 2: Run secondary Android smoke**

Manual checks:
- install if easy
- launch
- verify no catastrophic shell failure

Expected outcome:
- Android issues, if any, are recorded as follow-up bugs rather than milestone blockers unless they reveal a broken core assumption

- [ ] **Step 3: Write the known-limits closeout**

Document:
- accepted iPhone/Safari limitations
- Android follow-ups if any
- whether `M9` is ready to hand off as complete

- [ ] **Step 4: Commit `9D-3`**

```bash
git add README.md AGENTS.md docs/2026-06-04-roadmap.md docs/superpowers/plans/2026-06-23-m9-pwa-m10-telegram-mini-app.md
git commit -m "docs: close pwa reliability milestone"
```

## Self-review

Spec coverage:
- installability path: covered by `9A`
- basic offline shell after first load: covered by `9B` and validated in `9D-2`
- standalone UX and update posture: covered by `9C`
- real-device iPhone-first validation: covered by `9D`

Placeholder scan:
- no `TODO` or `TBD` placeholders
- each batch has files, expected outcome, and verification shape

Type consistency:
- `pwa-service` is the single boundary for standalone detection and update state
- standalone/offline/update concepts are reused consistently across batches

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-m9-pwa-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

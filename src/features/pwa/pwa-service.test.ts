import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyWaitingShellServiceWorkerUpdate,
  buildShellPrecacheUrls,
  detectStandaloneMode,
  getShellServiceWorkerState,
  getShellAssetCachingStrategy,
  getPwaScopeContract,
  normalizeServiceWorkerState,
  resetShellServiceWorkerStateForTests,
  registerShellServiceWorker,
  setShellServiceWorkerStateForTests,
  subscribeShellServiceWorkerState,
  getStandaloneLaunchState,
  STATIC_PWA_SHELL_URLS,
} from './pwa-service';

describe('detectStandaloneMode', () => {
  it('detects ios standalone mode from navigator.standalone', () => {
    expect(
      detectStandaloneMode({
        matchMediaStandalone: false,
        navigatorStandalone: true,
      }),
    ).toBe(true);
  });

  it('detects standard standalone mode from display-mode media query', () => {
    expect(
      detectStandaloneMode({
        matchMediaStandalone: true,
        navigatorStandalone: false,
      }),
    ).toBe(true);
  });

  it('returns false for the normal browser path', () => {
    expect(
      detectStandaloneMode({
        matchMediaStandalone: false,
        navigatorStandalone: false,
      }),
    ).toBe(false);
  });
});

describe('getStandaloneLaunchState', () => {
  it('detects standalone mode from the display-mode media query', () => {
    expect(
      getStandaloneLaunchState(createWindowStub({ matchMediaStandalone: true })),
    ).toEqual({
      isStandalone: true,
      matchMediaStandalone: true,
      navigatorStandalone: false,
    });
  });

  it('detects standalone mode from safari navigator.standalone', () => {
    expect(
      getStandaloneLaunchState(createWindowStub({ navigatorStandalone: true })),
    ).toEqual({
      isStandalone: true,
      matchMediaStandalone: false,
      navigatorStandalone: true,
    });
  });

  it('returns false for the normal browser path', () => {
    expect(
      getStandaloneLaunchState(
        createWindowStub({
          matchMediaStandalone: false,
          navigatorStandalone: false,
        }),
      ),
    ).toEqual({
      isStandalone: false,
      matchMediaStandalone: false,
      navigatorStandalone: false,
    });
  });
});

describe('getPwaScopeContract', () => {
  it('documents a narrow offline shell boundary', () => {
    expect(getPwaScopeContract()).toEqual({
      cachedAfterFirstOnlineLoad: [
        'HTML shell entry (/)',
        'built JS and CSS bundles referenced by the HTML shell',
        'manifest and install icons',
        'same-origin static assets required to render the base UI shell',
      ],
      explicitlyNotOfflineGuaranteed: [
        'direct image URL fetches',
        'remote images that were not already available locally',
        'user-generated scenes, imports, or edits as durable offline storage',
        'cloud-like persistence or background sync that does not exist',
      ],
    });
  });
});

describe('normalizeServiceWorkerState', () => {
  beforeEach(() => {
    resetShellServiceWorkerStateForTests();
  });

  it('marks an update as available when a waiting service worker exists', () => {
    expect(
      normalizeServiceWorkerState({
        hasRegistration: true,
        hasWaitingWorker: true,
      }),
    ).toEqual({ updateAvailable: true });
  });

  it('keeps updateAvailable false when no waiting worker exists yet', () => {
    expect(
      normalizeServiceWorkerState({
        hasRegistration: true,
        hasWaitingWorker: false,
      }),
    ).toEqual({ updateAvailable: false });
  });

  it('publishes shell worker state updates to subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeShellServiceWorkerState(listener);

    setShellServiceWorkerStateForTests({
      updateAvailable: true,
    });

    expect(listener).toHaveBeenNthCalledWith(1, { updateAvailable: false });
    expect(listener).toHaveBeenNthCalledWith(2, { updateAvailable: true });
    expect(getShellServiceWorkerState()).toEqual({ updateAvailable: true });

    unsubscribe();
  });

  it('posts skip-waiting to the current shell update when refresh is requested', () => {
    const postMessage = vi.fn();

    setShellServiceWorkerStateForTests({
      updateAvailable: true,
      registration: {
        waiting: {
          postMessage,
        },
      } as unknown as ServiceWorkerRegistration,
    });

    expect(applyWaitingShellServiceWorkerUpdate()).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});

describe('buildShellPrecacheUrls', () => {
  it('builds a deduped shell asset list from built html', () => {
    expect(
      buildShellPrecacheUrls(`<!doctype html>
        <html>
          <head>
            <link rel="icon" href="/favicon.svg" />
            <link rel="manifest" href="/manifest.webmanifest" />
            <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
            <link rel="stylesheet" href="/assets/index-abc123.css" />
          </head>
          <body>
            <script type="module" src="/assets/index-def456.js"></script>
          </body>
        </html>`),
    ).toEqual([
      '/',
      ...STATIC_PWA_SHELL_URLS,
      '/assets/index-abc123.css',
      '/assets/index-def456.js',
    ]);
  });

  it('ignores external and out-of-scope asset urls', () => {
    expect(
      buildShellPrecacheUrls(`<!doctype html>
        <html>
          <head>
            <link rel="stylesheet" href="https://cdn.example.com/app.css" />
            <link rel="preload" href="/templates/two-buttons/preview.png" as="image" />
          </head>
          <body>
            <script type="module" src="/assets/index-def456.js"></script>
            <img src="/templates/two-buttons/base.png" alt="" />
          </body>
        </html>`),
    ).toEqual(['/', ...STATIC_PWA_SHELL_URLS, '/assets/index-def456.js']);
  });
});

describe('getShellAssetCachingStrategy', () => {
  it('uses a refresh-safe strategy for fixed-path shell assets', () => {
    expect(getShellAssetCachingStrategy('/')).toBe('network-first');
    expect(getShellAssetCachingStrategy('/manifest.webmanifest')).toBe('network-first');
    expect(getShellAssetCachingStrategy('/favicon.svg')).toBe('network-first');
    expect(getShellAssetCachingStrategy('/icons/icon-192.png')).toBe('network-first');
  });

  it('keeps hashed build assets cache-first', () => {
    expect(getShellAssetCachingStrategy('/assets/index-abc123.css')).toBe('cache-first');
    expect(getShellAssetCachingStrategy('/assets/index-def456.js')).toBe('cache-first');
  });

  it('treats template and external content as out of scope', () => {
    expect(getShellAssetCachingStrategy('/templates/two-buttons/base.png')).toBeNull();
    expect(getShellAssetCachingStrategy('https://cdn.example.com/app.css')).toBeNull();
  });
});

describe('registerShellServiceWorker', () => {
  beforeEach(() => {
    resetShellServiceWorkerStateForTests();
  });

  it('registers the shell worker at /sw.js and returns normalized state when service workers are available', async () => {
    const registration = { scope: '/' };
    const register = vi.fn().mockResolvedValue(registration);

    await expect(
      registerShellServiceWorker({
        navigator: {
          serviceWorker: {
            register,
          },
        } as unknown as Navigator,
      }),
    ).resolves.toEqual({
      registration,
      state: { updateAvailable: false },
    });

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('reports a waiting worker as an available shell update', async () => {
    const registration = { scope: '/', waiting: { state: 'installed' } };
    const register = vi.fn().mockResolvedValue(registration);

    await expect(
      registerShellServiceWorker({
        navigator: {
          serviceWorker: {
            register,
          },
        } as unknown as Navigator,
      }),
    ).resolves.toEqual({
      registration,
      state: { updateAvailable: true },
    });
  });

  it('attaches to an installing worker that already exists at registration time', async () => {
    const onStateChange = vi.fn();
    const installingWorker = createServiceWorkerStub('installing');
    const registration = createRegistrationStub({ installingWorker });
    const register = vi.fn().mockResolvedValue(registration);
    const serviceWorker = {
      controller: {} as ServiceWorker,
      register,
    };

    const registrationResult = await registerShellServiceWorker(
      {
        navigator: {
          serviceWorker,
        } as unknown as Navigator,
      },
      { onStateChange },
    );

    installingWorker.state = 'installed';
    installingWorker.dispatch('statechange');

    expect(registrationResult).toEqual({
      registration,
      state: { updateAvailable: false },
    });
    expect(onStateChange).toHaveBeenNthCalledWith(1, { updateAvailable: false });
    expect(onStateChange).toHaveBeenNthCalledWith(2, { updateAvailable: true });
  });

  it('listens for updatefound and reports a waiting update after statechange', async () => {
    const onStateChange = vi.fn();
    const registration = createRegistrationStub();
    const register = vi.fn().mockResolvedValue(registration);
    const serviceWorker = {
      controller: {} as ServiceWorker,
      register,
    };

    const registrationResult = await registerShellServiceWorker(
      {
        navigator: {
          serviceWorker,
        } as unknown as Navigator,
      },
      { onStateChange },
    );

    const installingWorker = createServiceWorkerStub('installing');
    registration.installing = installingWorker;
    registration.dispatch('updatefound');
    installingWorker.state = 'installed';
    installingWorker.dispatch('statechange');

    expect(registrationResult).toEqual({
      registration,
      state: { updateAvailable: false },
    });
    expect(onStateChange).toHaveBeenNthCalledWith(1, { updateAvailable: false });
    expect(onStateChange).toHaveBeenNthCalledWith(2, { updateAvailable: true });
  });

  it('returns null when service workers are unavailable', async () => {
    await expect(
      registerShellServiceWorker({
        navigator: {} as Navigator,
      }),
    ).resolves.toBeNull();
  });

  it('reuses the first shell registration promise instead of replacing tracked state', async () => {
    const firstRegistration = createRegistrationStub();
    const register = vi.fn().mockResolvedValue(firstRegistration);
    const win = {
      navigator: {
        serviceWorker: {
          register,
        },
      } as unknown as Navigator,
    };

    const firstPromise = registerShellServiceWorker(win);
    const secondPromise = registerShellServiceWorker(win);
    const firstResult = await firstPromise;
    const secondResult = await secondPromise;

    expect(register).toHaveBeenCalledTimes(1);
    expect(secondPromise).toBe(firstPromise);
    expect(secondResult).toEqual(firstResult);
  });
});

describe('public/sw.js smoke contract', () => {
  it('uses the shipped caching strategy helper name consistently', () => {
    const serviceWorkerSource = readFileSync('public/sw.js', 'utf8');

    expect(serviceWorkerSource).toContain('function getShellAssetCachingStrategy(pathname)');
    expect(serviceWorkerSource).not.toContain('isCacheableShellAssetPath(');
  });

  it('guards cached html shell updates behind successful network responses', () => {
    const serviceWorkerSource = readFileSync('public/sw.js', 'utf8');

    expect(serviceWorkerSource).toContain("if (response.ok) {\n      await cache.put('/', response.clone());");
  });

  it('derives the shell cache version from html content as well as shell urls', () => {
    const serviceWorkerSource = readFileSync('public/sw.js', 'utf8');

    expect(serviceWorkerSource).toContain(
      'const shellEntries = await fetchShellPrecacheEntries(shellUrls);',
    );
    expect(serviceWorkerSource).toContain(
      'const shellCacheVersion = buildShellCacheVersion(indexHtml, shellEntries);',
    );
    expect(serviceWorkerSource).toContain(
      'function buildShellCacheVersion(indexHtml, shellEntries)',
    );
    expect(serviceWorkerSource).toContain(
      'async function buildShellEntryFingerprint(url, response)',
    );
  });

  it('supports skip-waiting activation messages for refresh affordances', () => {
    const serviceWorkerSource = readFileSync('public/sw.js', 'utf8');

    expect(serviceWorkerSource).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(serviceWorkerSource).toContain('self.skipWaiting()');
  });
});

function createWindowStub(input: {
  matchMediaStandalone?: boolean;
  navigatorStandalone?: boolean;
}) {
  return {
    matchMedia: () => ({
      matches: input.matchMediaStandalone ?? false,
    }),
    navigator: {
      standalone: input.navigatorStandalone ?? false,
    },
  };
}

function createRegistrationStub(input: {
  installingWorker?: TestServiceWorker;
  waitingWorker?: { state: string } | null;
} = {}) {
  const listeners = new Map<string, Array<() => void>>();

  const registration = {
    scope: '/',
    installing: input.installingWorker ?? null,
    waiting: input.waitingWorker ?? null,
    addEventListener(eventName: string, listener: () => void) {
      const eventListeners = listeners.get(eventName) ?? [];
      eventListeners.push(listener);
      listeners.set(eventName, eventListeners);
    },
    dispatch(eventName: string) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener();
      }
    },
  };

  return registration;
}

type TestServiceWorker = {
  state: string;
  addEventListener: (eventName: string, listener: () => void) => void;
  dispatch: (eventName: string) => void;
};

function createServiceWorkerStub(initialState: string): TestServiceWorker {
  const listeners = new Map<string, Array<() => void>>();

  return {
    state: initialState,
    addEventListener(eventName: string, listener: () => void) {
      const eventListeners = listeners.get(eventName) ?? [];
      eventListeners.push(listener);
      listeners.set(eventName, eventListeners);
    },
    dispatch(eventName: string) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener();
      }
    },
  };
}

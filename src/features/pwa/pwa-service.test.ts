import { describe, expect, it } from 'vitest';
import {
  buildShellPrecacheUrls,
  detectStandaloneMode,
  getShellAssetCachingStrategy,
  getPwaScopeContract,
  registerShellServiceWorker,
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
  it('registers the shell worker at /sw.js when service workers are available', async () => {
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
    ).resolves.toBe(registration);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('returns null when service workers are unavailable', async () => {
    await expect(
      registerShellServiceWorker({
        navigator: {} as Navigator,
      }),
    ).resolves.toBeNull();
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

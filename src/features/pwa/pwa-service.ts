type StandaloneLaunchWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  navigator: Navigator & { standalone?: boolean };
};

type ServiceWorkerRegisterWindow = {
  navigator: Navigator;
};

type ServiceWorkerStateChangeListener = (state: {
  updateAvailable: boolean;
}) => void;

const PWA_SCOPE_CONTRACT = {
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
} as const;

export const STATIC_PWA_SHELL_URLS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
] as const;

const SHELL_ASSET_PATTERN = /<(?:link|script)\b[^>]+(?:href|src)=["']([^"'#?]+)["'][^>]*>/gi;
const FIXED_PATH_SHELL_URLS = new Set<string>(['/', ...STATIC_PWA_SHELL_URLS]);

export function detectStandaloneMode(input: {
  matchMediaStandalone: boolean;
  navigatorStandalone: boolean;
}) {
  return input.matchMediaStandalone || input.navigatorStandalone;
}

export function getStandaloneLaunchState(win: StandaloneLaunchWindow = window) {
  const matchMediaStandalone =
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone = win.navigator.standalone === true;

  return {
    isStandalone: detectStandaloneMode({
      matchMediaStandalone,
      navigatorStandalone,
    }),
    matchMediaStandalone,
    navigatorStandalone,
  };
}

export function getPwaScopeContract() {
  return PWA_SCOPE_CONTRACT;
}

export function normalizeServiceWorkerState(input: {
  hasRegistration: boolean;
  hasWaitingWorker: boolean;
}) {
  return {
    updateAvailable: input.hasRegistration && input.hasWaitingWorker,
  };
}

export function registerShellServiceWorker(
  win: ServiceWorkerRegisterWindow = window,
  options: {
    onStateChange?: ServiceWorkerStateChangeListener;
  } = {},
): Promise<
  | {
      registration: ServiceWorkerRegistration;
      state: ReturnType<typeof normalizeServiceWorkerState>;
    }
  | null
> {
  if (!('serviceWorker' in win.navigator)) {
    return Promise.resolve(null);
  }

  return win.navigator.serviceWorker.register('/sw.js').then((registration) => {
    const emitState = () => {
      const state = normalizeServiceWorkerState({
        hasRegistration: true,
        hasWaitingWorker: registration.waiting != null,
      });

      options.onStateChange?.(state);
      return state;
    };

    observeWaitingWorkerUpdates(win, registration, emitState);

    return {
      registration,
      state: emitState(),
    };
  });
}

export function buildShellPrecacheUrls(indexHtml: string) {
  const dynamicShellUrls = extractShellAssetUrlsFromHtml(indexHtml);
  return ['/', ...STATIC_PWA_SHELL_URLS, ...dynamicShellUrls].filter(
    (value, index, list) => list.indexOf(value) === index,
  );
}

export function getShellAssetCachingStrategy(pathname: string) {
  if (!pathname.startsWith('/')) {
    return null;
  }

  if (pathname.startsWith('/templates/')) {
    return null;
  }

  if (pathname.startsWith('/assets/')) {
    return 'cache-first' as const;
  }

  if (FIXED_PATH_SHELL_URLS.has(pathname)) {
    return 'network-first' as const;
  }

  return null;
}

function extractShellAssetUrlsFromHtml(indexHtml: string) {
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = SHELL_ASSET_PATTERN.exec(indexHtml)) !== null) {
    const assetUrl = match[1];

    if (isCacheableShellAssetUrl(assetUrl)) {
      urls.push(assetUrl);
    }
  }

  return urls;
}

function isCacheableShellAssetUrl(assetUrl: string) {
  return getShellAssetCachingStrategy(assetUrl) !== null;
}

function observeWaitingWorkerUpdates(
  win: ServiceWorkerRegisterWindow,
  registration: ServiceWorkerRegistration,
  emitState: () => ReturnType<typeof normalizeServiceWorkerState>,
) {
  if (typeof registration.addEventListener !== 'function') {
    return;
  }

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;

    if (
      !installingWorker ||
      typeof installingWorker.addEventListener !== 'function'
    ) {
      return;
    }

    installingWorker.addEventListener('statechange', () => {
      if (
        installingWorker.state === 'installed' &&
        win.navigator.serviceWorker.controller
      ) {
        emitState();
      }
    });
  });
}

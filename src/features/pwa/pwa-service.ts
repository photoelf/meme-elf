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

type ShellServiceWorkerState = ReturnType<typeof normalizeServiceWorkerState>;

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
const DEFAULT_SHELL_SERVICE_WORKER_STATE = Object.freeze({
  updateAvailable: false,
});
const shellServiceWorkerStateListeners = new Set<ServiceWorkerStateChangeListener>();
let shellServiceWorkerState: ShellServiceWorkerState = DEFAULT_SHELL_SERVICE_WORKER_STATE;
let activeShellServiceWorkerRegistration: ServiceWorkerRegistration | null = null;
let shellServiceWorkerRegistrationPromise: Promise<
  | {
      registration: ServiceWorkerRegistration;
      state: ReturnType<typeof normalizeServiceWorkerState>;
    }
  | null
> | null = null;

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

  if (shellServiceWorkerRegistrationPromise) {
    return shellServiceWorkerRegistrationPromise;
  }

  shellServiceWorkerRegistrationPromise = win.navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      activeShellServiceWorkerRegistration = registration;
      const observedInstallingWorkers = new WeakSet<ServiceWorker>();
      const emitState = (installingWorker?: ServiceWorker | null) => {
        const state = getNormalizedRegistrationState(
          win,
          registration,
          installingWorker,
        );

        publishShellServiceWorkerState(state, registration);
        options.onStateChange?.(state);
        return state;
      };

      observeWaitingWorkerUpdates(
        win,
        registration,
        emitState,
        observedInstallingWorkers,
      );

      return {
        registration,
        state: emitState(registration.installing),
      };
    })
    .catch((error) => {
      shellServiceWorkerRegistrationPromise = null;
      throw error;
    });

  return shellServiceWorkerRegistrationPromise;
}

export function getShellServiceWorkerState() {
  return shellServiceWorkerState;
}

export function subscribeShellServiceWorkerState(
  listener: ServiceWorkerStateChangeListener,
) {
  shellServiceWorkerStateListeners.add(listener);
  listener(shellServiceWorkerState);

  return () => {
    shellServiceWorkerStateListeners.delete(listener);
  };
}

export function applyWaitingShellServiceWorkerUpdate() {
  const waitingWorker = resolveWaitingShellWorker(activeShellServiceWorkerRegistration);

  if (!waitingWorker || typeof waitingWorker.postMessage !== 'function') {
    return false;
  }

  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export function resetShellServiceWorkerStateForTests() {
  shellServiceWorkerStateListeners.clear();
  shellServiceWorkerState = DEFAULT_SHELL_SERVICE_WORKER_STATE;
  activeShellServiceWorkerRegistration = null;
  shellServiceWorkerRegistrationPromise = null;
}

export function setShellServiceWorkerStateForTests(input: {
  registration?: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}) {
  publishShellServiceWorkerState(
    {
      updateAvailable: input.updateAvailable,
    },
    input.registration ?? null,
  );
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
  emitState: (
    installingWorker?: ServiceWorker | null,
  ) => ReturnType<typeof normalizeServiceWorkerState>,
  observedInstallingWorkers: WeakSet<ServiceWorker>,
) {
  attachInstallingWorkerListener(
    win,
    registration.installing,
    emitState,
    observedInstallingWorkers,
  );

  if (typeof registration.addEventListener !== 'function') {
    return;
  }

  registration.addEventListener('updatefound', () => {
    attachInstallingWorkerListener(
      win,
      registration.installing,
      emitState,
      observedInstallingWorkers,
    );
  });
}

function attachInstallingWorkerListener(
  win: ServiceWorkerRegisterWindow,
  installingWorker: ServiceWorker | null,
  emitState: (
    installingWorker?: ServiceWorker | null,
  ) => ReturnType<typeof normalizeServiceWorkerState>,
  observedInstallingWorkers: WeakSet<ServiceWorker>,
) {
  if (!installingWorker || typeof installingWorker.addEventListener !== 'function') {
    return;
  }

  if (observedInstallingWorkers.has(installingWorker)) {
    return;
  }

  observedInstallingWorkers.add(installingWorker);

  installingWorker.addEventListener('statechange', () => {
    if (
      installingWorker.state === 'installed' &&
      win.navigator.serviceWorker.controller
    ) {
      emitState(installingWorker);
    }
  });
}

function getNormalizedRegistrationState(
  win: ServiceWorkerRegisterWindow,
  registration: ServiceWorkerRegistration,
  installingWorker?: ServiceWorker | null,
) {
  const waitingWorkerAvailable =
    registration.waiting != null ||
    (installingWorker?.state === 'installed' &&
      win.navigator.serviceWorker.controller != null);

  return normalizeServiceWorkerState({
    hasRegistration: true,
    hasWaitingWorker: waitingWorkerAvailable,
  });
}

function publishShellServiceWorkerState(
  state: ShellServiceWorkerState,
  registration: ServiceWorkerRegistration | null,
) {
  shellServiceWorkerState = state;
  activeShellServiceWorkerRegistration = registration;

  for (const listener of shellServiceWorkerStateListeners) {
    listener(state);
  }
}

function resolveWaitingShellWorker(
  registration: ServiceWorkerRegistration | null,
) {
  if (!registration) {
    return null;
  }

  if (registration.waiting) {
    return registration.waiting;
  }

  if (registration.installing?.state === 'installed') {
    return registration.installing;
  }

  return null;
}

/*
 * Scope contract:
 * - Cache only the shipped app shell after a successful online load.
 * - Keep HTML network-first and fall back to cached shell for offline reopen.
 * - Keep fixed-path shell URLs refresh-safe so deploys can replace same-URL shell assets.
 * - Keep hashed /assets/* bundles cache-first because their URLs already version the content.
 * - Do not cache direct URL imports, remote image fetches, template content, or user edits as guaranteed offline storage.
 */
const SHELL_CACHE_PREFIX = 'meme-elf-shell-';
const SHELL_CACHE_META_NAME = 'meme-elf-shell-meta';
const ACTIVE_SHELL_CACHE_KEY = '/active-cache-name';
const STATIC_SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const SHELL_ASSET_PATTERN = /<(?:link|script)\b[^>]+(?:href|src)=["']([^"'#?]+)["'][^>]*>/gi;
const FIXED_PATH_SHELL_URLS = new Set(STATIC_SHELL_URLS);
let pendingShellCacheName = null;

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(activateShellCache());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleHtmlNavigation(request));
    return;
  }

  const strategy = getShellAssetCachingStrategy(requestUrl.pathname);

  if (strategy === 'network-first') {
    event.respondWith(handleNetworkFirstShellRequest(request));
    return;
  }

  if (strategy === 'cache-first') {
    event.respondWith(handleCacheFirstShellAssetRequest(request));
  }
});

async function precacheShell() {
  const htmlResponse = await fetch('/', { cache: 'no-store' });

  if (!htmlResponse.ok) {
    throw new Error(`Failed to fetch app shell: ${htmlResponse.status}`);
  }

  const htmlResponseClone = htmlResponse.clone();
  const indexHtml = await htmlResponse.text();
  const shellUrls = buildShellPrecacheUrls(indexHtml);
  const shellEntries = await fetchShellPrecacheEntries(shellUrls);
  const shellCacheVersion = buildShellCacheVersion(indexHtml, shellEntries);
  const shellCacheName = buildShellCacheName(shellCacheVersion);
  const cache = await caches.open(shellCacheName);
  pendingShellCacheName = shellCacheName;
  await cache.put('/', htmlResponseClone);
  await Promise.all(
    shellEntries.map(({ url, response }) => cache.put(url, response)),
  );
}

async function activateShellCache() {
  const activeShellCacheName =
    pendingShellCacheName ?? (await getNewestVersionedShellCacheName());

  if (!activeShellCacheName) {
    return;
  }

  const metaCache = await caches.open(SHELL_CACHE_META_NAME);
  await metaCache.put(ACTIVE_SHELL_CACHE_KEY, new Response(activeShellCacheName));
  await clearOldShellCaches(activeShellCacheName);
}

async function clearOldShellCaches(activeShellCacheName) {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName.startsWith(SHELL_CACHE_PREFIX) &&
          cacheName !== SHELL_CACHE_META_NAME &&
          cacheName !== activeShellCacheName,
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
}

async function handleHtmlNavigation(request) {
  const cache = await openActiveShellCache();

  try {
    const response = await fetch(request, { cache: 'no-store' });

    if (response.ok) {
      await cache.put('/', response.clone());
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match('/');

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function handleNetworkFirstShellRequest(request) {
  const cache = await openActiveShellCache();

  try {
    const response = await fetch(request, { cache: 'no-store' });

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function handleCacheFirstShellAssetRequest(request) {
  const cache = await openActiveShellCache();
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request, { cache: 'no-store' });

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

function buildShellPrecacheUrls(indexHtml) {
  const shellUrls = new Set(STATIC_SHELL_URLS);
  let match;

  while ((match = SHELL_ASSET_PATTERN.exec(indexHtml)) !== null) {
    const assetUrl = match[1];

    if (getShellAssetCachingStrategy(assetUrl) !== null) {
      shellUrls.add(assetUrl);
    }
  }

  return Array.from(shellUrls);
}

async function fetchShellPrecacheEntries(shellUrls) {
  return Promise.all(
    shellUrls
      .filter((shellUrl) => shellUrl !== '/')
      .map(async (url) => {
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Failed to fetch shell asset: ${url} (${response.status})`);
        }

        return {
          url,
          response,
          fingerprint: await buildShellEntryFingerprint(url, response.clone()),
        };
      }),
  );
}

async function buildShellEntryFingerprint(url, response) {
  if (getShellAssetCachingStrategy(url) === 'cache-first') {
    return url;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return `${bytes.length}:${hashBytes(bytes)}`;
}

function buildShellCacheVersion(indexHtml, shellEntries) {
  return hashString(
    [
      `html:${hashString(indexHtml)}`,
      ...shellEntries
        .slice()
        .sort((left, right) => left.url.localeCompare(right.url))
        .map(({ url, fingerprint }) => `${url}:${fingerprint}`),
    ].join('\n'),
  );
}

function buildShellCacheName(shellCacheVersion) {
  return `${SHELL_CACHE_PREFIX}${shellCacheVersion}`;
}

function hashString(versionSource) {
  let hash = 0;

  for (let index = 0; index < versionSource.length; index += 1) {
    hash = (hash * 31 + versionSource.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

function hashBytes(bytes) {
  let hash = 0;

  for (const byte of bytes) {
    hash = (hash * 31 + byte) >>> 0;
  }

  return hash.toString(16);
}

function getShellAssetCachingStrategy(pathname) {
  if (!pathname.startsWith('/')) {
    return null;
  }

  if (pathname.startsWith('/templates/')) {
    return null;
  }

  if (pathname.startsWith('/assets/')) {
    return 'cache-first';
  }

  if (FIXED_PATH_SHELL_URLS.has(pathname)) {
    return 'network-first';
  }

  return null;
}

async function openActiveShellCache() {
  const activeShellCacheName = await getActiveShellCacheName();
  return caches.open(activeShellCacheName);
}

async function getActiveShellCacheName() {
  if (pendingShellCacheName) {
    return pendingShellCacheName;
  }

  const metaCache = await caches.open(SHELL_CACHE_META_NAME);
  const cachedActiveShellCache = await metaCache.match(ACTIVE_SHELL_CACHE_KEY);

  if (cachedActiveShellCache) {
    return cachedActiveShellCache.text();
  }

  return getNewestVersionedShellCacheName();
}

async function getNewestVersionedShellCacheName() {
  const cacheNames = await caches.keys();
  const shellCacheNames = cacheNames
    .filter(
      (cacheName) =>
        cacheName.startsWith(SHELL_CACHE_PREFIX) &&
        cacheName !== SHELL_CACHE_META_NAME,
    )
    .sort();

  return shellCacheNames.at(-1) ?? `${SHELL_CACHE_PREFIX}bootstrap`;
}

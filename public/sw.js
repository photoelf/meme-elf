/*
 * Scope contract:
 * - Cache only the shipped app shell after a successful online load.
 * - Keep HTML network-first and fall back to cached shell for offline reopen.
 * - Do not cache direct URL imports, remote image fetches, template content, or user edits as guaranteed offline storage.
 */
const SHELL_CACHE_NAME = 'meme-elf-shell-v1';
const STATIC_SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const SHELL_ASSET_PATTERN = /<(?:link|script)\b[^>]+(?:href|src)=["']([^"'#?]+)["'][^>]*>/gi;

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clearOldShellCaches());
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

  if (isCacheableShellAssetPath(requestUrl.pathname)) {
    event.respondWith(handleShellAssetRequest(request));
  }
});

async function precacheShell() {
  const htmlResponse = await fetch('/', { cache: 'no-store' });

  if (!htmlResponse.ok) {
    throw new Error(`Failed to fetch app shell: ${htmlResponse.status}`);
  }

  const indexHtml = await htmlResponse.text();
  const cache = await caches.open(SHELL_CACHE_NAME);
  const shellUrls = buildShellPrecacheUrls(indexHtml);
  await cache.addAll(shellUrls);
}

async function clearOldShellCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('meme-elf-shell-') && cacheName !== SHELL_CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName)),
  );
}

async function handleHtmlNavigation(request) {
  const cache = await caches.open(SHELL_CACHE_NAME);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    await cache.put('/', response.clone());
    return response;
  } catch (error) {
    const cachedResponse = await cache.match('/');

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function handleShellAssetRequest(request) {
  const cache = await caches.open(SHELL_CACHE_NAME);
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

    if (isCacheableShellAssetPath(assetUrl)) {
      shellUrls.add(assetUrl);
    }
  }

  return Array.from(shellUrls);
}

function isCacheableShellAssetPath(pathname) {
  if (!pathname.startsWith('/')) {
    return false;
  }

  if (pathname.startsWith('/templates/')) {
    return false;
  }

  return (
    pathname === '/' ||
    pathname.startsWith('/assets/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/favicon.svg' ||
    pathname.startsWith('/icons/')
  );
}

const CACHE_NAME_PREFIX = "hugecode-web-pwa-";
const CACHE_VERSION = new URL(self.location.href).searchParams.get("app")?.trim() || "dev";
const CACHE_PREFIX = `${CACHE_NAME_PREFIX}${CACHE_VERSION}`;
const SHELL_CACHE = `${CACHE_PREFIX}-shell`;
const PAGE_CACHE = `${CACHE_PREFIX}-pages`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE]);
const OFFLINE_PATH = "/offline";
const WARM_DOCUMENT_PATHS = ["/", "/about", "/app", OFFLINE_PATH];
const STATIC_ASSET_PATHS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/app-icon.png",
  "/apple-touch-icon.png",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/icon-512-maskable.png",
  "/pwa/screenshot-desktop.png",
  "/pwa/screenshot-mobile.png",
];
const HTML_ASSET_PATTERN = /(?:href|src)="(\/(?:assets|pwa)\/[^"]+)"/g;
const RUNTIME_PATH_PATTERN = /\/(?:rpc|ws)$/;
const CACHEABLE_DESTINATIONS = new Set(["font", "image", "manifest", "script", "style", "worker"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      await Promise.allSettled([warmStaticShell(), warmDocumentRoutes()]);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter(
            (cacheName) => cacheName.startsWith(CACHE_NAME_PREFIX) && !ACTIVE_CACHES.has(cacheName)
          )
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!isSameOrigin(url) || isRuntimeGatewayPath(url.pathname)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request, url));
    return;
  }

  if (shouldHandleStaticAssetRequest(request, url)) {
    event.respondWith(handleAssetRequest(request));
  }
});

async function warmStaticShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(
    STATIC_ASSET_PATHS.map(async (path) => {
      const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (response.ok) {
        await cache.put(path, response.clone());
      }
    })
  );
}

async function warmDocumentRoutes() {
  const pageCache = await caches.open(PAGE_CACHE);
  const assetCache = await caches.open(ASSET_CACHE);

  await Promise.allSettled(
    WARM_DOCUMENT_PATHS.map(async (path) => {
      const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        return;
      }

      const html = await response.text();
      await pageCache.put(path, new Response(html, cloneResponseInit(response)));

      const assetPaths = new Set();
      const matches = html.matchAll(HTML_ASSET_PATTERN);
      for (const match of matches) {
        if (match[1]) {
          assetPaths.add(match[1]);
        }
      }

      await Promise.allSettled(
        [...assetPaths].map(async (assetPath) => {
          const assetResponse = await fetch(assetPath, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (assetResponse.ok) {
            await assetCache.put(assetPath, assetResponse.clone());
          }
        })
      );
    })
  );
}

async function handleNavigationRequest(request, url) {
  const pageCache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await pageCache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await pageCache.match(url.pathname);
    if (cachedResponse) {
      return cachedResponse;
    }

    const offlineResponse = await pageCache.match(OFFLINE_PATH);
    if (offlineResponse) {
      return offlineResponse;
    }

    return (await caches.match(OFFLINE_PATH)) || Response.error();
  }
}

async function handleAssetRequest(request) {
  const assetCache = await caches.open(ASSET_CACHE);
  const cacheKey = new URL(request.url).pathname;
  const cached = await assetCache.match(cacheKey);
  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await assetCache.put(cacheKey, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkFetch;
    return cached;
  }

  const networkResponse = await networkFetch;
  if (networkResponse) {
    return networkResponse;
  }

  return (await caches.match(cacheKey)) || Response.error();
}

function shouldHandleStaticAssetRequest(request, url) {
  return (
    request.mode !== "navigate" &&
    (CACHEABLE_DESTINATIONS.has(request.destination) ||
      url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/pwa/") ||
      STATIC_ASSET_PATHS.includes(url.pathname))
  );
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isRuntimeGatewayPath(pathname) {
  return RUNTIME_PATH_PATTERN.test(pathname);
}

function cloneResponseInit(response) {
  return {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  };
}

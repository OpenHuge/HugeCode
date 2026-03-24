export const CODE_WEB_PWA_CACHE_PREFIX = "hugecode-web-pwa-v1";
export const CODE_WEB_MANIFEST_PATH = "/manifest.webmanifest";
export const CODE_WEB_APP_START_URL = "/app?source=pwa";
export const CODE_WEB_OFFLINE_PATH = "/offline";
export const CODE_WEB_WARM_NAVIGATION_PATHS = ["/", "/about", "/app", CODE_WEB_OFFLINE_PATH];
export const CODE_WEB_PWA_ASSET_PATHS = {
  appIcon: "/app-icon.png",
  appleTouchIcon: "/apple-touch-icon.png",
  favicon: "/favicon.svg",
  icon192: "/pwa/icon-192.png",
  icon512: "/pwa/icon-512.png",
  icon512Maskable: "/pwa/icon-512-maskable.png",
  screenshotDesktop: "/pwa/screenshot-desktop.png",
  screenshotMobile: "/pwa/screenshot-mobile.png",
} as const;

const CACHEABLE_DESTINATIONS = new Set(["font", "image", "manifest", "script", "style", "worker"]);

export const codeWebPwaManifest = {
  id: "/app",
  name: "HugeCode",
  short_name: "HugeCode",
  description:
    "Install HugeCode Web to launch directly into the browser workspace while keeping public routes available offline.",
  scope: "/",
  start_url: CODE_WEB_APP_START_URL,
  display: "standalone",
  display_override: ["window-controls-overlay", "standalone", "browser"],
  launch_handler: {
    client_mode: "focus-existing",
  },
  theme_color: "#0d1117",
  background_color: "#0d1117",
  categories: ["productivity", "utilities", "developer tools"],
  lang: "en-US",
  icons: [
    {
      src: CODE_WEB_PWA_ASSET_PATHS.icon192,
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: CODE_WEB_PWA_ASSET_PATHS.icon512,
      sizes: "512x512",
      type: "image/png",
    },
    {
      src: CODE_WEB_PWA_ASSET_PATHS.icon512Maskable,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  shortcuts: [
    {
      name: "Open Workspace",
      short_name: "Workspace",
      description: "Launch the HugeCode workspace shell",
      url: "/app",
      icons: [
        {
          src: CODE_WEB_PWA_ASSET_PATHS.icon192,
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    {
      name: "Overview",
      short_name: "Overview",
      description: "Open the HugeCode web overview",
      url: "/",
      icons: [
        {
          src: CODE_WEB_PWA_ASSET_PATHS.icon192,
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    {
      name: "About",
      short_name: "About",
      description: "Inspect HugeCode platform details",
      url: "/about",
      icons: [
        {
          src: CODE_WEB_PWA_ASSET_PATHS.icon192,
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
  ],
  screenshots: [
    {
      src: CODE_WEB_PWA_ASSET_PATHS.screenshotDesktop,
      sizes: "1440x1024",
      type: "image/png",
      form_factor: "wide",
      label: "HugeCode desktop workspace shell",
    },
    {
      src: CODE_WEB_PWA_ASSET_PATHS.screenshotMobile,
      sizes: "1080x1920",
      type: "image/png",
      form_factor: "narrow",
      label: "HugeCode mobile install surface",
    },
  ],
} as const;

export function isRuntimeGatewayPathname(pathname: string): boolean {
  return (
    pathname === "/rpc" ||
    pathname.endsWith("/rpc") ||
    pathname === "/ws" ||
    pathname.endsWith("/ws")
  );
}

export function shouldHandleCodeWebNavigationRequest(
  url: URL,
  request: Pick<Request, "mode">
): boolean {
  return (
    url.origin === globalThis.location.origin &&
    request.mode === "navigate" &&
    !isRuntimeGatewayPathname(url.pathname)
  );
}

export function shouldHandleCodeWebStaticAssetRequest(
  url: URL,
  request: Pick<Request, "destination" | "mode">
): boolean {
  if (url.origin !== globalThis.location.origin || request.mode === "navigate") {
    return false;
  }

  if (isRuntimeGatewayPathname(url.pathname)) {
    return false;
  }

  return (
    CACHEABLE_DESTINATIONS.has(request.destination) ||
    url.pathname === CODE_WEB_MANIFEST_PATH ||
    url.pathname === CODE_WEB_PWA_ASSET_PATHS.favicon ||
    url.pathname === CODE_WEB_PWA_ASSET_PATHS.appIcon ||
    url.pathname === CODE_WEB_PWA_ASSET_PATHS.appleTouchIcon ||
    url.pathname.startsWith("/pwa/")
  );
}

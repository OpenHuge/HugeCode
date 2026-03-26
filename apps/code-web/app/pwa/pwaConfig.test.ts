// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CODE_WEB_APP_START_URL,
  CODE_WEB_MANIFEST_PATH,
  CODE_WEB_PWA_ASSET_PATHS,
  codeWebPwaManifest,
  shouldHandleCodeWebNavigationRequest,
  shouldHandleCodeWebStaticAssetRequest,
} from "./pwaConfig";

describe("codeWebPwaManifest", () => {
  it("targets a single-site PWA that launches into the workspace", () => {
    expect(codeWebPwaManifest.id).toBe("/app");
    expect(codeWebPwaManifest.scope).toBe("/");
    expect(codeWebPwaManifest.start_url).toBe(CODE_WEB_APP_START_URL);
    expect(codeWebPwaManifest.display).toBe("standalone");
    expect(codeWebPwaManifest.display_override).toEqual([
      "window-controls-overlay",
      "standalone",
      "browser",
    ]);
    expect(codeWebPwaManifest.launch_handler).toEqual({
      client_mode: "focus-existing",
    });
  });

  it("declares installability assets, shortcuts, and screenshots", () => {
    expect(codeWebPwaManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: CODE_WEB_PWA_ASSET_PATHS.icon192, sizes: "192x192" }),
        expect.objectContaining({ src: CODE_WEB_PWA_ASSET_PATHS.icon512, sizes: "512x512" }),
        expect.objectContaining({
          src: CODE_WEB_PWA_ASSET_PATHS.icon512Maskable,
          purpose: "maskable",
        }),
      ])
    );
    expect(codeWebPwaManifest.shortcuts).toHaveLength(3);
    expect(codeWebPwaManifest.screenshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: CODE_WEB_PWA_ASSET_PATHS.screenshotDesktop }),
        expect.objectContaining({ src: CODE_WEB_PWA_ASSET_PATHS.screenshotMobile }),
      ])
    );
  });

  it("stays aligned with the checked-in public manifest", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.webmanifest");
    const publicManifest = JSON.parse(
      readFileSync(manifestPath, "utf8")
    ) as typeof codeWebPwaManifest;

    expect(publicManifest).toEqual(codeWebPwaManifest);
  });
});

describe("PWA caching request guards", () => {
  it("caches same-origin navigations except runtime gateway endpoints", () => {
    const localOrigin = window.location.origin;

    expect(
      shouldHandleCodeWebNavigationRequest(new URL("/app", localOrigin), {
        mode: "navigate",
      })
    ).toBe(true);
    expect(
      shouldHandleCodeWebNavigationRequest(new URL("/rpc", localOrigin), {
        mode: "navigate",
      })
    ).toBe(false);
    expect(
      shouldHandleCodeWebNavigationRequest(new URL("https://runtime.example.com/app"), {
        mode: "navigate",
      })
    ).toBe(false);
  });

  it("caches same-origin static assets and manifest files but skips runtime traffic", () => {
    const localOrigin = window.location.origin;

    expect(
      shouldHandleCodeWebStaticAssetRequest(new URL(CODE_WEB_MANIFEST_PATH, localOrigin), {
        destination: "manifest",
        mode: "cors",
      })
    ).toBe(true);
    expect(
      shouldHandleCodeWebStaticAssetRequest(
        new URL(CODE_WEB_PWA_ASSET_PATHS.icon512Maskable, localOrigin),
        {
          destination: "image",
          mode: "no-cors",
        }
      )
    ).toBe(true);
    expect(
      shouldHandleCodeWebStaticAssetRequest(new URL("/rpc", localOrigin), {
        destination: "",
        mode: "cors",
      })
    ).toBe(false);
  });
});

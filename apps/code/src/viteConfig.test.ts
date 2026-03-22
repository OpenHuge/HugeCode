// @vitest-environment node
import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

describe("apps/code vite config", () => {
  it("pins startup dependency prebundle entries to third-party runtime deps", () => {
    expect(viteConfig.optimizeDeps?.include).toEqual(
      expect.arrayContaining([
        "lucide-react",
        "lucide-react/dist/esm/icons/*",
        "react",
        "react-dom",
        "react/jsx-dev-runtime",
        "react/jsx-runtime",
        "react-markdown",
        "remark-gfm",
      ])
    );
  });

  it("does not prebundle linked workspace source packages", () => {
    expect(viteConfig.optimizeDeps?.include).not.toEqual(
      expect.arrayContaining([
        "@ku0/canvas",
        "@ku0/design-system",
        "@ku0/shared",
        "@ku0/sidebar",
        "@ku0/ui",
      ])
    );
  });

  it("warms the primary app startup chain for dev", () => {
    expect(viteConfig.server?.warmup?.clientFiles).toEqual(
      expect.arrayContaining([
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/web/WorkspaceClientEntry.tsx",
        "./src/features/app/components/AppModals.tsx",
        "./src/features/composer/components/ComposerInput.tsx",
        "./src/features/files/components/FileTreePanel.tsx",
        "./src/features/settings/components/settingsViewLoader.ts",
        "./src/features/settings/components/SettingsView.tsx",
        "./src/features/settings/components/SettingsViewCore.tsx",
      ])
    );
  });
});

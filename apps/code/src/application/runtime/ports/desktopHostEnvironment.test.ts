import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetDesktopHostEnvironmentForTests,
  __setDesktopHostEnvironmentLoaderForTests,
  detectDesktopHostRuntime,
  readDesktopAppVersion,
  readDesktopWindowLabel,
} from "./desktopHostEnvironment";

describe("runtimeEnvironment", () => {
  beforeEach(() => {
    __resetDesktopHostEnvironmentForTests();
  });

  it("falls back when the desktop host module loader fails", async () => {
    __setDesktopHostEnvironmentLoaderForTests(async () => {
      throw new Error("module unavailable");
    });

    await expect(detectDesktopHostRuntime()).resolves.toBe(false);
    await expect(readDesktopAppVersion()).resolves.toBeNull();
    await expect(readDesktopWindowLabel()).resolves.toBeNull();
  });

  it("uses the loaded desktop host modules when they are available", async () => {
    __setDesktopHostEnvironmentLoaderForTests(async () => ({
      app: {
        getVersion: async () => "9.9.9",
      },
      core: {
        isDesktopHostRuntime: () => true,
      },
      window: {
        getCurrentWindow: () => ({
          label: "about",
        }),
      },
    }));

    await expect(detectDesktopHostRuntime()).resolves.toBe(true);
    await expect(readDesktopAppVersion()).resolves.toBe("9.9.9");
    await expect(readDesktopWindowLabel()).resolves.toBe("about");
  });
});

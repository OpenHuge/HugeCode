import { describe, expect, it } from "vitest";
import {
  getDesktopArchitectureTag,
  getDesktopPlatformArchitectureTag,
  getDesktopPlatformTag,
  isAbsolutePath,
  isMobilePlatform,
  joinWorkspacePath,
  normalizePathForDisplay,
} from "./platformPaths";

const globalScope = globalThis as typeof globalThis & { navigator?: Navigator };

function withNavigatorValues(
  values: Partial<
    Pick<Navigator, "platform" | "userAgent" | "maxTouchPoints"> & {
      userAgentData: { platform?: string; architecture?: string; bitness?: string };
    }
  >,
  run: () => void
) {
  const hadNavigator = typeof globalScope.navigator !== "undefined";
  if (!hadNavigator) {
    Object.defineProperty(globalScope, "navigator", {
      configurable: true,
      writable: true,
      value: {},
    });
  }

  const activeNavigator = globalScope.navigator as Navigator;
  const navigatorWithUaData = activeNavigator as Navigator & {
    userAgentData?: { platform?: string; architecture?: string; bitness?: string };
  };
  const originalPlatform = Object.getOwnPropertyDescriptor(activeNavigator, "platform");
  const originalUserAgent = Object.getOwnPropertyDescriptor(activeNavigator, "userAgent");
  const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(activeNavigator, "maxTouchPoints");
  const originalUserAgentData = Object.getOwnPropertyDescriptor(activeNavigator, "userAgentData");
  Object.defineProperty(activeNavigator, "platform", {
    configurable: true,
    value: values.platform ?? activeNavigator.platform ?? "",
  });
  Object.defineProperty(activeNavigator, "userAgent", {
    configurable: true,
    value: values.userAgent ?? activeNavigator.userAgent ?? "",
  });
  Object.defineProperty(activeNavigator, "maxTouchPoints", {
    configurable: true,
    value: values.maxTouchPoints ?? activeNavigator.maxTouchPoints ?? 0,
  });
  Object.defineProperty(activeNavigator, "userAgentData", {
    configurable: true,
    value: values.userAgentData ?? navigatorWithUaData.userAgentData ?? undefined,
  });
  try {
    run();
  } finally {
    if (originalPlatform) {
      Object.defineProperty(activeNavigator, "platform", originalPlatform);
    } else {
      delete (activeNavigator as { platform?: string }).platform;
    }
    if (originalUserAgent) {
      Object.defineProperty(activeNavigator, "userAgent", originalUserAgent);
    } else {
      delete (activeNavigator as { userAgent?: string }).userAgent;
    }
    if (originalMaxTouchPoints) {
      Object.defineProperty(activeNavigator, "maxTouchPoints", originalMaxTouchPoints);
    } else {
      delete (activeNavigator as { maxTouchPoints?: number }).maxTouchPoints;
    }
    if (originalUserAgentData) {
      Object.defineProperty(activeNavigator, "userAgentData", originalUserAgentData);
    } else {
      delete (activeNavigator as { userAgentData?: unknown }).userAgentData;
    }
    if (!hadNavigator) {
      Reflect.deleteProperty(globalScope, "navigator");
    }
  }
}

describe("isMobilePlatform", () => {
  it("returns true for iPhone-like user agents", () => {
    withNavigatorValues(
      {
        platform: "iPhone",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      },
      () => {
        expect(isMobilePlatform()).toBe(true);
      }
    );
  });

  it("returns false for desktop platforms", () => {
    withNavigatorValues(
      {
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_0) AppleWebKit/537.36",
      },
      () => {
        expect(isMobilePlatform()).toBe(false);
      }
    );
  });

  it("returns true for iPad desktop user agents with touch support", () => {
    withNavigatorValues(
      {
        platform: "MacIntel",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        maxTouchPoints: 5,
      },
      () => {
        expect(isMobilePlatform()).toBe(true);
      }
    );
  });
});

describe("desktop telemetry tags", () => {
  it("detects macOS Intel as macos-x64", () => {
    withNavigatorValues(
      {
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_0) AppleWebKit/537.36",
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("macos");
        expect(getDesktopArchitectureTag()).toBe("x64");
        expect(getDesktopPlatformArchitectureTag()).toBe("macos-x64");
      }
    );
  });

  it("prefers userAgentData architecture when available", () => {
    withNavigatorValues(
      {
        platform: "Win32",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        userAgentData: {
          platform: "Windows",
          architecture: "arm64",
        },
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("windows");
        expect(getDesktopArchitectureTag()).toBe("arm64");
        expect(getDesktopPlatformArchitectureTag()).toBe("windows-arm64");
      }
    );
  });

  it("maps userAgentData x86 + bitness 64 to x64", () => {
    withNavigatorValues(
      {
        platform: "Win32",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        userAgentData: {
          platform: "Windows",
          architecture: "x86",
          bitness: "64",
        },
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("windows");
        expect(getDesktopArchitectureTag()).toBe("x64");
        expect(getDesktopPlatformArchitectureTag()).toBe("windows-x64");
      }
    );
  });

  it("maps userAgentData arm + bitness 64 to arm64", () => {
    withNavigatorValues(
      {
        platform: "Linux armv8",
        userAgent: "Mozilla/5.0 (X11; Linux armv8) AppleWebKit/537.36",
        userAgentData: {
          platform: "Linux",
          architecture: "arm",
          bitness: "64",
        },
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("linux");
        expect(getDesktopArchitectureTag()).toBe("arm64");
        expect(getDesktopPlatformArchitectureTag()).toBe("linux-arm64");
      }
    );
  });

  it("detects linux x64 from userAgent token", () => {
    withNavigatorValues(
      {
        platform: "Linux x86_64",
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("linux");
        expect(getDesktopArchitectureTag()).toBe("x64");
        expect(getDesktopPlatformArchitectureTag()).toBe("linux-x64");
      }
    );
  });

  it("detects linux arm64 from aarch64 token", () => {
    withNavigatorValues(
      {
        platform: "Linux aarch64",
        userAgent: "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36",
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("linux");
        expect(getDesktopArchitectureTag()).toBe("arm64");
        expect(getDesktopPlatformArchitectureTag()).toBe("linux-arm64");
      }
    );
  });

  it("detects windows x86 from i686 token", () => {
    withNavigatorValues(
      {
        platform: "Win32",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; i686) AppleWebKit/537.36",
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("windows");
        expect(getDesktopArchitectureTag()).toBe("x86");
        expect(getDesktopPlatformArchitectureTag()).toBe("windows-x86");
      }
    );
  });

  it("prefers explicit userAgent x64 tokens over coarse Win32 platform label", () => {
    withNavigatorValues(
      {
        platform: "Win32",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("windows");
        expect(getDesktopArchitectureTag()).toBe("x64");
        expect(getDesktopPlatformArchitectureTag()).toBe("windows-x64");
      }
    );
  });

  it("prefers explicit userAgent arm64 tokens over coarse Win32 platform label", () => {
    withNavigatorValues(
      {
        platform: "Win32",
        userAgent: "Mozilla/5.0 (Windows NT 11.0; ARM64) AppleWebKit/537.36",
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("windows");
        expect(getDesktopArchitectureTag()).toBe("arm64");
        expect(getDesktopPlatformArchitectureTag()).toBe("windows-arm64");
      }
    );
  });

  it("falls back to unknown tags when platform and architecture are not detectable", () => {
    withNavigatorValues(
      {
        platform: "",
        userAgent: "",
        maxTouchPoints: 0,
      },
      () => {
        expect(getDesktopPlatformTag()).toBe("unknown");
        expect(getDesktopArchitectureTag()).toBe("unknown");
        expect(getDesktopPlatformArchitectureTag()).toBe("unknown-unknown");
      }
    );
  });
});

describe("path helpers", () => {
  it("treats Unix and Windows roots as absolute", () => {
    expect(isAbsolutePath("/Users/dev/project")).toBe(true);
    expect(isAbsolutePath("C:\\Users\\dev\\project")).toBe(true);
    expect(isAbsolutePath("\\\\server\\share\\project")).toBe(true);
    expect(isAbsolutePath("relative/path")).toBe(false);
  });

  it("normalizes windows base separators when joining relative paths", () => {
    const joined = joinWorkspacePath("C:/Users/dev/workspace", "src/main.ts");
    expect(joined).toBe("C:\\Users\\dev\\workspace\\src\\main.ts");
  });

  it("joins UNC windows paths without mixed separators", () => {
    const joined = joinWorkspacePath("//server/share/workspace", "folder/file.ts");
    expect(joined).toBe("\\\\server\\share\\workspace\\folder\\file.ts");
  });

  it("returns absolute input path unchanged when joining", () => {
    const absolute = "D:\\other\\file.txt";
    expect(joinWorkspacePath("C:\\Users\\dev\\workspace", absolute)).toBe(absolute);
  });

  it("strips Windows extended-length prefixes for display", () => {
    expect(normalizePathForDisplay("\\\\?\\C:\\Dev\\keep-up")).toBe("C:\\Dev\\keep-up");
    expect(normalizePathForDisplay("\\?\\C:\\Dev\\keep-up")).toBe("C:\\Dev\\keep-up");
    expect(normalizePathForDisplay("\\\\?\\UNC\\server\\share\\keep-up")).toBe(
      "\\\\server\\share\\keep-up"
    );
    expect(normalizePathForDisplay("\\?\\UNC\\server\\share\\keep-up")).toBe(
      "\\\\server\\share\\keep-up"
    );
  });
});

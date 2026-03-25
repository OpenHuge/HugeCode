import { describe, expect, it, vi } from "vitest";
import {
  hasForgeOsxSignConfig,
  repairDarwinArm64Signature,
  resolveDarwinCodesignTargetPaths,
  resolveDarwinAppBundlePath,
  shouldRepairDarwinArm64Signature,
} from "./darwin-ad-hoc-sign.mjs";

describe("darwin ad-hoc signing helpers", () => {
  it("detects when Forge already has an explicit macOS signing config", () => {
    expect(hasForgeOsxSignConfig({})).toBe(false);
    expect(hasForgeOsxSignConfig({ osxSign: false })).toBe(false);
    expect(hasForgeOsxSignConfig({ osxSign: true })).toBe(true);
    expect(hasForgeOsxSignConfig({ osxSign: {} })).toBe(true);
    expect(hasForgeOsxSignConfig({ osxSign: { identity: "Developer ID Application" } })).toBe(true);
  });

  it("only repairs signatures for unsigned darwin arm64 bundles", () => {
    expect(
      shouldRepairDarwinArm64Signature({
        platform: "darwin",
        arch: "arm64",
        hasOsxSignConfig: false,
      })
    ).toBe(true);
    expect(
      shouldRepairDarwinArm64Signature({
        platform: "darwin",
        arch: "x64",
        hasOsxSignConfig: false,
      })
    ).toBe(false);
    expect(
      shouldRepairDarwinArm64Signature({
        platform: "darwin",
        arch: "arm64",
        hasOsxSignConfig: true,
      })
    ).toBe(false);
  });

  it("normalizes Forge package directories to the actual app bundle path", () => {
    expect(resolveDarwinAppBundlePath("/tmp/HugeCode-darwin-arm64", "HugeCode")).toBe(
      "/tmp/HugeCode-darwin-arm64/HugeCode.app"
    );
    expect(resolveDarwinAppBundlePath("/tmp/HugeCode.app", "HugeCode")).toBe("/tmp/HugeCode.app");
  });

  it("prefers signing the framework bundle before the app bundle when present", async () => {
    const accessImpl = vi.fn(async (path) => {
      if (path.endsWith("Electron Framework.framework")) {
        return;
      }
      throw new Error("unexpected path");
    });

    await expect(
      resolveDarwinCodesignTargetPaths("/tmp/HugeCode.app", {
        accessImpl,
      })
    ).resolves.toEqual([
      "/tmp/HugeCode.app/Contents/Frameworks/Electron Framework.framework",
      "/tmp/HugeCode.app",
    ]);
  });

  it("falls back to signing only the app bundle when the framework binary is absent", async () => {
    const accessImpl = vi.fn(async () => {
      throw new Error("missing");
    });

    await expect(
      resolveDarwinCodesignTargetPaths("/tmp/HugeCode.app", {
        accessImpl,
      })
    ).resolves.toEqual(["/tmp/HugeCode.app"]);
  });

  it("uses explicit ad-hoc codesign for framework and bundle targets", async () => {
    const spawnImpl = vi.fn((_command, _args) => {
      const listeners = new Map();

      queueMicrotask(() => {
        listeners.get("exit")?.(0);
      });

      return {
        on(event, handler) {
          listeners.set(event, handler);
          return this;
        },
      };
    });
    const logger = {
      info: vi.fn(),
    };

    await repairDarwinArm64Signature("/tmp/HugeCode.app", {
      accessImpl: vi.fn(async () => undefined),
      logger,
      spawnImpl,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Re-signing packaged macOS arm64 app bundle: /tmp/HugeCode.app"
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Re-signing targets: /tmp/HugeCode.app/Contents/Frameworks/Electron Framework.framework, /tmp/HugeCode.app"
    );
    expect(spawnImpl.mock.calls).toEqual([
      [
        "codesign",
        [
          "--force",
          "--sign",
          "-",
          "--timestamp=none",
          "/tmp/HugeCode.app/Contents/Frameworks/Electron Framework.framework",
        ],
        {
          shell: false,
          stdio: "inherit",
        },
      ],
      [
        "codesign",
        ["--force", "--sign", "-", "--timestamp=none", "--deep", "/tmp/HugeCode.app"],
        {
          shell: false,
          stdio: "inherit",
        },
      ],
      [
        "codesign",
        ["--verify", "--deep", "--strict", "/tmp/HugeCode.app"],
        {
          shell: false,
          stdio: "inherit",
        },
      ],
    ]);
  });
});

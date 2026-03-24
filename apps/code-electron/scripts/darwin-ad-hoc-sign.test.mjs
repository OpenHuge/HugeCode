import { describe, expect, it, vi } from "vitest";
import {
  hasForgeOsxSignConfig,
  repairDarwinArm64Signature,
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

  it("uses explicit ad-hoc signing with disabled identity validation", async () => {
    const signAsync = vi.fn(async () => undefined);
    const logger = {
      info: vi.fn(),
    };

    await repairDarwinArm64Signature("/tmp/HugeCode.app", {
      logger,
      signAsync,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Re-signing packaged macOS arm64 app bundle: /tmp/HugeCode.app"
    );
    expect(signAsync).toHaveBeenCalledWith({
      app: "/tmp/HugeCode.app",
      identity: "-",
      identityValidation: false,
      platform: "darwin",
      preAutoEntitlements: false,
      strictVerify: true,
    });
  });
});

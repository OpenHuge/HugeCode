import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const tauriConfigPath = resolve(repoRoot, "apps/code-tauri/src-tauri/tauri.conf.json");
const tauriCargoPath = resolve(repoRoot, "apps/code-tauri/src-tauri/Cargo.toml");
const capabilitiesDir = resolve(repoRoot, "apps/code-tauri/src-tauri/capabilities");

describe("desktop config branding", () => {
  it("uses HugeCode desktop metadata instead of retired branding", () => {
    const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
      productName: string;
      identifier: string;
      app: { windows: Array<{ title: string }> };
    };
    const cargoToml = readFileSync(tauriCargoPath, "utf8");

    expect(tauriConfig.productName).toBe("HugeCode");
    expect(tauriConfig.identifier).toBe("com.hugecode.desktop");
    expect(tauriConfig.app.windows[0]?.title).toBe("HugeCode");
    expect(cargoToml).toContain('description = "HugeCode desktop shell"');
    expect(cargoToml).not.toContain("Code Assistant");
    expect(tauriConfig.identifier).not.toContain("keepup");
  });

  it("splits desktop permissions across multiple capability files", () => {
    const capabilityFiles = readdirSync(capabilitiesDir).filter((entry) => entry.endsWith(".json"));
    expect(capabilityFiles.length).toBeGreaterThan(1);

    const defaultCapability = JSON.parse(
      readFileSync(resolve(capabilitiesDir, "default.json"), "utf8")
    ) as {
      permissions: string[];
    };

    expect(defaultCapability.permissions).toEqual(["core:default"]);
  });
});

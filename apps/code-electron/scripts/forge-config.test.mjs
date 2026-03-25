import { describe, expect, it } from "vitest";
import forgeConfig from "../forge.config.mjs";

describe("forge config", () => {
  it("keeps the deb binary name aligned with the packaged executable", () => {
    const debMaker = forgeConfig.makers.find((maker) => maker.name === "@electron-forge/maker-deb");

    expect(forgeConfig.packagerConfig.executableName).toBe("HugeCode");
    expect(debMaker?.config?.options?.bin).toBe(forgeConfig.packagerConfig.executableName);
    expect(debMaker?.config?.options?.productName).toBe("HugeCode");
  });
});

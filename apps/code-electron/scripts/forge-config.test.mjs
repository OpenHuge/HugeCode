import { describe, expect, it } from "vitest";
import forgeConfig from "../forge.config.mjs";

describe("forge packaging config", () => {
  it("pins the deb binary symlink to the packaged HugeCode executable", () => {
    const debMaker = forgeConfig.makers.find((maker) => maker.name === "@electron-forge/maker-deb");
    expect(debMaker?.config?.options?.bin).toBe("HugeCode");
  });
});

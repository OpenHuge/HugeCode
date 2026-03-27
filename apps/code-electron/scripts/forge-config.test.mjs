import { describe, expect, it } from "vitest";
import forgeConfig, { buildForgeMakers } from "../forge.config.mjs";

describe("forge config", () => {
  it("keeps the deb binary name aligned with the packaged executable", () => {
    const debMaker = forgeConfig.makers.find((maker) => maker.name === "deb");

    expect(forgeConfig.packagerConfig.executableName).toBe("HugeCode");
    expect(debMaker?.configOrConfigFetcher?.bin).toBe(forgeConfig.packagerConfig.executableName);
    expect(forgeConfig.packagerConfig.name).toBe("HugeCode");
  });

  it("publishes Windows squirrel metadata required by electron-winstaller", () => {
    const squirrelMaker = forgeConfig.makers.find(
      (maker) => maker.name === "@electron-forge/maker-squirrel"
    );

    expect(squirrelMaker?.config?.authors).toBe("OpenHuge");
    expect(squirrelMaker?.config?.description).toBe("HugeCode beta desktop shell");
  });

  it("drops the dmg maker when smoke builds opt out", () => {
    const makers = buildForgeMakers({
      betaStaticUpdateBaseUrl: null,
      skipDmg: true,
    });

    expect(makers.some((maker) => maker.name === "@electron-forge/maker-dmg")).toBe(false);
    expect(makers.some((maker) => maker.name === "@electron-forge/maker-zip")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import forgeConfig from "../forge.config.mjs";

describe("forge.config", () => {
  it("pins the deb maker binary to HugeCode", () => {
    const debMaker = forgeConfig.makers.find((maker) => maker.name === "deb");
    expect(debMaker?.configOrConfigFetcher?.bin).toBe("HugeCode");
  });

  it("publishes Windows squirrel metadata required by electron-winstaller", () => {
    const squirrelMaker = forgeConfig.makers.find(
      (maker) => maker.name === "@electron-forge/maker-squirrel"
    );
    expect(squirrelMaker?.config?.authors).toBe("OpenHuge");
    expect(squirrelMaker?.config?.description).toBe("HugeCode beta desktop shell");
    expect(squirrelMaker?.config?.name).toBe("HugeCode");
    expect(squirrelMaker?.config?.setupExe).toBe("HugeCodeSetup.exe");
  });
});

import { describe, expect, it } from "vitest";
import { createForgeSpawnEnv } from "./run-forge-env.mjs";

describe("run-forge env helpers", () => {
  it("removes Windows pseudo-environment keys before spawning child processes", () => {
    const spawnEnv = createForgeSpawnEnv({
      env: {
        "=C:": "C:\\repo",
        Path: "C:\\Windows\\System32",
        KEEP_ME: "ok",
        BROKEN: "bad\u0000value",
      },
      nodeBinDir: "C:\\node",
      forgeTempRoot: "C:\\forge-temp",
      pathDelimiter: ";",
    });

    expect(spawnEnv).toMatchObject({
      Path: "C:\\node;C:\\Windows\\System32",
      KEEP_ME: "ok",
      TMPDIR: "C:\\forge-temp",
      TMP: "C:\\forge-temp",
      TEMP: "C:\\forge-temp",
    });
    expect(spawnEnv).not.toHaveProperty("=C:");
    expect(spawnEnv).not.toHaveProperty("BROKEN");
  });
});

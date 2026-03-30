import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("check-runtime-sot accepts the modularized runtime host contract surface", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts/check-runtime-sot.mjs")],
    {
      cwd: repoRoot,
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimeReplayBackgroundNightlyPlan,
  resolveRuntimeReplayBackgroundNightlyIds,
} from "./run-runtime-replay-background-nightly.mjs";

test("resolveRuntimeReplayBackgroundNightlyIds reads background-ready ids from candidate intake", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-replay-nightly-"));
  const intakePath = path.join(tempRoot, "candidate-intake.json");
  fs.writeFileSync(
    intakePath,
    JSON.stringify(
      {
        backgroundReadyNightlyIds: ["sample-a", "sample-b"],
      },
      null,
      2
    ),
    "utf8"
  );

  assert.deepEqual(resolveRuntimeReplayBackgroundNightlyIds(intakePath), ["sample-a", "sample-b"]);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("buildRuntimeReplayBackgroundNightlyPlan skips execution when no ids are present", () => {
  const plan = buildRuntimeReplayBackgroundNightlyPlan([]);

  assert.equal(plan.shouldRun, false);
  assert.match(plan.message, /No background-ready runtime replay samples/);
  assert.deepEqual(plan.commandArgs, []);
});

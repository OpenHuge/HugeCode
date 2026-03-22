import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimeTruthAssertionsFromTask,
  recordingProfileRequiresScopedRuntime,
  resolveRuntimeReplayIntakeSampleIds,
} from "./record-runtime-provider-replay.mjs";

test("recordingProfileRequiresScopedRuntime ignores default runtime turns", () => {
  assert.equal(
    recordingProfileRequiresScopedRuntime({
      id: null,
      strategy: "runtime-record",
      env: {},
    }),
    false
  );
});

test("recordingProfileRequiresScopedRuntime requires isolated runtime when env overrides exist", () => {
  assert.equal(
    recordingProfileRequiresScopedRuntime({
      id: "openai-endpoint-refused-live",
      strategy: "runtime-record",
      env: {
        CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT: "http://127.0.0.1:9/v1/responses",
      },
    }),
    true
  );
  assert.equal(
    recordingProfileRequiresScopedRuntime({
      id: "clear-compat-provider",
      strategy: "runtime-record",
      env: {
        CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY: null,
      },
    }),
    true
  );
});

test("recordingProfileRequiresScopedRuntime ignores synthetic failure profiles", () => {
  assert.equal(
    recordingProfileRequiresScopedRuntime({
      id: "controlled-orchestration-unavailable",
      strategy: "synthetic-failure",
      env: {
        CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT: "http://127.0.0.1:9/v1/responses",
      },
    }),
    false
  );
});

test("resolveRuntimeReplayIntakeSampleIds returns ids for a named intake group", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-replay-intake-"));
  const intakePath = path.join(tempRoot, "candidate-intake.json");
  fs.writeFileSync(
    intakePath,
    JSON.stringify(
      {
        backgroundReadyNightlyIds: ["sample-a", "sample-b"],
        workflowFailureCandidates: ["sample-c"],
      },
      null,
      2
    ),
    "utf8"
  );

  const ids = resolveRuntimeReplayIntakeSampleIds({
    intakePath,
    intakeGroup: "backgroundReadyNightlyIds",
  });

  assert.deepEqual(ids, ["sample-a", "sample-b"]);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("resolveRuntimeReplayIntakeSampleIds rejects unknown intake groups", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-replay-intake-"));
  const intakePath = path.join(tempRoot, "candidate-intake.json");
  fs.writeFileSync(
    intakePath,
    JSON.stringify(
      {
        backgroundReadyNightlyIds: ["sample-a"],
      },
      null,
      2
    ),
    "utf8"
  );

  assert.throws(
    () =>
      resolveRuntimeReplayIntakeSampleIds({
        intakePath,
        intakeGroup: "workflowFailureCandidates",
      }),
    /workflowFailureCandidates/
  );
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("buildRuntimeTruthAssertionsFromTask promotes positive autodrive runtime truth", () => {
  const runtimeTruth = buildRuntimeTruthAssertionsFromTask({
    checkpointId: "checkpoint-7",
    traceId: "trace-9",
    publishHandoff: {
      branchName: "autodrive/runtime-truth",
    },
    missionLinkage: {
      summary: "Resume via thread linkage.",
    },
    reviewActionability: {
      state: "ready",
      summary: "Review is actionable.",
      actions: [{ kind: "accept" }],
    },
    autoDrive: {
      decisionTrace: { phase: "launch", summary: "Launch autodrive." },
      runtimeScenarioProfile: { authorityScope: "workspace_graph" },
      outcomeFeedback: { status: "ready", summary: "Runtime prepared launch context." },
      autonomyState: { independentThread: true, autonomyPriority: "operator" },
    },
  });

  assert.deepEqual(runtimeTruth.taskFields, [
    {
      type: "wait-runtime-task-field",
      fieldPath: "checkpointId",
      matcher: "present",
      timeoutMs: 20000,
    },
    {
      type: "wait-runtime-task-field",
      fieldPath: "traceId",
      matcher: "present",
      timeoutMs: 20000,
    },
    {
      type: "wait-runtime-task-field",
      fieldPath: "publishHandoff",
      matcher: "present",
      timeoutMs: 20000,
    },
  ]);
  assert.deepEqual(runtimeTruth.review, [
    {
      type: "wait-runtime-summary",
      fieldPath: "missionLinkage.summary",
      matcher: "present",
      timeoutMs: 20000,
    },
    {
      type: "assert-runtime-actionability",
      expectedState: "ready",
      summaryMatcher: "present",
      minimumActionCount: 1,
      timeoutMs: 20000,
    },
  ]);
  assert.deepEqual(runtimeTruth.autodrive, [
    {
      type: "assert-autodrive-trace",
      decisionTraceMatcher: "present",
      runtimeScenarioProfileMatcher: "present",
      repoEvaluationProfileMatcher: "absent",
      outcomeFeedbackMatcher: "present",
      autonomyStateMatcher: "present",
      timeoutMs: 20000,
    },
  ]);
  assert.deepEqual(runtimeTruth.eventReplay, [
    {
      type: "assert-replay-gap-event",
      expectedReason: "runtime.updated",
      timeoutMs: 20000,
    },
  ]);
});

test("buildRuntimeTruthAssertionsFromTask supports runtime-only event replay reasons", () => {
  const runtimeTruth = buildRuntimeTruthAssertionsFromTask(
    {
      autoDrive: {
        decisionTrace: { phase: "launch" },
      },
    },
    {
      eventReplayReason: "native_state_fabric_updated",
    }
  );

  assert.deepEqual(runtimeTruth.eventReplay, [
    {
      type: "assert-replay-gap-event",
      expectedReason: "native_state_fabric_updated",
      timeoutMs: 20000,
    },
  ]);
});

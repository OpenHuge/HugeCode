import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimeReplayExecutionEnv,
  resolveManagedWebReadyTimeoutMs,
} from "./run-runtime-core-replay-e2e.mjs";

test("buildRuntimeReplayExecutionEnv exposes dedicated replay endpoint overrides", () => {
  const env = buildRuntimeReplayExecutionEnv({
    runtimePort: 9911,
    webPort: 5511,
    compiledFixturePath: "/tmp/compiled-provider-replay.json",
    selectionPath: "/tmp/selection.json",
    workspaceRoot: "/tmp/workspace",
    playwrightJsonPath: "/tmp/playwright.json",
    baseEnv: {},
  });

  assert.equal(env.WEB_E2E_HOST, "127.0.0.1");
  assert.equal(env.WEB_E2E_PORT, "5511");
  assert.equal(env.CODE_RUNTIME_SERVICE_PORT, "9911");
  assert.equal(env.CODE_RUNTIME_REPLAY_RPC_ENDPOINT, "http://127.0.0.1:9911/rpc");
  assert.equal(env.CODE_RUNTIME_REPLAY_HEALTH_ENDPOINT, "http://127.0.0.1:9911/health");
  assert.equal(env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT, "http://127.0.0.1:9911/rpc");
  assert.equal(env.CODE_RUNTIME_REPLAY_SELECTION_FILE, "/tmp/selection.json");
  assert.equal(env.CODE_RUNTIME_REPLAY_WORKSPACE_ROOT, "/tmp/workspace");
  assert.equal(env.PLAYWRIGHT_JSON_OUTPUT_NAME, "/tmp/playwright.json");
  assert.match(env.CARGO_TARGET_DIR, /runtime-replay-cargo$/);
});

test("buildRuntimeReplayExecutionEnv drops NO_COLOR when FORCE_COLOR is present", () => {
  const env = buildRuntimeReplayExecutionEnv({
    runtimePort: 9911,
    webPort: 5511,
    compiledFixturePath: "/tmp/compiled-provider-replay.json",
    selectionPath: "/tmp/selection.json",
    workspaceRoot: "/tmp/workspace",
    playwrightJsonPath: "/tmp/playwright.json",
    baseEnv: {
      FORCE_COLOR: "1",
      NO_COLOR: "1",
    },
  });

  assert.equal(env.FORCE_COLOR, "1");
  assert.equal("NO_COLOR" in env, false);
});

test("resolveManagedWebReadyTimeoutMs keeps the parent budget above runtime cold start", () => {
  assert.equal(
    resolveManagedWebReadyTimeoutMs({
      CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "240000",
    }),
    270_000
  );
});

test("resolveManagedWebReadyTimeoutMs honors an explicit replay web-ready override", () => {
  assert.equal(
    resolveManagedWebReadyTimeoutMs({
      CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "240000",
      CODE_RUNTIME_REPLAY_WEB_READY_TIMEOUT_MS: "300000",
    }),
    300_000
  );
});

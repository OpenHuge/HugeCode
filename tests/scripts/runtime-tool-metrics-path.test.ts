import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME,
  resolveRuntimeToolMetricsPersistedPath,
} from "../../scripts/lib/runtime-tool-metrics-path.mjs";

describe("runtime tool metrics path", () => {
  it("defaults to the HugeCode runtime directory in the user's home", () => {
    expect(resolveRuntimeToolMetricsPersistedPath({})).toBe(
      path.join(os.homedir(), ".hugecode", DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME)
    );
  });
});

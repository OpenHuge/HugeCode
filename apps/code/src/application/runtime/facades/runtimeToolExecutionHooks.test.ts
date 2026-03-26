import { describe, expect, it } from "vitest";
import {
  createDefaultRuntimeToolExecutionHooks,
  runRuntimeToolExecutionFailureHooks,
  runRuntimeToolExecutionPreflightHooks,
  runRuntimeToolExecutionSuccessHooks,
} from "./runtimeToolExecutionHooks";

describe("runtimeToolExecutionHooks", () => {
  it("classifies preflight decisions into annotation codes", async () => {
    const annotations = await runRuntimeToolExecutionPreflightHooks(
      [createDefaultRuntimeToolExecutionHooks()],
      {
        toolName: "execute-workspace-command",
        scope: "runtime",
        workspaceId: "workspace-1",
        isMetricsDiagnosticsTool: false,
        isWorkspaceDryRun: true,
        guardrailRequired: false,
        validationWarnings: ["Unexpected field: extra"],
        validationExtraFields: ["extra"],
      }
    );

    expect(annotations).toEqual([
      "workspace-dry-run",
      "guardrail-skipped",
      "input-schema-warning",
      "input-extra-fields",
    ]);
  });

  it("classifies truncated successful executions", async () => {
    const annotations = await runRuntimeToolExecutionSuccessHooks(
      [createDefaultRuntimeToolExecutionHooks()],
      {
        toolName: "run-runtime-live-skill",
        scope: "runtime",
        workspaceId: "workspace-1",
        truncatedOutput: true,
        durationMs: 120,
      }
    );

    expect(annotations).toEqual(["output-truncated"]);
  });

  it("classifies validation and timeout failures", async () => {
    const validationAnnotations = await runRuntimeToolExecutionFailureHooks(
      [createDefaultRuntimeToolExecutionHooks()],
      {
        toolName: "execute-workspace-command",
        scope: "runtime",
        workspaceId: "workspace-1",
        status: "validation_failed",
        errorCode: "INPUT_SCHEMA_VALIDATION_FAILED",
        durationMs: 0,
      }
    );
    const timeoutAnnotations = await runRuntimeToolExecutionFailureHooks(
      [createDefaultRuntimeToolExecutionHooks()],
      {
        toolName: "run-runtime-live-skill",
        scope: "runtime",
        workspaceId: "workspace-1",
        status: "timeout",
        errorCode: "REQUEST_TIMEOUT",
        durationMs: 5000,
      }
    );

    expect(validationAnnotations).toEqual(["validation-failed"]);
    expect(timeoutAnnotations).toEqual(["runtime-timeout"]);
  });
});

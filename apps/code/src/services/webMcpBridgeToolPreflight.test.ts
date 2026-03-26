import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebMcpInputSchemaValidationError } from "@ku0/code-runtime-client/webMcpInputSchemaValidationError";
import {
  __resetRuntimeToolExecutionMetricsForTests,
  readRuntimeToolExecutionMetrics,
} from "./runtimeToolExecutionMetrics";
import { wrapToolsWithInputSchemaPreflight } from "./webMcpBridgeToolPreflight";
import {
  evaluateRuntimeToolGuardrail,
  reportRuntimeToolExecutionAttempted,
  reportRuntimeToolExecutionCompleted,
  reportRuntimeToolExecutionStarted,
  reportRuntimeToolGuardrailOutcome,
} from "./runtimeToolExecutionMetricsReporter";

vi.mock("./runtimeToolExecutionMetricsReporter", () => ({
  evaluateRuntimeToolGuardrail: vi.fn(async () => ({
    allowed: true,
    message: null,
    errorCode: null,
    effectivePayloadLimitBytes: 65536,
    effectiveComputerObserveRateLimitPerMinute: 12,
  })),
  reportRuntimeToolExecutionAttempted: vi.fn(async () => undefined),
  reportRuntimeToolExecutionCompleted: vi.fn(async () => undefined),
  reportRuntimeToolExecutionStarted: vi.fn(async () => undefined),
  reportRuntimeToolGuardrailOutcome: vi.fn(async () => undefined),
}));

const evaluateRuntimeToolGuardrailMock = vi.mocked(evaluateRuntimeToolGuardrail);
const reportRuntimeToolExecutionAttemptedMock = vi.mocked(reportRuntimeToolExecutionAttempted);
const reportRuntimeToolExecutionStartedMock = vi.mocked(reportRuntimeToolExecutionStarted);
const reportRuntimeToolExecutionCompletedMock = vi.mocked(reportRuntimeToolExecutionCompleted);
const reportRuntimeToolGuardrailOutcomeMock = vi.mocked(reportRuntimeToolGuardrailOutcome);

describe("webMcpBridgeToolPreflight", () => {
  beforeEach(() => {
    __resetRuntimeToolExecutionMetricsForTests();
    vi.clearAllMocks();
    evaluateRuntimeToolGuardrailMock.mockResolvedValue({
      allowed: true,
      message: null,
      errorCode: null,
      effectivePayloadLimitBytes: 65536,
      effectiveComputerObserveRateLimitPerMinute: 12,
    });
  });

  it("annotates workspace dry-run executions as guardrail-skipped", async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const [tool] = wrapToolsWithInputSchemaPreflight(
      [
        {
          name: "execute-workspace-command",
          inputSchema: {
            type: "object",
            properties: {
              command: { type: "string" },
              dryRun: { type: "boolean" },
              workspaceId: { type: "string" },
            },
            required: ["command"],
          },
          execute,
        },
      ],
      "runtime"
    );

    await expect(
      Promise.resolve(
        tool.execute({ command: "pwd", dryRun: true, workspaceId: "workspace-1" }, null)
      )
    ).resolves.toEqual({ ok: true });

    const metrics = readRuntimeToolExecutionMetrics();
    expect(evaluateRuntimeToolGuardrailMock).not.toHaveBeenCalled();
    expect(metrics.recent[0]?.annotations).toEqual(["workspace-dry-run", "guardrail-skipped"]);
    expect(metrics.byTool["runtime:execute-workspace-command"]?.lastAnnotations).toEqual([
      "workspace-dry-run",
      "guardrail-skipped",
    ]);
  });

  it("annotates validation failures after guardrail-approved preflight", async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const [tool] = wrapToolsWithInputSchemaPreflight(
      [
        {
          name: "run-runtime-live-skill",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              workspaceId: { type: "string" },
            },
            required: ["path"],
          },
          execute,
        },
      ],
      "runtime"
    );

    await expect(
      Promise.resolve(tool.execute({ path: 42, workspaceId: "workspace-1" }, null))
    ).rejects.toBeInstanceOf(WebMcpInputSchemaValidationError);

    const metrics = readRuntimeToolExecutionMetrics();
    expect(evaluateRuntimeToolGuardrailMock).toHaveBeenCalledTimes(1);
    expect(metrics.recent[0]?.annotations).toEqual(["guardrail-required", "validation-failed"]);
    expect(reportRuntimeToolExecutionCompletedMock).toHaveBeenCalledTimes(1);
    expect(reportRuntimeToolGuardrailOutcomeMock).toHaveBeenCalledTimes(1);
  });

  it("annotates successful truncated executions with preflight context", async () => {
    const execute = vi.fn(async () => ({
      data: {
        toolOutput: {
          truncated: true,
        },
      },
    }));
    const [tool] = wrapToolsWithInputSchemaPreflight(
      [
        {
          name: "run-runtime-live-skill",
          inputSchema: {
            type: "object",
            properties: {
              command: { type: "string" },
              workspaceId: { type: "string" },
            },
            required: ["command"],
          },
          execute,
        },
      ],
      "runtime"
    );

    await expect(
      Promise.resolve(
        tool.execute({ command: "list", workspaceId: "workspace-1", extra: true }, null)
      )
    ).resolves.toEqual({
      data: {
        toolOutput: {
          truncated: true,
        },
      },
    });

    const metrics = readRuntimeToolExecutionMetrics();
    expect(reportRuntimeToolExecutionAttemptedMock).toHaveBeenCalledTimes(1);
    expect(reportRuntimeToolExecutionStartedMock).toHaveBeenCalledTimes(1);
    expect(reportRuntimeToolExecutionCompletedMock).toHaveBeenCalledTimes(1);
    expect(reportRuntimeToolGuardrailOutcomeMock).toHaveBeenCalledTimes(1);
    expect(metrics.recent[0]?.annotations).toEqual([
      "guardrail-required",
      "input-schema-warning",
      "input-extra-fields",
      "output-truncated",
    ]);
  });
});

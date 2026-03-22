import { describe, expect, it, vi } from "vitest";
import { buildRuntimeOperationsTools } from "./webMcpBridgeRuntimeOperationsTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimeOperationsTools", () => {
  it("registers runtime operations tools and executes read-only calls without approval", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const getRuntimeRemoteStatus = vi.fn(async () => ({ connected: true }));
    const runtimeDiagnosticsExportV1 = vi.fn(async (input?: { workspaceId?: string | null }) => ({
      workspaceId: input?.workspaceId ?? null,
      generatedAt: 42,
    }));
    const runRuntimeCodexDoctor = vi.fn(async () => ({
      ok: true,
      codexBin: "codex",
      version: "1.0.0",
      appServerOk: true,
      details: null,
      path: "/usr/local/bin/codex",
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
      warnings: [],
    }));

    const tools = buildRuntimeOperationsTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimeRemoteStatus,
        getRuntimeSettings: vi.fn(async () => ({ mode: "balanced" })),
        getRuntimeBootstrapSnapshot: vi.fn(async () => ({ initialized: true })),
        runtimeDiagnosticsExportV1,
        runtimeSecurityPreflightV1: vi.fn(async () => ({ action: "allow" })),
        runtimeSessionExportV1: vi.fn(async () => ({ threadId: "thread-1" })),
        runtimeSessionImportV1: vi.fn(async () => ({ imported: true })),
        runtimeSessionDeleteV1: vi.fn(async () => true),
        runRuntimeCodexDoctor,
        runRuntimeCodexUpdate: vi.fn(async () => ({ ok: true })),
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "get-runtime-remote-status",
      "get-runtime-settings",
      "get-runtime-bootstrap-snapshot",
      "export-runtime-diagnostics",
      "evaluate-runtime-security-preflight",
      "run-runtime-codex-doctor",
      "run-runtime-codex-update",
      "export-runtime-session",
      "import-runtime-session",
      "delete-runtime-session",
    ]);

    const readOnlyToolNames = [
      "get-runtime-remote-status",
      "get-runtime-settings",
      "get-runtime-bootstrap-snapshot",
      "export-runtime-diagnostics",
      "evaluate-runtime-security-preflight",
      "run-runtime-codex-doctor",
      "export-runtime-session",
    ];
    for (const toolName of readOnlyToolNames) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool?.annotations?.readOnlyHint).toBe(true);
    }

    const getRemoteStatusTool = tools.find((tool) => tool.name === "get-runtime-remote-status");
    const remoteStatusResponse = await getRemoteStatusTool?.execute({}, null);
    expect(getRuntimeRemoteStatus).toHaveBeenCalledTimes(1);
    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(remoteStatusResponse).toMatchObject({
      ok: true,
      message: "Runtime remote status retrieved.",
      data: {
        status: {
          connected: true,
        },
      },
    });

    const exportDiagnosticsTool = tools.find((tool) => tool.name === "export-runtime-diagnostics");
    const diagnosticsResponse = await exportDiagnosticsTool?.execute(
      {
        redactionLevel: "balanced",
        includeTaskSummaries: true,
      },
      null
    );
    expect(runtimeDiagnosticsExportV1).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      redactionLevel: "balanced",
      includeTaskSummaries: true,
    });
    expect(diagnosticsResponse).toMatchObject({
      ok: true,
      message: "Runtime diagnostics export completed.",
      data: {
        workspaceId: "ws-1",
        available: true,
      },
    });

    const doctorTool = tools.find((tool) => tool.name === "run-runtime-codex-doctor");
    const doctorResponse = await doctorTool?.execute(
      {
        codexBin: "codex",
        codexArgs: ["--healthcheck"],
      },
      null
    );
    expect(runRuntimeCodexDoctor).toHaveBeenCalledWith({
      codexBin: "codex",
      codexArgs: ["--healthcheck"],
    });
    expect(doctorResponse).toMatchObject({
      ok: true,
      message: "Runtime codex doctor completed.",
      data: {
        result: {
          ok: true,
          codexBin: "codex",
        },
      },
    });
  });

  it("validates diagnostics inputs and forwards security preflight options", async () => {
    const runtimeSecurityPreflightV1 = vi.fn(async (input) => ({
      action: "review",
      request: input,
    }));
    const tools = buildRuntimeOperationsTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimeRemoteStatus: vi.fn(async () => ({})),
        getRuntimeSettings: vi.fn(async () => ({})),
        getRuntimeBootstrapSnapshot: vi.fn(async () => ({})),
        runtimeDiagnosticsExportV1: vi.fn(async () => ({})),
        runtimeSecurityPreflightV1,
        runtimeSessionExportV1: vi.fn(async () => ({})),
        runtimeSessionImportV1: vi.fn(async () => ({})),
        runtimeSessionDeleteV1: vi.fn(async () => true),
        runRuntimeCodexDoctor: vi.fn(async () => ({})),
        runRuntimeCodexUpdate: vi.fn(async () => ({})),
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction: vi.fn(async () => undefined),
      },
    });

    const diagnosticsTool = tools.find((tool) => tool.name === "export-runtime-diagnostics");
    await expect(diagnosticsTool?.execute({ redactionLevel: "full" }, null)).rejects.toMatchObject({
      code: "runtime.validation.input.invalid",
    });

    const securityTool = tools.find((tool) => tool.name === "evaluate-runtime-security-preflight");
    const response = await securityTool?.execute(
      {
        toolName: "execute-workspace-command",
        command: "npm test",
        input: { dryRun: true },
        checkPackageAdvisory: true,
        checkExecPolicy: false,
        execPolicyRules: [" allow npm test ", "", "deny rm -rf"],
      },
      null
    );

    expect(runtimeSecurityPreflightV1).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      toolName: "execute-workspace-command",
      command: "npm test",
      input: { dryRun: true },
      checkPackageAdvisory: true,
      checkExecPolicy: false,
      execPolicyRules: ["allow npm test", "deny rm -rf"],
    });
    expect(response).toMatchObject({
      ok: true,
      message: "Runtime security preflight evaluated.",
      data: {
        decision: {
          action: "review",
        },
      },
    });
  });

  it("routes import and delete session tools through write confirmation", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const runtimeSessionImportV1 = vi.fn(async () => ({
      imported: true,
      warnings: ["snapshot normalized"],
    }));
    const runtimeSessionDeleteV1 = vi.fn(async () => true);
    const runRuntimeCodexUpdate = vi.fn(async () => ({
      ok: true,
      method: "npm",
      package: "codex",
      beforeVersion: "1.0.0",
      afterVersion: "1.0.1",
      upgraded: true,
      output: "updated",
      details: null,
      warnings: [],
    }));
    const onApprovalRequest = vi.fn(async () => true);
    const tools = buildRuntimeOperationsTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimeRemoteStatus: vi.fn(async () => ({})),
        getRuntimeSettings: vi.fn(async () => ({})),
        getRuntimeBootstrapSnapshot: vi.fn(async () => ({})),
        runtimeDiagnosticsExportV1: vi.fn(async () => ({})),
        runtimeSecurityPreflightV1: vi.fn(async () => ({})),
        runtimeSessionExportV1: vi.fn(async () => ({})),
        runtimeSessionImportV1,
        runtimeSessionDeleteV1,
        runRuntimeCodexDoctor: vi.fn(async () => ({})),
        runRuntimeCodexUpdate,
      },
      requireUserApproval: false,
      onApprovalRequest,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction,
      },
    });

    const importTool = tools.find((tool) => tool.name === "import-runtime-session");
    const importResponse = await importTool?.execute(
      {
        threadId: "thread-1",
        snapshot: { version: 1 },
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(confirmWriteAction).toHaveBeenCalledWith(
      null,
      false,
      "Import runtime session into workspace ws-1.",
      onApprovalRequest
    );
    expect(runtimeSessionImportV1).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-1",
      snapshot: { version: 1 },
    });
    expect(importResponse).toMatchObject({
      ok: true,
      message: "Runtime session import completed.",
      data: {
        imported: true,
        warnings: ["snapshot normalized"],
      },
    });

    const deleteTool = tools.find((tool) => tool.name === "delete-runtime-session");
    expect(deleteTool?.annotations?.destructiveHint).toBe(true);
    const deleteResponse = await deleteTool?.execute({ threadId: "thread-1" }, null);
    expect(confirmWriteAction).toHaveBeenCalledTimes(2);
    expect(confirmWriteAction).toHaveBeenLastCalledWith(
      null,
      false,
      "Delete runtime session thread-1 from workspace ws-1.",
      onApprovalRequest
    );
    expect(runtimeSessionDeleteV1).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(deleteResponse).toMatchObject({
      ok: true,
      message: "Runtime session delete completed.",
      data: {
        deleted: true,
      },
    });

    const updateTool = tools.find((tool) => tool.name === "run-runtime-codex-update");
    const updateResponse = await updateTool?.execute(
      {
        codexBin: "codex",
        codexArgs: ["--yes"],
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledTimes(3);
    expect(confirmWriteAction).toHaveBeenLastCalledWith(
      null,
      false,
      "Run runtime Codex update in workspace ws-1.",
      onApprovalRequest
    );
    expect(runRuntimeCodexUpdate).toHaveBeenCalledWith({
      codexBin: "codex",
      codexArgs: ["--yes"],
    });
    expect(updateResponse).toMatchObject({
      ok: true,
      message: "Runtime codex update completed.",
      data: {
        result: {
          ok: true,
          method: "npm",
          upgraded: true,
        },
      },
    });
  });
});

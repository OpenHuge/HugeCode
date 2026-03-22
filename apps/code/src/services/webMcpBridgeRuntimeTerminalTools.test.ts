import { describe, expect, it, vi } from "vitest";
import { buildRuntimeTerminalTools } from "./webMcpBridgeRuntimeTerminalTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimeTerminalTools", () => {
  it("registers terminal session tools and executes read-only calls without approval", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const openRuntimeTerminalSession = vi.fn(async () => ({
      id: "session-1",
      workspaceId: "ws-1",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: ["$"],
    }));
    const readRuntimeTerminalSession = vi.fn(async () => ({
      id: "session-1",
      workspaceId: "ws-1",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: ["$ pwd", "/tmp/project"],
    }));
    const writeRuntimeTerminalSession = vi.fn(async () => ({
      id: "session-1",
      workspaceId: "ws-1",
      state: "created",
      createdAt: 1,
      updatedAt: 3,
      lines: ["$ pwd", "/tmp/project"],
    }));

    const tools = buildRuntimeTerminalTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        openRuntimeTerminalSession,
        readRuntimeTerminalSession,
        writeRuntimeTerminalSession,
        interruptRuntimeTerminalSession: vi.fn(async () => true),
        resizeRuntimeTerminalSession: vi.fn(async () => true),
        closeRuntimeTerminalSession: vi.fn(async () => true),
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.floor(value)
            : null,
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "open-runtime-terminal-session",
      "read-runtime-terminal-session",
      "write-runtime-terminal-session",
      "interrupt-runtime-terminal-session",
      "resize-runtime-terminal-session",
      "close-runtime-terminal-session",
    ]);
    expect(
      tools.find((tool) => tool.name === "read-runtime-terminal-session")?.annotations
    ).toMatchObject({
      readOnlyHint: true,
    });
    expect(
      tools.find((tool) => tool.name === "write-runtime-terminal-session")?.annotations
    ).toMatchObject({
      destructiveHint: true,
      openWorldHint: true,
    });
    expect(
      tools.find((tool) => tool.name === "interrupt-runtime-terminal-session")?.annotations
    ).toMatchObject({
      destructiveHint: true,
    });
    expect(
      tools.find((tool) => tool.name === "close-runtime-terminal-session")?.annotations
    ).toMatchObject({
      destructiveHint: true,
    });

    const readTool = tools.find((tool) => tool.name === "read-runtime-terminal-session");
    const readResponse = await readTool?.execute({ sessionId: "session-1" }, null);
    expect(readRuntimeTerminalSession).toHaveBeenCalledWith("session-1");
    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(readResponse).toMatchObject({
      ok: true,
      message: "Runtime terminal session read.",
      data: {
        session: {
          id: "session-1",
        },
      },
    });

    const openTool = tools.find((tool) => tool.name === "open-runtime-terminal-session");
    const openResponse = await openTool?.execute({}, null);
    expect(openRuntimeTerminalSession).toHaveBeenCalledWith({
      workspaceId: "ws-1",
    });
    expect(openResponse).toMatchObject({
      ok: true,
      message: "Runtime terminal session opened.",
      data: {
        session: {
          id: "session-1",
        },
      },
    });

    const writeTool = tools.find((tool) => tool.name === "write-runtime-terminal-session");
    const writeResponse = await writeTool?.execute(
      {
        sessionId: "session-1",
        input: "pwd\n",
      },
      null
    );
    expect(writeRuntimeTerminalSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      input: "pwd\n",
    });
    expect(writeResponse).toMatchObject({
      ok: true,
      message: "Runtime terminal session written.",
    });
  });

  it("routes mutation tools through write confirmation and validates input", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const interruptRuntimeTerminalSession = vi.fn(async () => true);
    const resizeRuntimeTerminalSession = vi.fn(async () => true);
    const closeRuntimeTerminalSession = vi.fn(async () => true);
    const tools = buildRuntimeTerminalTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        openRuntimeTerminalSession: vi.fn(async () => ({})),
        readRuntimeTerminalSession: vi.fn(async () => ({})),
        writeRuntimeTerminalSession: vi.fn(async () => ({})),
        interruptRuntimeTerminalSession,
        resizeRuntimeTerminalSession,
        closeRuntimeTerminalSession,
      },
      requireUserApproval: true,
      onApprovalRequest: vi.fn(async () => true),
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.floor(value)
            : null,
        confirmWriteAction,
      },
    });

    const interruptTool = tools.find((tool) => tool.name === "interrupt-runtime-terminal-session");
    await interruptTool?.execute({ sessionId: "session-2" }, null);
    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(interruptRuntimeTerminalSession).toHaveBeenCalledWith("session-2");

    const resizeTool = tools.find((tool) => tool.name === "resize-runtime-terminal-session");
    await expect(resizeTool?.execute({ rows: 24, cols: 80 }, null)).rejects.toMatchObject({
      code: "runtime.validation.input.required",
    });
    await expect(
      resizeTool?.execute({ sessionId: "session-2", rows: 0, cols: 80 }, null)
    ).rejects.toMatchObject({
      code: "runtime.validation.input.invalid",
    });
    await resizeTool?.execute({ sessionId: "session-2", rows: 24, cols: 80 }, null);
    expect(resizeRuntimeTerminalSession).toHaveBeenCalledWith({
      sessionId: "session-2",
      rows: 24,
      cols: 80,
    });

    const closeTool = tools.find((tool) => tool.name === "close-runtime-terminal-session");
    await closeTool?.execute({ sessionId: "session-2" }, null);
    expect(closeRuntimeTerminalSession).toHaveBeenCalledWith("session-2");
  });

  it("surfaces not-found errors for missing terminal sessions", async () => {
    const tools = buildRuntimeTerminalTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        openRuntimeTerminalSession: vi.fn(async () => ({})),
        readRuntimeTerminalSession: vi.fn(async () => null),
        writeRuntimeTerminalSession: vi.fn(async () => null),
        interruptRuntimeTerminalSession: vi.fn(async () => false),
        resizeRuntimeTerminalSession: vi.fn(async () => false),
        closeRuntimeTerminalSession: vi.fn(async () => false),
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.floor(value)
            : null,
        confirmWriteAction: vi.fn(async () => undefined),
      },
    });

    await expect(
      tools
        .find((tool) => tool.name === "read-runtime-terminal-session")
        ?.execute({ sessionId: "missing-session" }, null)
    ).rejects.toMatchObject({
      code: "runtime.validation.resource.not_found",
    });
    await expect(
      tools
        .find((tool) => tool.name === "write-runtime-terminal-session")
        ?.execute({ sessionId: "missing-session", input: "ls" }, null)
    ).rejects.toMatchObject({
      code: "runtime.validation.resource.not_found",
    });
    await expect(
      tools
        .find((tool) => tool.name === "interrupt-runtime-terminal-session")
        ?.execute({ sessionId: "missing-session" }, null)
    ).rejects.toMatchObject({
      code: "runtime.validation.resource.not_found",
    });
    await expect(
      tools
        .find((tool) => tool.name === "close-runtime-terminal-session")
        ?.execute({ sessionId: "missing-session" }, null)
    ).rejects.toMatchObject({
      code: "runtime.validation.resource.not_found",
    });
    await expect(
      tools
        .find((tool) => tool.name === "write-runtime-terminal-session")
        ?.execute({ input: "ls" }, null)
    ).rejects.toMatchObject({
      code: "runtime.validation.input.required",
    });
  });
});

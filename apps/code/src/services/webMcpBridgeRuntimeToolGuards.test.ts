import { describe, expect, it } from "vitest";
import { RUNTIME_MESSAGE_CODES } from "./runtimeMessageCodes";
import { readRuntimeCode } from "./runtimeMessageEnvelope";
import {
  ensureCommandLengthWithinLimit,
  ensureNoDangerousShellCommand,
  ensureNoSubAgentOrchestrationShellCommand,
  ensurePayloadWithinLimit,
  normalizeWorkspaceRelativePath,
  requestRequiresSubAgentOrchestration,
} from "./webMcpBridgeRuntimeToolGuards";

describe("webMcpBridgeRuntimeToolGuards", () => {
  it("detects english sub-agent orchestration intent", () => {
    expect(
      requestRequiresSubAgentOrchestration("Use sub agents to parallelize this implementation.")
    ).toBe(true);
    expect(
      requestRequiresSubAgentOrchestration("Please run this with an agent team and delegate tasks.")
    ).toBe(true);
  });

  it("detects chinese sub-agent orchestration intent", () => {
    expect(requestRequiresSubAgentOrchestration("请启用sub agents进行并行代理编排")).toBe(true);
    expect(requestRequiresSubAgentOrchestration("这个任务需要子代理来分治执行")).toBe(true);
  });

  it("does not treat regular shell intent as sub-agent orchestration", () => {
    expect(requestRequiresSubAgentOrchestration("Run pnpm validate")).toBe(false);
    expect(requestRequiresSubAgentOrchestration("Search workspace files for executionMode")).toBe(
      false
    );
  });

  it("blocks shell command execution when sub-agent orchestration is requested", () => {
    let blockedError: unknown = null;
    try {
      ensureNoSubAgentOrchestrationShellCommand(
        "启用 sub agents 并行执行该任务",
        "execute-workspace-command"
      );
    } catch (error) {
      blockedError = error;
    }
    expect(blockedError).toBeInstanceOf(Error);
    expect(readRuntimeCode(blockedError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted
    );
    expect(String((blockedError as Error).message)).toContain("blocked shell execution");

    expect(() =>
      ensureNoSubAgentOrchestrationShellCommand("pnpm -C apps/code typecheck", "test-tool")
    ).not.toThrow();
  });

  it("blocks dangerous shell commands with a stable restricted-command error code", () => {
    let blockedError: unknown = null;
    try {
      ensureNoDangerousShellCommand("rm -rf /", "execute-workspace-command");
    } catch (error) {
      blockedError = error;
    }
    expect(blockedError).toBeInstanceOf(Error);
    expect(readRuntimeCode(blockedError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted
    );
    expect(String((blockedError as Error).message)).toContain("dangerous command pattern");

    expect(() =>
      ensureNoDangerousShellCommand("pnpm --filter @ku0/code test", "execute-workspace-command")
    ).not.toThrow();
  });

  it("normalizes workspace-relative paths and blocks traversal or absolute paths", () => {
    expect(
      normalizeWorkspaceRelativePath("src//features/./messages.tsx", {
        toolName: "read-workspace-file",
        fieldName: "path",
      })
    ).toBe("src/features/messages.tsx");
    expect(
      normalizeWorkspaceRelativePath(".", {
        toolName: "list-workspace-tree",
        fieldName: "path",
        allowDot: true,
      })
    ).toBe(".");

    let traversalError: unknown = null;
    try {
      normalizeWorkspaceRelativePath("../secrets.txt", {
        toolName: "read-workspace-file",
        fieldName: "path",
      });
    } catch (error) {
      traversalError = error;
    }
    expect(readRuntimeCode(traversalError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.pathOutsideWorkspace
    );

    let absoluteError: unknown = null;
    try {
      normalizeWorkspaceRelativePath("/etc/passwd", {
        toolName: "read-workspace-file",
        fieldName: "path",
      });
    } catch (error) {
      absoluteError = error;
    }
    expect(readRuntimeCode(absoluteError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.pathOutsideWorkspace
    );
  });

  it("blocks oversized payloads and command lengths with payload-too-large code", () => {
    expect(() =>
      ensurePayloadWithinLimit("short", {
        toolName: "write-workspace-file",
        fieldName: "content",
        maxBytes: 16,
      })
    ).not.toThrow();

    let payloadError: unknown = null;
    try {
      ensurePayloadWithinLimit("x".repeat(32), {
        toolName: "write-workspace-file",
        fieldName: "content",
        maxBytes: 8,
      });
    } catch (error) {
      payloadError = error;
    }
    expect(readRuntimeCode(payloadError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict
    );

    let commandLengthError: unknown = null;
    try {
      ensureCommandLengthWithinLimit("echo ".repeat(100), {
        toolName: "execute-workspace-command",
        fieldName: "command",
        maxChars: 32,
      });
    } catch (error) {
      commandLengthError = error;
    }
    expect(readRuntimeCode(commandLengthError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict
    );
  });
});

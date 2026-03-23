import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRuntimeSubAgentBatchJournalForTests,
  buildOrchestrateRuntimeSubAgentBatchTool,
} from "./webMcpBridgeRuntimeSubAgentBatchTool";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";
import type {
  RuntimeAgentControl,
  RuntimeSubAgentSessionSummary,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

function createSession(sessionId: string): RuntimeSubAgentSessionSummary {
  return {
    sessionId,
    workspaceId: "ws-1",
    threadId: null,
    title: null,
    status: "running",
    accessMode: "on-request",
    reasonEffort: "medium",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    activeTaskId: null,
    lastTaskId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    closedAt: null,
    errorCode: null,
    errorMessage: null,
    scopeProfile: "general",
    allowedSkillIds: ["core-grep"],
    allowNetwork: false,
    workspaceReadPaths: ["src"],
    parentRunId: null,
    profileDescriptor: null,
    checkpointId: `checkpoint-${sessionId}`,
    traceId: `trace-${sessionId}`,
    recovered: false,
    checkpointState: null,
    approvalEvents: null,
    compactionSummary: null,
    evalTags: null,
  };
}

function createTool(runtimeControl: Partial<RuntimeAgentControl>) {
  return buildOrchestrateRuntimeSubAgentBatchTool({
    snapshot: createAgentCommandCenterSnapshot(),
    runtimeControl: runtimeControl as RuntimeAgentControl,
    requireUserApproval: false,
    helpers: {
      buildResponse: (message, data) => ({ ok: true, message, data }),
      toNonEmptyString: (value) =>
        typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
      toStringArray: (value) => {
        if (Array.isArray(value)) {
          return value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        }
        if (typeof value === "string") {
          return value
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        }
        return [];
      },
      toPositiveInteger: (value) => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return null;
        }
        const truncated = Math.floor(value);
        return truncated > 0 ? truncated : null;
      },
      normalizeRuntimeAccessMode: (value) => {
        if (value === "read-only" || value === "full-access" || value === "on-request") {
          return value;
        }
        return "on-request";
      },
      normalizeRuntimeReasonEffort: (value) => {
        if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
          return value;
        }
        return null;
      },
      confirmWriteAction: async () => undefined,
    },
  });
}

describe("webMcpBridgeRuntimeSubAgentBatchTool", () => {
  beforeEach(() => {
    __resetRuntimeSubAgentBatchJournalForTests();
  });

  it("executes dependency chains in order", async () => {
    const sendOrder: string[] = [];
    let sessionCounter = 0;
    const spawnSubAgentSession = vi.fn(async () => createSession(`session-${++sessionCounter}`));
    const sendSubAgentInstruction = vi.fn(async (input: { instruction: string }) => {
      sendOrder.push(input.instruction);
      return { session: createSession("unused"), task: null };
    });
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const closeSubAgentSession = vi.fn(async () => ({
      closed: true,
      sessionId: "unused",
      status: "closed" as const,
      message: "closed",
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
      closeSubAgentSession,
    });

    const response = (await tool.execute(
      {
        executionMode: "parallel",
        maxParallel: 3,
        tasks: [
          { taskKey: "collect", instruction: "collect" },
          { taskKey: "analyze", instruction: "analyze", dependsOn: ["collect"] },
          { taskKey: "summarize", instruction: "summarize", dependsOn: ["analyze"] },
        ],
      },
      null
    )) as { data: { summary: Record<string, number>; plan: { waves: string[][] } } };

    expect(sendOrder).toEqual(["collect", "analyze", "summarize"]);
    expect(response.data.plan.waves).toEqual([["collect"], ["analyze"], ["summarize"]]);
    expect(response.data.summary).toMatchObject({
      total: 3,
      succeeded: 3,
      failed: 0,
      skipped: 0,
      retried: 0,
      timedOut: 0,
    });
    const requestIds = sendSubAgentInstruction.mock.calls
      .map((call) => {
        const payload = call[0] as { requestId?: unknown } | undefined;
        return typeof payload?.requestId === "string" ? payload.requestId : null;
      })
      .filter((value): value is string => value !== null);
    expect(requestIds).toHaveLength(3);
    expect(requestIds.every((requestId) => requestId.startsWith("webmcp:sub-agent-batch:"))).toBe(
      true
    );
    expect(new Set(requestIds).size).toBe(requestIds.length);
  });

  it("surfaces policy-driven sequential fallback for approval-sensitive batches", async () => {
    const spawnSubAgentSession = vi
      .fn()
      .mockResolvedValueOnce(createSession("session-1"))
      .mockResolvedValueOnce(createSession("session-2"));
    const sendSubAgentInstruction = vi.fn(async (input: { sessionId: string }) => ({
      session: createSession(input.sessionId),
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async (input: { sessionId: string }) => ({
      session: createSession(input.sessionId),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const response = (await tool.execute(
      {
        executionMode: "parallel",
        maxParallel: 4,
        tasks: [
          { taskKey: "inspect", instruction: "inspect", requiresApproval: true },
          { taskKey: "summarize", instruction: "summarize" },
        ],
      },
      null
    )) as {
      data: {
        plan: {
          executionMode: string;
          maxParallel: number;
          policy: { reasonCodes: string[]; parallelToolCallsAllowed: boolean };
        };
      };
    };

    expect(response.data.plan.executionMode).toBe("sequential");
    expect(response.data.plan.maxParallel).toBe(1);
    expect(response.data.plan.policy.parallelToolCallsAllowed).toBe(false);
    expect(response.data.plan.policy.reasonCodes).toContain("approval-sensitive-tasks");
  });

  it("applies batch-level advanced spawn defaults and lets task input override them", async () => {
    const spawnSubAgentSession = vi
      .fn()
      .mockResolvedValueOnce(createSession("session-1"))
      .mockResolvedValueOnce(createSession("session-2"));
    const sendSubAgentInstruction = vi.fn(async (input: { sessionId: string }) => ({
      session: createSession(input.sessionId),
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async (input: { sessionId: string }) => ({
      session: createSession(input.sessionId),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      listLiveSkills: vi.fn(async () => [
        {
          id: "core-grep",
          name: "Core Grep",
          description: "Search files",
          kind: "file_search",
          source: "builtin",
          version: "1.0.0",
          enabled: true,
          supportsNetwork: false,
          tags: [],
          aliases: ["core-grep", "grep", "rg", "search", "ripgrep"],
        },
        {
          id: "core-read",
          name: "Core Read",
          description: "Read files",
          kind: "file_read",
          source: "builtin",
          version: "1.0.0",
          enabled: true,
          supportsNetwork: false,
          tags: [],
        },
        {
          id: "core-edit",
          name: "Core Edit",
          description: "Edit files",
          kind: "file_edit",
          source: "builtin",
          version: "1.0.0",
          enabled: true,
          supportsNetwork: false,
          tags: [],
        },
      ]),
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const response = (await tool.execute(
      {
        scopeProfile: "research",
        allowedSkillIds: "ripgrep, read_file",
        allowNetwork: false,
        workspaceReadPaths: "src, docs",
        parentRunId: "parent-batch-1",
        tasks: [
          { taskKey: "defaulted", instruction: "inspect defaults" },
          {
            taskKey: "overridden",
            instruction: "inspect overrides",
            scopeProfile: "review",
            allowedSkillIds: ["edit_file"],
            allowNetwork: true,
            workspaceReadPaths: ["tests"],
            parentRunId: "parent-task-2",
          },
        ],
      },
      null
    )) as {
      data: {
        results: Array<{
          taskKey: string;
          sessionHandle: { sessionId: string; checkpointId: string };
        }>;
      };
    };

    expect(spawnSubAgentSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        scopeProfile: "research",
        allowedSkillIds: ["core-grep", "core-read"],
        allowNetwork: false,
        workspaceReadPaths: ["src", "docs"],
        parentRunId: "parent-batch-1",
      })
    );
    expect(spawnSubAgentSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        scopeProfile: "review",
        allowedSkillIds: ["core-edit"],
        allowNetwork: true,
        workspaceReadPaths: ["tests"],
        parentRunId: "parent-task-2",
      })
    );
    expect(response.data.results).toMatchObject([
      {
        taskKey: "defaulted",
        allowedSkillResolution: {
          requestedSkillIds: ["ripgrep", "read_file"],
          resolvedSkillIds: ["core-grep", "core-read"],
          entries: [
            expect.objectContaining({
              requestedSkillId: "ripgrep",
              resolvedSkillId: "core-grep",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining(["core-grep", "grep", "search", "ripgrep"]),
            }),
            expect.objectContaining({
              requestedSkillId: "read_file",
              resolvedSkillId: "core-read",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining(["core-read", "read_file"]),
            }),
          ],
        },
        sessionHandle: {
          sessionId: "session-1",
          checkpointId: "checkpoint-session-1",
        },
      },
      {
        taskKey: "overridden",
        allowedSkillResolution: {
          requestedSkillIds: ["edit_file"],
          resolvedSkillIds: ["core-edit"],
          entries: [
            expect.objectContaining({
              requestedSkillId: "edit_file",
              resolvedSkillId: "core-edit",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining(["core-edit", "edit_file"]),
            }),
          ],
        },
        sessionHandle: {
          sessionId: "session-2",
          checkpointId: "checkpoint-session-2",
        },
      },
    ]);
  });

  it("rejects unknown allowedSkillIds before spawning batch tasks", async () => {
    const spawnSubAgentSession = vi.fn(async () => createSession("session-1"));
    const sendSubAgentInstruction = vi.fn(async () => ({
      session: createSession("session-1"),
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("session-1"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const listLiveSkills = vi.fn(async () => [
      {
        id: "grep",
        name: "Core Grep",
        description: "Search files",
        kind: "file_search",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: [],
      },
    ]);
    const tool = createTool({
      listLiveSkills,
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const response = (await tool.execute(
      {
        allowedSkillIds: ["grep", "unknown-skill"],
        tasks: [{ taskKey: "inspect", instruction: "inspect" }],
      },
      null
    )) as {
      data: {
        summary: { failed: number };
        results: Array<{ error?: string; fatal?: boolean; status: string }>;
      };
    };

    expect(response.data.summary).toMatchObject({ failed: 1 });
    expect(response.data.results[0]).toMatchObject({
      status: "failed",
      fatal: true,
      error: expect.stringMatching(/unknown allowedSkillIds/i),
    });
    expect(listLiveSkills).toHaveBeenCalledTimes(1);
    expect(spawnSubAgentSession).not.toHaveBeenCalled();
  });

  it("resolves runtime-discovered allowedSkillIds aliases across batch tasks", async () => {
    const spawnSubAgentSession = vi.fn(async () => createSession("session-runtime-alias"));
    const sendSubAgentInstruction = vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      session: createSession(sessionId),
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      session: createSession(sessionId),
      task: null,
      done: true,
      timedOut: false,
    }));
    const closeSubAgentSession = vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      closed: true,
      sessionId,
      status: "closed" as const,
      message: "closed",
    }));
    const listLiveSkills = vi.fn(async () => [
      {
        id: "core-grep",
        name: "Core Grep",
        description: "Search files",
        kind: "file_search",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["core", "search"],
        aliases: ["project-search"],
      },
    ]);
    const tool = createTool({
      listTasks: async () => [],
      getTaskStatus: async () => null,
      startTask: async () => {
        throw new Error("not used");
      },
      interruptTask: async () => ({
        accepted: true,
        taskId: "runtime-1",
        status: "interrupted",
        message: "interrupted",
      }),
      submitTaskApprovalDecision: async () => ({
        recorded: true,
        approvalId: "approval-1",
        taskId: "runtime-1",
        status: "running",
        message: "recorded",
      }),
      listLiveSkills,
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
      closeSubAgentSession,
    });

    const response = (await Promise.resolve(
      tool.execute(
        {
          tasks: [
            {
              taskKey: "runtime-alias",
              instruction: "search with runtime alias",
              allowedSkillIds: ["project-search"],
            },
          ],
        },
        null
      )
    )) as { data: { results: Array<Record<string, unknown>> } };

    expect(spawnSubAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedSkillIds: ["core-grep"],
      })
    );
    expect(response.data.results).toMatchObject([
      {
        taskKey: "runtime-alias",
        allowedSkillResolution: {
          requestedSkillIds: ["project-search"],
          resolvedSkillIds: ["core-grep"],
          entries: [
            expect.objectContaining({
              requestedSkillId: "project-search",
              resolvedSkillId: "core-grep",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining(["core-grep", "project-search"]),
            }),
          ],
        },
      },
    ]);
  });

  it("uses agent metadata fallback for batch default provider-model and keeps explicit inputs highest priority", async () => {
    const spawnSubAgentSession = vi.fn(async () => createSession("session-ambient"));
    const sendSubAgentInstruction = vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      session: createSession(sessionId),
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      session: createSession(sessionId),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    await Promise.resolve(
      tool.execute(
        {
          idempotencyKey: "ambient-provider-model-1",
          tasks: [
            {
              taskKey: "ambient",
              instruction: "use ambient provider context",
            },
          ],
        },
        {
          context: {
            provider: " openai ",
            model_id: " gpt-5.3-codex ",
          },
        }
      )
    );
    expect(spawnSubAgentSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        provider: "openai",
        modelId: "gpt-5.3-codex",
      })
    );

    await Promise.resolve(
      tool.execute(
        {
          idempotencyKey: "ambient-provider-model-2",
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
          tasks: [
            {
              taskKey: "explicit",
              instruction: "explicit provider-model should win",
            },
          ],
        },
        {
          provider: "openai",
          modelId: "gpt-5.3-codex",
        }
      )
    );
    expect(spawnSubAgentSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        provider: "anthropic",
        modelId: "claude-3-7-sonnet",
      })
    );
  });

  it("retries a failed task up to maxRetries", async () => {
    let sendAttempts = 0;
    let sessionCounter = 0;
    const spawnSubAgentSession = vi.fn(async () => createSession(`session-${++sessionCounter}`));
    const sendSubAgentInstruction = vi.fn(
      async (_input: { instruction: string; requestId?: string }) => {
        sendAttempts += 1;
        if (sendAttempts === 1) {
          throw new Error("transient failure");
        }
        return { session: createSession("unused"), task: null };
      }
    );
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const response = (await tool.execute(
      {
        tasks: [{ taskKey: "retry-task", instruction: "retry-task", maxRetries: 1 }],
      },
      null
    )) as { data: { summary: Record<string, number>; results: Array<{ retried: number }> } };

    expect(sendSubAgentInstruction).toHaveBeenCalledTimes(2);
    expect(response.data.summary).toMatchObject({
      total: 1,
      succeeded: 1,
      failed: 0,
      retried: 1,
    });
    expect(response.data.results[0]?.retried).toBe(1);
    const firstPayload = sendSubAgentInstruction.mock.calls[0]?.[0] as
      | { requestId?: unknown }
      | undefined;
    const secondPayload = sendSubAgentInstruction.mock.calls[1]?.[0] as
      | { requestId?: unknown }
      | undefined;
    expect(typeof firstPayload?.requestId).toBe("string");
    expect(typeof secondPayload?.requestId).toBe("string");
    expect(firstPayload?.requestId).not.toBe(secondPayload?.requestId);
  });

  it("stops scheduling remaining tasks when a stop policy task fails", async () => {
    let sessionCounter = 0;
    const spawnSubAgentSession = vi.fn(async () => createSession(`session-${++sessionCounter}`));
    const sendSubAgentInstruction = vi.fn(async (input: { instruction: string }) => {
      if (input.instruction === "fail-first") {
        throw new Error("fail-first");
      }
      return { session: createSession("unused"), task: null };
    });
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const response = (await tool.execute(
      {
        executionMode: "sequential",
        tasks: [
          { taskKey: "first", instruction: "fail-first", onFailure: "stop" },
          { taskKey: "second", instruction: "second" },
          { taskKey: "third", instruction: "third" },
        ],
      },
      null
    )) as { data: { summary: Record<string, number> } };

    expect(spawnSubAgentSession).toHaveBeenCalledTimes(1);
    expect(response.data.summary).toMatchObject({
      total: 3,
      succeeded: 0,
      failed: 1,
      skipped: 2,
    });
  });

  it("continues scheduling remaining tasks when a continue policy task fails", async () => {
    let sessionCounter = 0;
    const spawnSubAgentSession = vi.fn(async () => createSession(`session-${++sessionCounter}`));
    const sendSubAgentInstruction = vi.fn(async (input: { instruction: string }) => {
      if (input.instruction === "fail-first") {
        throw new Error("fail-first");
      }
      return { session: createSession("unused"), task: null };
    });
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const response = (await tool.execute(
      {
        executionMode: "sequential",
        tasks: [
          { taskKey: "first", instruction: "fail-first", onFailure: "continue" },
          { taskKey: "second", instruction: "second" },
        ],
      },
      null
    )) as { data: { summary: Record<string, number> } };

    expect(spawnSubAgentSession).toHaveBeenCalledTimes(2);
    expect(response.data.summary).toMatchObject({
      total: 2,
      succeeded: 1,
      failed: 1,
      skipped: 0,
    });
  });

  it("fails on cycle validation before spawning any sub-agent session", async () => {
    const spawnSubAgentSession = vi.fn(async () => createSession("session-1"));
    const sendSubAgentInstruction = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    await expect(
      Promise.resolve(
        tool.execute(
          {
            tasks: [
              { taskKey: "a", instruction: "a", dependsOn: ["b"] },
              { taskKey: "b", instruction: "b", dependsOn: ["a"] },
            ],
          },
          null
        )
      )
    ).rejects.toThrow(/cycle/i);

    expect(spawnSubAgentSession).not.toHaveBeenCalled();
  });

  it("resumes completed tasks from journal when idempotency key and resume marker match", async () => {
    let sessionCounter = 0;
    const spawnSubAgentSession = vi.fn(async () => createSession(`session-${++sessionCounter}`));
    const sendSubAgentInstruction = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const first = (await tool.execute(
      {
        idempotencyKey: "same-key",
        tasks: [{ taskKey: "build", instruction: "build" }],
      },
      null
    )) as {
      data: {
        batchRunId: string;
        summary: { resumed: number; succeeded: number };
      };
    };

    const second = (await tool.execute(
      {
        idempotencyKey: "same-key",
        resumeFromBatchRunId: first.data.batchRunId,
        tasks: [{ taskKey: "build", instruction: "build" }],
      },
      null
    )) as {
      data: {
        summary: { resumed: number; succeeded: number };
      };
    };

    expect(sendSubAgentInstruction).toHaveBeenCalledTimes(1);
    expect(second.data.summary).toMatchObject({
      succeeded: 1,
      resumed: 1,
    });
  });

  it("treats fatal failures as stop-priority even when task policy is continue", async () => {
    let sessionCounter = 0;
    const spawnSubAgentSession = vi.fn(async () => createSession(`session-${++sessionCounter}`));
    const sendSubAgentInstruction = vi.fn(async (input: { instruction: string }) => {
      if (input.instruction === "first") {
        const error = new Error("input invalid");
        (error as Error & { code?: string }).code = "runtime.validation.input.invalid";
        throw error;
      }
      return { session: createSession("unused"), task: null };
    });
    const waitSubAgentSession = vi.fn(async () => ({
      session: createSession("unused"),
      task: null,
      done: true,
      timedOut: false,
    }));
    const tool = createTool({
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
    });

    const response = (await tool.execute(
      {
        executionMode: "sequential",
        tasks: [
          { taskKey: "first", instruction: "first", onFailure: "continue", maxRetries: 2 },
          { taskKey: "second", instruction: "second" },
        ],
      },
      null
    )) as {
      data: {
        summary: Record<string, number>;
        results: Array<{ taskKey: string; status: string; fatal?: boolean }>;
      };
    };

    expect(sendSubAgentInstruction).toHaveBeenCalledTimes(1);
    expect(response.data.summary).toMatchObject({
      failed: 1,
      skipped: 1,
    });
    expect(response.data.results.find((item) => item.taskKey === "first")).toMatchObject({
      status: "failed",
      fatal: true,
    });
  });
});

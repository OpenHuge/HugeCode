import { describe, expect, it, vi } from "vitest";
import type {
  InvocationDescriptor,
  LiveSkillExecutionResult,
  PromptLibraryEntry,
  RuntimeExtensionToolInvokeResponse,
  RuntimeRunStartV2Response,
} from "@ku0/code-runtime-host-contract";
import { createRuntimeInvocationExecuteFacade } from "./runtimeInvocationExecute";

function createInvocationDescriptor(
  overrides: Partial<InvocationDescriptor>
): InvocationDescriptor {
  return {
    id: "tool:start-runtime-run",
    title: "Start Runtime Run",
    summary: "Launch a runtime-owned run.",
    description: "Launch a runtime-owned run.",
    kind: "runtime_tool",
    source: {
      kind: "runtime_tool",
      contributionType: "built_in",
      authority: "runtime",
      label: "Runtime tool catalog",
      sourceId: "start-runtime-run",
      workspaceId: "ws-1",
      provenance: null,
    },
    runtimeTool: {
      toolName: "start-runtime-run",
      scope: "runtime",
      inputSchema: null,
      description: "Launch a runtime-owned run.",
      promptDescription: null,
    },
    argumentSchema: null,
    aliases: [],
    tags: [],
    safety: {
      level: "write",
      readOnly: false,
      destructive: false,
      openWorld: false,
      idempotent: false,
    },
    exposure: {
      operatorVisible: true,
      modelVisible: true,
      requiresReadiness: true,
      hiddenReason: null,
    },
    readiness: {
      state: "ready",
      available: true,
      reason: null,
      warnings: [],
      checkedAt: null,
    },
    metadata: null,
    ...overrides,
  };
}

function createPromptEntry(overrides: Partial<PromptLibraryEntry> = {}): PromptLibraryEntry {
  return {
    id: "prompt.summarize",
    title: "summarize",
    description: "Summarize a target",
    content: "Summarize $TARGET",
    scope: "workspace",
    ...overrides,
  };
}

describe("runtimeInvocationExecute", () => {
  it("starts runtime runs for the built-in start-runtime-run invocation", async () => {
    const startRuntimeRun = vi.fn(
      async (): Promise<RuntimeRunStartV2Response> =>
        ({
          run: {
            taskId: "run-1",
            workspaceId: "ws-1",
            threadId: "thread-1",
            requestId: null,
            title: "Review the PR",
            status: "queued",
            accessMode: "on-request",
            currentStep: null,
            createdAt: 1,
            updatedAt: 1,
            startedAt: null,
            completedAt: null,
            errorCode: null,
            errorMessage: null,
            pendingApprovalId: null,
          },
          missionRun: {} as never,
          reviewPack: null,
        }) satisfies RuntimeRunStartV2Response
    );
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        getInvocationDescriptor: vi.fn(async () => createInvocationDescriptor({})),
      },
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun,
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => []),
    });

    const result = await facade.invoke({
      invocationId: "tool:start-runtime-run",
      arguments: {
        title: "Review the PR",
        steps: [],
      },
      context: {
        threadId: "thread-1",
      },
    });

    expect(startRuntimeRun).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-1",
      title: "Review the PR",
      steps: [],
    });
    expect(result).toMatchObject({
      invocationId: "tool:start-runtime-run",
      kind: "runtime_run_started",
      ok: true,
      message: null,
    });
  });

  it("runs runtime live skills for the built-in run-runtime-live-skill invocation", async () => {
    const execution = {
      runId: "skill-run-1",
      skillId: "review-agent",
      output: "done",
      metadata: {},
    } satisfies LiveSkillExecutionResult;
    const runRuntimeLiveSkill = vi.fn(async () => execution);
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        getInvocationDescriptor: vi.fn(async () =>
          createInvocationDescriptor({
            id: "tool:run-runtime-live-skill",
            title: "Run Runtime Live Skill",
            runtimeTool: {
              toolName: "run-runtime-live-skill",
              scope: "runtime",
              inputSchema: null,
              description: "Execute a runtime live skill.",
              promptDescription: null,
            },
            source: {
              kind: "runtime_tool",
              contributionType: "built_in",
              authority: "runtime",
              label: "Runtime tool catalog",
              sourceId: "run-runtime-live-skill",
              workspaceId: "ws-1",
              provenance: null,
            },
          })
        ),
      },
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(),
      runRuntimeLiveSkill,
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => []),
    });

    const result = await facade.invoke({
      invocationId: "tool:run-runtime-live-skill",
      arguments: {
        skillId: "review-agent",
        input: "review this change",
      },
    });

    expect(runRuntimeLiveSkill).toHaveBeenCalledWith({
      skillId: "review-agent",
      input: "review this change",
      options: {
        workspaceId: "ws-1",
      },
    });
    expect(result).toMatchObject({
      invocationId: "tool:run-runtime-live-skill",
      kind: "live_skill_executed",
      ok: true,
      payload: execution,
    });
  });

  it("sends session messages through the session command facade", async () => {
    const sendMessage = vi.fn(async () => ({
      result: {
        accepted: true,
        threadId: "thread-1",
      },
    }));
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        getInvocationDescriptor: vi.fn(async () =>
          createInvocationDescriptor({
            id: "session:send-message",
            title: "Send Session Message",
            kind: "session_command",
            source: {
              kind: "session_command",
              contributionType: "session_scoped",
              authority: "session",
              label: "Runtime session commands",
              sourceId: "session:send-message",
              workspaceId: "ws-1",
              provenance: null,
            },
            runtimeTool: null,
            exposure: {
              operatorVisible: true,
              modelVisible: false,
              requiresReadiness: false,
              hiddenReason: null,
            },
          })
        ),
      },
      sessionCommands: {
        sendMessage,
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(),
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => []),
    });

    const result = await facade.invoke({
      invocationId: "session:send-message",
      arguments: {
        text: "hello runtime",
      },
      context: {
        threadId: "thread-1",
      },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      threadId: "thread-1",
      text: "hello runtime",
      options: {
        telemetrySource: "runtime_invocation_execute",
      },
    });
    expect(result).toMatchObject({
      invocationId: "session:send-message",
      kind: "session_message_sent",
      ok: true,
    });
  });

  it("invokes runtime extension tools through the dedicated bridge", async () => {
    const invokeRuntimeExtensionTool = vi.fn(
      async (): Promise<RuntimeExtensionToolInvokeResponse> => ({
        ok: true,
        hits: 3,
      })
    );
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        getInvocationDescriptor: vi.fn(async () =>
          createInvocationDescriptor({
            id: "tool:ext.review.search",
            title: "ext.review.search",
            runtimeTool: {
              toolName: "ext.review.search",
              scope: "runtime",
              inputSchema: null,
              description: "Search extension data.",
              promptDescription: null,
            },
            source: {
              kind: "runtime_extension",
              contributionType: "extension_contributed",
              authority: "runtime",
              label: "Runtime extension tools",
              sourceId: "ext.review",
              workspaceId: "ws-1",
              provenance: null,
            },
            metadata: {
              extensionId: "ext.review",
            },
          })
        ),
      },
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(),
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool,
      listRuntimePrompts: vi.fn(async () => []),
    });

    const result = await facade.invoke({
      invocationId: "tool:ext.review.search",
      arguments: {
        query: "catalog",
      },
    });

    expect(invokeRuntimeExtensionTool).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext.review",
      toolName: "ext.review.search",
      input: {
        query: "catalog",
      },
    });
    expect(result).toMatchObject({
      invocationId: "tool:ext.review.search",
      kind: "extension_tool_executed",
      ok: true,
      payload: {
        ok: true,
        hits: 3,
      },
    });
  });

  it("resolves prompt overlays into compose patches without sending a turn", async () => {
    const sendMessage = vi.fn();
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        getInvocationDescriptor: vi.fn(async () =>
          createInvocationDescriptor({
            id: "session:prompt:prompt.summarize",
            title: "summarize",
            kind: "session_command",
            source: {
              kind: "session_command",
              contributionType: "session_scoped",
              authority: "workspace",
              label: "Runtime prompt library",
              sourceId: "prompt.summarize",
              workspaceId: "ws-1",
              provenance: null,
            },
            runtimeTool: null,
            exposure: {
              operatorVisible: true,
              modelVisible: false,
              requiresReadiness: false,
              hiddenReason: null,
            },
            metadata: {
              promptOverlay: {
                promptId: "prompt.summarize",
                scope: "workspace",
              },
              slashCommand: {
                primaryTrigger: "/summarize",
                insertText: 'summarize TARGET=""',
                cursorOffset: 18,
                shadowedByBuiltin: false,
              },
            },
          })
        ),
      },
      sessionCommands: {
        sendMessage,
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(),
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => [createPromptEntry()]),
    });

    const result = await facade.invoke({
      invocationId: "session:prompt:prompt.summarize",
      arguments: {
        TARGET: "the diff",
      },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      invocationId: "session:prompt:prompt.summarize",
      kind: "compose_patch_resolved",
      ok: true,
      payload: {
        text: "Summarize the diff",
        cursorOffset: 18,
        promptId: "prompt.summarize",
        scope: "workspace",
      },
    });
  });

  it("blocks operator-hidden execution and rejects unsupported invocation kinds", async () => {
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        getInvocationDescriptor: vi
          .fn()
          .mockResolvedValueOnce(
            createInvocationDescriptor({
              id: "session:send-message",
              kind: "session_command",
              source: {
                kind: "session_command",
                contributionType: "session_scoped",
                authority: "session",
                label: "Runtime session commands",
                sourceId: "session:send-message",
                workspaceId: "ws-1",
                provenance: null,
              },
              runtimeTool: null,
              exposure: {
                operatorVisible: true,
                modelVisible: false,
                requiresReadiness: false,
                hiddenReason: "operator only",
              },
            })
          )
          .mockResolvedValueOnce(
            createInvocationDescriptor({
              id: "plugin:review-agent",
              kind: "plugin",
              source: {
                kind: "live_skill",
                contributionType: "skill_derived",
                authority: "runtime",
                label: "Runtime live skills",
                sourceId: "review-agent",
                workspaceId: "ws-1",
                provenance: null,
              },
              runtimeTool: null,
            })
          ),
      },
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(),
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => []),
    });

    await expect(
      facade.invoke({
        invocationId: "session:send-message",
        caller: "model",
      })
    ).resolves.toMatchObject({
      kind: "blocked",
      ok: false,
    });

    await expect(
      facade.invoke({
        invocationId: "plugin:review-agent",
      })
    ).resolves.toMatchObject({
      kind: "unsupported",
      ok: false,
    });
  });
});

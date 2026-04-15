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

function createInvocationPlaneMock(overrides?: {
  listHosts?: ReturnType<typeof vi.fn>;
  dispatch?: ReturnType<typeof vi.fn>;
}) {
  return {
    listHosts:
      overrides?.listHosts ??
      vi.fn(async () => ({
        registryVersion: "registry-v1",
        workspaceId: "ws-1",
        generatedAt: 1,
        hosts: [
          {
            hostId: "runtime:built-in-tools",
            category: "built_in_runtime_tool",
            label: "Built-in runtime tools",
            summary: "Canonical runtime tool host.",
            authority: "runtime",
            dispatchMode: "execute",
            readiness: {
              state: "ready",
              available: true,
              reason: null,
              checkedAt: 1,
            },
            requirementKeys: ["runtime_service"],
            dispatchMethods: ["runtime_invocation_dispatch_v1"],
            provenance: {
              source: "runtime_host_registry",
              registryVersion: "registry-v1",
              workspaceId: "ws-1",
            },
          },
          {
            hostId: "runtime:workspace-skills",
            category: "workspace_skill",
            label: "Workspace skills",
            summary: "Canonical workspace skill host.",
            authority: "workspace",
            dispatchMode: "execute",
            readiness: {
              state: "ready",
              available: true,
              reason: null,
              checkedAt: 1,
            },
            requirementKeys: ["runtime_service"],
            dispatchMethods: ["runtime_invocation_dispatch_v1"],
            provenance: {
              source: "runtime_host_registry",
              registryVersion: "registry-v1",
              workspaceId: "ws-1",
            },
          },
          {
            hostId: "runtime:extensions",
            category: "runtime_extension_tool",
            label: "Runtime extensions",
            summary: "Canonical runtime extension host.",
            authority: "runtime",
            dispatchMode: "execute",
            readiness: {
              state: "ready",
              available: true,
              reason: null,
              checkedAt: 1,
            },
            requirementKeys: ["runtime_service", "extension_bridge"],
            dispatchMethods: ["runtime_invocation_dispatch_v1"],
            provenance: {
              source: "runtime_host_registry",
              registryVersion: "registry-v1",
              workspaceId: "ws-1",
            },
          },
        ],
        summary: {
          total: 3,
          executable: 3,
          resolveOnly: 0,
          reserved: 0,
          unsupported: 0,
          ready: 3,
          attention: 0,
          blocked: 0,
        },
      })),
    dispatch:
      overrides?.dispatch ??
      vi.fn(async (request: { invocationId: string }) => ({
        invocationId: request.invocationId,
        status: "accepted",
        summary: "Runtime dispatch accepted.",
        preflight: {
          state: "ready",
          reason: null,
          hostId: "runtime:built-in-tools",
        },
        provenance: {
          invocationId: request.invocationId,
          hostId: "runtime:built-in-tools",
          category: "built_in_runtime_tool",
          source: "runtime_host_registry",
          registryVersion: "registry-v1",
          workspaceId: "ws-1",
          caller: "operator",
        },
        postExecution: {
          applied: false,
          summary: "No post-execution shaping applied.",
          metadata: null,
        },
      })),
  } as never;
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
        resolveInvocationDescriptor: vi.fn(async () => createInvocationDescriptor({})),
      },
      invocationPlane: createInvocationPlaneMock(),
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
      evidence: {
        binding: {
          kind: "runtime_run",
          host: "runtime",
        },
        outcome: {
          status: "executed",
        },
      },
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
        resolveInvocationDescriptor: vi.fn(async () =>
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
      invocationPlane: createInvocationPlaneMock(),
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
      evidence: {
        binding: {
          kind: "runtime_live_skill",
        },
        outcome: {
          status: "executed",
        },
      },
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
        resolveInvocationDescriptor: vi.fn(async () =>
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
      invocationPlane: createInvocationPlaneMock(),
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
        resolveInvocationDescriptor: vi.fn(async () =>
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
      invocationPlane: createInvocationPlaneMock(),
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
    const listRuntimePrompts = vi
      .fn()
      .mockImplementation(async (workspaceId?: string | null) =>
        workspaceId === null ? [createPromptEntry({ scope: "global" })] : []
      );
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        resolveInvocationDescriptor: vi.fn(async () =>
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
      invocationPlane: createInvocationPlaneMock(),
      sessionCommands: {
        sendMessage,
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(),
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts,
    });

    const result = await facade.invoke({
      invocationId: "session:prompt:prompt.summarize",
      arguments: {
        TARGET: "the diff",
      },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(listRuntimePrompts).toHaveBeenCalledTimes(2);
    expect(listRuntimePrompts).toHaveBeenNthCalledWith(1, "ws-1");
    expect(listRuntimePrompts).toHaveBeenNthCalledWith(2, null);
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
      evidence: {
        binding: {
          kind: "prompt_overlay",
          host: "workspace",
          promptId: "prompt.summarize",
        },
        outcome: {
          status: "resolved",
        },
      },
    });
  });

  it("ignores escaped placeholders when resolving prompt overlay arguments", async () => {
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        resolveInvocationDescriptor: vi.fn(async () =>
          createInvocationDescriptor({
            id: "session:prompt:prompt.literal",
            title: "literal",
            kind: "session_command",
            source: {
              kind: "session_command",
              contributionType: "session_scoped",
              authority: "workspace",
              label: "Runtime prompt library",
              sourceId: "prompt.literal",
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
                promptId: "prompt.literal",
                scope: "workspace",
              },
              slashCommand: {
                primaryTrigger: "/literal",
                insertText: 'literal FOCUS=""',
                shadowedByBuiltin: false,
              },
            },
          })
        ),
      },
      invocationPlane: createInvocationPlaneMock(),
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(),
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => [
        createPromptEntry({
          id: "prompt.literal",
          title: "literal",
          content: "Literal $$TARGET and $FOCUS",
        }),
      ]),
    });

    const result = await facade.invoke({
      invocationId: "session:prompt:prompt.literal",
      arguments: {
        FOCUS: "the diff",
      },
    });

    expect(result).toMatchObject({
      invocationId: "session:prompt:prompt.literal",
      kind: "compose_patch_resolved",
      ok: true,
      payload: {
        text: "Literal $$TARGET and the diff",
      },
    });
  });

  it("blocks operator-hidden execution and rejects unsupported invocation kinds", async () => {
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        resolveInvocationDescriptor: vi
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
      invocationPlane: createInvocationPlaneMock(),
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
      message: "operator only",
      evidence: {
        binding: {
          kind: "session_message",
        },
        outcome: {
          status: "blocked",
        },
      },
    });

    await expect(
      facade.invoke({
        invocationId: "plugin:review-agent",
      })
    ).resolves.toMatchObject({
      kind: "unsupported",
      ok: false,
      evidence: {
        binding: {
          kind: "unsupported",
        },
        outcome: {
          status: "unsupported",
        },
      },
    });
  });

  it("surfaces runtime dispatch blocking reasons before local executors run", async () => {
    const startRuntimeRun = vi.fn();
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        resolveInvocationDescriptor: vi.fn(async () => createInvocationDescriptor({})),
      },
      invocationPlane: createInvocationPlaneMock({
        dispatch: vi.fn(async () => ({
          invocationId: "tool:start-runtime-run",
          status: "blocked",
          summary: "Runtime dispatch blocked the invocation.",
          preflight: {
            state: "blocked",
            reason: "Approval required by runtime policy.",
            hostId: "runtime:built-in-tools",
          },
          provenance: {
            invocationId: "tool:start-runtime-run",
            hostId: "runtime:built-in-tools",
            category: "built_in_runtime_tool",
            source: "runtime_host_registry",
            registryVersion: "registry-v1",
            workspaceId: "ws-1",
            caller: "operator",
          },
          postExecution: {
            applied: false,
            summary: "No post-execution shaping applied.",
            metadata: null,
          },
        })),
      }),
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun,
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => []),
    });

    await expect(
      facade.invoke({
        invocationId: "tool:start-runtime-run",
      })
    ).resolves.toMatchObject({
      invocationId: "tool:start-runtime-run",
      kind: "blocked",
      ok: false,
      message: "Runtime dispatch blocked the invocation.",
      evidence: {
        placementRationale: {
          reason: "Approval required by runtime policy.",
        },
      },
    });
    expect(startRuntimeRun).not.toHaveBeenCalled();
  });

  it("does not fall back to local execution when runtime dispatch stays non-executable", async () => {
    const startRuntimeRun = vi.fn();
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        resolveInvocationDescriptor: vi.fn(async () => createInvocationDescriptor({})),
      },
      invocationPlane: createInvocationPlaneMock({
        listHosts: vi.fn(async () => ({
          registryVersion: "registry-v1",
          workspaceId: "ws-1",
          generatedAt: 1,
          hosts: [
            {
              hostId: "runtime:reserved-rpc",
              category: "built_in_runtime_tool",
              label: "Reserved RPC host",
              summary: "Reserved host.",
              authority: "runtime",
              dispatchMode: "reserved",
              readiness: {
                state: "unsupported",
                available: false,
                reason: "Reserved for future runtime dispatch.",
                checkedAt: 1,
              },
              requirementKeys: ["runtime_service"],
              dispatchMethods: [],
              provenance: {
                source: "runtime_host_registry",
                registryVersion: "registry-v1",
                workspaceId: "ws-1",
              },
            },
          ],
          summary: {
            total: 1,
            executable: 0,
            resolveOnly: 0,
            reserved: 1,
            unsupported: 0,
            ready: 0,
            attention: 0,
            blocked: 0,
          },
        })),
        dispatch: vi.fn(async () => ({
          invocationId: "tool:start-runtime-run",
          status: "unsupported",
          summary: "Runtime invocation host is reserved and not executable in this phase.",
          preflight: {
            state: "blocked",
            reason: "Runtime invocation host is reserved and not executable in this phase.",
            hostId: "runtime:reserved-rpc",
          },
          provenance: {
            invocationId: "tool:start-runtime-run",
            hostId: "runtime:reserved-rpc",
            category: "built_in_runtime_tool",
            source: "runtime_host_registry",
            registryVersion: "registry-v1",
            workspaceId: "ws-1",
            caller: "operator",
          },
          postExecution: {
            applied: false,
            summary: "No post-execution shaping applied.",
            metadata: null,
          },
        })),
      }),
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun,
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(),
      listRuntimePrompts: vi.fn(async () => []),
    });

    await expect(
      facade.invoke({
        invocationId: "tool:start-runtime-run",
      })
    ).resolves.toMatchObject({
      invocationId: "tool:start-runtime-run",
      kind: "unsupported",
      ok: false,
      message: "Runtime invocation host is reserved and not executable in this phase.",
    });
    expect(startRuntimeRun).not.toHaveBeenCalled();
  });

  it("normalizes downstream execution failures into blocked results", async () => {
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        resolveInvocationDescriptor: vi
          .fn()
          .mockResolvedValueOnce(createInvocationDescriptor({}))
          .mockResolvedValueOnce(
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
      invocationPlane: createInvocationPlaneMock(),
      sessionCommands: {
        sendMessage: vi.fn(),
        respondToApproval: vi.fn(),
      } as never,
      startRuntimeRun: vi.fn(async () => {
        throw new Error("runtime unavailable");
      }),
      runRuntimeLiveSkill: vi.fn(),
      invokeRuntimeExtensionTool: vi.fn(async () => {
        throw { message: "extension bridge offline" };
      }),
      listRuntimePrompts: vi.fn(async () => []),
    });

    await expect(
      facade.invoke({
        invocationId: "tool:start-runtime-run",
      })
    ).resolves.toMatchObject({
      invocationId: "tool:start-runtime-run",
      kind: "blocked",
      ok: false,
      message: "Invocation `tool:start-runtime-run` failed: runtime unavailable",
      evidence: {
        binding: {
          kind: "runtime_run",
        },
        outcome: {
          status: "blocked",
        },
      },
    });

    await expect(
      facade.invoke({
        invocationId: "tool:ext.review.search",
      })
    ).resolves.toMatchObject({
      invocationId: "tool:ext.review.search",
      kind: "blocked",
      ok: false,
      message: "Invocation `tool:ext.review.search` failed: extension bridge offline",
    });
  });

  it("normalizes catalog lookup failures into blocked results", async () => {
    const facade = createRuntimeInvocationExecuteFacade({
      workspaceId: "ws-1",
      invocationCatalog: {
        resolveInvocationDescriptor: vi.fn(async () => {
          throw new Error("catalog unavailable");
        }),
      },
      invocationPlane: createInvocationPlaneMock(),
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
        invocationId: "tool:start-runtime-run",
      })
    ).resolves.toMatchObject({
      invocationId: "tool:start-runtime-run",
      kind: "blocked",
      ok: false,
      message: "Invocation `tool:start-runtime-run` failed: catalog unavailable",
    });
  });
});

import { describe, expect, it } from "vitest";
import type {
  InvocationDescriptor,
  RuntimeInvocationDispatchResponse,
  RuntimeInvocationHostDescriptor,
  RuntimeInvocationHostRegistry,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeInvocationDispatchOutcome,
  classifyRuntimeInvocationFallback,
  reconcileRuntimeInvocationDescriptorReadiness,
  resolveRuntimeInvocationHostSelectionSummary,
  resolveRuntimeInvocationPlaneFacade,
  summarizeRuntimeInvocationDispatchProvenance,
} from "./runtimeInvocationPlaneFacade";

function createDescriptor(overrides: Partial<InvocationDescriptor> = {}): InvocationDescriptor {
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
      checkedAt: 10,
    },
    execution: null,
    metadata: null,
    ...overrides,
  };
}

function createHost(
  overrides: Partial<RuntimeInvocationHostDescriptor>
): RuntimeInvocationHostDescriptor {
  return {
    hostId: "runtime:built-in-tools",
    category: "built_in_runtime_tool",
    label: "Runtime built-in tools",
    summary: "Canonical runtime dispatch for built-in tools.",
    authority: "runtime",
    dispatchMode: "execute",
    readiness: {
      state: "ready",
      available: true,
      reason: null,
      checkedAt: 25,
    },
    requirementKeys: ["runtime_service"],
    dispatchMethods: ["code_runtime_invocation_dispatch_v1"],
    provenance: {
      source: "runtime_host_registry",
      registryVersion: "registry-v1",
      workspaceId: "ws-1",
    },
    ...overrides,
  };
}

function createRegistry(hosts: RuntimeInvocationHostDescriptor[]): RuntimeInvocationHostRegistry {
  return {
    registryVersion: "registry-v1",
    workspaceId: "ws-1",
    generatedAt: 50,
    hosts,
    summary: {
      total: hosts.length,
      executable: hosts.filter((host) => host.dispatchMode === "execute").length,
      resolveOnly: hosts.filter((host) => host.dispatchMode === "resolve_only").length,
      reserved: hosts.filter((host) => host.dispatchMode === "reserved").length,
      unsupported: hosts.filter((host) => host.dispatchMode === "unsupported").length,
      ready: hosts.filter((host) => host.readiness.state === "ready").length,
      attention: hosts.filter((host) => host.readiness.state === "attention").length,
      blocked: hosts.filter((host) => host.readiness.state === "blocked").length,
    },
  };
}

function createDispatchResponse(
  overrides: Partial<RuntimeInvocationDispatchResponse> = {}
): RuntimeInvocationDispatchResponse {
  return {
    invocationId: "tool:start-runtime-run",
    status: "accepted",
    summary: "Runtime dispatch accepted.",
    preflight: {
      state: "ready",
      reason: null,
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
    ...overrides,
  };
}

describe("runtimeInvocationPlaneFacade", () => {
  it("selects the canonical runtime host for runtime-run invocations", () => {
    const descriptor = createDescriptor();
    const registry = createRegistry([createHost({ hostId: "runtime:built-in-tools" })]);
    const selection = resolveRuntimeInvocationHostSelectionSummary({
      descriptor,
      runtimeHostRegistry: registry,
    });

    expect(selection).toMatchObject({
      candidateCategories: ["built_in_runtime_tool"],
      dispatchMode: "execute",
      selectedHost: {
        hostId: "runtime:built-in-tools",
        category: "built_in_runtime_tool",
      },
    });
    expect(classifyRuntimeInvocationFallback({ descriptor, hostSelectionSummary: selection })).toBe(
      "runtime-canonical"
    );
  });

  it("maps live-skill invocations to workspace-skill hosts", () => {
    const descriptor = createDescriptor({
      id: "tool:run-runtime-live-skill",
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
    });
    const registry = createRegistry([
      createHost({
        hostId: "runtime:workspace-skills",
        category: "workspace_skill",
        label: "Workspace skills",
      }),
    ]);

    const result = resolveRuntimeInvocationPlaneFacade({
      descriptor,
      runtimeHostRegistry: registry,
    });

    expect(result.hostSelection.selectedHost).toMatchObject({
      hostId: "runtime:workspace-skills",
      category: "workspace_skill",
    });
    expect(result.fallbackClassification).toBe("runtime-canonical");
  });

  it("maps runtime extension tool invocations to extension hosts", () => {
    const descriptor = createDescriptor({
      id: "tool:ext.review.search",
      title: "ext.review.search",
      source: {
        kind: "runtime_extension",
        contributionType: "extension_contributed",
        authority: "runtime",
        label: "Runtime extension tools",
        sourceId: "ext.review",
        workspaceId: "ws-1",
        provenance: null,
      },
      runtimeTool: {
        toolName: "ext.review.search",
        scope: "runtime",
        inputSchema: null,
        description: "Search review artifacts.",
        promptDescription: null,
      },
      metadata: {
        extensionId: "ext.review",
      },
    });
    const registry = createRegistry([
      createHost({
        hostId: "runtime:extensions",
        category: "runtime_extension_tool",
        label: "Runtime extensions",
        requirementKeys: ["runtime_service", "extension_bridge"],
      }),
    ]);

    const result = resolveRuntimeInvocationPlaneFacade({
      descriptor,
      runtimeHostRegistry: registry,
    });

    expect(result.hostSelection.selectedHost).toMatchObject({
      hostId: "runtime:extensions",
      category: "runtime_extension_tool",
    });
  });

  it("preserves prompt-overlay resolve-only behavior", () => {
    const descriptor = createDescriptor({
      id: "session:prompt:prompt.summarize",
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
      },
    });
    const registry = createRegistry([
      createHost({
        hostId: "workspace:prompt-overlays",
        category: "prompt_overlay",
        authority: "workspace",
        dispatchMode: "resolve_only",
        label: "Prompt overlays",
      }),
    ]);
    const dispatch = createDispatchResponse({
      invocationId: descriptor.id,
      status: "resolved",
      summary: "Prompt overlay resolved into compose text.",
      preflight: {
        state: "not_required",
        reason: null,
        hostId: "workspace:prompt-overlays",
      },
      provenance: {
        invocationId: descriptor.id,
        hostId: "workspace:prompt-overlays",
        category: "prompt_overlay",
        source: "runtime_host_registry",
        registryVersion: "registry-v1",
        workspaceId: "ws-1",
        caller: "operator",
      },
    });

    const result = resolveRuntimeInvocationPlaneFacade({
      descriptor,
      runtimeHostRegistry: registry,
      runtimeDispatchResponse: dispatch,
    });

    expect(result.hostSelection).toMatchObject({
      candidateCategories: [],
      candidateHosts: [],
      selectedHost: null,
      dispatchMode: "resolve_only",
    });
    expect(result.hostSelection.summary).toContain("prompt.summarize");
    expect(result.fallbackClassification).toBe("resolve-only");
    expect(result.dispatchProvenance).toMatchObject({
      hostId: "workspace:prompt-overlays",
      category: "prompt_overlay",
    });
    expect(result.outcome).toEqual({
      status: "resolved",
      summary: "Prompt overlay resolved into compose text.",
    });
    expect(result.evidence).toMatchObject({
      outcome: {
        status: "resolved",
      },
      preflight: {
        state: "not_required",
      },
      placementRationale: {
        summary:
          "Resolved through the shared prompt/session facade without runtime host execution.",
      },
    });
  });

  it("treats reserved and unsupported hosts as non-fallback runtime-owned outcomes", () => {
    const descriptor = createDescriptor();
    const registry = createRegistry([
      createHost({
        hostId: "runtime:reserved-rpc",
        category: "built_in_runtime_tool",
        label: "Reserved RPC host",
        dispatchMode: "reserved",
        readiness: {
          state: "unsupported",
          available: false,
          reason: "Reserved for future RPC-backed dispatch.",
          checkedAt: 40,
        },
      }),
    ]);

    const result = resolveRuntimeInvocationPlaneFacade({
      descriptor,
      runtimeHostRegistry: registry,
    });

    expect(result.hostSelection.selectedHost).toMatchObject({
      hostId: "runtime:reserved-rpc",
      dispatchMode: "reserved",
    });
    expect(result.fallbackClassification).toBe("runtime-canonical");
    expect(result.reconciledReadiness).toMatchObject({
      available: false,
      state: "unsupported",
      reason: "Reserved for future RPC-backed dispatch.",
    });
  });

  it("reconciles descriptor readiness against runtime host readiness truth", () => {
    const descriptor = createDescriptor();
    const selection = resolveRuntimeInvocationHostSelectionSummary({
      descriptor,
      runtimeHostRegistry: createRegistry([
        createHost({
          readiness: {
            state: "blocked",
            available: false,
            reason: "Runtime service is offline.",
            checkedAt: 99,
          },
        }),
      ]),
    });

    const readiness = reconcileRuntimeInvocationDescriptorReadiness({
      descriptor,
      hostSelectionSummary: selection,
    });

    expect(readiness).toEqual({
      state: "blocked",
      available: false,
      reason: "Runtime service is offline.",
      warnings: [],
      checkedAt: 99,
    });
  });

  it("reconciles caller precedence from dispatch provenance", () => {
    const descriptor = createDescriptor();
    const registry = createRegistry([createHost({})]);
    const dispatch = createDispatchResponse({
      provenance: {
        invocationId: descriptor.id,
        hostId: "runtime:built-in-tools",
        category: "built_in_runtime_tool",
        source: "runtime_host_registry",
        registryVersion: "registry-v1",
        workspaceId: "ws-1",
        caller: "model",
      },
    });

    const result = resolveRuntimeInvocationPlaneFacade({
      descriptor,
      runtimeHostRegistry: registry,
      runtimeDispatchResponse: dispatch,
      caller: "operator",
    });

    expect(result.caller).toBe("model");
    expect(result.evidence?.caller).toBe("model");
    expect(result.dispatchProvenance?.caller).toBe("model");
  });

  it("reconciles workspaceId precedence from dispatch provenance", () => {
    const descriptor = createDescriptor({
      source: {
        kind: "runtime_tool",
        contributionType: "built_in",
        authority: "runtime",
        label: "Runtime tool catalog",
        sourceId: "start-runtime-run",
        workspaceId: "ws-descriptor",
        provenance: null,
      },
    });
    const registry = createRegistry([
      createHost({
        provenance: {
          source: "runtime_host_registry",
          registryVersion: "registry-v1",
          workspaceId: "ws-registry",
        },
      }),
    ]);
    const dispatch = createDispatchResponse({
      provenance: {
        invocationId: descriptor.id,
        hostId: "runtime:built-in-tools",
        category: "built_in_runtime_tool",
        source: "runtime_host_registry",
        registryVersion: "registry-v1",
        workspaceId: "ws-dispatch",
        caller: "operator",
      },
    });

    const result = resolveRuntimeInvocationPlaneFacade({
      descriptor,
      runtimeHostRegistry: registry,
      runtimeDispatchResponse: dispatch,
      workspaceId: "ws-input",
    });

    expect(result.workspaceId).toBe("ws-dispatch");
    expect(result.dispatchProvenance?.workspaceId).toBe("ws-dispatch");
  });

  it("marks readiness unsupported when final dispatch status is unsupported", () => {
    const descriptor = createDescriptor();
    const registry = createRegistry([createHost({})]);
    const dispatch = createDispatchResponse({
      status: "unsupported",
      summary: "Runtime dispatch does not support this invocation yet.",
      preflight: {
        state: "ready",
        reason: null,
        hostId: "runtime:built-in-tools",
      },
    });

    const result = resolveRuntimeInvocationPlaneFacade({
      descriptor,
      runtimeHostRegistry: registry,
      runtimeDispatchResponse: dispatch,
    });

    expect(result.reconciledReadiness).toMatchObject({
      state: "unsupported",
      available: false,
      reason: "Runtime dispatch does not support this invocation yet.",
    });
    expect(result.outcome).toEqual({
      status: "unsupported",
      summary: "Runtime dispatch does not support this invocation yet.",
    });
    expect(result.evidence).toMatchObject({
      readiness: {
        state: "unsupported",
        available: false,
      },
      preflightOutcome: {
        state: "ready",
        readinessState: "unsupported",
      },
      outcome: {
        status: "unsupported",
      },
    });
  });

  it("summarizes dispatch provenance and builds evidence-compatible outcomes", () => {
    const response = createDispatchResponse({
      status: "accepted",
      summary: "Runtime dispatch accepted.",
      postExecution: {
        applied: true,
        summary: "Review evidence attached.",
        metadata: {
          reviewPackId: "review-1",
        },
      },
    });

    expect(summarizeRuntimeInvocationDispatchProvenance(response)).toEqual({
      invocationId: "tool:start-runtime-run",
      status: "accepted",
      summary: "Runtime dispatch accepted.",
      hostId: "runtime:built-in-tools",
      category: "built_in_runtime_tool",
      registryVersion: "registry-v1",
      workspaceId: "ws-1",
      caller: "operator",
      preflightState: "ready",
      preflightReason: null,
      postExecutionApplied: true,
      postExecutionSummary: "Review evidence attached.",
      postExecutionMetadata: {
        reviewPackId: "review-1",
      },
    });
    expect(buildRuntimeInvocationDispatchOutcome(response)).toEqual({
      status: "executed",
      summary: "Runtime dispatch accepted. Review evidence attached.",
    });
  });
});

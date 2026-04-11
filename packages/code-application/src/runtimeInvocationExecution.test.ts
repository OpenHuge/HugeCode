import { describe, expect, it } from "vitest";
import type { InvocationDescriptor } from "@ku0/code-runtime-host-contract";
import {
  buildInvocationExecutionEvidence,
  buildInvocationExecutionPlan,
  summarizeInvocationExecutionCatalog,
  withInvocationExecutionPlan,
} from "./runtimeInvocationExecution";

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
      checkedAt: null,
    },
    execution: null,
    metadata: null,
    ...overrides,
  };
}

describe("runtimeInvocationExecution", () => {
  it("derives explicit execution plans for runtime extension tools", () => {
    const plan = buildInvocationExecutionPlan(
      createDescriptor({
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
      })
    );

    expect(plan).toMatchObject({
      binding: {
        kind: "runtime_extension_tool",
        host: "runtime",
        extensionId: "ext.review",
        toolName: "ext.review.search",
      },
      preflightOutcome: {
        state: "ready",
        required: true,
        readinessState: "ready",
      },
      preflight: {
        state: "ready",
      },
    });
    expect(plan.hostRequirements.map((entry) => entry.key)).toEqual([
      "runtime_service",
      "extension_bridge",
    ]);
    expect(plan.hostCapabilityRequirements.map((entry) => entry.key)).toEqual([
      "runtime_service",
      "extension_bridge",
    ]);
  });

  it("derives prompt-overlay and session-command plans without readiness gating", () => {
    const promptOverlayPlan = buildInvocationExecutionPlan(
      createDescriptor({
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
      })
    );
    const sessionPlan = buildInvocationExecutionPlan(
      createDescriptor({
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
          hiddenReason: null,
        },
      })
    );

    expect(promptOverlayPlan).toMatchObject({
      binding: {
        kind: "prompt_overlay",
        host: "workspace",
        promptId: "prompt.summarize",
      },
      preflightOutcome: {
        state: "not_required",
        required: false,
        readinessState: "ready",
      },
      preflight: {
        state: "not_required",
      },
    });
    expect(sessionPlan).toMatchObject({
      binding: {
        kind: "session_message",
        host: "session",
      },
      preflight: {
        state: "not_required",
      },
    });
  });

  it("preserves execution plans on descriptors and builds execution evidence", () => {
    const descriptor = withInvocationExecutionPlan(
      createDescriptor({
        id: "tool:run-runtime-live-skill",
        metadata: {
          toolCallIds: ["tool-call-1", "tool-call-2", "tool-call-1"],
        },
        runtimeTool: {
          toolName: "run-runtime-live-skill",
          scope: "runtime",
          inputSchema: null,
          description: "Execute a runtime live skill.",
          promptDescription: null,
        },
      })
    );

    expect(descriptor.execution).toMatchObject({
      binding: {
        kind: "runtime_live_skill",
      },
    });

    const evidence = buildInvocationExecutionEvidence({
      descriptor,
      caller: "operator",
      outcome: {
        status: "executed",
        summary: "Runtime live skill executed through the canonical runtime path.",
      },
    });

    expect(evidence).toMatchObject({
      invocationId: "tool:run-runtime-live-skill",
      caller: "operator",
      binding: {
        kind: "runtime_live_skill",
        host: "runtime",
      },
      invocationProvenance: {
        bindingKind: "runtime_live_skill",
        descriptorKind: "runtime_tool",
        sourceKind: "runtime_tool",
        sourceId: "start-runtime-run",
        sourceAuthority: "runtime",
        executionHost: "runtime",
        toolName: "run-runtime-live-skill",
      },
      placementRationale: {
        summary:
          "Dispatches through the canonical runtime live-skill path so execution remains inside runtime governance.",
        reason: null,
      },
      toolCallIds: ["tool-call-1", "tool-call-2"],
      outcome: {
        status: "executed",
      },
    });
  });

  it("summarizes catalog execution bindings and host requirements", () => {
    const summary = summarizeInvocationExecutionCatalog([
      withInvocationExecutionPlan(createDescriptor()),
      withInvocationExecutionPlan(
        createDescriptor({
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
        })
      ),
      withInvocationExecutionPlan(
        createDescriptor({
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
        })
      ),
    ]);

    expect(summary.bindings).toEqual([
      {
        bindingKind: "runtime_extension_tool",
        host: "runtime",
        count: 1,
        readyCount: 1,
        blockedCount: 0,
        notRequiredCount: 0,
        requirementKeys: ["extension_bridge", "runtime_service"],
      },
      {
        bindingKind: "runtime_run",
        host: "runtime",
        count: 1,
        readyCount: 1,
        blockedCount: 0,
        notRequiredCount: 0,
        requirementKeys: ["runtime_service"],
      },
      {
        bindingKind: "prompt_overlay",
        host: "workspace",
        count: 1,
        readyCount: 0,
        blockedCount: 0,
        notRequiredCount: 1,
        requirementKeys: ["prompt_library"],
      },
    ]);
    expect(summary.requirements).toEqual([
      { key: "extension_bridge", count: 1 },
      { key: "prompt_library", count: 1 },
      { key: "runtime_service", count: 2 },
    ]);
  });
});

import type {
  InvocationDescriptor,
  RuntimeInvocationHostDispatchMode,
  RuntimeInvocationHostRegistry,
  RuntimeInvocationHostRegistrySummary,
} from "@ku0/code-runtime-host-contract";
import {
  classifyRuntimeInvocationFallback,
  reconcileRuntimeInvocationDescriptorReadiness,
  resolveRuntimeInvocationHostSelectionSummary,
  type RuntimeInvocationFallbackClassification,
} from "@ku0/code-application";

export type RuntimeInvocationTruthPresentation = {
  selectedInvocationHostLabel: string | null;
  runtimeDispatchMode: RuntimeInvocationHostDispatchMode | null;
  readinessReason: string | null;
  usesCanonicalRuntimeDispatch: boolean | null;
  usesCompatibilityFallback: boolean | null;
  fallbackClassification: RuntimeInvocationFallbackClassification | null;
  hostRegistrySummary: RuntimeInvocationHostRegistrySummary | null;
  selectionSummary: string | null;
  truthSourceLabel: string | null;
};

function createMissionLaunchInvocationDescriptor(workspaceId: string): InvocationDescriptor {
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
      workspaceId,
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
  };
}

export function buildRuntimeMissionLaunchInvocationPresentation(input: {
  workspaceId: string;
  runtimeHostRegistry?: RuntimeInvocationHostRegistry | null;
}): RuntimeInvocationTruthPresentation | null {
  if (!input.workspaceId.trim()) {
    return null;
  }

  const descriptor = createMissionLaunchInvocationDescriptor(input.workspaceId);
  const runtimeHostRegistry = input.runtimeHostRegistry ?? null;

  if (!runtimeHostRegistry) {
    return {
      selectedInvocationHostLabel: null,
      runtimeDispatchMode: null,
      readinessReason: null,
      usesCanonicalRuntimeDispatch: null,
      usesCompatibilityFallback: null,
      fallbackClassification: null,
      hostRegistrySummary: null,
      selectionSummary: null,
      truthSourceLabel: null,
    };
  }

  const hostSelection = resolveRuntimeInvocationHostSelectionSummary({
    descriptor,
    runtimeHostRegistry,
  });
  const reconciledReadiness = reconcileRuntimeInvocationDescriptorReadiness({
    descriptor,
    hostSelectionSummary: hostSelection,
  });
  const fallbackClassification = classifyRuntimeInvocationFallback({
    descriptor,
    hostSelectionSummary: hostSelection,
  });

  return {
    selectedInvocationHostLabel: hostSelection.selectedHost?.label ?? null,
    runtimeDispatchMode: hostSelection.dispatchMode,
    readinessReason:
      reconciledReadiness.reason ??
      hostSelection.selectedHost?.readiness.reason ??
      hostSelection.summary ??
      null,
    usesCanonicalRuntimeDispatch: fallbackClassification === "runtime-canonical",
    usesCompatibilityFallback: fallbackClassification === "compat-fallback",
    fallbackClassification,
    hostRegistrySummary: runtimeHostRegistry.summary,
    selectionSummary: hostSelection.summary,
    truthSourceLabel: "Runtime invocation host registry",
  };
}

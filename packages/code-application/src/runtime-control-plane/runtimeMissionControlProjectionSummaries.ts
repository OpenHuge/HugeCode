import type {
  AgentTaskSummary,
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimeContextPlaneV2,
  RuntimeEvalPlaneV2,
  RuntimeInvocationCatalogRefV2,
  RuntimePolicySnapshot,
  RuntimeToolingPlaneV2,
} from "@ku0/code-runtime-host-contract";

export type RuntimeMissionControlSummaryCounts = {
  total: number;
  running: number;
  queued: number;
  awaitingApproval: number;
  finished: number;
};

export type RuntimeMissionControlCompositionSummary = {
  profileCount: number;
  activeProfileId: string | null;
  activeProfileName: string | null;
  verifiedPluginCount: number;
  blockedPluginCount: number;
  selectedRouteCount: number;
  selectedBackendCount: number;
  error: string | null;
};

export type RuntimeMissionControlPolicyCapability = {
  capabilityId: string;
  label: string;
  readiness: "ready" | "attention" | "blocked";
  effect: "allow" | "approval" | "restricted" | "blocked";
  activeConstraint: boolean;
  effectLabel: string;
  summary: string;
  detail: string | null;
};

export type RuntimeMissionControlPolicyIndicator = {
  readiness: "ready" | "attention" | "blocked";
  statusLabel: "Ready" | "Attention" | "Blocked";
  statusTone: "success" | "warning" | "danger";
  headline: string;
  summary: string;
  mode: string | null;
  updatedAt: number | null;
  activeConstraintCount: number;
  blockedCapabilityCount: number;
  capabilities: RuntimeMissionControlPolicyCapability[];
  error: string | null;
};

export type RuntimeLaunchPreparationInvocationSummary = {
  bindingCount: number;
  readyBindingCount: number;
  blockedBindingCount: number;
  notRequiredBindingCount: number;
  requirementCount: number;
};

function joinSummaryParts(parts: Array<string | null>): string | null {
  const normalized = parts.filter((value): value is string => Boolean(value));
  return normalized.length > 0 ? normalized.join(" | ") : null;
}

function formatRuntimeCompactionSummary(contextPlane: RuntimeContextPlaneV2): string | null {
  const compactionSummary = contextPlane.compactionSummary;
  if (!compactionSummary) {
    return null;
  }
  if (compactionSummary.executionError) {
    return `Compaction: failed (${compactionSummary.executionError})`;
  }
  if (!compactionSummary.triggered) {
    return "Compaction: idle";
  }

  const detailParts = [
    compactionSummary.executed ? "executed" : "triggered",
    compactionSummary.compressedSteps !== null && compactionSummary.compressedSteps !== undefined
      ? `${compactionSummary.compressedSteps} step(s)`
      : null,
    compactionSummary.bytesReduced !== null && compactionSummary.bytesReduced !== undefined
      ? `${compactionSummary.bytesReduced}B reduced`
      : null,
  ].filter((value): value is string => Boolean(value));

  return `Compaction: ${detailParts.join(", ")}`;
}

export function buildRuntimeLaunchPreparationContextPlaneSummary(
  contextPlane: RuntimeContextPlaneV2 | null | undefined
): string | null {
  if (!contextPlane) {
    return null;
  }
  return joinSummaryParts([
    `Memory refs: ${contextPlane.memoryRefs.length}`,
    `Artifacts: ${contextPlane.artifactRefs.length}`,
    `Retention: ${contextPlane.workingSetPolicy.retentionMode}`,
    formatRuntimeCompactionSummary(contextPlane),
  ]);
}

export function buildRuntimeLaunchPreparationInvocationSummary(
  invocationCatalogRef: RuntimeInvocationCatalogRefV2 | null | undefined
): RuntimeLaunchPreparationInvocationSummary | null {
  if (!invocationCatalogRef) {
    return null;
  }
  return {
    bindingCount: invocationCatalogRef.execution.bindings.reduce(
      (total, entry) => total + entry.count,
      0
    ),
    readyBindingCount: invocationCatalogRef.execution.bindings.reduce(
      (total, entry) => total + entry.readyCount,
      0
    ),
    blockedBindingCount: invocationCatalogRef.execution.bindings.reduce(
      (total, entry) => total + entry.blockedCount,
      0
    ),
    notRequiredBindingCount: invocationCatalogRef.execution.bindings.reduce(
      (total, entry) => total + entry.notRequiredCount,
      0
    ),
    requirementCount: invocationCatalogRef.execution.requirements.length,
  };
}

export function buildRuntimeLaunchPreparationToolingPlaneSummary(
  toolingPlane: RuntimeToolingPlaneV2 | null | undefined
): string | null {
  if (!toolingPlane) {
    return null;
  }
  const invocationSummary = buildRuntimeLaunchPreparationInvocationSummary(
    toolingPlane.invocationCatalogRef
  );
  return joinSummaryParts([
    `Capabilities: ${toolingPlane.capabilityCatalog?.capabilities.length ?? 0}`,
    invocationSummary
      ? `Invocation bindings: ${invocationSummary.bindingCount} (${invocationSummary.readyBindingCount} ready${
          invocationSummary.blockedBindingCount > 0
            ? `, ${invocationSummary.blockedBindingCount} blocked`
            : ""
        }${
          invocationSummary.notRequiredBindingCount > 0
            ? `, ${invocationSummary.notRequiredBindingCount} optional`
            : ""
        })`
      : null,
    invocationSummary ? `Invocation requirements: ${invocationSummary.requirementCount}` : null,
    toolingPlane.sandboxRef ? `Tool posture: ${toolingPlane.sandboxRef.toolPosture}` : null,
    toolingPlane.sandboxRef
      ? `Approval sensitivity: ${toolingPlane.sandboxRef.approvalSensitivity}`
      : null,
    `MCP sources: ${toolingPlane.mcpSources.length}`,
  ]);
}

export function buildRuntimeLaunchPreparationEvalPlaneSummary(
  evalPlane: RuntimeEvalPlaneV2 | null | undefined
): string | null {
  if (!evalPlane) {
    return null;
  }
  return joinSummaryParts([
    `Eval cases: ${evalPlane.evalCases.length}`,
    evalPlane.evalCases[0] ? `Baseline: ${evalPlane.evalCases[0].modelBaseline}` : null,
    `Playbook steps: ${evalPlane.modelReleasePlaybook.length}`,
  ]);
}

export function buildRuntimeMissionControlSummaryCounts(
  runtimeTasks: RuntimeMissionControlSummaryTaskLike[]
): RuntimeMissionControlSummaryCounts {
  const counts = {
    total: runtimeTasks.length,
    running: 0,
    queued: 0,
    awaitingApproval: 0,
    finished: 0,
  };
  runtimeTasks.forEach((task) => {
    if (task.status === "running") {
      counts.running += 1;
    } else if (task.status === "queued") {
      counts.queued += 1;
    } else if (task.status === "awaiting_approval") {
      counts.awaitingApproval += 1;
    } else {
      counts.finished += 1;
    }
  });
  return counts;
}

export function buildRuntimeMissionControlCompositionSummary(input: {
  profiles: RuntimeCompositionProfile[];
  activeProfile: RuntimeCompositionProfile | null;
  activeProfileId: string | null;
  resolution: RuntimeCompositionResolution | null;
  error: string | null;
}): RuntimeMissionControlCompositionSummary {
  return {
    profileCount: input.profiles.length,
    activeProfileId: input.activeProfileId,
    activeProfileName: input.activeProfile?.name ?? null,
    verifiedPluginCount:
      input.resolution?.trustDecisions.filter(
        (decision) => decision.status === "verified" || decision.status === "runtime_managed"
      ).length ?? 0,
    blockedPluginCount: input.resolution?.blockedPlugins.length ?? 0,
    selectedRouteCount: input.resolution?.selectedRouteCandidates.length ?? 0,
    selectedBackendCount: input.resolution?.selectedBackendCandidates.length ?? 0,
    error: input.error,
  };
}

function formatRuntimePolicyModeLabel(
  mode: RuntimePolicySnapshot["mode"] | null | undefined
): string | null {
  switch (mode) {
    case "strict":
      return "Strict";
    case "balanced":
      return "Balanced";
    case "aggressive":
      return "Aggressive";
    default:
      return null;
  }
}

function formatRuntimePolicyEffectLabel(
  effect: RuntimeMissionControlPolicyCapability["effect"]
): string {
  switch (effect) {
    case "approval":
      return "Approval gated";
    case "restricted":
      return "Restricted";
    case "blocked":
      return "Blocked";
    default:
      return "Allowed";
  }
}

export function buildRuntimeMissionControlPolicyIndicator(input: {
  runtimePolicy: RuntimePolicySnapshot | null;
  runtimePolicyError: string | null;
}): RuntimeMissionControlPolicyIndicator {
  if (input.runtimePolicyError) {
    return {
      readiness: "attention",
      statusLabel: "Attention",
      statusTone: "warning",
      headline: "Governance / Policy is waiting for runtime truth",
      summary:
        "Mission Control could not read the runtime-published policy state. The indicator stays read-only until runtime publishes policy truth again.",
      mode: null,
      updatedAt: null,
      activeConstraintCount: 0,
      blockedCapabilityCount: 0,
      capabilities: [],
      error: input.runtimePolicyError,
    };
  }

  if (!input.runtimePolicy) {
    return {
      readiness: "attention",
      statusLabel: "Attention",
      statusTone: "warning",
      headline: "Governance / Policy has not published a state yet",
      summary:
        "Mission Control is waiting for the runtime policy snapshot before it can describe active operator constraints.",
      mode: null,
      updatedAt: null,
      activeConstraintCount: 0,
      blockedCapabilityCount: 0,
      capabilities: [],
      error: null,
    };
  }

  const capabilities = input.runtimePolicy.state.capabilities.map((capability) => ({
    capabilityId: capability.capabilityId,
    label: capability.label,
    readiness: capability.readiness,
    effect: capability.effect,
    activeConstraint: capability.activeConstraint,
    effectLabel: formatRuntimePolicyEffectLabel(capability.effect),
    summary: capability.summary,
    detail: capability.detail ?? null,
  }));
  const readiness = input.runtimePolicy.state.readiness;
  const headline =
    readiness === "blocked"
      ? "Governance / Policy is blocking part of the runtime surface"
      : readiness === "attention"
        ? "Governance / Policy is actively constraining runtime behavior"
        : "Governance / Policy is clear for standard execution";

  return {
    readiness,
    statusLabel:
      readiness === "blocked" ? "Blocked" : readiness === "attention" ? "Attention" : "Ready",
    statusTone:
      readiness === "blocked" ? "danger" : readiness === "attention" ? "warning" : "success",
    headline,
    summary: input.runtimePolicy.state.summary,
    mode: formatRuntimePolicyModeLabel(input.runtimePolicy.mode),
    updatedAt: input.runtimePolicy.updatedAt,
    activeConstraintCount: input.runtimePolicy.state.activeConstraintCount,
    blockedCapabilityCount: input.runtimePolicy.state.blockedCapabilityCount,
    capabilities,
    error: null,
  };
}

type RuntimeMissionControlSummaryTaskLike = Pick<AgentTaskSummary, "status">;

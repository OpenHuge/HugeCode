import type {
  AgentTaskSummary,
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimePolicySnapshot,
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

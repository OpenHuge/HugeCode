import type {
  AgentTaskExecutionProfile,
  AgentTaskSummary,
  HugeCodeExecutionProfile,
} from "@ku0/code-runtime-host-contract";

const RUN_EXECUTION_PROFILE_PRESETS: ReadonlyArray<HugeCodeExecutionProfile> = [
  {
    id: "operator-review",
    name: "Operator Review",
    description: "Read-first execution with tight supervision and explicit approvals.",
    executionMode: "local_interactive",
    autonomy: "operator_review",
    supervisionLabel: "Review each mutation before execution",
    accessMode: "read-only",
    networkPolicy: "restricted",
    routingStrategy: "workspace_default",
    toolPosture: "read_only",
    approvalSensitivity: "heightened",
    identitySource: "workspace-routing",
    validationPresetId: "review-first",
  },
  {
    id: "balanced-delegate",
    name: "Balanced Delegate",
    description: "Single-run delegation with write approvals and workspace-safe tooling.",
    executionMode: "local_background",
    autonomy: "bounded_delegate",
    supervisionLabel: "Approve writes, observe progress, intervene when blocked",
    accessMode: "on-request",
    networkPolicy: "default",
    routingStrategy: "workspace_default",
    toolPosture: "workspace_safe",
    approvalSensitivity: "standard",
    identitySource: "workspace-routing",
    validationPresetId: "standard",
  },
  {
    id: "autonomous-delegate",
    name: "Autonomous Delegate",
    description: "High-autonomy execution with broader tool access and checkpoint recovery.",
    executionMode: "remote_sandbox",
    autonomy: "autonomous_delegate",
    supervisionLabel: "Checkpointed autonomy with targeted intervention",
    accessMode: "full-access",
    networkPolicy: "default",
    routingStrategy: "workspace_default",
    toolPosture: "workspace_extended",
    approvalSensitivity: "low_friction",
    identitySource: "workspace-routing",
    validationPresetId: "fast-lane",
  },
];

export function listRunExecutionProfiles(): readonly HugeCodeExecutionProfile[] {
  return RUN_EXECUTION_PROFILE_PRESETS;
}

function inferExecutionProfileId(
  task: AgentTaskSummary,
  preferredProfileId?: string | null
): string {
  if (preferredProfileId) {
    return preferredProfileId;
  }
  const explicitProfileId = task.executionProfile?.id?.trim() || task.executionProfileId?.trim();
  if (explicitProfileId) {
    return explicitProfileId;
  }
  if (task.accessMode === "read-only") {
    return "operator-review";
  }
  if (task.accessMode === "full-access" || task.executionMode === "distributed") {
    return "autonomous-delegate";
  }
  return "balanced-delegate";
}

function projectExecutionProfileMode(
  profile: AgentTaskExecutionProfile
): HugeCodeExecutionProfile["executionMode"] {
  if (profile.executionMode === "distributed") {
    return "remote_sandbox";
  }
  if (profile.autonomy === "operator_review" || profile.accessMode === "read-only") {
    return "local_interactive";
  }
  return "local_background";
}

export function resolveExecutionProfile(
  task: AgentTaskSummary,
  preferredProfileId?: string | null
): HugeCodeExecutionProfile {
  if (task.executionProfile) {
    return {
      id: task.executionProfile.id,
      name: task.executionProfile.name,
      description: task.executionProfile.description,
      executionMode: projectExecutionProfileMode(task.executionProfile),
      autonomy: task.executionProfile.autonomy,
      supervisionLabel: task.executionProfile.supervisionLabel,
      accessMode: task.executionProfile.accessMode,
      networkPolicy: "default",
      routingStrategy: task.executionProfile.routingStrategy,
      toolPosture: task.executionProfile.toolPosture,
      approvalSensitivity: task.executionProfile.approvalSensitivity,
      identitySource: task.executionProfile.identitySource,
      validationPresetId: task.executionProfile.validationPresetId,
    } satisfies HugeCodeExecutionProfile;
  }
  const inferredProfileId = inferExecutionProfileId(task, preferredProfileId);
  return (
    RUN_EXECUTION_PROFILE_PRESETS.find((profile) => profile.id === inferredProfileId) ??
    RUN_EXECUTION_PROFILE_PRESETS[1]
  );
}

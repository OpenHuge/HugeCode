import { resolveTaskSourceSecondaryLabel } from "./runtimeMissionControlTaskSourceProjector";
import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";

export function buildMissionSecondaryLabel(input: {
  isRuntimeManaged: boolean;
  taskSource?:
    | MissionControlProjection["tasks"][number]["taskSource"]
    | MissionControlProjection["runs"][number]["taskSource"]
    | MissionControlProjection["reviewPacks"][number]["taskSource"]
    | null
    | undefined;
}) {
  const labels: string[] = [];
  if (input.isRuntimeManaged) {
    labels.push("Runtime-managed mission");
  }
  const taskSourceLabel = resolveTaskSourceSecondaryLabel(input.taskSource ?? null);
  if (taskSourceLabel) {
    labels.push(taskSourceLabel);
  }
  return labels.length > 0 ? labels.join(" | ") : null;
}

export function getSourceLabel(source: MissionControlProjection["source"]) {
  return source === "runtime_snapshot_v1"
    ? "Runtime snapshot"
    : "Mission-control snapshot unavailable";
}

export function formatSourceCitationDetail(
  citation:
    | NonNullable<MissionControlProjection["runs"][number]["sourceCitations"]>[number]
    | NonNullable<MissionControlProjection["reviewPacks"][number]["sourceCitations"]>[number]
) {
  const trustLabel =
    citation.trustLevel === "primary"
      ? "primary"
      : citation.trustLevel === "runtime"
        ? "runtime"
        : "derived";
  return `${citation.label}: ${citation.claimSummary} (${trustLabel})`;
}

export function buildMissionRouteAudit(input: {
  routeLabel: string | null | undefined;
  routeHint: string | null | undefined;
  providerLabel: string | null | undefined;
  pool: string | null | undefined;
  health: string | null | undefined;
  backendId: string | null | undefined;
  executionProfileName: string | null | undefined;
  validationPresetId: string | null | undefined;
  profileReadinessSummary: string | null | undefined;
}) {
  const details: string[] = [];
  if (input.executionProfileName) {
    details.push(`Execution profile: ${input.executionProfileName}`);
  }
  if (input.validationPresetId) {
    details.push(`Validation preset: ${input.validationPresetId}`);
  }
  if (input.backendId) {
    details.push(`Backend: ${input.backendId}`);
  }
  if (input.providerLabel) {
    details.push(`Provider: ${input.providerLabel}`);
  }
  if (input.pool) {
    details.push(`Pool: ${input.pool}`);
  }
  if (input.health) {
    details.push(`Routing health: ${input.health}`);
  }
  if (input.routeHint) {
    details.push(input.routeHint);
  }
  if (input.profileReadinessSummary) {
    details.push(input.profileReadinessSummary);
  }
  return {
    routeSummary:
      input.routeLabel ??
      (input.executionProfileName
        ? `Executed with ${input.executionProfileName}`
        : "Routing unavailable"),
    routeDetails: details,
  };
}

import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
  RuntimeToolLifecycleHookCheckpointStatus,
  RuntimeToolLifecycleStatus,
} from "../types/runtimeToolLifecycle";

export type RuntimeToolLifecyclePresentationTone =
  | "neutral"
  | "running"
  | "success"
  | "warning"
  | "danger";

export type RuntimeToolLifecyclePresentationSummary = {
  approvalEventCount: number;
  hasActivity: boolean;
  latestEvent: RuntimeToolLifecycleEvent | null;
  latestEventKey: string | null;
  latestHookCheckpoint: RuntimeToolLifecycleHookCheckpoint | null;
  latestHookCheckpointKey: string | null;
  toolEventCount: number;
  totalEvents: number;
  totalHookCheckpoints: number;
};

function compareRuntimeToolLifecycleActivityByRecency(
  left: { at: number; id: string },
  right: { at: number; id: string }
): number {
  if (left.at !== right.at) {
    return right.at - left.at;
  }
  return right.id.localeCompare(left.id);
}

export function sortRuntimeToolLifecycleEventsByRecency(
  events: RuntimeToolLifecycleEvent[]
): RuntimeToolLifecycleEvent[] {
  return events
    .slice()
    .sort((left, right) => compareRuntimeToolLifecycleActivityByRecency(left, right));
}

export function sortRuntimeToolLifecycleHookCheckpointsByRecency(
  checkpoints: RuntimeToolLifecycleHookCheckpoint[]
): RuntimeToolLifecycleHookCheckpoint[] {
  return checkpoints
    .slice()
    .sort((left, right) =>
      compareRuntimeToolLifecycleActivityByRecency(
        { at: left.at, id: left.key },
        { at: right.at, id: right.key }
      )
    );
}

export function formatRuntimeToolLifecycleStatusLabel(
  status: RuntimeToolLifecycleStatus | RuntimeToolLifecycleHookCheckpointStatus | null
): string {
  if (!status) {
    return "unknown";
  }
  return status.replaceAll("_", " ");
}

export function getRuntimeToolLifecycleEventTone(
  event: RuntimeToolLifecycleEvent
): RuntimeToolLifecyclePresentationTone {
  switch (event.status) {
    case "allowed":
    case "approved":
    case "completed":
    case "success":
      return "success";
    case "blocked":
    case "failed":
    case "rejected":
    case "runtime_failed":
    case "timeout":
    case "validation_failed":
      return "danger";
    case "interrupted":
    case "pending":
      return "warning";
    case "in_progress":
      return "running";
    default:
      return "neutral";
  }
}

export function getRuntimeToolLifecycleHookCheckpointTone(
  checkpoint: RuntimeToolLifecycleHookCheckpoint
): RuntimeToolLifecyclePresentationTone {
  switch (checkpoint.status) {
    case "ready":
    case "completed":
      return "success";
    case "blocked":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

export function describeRuntimeToolLifecycleHookCheckpoint(
  checkpoint: RuntimeToolLifecycleHookCheckpoint
): string {
  return checkpoint.point.replaceAll("_", " ");
}

export function describeRuntimeToolLifecycleEvent(event: RuntimeToolLifecycleEvent): string {
  switch (event.kind) {
    case "turn":
      return `Turn ${event.phase}`;
    case "tool":
      return `${event.toolName ?? "Tool call"} ${event.phase}`;
    case "approval":
      return `Approval ${event.phase}`;
    case "guardrail":
      return `${event.toolName ?? "Guardrail"} ${event.phase}`;
  }
}

export function formatRuntimeToolLifecycleEventKey(event: RuntimeToolLifecycleEvent): string {
  return `${event.kind}/${event.phase}`;
}

export function formatRuntimeToolLifecycleHookCheckpointKey(
  checkpoint: RuntimeToolLifecycleHookCheckpoint
): string {
  return `${checkpoint.point}/${checkpoint.status}`;
}

export function buildRuntimeToolLifecyclePresentationSummary(input: {
  hookCheckpoints: RuntimeToolLifecycleHookCheckpoint[];
  lifecycleEvents: RuntimeToolLifecycleEvent[];
}): RuntimeToolLifecyclePresentationSummary {
  const sortedEvents = sortRuntimeToolLifecycleEventsByRecency(input.lifecycleEvents);
  const sortedHookCheckpoints = sortRuntimeToolLifecycleHookCheckpointsByRecency(
    input.hookCheckpoints
  );
  const latestEvent = sortedEvents[0] ?? null;
  const latestHookCheckpoint = sortedHookCheckpoints[0] ?? null;

  return {
    approvalEventCount: input.lifecycleEvents.filter((event) => event.kind === "approval").length,
    hasActivity: sortedEvents.length > 0 || sortedHookCheckpoints.length > 0,
    latestEvent,
    latestEventKey: latestEvent ? formatRuntimeToolLifecycleEventKey(latestEvent) : null,
    latestHookCheckpoint,
    latestHookCheckpointKey: latestHookCheckpoint
      ? formatRuntimeToolLifecycleHookCheckpointKey(latestHookCheckpoint)
      : null,
    toolEventCount: input.lifecycleEvents.filter((event) => event.kind === "tool").length,
    totalEvents: input.lifecycleEvents.length,
    totalHookCheckpoints: input.hookCheckpoints.length,
  };
}

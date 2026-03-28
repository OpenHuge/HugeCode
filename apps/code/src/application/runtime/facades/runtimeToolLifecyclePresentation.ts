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

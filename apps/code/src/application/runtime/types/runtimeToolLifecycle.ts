import type { RuntimeToolExecutionScope } from "@ku0/code-runtime-host-contract";

export type RuntimeToolLifecycleSource = "app-event" | "telemetry";

export type RuntimeToolLifecycleStatus =
  | "allowed"
  | "approved"
  | "blocked"
  | "completed"
  | "failed"
  | "in_progress"
  | "interrupted"
  | "pending"
  | "rejected"
  | "runtime_failed"
  | "success"
  | "timeout"
  | "validation_failed";

export type RuntimeTurnLifecycleEvent = {
  id: string;
  kind: "turn";
  phase: "started" | "completed" | "failed";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: null;
  toolName: null;
  scope: null;
  status: RuntimeToolLifecycleStatus;
  at: number;
  errorCode: string | null;
};

export type RuntimeToolLifecycleEventRecord = {
  id: string;
  kind: "tool";
  phase: "attempted" | "started" | "updated" | "progress" | "completed";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: string | null;
  toolName: string | null;
  scope: RuntimeToolExecutionScope | null;
  status: RuntimeToolLifecycleStatus | null;
  at: number;
  errorCode: string | null;
};

export type RuntimeApprovalLifecycleEvent = {
  id: string;
  kind: "approval";
  phase: "requested" | "resolved";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: null;
  toolName: string | null;
  scope: null;
  status: Extract<RuntimeToolLifecycleStatus, "approved" | "interrupted" | "pending" | "rejected">;
  at: number;
  errorCode: string | null;
  approvalId: string | null;
};

export type RuntimeGuardrailLifecycleEvent = {
  id: string;
  kind: "guardrail";
  phase: "evaluated" | "outcome";
  source: RuntimeToolLifecycleSource;
  workspaceId: string | null;
  threadId: null;
  turnId: string | null;
  toolCallId: null;
  toolName: string | null;
  scope: RuntimeToolExecutionScope | null;
  status: Extract<
    RuntimeToolLifecycleStatus,
    "allowed" | "blocked" | "runtime_failed" | "success" | "timeout" | "validation_failed"
  >;
  at: number;
  errorCode: string | null;
  guardrailDecision: "allowed" | "blocked" | null;
};

export type RuntimeToolLifecycleEvent =
  | RuntimeApprovalLifecycleEvent
  | RuntimeGuardrailLifecycleEvent
  | RuntimeToolLifecycleEventRecord
  | RuntimeTurnLifecycleEvent;

export type RuntimeToolLifecycleSnapshot = {
  revision: number;
  lastEvent: RuntimeToolLifecycleEvent | null;
  recentEvents: RuntimeToolLifecycleEvent[];
};

export function runtimeToolLifecycleEventMatchesWorkspace(
  event: RuntimeToolLifecycleEvent,
  workspaceId: string | null
): boolean {
  if (!workspaceId) {
    return true;
  }
  return event.workspaceId === workspaceId;
}

export function filterRuntimeToolLifecycleSnapshot(
  snapshot: RuntimeToolLifecycleSnapshot,
  workspaceId: string | null
): RuntimeToolLifecycleSnapshot {
  const recentEvents = snapshot.recentEvents.filter((event) =>
    runtimeToolLifecycleEventMatchesWorkspace(event, workspaceId)
  );
  const lastEvent =
    snapshot.lastEvent && runtimeToolLifecycleEventMatchesWorkspace(snapshot.lastEvent, workspaceId)
      ? snapshot.lastEvent
      : (recentEvents.at(-1) ?? null);

  return {
    revision: snapshot.revision,
    lastEvent,
    recentEvents,
  };
}

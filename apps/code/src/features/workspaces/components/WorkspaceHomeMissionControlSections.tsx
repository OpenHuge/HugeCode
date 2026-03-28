import type { ReactNode } from "react";
import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import type { RuntimeAgentTaskInterventionInput } from "../../../application/runtime/types/webMcpBridge";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import type { RuntimeContinuityReadinessSummary } from "../../../application/runtime/facades/runtimeContinuityReadiness";
import type { RuntimeTaskLauncherInterventionIntent } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import {
  CoreLoopMetaRail,
  CoreLoopSection,
  CoreLoopStatePanel,
  ExecutionStatusPill,
  ToolCallChip,
} from "../../../design-system";
import { formatRuntimeTimestamp } from "./WorkspaceHomeAgentRuntimeOrchestration.helpers";
import { WorkspaceHomeAgentRuntimeRunItem } from "./WorkspaceHomeAgentRuntimeRunItem";

type MissionControlSectionCardProps = {
  title: string;
  statusLabel?: string | null;
  statusTone?: "neutral" | "running" | "success" | "warning" | "danger" | null;
  meta?: ReactNode;
  children: ReactNode;
};

export function MissionControlSectionCard({
  title,
  statusLabel,
  statusTone,
  meta,
  children,
}: MissionControlSectionCardProps) {
  return (
    <CoreLoopSection
      title={title}
      signals={
        <CoreLoopMetaRail>
          {statusLabel && statusTone ? (
            <ExecutionStatusPill tone={statusTone} showDot>
              {statusLabel}
            </ExecutionStatusPill>
          ) : null}
          {meta}
        </CoreLoopMetaRail>
      }
      bodyClassName="workspace-home-code-runtime-create"
    >
      {children}
    </CoreLoopSection>
  );
}

type MissionControlRunListSectionProps = {
  activeRuntimeCount: number;
  runtimeTaskCount: number;
  runtimeStatusFilter: RuntimeAgentTaskSummary["status"] | "all";
  visibleRuntimeRuns: Array<{
    task: RuntimeAgentTaskSummary;
    run: HugeCodeRunSummary | null | undefined;
  }>;
  continuityItemsByTaskId: Map<string, RuntimeContinuityReadinessSummary["items"][number]>;
  runtimeLoading: boolean;
  refreshRuntimeTasks: () => Promise<void>;
  interruptRuntimeTaskById: (taskId: string, reason: string) => Promise<void>;
  resumeRuntimeTaskById: (taskId: string) => Promise<void>;
  interveneRuntimeTaskById: (
    taskId: string,
    input: Omit<RuntimeAgentTaskInterventionInput, "taskId">
  ) => Promise<void>;
  prepareRunLauncher: (
    task: RuntimeAgentTaskSummary,
    intent: RuntimeTaskLauncherInterventionIntent
  ) => void;
  decideRuntimeApproval: (approvalId: string, decision: "approved" | "rejected") => Promise<void>;
};

export function MissionControlRunListSection({
  activeRuntimeCount,
  runtimeTaskCount,
  runtimeStatusFilter,
  visibleRuntimeRuns,
  continuityItemsByTaskId,
  runtimeLoading,
  refreshRuntimeTasks,
  interruptRuntimeTaskById,
  resumeRuntimeTaskById,
  interveneRuntimeTaskById,
  prepareRunLauncher,
  decideRuntimeApproval,
}: MissionControlRunListSectionProps) {
  return (
    <MissionControlSectionCard
      title="Run list"
      statusLabel={activeRuntimeCount > 0 ? "Active" : "Idle"}
      statusTone={activeRuntimeCount > 0 ? "running" : "success"}
      meta={
        <>
          <ToolCallChip tone="neutral">Visible {visibleRuntimeRuns.length}</ToolCallChip>
          <ToolCallChip tone="neutral">Filter {runtimeStatusFilter}</ToolCallChip>
        </>
      }
    >
      {visibleRuntimeRuns.length === 0 ? (
        <CoreLoopStatePanel
          compact
          eyebrow="Runtime mission control"
          title={
            runtimeTaskCount === 0 ? "No mission runs found." : "No mission runs match this filter."
          }
          description={
            runtimeTaskCount === 0
              ? "Start a mission from Home or the composer to populate the runtime run list."
              : "Change the selected state filter or wait for runtime updates to publish matching runs."
          }
          tone={runtimeTaskCount === 0 ? "default" : "loading"}
        />
      ) : (
        <div className="workspace-home-code-runtime-list">
          {visibleRuntimeRuns.map(({ task, run }) => {
            const continuityItem = continuityItemsByTaskId.get(task.taskId) ?? null;
            return (
              <WorkspaceHomeAgentRuntimeRunItem
                key={task.taskId}
                task={task}
                run={run ?? null}
                continuityItem={continuityItem}
                runtimeLoading={runtimeLoading}
                onRefresh={refreshRuntimeTasks}
                onInterrupt={(reason) => interruptRuntimeTaskById(task.taskId, reason)}
                onResume={() => resumeRuntimeTaskById(task.taskId)}
                onIntervene={(input) => interveneRuntimeTaskById(task.taskId, input)}
                onPrepareLauncher={(intent) => prepareRunLauncher(task, intent)}
                onApproval={(decision) => decideRuntimeApproval(task.pendingApprovalId!, decision)}
              />
            );
          })}
        </div>
      )}
    </MissionControlSectionCard>
  );
}

function getLifecycleTone(
  event: RuntimeToolLifecycleEvent
): "neutral" | "running" | "success" | "warning" | "danger" {
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

function formatLifecycleStatus(status: RuntimeToolLifecycleEvent["status"] | null): string {
  if (!status) {
    return "unknown";
  }
  return status.replaceAll("_", " ");
}

function formatHookCheckpointStatus(
  status: RuntimeToolLifecycleHookCheckpoint["status"] | null
): string {
  if (!status) {
    return "unknown";
  }
  return status.replaceAll("_", " ");
}

function getHookCheckpointTone(
  checkpoint: RuntimeToolLifecycleHookCheckpoint
): "neutral" | "running" | "success" | "warning" | "danger" {
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

function describeHookCheckpoint(checkpoint: RuntimeToolLifecycleHookCheckpoint): string {
  return checkpoint.point.replaceAll("_", " ");
}

function describeLifecycleEvent(event: RuntimeToolLifecycleEvent): string {
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

type MissionControlSessionLogSectionProps = {
  hookCheckpoints: RuntimeToolLifecycleHookCheckpoint[];
  lifecycleEvents: RuntimeToolLifecycleEvent[];
  maxItems?: number;
};

type MissionControlSessionLogEntry =
  | {
      kind: "event";
      key: string;
      at: number;
      event: RuntimeToolLifecycleEvent;
    }
  | {
      kind: "checkpoint";
      key: string;
      at: number;
      checkpoint: RuntimeToolLifecycleHookCheckpoint;
    };

function getMissionControlSessionLogEntries(
  hookCheckpoints: RuntimeToolLifecycleHookCheckpoint[],
  lifecycleEvents: RuntimeToolLifecycleEvent[],
  maxItems: number
): MissionControlSessionLogEntry[] {
  return [
    ...lifecycleEvents.map(
      (event): MissionControlSessionLogEntry => ({
        kind: "event",
        key: event.id,
        at: event.at,
        event,
      })
    ),
    ...hookCheckpoints.map(
      (checkpoint): MissionControlSessionLogEntry => ({
        kind: "checkpoint",
        key: checkpoint.key,
        at: checkpoint.at,
        checkpoint,
      })
    ),
  ]
    .sort((left, right) => {
      if (right.at !== left.at) {
        return right.at - left.at;
      }
      if (left.kind === right.kind) {
        return 0;
      }
      return left.kind === "event" ? -1 : 1;
    })
    .slice(0, maxItems);
}

export function MissionControlSessionLogSection({
  hookCheckpoints,
  lifecycleEvents,
  maxItems = 8,
}: MissionControlSessionLogSectionProps) {
  const visibleEntries = getMissionControlSessionLogEntries(
    hookCheckpoints,
    lifecycleEvents,
    maxItems
  );
  const hasActivity = visibleEntries.length > 0;
  const toolEventCount = lifecycleEvents.filter((event) => event.kind === "tool").length;
  const approvalEventCount = lifecycleEvents.filter((event) => event.kind === "approval").length;

  return (
    <MissionControlSectionCard
      title="Session log"
      statusLabel={hasActivity ? "Live" : "Idle"}
      statusTone={hasActivity ? "running" : "success"}
      meta={
        <>
          <ToolCallChip tone="neutral">Recent {lifecycleEvents.length}</ToolCallChip>
          <ToolCallChip tone="neutral">Tools {toolEventCount}</ToolCallChip>
          <ToolCallChip tone="neutral">Approvals {approvalEventCount}</ToolCallChip>
          <ToolCallChip tone="neutral">Hook checkpoints {hookCheckpoints.length}</ToolCallChip>
        </>
      }
    >
      {visibleEntries.length === 0 ? (
        <CoreLoopStatePanel
          compact
          eyebrow="Operator session log"
          title="No runtime lifecycle activity yet."
          description="Turn, tool, approval, and guardrail events will appear here once runtime starts publishing work for this workspace."
          tone="default"
        />
      ) : (
        <div
          className="workspace-home-code-runtime-list"
          data-testid="workspace-runtime-session-log"
        >
          {visibleEntries.map((entry) =>
            entry.kind === "event" ? (
              <div className="workspace-home-code-runtime-item" key={entry.key}>
                <div className="workspace-home-code-runtime-item-main">
                  <strong>{describeLifecycleEvent(entry.event)}</strong>
                  <ToolCallChip tone={getLifecycleTone(entry.event)}>
                    {formatLifecycleStatus(entry.event.status)}
                  </ToolCallChip>
                  <span>{formatRuntimeTimestamp(entry.event.at)}</span>
                  <span>Source: {entry.event.source}</span>
                  {entry.event.threadId ? <span>Thread: {entry.event.threadId}</span> : null}
                  {entry.event.turnId ? <span>Turn: {entry.event.turnId}</span> : null}
                  {entry.event.toolCallId ? <span>Call: {entry.event.toolCallId}</span> : null}
                  {entry.event.scope ? <span>Scope: {entry.event.scope}</span> : null}
                  {entry.event.errorCode ? <span>Error: {entry.event.errorCode}</span> : null}
                </div>
              </div>
            ) : (
              <div className="workspace-home-code-runtime-item" key={entry.key}>
                <div className="workspace-home-code-runtime-item-main">
                  <strong>Hook {describeHookCheckpoint(entry.checkpoint)}</strong>
                  <ToolCallChip tone={getHookCheckpointTone(entry.checkpoint)}>
                    {formatHookCheckpointStatus(entry.checkpoint.status)}
                  </ToolCallChip>
                  <span>{formatRuntimeTimestamp(entry.checkpoint.at)}</span>
                  <span>Source: {entry.checkpoint.source}</span>
                  {entry.checkpoint.threadId ? (
                    <span>Thread: {entry.checkpoint.threadId}</span>
                  ) : null}
                  {entry.checkpoint.turnId ? <span>Turn: {entry.checkpoint.turnId}</span> : null}
                  {entry.checkpoint.toolCallId ? (
                    <span>Call: {entry.checkpoint.toolCallId}</span>
                  ) : null}
                  {entry.checkpoint.scope ? <span>Scope: {entry.checkpoint.scope}</span> : null}
                  {entry.checkpoint.reason ? <span>Reason: {entry.checkpoint.reason}</span> : null}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </MissionControlSectionCard>
  );
}

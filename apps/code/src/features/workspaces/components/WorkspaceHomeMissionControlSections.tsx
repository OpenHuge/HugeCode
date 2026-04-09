import { memo, useDeferredValue, type ReactNode } from "react";
import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import {
  describeRuntimeToolLifecycleEvent,
  describeRuntimeToolLifecycleHookCheckpoint,
  formatRuntimeToolLifecycleStatusLabel,
  getRuntimeToolLifecycleEventTone,
  getRuntimeToolLifecycleHookCheckpointTone,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import { formatRuntimeSessionCheckpointSessionLabel } from "../../../application/runtime/facades/runtimeSessionCheckpointPresentation";
import type { RuntimeAgentTaskInterventionInput } from "../../../application/runtime/types/webMcpBridge";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import type { RuntimeContinuityReadinessSummary } from "../../../application/runtime/facades/runtimeContinuityReadiness";
import type { RuntimeTaskLauncherInterventionIntent } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";
import { useWorkspaceRuntimeSessionCheckpoint } from "../../shared/hooks/useWorkspaceRuntimeSessionCheckpoint";
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
  interruptRuntimeSubAgentSessionById: (sessionId: string, reason: string) => Promise<void>;
  closeRuntimeSubAgentSessionById: (
    sessionId: string,
    reason: string,
    force?: boolean
  ) => Promise<void>;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
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
  interruptRuntimeSubAgentSessionById,
  closeRuntimeSubAgentSessionById,
  onOpenMissionTarget,
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
                onSubAgentInterrupt={(sessionId, reason) =>
                  interruptRuntimeSubAgentSessionById(sessionId, reason)
                }
                onSubAgentClose={(sessionId, reason, force) =>
                  closeRuntimeSubAgentSessionById(sessionId, reason, force)
                }
                onOpenMissionTarget={onOpenMissionTarget}
                onResume={() => resumeRuntimeTaskById(task.taskId)}
                onIntervene={(input) => interveneRuntimeTaskById(task.taskId, input)}
                onPrepareLauncher={(intent) => prepareRunLauncher(task, intent)}
                onApproval={(decision) => decideRuntimeApproval(task.pendingApprovalId!, decision)}
                onSubAgentApproval={(approvalId, decision) =>
                  decideRuntimeApproval(approvalId, decision)
                }
              />
            );
          })}
        </div>
      )}
    </MissionControlSectionCard>
  );
}

type MissionControlSessionLogSectionProps = {
  workspaceId: string;
  maxItems?: number;
};

export const MissionControlSessionLogSection = memo(function MissionControlSessionLogSection({
  workspaceId,
  maxItems = 8,
}: MissionControlSessionLogSectionProps) {
  const runtimeSessionCheckpoint = useWorkspaceRuntimeSessionCheckpoint({
    workspaceId,
  });
  const deferredRuntimeSessionCheckpoint = useDeferredValue(runtimeSessionCheckpoint);
  const {
    lifecycle: { hookCheckpoints, lifecycleEvents, summary },
    sessionCheckpointBaseline,
    sessionCheckpointSummary,
  } = deferredRuntimeSessionCheckpoint;
  const visibleSessions = sessionCheckpointBaseline.sessions.slice(0, maxItems);
  const visibleEvents = lifecycleEvents.slice(0, maxItems);
  const visibleHookCheckpoints = hookCheckpoints.slice(0, maxItems);

  return (
    <MissionControlSectionCard
      title="Session log"
      statusLabel={summary.hasActivity ? "Live" : "Idle"}
      statusTone={summary.hasActivity ? "running" : "success"}
      meta={
        <>
          <ToolCallChip tone="neutral">Recent {summary.totalEvents}</ToolCallChip>
          <ToolCallChip tone="neutral">Tools {summary.toolEventCount}</ToolCallChip>
          <ToolCallChip tone="neutral">Approvals {summary.approvalEventCount}</ToolCallChip>
          <ToolCallChip tone="neutral">
            Structured sessions {sessionCheckpointSummary.totalSessions}
          </ToolCallChip>
          <ToolCallChip tone="neutral">
            Hook checkpoints {summary.totalHookCheckpoints}
          </ToolCallChip>
        </>
      }
    >
      {visibleSessions.length === 0 &&
      visibleEvents.length === 0 &&
      visibleHookCheckpoints.length === 0 ? (
        <CoreLoopStatePanel
          compact
          eyebrow="Operator session log"
          title="No runtime lifecycle activity yet."
          description="Turn, tool, approval, guardrail, and checkpoint activity will appear here once runtime starts publishing work for this workspace."
          tone="default"
        />
      ) : (
        <div
          className="workspace-home-code-runtime-list"
          data-testid="workspace-runtime-session-log"
        >
          {visibleSessions.map((session) => (
            <div className="workspace-home-code-runtime-item" key={session.sessionKey}>
              <div className="workspace-home-code-runtime-item-main">
                <strong>Session {formatRuntimeSessionCheckpointSessionLabel(session)}</strong>
                <span>
                  Latest activity:{" "}
                  {session.latestActivityAt === null
                    ? "n/a"
                    : formatRuntimeTimestamp(session.latestActivityAt)}
                </span>
                <span>Records: {session.records.length}</span>
                <span>Checkpoints: {session.checkpoints.length}</span>
                <span>Last event: {session.replay.lastLifecycleEventId ?? "n/a"}</span>
                <span>Last checkpoint: {session.replay.lastHookCheckpointKey ?? "n/a"}</span>
              </div>
            </div>
          ))}
          {visibleEvents.map((event) => (
            <div className="workspace-home-code-runtime-item" key={event.id}>
              <div className="workspace-home-code-runtime-item-main">
                <strong>{describeRuntimeToolLifecycleEvent(event)}</strong>
                <ToolCallChip tone={getRuntimeToolLifecycleEventTone(event)}>
                  {formatRuntimeToolLifecycleStatusLabel(event.status)}
                </ToolCallChip>
                <span>{formatRuntimeTimestamp(event.at)}</span>
                <span>Source: {event.source}</span>
                {event.threadId ? <span>Thread: {event.threadId}</span> : null}
                {event.turnId ? <span>Turn: {event.turnId}</span> : null}
                {event.toolCallId ? <span>Call: {event.toolCallId}</span> : null}
                {event.scope ? <span>Scope: {event.scope}</span> : null}
                {event.errorCode ? <span>Error: {event.errorCode}</span> : null}
              </div>
            </div>
          ))}
          {visibleHookCheckpoints.map((checkpoint) => (
            <div className="workspace-home-code-runtime-item" key={checkpoint.key}>
              <div className="workspace-home-code-runtime-item-main">
                <strong>Hook {describeRuntimeToolLifecycleHookCheckpoint(checkpoint)}</strong>
                <ToolCallChip tone={getRuntimeToolLifecycleHookCheckpointTone(checkpoint)}>
                  {formatRuntimeToolLifecycleStatusLabel(checkpoint.status)}
                </ToolCallChip>
                <span>{formatRuntimeTimestamp(checkpoint.at)}</span>
                <span>Source: {checkpoint.source}</span>
                {checkpoint.threadId ? <span>Thread: {checkpoint.threadId}</span> : null}
                {checkpoint.turnId ? <span>Turn: {checkpoint.turnId}</span> : null}
                {checkpoint.toolCallId ? <span>Call: {checkpoint.toolCallId}</span> : null}
                {checkpoint.scope ? <span>Scope: {checkpoint.scope}</span> : null}
                {checkpoint.reason ? <span>Reason: {checkpoint.reason}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </MissionControlSectionCard>
  );
});

MissionControlSessionLogSection.displayName = "MissionControlSessionLogSection";

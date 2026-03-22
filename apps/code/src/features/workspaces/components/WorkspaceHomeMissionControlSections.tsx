import type { ReactNode } from "react";
import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
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

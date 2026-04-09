import { useEffect, useId, useRef, useState } from "react";
import type {
  HugeCodeExecutionNodeSummary,
  HugeCodeRunSummary,
  RuntimeExecutionEvidenceSummary,
} from "@ku0/code-runtime-host-contract";
import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";
import { projectAgentTaskStatusToRunState } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import {
  buildRuntimeAutonomyContextDetails,
  formatRuntimeAutonomyProfileLabel,
  formatRuntimeWakePolicyLabel,
} from "../../../application/runtime/facades/runtimeAutonomyPresentation";
import { useRuntimeRunRecordTruth } from "../../../application/runtime/facades/runtimeRunRecordTruth";
import type { RuntimeTaskLauncherInterventionIntent } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import type { RuntimeContinuityReadinessItem } from "../../../application/runtime/facades/runtimeContinuityReadiness";
import type {
  RuntimeAgentTaskInterventionInput,
  RuntimeAgentTaskSummary,
} from "../../../application/runtime/types/webMcpBridge";
import {
  ReviewActionRail,
  ReviewLoopSection,
  ReviewSignalGroup,
  StatusBadge,
  type StatusBadgeTone,
} from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import {
  getSubAgentSignalLabel,
  getSubAgentTone,
  isBlockingSubAgentStatus,
  resolveSubAgentSignalLabel,
} from "../../../utils/subAgentStatus";
import {
  buildMissionRunSupervisionSignals,
  formatMissionRunStateLabel,
} from "./runtimeMissionControlPresentation";
import {
  resolveSubAgentContinuationLabel,
  resolveSubAgentContinuationTarget,
} from "./runtimeSubAgentNavigation";
import * as styles from "./WorkspaceHomeAgentRuntimeRunItem.css";
import {
  formatRuntimeTimestamp,
  formatTaskCheckpoint,
  formatTaskTrace,
} from "./WorkspaceHomeAgentRuntimeOrchestration.helpers";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentRuntimeRunItemProps = {
  task: RuntimeAgentTaskSummary;
  run: HugeCodeRunSummary | null | undefined;
  continuityItem: RuntimeContinuityReadinessItem | null;
  runtimeLoading: boolean;
  onRefresh: () => Promise<void> | void;
  onInterrupt: (reason: string) => Promise<void> | void;
  onSubAgentApproval?: (
    approvalId: string,
    decision: "approved" | "rejected"
  ) => Promise<void> | void;
  onSubAgentInterrupt?: (sessionId: string, reason: string) => Promise<void> | void;
  onSubAgentClose?: (sessionId: string, reason: string, force?: boolean) => Promise<void> | void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
  onResume: () => Promise<void> | void;
  onIntervene: (input: Omit<RuntimeAgentTaskInterventionInput, "taskId">) => Promise<void> | void;
  onPrepareLauncher: (intent: RuntimeTaskLauncherInterventionIntent) => void;
  onApproval: (decision: "approved" | "rejected") => Promise<void> | void;
};

type MissionInterventionAction = Extract<
  RuntimeAgentTaskInterventionInput["action"],
  | "replan_scope"
  | "drop_feature"
  | "insert_feature"
  | "change_validation_lane"
  | "change_backend_preference"
  | "mark_blocked_with_reason"
>;

const MISSION_INTERVENTION_ACTION_LABELS: Record<MissionInterventionAction, string> = {
  replan_scope: "Replan scope",
  drop_feature: "Drop feature",
  insert_feature: "Insert feature",
  change_validation_lane: "Change validation lane",
  change_backend_preference: "Change backend preference",
  mark_blocked_with_reason: "Mark blocked",
};

function buildMissionInterventionPatch(input: {
  action: MissionInterventionAction;
  instructionPatch: string;
  validationLaneId: string | null;
  backendIds: string[];
}) {
  const normalizedPatch = input.instructionPatch.trim();
  const segments: string[] = [];
  if (input.action === "change_validation_lane" && input.validationLaneId) {
    segments.push(`Use validation lane ${input.validationLaneId}.`);
  }
  if (input.action === "change_backend_preference" && input.backendIds.length > 0) {
    segments.push(`Preferred backends: ${input.backendIds.join(", ")}.`);
  }
  if (normalizedPatch.length > 0) {
    segments.push(normalizedPatch);
  }
  return segments.length > 0 ? segments.join("\n") : null;
}

function parseBackendPreferenceInput(value: string): string[] {
  const seen = new Set<string>();
  const backendIds: string[] = [];
  for (const entry of value.split(",")) {
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    backendIds.push(normalized);
  }
  return backendIds;
}

function formatCompactLabel(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }
  const normalized = value.replaceAll("_", " ").trim();
  return normalized.length > 0 ? normalized[0]!.toUpperCase() + normalized.slice(1) : "Unknown";
}

function isSubAgentSessionTerminal(status: string | null | undefined): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "interrupted" ||
    status === "closed"
  );
}

function formatExecutionEvidenceReviewStatusLabel(
  reviewStatus: NonNullable<RuntimeExecutionEvidenceSummary["reviewStatus"]>
): string {
  switch (reviewStatus) {
    case "ready":
      return "Review ready";
    case "action_required":
      return "Action required";
    case "incomplete_evidence":
      return "Evidence incomplete";
    default:
      return "Unknown";
  }
}

function buildExecutionEvidenceCountsLabel(
  evidenceSummary: HugeCodeRunSummary["evidenceSummary"]
): string | null {
  if (!evidenceSummary) {
    return null;
  }
  const counts = [
    `validations ${evidenceSummary.validationCount}`,
    `artifacts ${evidenceSummary.artifactCount}`,
    `warnings ${evidenceSummary.warningCount}`,
    `changed paths ${evidenceSummary.changedPathCount}`,
  ];
  if (evidenceSummary.reviewStatus) {
    counts.push(`review ${formatExecutionEvidenceReviewStatusLabel(evidenceSummary.reviewStatus)}`);
  }
  return counts.join(" | ");
}

function mapSubAgentToneToBadgeTone(
  tone: ReturnType<typeof getSubAgentTone> | null | undefined
): StatusBadgeTone {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "error";
    case "accent":
      return "progress";
    default:
      return "default";
  }
}

function resolveSubAgentBadgeTone(status: string | null | undefined): StatusBadgeTone {
  return mapSubAgentToneToBadgeTone(getSubAgentTone(status));
}

function resolveMissionRunBadgeTone(
  state: ReturnType<typeof projectAgentTaskStatusToRunState>
): StatusBadgeTone {
  switch (state) {
    case "running":
    case "preparing":
    case "validating":
      return "progress";
    case "review_ready":
      return "success";
    case "needs_input":
    case "paused":
      return "warning";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "default";
  }
}

function formatNodeStatusLabel(node: HugeCodeExecutionNodeSummary): string {
  return node.status ? formatCompactLabel(node.status) : formatCompactLabel(node.kind);
}

function buildNodeEdgeCounts(
  executionGraph: HugeCodeRunSummary["executionGraph"]
): Map<string, { inbound: number; outbound: number }> {
  const counts = new Map<string, { inbound: number; outbound: number }>();
  for (const edge of executionGraph?.edges ?? []) {
    const from = counts.get(edge.fromNodeId) ?? { inbound: 0, outbound: 0 };
    from.outbound += 1;
    counts.set(edge.fromNodeId, from);
    const to = counts.get(edge.toNodeId) ?? { inbound: 0, outbound: 0 };
    to.inbound += 1;
    counts.set(edge.toNodeId, to);
  }
  return counts;
}

export function WorkspaceHomeAgentRuntimeRunItem({
  task,
  run,
  continuityItem,
  runtimeLoading,
  onRefresh,
  onInterrupt,
  onSubAgentApproval,
  onSubAgentInterrupt,
  onSubAgentClose,
  onOpenMissionTarget,
  onResume,
  onIntervene,
  onPrepareLauncher,
  onApproval,
}: WorkspaceHomeAgentRuntimeRunItemProps) {
  const runtimeRunTruth = useRuntimeRunRecordTruth({
    runId: run?.id ?? task.runSummary?.id ?? task.taskId,
    workspaceId: task.workspaceId ?? run?.workspaceId ?? null,
  });
  const truthTask = runtimeRunTruth.record?.run ?? null;
  const effectiveTask = truthTask ? ({ ...task, ...truthTask } as RuntimeAgentTaskSummary) : task;
  const localRun = run ?? task.runSummary ?? null;
  const truthRun = runtimeRunTruth.record?.missionRun ?? null;
  const effectiveRun =
    truthRun && localRun
      ? ({ ...localRun, ...truthRun } as HugeCodeRunSummary)
      : (truthRun ?? localRun);
  const effectiveReviewPack =
    runtimeRunTruth.record?.reviewPack && effectiveTask.reviewPackSummary
      ? { ...effectiveTask.reviewPackSummary, ...runtimeRunTruth.record.reviewPack }
      : (runtimeRunTruth.record?.reviewPack ?? effectiveTask.reviewPackSummary ?? null);
  const missionPlan = effectiveRun?.missionBrief ?? null;
  const runtimeAutonomyProfile = runtimeRunTruth.record?.autonomyProfile ?? null;
  const runtimeWakePolicy = runtimeRunTruth.record?.wakePolicy ?? null;
  const runtimeWakeReason =
    runtimeRunTruth.record?.wakeReason ??
    effectiveReviewPack?.wakeReason ??
    effectiveRun?.wakeReason ??
    null;
  const runtimeQueuePosition =
    effectiveReviewPack?.queuePosition ?? effectiveRun?.queuePosition ?? null;
  const autonomyContextDetails = buildRuntimeAutonomyContextDetails({
    autonomyProfile: runtimeAutonomyProfile,
    wakePolicy: runtimeWakePolicy,
  });
  const effectiveTakeoverBundle =
    effectiveReviewPack?.takeoverBundle ??
    effectiveRun?.takeoverBundle ??
    effectiveTask.takeoverBundle ??
    null;
  const reviewSummary =
    effectiveReviewPack?.summary?.trim() ||
    (effectiveRun?.state === "review_ready" ? effectiveRun.summary?.trim() || null : null);
  const publishHandoffSummary =
    effectiveReviewPack?.publishHandoff?.summary?.trim() ||
    effectiveRun?.publishHandoff?.summary?.trim() ||
    effectiveTask.publishHandoff?.summary?.trim() ||
    null;
  const executionLifecycleSummary =
    effectiveReviewPack?.lifecycleSummary ?? effectiveRun?.lifecycleSummary ?? null;
  const executionEvidenceSummary =
    effectiveReviewPack?.evidenceSummary ?? effectiveRun?.evidenceSummary ?? null;
  const executionEvidenceCountsLabel = buildExecutionEvidenceCountsLabel(executionEvidenceSummary);
  const currentMilestone =
    missionPlan?.milestones?.find((milestone) => milestone.id === missionPlan.currentMilestoneId) ??
    missionPlan?.milestones?.find((milestone) => milestone.status === "active") ??
    null;
  const completedMilestoneCount =
    missionPlan?.milestones?.filter((milestone) => milestone.status === "completed").length ?? 0;
  const canInterrupt =
    effectiveTask.status === "queued" ||
    effectiveTask.status === "running" ||
    effectiveTask.status === "awaiting_approval";
  const checkpointId = formatTaskCheckpoint({
    checkpointId:
      effectiveTask.checkpointId ??
      effectiveReviewPack?.checkpoint?.checkpointId ??
      effectiveRun?.checkpoint?.checkpointId ??
      null,
  });
  const traceId = formatTaskTrace({
    traceId:
      effectiveTask.traceId ??
      effectiveReviewPack?.checkpoint?.traceId ??
      effectiveRun?.checkpoint?.traceId ??
      null,
  });
  const missionRunState = projectAgentTaskStatusToRunState(effectiveTask.status);
  const supervisionSignals = buildMissionRunSupervisionSignals(effectiveTask, effectiveRun);
  const canResume = continuityItem?.pathKind === "resume";
  const executionGraph = effectiveRun?.executionGraph ?? null;
  const subAgents = effectiveRun?.subAgents ?? [];
  const operatorSnapshot = effectiveRun?.operatorSnapshot ?? null;
  const recentEvents = operatorSnapshot?.recentEvents ?? [];
  const graphNodes = executionGraph?.nodes ?? [];
  const graphEdges = executionGraph?.edges ?? [];
  const subAgentNodeCount = graphNodes.filter((node) => node.executorKind === "sub_agent").length;
  const activeSubAgentCount = subAgents.filter((agent) =>
    ["running", "pending", "waiting"].includes(agent.status)
  ).length;
  const attentionSubAgents = subAgents.filter((agent) => isBlockingSubAgentStatus(agent.status));
  const attentionSubAgentCount = attentionSubAgents.length;
  const resumeReadySubAgentCount = subAgents.filter(
    (agent) =>
      agent.checkpointState?.resumeReady === true || agent.takeoverBundle?.pathKind === "resume"
  ).length;
  const observabilityAvailable =
    subAgents.length > 0 ||
    graphNodes.length > 0 ||
    Boolean(operatorSnapshot?.currentActivity) ||
    Boolean(operatorSnapshot?.blocker) ||
    recentEvents.length > 0;
  const richObservabilityAvailable =
    subAgents.length > 0 ||
    Boolean(operatorSnapshot?.currentActivity) ||
    Boolean(operatorSnapshot?.blocker) ||
    recentEvents.length > 0;
  const initialObservabilityOpen =
    effectiveTask.status === "awaiting_approval" || attentionSubAgentCount > 0;
  const [observabilityOpen, setObservabilityOpen] = useState(initialObservabilityOpen);
  const previousAutoOpenSignalRef = useRef(initialObservabilityOpen);
  const observabilityPanelId = useId();
  const edgeCountsByNodeId = buildNodeEdgeCounts(executionGraph);
  const blockingSubAgentLabel = resolveSubAgentSignalLabel(subAgents.map((agent) => agent.status));
  const canUseMissionInterventions = effectiveRun !== null;
  const validationLanes = missionPlan?.validationLanes ?? [];
  const observabilityHeadline =
    operatorSnapshot?.summary ??
    blockingSubAgentLabel ??
    (subAgents.length > 0
      ? `${subAgents.length} delegated session${subAgents.length === 1 ? "" : "s"} are publishing runtime state.`
      : graphNodes.length > 0
        ? `Execution graph is live with ${graphNodes.length} node${graphNodes.length === 1 ? "" : "s"}.`
        : null);
  const observabilityDetail =
    operatorSnapshot?.blocker ??
    attentionSubAgents[0]?.summary ??
    attentionSubAgents[0]?.approvalState?.reason ??
    effectiveRun?.approval?.summary ??
    effectiveRun?.nextAction?.detail ??
    null;
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [interventionAction, setInterventionAction] =
    useState<MissionInterventionAction>("replan_scope");
  const [interventionReason, setInterventionReason] = useState("");
  const [interventionInstructionPatch, setInterventionInstructionPatch] = useState("");
  const [interventionBackendDraft, setInterventionBackendDraft] = useState("");
  const [interventionValidationLaneId, setInterventionValidationLaneId] = useState<string | null>(
    null
  );
  const canSubmitMissionIntervention =
    !runtimeLoading &&
    !(
      interventionAction === "change_backend_preference" &&
      parseBackendPreferenceInput(interventionBackendDraft).length === 0
    ) &&
    !(interventionAction === "change_validation_lane" && !interventionValidationLaneId);

  function resetMissionInterventionComposer() {
    setInterventionOpen(false);
    setInterventionAction("replan_scope");
    setInterventionReason("");
    setInterventionInstructionPatch("");
    setInterventionBackendDraft("");
    setInterventionValidationLaneId(validationLanes[0]?.id ?? null);
  }

  useEffect(() => {
    if (observabilityAvailable && initialObservabilityOpen && !previousAutoOpenSignalRef.current) {
      setObservabilityOpen(true);
    }
    previousAutoOpenSignalRef.current = initialObservabilityOpen;
  }, [initialObservabilityOpen, observabilityAvailable]);

  useEffect(() => {
    setInterventionValidationLaneId(validationLanes[0]?.id ?? null);
  }, [validationLanes]);

  useEffect(() => {
    resetMissionInterventionComposer();
  }, [effectiveTask.taskId, missionPlan?.planVersion]);

  return (
    <div className="workspace-home-code-runtime-item">
      <div className={joinClassNames("workspace-home-code-runtime-item-main", styles.runHeader)}>
        <div className={styles.runTitleRow}>
          <strong className={styles.runTitle}>
            {effectiveTask.title?.trim().length ? effectiveTask.title : effectiveTask.taskId}
          </strong>
          <StatusBadge tone={resolveMissionRunBadgeTone(missionRunState)}>
            {formatMissionRunStateLabel(missionRunState)}
          </StatusBadge>
          {effectiveTask.recovered === true ? (
            <StatusBadge tone="success">Recovered</StatusBadge>
          ) : null}
        </div>
        <div className={styles.runMetaRail}>
          <span className={styles.runMetaChip}>Step {effectiveTask.currentStep ?? "n/a"}</span>
          <span className={styles.runMetaChip}>
            Updated {formatRuntimeTimestamp(effectiveTask.updatedAt)}
          </span>
          {effectiveRun?.executionProfile ? (
            <span className={styles.runMetaChip}>Profile {effectiveRun.executionProfile.name}</span>
          ) : null}
          {effectiveRun?.routing ? (
            <span className={styles.runMetaChip}>Route {effectiveRun.routing.routeLabel}</span>
          ) : null}
          {checkpointId ? (
            <span className={styles.runMetaChip}>Checkpoint {checkpointId}</span>
          ) : null}
          {traceId ? <span className={styles.runMetaChip}>Trace {traceId}</span> : null}
          {missionPlan?.planVersion ? (
            <span className={styles.runMetaChip}>Plan {missionPlan.planVersion}</span>
          ) : null}
        </div>
        <div className={styles.runDetailStack}>
          {missionPlan?.planSummary ? <span>Plan: {missionPlan.planSummary}</span> : null}
          {currentMilestone ? (
            <span>
              Milestone: {currentMilestone.label} [{currentMilestone.status ?? "planned"}]
            </span>
          ) : null}
          {missionPlan?.milestones?.length ? (
            <span>
              Milestones complete: {completedMilestoneCount}/{missionPlan.milestones.length}
            </span>
          ) : null}
          {missionPlan?.validationLanes?.length ? (
            <span>
              Validation lanes:{" "}
              {missionPlan.validationLanes
                .map((lane) => `${lane.label} (${lane.trigger})`)
                .join(" | ")}
            </span>
          ) : null}
          {missionPlan?.skillPlan?.length ? (
            <span>
              Skill plan:{" "}
              {missionPlan.skillPlan.map((skill) => `${skill.label} [${skill.state}]`).join(" | ")}
            </span>
          ) : null}
          {effectiveRun?.placement ? (
            <span>Placement: {effectiveRun.placement.summary}</span>
          ) : null}
          {effectiveRun?.placement?.rationale ? (
            <span>Placement rationale: {effectiveRun.placement.rationale}</span>
          ) : null}
          {effectiveRun?.placement?.fallbackReasonCode ? (
            <span>Fallback reason: {effectiveRun.placement.fallbackReasonCode}</span>
          ) : null}
          {effectiveRun?.routing?.routeHint ? (
            <span>Routing detail: {effectiveRun.routing.routeHint}</span>
          ) : null}
          {effectiveRun?.approval && !richObservabilityAvailable ? (
            <span>Approval: {effectiveRun.approval.label}</span>
          ) : null}
          {effectiveRun?.nextAction && !richObservabilityAvailable ? (
            <span>Next: {effectiveRun.nextAction.label}</span>
          ) : null}
          {executionLifecycleSummary?.summary ? (
            <span>Execution: {executionLifecycleSummary.summary}</span>
          ) : null}
          {executionEvidenceSummary?.summary ? (
            <span>Evidence: {executionEvidenceSummary.summary}</span>
          ) : null}
          {executionEvidenceCountsLabel ? (
            <span>Evidence counts: {executionEvidenceCountsLabel}</span>
          ) : null}
          {reviewSummary ? <span>Review: {reviewSummary}</span> : null}
          {publishHandoffSummary ? <span>Publish handoff: {publishHandoffSummary}</span> : null}
          {autonomyContextDetails.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
          {runtimeWakeReason ? (
            <span>Wake reason: {formatCompactLabel(runtimeWakeReason)}</span>
          ) : null}
          {typeof runtimeQueuePosition === "number" ? (
            <span>Queue position: {runtimeQueuePosition}</span>
          ) : null}
          {executionGraph && !richObservabilityAvailable ? (
            <span>
              Graph: {executionGraph.nodes.length} node(s), {executionGraph.edges.length} edge(s)
            </span>
          ) : null}
          {subAgentNodeCount > 0 && !richObservabilityAvailable ? (
            <span>Sub-agents: {subAgentNodeCount}</span>
          ) : null}
          {continuityItem ? (
            <span>
              Continuity ({continuityItem.pathKind} via {continuityItem.truthSourceLabel}):{" "}
              {continuityItem.detail}
            </span>
          ) : effectiveTakeoverBundle?.summary ? (
            <span>
              Continuity ({effectiveTakeoverBundle.pathKind} via Runtime takeover bundle):{" "}
              {effectiveTakeoverBundle.summary}
            </span>
          ) : null}
          {supervisionSignals.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      </div>
      {observabilityAvailable ? (
        <div className={styles.observabilityRail}>
          <div className={styles.observabilitySummary}>
            <div className={styles.observabilityCopy}>
              <span className={styles.observabilityEyebrow}>Sub-agent observability</span>
              <strong className={styles.observabilityCopyStrong}>
                {observabilityHeadline ?? "Runtime is publishing delegated execution detail."}
              </strong>
              {observabilityDetail ? <span>{observabilityDetail}</span> : null}
            </div>
            <ReviewSignalGroup className={styles.observabilityMetrics}>
              {subAgents.length > 0 ? (
                <span className={styles.observabilityMetric}>
                  {subAgents.length} session{subAgents.length === 1 ? "" : "s"}
                </span>
              ) : null}
              {activeSubAgentCount > 0 ? (
                <span className={styles.observabilityMetric}>Active {activeSubAgentCount}</span>
              ) : null}
              {attentionSubAgentCount > 0 ? (
                <span className={styles.observabilityMetricWarning}>
                  Attention {attentionSubAgentCount}
                </span>
              ) : null}
              {resumeReadySubAgentCount > 0 ? (
                <span className={styles.observabilityMetric}>
                  Resume ready {resumeReadySubAgentCount}
                </span>
              ) : null}
              {graphNodes.length > 0 ? (
                <span className={styles.observabilityMetric}>
                  Graph {graphNodes.length}/{graphEdges.length}
                </span>
              ) : null}
              {recentEvents.length > 0 ? (
                <span className={styles.observabilityMetric}>Events {recentEvents.length}</span>
              ) : null}
            </ReviewSignalGroup>
          </div>
          <button
            type="button"
            className={styles.observabilityToggle}
            aria-expanded={observabilityOpen}
            aria-controls={observabilityPanelId}
            aria-label={
              observabilityOpen ? "Hide sub-agent observability" : "Open sub-agent observability"
            }
            onClick={() => setObservabilityOpen((value) => !value)}
          >
            {observabilityOpen ? "Hide observability" : "Open observability"}
          </button>
        </div>
      ) : null}
      <ReviewActionRail
        className={joinClassNames("workspace-home-code-runtime-item-actions", styles.actionRail)}
      >
        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.actionButtonPrimary}
            onClick={() => void onRefresh()}
            aria-label={`Refresh mission run ${effectiveTask.title?.trim().length ? effectiveTask.title : effectiveTask.taskId}`}
            disabled={runtimeLoading}
          >
            Refresh
          </button>
          <button
            type="button"
            className={styles.actionButtonPrimary}
            onClick={() => void onResume()}
            disabled={!canResume || runtimeLoading}
          >
            Resume
          </button>
          <button
            type="button"
            className={styles.actionButtonPrimary}
            onClick={() => onPrepareLauncher("retry")}
            disabled={runtimeLoading}
          >
            Retry
          </button>
          <button
            type="button"
            className={styles.actionButtonAffirm}
            onClick={() =>
              effectiveTask.pendingApprovalId ? void onApproval("approved") : undefined
            }
            disabled={
              !effectiveTask.pendingApprovalId ||
              effectiveTask.status !== "awaiting_approval" ||
              runtimeLoading
            }
          >
            Approve
          </button>
          <button
            type="button"
            className={joinClassNames(styles.actionButtonSecondary, styles.actionButtonDanger)}
            onClick={() =>
              effectiveTask.pendingApprovalId ? void onApproval("rejected") : undefined
            }
            disabled={
              !effectiveTask.pendingApprovalId ||
              effectiveTask.status !== "awaiting_approval" ||
              runtimeLoading
            }
          >
            Reject
          </button>
        </div>
        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => {
              setInterventionAction("replan_scope");
              setInterventionOpen(true);
            }}
            disabled={!canUseMissionInterventions || runtimeLoading}
          >
            Replan
          </button>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => {
              setInterventionAction("mark_blocked_with_reason");
              setInterventionOpen(true);
            }}
            disabled={!canUseMissionInterventions || runtimeLoading}
          >
            Blocked
          </button>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => void onInterrupt("ui:webmcp-runtime-interrupt")}
            disabled={!canInterrupt || runtimeLoading}
          >
            Interrupt
          </button>
          <button
            type="button"
            className={joinClassNames(styles.actionButtonSecondary, styles.actionButtonDanger)}
            onClick={() => void onInterrupt("ui:webmcp-runtime-terminate")}
            disabled={!canInterrupt || runtimeLoading}
          >
            Terminate
          </button>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => onPrepareLauncher("clarify")}
            disabled={runtimeLoading}
          >
            Clarify
          </button>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => onPrepareLauncher("switch_profile")}
            disabled={runtimeLoading}
          >
            Switch profile
          </button>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => setInterventionOpen((value) => !value)}
            disabled={!canUseMissionInterventions || runtimeLoading}
          >
            {interventionOpen ? "Hide intervene" : "Mission intervene"}
          </button>
        </div>
      </ReviewActionRail>
      {interventionOpen && canUseMissionInterventions ? (
        <div className={styles.interventionPanel}>
          <div className={styles.interventionHeader}>
            <strong>Mission intervention</strong>
            <span>
              Submit a structured runtime replan against the current mission truth
              {missionPlan?.planVersion ? ` (${missionPlan.planVersion})` : ""}.
            </span>
          </div>
          <div className={styles.interventionGrid}>
            <label className={styles.interventionField}>
              <span>Action</span>
              <select
                className={styles.interventionInput}
                value={interventionAction}
                onChange={(event) =>
                  setInterventionAction(event.target.value as MissionInterventionAction)
                }
              >
                {(Object.keys(MISSION_INTERVENTION_ACTION_LABELS) as MissionInterventionAction[])
                  .filter(
                    (action) => action !== "change_validation_lane" || validationLanes.length > 0
                  )
                  .map((action) => (
                    <option key={action} value={action}>
                      {MISSION_INTERVENTION_ACTION_LABELS[action]}
                    </option>
                  ))}
              </select>
            </label>
            <label className={styles.interventionField}>
              <span>Reason</span>
              <input
                className={styles.interventionInput}
                type="text"
                value={interventionReason}
                onChange={(event) => setInterventionReason(event.target.value)}
                placeholder="Why should runtime replan?"
              />
            </label>
            {interventionAction === "change_validation_lane" ? (
              <label className={styles.interventionField}>
                <span>Validation lane</span>
                <select
                  className={styles.interventionInput}
                  value={interventionValidationLaneId ?? ""}
                  onChange={(event) => setInterventionValidationLaneId(event.target.value || null)}
                >
                  {validationLanes.map((lane) => (
                    <option key={lane.id} value={lane.id}>
                      {lane.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {interventionAction === "change_backend_preference" ? (
              <label className={styles.interventionField}>
                <span>Backend preference</span>
                <input
                  className={styles.interventionInput}
                  type="text"
                  value={interventionBackendDraft}
                  onChange={(event) => setInterventionBackendDraft(event.target.value)}
                  placeholder="backend-a, backend-b"
                />
              </label>
            ) : null}
          </div>
          <label className={styles.interventionField}>
            <span>Patch</span>
            <textarea
              className={styles.interventionTextarea}
              value={interventionInstructionPatch}
              onChange={(event) => setInterventionInstructionPatch(event.target.value)}
              placeholder="Bound the change you want runtime to make to the current mission."
            />
          </label>
          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.actionButtonAffirm}
              onClick={() => {
                void onIntervene({
                  action: interventionAction,
                  reason: interventionReason.trim() || null,
                  instructionPatch: buildMissionInterventionPatch({
                    action: interventionAction,
                    instructionPatch: interventionInstructionPatch,
                    validationLaneId: interventionValidationLaneId,
                    backendIds: parseBackendPreferenceInput(interventionBackendDraft),
                  }),
                  preferredBackendIds:
                    interventionAction === "change_backend_preference"
                      ? parseBackendPreferenceInput(interventionBackendDraft)
                      : null,
                  approvedPlanVersion: missionPlan?.planVersion ?? null,
                });
                resetMissionInterventionComposer();
              }}
              disabled={!canSubmitMissionIntervention}
            >
              Submit intervention
            </button>
            <button
              type="button"
              className={styles.actionButtonSecondary}
              onClick={() => resetMissionInterventionComposer()}
              disabled={runtimeLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {observabilityAvailable && observabilityOpen ? (
        <div
          className={styles.observabilityGrid}
          id={observabilityPanelId}
          role="region"
          aria-label="Sub-agent observability"
          data-testid="workspace-runtime-subagent-observability"
          data-review-loop-panel="runtime-observability"
        >
          <ReviewLoopSection
            className={styles.observabilityCard}
            framed={false}
            title="Delegated sessions"
            meta={
              blockingSubAgentLabel ? (
                <StatusBadge tone={attentionSubAgentCount > 0 ? "warning" : "progress"}>
                  {blockingSubAgentLabel.replace("Sub-agent ", "")}
                </StatusBadge>
              ) : undefined
            }
          >
            {subAgents.length === 0 ? (
              <div className={controlStyles.sectionMeta}>
                Runtime has not published per-session sub-agent snapshots for this run yet.
              </div>
            ) : (
              <div className={styles.subAgentList}>
                {subAgents.map((agent) => {
                  const checkpointSummary =
                    agent.checkpointState?.summary ??
                    (agent.checkpointState?.checkpointId
                      ? `Checkpoint ${agent.checkpointState.checkpointId}`
                      : null);
                  const takeoverSummary = agent.takeoverBundle?.summary ?? null;
                  const takeoverRecommendedAction = agent.takeoverBundle?.recommendedAction ?? null;
                  const approvalSummary =
                    agent.approvalState?.status === "pending"
                      ? (agent.approvalState.reason ?? "Runtime is waiting for approval.")
                      : null;
                  const resultSummary = agent.resultSummary?.summary ?? null;
                  const resultNextAction = agent.resultSummary?.nextAction ?? null;
                  const contextProjectionSummary =
                    agent.contextProjection?.workingSetSummary ?? null;
                  const knowledgeSummaries =
                    agent.contextProjection?.knowledgeItems
                      ?.map((item) => item.summary?.trim())
                      .filter((item): item is string => Boolean(item))
                      .slice(0, 3) ?? [];
                  const sessionNodeCount = graphNodes.filter(
                    (node) => node.executorSessionId === agent.sessionId
                  ).length;
                  const pendingApprovalId =
                    agent.approvalState?.status === "pending"
                      ? (agent.approvalState.approvalId ?? null)
                      : null;
                  const canApproveSubAgent =
                    !runtimeLoading &&
                    pendingApprovalId !== null &&
                    typeof onSubAgentApproval === "function";
                  const canInterruptSubAgent =
                    !runtimeLoading &&
                    typeof onSubAgentInterrupt === "function" &&
                    !isSubAgentSessionTerminal(agent.status);
                  const canCloseSubAgent =
                    !runtimeLoading &&
                    typeof onSubAgentClose === "function" &&
                    (isSubAgentSessionTerminal(agent.status) || Boolean(agent.timedOutReason));
                  const continuationTarget = resolveSubAgentContinuationTarget({
                    task: effectiveTask,
                    run: effectiveRun,
                    takeoverBundle: agent.takeoverBundle,
                  });
                  const canOpenSubAgentContinuation =
                    !runtimeLoading &&
                    typeof onOpenMissionTarget === "function" &&
                    continuationTarget !== null;
                  return (
                    <article key={agent.sessionId} className={styles.subAgentCard}>
                      <div className={styles.subAgentCardHeader}>
                        <div className={styles.subAgentCardTitle}>
                          <strong className={styles.subAgentCardTitleStrong}>
                            {agent.summary ?? `Session ${agent.sessionId}`}
                          </strong>
                          <span className={styles.subAgentCardTitleMeta}>{agent.sessionId}</span>
                        </div>
                        <StatusBadge tone={resolveSubAgentBadgeTone(agent.status)}>
                          {getSubAgentSignalLabel(agent.status)?.replace("Sub-agent ", "") ??
                            formatCompactLabel(agent.status)}
                        </StatusBadge>
                      </div>
                      <div className={styles.subAgentCardMeta}>
                        {agent.scopeProfile ? <span>Profile: {agent.scopeProfile}</span> : null}
                        {sessionNodeCount > 0 ? <span>Graph nodes: {sessionNodeCount}</span> : null}
                        {agent.approvalState?.status ? (
                          <span>Approval: {formatCompactLabel(agent.approvalState.status)}</span>
                        ) : null}
                        {agent.failureClass && agent.failureClass !== "none" ? (
                          <span>Failure: {formatCompactLabel(agent.failureClass)}</span>
                        ) : null}
                        {agent.timedOutReason ? <span>Timeout: {agent.timedOutReason}</span> : null}
                        {agent.interruptedReason ? (
                          <span>Interrupted: {agent.interruptedReason}</span>
                        ) : null}
                      </div>
                      {approvalSummary ||
                      checkpointSummary ||
                      takeoverSummary ||
                      resultSummary ||
                      resultNextAction ||
                      contextProjectionSummary ||
                      knowledgeSummaries.length > 0 ||
                      takeoverRecommendedAction ? (
                        <ul className={styles.detailList}>
                          {approvalSummary ? <li>{approvalSummary}</li> : null}
                          {resultSummary ? <li>Result: {resultSummary}</li> : null}
                          {resultNextAction ? <li>Next action: {resultNextAction}</li> : null}
                          {contextProjectionSummary ? (
                            <li>Context: {contextProjectionSummary}</li>
                          ) : null}
                          {knowledgeSummaries.length > 0 ? (
                            <li>Knowledge: {knowledgeSummaries.join(" | ")}</li>
                          ) : null}
                          {checkpointSummary ? <li>{checkpointSummary}</li> : null}
                          {takeoverSummary ? <li>{takeoverSummary}</li> : null}
                          {takeoverRecommendedAction &&
                          takeoverRecommendedAction !== takeoverSummary &&
                          takeoverRecommendedAction !== resultNextAction ? (
                            <li>Continuation: {takeoverRecommendedAction}</li>
                          ) : null}
                        </ul>
                      ) : null}
                      {canApproveSubAgent ||
                      canInterruptSubAgent ||
                      canCloseSubAgent ||
                      canOpenSubAgentContinuation ? (
                        <div className={styles.subAgentCardActions}>
                          {canOpenSubAgentContinuation ? (
                            <button
                              type="button"
                              className={styles.actionButtonSecondary}
                              onClick={() =>
                                continuationTarget
                                  ? onOpenMissionTarget?.(continuationTarget)
                                  : undefined
                              }
                            >
                              {resolveSubAgentContinuationLabel(agent.takeoverBundle!.pathKind)}
                            </button>
                          ) : null}
                          {canApproveSubAgent ? (
                            <>
                              <button
                                type="button"
                                className={styles.actionButtonAffirm}
                                onClick={() =>
                                  pendingApprovalId
                                    ? void onSubAgentApproval?.(pendingApprovalId, "approved")
                                    : undefined
                                }
                              >
                                Approve child
                              </button>
                              <button
                                type="button"
                                className={joinClassNames(
                                  styles.actionButtonSecondary,
                                  styles.actionButtonDanger
                                )}
                                onClick={() =>
                                  pendingApprovalId
                                    ? void onSubAgentApproval?.(pendingApprovalId, "rejected")
                                    : undefined
                                }
                              >
                                Reject child
                              </button>
                            </>
                          ) : null}
                          {canInterruptSubAgent ? (
                            <button
                              type="button"
                              className={styles.actionButtonSecondary}
                              onClick={() =>
                                void onSubAgentInterrupt?.(
                                  agent.sessionId,
                                  "ui:webmcp-runtime-sub-agent-interrupt"
                                )
                              }
                            >
                              Interrupt child
                            </button>
                          ) : null}
                          {canCloseSubAgent ? (
                            <button
                              type="button"
                              className={styles.actionButtonSecondary}
                              onClick={() =>
                                void onSubAgentClose?.(
                                  agent.sessionId,
                                  agent.timedOutReason
                                    ? "ui:webmcp-runtime-sub-agent-timeout-close"
                                    : "ui:webmcp-runtime-sub-agent-close",
                                  Boolean(agent.timedOutReason)
                                )
                              }
                            >
                              Close child
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </ReviewLoopSection>
          <ReviewLoopSection
            className={styles.observabilityCard}
            framed={false}
            title="Execution graph"
            meta={
              graphNodes.length > 0 ? (
                <span className={styles.observabilityCardMeta}>
                  {graphNodes.length} node{graphNodes.length === 1 ? "" : "s"} / {graphEdges.length}{" "}
                  edge
                  {graphEdges.length === 1 ? "" : "s"}
                </span>
              ) : undefined
            }
          >
            {graphNodes.length === 0 ? (
              <div className={controlStyles.sectionMeta}>
                Runtime has not published execution-graph nodes for this run yet.
              </div>
            ) : (
              <ul className={styles.graphList}>
                {graphNodes.map((node) => {
                  const edgeCounts = edgeCountsByNodeId.get(node.id) ?? { inbound: 0, outbound: 0 };
                  return (
                    <li key={node.id} className={styles.graphNode}>
                      <div className={styles.graphNodeHeader}>
                        <div className={styles.graphNodeTitle}>
                          <strong className={styles.graphNodeTitleStrong}>
                            {node.executorSessionId ?? node.id}
                          </strong>
                          <span className={styles.graphNodeTitleMeta}>{node.id}</span>
                        </div>
                        <StatusBadge tone={resolveSubAgentBadgeTone(node.status)}>
                          {formatNodeStatusLabel(node)}
                        </StatusBadge>
                      </div>
                      <div className={styles.graphNodeMeta}>
                        <span>Kind: {formatCompactLabel(node.kind)}</span>
                        {node.executorSessionId ? (
                          <span>Session: {node.executorSessionId}</span>
                        ) : null}
                        {node.resolvedBackendId ? (
                          <span>Backend: {node.resolvedBackendId}</span>
                        ) : null}
                        {node.placementLifecycleState ? (
                          <span>Placement: {formatCompactLabel(node.placementLifecycleState)}</span>
                        ) : null}
                        {edgeCounts.inbound > 0 ? (
                          <span>Depends on {edgeCounts.inbound}</span>
                        ) : null}
                        {edgeCounts.outbound > 0 ? (
                          <span>Unblocks {edgeCounts.outbound}</span>
                        ) : null}
                      </div>
                      {node.reviewActionability?.summary ? (
                        <div className={controlStyles.sectionMeta}>
                          Review: {node.reviewActionability.summary}
                        </div>
                      ) : null}
                      {node.checkpoint?.summary ? (
                        <div className={controlStyles.sectionMeta}>
                          Checkpoint: {node.checkpoint.summary}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </ReviewLoopSection>
          <ReviewLoopSection
            className={styles.observabilityCard}
            framed={false}
            title="Operator trajectory"
            meta={
              operatorSnapshot?.runtimeLabel ? (
                <span>{operatorSnapshot.runtimeLabel}</span>
              ) : undefined
            }
          >
            <div className={styles.observabilityCopy}>
              <strong className={styles.observabilityCopyStrong}>
                {operatorSnapshot?.summary ?? "Runtime trajectory not published."}
              </strong>
              {operatorSnapshot?.currentActivity ? (
                <span>Current activity: {operatorSnapshot.currentActivity}</span>
              ) : null}
              {operatorSnapshot?.blocker ? <span>Blocker: {operatorSnapshot.blocker}</span> : null}
            </div>
            {recentEvents.length > 0 ? (
              <ul className={styles.eventList}>
                {recentEvents.map((event) => (
                  <li
                    key={`${event.kind}-${event.label}-${event.at ?? "no-time"}-${event.detail ?? "no-detail"}`}
                    className={styles.eventItem}
                  >
                    <div className={styles.eventHeader}>
                      <strong className={styles.eventHeaderStrong}>{event.label}</strong>
                      <span className={styles.eventHeaderMeta}>
                        {formatCompactLabel(event.kind)}
                        {event.at ? ` | ${formatRuntimeTimestamp(event.at)}` : ""}
                      </span>
                    </div>
                    {event.detail ? (
                      <div className={controlStyles.sectionMeta}>{event.detail}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={controlStyles.sectionMeta}>
                Runtime has not published recent operator events for this run yet.
              </div>
            )}
          </ReviewLoopSection>
          <ReviewLoopSection
            className={styles.observabilityCard}
            framed={false}
            title="Governance and next action"
            meta={
              effectiveRun?.governance?.label ? (
                <StatusBadge tone={effectiveRun.governance.blocking ? "warning" : "progress"}>
                  {effectiveRun.governance.label}
                </StatusBadge>
              ) : undefined
            }
          >
            <ul className={styles.detailList}>
              {effectiveRun?.nextAction?.label ? (
                <li>Next: {effectiveRun.nextAction.label}</li>
              ) : null}
              {effectiveRun?.nextAction?.detail ? <li>{effectiveRun.nextAction.detail}</li> : null}
              {effectiveRun?.approval?.summary ? (
                <li>Approval: {effectiveRun.approval.summary}</li>
              ) : null}
              {executionLifecycleSummary?.summary ? (
                <li>Execution: {executionLifecycleSummary.summary}</li>
              ) : null}
              {executionEvidenceSummary?.summary ? (
                <li>Evidence: {executionEvidenceSummary.summary}</li>
              ) : null}
              {executionEvidenceCountsLabel ? (
                <li>Evidence counts: {executionEvidenceCountsLabel}</li>
              ) : null}
              {formatRuntimeAutonomyProfileLabel(runtimeAutonomyProfile) ? (
                <li>Autonomy: {formatRuntimeAutonomyProfileLabel(runtimeAutonomyProfile)}</li>
              ) : null}
              {formatRuntimeWakePolicyLabel(runtimeWakePolicy) ? (
                <li>Wake policy: {formatRuntimeWakePolicyLabel(runtimeWakePolicy)}</li>
              ) : null}
              {runtimeWakeReason ? (
                <li>Wake reason: {formatCompactLabel(runtimeWakeReason)}</li>
              ) : null}
              {typeof runtimeQueuePosition === "number" ? (
                <li>Queue position: {runtimeQueuePosition}</li>
              ) : null}
              {continuityItem ? (
                <li>
                  Continuity ({continuityItem.pathKind} via {continuityItem.truthSourceLabel}):{" "}
                  {continuityItem.detail}
                </li>
              ) : effectiveTakeoverBundle?.summary ? (
                <li>
                  Continuity ({effectiveTakeoverBundle.pathKind} via Runtime takeover bundle):{" "}
                  {effectiveTakeoverBundle.summary}
                </li>
              ) : null}
              {publishHandoffSummary ? <li>Publish handoff: {publishHandoffSummary}</li> : null}
              {effectiveRun?.placement?.summary ? (
                <li>Placement: {effectiveRun.placement.summary}</li>
              ) : null}
              {effectiveRun?.placement?.rationale ? (
                <li>Placement rationale: {effectiveRun.placement.rationale}</li>
              ) : null}
              {effectiveRun?.placement?.fallbackReasonCode ? (
                <li>Fallback reason: {effectiveRun.placement.fallbackReasonCode}</li>
              ) : null}
              {checkpointId ? <li>Checkpoint: {checkpointId}</li> : null}
              {traceId ? <li>Trace: {traceId}</li> : null}
            </ul>
          </ReviewLoopSection>
        </div>
      ) : null}
      {effectiveRun?.operatorState ? (
        <div
          className={
            effectiveRun.operatorState.health === "healthy"
              ? controlStyles.sectionMeta
              : controlStyles.warning
          }
        >
          {effectiveRun.operatorState.headline}
          {effectiveRun.operatorState.detail ? `: ${effectiveRun.operatorState.detail}` : ""}
        </div>
      ) : null}
      {effectiveRun?.profileReadiness && !effectiveRun.profileReadiness.ready ? (
        <div className={controlStyles.warning}>
          Profile readiness: {effectiveRun.profileReadiness.summary}
        </div>
      ) : null}
      {effectiveTask.errorMessage && (
        <div className={controlStyles.warning}>{effectiveTask.errorMessage}</div>
      )}
    </div>
  );
}

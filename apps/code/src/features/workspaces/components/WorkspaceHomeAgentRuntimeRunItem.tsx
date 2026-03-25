import { useEffect, useId, useRef, useState } from "react";
import type {
  HugeCodeExecutionNodeSummary,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import { projectAgentTaskStatusToRunState } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { useRuntimeRunRecordTruth } from "../../../application/runtime/facades/runtimeRunRecordTruth";
import type { RuntimeTaskLauncherInterventionIntent } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import type { RuntimeContinuityReadinessItem } from "../../../application/runtime/facades/runtimeContinuityReadiness";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
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
  onResume: () => Promise<void> | void;
  onPrepareLauncher: (intent: RuntimeTaskLauncherInterventionIntent) => void;
  onApproval: (decision: "approved" | "rejected") => Promise<void> | void;
};

function formatCompactLabel(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }
  const normalized = value.replaceAll("_", " ").trim();
  return normalized.length > 0 ? normalized[0]!.toUpperCase() + normalized.slice(1) : "Unknown";
}

function readOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  onResume,
  onPrepareLauncher,
  onApproval,
}: WorkspaceHomeAgentRuntimeRunItemProps) {
  const runtimeRunTruth = useRuntimeRunRecordTruth({
    runId: run?.id ?? task.runSummary?.id ?? task.taskId,
    workspaceId: task.workspaceId ?? run?.workspaceId ?? null,
  });
  const truthTask = runtimeRunTruth.record?.run ?? null;
  const effectiveTask = truthTask ? ({ ...task, ...truthTask } as RuntimeAgentTaskSummary) : task;
  const effectiveRun = runtimeRunTruth.record?.missionRun ?? run ?? task.runSummary ?? null;
  const effectiveReviewPack =
    runtimeRunTruth.record?.reviewPack ?? effectiveTask.reviewPackSummary ?? null;
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
  const runtimeAutonomyProfile = readOptionalText(runtimeRunTruth.record?.autonomyProfile ?? null);
  const runtimeWakePolicy = runtimeRunTruth.record?.wakePolicy ?? null;
  const runtimeIntentSnapshot = runtimeRunTruth.record?.intentSnapshot ?? null;
  const runtimeOpportunityQueue = runtimeRunTruth.record?.opportunityQueue ?? null;
  const runtimeResearchTrace = runtimeRunTruth.record?.researchTrace ?? null;
  const runtimeExecutionEligibility = runtimeRunTruth.record?.executionEligibility ?? null;
  const runtimeSelectedOpportunityId = readOptionalText(
    runtimeRunTruth.record?.selectedOpportunityId ?? null
  );
  const runtimeWakeReason = readOptionalText(runtimeRunTruth.record?.wakeReason ?? null);
  const runtimeGuidanceAvailable =
    runtimeAutonomyProfile !== null ||
    runtimeWakePolicy !== null ||
    runtimeIntentSnapshot !== null ||
    runtimeOpportunityQueue !== null ||
    runtimeResearchTrace !== null ||
    runtimeExecutionEligibility !== null ||
    runtimeSelectedOpportunityId !== null ||
    runtimeWakeReason !== null;
  const runtimeWakePolicySummary =
    runtimeWakePolicy === null
      ? null
      : `Wake policy: ${formatCompactLabel(runtimeWakePolicy.mode)}${runtimeWakePolicy.safeFollowUp ? " with safe follow-up" : ""}`;
  const runtimeResearchSummary =
    runtimeResearchTrace === null
      ? null
      : `Research: ${runtimeResearchTrace.summary}${runtimeResearchTrace.stage ? ` (${formatCompactLabel(runtimeResearchTrace.stage)})` : ""}`;
  const observabilityAvailable =
    subAgents.length > 0 ||
    graphNodes.length > 0 ||
    Boolean(operatorSnapshot?.currentActivity) ||
    Boolean(operatorSnapshot?.blocker) ||
    recentEvents.length > 0 ||
    runtimeGuidanceAvailable;
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

  useEffect(() => {
    if (observabilityAvailable && initialObservabilityOpen && !previousAutoOpenSignalRef.current) {
      setObservabilityOpen(true);
    }
    previousAutoOpenSignalRef.current = initialObservabilityOpen;
  }, [initialObservabilityOpen, observabilityAvailable]);

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
        </div>
        <div className={styles.runDetailStack}>
          {effectiveRun?.placement ? (
            <span>Placement: {effectiveRun.placement.summary}</span>
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
          {reviewSummary ? <span>Review: {reviewSummary}</span> : null}
          {publishHandoffSummary ? <span>Publish handoff: {publishHandoffSummary}</span> : null}
          {runtimeExecutionEligibility?.summary ? (
            <span>Execution eligibility: {runtimeExecutionEligibility.summary}</span>
          ) : null}
          {runtimeWakePolicySummary ? <span>{runtimeWakePolicySummary}</span> : null}
          {runtimeOpportunityQueue?.selectionSummary ? (
            <span>Opportunity queue: {runtimeOpportunityQueue.selectionSummary}</span>
          ) : null}
          {runtimeResearchSummary ? <span>{runtimeResearchSummary}</span> : null}
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
        </div>
      </ReviewActionRail>
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
            title="Runtime wake and planning"
            meta={
              runtimeAutonomyProfile ? (
                <StatusBadge tone="progress">
                  {formatCompactLabel(runtimeAutonomyProfile)}
                </StatusBadge>
              ) : undefined
            }
          >
            {runtimeGuidanceAvailable ? (
              <ul className={styles.detailList}>
                {runtimeIntentSnapshot?.summary ? (
                  <li>Intent: {runtimeIntentSnapshot.summary}</li>
                ) : null}
                {runtimeExecutionEligibility?.summary ? (
                  <li>Execution eligibility: {runtimeExecutionEligibility.summary}</li>
                ) : null}
                {runtimeExecutionEligibility?.nextEligibleAction ? (
                  <li>
                    Next eligible action:{" "}
                    {formatCompactLabel(runtimeExecutionEligibility.nextEligibleAction)}
                  </li>
                ) : null}
                {runtimeWakePolicySummary ? <li>{runtimeWakePolicySummary}</li> : null}
                {runtimeOpportunityQueue?.selectionSummary ? (
                  <li>Opportunity queue: {runtimeOpportunityQueue.selectionSummary}</li>
                ) : null}
                {runtimeSelectedOpportunityId ? (
                  <li>Selected opportunity: {runtimeSelectedOpportunityId}</li>
                ) : null}
                {runtimeResearchSummary ? <li>{runtimeResearchSummary}</li> : null}
                {runtimeWakeReason ? <li>Wake reason: {runtimeWakeReason}</li> : null}
              </ul>
            ) : (
              <div className={controlStyles.sectionMeta}>
                Runtime has not published wake or planning truth for this run yet.
              </div>
            )}
          </ReviewLoopSection>
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
                  const approvalSummary =
                    agent.approvalState?.status === "pending"
                      ? (agent.approvalState.reason ?? "Runtime is waiting for approval.")
                      : null;
                  const sessionNodeCount = graphNodes.filter(
                    (node) => node.executorSessionId === agent.sessionId
                  ).length;
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
                        {agent.timedOutReason ? <span>Timeout: {agent.timedOutReason}</span> : null}
                        {agent.interruptedReason ? (
                          <span>Interrupted: {agent.interruptedReason}</span>
                        ) : null}
                      </div>
                      {approvalSummary || checkpointSummary || takeoverSummary ? (
                        <ul className={styles.detailList}>
                          {approvalSummary ? <li>{approvalSummary}</li> : null}
                          {checkpointSummary ? <li>{checkpointSummary}</li> : null}
                          {takeoverSummary ? <li>{takeoverSummary}</li> : null}
                        </ul>
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

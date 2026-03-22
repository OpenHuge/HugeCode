import { useEffect, useId, useRef, useState } from "react";
import type {
  HugeCodeExecutionNodeSummary,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import { projectAgentTaskStatusToRunState } from "../../../application/runtime/facades/runtimeMissionControlFacade";
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
  const canInterrupt =
    task.status === "queued" || task.status === "running" || task.status === "awaiting_approval";
  const checkpointId = formatTaskCheckpoint(task);
  const traceId = formatTaskTrace(task);
  const missionRunState = projectAgentTaskStatusToRunState(task.status);
  const supervisionSignals = buildMissionRunSupervisionSignals(task, run);
  const canResume = continuityItem?.pathKind === "resume";
  const executionGraph = run?.executionGraph ?? null;
  const subAgents = run?.subAgents ?? [];
  const operatorSnapshot = run?.operatorSnapshot ?? null;
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
    task.status === "awaiting_approval" || attentionSubAgentCount > 0;
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
    run?.approval?.summary ??
    run?.nextAction?.detail ??
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
            {task.title?.trim().length ? task.title : task.taskId}
          </strong>
          <StatusBadge tone={resolveMissionRunBadgeTone(missionRunState)}>
            {formatMissionRunStateLabel(missionRunState)}
          </StatusBadge>
          {task.recovered === true ? <StatusBadge tone="success">Recovered</StatusBadge> : null}
        </div>
        <div className={styles.runMetaRail}>
          <span className={styles.runMetaChip}>Step {task.currentStep ?? "n/a"}</span>
          <span className={styles.runMetaChip}>
            Updated {formatRuntimeTimestamp(task.updatedAt)}
          </span>
          {run?.executionProfile ? (
            <span className={styles.runMetaChip}>Profile {run.executionProfile.name}</span>
          ) : null}
          {run?.routing ? (
            <span className={styles.runMetaChip}>Route {run.routing.routeLabel}</span>
          ) : null}
          {checkpointId ? (
            <span className={styles.runMetaChip}>Checkpoint {checkpointId}</span>
          ) : null}
          {traceId ? <span className={styles.runMetaChip}>Trace {traceId}</span> : null}
        </div>
        <div className={styles.runDetailStack}>
          {run?.placement ? <span>Placement: {run.placement.summary}</span> : null}
          {run?.routing?.routeHint ? <span>Routing detail: {run.routing.routeHint}</span> : null}
          {run?.approval && !richObservabilityAvailable ? (
            <span>Approval: {run.approval.label}</span>
          ) : null}
          {run?.nextAction && !richObservabilityAvailable ? (
            <span>Next: {run.nextAction.label}</span>
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
              Continuity ({continuityItem.pathKind}): {continuityItem.detail}
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
            aria-label={`Refresh mission run ${task.title?.trim().length ? task.title : task.taskId}`}
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
            onClick={() => (task.pendingApprovalId ? void onApproval("approved") : undefined)}
            disabled={
              !task.pendingApprovalId || task.status !== "awaiting_approval" || runtimeLoading
            }
          >
            Approve
          </button>
          <button
            type="button"
            className={joinClassNames(styles.actionButtonSecondary, styles.actionButtonDanger)}
            onClick={() => (task.pendingApprovalId ? void onApproval("rejected") : undefined)}
            disabled={
              !task.pendingApprovalId || task.status !== "awaiting_approval" || runtimeLoading
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
              run?.governance?.label ? (
                <StatusBadge tone={run.governance.blocking ? "warning" : "progress"}>
                  {run.governance.label}
                </StatusBadge>
              ) : undefined
            }
          >
            <ul className={styles.detailList}>
              {run?.nextAction?.label ? <li>Next: {run.nextAction.label}</li> : null}
              {run?.nextAction?.detail ? <li>{run.nextAction.detail}</li> : null}
              {run?.approval?.summary ? <li>Approval: {run.approval.summary}</li> : null}
              {continuityItem ? (
                <li>
                  Continuity ({continuityItem.pathKind}): {continuityItem.detail}
                </li>
              ) : null}
              {run?.placement?.summary ? <li>Placement: {run.placement.summary}</li> : null}
              {checkpointId ? <li>Checkpoint: {checkpointId}</li> : null}
              {traceId ? <li>Trace: {traceId}</li> : null}
            </ul>
          </ReviewLoopSection>
        </div>
      ) : null}
      {run?.operatorState ? (
        <div
          className={
            run.operatorState.health === "healthy"
              ? controlStyles.sectionMeta
              : controlStyles.warning
          }
        >
          {run.operatorState.headline}
          {run.operatorState.detail ? `: ${run.operatorState.detail}` : ""}
        </div>
      ) : null}
      {run?.profileReadiness && !run.profileReadiness.ready ? (
        <div className={controlStyles.warning}>
          Profile readiness: {run.profileReadiness.summary}
        </div>
      ) : null}
      {task.errorMessage && <div className={controlStyles.warning}>{task.errorMessage}</div>}
    </div>
  );
}

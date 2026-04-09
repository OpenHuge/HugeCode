import type { DistributedTaskGraphSnapshot } from "../../../application/runtime/types/distributedTaskGraph";
import { useRuntimeDistributedTaskGraph } from "../../../application/runtime/facades/useRuntimeDistributedTaskGraph";
import { StatusBadge } from "../../../design-system";
import type { TurnPlan } from "../../../types";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import { DistributedTaskGraphPanel } from "./DistributedTaskGraphPanel";
import {
  InspectorSection,
  InspectorSectionBody,
  InspectorSectionGroup,
  InspectorSectionHeader,
  RightPanelEmptyState,
} from "../../right-panel/RightPanelPrimitives";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./PlanPanel.css";
import { getPlanStepStatusLabel, getPlanStepStatusTone } from "./planStepStatus";

type PlanPanelProps = {
  plan: TurnPlan | null;
  isProcessing: boolean;
  activeArtifact?: ResolvedPlanArtifact | null;
};

function formatProgress(plan: TurnPlan) {
  const total = plan.steps.length;
  if (!total) {
    return "";
  }
  const completed = plan.steps.filter((step) => step.status === "completed").length;
  return `${completed}/${total}`;
}

function buildDistributedDiagnosticsMessage(
  graph: DistributedTaskGraphSnapshot | null
): string | null {
  const summary = graph?.summary;
  if (!summary) {
    return null;
  }

  const details: string[] = [];
  if ((summary.placementFailuresTotal ?? 0) > 0) {
    details.push(
      `Placement failures detected (${summary.placementFailuresTotal}). Runtime keeps remote-provider routing until capacity recovers.`
    );
  }
  if (summary.executionMode === "runtime") {
    details.push(
      "Runtime is in runtime-only execution mode and cannot directly access your local machine unless execution mode is switched to hybrid or local CLI."
    );
  }

  const hasRemoteContext =
    summary.accessMode !== null ||
    summary.routedProvider !== null ||
    summary.executionMode !== null;
  if (hasRemoteContext) {
    const accessMode = summary.accessMode ?? "unknown";
    const routedProvider = summary.routedProvider ?? "unknown";
    const executionMode = summary.executionMode ?? "unknown";
    details.push(
      `Remote-provider execution context: access_mode=${accessMode}, routed_provider=${routedProvider}, execution_mode=${executionMode}.`
    );
  }

  if (summary.reason) {
    details.push(summary.reason);
  }

  if (details.length === 0) {
    return null;
  }
  return details.join(" ");
}

export function PlanPanel({ plan, isProcessing, activeArtifact = null }: PlanPanelProps) {
  const {
    graph,
    capabilityEnabled: distributedGraphCapabilityEnabled,
    actionsEnabled: distributedGraphActionsEnabled,
    retryEnabled: distributedGraphRetryEnabled,
    disabledReason,
    interruptNode: handleInterruptNode,
    interruptSubtree: handleInterruptSubtree,
    retryNode: handleRetryNode,
  } = useRuntimeDistributedTaskGraph({
    graphId: plan?.distributedGraph?.graphId ?? null,
    fallbackGraph: plan?.distributedGraph ?? null,
  });

  const distributedDiagnosticsMessage = buildDistributedDiagnosticsMessage(graph);
  const progress = plan ? formatProgress(plan) : "";
  const steps = plan?.steps ?? [];
  const showEmpty = !steps.length && !plan?.explanation && !activeArtifact;
  const emptyLabel = isProcessing ? "Waiting on a plan..." : "No active plan.";
  const panelSubtitle = showEmpty
    ? isProcessing
      ? "Plan generation is in progress."
      : "No active plan is attached to this thread."
    : "Execution steps and distributed task state stay visible beside the thread.";

  return (
    <aside className={joinClassNames(styles.panel, "plan-panel")}>
      <InspectorSection>
        <InspectorSectionGroup>
          <InspectorSectionHeader
            title="Plan"
            subtitle={panelSubtitle}
            actions={progress ? <StatusBadge>{progress}</StatusBadge> : null}
          />
          <InspectorSectionBody className={styles.sectionBody}>
            {activeArtifact ? (
              <section className={styles.artifactCard} data-testid="plan-active-artifact">
                <div className={styles.artifactHeader}>
                  <span className={styles.artifactKicker}>Plan artifact</span>
                  <StatusBadge tone={activeArtifact.awaitingFollowup ? "progress" : "default"}>
                    {activeArtifact.awaitingFollowup ? "Next step" : "Summary"}
                  </StatusBadge>
                </div>
                <div className={styles.artifactTitle}>{activeArtifact.title}</div>
                <div className={styles.artifactPreview}>{activeArtifact.preview}</div>
                {!plan?.explanation && steps.length === 0 ? (
                  <div className={styles.artifactBody}>{activeArtifact.body}</div>
                ) : null}
              </section>
            ) : null}

            {plan?.explanation ? (
              <div className={styles.explanation}>{plan.explanation}</div>
            ) : null}

            {showEmpty ? (
              <RightPanelEmptyState
                title={isProcessing ? "Plan in progress" : "No active plan"}
                body={emptyLabel}
              />
            ) : steps.length > 0 ? (
              <ol className={styles.stepList}>
                {steps.map((step, index) => (
                  <li key={`${step.step}-${index}`} className={styles.stepRow}>
                    <span
                      className={joinClassNames(
                        styles.stepStatus,
                        styles.stepStatusTone[getPlanStepStatusTone(step.status)]
                      )}
                      aria-hidden
                    >
                      {getPlanStepStatusLabel(step.status)}
                    </span>
                    <span className={styles.stepText}>{step.step}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            {distributedDiagnosticsMessage ? (
              <div className={styles.warning} data-testid="plan-distributed-warning">
                {distributedDiagnosticsMessage}
              </div>
            ) : null}
          </InspectorSectionBody>
        </InspectorSectionGroup>
      </InspectorSection>

      <DistributedTaskGraphPanel
        graph={distributedGraphCapabilityEnabled ? graph : null}
        capabilityEnabled={distributedGraphCapabilityEnabled}
        actionsEnabled={distributedGraphActionsEnabled}
        retryEnabled={distributedGraphRetryEnabled}
        disabledReason={disabledReason}
        diagnosticsMessage={distributedDiagnosticsMessage}
        onInterruptNode={handleInterruptNode}
        onInterruptSubtree={handleInterruptSubtree}
        onRetryNode={handleRetryNode}
      />
    </aside>
  );
}

import type { WorkspaceRuntimePolicyIndicator } from "../../../application/runtime/facades/runtimeWorkspaceMissionControlProjection";
import { ToolCallChip } from "../../../design-system";
import { formatRuntimeTimestamp } from "./WorkspaceHomeAgentRuntimeOrchestration.helpers";
import { MissionControlSectionCard } from "./WorkspaceHomeMissionControlSections";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";
import * as styles from "./WorkspaceHomeRuntimePolicyIndicator.css";

type WorkspaceHomeRuntimePolicyIndicatorProps = {
  policy: WorkspaceRuntimePolicyIndicator;
};

function resolvePolicyChipTone(
  state: "ready" | "attention" | "blocked"
): "success" | "warning" | "danger" {
  switch (state) {
    case "blocked":
      return "danger";
    case "attention":
      return "warning";
    default:
      return "success";
  }
}

function resolvePolicyEffectTone(
  effect: WorkspaceRuntimePolicyIndicator["capabilities"][number]["effect"]
): "neutral" | "success" | "warning" | "danger" {
  switch (effect) {
    case "blocked":
      return "danger";
    case "approval":
    case "restricted":
      return "warning";
    default:
      return "success";
  }
}

export function WorkspaceHomeRuntimePolicyIndicator({
  policy,
}: WorkspaceHomeRuntimePolicyIndicatorProps) {
  return (
    <MissionControlSectionCard
      title="Governance / Policy"
      statusLabel={policy.statusLabel}
      statusTone={policy.statusTone}
      meta={
        <>
          <ToolCallChip tone={policy.activeConstraintCount > 0 ? "warning" : "success"}>
            Active constraints {policy.activeConstraintCount}
          </ToolCallChip>
          <ToolCallChip tone={policy.blockedCapabilityCount > 0 ? "danger" : "neutral"}>
            Blocked capabilities {policy.blockedCapabilityCount}
          </ToolCallChip>
          {policy.mode ? <ToolCallChip tone="neutral">Mode {policy.mode}</ToolCallChip> : null}
        </>
      }
    >
      <div className={styles.surface} data-testid="workspace-runtime-policy">
        <div className={styles.summary}>
          <p className={styles.summaryTitle}>{policy.headline}</p>
          <span className={styles.summaryText}>{policy.summary}</span>
          <div className={styles.summaryMeta}>
            {policy.mode ? <span>Policy mode: {policy.mode}</span> : null}
            {policy.updatedAt !== null ? (
              <span>Updated: {formatRuntimeTimestamp(policy.updatedAt)}</span>
            ) : null}
          </div>
        </div>
        {policy.error ? <div className={controlStyles.warning}>{policy.error}</div> : null}
        {policy.capabilities.length === 0 ? (
          <div className={controlStyles.emptyState}>
            Runtime policy capabilities will appear once Mission Control receives a policy snapshot.
          </div>
        ) : (
          <div className={styles.capabilityList}>
            {policy.capabilities.map((capability) => (
              <div className={styles.capabilityCard} key={capability.capabilityId}>
                <div className={styles.capabilityHeader}>
                  <p className={styles.capabilityLabel}>{capability.label}</p>
                  <div className={styles.capabilitySignals}>
                    <ToolCallChip tone={resolvePolicyChipTone(capability.readiness)}>
                      {capability.readiness}
                    </ToolCallChip>
                    <ToolCallChip tone={resolvePolicyEffectTone(capability.effect)}>
                      {capability.effectLabel}
                    </ToolCallChip>
                    {capability.activeConstraint ? (
                      <ToolCallChip tone="warning">Active constraint</ToolCallChip>
                    ) : null}
                  </div>
                </div>
                <span className={styles.capabilityText}>{capability.summary}</span>
                {capability.detail ? (
                  <span className={styles.capabilityText}>{capability.detail}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </MissionControlSectionCard>
  );
}

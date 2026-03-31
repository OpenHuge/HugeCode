import type { ActiveIntentContext } from "@ku0/code-platform-interfaces";
import type { PersistentFlowIndicator } from "../../../application/runtime/facades/runtimePersistentFlowState";
import { ToolCallChip } from "../../../design-system";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomePersistentFlowIndicatorProps = {
  indicator: PersistentFlowIndicator;
  context: ActiveIntentContext | null;
};

function resolveToneClassName(
  tone: PersistentFlowIndicator["tone"],
  recovered: boolean
): string | null {
  if (recovered) {
    return controlStyles.persistentFlowRecovered;
  }
  if (tone === "warning") {
    return controlStyles.persistentFlowWarning;
  }
  return null;
}

export function WorkspaceHomePersistentFlowIndicator({
  indicator,
  context,
}: WorkspaceHomePersistentFlowIndicatorProps) {
  const toneClassName = resolveToneClassName(indicator.tone, indicator.recovered);
  const className = toneClassName
    ? `${controlStyles.persistentFlowSurface} ${toneClassName}`
    : controlStyles.persistentFlowSurface;
  const focusedFilesCount = context?.focusedFiles.length ?? 0;
  const unresolvedErrorsCount = context?.unresolvedErrors.length ?? 0;
  const latestRunLabel = context?.history.latestRunTitle ?? context?.history.latestRunId ?? null;

  return (
    <div
      className={className}
      data-testid="workspace-persistent-flow-indicator"
      role="status"
      aria-live="polite"
    >
      <div className={controlStyles.persistentFlowHeader}>
        <div className={controlStyles.persistentFlowCopy}>
          <span className={controlStyles.persistentFlowLabel}>{indicator.label}</span>
          <span className={controlStyles.persistentFlowDetail}>{indicator.detail}</span>
        </div>
        <ToolCallChip
          tone={
            indicator.tone === "success"
              ? "success"
              : indicator.tone === "warning"
                ? "warning"
                : "neutral"
          }
        >
          {indicator.recovered ? "Recovered" : "Tracking"}
        </ToolCallChip>
      </div>
      <div className={controlStyles.persistentFlowMeta}>
        {latestRunLabel ? (
          <ToolCallChip tone="neutral">Latest run {latestRunLabel}</ToolCallChip>
        ) : null}
        <ToolCallChip tone="neutral">Files {focusedFilesCount}</ToolCallChip>
        <ToolCallChip tone={unresolvedErrorsCount > 0 ? "warning" : "success"}>
          Open issues {unresolvedErrorsCount}
        </ToolCallChip>
      </div>
    </div>
  );
}

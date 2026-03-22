import type { ThreadTokenUsage } from "../../../types";
import * as styles from "./ComposerWorkspaceBar.css";

type ComposerContextUsageSummary = {
  detailLabel: string;
  percentLabel: string | null;
  progress: number;
  tone: "calm" | "warm" | "hot";
};

export function formatCompactTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return "0";
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens >= 100_000 ? 0 : 1)}k`;
  }
  return `${tokens}`;
}

export function resolveComposerContextUsageSummary(
  contextUsage: ThreadTokenUsage | null | undefined
): ComposerContextUsageSummary | null {
  if (!contextUsage) {
    return null;
  }

  const contextWindow = contextUsage.modelContextWindow;
  const usedTokens =
    contextUsage.last.totalTokens > 0
      ? contextUsage.last.totalTokens
      : contextUsage.total.totalTokens;

  if (!contextWindow || contextWindow <= 0) {
    return {
      detailLabel: `${formatCompactTokens(usedTokens)} tokens`,
      percentLabel: null,
      progress: 0,
      tone: "calm",
    };
  }

  const percent = Math.max(0, Math.min(100, Math.round((usedTokens / contextWindow) * 100)));
  return {
    detailLabel: `${formatCompactTokens(usedTokens)} / ${formatCompactTokens(contextWindow)} tokens (${percent}%)`,
    percentLabel: `${percent}%`,
    progress: percent / 100,
    tone: percent >= 85 ? "hot" : percent >= 60 ? "warm" : "calm",
  };
}

type ComposerContextIndicatorProps = {
  contextUsage: ThreadTokenUsage | null | undefined;
};

const RING_RADIUS = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ComposerContextIndicator({ contextUsage }: ComposerContextIndicatorProps) {
  const summary = resolveComposerContextUsageSummary(contextUsage);

  if (!summary) {
    return null;
  }

  const progressOffset = RING_CIRCUMFERENCE * (1 - summary.progress);
  const accessibleLabel = `Context usage ${summary.detailLabel}`;

  return (
    <div
      className={styles.contextIndicator}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      data-tone={summary.tone}
    >
      <svg
        className={styles.contextIndicatorGraphic}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className={styles.contextIndicatorTrack}
          cx="8"
          cy="8"
          r={RING_RADIUS}
          pathLength={RING_CIRCUMFERENCE}
        />
        <circle
          className={styles.contextIndicatorProgress}
          cx="8"
          cy="8"
          r={RING_RADIUS}
          pathLength={RING_CIRCUMFERENCE}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={progressOffset}
          transform="rotate(-90 8 8)"
        />
      </svg>
      <span className={styles.visuallyHidden}>{accessibleLabel}</span>
      {summary.percentLabel ? (
        <span className={styles.contextIndicatorPercent} aria-hidden>
          {summary.percentLabel}
        </span>
      ) : null}
    </div>
  );
}

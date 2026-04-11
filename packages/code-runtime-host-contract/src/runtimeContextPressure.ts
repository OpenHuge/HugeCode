import type {
  RuntimeCompactionSummary,
  RuntimeContextBoundarySummary,
  RuntimeContextProjectionSummary,
} from "./code-runtime-rpc/runtimeRunsAndSubAgents.js";

export type RuntimeContextPressureState = "nominal" | "attention" | "critical" | "unknown";

export type RuntimeContextPressureSignalSource =
  | "compaction"
  | "boundary"
  | "projection"
  | "diagnostics";

export type RuntimeContextPressureSignal = {
  source: RuntimeContextPressureSignalSource;
  state: RuntimeContextPressureState;
  label: string;
  detail: string;
};

export type RuntimeContextPressureSummary = {
  state: RuntimeContextPressureState;
  label: string;
  detail: string;
  recommendedAction: string;
  signals: RuntimeContextPressureSignal[];
  compactionSummary: RuntimeCompactionSummary | null;
  contextBoundary: RuntimeContextBoundarySummary | null;
  contextProjection: RuntimeContextProjectionSummary | null;
  projectionFingerprint: string | null;
  summaryRef: string | null;
  offloadRefs: string[];
  updatedAt: number | null;
};

function maxContextPressureState(
  left: RuntimeContextPressureState,
  right: RuntimeContextPressureState
): RuntimeContextPressureState {
  if (left === "critical" || right === "critical") {
    return "critical";
  }
  if (left === "attention" || right === "attention") {
    return "attention";
  }
  if (left === "unknown" || right === "unknown") {
    return "unknown";
  }
  return "nominal";
}

function rankContextPressureState(state: RuntimeContextPressureState): number {
  if (state === "critical") {
    return 4;
  }
  if (state === "attention") {
    return 3;
  }
  if (state === "unknown") {
    return 2;
  }
  return 1;
}

function readOptionalText(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function formatCompactionSignal(
  compactionSummary: RuntimeCompactionSummary | null
): RuntimeContextPressureSignal | null {
  if (!compactionSummary) {
    return null;
  }
  if (compactionSummary.executionError) {
    return {
      source: "compaction",
      state: "critical",
      label: "Context compaction",
      detail: `Compaction: failed (${compactionSummary.executionError})`,
    };
  }
  if (!compactionSummary.triggered) {
    return {
      source: "compaction",
      state: "nominal",
      label: "Context compaction",
      detail: "Compaction: idle",
    };
  }

  const detailParts = [
    compactionSummary.executed ? "executed" : "triggered",
    compactionSummary.compressedSteps !== null && compactionSummary.compressedSteps !== undefined
      ? `${compactionSummary.compressedSteps} step(s)`
      : null,
    compactionSummary.bytesReduced !== null && compactionSummary.bytesReduced !== undefined
      ? `${compactionSummary.bytesReduced}B reduced`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    source: "compaction",
    state: "attention",
    label: "Context compaction",
    detail: `Compaction: ${detailParts.join(", ")}`,
  };
}

function formatBoundarySignal(input: {
  contextBoundary: RuntimeContextBoundarySummary | null;
  contextProjection: RuntimeContextProjectionSummary | null;
  projectionRequired: boolean;
}): RuntimeContextPressureSignal | null {
  const boundary = input.contextBoundary;
  if (!boundary) {
    return null;
  }
  if (boundary.status === "failed") {
    return {
      source: "boundary",
      state: "critical",
      label: "Context boundary",
      detail: `Context boundary ${boundary.boundaryId} failed during ${boundary.phase}.`,
    };
  }
  if (
    input.projectionRequired &&
    !input.contextProjection &&
    (boundary.status === "active" ||
      boundary.status === "compacted" ||
      boundary.status === "offloaded")
  ) {
    return {
      source: "projection",
      state: "critical",
      label: "Context projection",
      detail: `Context boundary ${boundary.boundaryId} requires a runtime projection before continuation.`,
    };
  }
  if (boundary.status === "active" || boundary.status === "pending") {
    return {
      source: "boundary",
      state: "attention",
      label: "Context boundary",
      detail: `Context boundary ${boundary.boundaryId} is ${boundary.status} for ${boundary.trigger}.`,
    };
  }
  if (boundary.status === "compacted" || boundary.status === "offloaded") {
    return {
      source: "boundary",
      state: "attention",
      label: "Context boundary",
      detail: `Context boundary ${boundary.boundaryId} ${boundary.status} context for ${boundary.trigger}.`,
    };
  }
  return {
    source: "boundary",
    state: "nominal",
    label: "Context boundary",
    detail: `Context boundary ${boundary.boundaryId} is available.`,
  };
}

function buildDetail(signals: RuntimeContextPressureSignal[]): string {
  const activeSignals = signals.filter((signal) => signal.state !== "nominal");
  if (activeSignals.length === 0) {
    return "Runtime context pressure is nominal.";
  }
  return activeSignals.map((signal) => signal.detail).join(" ");
}

function buildRecommendedAction(state: RuntimeContextPressureState): string {
  if (state === "critical") {
    return "Restore runtime context projection or inspect compaction failures before launching or continuing work.";
  }
  if (state === "attention") {
    return "Review runtime context pressure before launching more delegated work.";
  }
  if (state === "unknown") {
    return "Reconnect runtime diagnostics before relying on context pressure status.";
  }
  return "Runtime context pressure is nominal; no context action is required.";
}

function dedupeTextValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = readOptionalText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function buildRuntimeContextPressureSummary(input: {
  compactionSummary?: RuntimeCompactionSummary | null;
  contextBoundary?: RuntimeContextBoundarySummary | null;
  contextProjection?: RuntimeContextProjectionSummary | null;
  diagnosticsError?: string | null;
  projectionRequired?: boolean;
}): RuntimeContextPressureSummary {
  const compactionSummary = input.compactionSummary ?? null;
  const contextBoundary = input.contextBoundary ?? null;
  const contextProjection = input.contextProjection ?? null;
  const signals: RuntimeContextPressureSignal[] = [];
  const diagnosticsError = readOptionalText(input.diagnosticsError);

  if (diagnosticsError) {
    signals.push({
      source: "diagnostics",
      state: "unknown",
      label: "Context diagnostics",
      detail: diagnosticsError,
    });
  }

  const compactionSignal = formatCompactionSignal(compactionSummary);
  if (compactionSignal) {
    signals.push(compactionSignal);
  }

  const boundarySignal = formatBoundarySignal({
    contextBoundary,
    contextProjection,
    projectionRequired: input.projectionRequired === true,
  });
  if (boundarySignal) {
    signals.push(boundarySignal);
  }

  const state = signals.reduce<RuntimeContextPressureState>(
    (current, signal) => maxContextPressureState(current, signal.state),
    "nominal"
  );
  const projectionFingerprint =
    contextProjection?.projectionFingerprint ?? contextBoundary?.projectionFingerprint ?? null;
  const summaryRef = contextProjection?.summaryRef ?? contextBoundary?.summaryRef ?? null;
  const offloadRefs = dedupeTextValues([
    ...(contextBoundary?.offloadRefs ?? []),
    ...(contextProjection?.offloadRefs ?? []),
  ]);
  const updatedAt = Math.max(contextBoundary?.updatedAt ?? 0, contextProjection?.updatedAt ?? 0);

  return {
    state,
    label:
      state === "critical"
        ? "Context pressure critical"
        : state === "attention"
          ? "Context pressure attention"
          : state === "unknown"
            ? "Context pressure unknown"
            : "Context pressure nominal",
    detail: buildDetail(signals),
    recommendedAction: buildRecommendedAction(state),
    signals,
    compactionSummary,
    contextBoundary,
    contextProjection,
    projectionFingerprint,
    summaryRef,
    offloadRefs,
    updatedAt: updatedAt > 0 ? updatedAt : null,
  };
}

export function mergeRuntimeContextPressureSummaries(
  summaries: Array<RuntimeContextPressureSummary | null | undefined>
): RuntimeContextPressureSummary {
  const available = summaries.filter(
    (summary): summary is RuntimeContextPressureSummary => summary !== null && summary !== undefined
  );
  if (available.length === 0) {
    return buildRuntimeContextPressureSummary({});
  }

  const primary = available.slice().sort((left, right) => {
    const stateDelta = rankContextPressureState(right.state) - rankContextPressureState(left.state);
    if (stateDelta !== 0) {
      return stateDelta;
    }
    return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
  })[0];

  const signals = available.flatMap((summary) => summary.signals);
  const offloadRefs = dedupeTextValues(available.flatMap((summary) => summary.offloadRefs));
  const updatedAt =
    available.reduce<number | null>((current, summary) => {
      if (summary.updatedAt === null) {
        return current;
      }
      return current === null ? summary.updatedAt : Math.max(current, summary.updatedAt);
    }, null) ?? null;

  return {
    ...primary,
    detail: buildDetail(signals),
    signals,
    offloadRefs,
    updatedAt,
  };
}

import type {
  HugeCodeValidationSummary,
  WorkspaceDiagnostic,
} from "@ku0/code-runtime-host-contract";
import {
  ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
  type ActiveIntentContext,
  type ActiveIntentContextError,
  type ActiveIntentContextFocusedFile,
} from "@ku0/code-platform-interfaces";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../../types";
import { getAppSettings, updateAppSettings } from "../ports/desktopAppSettings";
import { subscribeScopedRuntimeUpdatedEvents } from "../ports/runtimeUpdatedEvents";
import { listWorkspaceDiagnostics } from "../ports/tauriRuntimeDiagnostics";
import type { AgentIntentState } from "../types/webMcpBridge";

type ActiveIntentContextRunInput = {
  id: string;
  title: string | null;
  updatedAt: number;
  changedPaths?: string[] | null;
  validations?: HugeCodeValidationSummary[] | null;
  reviewPackId?: string | null;
};

type ActiveIntentContextDiagnosticsInput = {
  generatedAtMs: number | null;
  items: WorkspaceDiagnostic[];
};

type BuildActiveIntentContextInput = {
  intent: AgentIntentState;
  runs: ActiveIntentContextRunInput[];
  diagnostics: ActiveIntentContextDiagnosticsInput;
};

type UseWorkspacePersistentFlowStateInput = {
  workspaceId: string;
  intent: AgentIntentState;
  runs: ActiveIntentContextRunInput[];
  legacyCachedIntent: AgentIntentState | null;
  legacyCacheCorrupted: boolean;
};

export type PersistentFlowHydrationSource = "host" | "legacy_cache" | "derived" | "none";
export type PersistentFlowLoadState = "loading" | "ready" | "error";

export type PersistentFlowIndicator = {
  tone: "success" | "warning" | "neutral";
  label: string;
  detail: string;
  recovered: boolean;
};

type BuildPersistentFlowIndicatorInput = {
  source: PersistentFlowHydrationSource;
  context: ActiveIntentContext | null;
  loadState: PersistentFlowLoadState;
  saveError: string | null;
  legacyCacheCorrupted: boolean;
};

export type WorkspacePersistentFlowState = {
  context: ActiveIntentContext | null;
  hydratedIntent: AgentIntentState | null;
  source: PersistentFlowHydrationSource;
  loadState: PersistentFlowLoadState;
  saveError: string | null;
  indicator: PersistentFlowIndicator;
};

const MAX_FOCUSED_FILES = 6;
const MAX_UNRESOLVED_ERRORS = 10;
const MAX_VALIDATION_SUMMARIES = 5;

function readTrimmedText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMeaningfulIntent(intent: AgentIntentState | null | undefined): boolean {
  return Boolean(
    intent &&
    (intent.objective.trim() ||
      intent.constraints.trim() ||
      intent.successCriteria.trim() ||
      intent.managerNotes.trim() ||
      intent.deadline)
  );
}

function compareRunsByRecency(
  left: ActiveIntentContextRunInput,
  right: ActiveIntentContextRunInput
) {
  return right.updatedAt - left.updatedAt;
}

function isPersistentFlowDiagnostic(input: WorkspaceDiagnostic): boolean {
  return (
    (input.source === "tsc" || input.source === "oxlint" || input.source === "cargo-check") &&
    (input.severity === "error" || input.severity === "warning")
  );
}

function dedupeFocusedFiles(
  files: ActiveIntentContextFocusedFile[]
): ActiveIntentContextFocusedFile[] {
  const deduped: ActiveIntentContextFocusedFile[] = [];
  const seenPaths = new Set<string>();
  for (const entry of files) {
    if (seenPaths.has(entry.path)) {
      continue;
    }
    seenPaths.add(entry.path);
    deduped.push(entry);
  }
  return deduped;
}

function dedupeValidationSummaries(summaries: string[]): string[] {
  return [...new Set(summaries.map(readTrimmedText).filter((entry) => entry !== null))];
}

function buildFocusedFiles(input: {
  changedPaths: string[];
  diagnostics: WorkspaceDiagnostic[];
}): ActiveIntentContextFocusedFile[] {
  const recentChangedFiles = input.changedPaths
    .map((path) => readTrimmedText(path))
    .filter((path): path is string => path !== null)
    .map((path) => ({
      path,
      reason: "recent_change" as const,
    }));
  const diagnosticFiles = input.diagnostics
    .map((item) => readTrimmedText(item.path))
    .filter((path): path is string => path !== null)
    .map((path) => ({
      path,
      reason: "diagnostic" as const,
    }));
  return dedupeFocusedFiles([...recentChangedFiles, ...diagnosticFiles]).slice(
    0,
    MAX_FOCUSED_FILES
  );
}

function buildUnresolvedErrors(diagnostics: WorkspaceDiagnostic[]): ActiveIntentContextError[] {
  return diagnostics
    .filter(isPersistentFlowDiagnostic)
    .map((item) => ({
      source: item.source,
      severity: item.severity,
      message: item.message,
      path: readTrimmedText(item.path),
      code: readTrimmedText(item.code),
      startLine: item.startLine,
      startColumn: item.startColumn,
      endLine: item.endLine,
      endColumn: item.endColumn,
    }))
    .slice(0, MAX_UNRESOLVED_ERRORS);
}

export function buildActiveIntentContext(
  input: BuildActiveIntentContextInput
): ActiveIntentContext {
  const runsByRecency = [...input.runs].sort(compareRunsByRecency);
  const latestRun = runsByRecency[0] ?? null;
  const recentChangedPaths = [...new Set((latestRun?.changedPaths ?? []).filter(Boolean))];
  const validationSummaries = dedupeValidationSummaries(
    runsByRecency.flatMap((run) => (run.validations ?? []).map((validation) => validation.summary))
  ).slice(0, MAX_VALIDATION_SUMMARIES);
  const unresolvedDiagnostics = input.diagnostics.items.filter(isPersistentFlowDiagnostic);
  const lastUpdatedAt =
    typeof input.diagnostics.generatedAtMs === "number" &&
    Number.isFinite(input.diagnostics.generatedAtMs)
      ? Math.max(latestRun?.updatedAt ?? 0, input.diagnostics.generatedAtMs)
      : (latestRun?.updatedAt ?? null);

  return {
    schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
    intent: {
      objective: input.intent.objective,
      constraints: input.intent.constraints,
      successCriteria: input.intent.successCriteria,
      deadline: input.intent.deadline,
      priority: input.intent.priority,
      managerNotes: input.intent.managerNotes,
    },
    focusedFiles: buildFocusedFiles({
      changedPaths: recentChangedPaths,
      diagnostics: unresolvedDiagnostics,
    }),
    unresolvedErrors: buildUnresolvedErrors(unresolvedDiagnostics),
    history: {
      latestRunId: latestRun?.id ?? null,
      latestRunTitle: readTrimmedText(latestRun?.title) ?? null,
      latestReviewPackId: readTrimmedText(latestRun?.reviewPackId) ?? null,
      lastUpdatedAt,
      recentChangedPaths,
      validationSummaries,
    },
  };
}

export function buildPersistentFlowIndicator(
  input: BuildPersistentFlowIndicatorInput
): PersistentFlowIndicator {
  if (input.loadState === "loading") {
    return {
      tone: "neutral",
      label: "Persistent flow state",
      detail: "Hydrating host-backed flow state for this workspace.",
      recovered: false,
    };
  }

  if (input.saveError) {
    return {
      tone: "warning",
      label: "Persistent flow state",
      detail: `Host-backed persistence is degraded: ${input.saveError}`,
      recovered: false,
    };
  }

  if (input.source === "host" && input.context) {
    return {
      tone: "success",
      label: "Recovered flow state",
      detail: "Recovered host-backed intent, file focus, and unresolved diagnostics.",
      recovered: true,
    };
  }

  if (input.source === "legacy_cache" && input.context) {
    return {
      tone: "warning",
      label: "Recovered cached intent",
      detail: input.legacyCacheCorrupted
        ? "Recovered from the last healthy local cache snapshot after ignoring corrupted cache data."
        : "Recovered from the local cache while host-backed persistence refreshes.",
      recovered: true,
    };
  }

  if (input.context) {
    return {
      tone: "neutral",
      label: "Persistent flow state",
      detail:
        "Host-backed persistent flow state is tracking current intent and workspace evidence.",
      recovered: false,
    };
  }

  return {
    tone: input.legacyCacheCorrupted ? "warning" : "neutral",
    label: "Persistent flow state",
    detail: input.legacyCacheCorrupted
      ? "Corrupted local cache was ignored. Host-backed flow state will republish from current runtime truth."
      : "Persistent flow state will appear once the workspace has intent or runtime evidence.",
    recovered: false,
  };
}

function createEmptyDiagnostics(): ActiveIntentContextDiagnosticsInput {
  return {
    generatedAtMs: null,
    items: [],
  };
}

function toAgentIntentState(
  intent: ActiveIntentContext["intent"] | AgentIntentState | null | undefined
): AgentIntentState | null {
  if (!intent) {
    return null;
  }
  return {
    objective: intent.objective,
    constraints: intent.constraints,
    successCriteria: intent.successCriteria,
    deadline: intent.deadline,
    priority: intent.priority,
    managerNotes: intent.managerNotes,
  };
}

function readPersistedActiveIntentContext(
  settings: Pick<AppSettings, "activeIntentContextByWorkspaceId">,
  workspaceId: string
): ActiveIntentContext | null {
  return settings.activeIntentContextByWorkspaceId?.[workspaceId] ?? null;
}

function resolvePersistenceErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to access host-backed persistent flow state.";
}

function hasMeaningfulActiveIntentContext(context: ActiveIntentContext): boolean {
  return Boolean(
    context.intent.objective.trim() ||
    context.focusedFiles.length > 0 ||
    context.unresolvedErrors.length > 0 ||
    context.history.latestRunId ||
    context.history.recentChangedPaths.length > 0 ||
    context.history.validationSummaries.length > 0
  );
}

function mergeActiveIntentContext(
  persistedContext: ActiveIntentContext | null,
  derivedContext: ActiveIntentContext
): ActiveIntentContext {
  if (!persistedContext) {
    return derivedContext;
  }

  return {
    ...derivedContext,
    focusedFiles:
      derivedContext.focusedFiles.length > 0
        ? derivedContext.focusedFiles
        : persistedContext.focusedFiles,
    unresolvedErrors:
      derivedContext.unresolvedErrors.length > 0
        ? derivedContext.unresolvedErrors
        : persistedContext.unresolvedErrors,
    history: {
      latestRunId: derivedContext.history.latestRunId ?? persistedContext.history.latestRunId,
      latestRunTitle:
        derivedContext.history.latestRunTitle ?? persistedContext.history.latestRunTitle,
      latestReviewPackId:
        derivedContext.history.latestReviewPackId ?? persistedContext.history.latestReviewPackId,
      lastUpdatedAt: derivedContext.history.lastUpdatedAt ?? persistedContext.history.lastUpdatedAt,
      recentChangedPaths:
        derivedContext.history.recentChangedPaths.length > 0
          ? derivedContext.history.recentChangedPaths
          : persistedContext.history.recentChangedPaths,
      validationSummaries:
        derivedContext.history.validationSummaries.length > 0
          ? derivedContext.history.validationSummaries
          : persistedContext.history.validationSummaries,
    },
  };
}

export function useWorkspacePersistentFlowState(
  input: UseWorkspacePersistentFlowStateInput
): WorkspacePersistentFlowState {
  const [persistedContext, setPersistedContext] = useState<ActiveIntentContext | null>(null);
  const [diagnostics, setDiagnostics] =
    useState<ActiveIntentContextDiagnosticsInput>(createEmptyDiagnostics);
  const [source, setSource] = useState<PersistentFlowHydrationSource>("none");
  const [loadState, setLoadState] = useState<PersistentFlowLoadState>("loading");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async (markLoading: boolean) => {
      if (markLoading) {
        setLoadState("loading");
      }
      try {
        const [settings, diagnosticsResponse] = await Promise.all([
          getAppSettings(),
          listWorkspaceDiagnostics({
            workspaceId: input.workspaceId,
            maxItems: MAX_UNRESOLVED_ERRORS,
            severities: ["error", "warning"],
            includeProviderDetails: true,
          }),
        ]);
        if (cancelled) {
          return;
        }
        const hostContext = readPersistedActiveIntentContext(settings, input.workspaceId);
        setPersistedContext(hostContext);
        setDiagnostics(
          diagnosticsResponse
            ? {
                generatedAtMs: diagnosticsResponse.generatedAtMs,
                items: diagnosticsResponse.items,
              }
            : createEmptyDiagnostics()
        );
        setSource(hostContext ? "host" : input.legacyCachedIntent ? "legacy_cache" : "none");
        setLoadState("ready");
        setSaveError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPersistedContext(null);
        setDiagnostics(createEmptyDiagnostics());
        setSource(input.legacyCachedIntent ? "legacy_cache" : "none");
        setLoadState("ready");
        setSaveError(resolvePersistenceErrorMessage(error));
      }
    };

    void hydrate(true);
    const unsubscribe = subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: input.workspaceId,
        scopes: ["bootstrap", "workspaces", "agents"],
      },
      () => {
        void hydrate(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [input.legacyCachedIntent, input.workspaceId]);

  const hydratedIntent =
    source === "host"
      ? toAgentIntentState(persistedContext?.intent)
      : source === "legacy_cache"
        ? input.legacyCachedIntent
        : null;
  const effectiveIntent =
    isMeaningfulIntent(input.intent) || !hydratedIntent ? input.intent : hydratedIntent;
  const derivedContext = mergeActiveIntentContext(
    persistedContext,
    buildActiveIntentContext({
      intent: effectiveIntent,
      runs: input.runs,
      diagnostics,
    })
  );
  const effectiveContext =
    persistedContext ?? (hasMeaningfulActiveIntentContext(derivedContext) ? derivedContext : null);

  useEffect(() => {
    if (loadState !== "ready" || !hasMeaningfulActiveIntentContext(derivedContext)) {
      return;
    }

    const persistedPayload = persistedContext ? JSON.stringify(persistedContext) : null;
    const nextPayload = JSON.stringify(derivedContext);
    if (persistedPayload === nextPayload) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const settings = await getAppSettings();
        if (cancelled) {
          return;
        }
        const saved = await updateAppSettings({
          ...settings,
          activeIntentContextByWorkspaceId: {
            ...(settings.activeIntentContextByWorkspaceId ?? {}),
            [input.workspaceId]: derivedContext,
          },
        });
        if (cancelled) {
          return;
        }
        setPersistedContext(
          readPersistedActiveIntentContext(saved, input.workspaceId) ?? derivedContext
        );
        setSaveError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSaveError(resolvePersistenceErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [derivedContext, input.workspaceId, loadState, persistedContext]);

  return {
    context: effectiveContext,
    hydratedIntent,
    source,
    loadState,
    saveError,
    indicator: buildPersistentFlowIndicator({
      source,
      context: effectiveContext,
      loadState,
      saveError,
      legacyCacheCorrupted: input.legacyCacheCorrupted,
    }),
  };
}

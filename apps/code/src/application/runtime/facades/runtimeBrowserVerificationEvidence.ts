import { useMemo, useSyncExternalStore } from "react";
import type {
  DesktopBrowserExtractionRequest,
  DesktopBrowserExtractionResult,
} from "@ku0/code-platform-interfaces";
import type { HugeCodeReviewArtifactRef } from "@ku0/code-runtime-host-contract";
import { trackProductAnalyticsEvent } from "../../../features/shared/productAnalytics";
import type { RuntimeBrowserReadinessSummary } from "../ports/browserCapability";

type RuntimeBrowserVerificationScope = {
  workspaceId: string;
  taskId: string;
  runId: string;
  reviewPackId?: string | null;
};

type RuntimeBrowserVerificationTelemetrySource = "mission_control" | "review_surface" | null;

export type RuntimeBrowserVerificationCandidate = {
  id: string;
  workspaceId: string;
  source: "extract" | "history";
  status: "pending" | "attached" | "ignored";
  capturedAt: number;
  input: {
    sourceUrl: string | null;
    selector: string | null;
  };
  result: DesktopBrowserExtractionResult;
  readinessState: RuntimeBrowserReadinessSummary["state"];
  readinessSource: RuntimeBrowserReadinessSummary["source"];
  readinessSourceLabel: string;
  runtimeHost: RuntimeBrowserReadinessSummary["runtimeHost"];
  attachmentScope: RuntimeBrowserVerificationScope | null;
};

export type RuntimeBrowserVerificationAttachment = RuntimeBrowserVerificationScope & {
  id: string;
  attachedAt: number;
  source: "extract" | "history";
  artifact: HugeCodeReviewArtifactRef;
  result: DesktopBrowserExtractionResult;
  input: {
    sourceUrl: string | null;
    selector: string | null;
  };
  sourceUrl: string | null;
  selector: string | null;
  traceId: string | null;
  readinessState: RuntimeBrowserReadinessSummary["state"];
  readinessSource: RuntimeBrowserReadinessSummary["source"];
  readinessSourceLabel: string;
  runtimeHost: RuntimeBrowserReadinessSummary["runtimeHost"];
  summary: string;
};

export type RuntimeBrowserVerificationEvent =
  | {
      kind: "triggered";
      workspaceId: string;
      input: {
        sourceUrl: string | null;
        selector: string | null;
      };
    }
  | {
      kind: "succeeded" | "failed";
      workspaceId: string;
      candidate: RuntimeBrowserVerificationCandidate;
    }
  | {
      kind: "attached";
      workspaceId: string;
      attachment: RuntimeBrowserVerificationAttachment;
    }
  | {
      kind: "ignored";
      workspaceId: string;
      scope: RuntimeBrowserVerificationScope | null;
    };

type RuntimeBrowserVerificationSnapshot = {
  candidate: RuntimeBrowserVerificationCandidate | null;
  attachments: RuntimeBrowserVerificationAttachment[];
};

const latestCandidatesByWorkspace = new Map<string, RuntimeBrowserVerificationCandidate>();
const attachmentsByScopeKey = new Map<string, RuntimeBrowserVerificationAttachment[]>();
const storeListeners = new Set<() => void>();
const eventListeners = new Set<(event: RuntimeBrowserVerificationEvent) => void>();
let storeVersion = 0;

function readTrimmedText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildScopeKey(input: RuntimeBrowserVerificationScope) {
  return [input.workspaceId, input.taskId, input.runId, input.reviewPackId?.trim() ?? ""].join(
    "::"
  );
}

function buildArtifactUri(input: RuntimeBrowserVerificationScope, evidenceId: string) {
  return `browser-verification://${input.workspaceId}/${input.taskId}/${input.runId}/${input.reviewPackId?.trim() ?? "mission-run"}/${evidenceId}`;
}

function notifyStoreListeners() {
  storeVersion += 1;
  for (const listener of storeListeners) {
    listener();
  }
}

function emitRuntimeBrowserVerificationEvent(event: RuntimeBrowserVerificationEvent) {
  for (const listener of eventListeners) {
    listener(event);
  }
}

function buildVerificationSummary(result: DesktopBrowserExtractionResult) {
  const target =
    readTrimmedText(result.title ?? null) ??
    readTrimmedText(result.sourceUrl ?? null) ??
    "the selected browser page";
  switch (result.status) {
    case "succeeded":
      return `Browser verification confirmed ${target}.`;
    case "partial":
      return `Browser verification captured truncated evidence from ${target}.`;
    case "empty":
      return `Browser verification reached ${target}, but no extractable text was recorded.`;
    case "failed":
    default:
      return `Browser verification failed for ${target}.`;
  }
}

function mapTelemetryEventName(
  event: RuntimeBrowserVerificationEvent["kind"]
): Parameters<typeof trackProductAnalyticsEvent>[0] {
  switch (event) {
    case "triggered":
      return "browser_verification_triggered";
    case "succeeded":
      return "browser_verification_succeeded";
    case "failed":
      return "browser_verification_failed";
    case "attached":
      return "browser_verification_attached";
    case "ignored":
      return "browser_verification_ignored";
  }
}

function recordTelemetryEvent(
  event: RuntimeBrowserVerificationEvent,
  input: {
    taskId?: string | null;
    runId?: string | null;
    reviewPackId?: string | null;
    eventSource?: RuntimeBrowserVerificationTelemetrySource;
  } = {}
) {
  void trackProductAnalyticsEvent(mapTelemetryEventName(event.kind), {
    workspaceId: event.workspaceId,
    taskId: input.taskId ?? null,
    runId: input.runId ?? null,
    reviewPackId: input.reviewPackId ?? null,
    eventSource: input.eventSource ?? null,
  });
}

function buildCandidateId(result: DesktopBrowserExtractionResult) {
  return readTrimmedText(result.traceId) ?? `browser-verification-${Date.now()}`;
}

function buildCandidate(input: {
  workspaceId: string;
  readiness: RuntimeBrowserReadinessSummary;
  source: RuntimeBrowserVerificationCandidate["source"];
  request?: DesktopBrowserExtractionRequest;
  result: DesktopBrowserExtractionResult;
}): RuntimeBrowserVerificationCandidate {
  return {
    id: buildCandidateId(input.result),
    workspaceId: input.workspaceId,
    source: input.source,
    status: "pending",
    capturedAt: Date.now(),
    input: {
      sourceUrl: readTrimmedText(input.request?.sourceUrl),
      selector: readTrimmedText(input.request?.selector),
    },
    result: input.result,
    readinessState: input.readiness.state,
    readinessSource: input.readiness.source,
    readinessSourceLabel: input.readiness.sourceLabel,
    runtimeHost: input.readiness.runtimeHost,
    attachmentScope: null,
  };
}

export function recordRuntimeBrowserVerificationTriggered(input: {
  workspaceId: string;
  readiness: RuntimeBrowserReadinessSummary;
  input?: DesktopBrowserExtractionRequest;
  eventSource?: RuntimeBrowserVerificationTelemetrySource;
}) {
  const event: RuntimeBrowserVerificationEvent = {
    kind: "triggered",
    workspaceId: input.workspaceId,
    input: {
      sourceUrl: readTrimmedText(input.input?.sourceUrl),
      selector: readTrimmedText(input.input?.selector),
    },
  };
  emitRuntimeBrowserVerificationEvent(event);
  recordTelemetryEvent(event, {
    eventSource: input.eventSource ?? null,
  });
}

export function recordRuntimeBrowserVerificationResult(input: {
  workspaceId: string;
  readiness: RuntimeBrowserReadinessSummary;
  source: RuntimeBrowserVerificationCandidate["source"];
  input?: DesktopBrowserExtractionRequest;
  result: DesktopBrowserExtractionResult;
  eventSource?: RuntimeBrowserVerificationTelemetrySource;
}) {
  const candidate = buildCandidate({
    workspaceId: input.workspaceId,
    readiness: input.readiness,
    source: input.source,
    request: input.input,
    result: input.result,
  });
  latestCandidatesByWorkspace.set(input.workspaceId, candidate);
  notifyStoreListeners();

  if (input.source !== "extract") {
    return candidate;
  }

  const event: RuntimeBrowserVerificationEvent = {
    kind:
      input.result.status === "succeeded" || input.result.status === "partial"
        ? "succeeded"
        : "failed",
    workspaceId: input.workspaceId,
    candidate,
  };
  emitRuntimeBrowserVerificationEvent(event);
  recordTelemetryEvent(event, {
    eventSource: input.eventSource ?? null,
  });
  return candidate;
}

export function readRuntimeBrowserVerificationCandidate(workspaceId: string) {
  return latestCandidatesByWorkspace.get(workspaceId) ?? null;
}

export function attachRuntimeBrowserVerificationEvidence(
  input: RuntimeBrowserVerificationScope & {
    eventSource?: RuntimeBrowserVerificationTelemetrySource;
  }
) {
  const candidate = latestCandidatesByWorkspace.get(input.workspaceId);
  if (!candidate || candidate.status !== "pending") {
    return null;
  }

  const attachment: RuntimeBrowserVerificationAttachment = {
    ...input,
    id: candidate.id,
    attachedAt: Date.now(),
    source: candidate.source,
    artifact: {
      id: candidate.id,
      label: "Browser verification",
      kind: "evidence",
      uri: buildArtifactUri(input, candidate.id),
    },
    result: candidate.result,
    input: candidate.input,
    sourceUrl: candidate.input.sourceUrl,
    selector: candidate.input.selector,
    traceId: candidate.result.traceId,
    readinessState: candidate.readinessState,
    readinessSource: candidate.readinessSource,
    readinessSourceLabel: candidate.readinessSourceLabel,
    runtimeHost: candidate.runtimeHost,
    summary: buildVerificationSummary(candidate.result),
  };

  const scopeKey = buildScopeKey(input);
  const existing = attachmentsByScopeKey.get(scopeKey) ?? [];
  attachmentsByScopeKey.set(scopeKey, [...existing, attachment]);
  latestCandidatesByWorkspace.set(input.workspaceId, {
    ...candidate,
    status: "attached",
    attachmentScope: {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      runId: input.runId,
      reviewPackId: input.reviewPackId ?? null,
    },
  });
  notifyStoreListeners();

  const event: RuntimeBrowserVerificationEvent = {
    kind: "attached",
    workspaceId: input.workspaceId,
    attachment,
  };
  emitRuntimeBrowserVerificationEvent(event);
  recordTelemetryEvent(event, {
    taskId: input.taskId,
    runId: input.runId,
    reviewPackId: input.reviewPackId ?? null,
    eventSource: input.eventSource ?? null,
  });
  return attachment;
}

export function ignoreRuntimeBrowserVerificationCandidate(
  input: Partial<RuntimeBrowserVerificationScope> & {
    workspaceId: string;
    eventSource?: RuntimeBrowserVerificationTelemetrySource;
  }
) {
  const candidate = latestCandidatesByWorkspace.get(input.workspaceId);
  if (!candidate || candidate.status !== "pending") {
    return false;
  }
  latestCandidatesByWorkspace.set(input.workspaceId, {
    ...candidate,
    status: "ignored",
  });
  notifyStoreListeners();
  const scope =
    input.taskId && input.runId
      ? {
          workspaceId: input.workspaceId,
          taskId: input.taskId,
          runId: input.runId,
          reviewPackId: input.reviewPackId ?? null,
        }
      : null;
  const event: RuntimeBrowserVerificationEvent = {
    kind: "ignored",
    workspaceId: input.workspaceId,
    scope,
  };
  emitRuntimeBrowserVerificationEvent(event);
  recordTelemetryEvent(event, {
    taskId: input.taskId ?? null,
    runId: input.runId ?? null,
    reviewPackId: input.reviewPackId ?? null,
    eventSource: input.eventSource ?? null,
  });
  return true;
}

export function listRuntimeBrowserVerificationAttachments(input: RuntimeBrowserVerificationScope) {
  return attachmentsByScopeKey.get(buildScopeKey(input)) ?? [];
}

function readRuntimeBrowserVerificationSnapshot(
  input: RuntimeBrowserVerificationScope | { workspaceId: string; taskId?: null; runId?: null }
): RuntimeBrowserVerificationSnapshot {
  const candidate = readRuntimeBrowserVerificationCandidate(input.workspaceId);
  const attachments =
    "taskId" in input && input.taskId && input.runId
      ? listRuntimeBrowserVerificationAttachments({
          workspaceId: input.workspaceId,
          taskId: input.taskId,
          runId: input.runId,
          reviewPackId: input.reviewPackId ?? null,
        })
      : [];
  return {
    candidate,
    attachments,
  };
}

export function subscribeRuntimeBrowserVerificationStore(listener: () => void) {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

export function subscribeRuntimeBrowserVerificationEvents(
  listener: (event: RuntimeBrowserVerificationEvent) => void
) {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function useRuntimeBrowserVerificationEvidence(input: {
  workspaceId: string | null;
  taskId?: string | null;
  runId?: string | null;
  reviewPackId?: string | null;
}) {
  const version = useSyncExternalStore(
    subscribeRuntimeBrowserVerificationStore,
    () => storeVersion,
    () => 0
  );
  return useMemo(
    () =>
      input.workspaceId
        ? readRuntimeBrowserVerificationSnapshot({
            workspaceId: input.workspaceId,
            taskId: input.taskId ?? null,
            runId: input.runId ?? null,
            reviewPackId: input.reviewPackId ?? null,
          })
        : { candidate: null, attachments: [] },
    [input.reviewPackId, input.runId, input.taskId, input.workspaceId, version]
  );
}

export function __resetRuntimeBrowserVerificationEvidenceForTests() {
  latestCandidatesByWorkspace.clear();
  attachmentsByScopeKey.clear();
  storeListeners.clear();
  eventListeners.clear();
  storeVersion = 0;
}

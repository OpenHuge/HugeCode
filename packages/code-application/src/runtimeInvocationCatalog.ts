import type {
  RuntimeExtensionActivationSnapshot,
  RuntimeExtensionContributionDescriptor,
} from "@ku0/code-runtime-host-contract";
import type {
  RuntimeInvocationCatalogSnapshot,
  RuntimeInvocationDescriptor,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

const INVOCABLE_CONTRIBUTION_KINDS = new Set<RuntimeInvocationDescriptor["kind"]>([
  "invocation",
  "skill",
  "route",
  "host_binding",
]);

function isRuntimeInvocationKind(
  kind: RuntimeExtensionContributionDescriptor["kind"]
): kind is RuntimeInvocationDescriptor["kind"] {
  return INVOCABLE_CONTRIBUTION_KINDS.has(kind as RuntimeInvocationDescriptor["kind"]);
}

function isInvocableContribution(
  contribution: RuntimeExtensionContributionDescriptor
): contribution is RuntimeExtensionContributionDescriptor & {
  kind: RuntimeInvocationDescriptor["kind"];
} {
  return isRuntimeInvocationKind(contribution.kind);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function readRuntimeInvocationPromptOverlayMetadata(metadata: unknown): {
  promptId: string | null;
  scope: string | null;
} | null {
  const promptOverlay = asRecord(asRecord(metadata)?.promptOverlay);
  return promptOverlay
    ? {
        promptId: readString(promptOverlay, "promptId"),
        scope: readString(promptOverlay, "scope"),
      }
    : null;
}

function normalizeInvocationDiagnostics(
  diagnostics: RuntimeExtensionActivationSnapshot["records"][number]["diagnostics"]
): RuntimeInvocationDescriptor["diagnostics"] {
  return diagnostics.map((diagnostic) => ({ ...diagnostic }));
}

function toInvocationDescriptor(input: {
  record: RuntimeExtensionActivationSnapshot["records"][number];
  contribution: RuntimeExtensionContributionDescriptor & {
    kind: RuntimeInvocationDescriptor["kind"];
  };
  live: boolean;
}): RuntimeInvocationDescriptor {
  const { contribution, live, record } = input;
  return {
    id: contribution.id,
    title: contribution.title,
    version: record.version,
    kind: contribution.kind,
    bindingStage: contribution.bindingStage,
    live,
    activationState: record.state,
    readiness: record.readiness,
    diagnostics: normalizeInvocationDiagnostics(record.diagnostics),
    transitionHistory: record.transitionHistory.map((entry) => ({ ...entry })),
    source: {
      activationId: record.activationId,
      sourceType: record.sourceType,
      sourceScope: record.sourceScope,
      sourceRef: record.sourceRef,
      pluginId: record.pluginId,
      packageRef: record.packageRef,
      overlayId: record.overlayId,
      sessionId: record.sessionId,
    },
    metadata:
      record.metadata || contribution.metadata
        ? {
            ...(record.metadata ?? {}),
            ...(contribution.metadata ?? {}),
          }
        : null,
  };
}

function buildSummary(
  entries: RuntimeInvocationDescriptor[]
): RuntimeInvocationCatalogSnapshot["summary"] {
  return entries.reduce<RuntimeInvocationCatalogSnapshot["summary"]>(
    (summary, entry) => {
      summary.total += 1;
      if (entry.activationState === "active") {
        summary.active += 1;
      } else if (entry.activationState === "degraded") {
        summary.degraded += 1;
      } else if (entry.activationState === "failed") {
        summary.failed += 1;
      } else if (entry.activationState === "deactivated") {
        summary.deactivated += 1;
      } else if (entry.activationState === "refresh_pending") {
        summary.refreshPending += 1;
      }
      return summary;
    },
    {
      total: 0,
      active: 0,
      degraded: 0,
      failed: 0,
      deactivated: 0,
      refreshPending: 0,
    }
  );
}

export function normalizeRuntimeInvocationCatalogSnapshot(
  snapshot: RuntimeExtensionActivationSnapshot
): RuntimeInvocationCatalogSnapshot {
  const liveContributionIds = new Set(
    snapshot.activeContributions.map((contribution) => contribution.id)
  );
  const entries = snapshot.records.flatMap((record) =>
    record.contributions.filter(isInvocableContribution).map((contribution) =>
      toInvocationDescriptor({
        record,
        contribution,
        live: liveContributionIds.has(contribution.id),
      })
    )
  );
  const activeEntries = entries.filter((entry) => entry.live);

  return {
    workspaceId: snapshot.workspaceId,
    sessionId: snapshot.sessionId,
    refreshedAt: snapshot.refreshedAt,
    entries,
    activeEntries,
    summary: buildSummary(entries),
  };
}

export function listRuntimeInvocationDescriptors(
  snapshot: RuntimeInvocationCatalogSnapshot,
  input?: {
    activeOnly?: boolean | null;
    kind?: RuntimeInvocationDescriptor["kind"] | null;
  }
): RuntimeInvocationDescriptor[] {
  return (input?.activeOnly ? snapshot.activeEntries : snapshot.entries).filter(
    (entry) => !input?.kind || entry.kind === input.kind
  );
}

export function resolveRuntimeInvocationDescriptor(
  snapshot: RuntimeInvocationCatalogSnapshot,
  input: {
    invocationId: string;
  }
): RuntimeInvocationDescriptor | null {
  return snapshot.entries.find((entry) => entry.id === input.invocationId) ?? null;
}

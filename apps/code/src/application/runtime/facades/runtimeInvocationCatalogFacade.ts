import type {
  RuntimeInvocationCatalogSnapshot,
  RuntimeInvocationDescriptor,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import type {
  RuntimeExtensionActivationDiagnostic,
  RuntimeExtensionActivationRecord,
  RuntimeExtensionActivationService,
  RuntimeExtensionActivationSnapshot,
  RuntimeExtensionContributionDescriptor,
} from "../kernel/runtimeExtensionActivation";

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

export type RuntimeInvocationCatalogFacade = {
  readSnapshot: (input?: {
    sessionId?: string | null;
  }) => Promise<RuntimeInvocationCatalogSnapshot>;
  listInvocations: (input?: {
    sessionId?: string | null;
    activeOnly?: boolean | null;
    kind?: RuntimeInvocationDescriptor["kind"] | null;
  }) => Promise<RuntimeInvocationDescriptor[]>;
  resolveInvocation: (input: {
    invocationId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeInvocationDescriptor | null>;
};

function isInvocableContribution(
  contribution: RuntimeExtensionContributionDescriptor
): contribution is RuntimeExtensionContributionDescriptor & {
  kind: RuntimeInvocationDescriptor["kind"];
} {
  return isRuntimeInvocationKind(contribution.kind);
}

function normalizeInvocationDiagnostics(
  diagnostics: RuntimeExtensionActivationDiagnostic[]
): RuntimeInvocationDescriptor["diagnostics"] {
  return diagnostics.map((diagnostic) => ({ ...diagnostic }));
}

function toInvocationDescriptor(input: {
  record: RuntimeExtensionActivationRecord;
  contribution: RuntimeExtensionContributionDescriptor & {
    kind: RuntimeInvocationDescriptor["kind"];
  };
  live: boolean;
}): RuntimeInvocationDescriptor {
  const { record, contribution, live } = input;
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

function normalizeInvocationCatalogSnapshot(
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

export function createRuntimeInvocationCatalogFacade(input: {
  activation: RuntimeExtensionActivationService;
}): RuntimeInvocationCatalogFacade {
  async function readSnapshot(inputOptions?: {
    sessionId?: string | null;
  }): Promise<RuntimeInvocationCatalogSnapshot> {
    return normalizeInvocationCatalogSnapshot(await input.activation.readSnapshot(inputOptions));
  }

  return {
    readSnapshot,
    listInvocations: async (inputOptions) => {
      const snapshot = await readSnapshot({
        sessionId: inputOptions?.sessionId ?? null,
      });
      return (inputOptions?.activeOnly ? snapshot.activeEntries : snapshot.entries).filter(
        (entry) => !inputOptions?.kind || entry.kind === inputOptions.kind
      );
    },
    resolveInvocation: async (inputOptions) => {
      const snapshot = await readSnapshot({
        sessionId: inputOptions.sessionId ?? null,
      });
      return snapshot.entries.find((entry) => entry.id === inputOptions.invocationId) ?? null;
    },
  };
}

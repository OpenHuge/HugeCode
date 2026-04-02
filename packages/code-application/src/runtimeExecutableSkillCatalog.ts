import type {
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  LiveSkillSummary,
} from "@ku0/code-runtime-host-contract";
import type {
  RuntimeExecutableSkillCatalog,
  RuntimeExecutableSkillCatalogEntry,
  RuntimeExecutableSkillResolution,
  RuntimeInvocationDescriptor,
  RuntimeSkillIdResolution,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import {
  canonicalizeLiveSkillId,
  listAcceptedLiveSkillIds,
  listAcceptedLiveSkillIdsFromCatalogSkill,
  normalizeLiveSkillLookupId,
} from "./runtimeLiveSkillAliases";

export type RuntimeExecutableSkillAvailability = NonNullable<
  RuntimeSkillIdResolution["availability"]
>;

export type RuntimeExecutableSkillPublicationStatus =
  RuntimeExecutableSkillAvailability["publicationStatus"];

export type RuntimeSkillExecutionGateErrorCode =
  | "unknown_skill"
  | "catalog_unavailable"
  | "deactivated"
  | "failed"
  | "refresh_pending"
  | "not_live";

export class RuntimeSkillExecutionGateError extends Error {
  readonly code: RuntimeSkillExecutionGateErrorCode;
  readonly requestedSkillId: string;
  readonly resolvedSkillId: string | null;
  readonly availability: RuntimeExecutableSkillAvailability | null;
  readonly activationState: RuntimeExecutableSkillAvailability["activationState"] | null;
  readonly readiness: RuntimeExecutableSkillAvailability["readiness"] | null;

  constructor(input: {
    code: RuntimeSkillExecutionGateErrorCode;
    requestedSkillId: string;
    resolvedSkillId?: string | null;
    availability?: RuntimeExecutableSkillAvailability | null;
    message: string;
  }) {
    super(input.message);
    this.name = "RuntimeSkillExecutionGateError";
    this.code = input.code;
    this.requestedSkillId = input.requestedSkillId;
    this.resolvedSkillId = input.resolvedSkillId ?? null;
    this.availability = input.availability ?? null;
    this.activationState = input.availability?.activationState ?? null;
    this.readiness = input.availability?.readiness ?? null;
  }
}

type RuntimeExecutableSkillCatalogIndex = {
  catalogSessionId: string | null;
  fallbackToLegacyTransport: boolean;
  knownSkillIds: Set<string>;
  canonicalSkillIdByAcceptedId: Map<string, string>;
  acceptedSkillIdsByCanonicalId: Map<string, string[]>;
  entriesByCanonicalSkillId: Map<string, RuntimeExecutableSkillCatalogEntry>;
};

function isRuntimeExecutableSkillInvocation(entry: RuntimeInvocationDescriptor): boolean {
  return (
    entry.kind === "skill" &&
    ((typeof entry.metadata?.runtimeSkillId === "string" &&
      entry.metadata.runtimeSkillId.trim().length > 0) ||
      (typeof entry.source.pluginId === "string" && entry.source.pluginId.trim().length > 0))
  );
}

export function buildRuntimeExecutableSkillPublicationStatus(
  live: boolean
): RuntimeExecutableSkillPublicationStatus {
  return live ? "published" : "hidden";
}

export function buildRuntimeExecutableSkillPublicationReason(input: {
  canonicalSkillId: string;
  availability: Pick<
    RuntimeExecutableSkillAvailability,
    "activationState" | "live" | "readiness" | "publicationStatus"
  >;
  source: "activation" | "legacy_fallback";
}): string {
  const { canonicalSkillId, availability, source } = input;
  if (source === "legacy_fallback") {
    return `${availability.publicationStatus === "published" ? "Published" : "Hidden"} because legacy runtime skill ${canonicalSkillId} is available via live-skill fallback while activation-backed invocation data is unavailable.`;
  }
  return `${availability.publicationStatus === "published" ? "Published" : "Hidden"} because activation-backed runtime skill ${canonicalSkillId} is ${availability.activationState}: ${availability.readiness.summary}`;
}

function buildLegacyReadyAvailability(
  canonicalSkillId: string
): RuntimeExecutableSkillAvailability {
  const publicationStatus = buildRuntimeExecutableSkillPublicationStatus(true);
  return {
    invocationId: null,
    live: true,
    activationState: "active",
    publicationStatus,
    publicationReason: buildRuntimeExecutableSkillPublicationReason({
      canonicalSkillId,
      availability: {
        live: true,
        activationState: "active",
        publicationStatus,
        readiness: {
          state: "ready",
          summary: "Legacy live skill listing reports this skill as available.",
          detail:
            "Activation-backed invocation data is unavailable, so legacy live skill transport is being used.",
        },
      },
      source: "legacy_fallback",
    }),
    readiness: {
      state: "ready",
      summary: "Legacy live skill listing reports this skill as available.",
      detail:
        "Activation-backed invocation data is unavailable, so legacy live skill transport is being used.",
    },
  };
}

function buildInvocationAvailability(
  canonicalSkillId: string,
  entry: RuntimeInvocationDescriptor
): RuntimeExecutableSkillAvailability {
  const publicationStatus = buildRuntimeExecutableSkillPublicationStatus(entry.live);
  return {
    invocationId: entry.id,
    live: entry.live,
    activationState: entry.activationState,
    publicationStatus,
    publicationReason: buildRuntimeExecutableSkillPublicationReason({
      canonicalSkillId,
      availability: {
        live: entry.live,
        activationState: entry.activationState,
        publicationStatus,
        readiness: {
          ...entry.readiness,
        },
      },
      source: "activation",
    }),
    readiness: {
      ...entry.readiness,
    },
  };
}

function shouldPreferSkillEntry(
  nextEntry: RuntimeInvocationDescriptor,
  currentEntry: RuntimeExecutableSkillCatalogEntry | undefined
): boolean {
  if (!currentEntry) {
    return true;
  }
  if (nextEntry.live !== currentEntry.availability.live) {
    return nextEntry.live;
  }
  if (
    nextEntry.source.sourceScope !== "session_overlay" &&
    currentEntry.availability.invocationId
  ) {
    return false;
  }
  if (
    nextEntry.source.sourceScope === "session_overlay" &&
    currentEntry.availability.invocationId
  ) {
    return true;
  }
  return false;
}

function buildLegacyCatalogIndex(
  liveSkills: LiveSkillSummary[]
): RuntimeExecutableSkillCatalogIndex {
  const knownSkillIds = new Set<string>();
  const canonicalSkillIdByAcceptedId = new Map<string, string>();
  const acceptedSkillIdsByCanonicalId = new Map<string, string[]>();
  const entriesByCanonicalSkillId = new Map<string, RuntimeExecutableSkillCatalogEntry>();

  for (const skill of liveSkills) {
    const canonicalSkillId = canonicalizeLiveSkillId(skill.id) ?? skill.id.trim();
    const acceptedSkillIds = listAcceptedLiveSkillIdsFromCatalogSkill(skill);
    const acceptedEntryLookup = new Set(
      (acceptedSkillIdsByCanonicalId.get(canonicalSkillId) ?? []).map((entry) =>
        normalizeLiveSkillLookupId(entry)
      )
    );
    const acceptedEntries = acceptedSkillIdsByCanonicalId.get(canonicalSkillId) ?? [];
    for (const acceptedSkillId of acceptedSkillIds) {
      const normalizedAcceptedSkillId = normalizeLiveSkillLookupId(acceptedSkillId);
      if (!acceptedEntryLookup.has(normalizedAcceptedSkillId)) {
        acceptedEntries.push(acceptedSkillId);
        acceptedEntryLookup.add(normalizedAcceptedSkillId);
      }
      knownSkillIds.add(normalizedAcceptedSkillId);
      canonicalSkillIdByAcceptedId.set(normalizedAcceptedSkillId, canonicalSkillId);
    }
    acceptedSkillIdsByCanonicalId.set(canonicalSkillId, acceptedEntries);
    entriesByCanonicalSkillId.set(canonicalSkillId, {
      canonicalSkillId,
      runtimeSkillId: canonicalSkillId,
      acceptedSkillIds: acceptedEntries,
      availability: buildLegacyReadyAvailability(canonicalSkillId),
      source: null,
      metadata: null,
    });
  }

  return {
    catalogSessionId: null,
    fallbackToLegacyTransport: true,
    knownSkillIds,
    canonicalSkillIdByAcceptedId,
    acceptedSkillIdsByCanonicalId,
    entriesByCanonicalSkillId,
  };
}

function buildActivationCatalogIndex(
  skillInvocations: RuntimeInvocationDescriptor[],
  catalogSessionId: string | null
): RuntimeExecutableSkillCatalogIndex {
  const knownSkillIds = new Set<string>();
  const canonicalSkillIdByAcceptedId = new Map<string, string>();
  const acceptedSkillIdsByCanonicalId = new Map<string, string[]>();
  const entriesByCanonicalSkillId = new Map<string, RuntimeExecutableSkillCatalogEntry>();

  for (const entry of skillInvocations) {
    const canonicalSkillId = canonicalizeLiveSkillId(entry.id) ?? entry.id.trim();
    const aliases = Array.isArray(entry.metadata?.aliases)
      ? entry.metadata.aliases.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      : [];
    const acceptedSkillIds = listAcceptedLiveSkillIdsFromCatalogSkill({
      id: entry.id,
      aliases,
    });
    const acceptedEntries = acceptedSkillIdsByCanonicalId.get(canonicalSkillId) ?? [];
    const acceptedEntryLookup = new Set(
      acceptedEntries.map((acceptedSkillId) => normalizeLiveSkillLookupId(acceptedSkillId))
    );
    for (const acceptedSkillId of acceptedSkillIds) {
      const normalizedAcceptedSkillId = normalizeLiveSkillLookupId(acceptedSkillId);
      if (!acceptedEntryLookup.has(normalizedAcceptedSkillId)) {
        acceptedEntries.push(acceptedSkillId);
        acceptedEntryLookup.add(normalizedAcceptedSkillId);
      }
      knownSkillIds.add(normalizedAcceptedSkillId);
      canonicalSkillIdByAcceptedId.set(normalizedAcceptedSkillId, canonicalSkillId);
    }
    acceptedSkillIdsByCanonicalId.set(canonicalSkillId, acceptedEntries);
    if (!shouldPreferSkillEntry(entry, entriesByCanonicalSkillId.get(canonicalSkillId))) {
      continue;
    }
    entriesByCanonicalSkillId.set(canonicalSkillId, {
      canonicalSkillId,
      runtimeSkillId:
        (typeof entry.metadata?.runtimeSkillId === "string" && entry.metadata.runtimeSkillId) ||
        entry.source.pluginId ||
        canonicalSkillId,
      acceptedSkillIds: acceptedEntries,
      availability: buildInvocationAvailability(canonicalSkillId, entry),
      source: {
        ...entry.source,
      },
      metadata: entry.metadata ? { ...entry.metadata } : null,
    });
  }

  return {
    catalogSessionId,
    fallbackToLegacyTransport: false,
    knownSkillIds,
    canonicalSkillIdByAcceptedId,
    acceptedSkillIdsByCanonicalId,
    entriesByCanonicalSkillId,
  };
}

function buildCatalogFromIndex(
  index: RuntimeExecutableSkillCatalogIndex
): RuntimeExecutableSkillCatalog {
  const entries = [...index.entriesByCanonicalSkillId.values()].sort((left, right) =>
    left.canonicalSkillId.localeCompare(right.canonicalSkillId)
  );
  return {
    catalogSessionId: index.catalogSessionId,
    fallbackToLegacyTransport: index.fallbackToLegacyTransport,
    entries,
  };
}

export async function readRuntimeExecutableSkillCatalog(input: {
  sessionId?: string | null;
  listRuntimeInvocations?:
    | ((input?: {
        sessionId?: string | null;
        activeOnly?: boolean | null;
        kind?: RuntimeInvocationDescriptor["kind"] | null;
      }) => Promise<RuntimeInvocationDescriptor[]>)
    | null;
  listLiveSkills?: (() => Promise<LiveSkillSummary[]>) | null;
}): Promise<RuntimeExecutableSkillCatalog> {
  const sessionId = input.sessionId ?? null;
  if (!input.listRuntimeInvocations && !input.listLiveSkills) {
    return {
      catalogSessionId: sessionId,
      fallbackToLegacyTransport: false,
      entries: [],
    };
  }
  if (input.listRuntimeInvocations) {
    const skillInvocations = (
      await input.listRuntimeInvocations({
        sessionId,
        kind: "skill",
      })
    ).filter(isRuntimeExecutableSkillInvocation);
    return buildCatalogFromIndex(buildActivationCatalogIndex(skillInvocations, sessionId));
  }

  const liveSkills = input.listLiveSkills ? await input.listLiveSkills() : [];
  return buildCatalogFromIndex(buildLegacyCatalogIndex(liveSkills));
}

export function resolveRuntimeExecutableSkill(
  catalog: RuntimeExecutableSkillCatalog,
  input: {
    skillId: string;
  }
): RuntimeExecutableSkillResolution {
  const requestedSkillId = input.skillId.trim();
  const acceptedSkillIds = listAcceptedLiveSkillIds(requestedSkillId);
  const matchedEntry =
    catalog.entries.find((entry) =>
      acceptedSkillIds.some(
        (acceptedSkillId) =>
          entry.acceptedSkillIds.some(
            (candidate) =>
              normalizeLiveSkillLookupId(candidate) === normalizeLiveSkillLookupId(acceptedSkillId)
          ) ||
          normalizeLiveSkillLookupId(entry.canonicalSkillId) ===
            normalizeLiveSkillLookupId(acceptedSkillId)
      )
    ) ?? null;
  const resolvedSkillId =
    matchedEntry?.canonicalSkillId ?? canonicalizeLiveSkillId(requestedSkillId) ?? requestedSkillId;

  return {
    requestedSkillId,
    resolvedSkillId,
    aliasApplied:
      normalizeLiveSkillLookupId(resolvedSkillId) !== normalizeLiveSkillLookupId(requestedSkillId),
    acceptedSkillIds: matchedEntry?.acceptedSkillIds ?? acceptedSkillIds,
    availability: matchedEntry?.availability ?? null,
    runtimeSkillId: matchedEntry?.runtimeSkillId ?? resolvedSkillId,
    source: matchedEntry?.source ?? null,
    metadata: matchedEntry?.metadata ?? null,
  };
}

function buildGateError(input: {
  resolution: RuntimeExecutableSkillResolution;
  requestedSkillId: string;
}): RuntimeSkillExecutionGateError {
  const availability = input.resolution.availability;
  if (!availability) {
    return new RuntimeSkillExecutionGateError({
      code: "unknown_skill",
      requestedSkillId: input.requestedSkillId,
      resolvedSkillId: input.resolution.resolvedSkillId,
      availability: null,
      message: `Runtime executable skill \`${input.requestedSkillId}\` is not available.`,
    });
  }
  if (!availability.live) {
    const code =
      availability.activationState === "deactivated"
        ? "deactivated"
        : availability.activationState === "failed"
          ? "failed"
          : availability.activationState === "refresh_pending"
            ? "refresh_pending"
            : "not_live";
    return new RuntimeSkillExecutionGateError({
      code,
      requestedSkillId: input.requestedSkillId,
      resolvedSkillId: input.resolution.resolvedSkillId,
      availability,
      message:
        availability.readiness.detail ||
        `Runtime executable skill \`${input.requestedSkillId}\` is not currently live.`,
    });
  }
  return new RuntimeSkillExecutionGateError({
    code: "catalog_unavailable",
    requestedSkillId: input.requestedSkillId,
    resolvedSkillId: input.resolution.resolvedSkillId,
    availability,
    message: `Runtime executable skill catalog could not resolve \`${input.requestedSkillId}\`.`,
  });
}

export async function runRuntimeExecutableSkill(input: {
  catalog: RuntimeExecutableSkillCatalog;
  request: LiveSkillExecuteRequest;
  runLiveSkill: (request: LiveSkillExecuteRequest) => Promise<LiveSkillExecutionResult>;
}): Promise<LiveSkillExecutionResult> {
  const resolution = resolveRuntimeExecutableSkill(input.catalog, {
    skillId: input.request.skillId,
  });
  const availability = resolution.availability;

  if (!resolution.runtimeSkillId || !availability?.live) {
    throw buildGateError({
      resolution,
      requestedSkillId: input.request.skillId,
    });
  }

  return input.runLiveSkill({
    ...input.request,
    skillId: resolution.runtimeSkillId,
  });
}

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

type CreateRuntimeExecutableSkillFacadeInput = {
  listRuntimeInvocations?:
    | ((input?: {
        sessionId?: string | null;
        activeOnly?: boolean | null;
        kind?: RuntimeInvocationDescriptor["kind"] | null;
      }) => Promise<RuntimeInvocationDescriptor[]>)
    | null;
  listLiveSkills?: (() => Promise<LiveSkillSummary[]>) | null;
  runLiveSkill: (request: LiveSkillExecuteRequest) => Promise<LiveSkillExecutionResult>;
};

export type RuntimeExecutableSkillFacade = {
  readCatalog: (input?: { sessionId?: string | null }) => Promise<RuntimeExecutableSkillCatalog>;
  resolveSkill: (input: {
    skillId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeExecutableSkillResolution>;
  runSkill: (input: {
    request: LiveSkillExecuteRequest;
    sessionId?: string | null;
  }) => Promise<LiveSkillExecutionResult>;
};

function isRuntimeExecutableSkillInvocation(entry: RuntimeInvocationDescriptor): boolean {
  return (
    entry.kind === "skill" &&
    ((typeof entry.metadata?.runtimeSkillId === "string" &&
      entry.metadata.runtimeSkillId.trim().length > 0) ||
      (typeof entry.source.pluginId === "string" && entry.source.pluginId.trim().length > 0))
  );
}

function buildLegacyReadyAvailability(): RuntimeExecutableSkillAvailability {
  return {
    invocationId: null,
    live: true,
    activationState: "active",
    readiness: {
      state: "ready",
      summary: "Legacy live skill listing reports this skill as available.",
      detail:
        "Activation-backed invocation data is unavailable, so legacy live skill transport is being used.",
    },
  };
}

function buildInvocationAvailability(
  entry: RuntimeInvocationDescriptor
): RuntimeExecutableSkillAvailability {
  return {
    invocationId: entry.id,
    live: entry.live,
    activationState: entry.activationState,
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
      availability: buildLegacyReadyAvailability(),
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
      availability: buildInvocationAvailability(entry),
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

async function readCatalogIndex(
  input: CreateRuntimeExecutableSkillFacadeInput,
  sessionId: string | null
): Promise<RuntimeExecutableSkillCatalogIndex | null> {
  if (typeof input.listRuntimeInvocations === "function") {
    const skillInvocations = (
      await input.listRuntimeInvocations({
        sessionId,
        kind: "skill",
      })
    ).filter(isRuntimeExecutableSkillInvocation);
    return buildActivationCatalogIndex(skillInvocations, sessionId);
  }
  if (typeof input.listLiveSkills !== "function") {
    return null;
  }
  return buildLegacyCatalogIndex(await input.listLiveSkills());
}

function toCatalog(index: RuntimeExecutableSkillCatalogIndex): RuntimeExecutableSkillCatalog {
  return {
    catalogSessionId: index.catalogSessionId,
    fallbackToLegacyTransport: index.fallbackToLegacyTransport,
    entries: [...index.entriesByCanonicalSkillId.values()],
  };
}

function resolveSkillFromIndex(
  skillId: string,
  index: RuntimeExecutableSkillCatalogIndex | null
): RuntimeExecutableSkillResolution {
  const requestedSkillId = skillId.trim();
  const lookupId = normalizeLiveSkillLookupId(requestedSkillId);
  const resolvedSkillId =
    index?.canonicalSkillIdByAcceptedId.get(lookupId) ??
    canonicalizeLiveSkillId(requestedSkillId) ??
    requestedSkillId;
  const entry = index?.entriesByCanonicalSkillId.get(resolvedSkillId) ?? null;
  return {
    requestedSkillId,
    resolvedSkillId,
    aliasApplied: requestedSkillId !== resolvedSkillId,
    acceptedSkillIds:
      entry?.acceptedSkillIds ??
      index?.acceptedSkillIdsByCanonicalId.get(resolvedSkillId) ??
      listAcceptedLiveSkillIds(requestedSkillId),
    availability: entry?.availability ?? null,
    runtimeSkillId: entry?.runtimeSkillId ?? resolvedSkillId,
    source: entry?.source ?? null,
    metadata: entry?.metadata ?? null,
  };
}

function toNonLiveErrorCode(
  activationState: RuntimeExecutableSkillAvailability["activationState"]
): RuntimeSkillExecutionGateErrorCode {
  if (activationState === "deactivated") {
    return "deactivated";
  }
  if (activationState === "failed") {
    return "failed";
  }
  if (activationState === "refresh_pending") {
    return "refresh_pending";
  }
  return "not_live";
}

function assertRunnableResolution(resolution: RuntimeExecutableSkillResolution): void {
  if (!resolution.availability) {
    throw new RuntimeSkillExecutionGateError({
      code: "unknown_skill",
      requestedSkillId: resolution.requestedSkillId,
      resolvedSkillId: resolution.resolvedSkillId,
      message: `Unknown runtime skill \`${resolution.requestedSkillId}\`.`,
    });
  }
  if (resolution.availability.live) {
    return;
  }
  throw new RuntimeSkillExecutionGateError({
    code: toNonLiveErrorCode(resolution.availability.activationState),
    requestedSkillId: resolution.requestedSkillId,
    resolvedSkillId: resolution.resolvedSkillId,
    availability: resolution.availability,
    message: `Runtime skill \`${resolution.resolvedSkillId}\` is ${resolution.availability.activationState}: ${resolution.availability.readiness.summary}`,
  });
}

export function createRuntimeExecutableSkillFacade(
  input: CreateRuntimeExecutableSkillFacadeInput
): RuntimeExecutableSkillFacade {
  return {
    readCatalog: async (options) => {
      const index = await readCatalogIndex(input, options?.sessionId ?? null);
      if (!index) {
        return {
          catalogSessionId: options?.sessionId ?? null,
          fallbackToLegacyTransport: false,
          entries: [],
        };
      }
      return toCatalog(index);
    },
    resolveSkill: async (options) => {
      const index = await readCatalogIndex(input, options.sessionId ?? null);
      if (!index && typeof input.listLiveSkills !== "function") {
        throw new RuntimeSkillExecutionGateError({
          code: "catalog_unavailable",
          requestedSkillId: options.skillId,
          message:
            "Runtime executable skill catalog is unavailable because neither activation-backed invocation readers nor legacy live-skill listing are exposed.",
        });
      }
      return resolveSkillFromIndex(options.skillId, index);
    },
    runSkill: async (options) => {
      const resolution = await (async () => {
        const index = await readCatalogIndex(input, options.sessionId ?? null);
        if (!index && typeof input.listLiveSkills !== "function") {
          throw new RuntimeSkillExecutionGateError({
            code: "catalog_unavailable",
            requestedSkillId: options.request.skillId,
            message:
              "Runtime executable skill catalog is unavailable because neither activation-backed invocation readers nor legacy live-skill listing are exposed.",
          });
        }
        return resolveSkillFromIndex(options.request.skillId, index);
      })();
      assertRunnableResolution(resolution);
      return input.runLiveSkill({
        ...options.request,
        skillId: resolution.runtimeSkillId,
      });
    },
  };
}

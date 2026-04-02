import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import { canonicalizeLiveSkillId, listAcceptedLiveSkillIds } from "./runtimeClientLiveSkills";
import type {
  AgentCommandCenterSnapshot,
  RuntimeAgentControl,
  RuntimeInvocationDescriptor,
  WebMcpAgent,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import type { LiveSkillSummary } from "./runtimeLiveSkillsBridge";

type JsonRecord = Record<string, unknown>;

type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
  taskSupport?: "none" | "partial" | "full";
};

type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: WebMcpToolAnnotations;
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

type RuntimeLiveSkillToolHelpers = {
  buildResponse: (message: string, data: JsonRecord) => JsonRecord;
  toNonEmptyString: (value: unknown) => string | null;
};

type BuildListRuntimeLiveSkillsToolOptions = {
  snapshot: AgentCommandCenterSnapshot;
  runtimeControl: RuntimeAgentControl;
  helpers: RuntimeLiveSkillToolHelpers;
};

type RuntimeListedLiveSkill = LiveSkillSummary & {
  canonicalSkillId: string;
  isCanonicalId: boolean;
  acceptedSkillIds: string[];
  alternateSkillIds: string[];
  discoveredSkillIds: string[];
  invocationId: string | null;
  activationState: RuntimeInvocationDescriptor["activationState"] | null;
  readiness: RuntimeInvocationDescriptor["readiness"] | null;
};

function toInvocationLiveSkillSummary(skill: RuntimeInvocationDescriptor): RuntimeListedLiveSkill {
  const tags = Array.isArray(skill.metadata?.tags)
    ? skill.metadata.tags.filter((entry): entry is string => typeof entry === "string")
    : [];
  const canonicalSkillId = canonicalizeLiveSkillId(skill.id) ?? skill.id;
  const aliases = Array.isArray(skill.metadata?.aliases)
    ? skill.metadata.aliases.filter((entry): entry is string => typeof entry === "string")
    : [];
  const acceptedSkillIds = Array.from(
    new Set([skill.id, ...aliases, ...listAcceptedLiveSkillIds(skill.id)])
  );
  return {
    id: skill.id,
    name: skill.title,
    description:
      typeof skill.readiness.detail === "string" && skill.readiness.detail.length > 0
        ? skill.readiness.detail
        : skill.readiness.summary,
    kind:
      typeof skill.metadata?.kind === "string" && skill.metadata.kind.length > 0
        ? skill.metadata.kind
        : "runtime_skill",
    source:
      typeof skill.metadata?.source === "string" && skill.metadata.source.length > 0
        ? skill.metadata.source
        : skill.source.sourceScope,
    version: skill.version,
    enabled: skill.live,
    supportsNetwork: false,
    tags,
    aliases,
    canonicalSkillId,
    isCanonicalId: skill.id === canonicalSkillId,
    acceptedSkillIds,
    alternateSkillIds: acceptedSkillIds.filter((entry) => entry !== skill.id),
    discoveredSkillIds: [skill.id],
    invocationId: skill.id,
    activationState: skill.activationState,
    readiness: { ...skill.readiness },
  };
}

function isRuntimeExecutableSkillInvocation(skill: RuntimeInvocationDescriptor): boolean {
  return (
    skill.kind === "skill" &&
    ((typeof skill.metadata?.runtimeSkillId === "string" &&
      skill.metadata.runtimeSkillId.trim().length > 0) ||
      (typeof skill.source.pluginId === "string" && skill.source.pluginId.trim().length > 0))
  );
}

function buildListedRuntimeLiveSkill(
  skill: LiveSkillSummary | RuntimeListedLiveSkill
): RuntimeListedLiveSkill {
  const canonicalSkillId = canonicalizeLiveSkillId(skill.id) ?? skill.id;
  const runtimeAliases = Array.isArray(skill.aliases)
    ? skill.aliases.filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0
      )
    : [];
  const acceptedSkillIds = Array.from(
    new Set(
      runtimeAliases.length > 0 ? [skill.id, ...runtimeAliases] : listAcceptedLiveSkillIds(skill.id)
    )
  );
  return {
    ...skill,
    canonicalSkillId,
    isCanonicalId: skill.id === canonicalSkillId,
    acceptedSkillIds,
    alternateSkillIds: acceptedSkillIds.filter((entry) => entry !== skill.id),
    discoveredSkillIds: [skill.id],
    invocationId: "invocationId" in skill ? skill.invocationId : null,
    activationState: "activationState" in skill ? skill.activationState : null,
    readiness: "readiness" in skill ? skill.readiness : null,
  };
}

function sortRuntimeLiveSkills(
  left: Pick<RuntimeListedLiveSkill, "enabled" | "id" | "isCanonicalId">,
  right: Pick<RuntimeListedLiveSkill, "enabled" | "id" | "isCanonicalId">
): number {
  if (left.enabled !== right.enabled) {
    return left.enabled ? -1 : 1;
  }
  if (left.isCanonicalId !== right.isCanonicalId) {
    return left.isCanonicalId ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

function collapseRuntimeLiveSkillsToCanonical(
  skills: RuntimeListedLiveSkill[]
): RuntimeListedLiveSkill[] {
  const groupedSkills = new Map<string, RuntimeListedLiveSkill>();
  for (const skill of skills) {
    const existingSkill = groupedSkills.get(skill.canonicalSkillId);
    if (!existingSkill) {
      groupedSkills.set(skill.canonicalSkillId, skill);
      continue;
    }

    const preferredSkill = sortRuntimeLiveSkills(skill, existingSkill) < 0 ? skill : existingSkill;
    groupedSkills.set(skill.canonicalSkillId, {
      ...preferredSkill,
      discoveredSkillIds: Array.from(
        new Set([...existingSkill.discoveredSkillIds, ...skill.discoveredSkillIds])
      ).sort((left, right) => left.localeCompare(right)),
    });
  }
  return [...groupedSkills.values()];
}

export function buildListRuntimeLiveSkillsTool(
  options: BuildListRuntimeLiveSkillsToolOptions
): WebMcpToolDescriptor {
  const { snapshot, runtimeControl, helpers } = options;

  return {
    name: "list-runtime-live-skills",
    description:
      "List runtime live skills with canonical ids and accepted aliases so callers can choose the preferred skill id before execution.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        kind: { type: "string" },
        source: { type: "string" },
        tag: { type: "string" },
        enabled: { type: "boolean" },
        canonicalOnly: { type: "boolean" },
      },
    },
    execute: async (input) => {
      const sessionId = helpers.toNonEmptyString(input.sessionId);
      const requestedKind = helpers.toNonEmptyString(input.kind);
      const requestedSource = helpers.toNonEmptyString(input.source);
      const requestedTag = helpers.toNonEmptyString(input.tag)?.toLowerCase() ?? null;
      const enabledFilter = typeof input.enabled === "boolean" ? input.enabled : null;
      const canonicalOnly = input.canonicalOnly === true;
      const listedSkillsSource =
        typeof runtimeControl.listRuntimeInvocations === "function"
          ? (
              await runtimeControl.listRuntimeInvocations({
                sessionId,
                activeOnly: enabledFilter === true ? true : null,
                kind: "skill",
              })
            )
              .filter(isRuntimeExecutableSkillInvocation)
              .map((entry) => toInvocationLiveSkillSummary(entry))
          : typeof runtimeControl.listLiveSkills === "function"
            ? await runtimeControl.listLiveSkills()
            : null;
      if (!listedSkillsSource) {
        throw createRuntimeError({
          code: RUNTIME_MESSAGE_CODES.runtime.validation.methodUnavailable,
          message:
            "Tool list-runtime-live-skills is unavailable because no runtime skill or invocation catalog reader is implemented.",
        });
      }
      const listedSkills = listedSkillsSource
        .filter((skill) => {
          if (requestedKind && skill.kind !== requestedKind) {
            return false;
          }
          if (requestedSource && skill.source !== requestedSource) {
            return false;
          }
          if (requestedTag) {
            const hasTag = skill.tags.some((tag) => tag.toLowerCase() === requestedTag);
            if (!hasTag) {
              return false;
            }
          }
          if (enabledFilter !== null && skill.enabled !== enabledFilter) {
            return false;
          }
          return true;
        })
        .map((skill) => buildListedRuntimeLiveSkill(skill));
      const skills = (
        canonicalOnly ? collapseRuntimeLiveSkillsToCanonical(listedSkills) : listedSkills
      ).sort((left, right) => sortRuntimeLiveSkills(left, right));
      return helpers.buildResponse("Runtime live skills retrieved.", {
        workspaceId: snapshot.workspaceId,
        total: skills.length,
        canonicalOnly,
        skills,
      });
    },
    annotations: { readOnlyHint: true },
  };
}

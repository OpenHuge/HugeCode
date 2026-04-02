import { buildRuntimeExecutableSkillPublicationReason } from "@ku0/code-application/runtimeExecutableSkillCatalog";
import { createRuntimeExecutableSkillFacade } from "@ku0/code-application/runtimeExecutableSkillFacade";
import type {
  RuntimeAgentControl,
  RuntimeExecutableSkillCatalog,
  RuntimeSkillIdResolution,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type RuntimeSkillBackedToolBinding = {
  toolName: string;
  canonicalSkillId: string;
};

export type RuntimeSkillBackedToolPublicationEntry = {
  toolName: string;
  canonicalSkillId: string;
  status: "published" | "hidden";
  reason: string;
  availability: NonNullable<RuntimeSkillIdResolution["availability"]> | null;
};

export type RuntimeSkillBackedToolPublicationDecision = {
  hiddenToolNames: string[];
  publishedToolNames: string[];
  requiredSkillIds: string[];
  entries: RuntimeSkillBackedToolPublicationEntry[];
  availabilityByToolName: Map<string, NonNullable<RuntimeSkillIdResolution["availability"]> | null>;
};

const RUNTIME_SKILL_BACKED_TOOL_BINDINGS: RuntimeSkillBackedToolBinding[] = [
  { toolName: "search-workspace-files", canonicalSkillId: "core-grep" },
  { toolName: "list-workspace-tree", canonicalSkillId: "core-tree" },
  { toolName: "read-workspace-file", canonicalSkillId: "core-read" },
  { toolName: "write-workspace-file", canonicalSkillId: "core-write" },
  { toolName: "edit-workspace-file", canonicalSkillId: "core-edit" },
  { toolName: "execute-workspace-command", canonicalSkillId: "core-bash" },
  { toolName: "query-network-analysis", canonicalSkillId: "network-analysis" },
  { toolName: "run-runtime-computer-observe", canonicalSkillId: "core-computer-observe" },
];

async function readRuntimeExecutableSkillCatalog(
  runtimeControl: RuntimeAgentControl
): Promise<RuntimeExecutableSkillCatalog | null> {
  if (typeof runtimeControl.readRuntimeExecutableSkills === "function") {
    return runtimeControl.readRuntimeExecutableSkills({ sessionId: null });
  }
  if (
    typeof runtimeControl.listRuntimeInvocations !== "function" &&
    typeof runtimeControl.listLiveSkills !== "function"
  ) {
    return null;
  }
  return createRuntimeExecutableSkillFacade({
    listRuntimeInvocations: runtimeControl.listRuntimeInvocations,
    listLiveSkills: runtimeControl.listLiveSkills,
    runLiveSkill:
      typeof runtimeControl.runLiveSkill === "function"
        ? runtimeControl.runLiveSkill
        : async () => {
            throw new Error("runLiveSkill is unavailable.");
          },
  }).readCatalog({ sessionId: null });
}

export function buildRuntimeSkillBackedToolPublicationReason(input: {
  canonicalSkillId: string;
  availability: NonNullable<RuntimeSkillIdResolution["availability"]> | null;
  status: RuntimeSkillBackedToolPublicationEntry["status"];
}): string {
  const { canonicalSkillId, availability, status } = input;
  if (!availability) {
    return `Hidden because activation-backed runtime skill ${canonicalSkillId} is not present in the current executable skill catalog.`;
  }
  if (availability.publicationStatus === status) {
    return availability.publicationReason;
  }
  return buildRuntimeExecutableSkillPublicationReason({
    canonicalSkillId,
    availability: {
      live: availability.live,
      activationState: availability.activationState,
      publicationStatus: status,
      readiness: availability.readiness,
    },
    source: "activation",
  });
}

export async function readRuntimeSkillBackedToolPublicationDecision(
  runtimeControl: RuntimeAgentControl | null | undefined
): Promise<RuntimeSkillBackedToolPublicationDecision | null> {
  if (!runtimeControl) {
    return null;
  }

  let catalog: RuntimeExecutableSkillCatalog | null;
  try {
    catalog = await readRuntimeExecutableSkillCatalog(runtimeControl);
  } catch {
    return null;
  }
  if (!catalog) {
    return null;
  }

  const availabilityBySkillId = new Map(
    catalog.entries.map((entry) => [entry.canonicalSkillId, entry.availability] as const)
  );
  const hiddenToolNames: string[] = [];
  const publishedToolNames: string[] = [];
  const entries: RuntimeSkillBackedToolPublicationEntry[] = [];
  const availabilityByToolName = new Map<
    string,
    NonNullable<RuntimeSkillIdResolution["availability"]> | null
  >();

  for (const binding of RUNTIME_SKILL_BACKED_TOOL_BINDINGS) {
    const availability = availabilityBySkillId.get(binding.canonicalSkillId) ?? null;
    availabilityByToolName.set(binding.toolName, availability);
    const status = availability && availability.live ? ("published" as const) : ("hidden" as const);
    entries.push({
      toolName: binding.toolName,
      canonicalSkillId: binding.canonicalSkillId,
      status,
      reason: buildRuntimeSkillBackedToolPublicationReason({
        canonicalSkillId: binding.canonicalSkillId,
        availability,
        status,
      }),
      availability,
    });
    if (status === "hidden") {
      hiddenToolNames.push(binding.toolName);
      continue;
    }
    publishedToolNames.push(binding.toolName);
  }

  return {
    hiddenToolNames,
    publishedToolNames,
    requiredSkillIds: RUNTIME_SKILL_BACKED_TOOL_BINDINGS.map((binding) => binding.canonicalSkillId),
    entries,
    availabilityByToolName,
  };
}

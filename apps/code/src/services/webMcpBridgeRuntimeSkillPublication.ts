import { createRuntimeExecutableSkillFacade } from "../application/runtime/facades/runtimeExecutableSkillFacade";
import type {
  RuntimeAgentControl,
  RuntimeExecutableSkillCatalog,
  RuntimeSkillIdResolution,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type RuntimeSkillBackedToolBinding = {
  toolName: string;
  canonicalSkillId: string;
};

export type RuntimeSkillBackedToolPublicationDecision = {
  hiddenToolNames: string[];
  publishedToolNames: string[];
  requiredSkillIds: string[];
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
  const availabilityByToolName = new Map<
    string,
    NonNullable<RuntimeSkillIdResolution["availability"]> | null
  >();

  for (const binding of RUNTIME_SKILL_BACKED_TOOL_BINDINGS) {
    const availability = availabilityBySkillId.get(binding.canonicalSkillId) ?? null;
    availabilityByToolName.set(binding.toolName, availability);
    if (!availability || !availability.live) {
      hiddenToolNames.push(binding.toolName);
      continue;
    }
    publishedToolNames.push(binding.toolName);
  }

  return {
    hiddenToolNames,
    publishedToolNames,
    requiredSkillIds: RUNTIME_SKILL_BACKED_TOOL_BINDINGS.map((binding) => binding.canonicalSkillId),
    availabilityByToolName,
  };
}

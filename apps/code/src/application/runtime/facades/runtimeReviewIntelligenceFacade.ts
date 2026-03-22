import type { LiveSkillSummary } from "@ku0/code-runtime-host-contract";
import { RuntimeUnavailableError } from "../ports/runtimeClient";
import { listRuntimeLiveSkills } from "../ports/tauriRuntimeSkills";
import { listWorkspaceFileEntries, readWorkspaceFile } from "../ports/tauriWorkspaceFiles";
import {
  REPOSITORY_EXECUTION_CONTRACT_PATH,
  type RepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";
import { readRuntimeWorkspaceExecutionPolicy } from "./runtimeWorkspaceExecutionPolicyFacade";

const REPOSITORY_SKILLS_DIRECTORY = ".hugecode/skills";
const REPOSITORY_SKILL_MANIFEST_SUFFIX = "/manifest.json";

type WorkspaceSkillManifestCompatibility = {
  minRuntime: string;
  maxRuntime: string | null;
  minApp: string | null;
  maxApp: string | null;
};

type WorkspaceSkillManifest = {
  id: string;
  name: string;
  version: string;
  kind: "skill" | "source";
  trustLevel: "verified" | "community" | "local";
  entrypoint: string | null;
  permissions: string[];
  compatibility: WorkspaceSkillManifestCompatibility;
};

export type WorkspaceSkillCatalogEntry = {
  id: string;
  name: string;
  version: string;
  trustLevel: WorkspaceSkillManifest["trustLevel"];
  entrypoint: string | null;
  permissions: string[];
  compatibility: WorkspaceSkillManifestCompatibility;
  recommendedFor: Array<"delegate" | "review" | "repair">;
  manifestPath: string;
  availableInRuntime: boolean;
  enabledInRuntime: boolean;
  runtimeSkillId: string | null;
  issues: string[];
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSkillIds(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

function normalizeLiveSkillId(skillId: string): string {
  return skillId.trim().toLowerCase();
}

function readSkillManifestCompatibility(
  value: unknown,
  context: string
): WorkspaceSkillManifestCompatibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const minRuntime = readOptionalText(record.min_runtime);
  if (!minRuntime) {
    throw new Error(`${context}.min_runtime is required.`);
  }
  return {
    minRuntime,
    maxRuntime: readOptionalText(record.max_runtime),
    minApp: readOptionalText(record.min_app),
    maxApp: readOptionalText(record.max_app),
  };
}

function parseWorkspaceSkillManifest(raw: string, manifestPath: string): WorkspaceSkillManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid workspace skill manifest at ${manifestPath}.`);
  }
  const record = parsed as Record<string, unknown>;
  if (record.schema_version !== "skills_source_manifest.v1") {
    throw new Error(
      `Unsupported workspace skill manifest schema \`${String(record.schema_version ?? "unknown")}\` at ${manifestPath}.`
    );
  }
  const id = readOptionalText(record.id);
  const name = readOptionalText(record.name);
  const version = readOptionalText(record.version);
  const kind = readOptionalText(record.kind);
  const trustLevel = readOptionalText(record.trust_level);
  if (!id || !name || !version || !kind || !trustLevel) {
    throw new Error(`Workspace skill manifest ${manifestPath} is missing required fields.`);
  }
  if (kind !== "skill" && kind !== "source") {
    throw new Error(`${manifestPath} must declare kind skill or source.`);
  }
  if (trustLevel !== "verified" && trustLevel !== "community" && trustLevel !== "local") {
    throw new Error(`${manifestPath} must declare trust_level verified, community, or local.`);
  }
  return {
    id,
    name,
    version,
    kind,
    trustLevel,
    entrypoint: readOptionalText(record.entrypoint),
    permissions: normalizeSkillIds(record.permissions ?? [], `${manifestPath}.permissions`),
    compatibility: readSkillManifestCompatibility(
      record.compatibility,
      `${manifestPath}.compatibility`
    ),
  };
}

function resolveRecommendedFor(input: {
  skillId: string;
  kind: WorkspaceSkillManifest["kind"];
  reviewProfileIds: string[];
}): Array<"delegate" | "review" | "repair"> {
  const values = new Set<"delegate" | "review" | "repair">();
  const normalizedSkillId = normalizeLiveSkillId(input.skillId);
  if (input.reviewProfileIds.length > 0) {
    values.add("review");
  }
  if (
    normalizedSkillId.includes("edit") ||
    normalizedSkillId.includes("write") ||
    normalizedSkillId.includes("repair") ||
    normalizedSkillId.includes("bash")
  ) {
    values.add("repair");
  }
  if (input.kind === "skill") {
    values.add("delegate");
  }
  return values.size > 0 ? [...values] : ["delegate"];
}

async function listRuntimeLiveSkillsSafe(): Promise<LiveSkillSummary[]> {
  try {
    return await listRuntimeLiveSkills();
  } catch (error) {
    if (error instanceof RuntimeUnavailableError) {
      return [];
    }
    throw error;
  }
}

export async function readWorkspaceSkillCatalog(
  workspaceId: string,
  contract?: RepositoryExecutionContract | null
): Promise<WorkspaceSkillCatalogEntry[]> {
  const [workspaceFiles, runtimeLiveSkills, repositoryExecutionContract] = await Promise.all([
    listWorkspaceFileEntries(workspaceId),
    listRuntimeLiveSkillsSafe(),
    contract === undefined
      ? readRuntimeWorkspaceExecutionPolicy(workspaceId)
      : Promise.resolve(contract),
  ]);
  const manifestFiles = workspaceFiles
    .filter(
      (file) =>
        file.path.startsWith(`${REPOSITORY_SKILLS_DIRECTORY}/`) &&
        file.path.endsWith(REPOSITORY_SKILL_MANIFEST_SUFFIX)
    )
    .sort((left, right) => left.path.localeCompare(right.path));
  if (manifestFiles.length === 0) {
    return [];
  }
  const liveSkillById = new Map(
    runtimeLiveSkills.map((skill) => [normalizeLiveSkillId(skill.id), skill] as const)
  );
  const reviewProfilesBySkillId = new Map<string, string[]>();
  for (const reviewProfile of repositoryExecutionContract?.reviewProfiles ?? []) {
    for (const skillId of reviewProfile.allowedSkillIds) {
      const normalizedSkillId = normalizeLiveSkillId(skillId);
      const existing = reviewProfilesBySkillId.get(normalizedSkillId) ?? [];
      existing.push(reviewProfile.id);
      reviewProfilesBySkillId.set(normalizedSkillId, existing);
    }
  }
  const manifests = await Promise.all(
    manifestFiles.map(async (file) => {
      const payload = await readWorkspaceFile(workspaceId, file.id);
      const content = readOptionalText(payload?.content);
      if (!content) {
        throw new Error(`Workspace skill manifest ${file.path} is empty.`);
      }
      return {
        manifestPath: file.path,
        manifest: parseWorkspaceSkillManifest(content, file.path),
      };
    })
  );
  return manifests.map(({ manifestPath, manifest }) => {
    const runtimeSkill = liveSkillById.get(normalizeLiveSkillId(manifest.id)) ?? null;
    const reviewProfileIds = reviewProfilesBySkillId.get(normalizeLiveSkillId(manifest.id)) ?? [];
    const issues: string[] = [];
    if (manifest.kind !== "skill") {
      issues.push("Workspace manifest kind is source; review/runtime execution may ignore it.");
    }
    if (!runtimeSkill) {
      issues.push("Runtime live skill is unavailable for this workspace.");
    } else if (!runtimeSkill.enabled) {
      issues.push("Runtime live skill is currently disabled.");
    }
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      trustLevel: manifest.trustLevel,
      entrypoint: manifest.entrypoint,
      permissions: manifest.permissions,
      compatibility: manifest.compatibility,
      recommendedFor: resolveRecommendedFor({
        skillId: manifest.id,
        kind: manifest.kind,
        reviewProfileIds,
      }),
      manifestPath,
      availableInRuntime: runtimeSkill !== null,
      enabledInRuntime: runtimeSkill?.enabled ?? false,
      runtimeSkillId: runtimeSkill?.id ?? null,
      issues,
    };
  });
}

export { applyReviewAutofix, runReviewAgent } from "./runtimeReviewIntelligenceActions";
export {
  resolveReviewIntelligenceSummary,
  resolveReviewProfileDefaults,
} from "./runtimeReviewIntelligenceSummary";
export type {
  ReviewIntelligenceSummary,
  ReviewProfileFieldOrigin,
  ResolvedReviewProfileDefaults,
} from "./runtimeReviewIntelligenceSummary";
export {
  REPOSITORY_EXECUTION_CONTRACT_PATH,
  REPOSITORY_SKILLS_DIRECTORY,
  REPOSITORY_SKILL_MANIFEST_SUFFIX,
};

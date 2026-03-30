import { useEffect, useState } from "react";
import type { LiveSkillSummary } from "@ku0/code-runtime-host-contract";
import { RuntimeUnavailableError } from "../ports/runtimeClient";
import { listRuntimeLiveSkills } from "../ports/tauriRuntimeSkills";
import {
  REPOSITORY_SKILLS_DIRECTORY,
  REPOSITORY_SKILL_MANIFEST_SUFFIX,
  readRuntimeWorkspaceSkillManifests,
  type RuntimeWorkspaceSkillManifest,
  type RuntimeWorkspaceSkillManifestCompatibility,
} from "../kernel/runtimeWorkspaceSkillManifests";
import {
  REPOSITORY_EXECUTION_CONTRACT_PATH,
  type RepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";
import { readRuntimeWorkspaceExecutionPolicy } from "./runtimeWorkspaceExecutionPolicyFacade";

export type WorkspaceSkillCatalogEntry = {
  id: string;
  name: string;
  version: string;
  trustLevel: RuntimeWorkspaceSkillManifest["trustLevel"];
  entrypoint: string | null;
  permissions: string[];
  compatibility: RuntimeWorkspaceSkillManifestCompatibility;
  recommendedFor: Array<"delegate" | "review" | "repair">;
  manifestPath: string;
  availableInRuntime: boolean;
  enabledInRuntime: boolean;
  runtimeSkillId: string | null;
  reviewProfileIds: string[];
  reviewProfileLabels: string[];
  issues: string[];
};

export type RuntimeWorkspaceSkillCatalogStatus = "idle" | "loading" | "ready" | "empty" | "error";

export type RuntimeWorkspaceSkillCatalogState = {
  status: RuntimeWorkspaceSkillCatalogStatus;
  entries: WorkspaceSkillCatalogEntry[];
  error: string | null;
};

function normalizeLiveSkillId(skillId: string): string {
  return skillId.trim().toLowerCase();
}

function resolveRecommendedFor(input: {
  skillId: string;
  kind: RuntimeWorkspaceSkillManifest["kind"];
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
  const [workspaceManifests, runtimeLiveSkills, repositoryExecutionContract] = await Promise.all([
    readRuntimeWorkspaceSkillManifests(workspaceId),
    listRuntimeLiveSkillsSafe(),
    contract === undefined
      ? readRuntimeWorkspaceExecutionPolicy(workspaceId)
      : Promise.resolve(contract),
  ]);
  if (workspaceManifests.length === 0) {
    return [];
  }
  const liveSkillById = new Map(
    runtimeLiveSkills.map((skill) => [normalizeLiveSkillId(skill.id), skill] as const)
  );
  const reviewProfilesBySkillId = new Map<string, string[]>();
  const reviewProfileLabelsBySkillId = new Map<string, string[]>();
  for (const reviewProfile of repositoryExecutionContract?.reviewProfiles ?? []) {
    for (const skillId of reviewProfile.allowedSkillIds) {
      const normalizedSkillId = normalizeLiveSkillId(skillId);
      reviewProfilesBySkillId.set(normalizedSkillId, [
        ...(reviewProfilesBySkillId.get(normalizedSkillId) ?? []),
        reviewProfile.id,
      ]);
      reviewProfileLabelsBySkillId.set(normalizedSkillId, [
        ...(reviewProfileLabelsBySkillId.get(normalizedSkillId) ?? []),
        reviewProfile.label,
      ]);
    }
  }
  return workspaceManifests.map((manifest) => {
    const runtimeSkill = liveSkillById.get(normalizeLiveSkillId(manifest.id)) ?? null;
    const reviewProfileIds = reviewProfilesBySkillId.get(normalizeLiveSkillId(manifest.id)) ?? [];
    const reviewProfileLabels =
      reviewProfileLabelsBySkillId.get(normalizeLiveSkillId(manifest.id)) ?? [];
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
      manifestPath: manifest.manifestPath,
      availableInRuntime: runtimeSkill !== null,
      enabledInRuntime: runtimeSkill?.enabled ?? false,
      runtimeSkillId: runtimeSkill?.id ?? null,
      reviewProfileIds,
      reviewProfileLabels,
      issues,
    };
  });
}

export function useRuntimeWorkspaceSkillCatalog(
  workspaceId: string | null,
  contract?: RepositoryExecutionContract | null
): RuntimeWorkspaceSkillCatalogState {
  const [state, setState] = useState<RuntimeWorkspaceSkillCatalogState>({
    status: "idle",
    entries: [],
    error: null,
  });

  useEffect(() => {
    if (!workspaceId) {
      setState({
        status: "idle",
        entries: [],
        error: null,
      });
      return;
    }
    let cancelled = false;
    setState({
      status: "loading",
      entries: [],
      error: null,
    });
    void readWorkspaceSkillCatalog(workspaceId, contract)
      .then((entries) => {
        if (cancelled) {
          return;
        }
        setState({
          status: entries.length > 0 ? "ready" : "empty",
          entries,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          status: "error",
          entries: [],
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [contract, workspaceId]);

  return state;
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

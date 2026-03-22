import {
  useSharedDefaultModelsState,
  type SharedDefaultModelOption,
} from "@ku0/code-workspace-client/settings-state";
import type { ModelOption, WorkspaceInfo } from "../../../types";
import { applyModelBrandDisplay } from "../../app/utils/antiGravityBranding";
import { parseModelListResponse } from "../../models/utils/modelListResponse";

const parseGptVersionScore = (slug: string): number | null => {
  const match = /^gpt-(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(slug.trim());
  if (!match) {
    return null;
  }
  const major = Number(match[1] ?? NaN);
  const minor = Number(match[2] ?? 0);
  const patch = Number(match[3] ?? 0);
  if (!Number.isFinite(major)) {
    return null;
  }
  return major * 1_000_000 + minor * 1_000 + patch;
};

const gptVariantPenalty = (slug: string): number => {
  const match = /^gpt-(\d+(?:\.\d+){0,2})(.*)$/i.exec(slug.trim());
  if (!match) {
    return 1;
  }
  const suffix = match[2] ?? "";
  return suffix.startsWith("-") ? 1 : 0;
};

function compareModelsByLatest(a: ModelOption, b: ModelOption): number {
  const scoreA = parseGptVersionScore(a.model) ?? -1;
  const scoreB = parseGptVersionScore(b.model) ?? -1;
  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }
  const penaltyA = gptVariantPenalty(a.model);
  const penaltyB = gptVariantPenalty(b.model);
  if (penaltyA !== penaltyB) {
    return penaltyA - penaltyB;
  }
  if (a.isDefault !== b.isDefault) {
    return a.isDefault ? -1 : 1;
  }
  return a.model.localeCompare(b.model);
}

export function useSettingsDefaultModels(projects: WorkspaceInfo[], enabled = true) {
  return useSharedDefaultModelsState(projects, {
    enabled,
    parseModelListResponse: (response) =>
      parseModelListResponse(response) as SharedDefaultModelOption[],
    mapModel: (model) => applyModelBrandDisplay(model as ModelOption) as SharedDefaultModelOption,
    compareModels: (left, right) =>
      compareModelsByLatest(left as ModelOption, right as ModelOption),
  });
}

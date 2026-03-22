import {
  canonicalizeModelPool,
  canonicalizeModelProvider,
} from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import type { ModelOption } from "../../../types";

const MODEL_SOURCE_ALIASES: Record<string, NonNullable<ModelOption["source"]>> = {
  fallback: "fallback",
  local_codex: "local-codex",
  "local-codex": "local-codex",
  oauth_account: "oauth-account",
  "oauth-account": "oauth-account",
  workspace_default: "workspace-default",
  "workspace-default": "workspace-default",
};

export function normalizeEffortValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeReasoningEfforts(
  efforts: ModelOption["supportedReasoningEfforts"]
): ModelOption["supportedReasoningEfforts"] {
  const seen = new Set<string>();
  const normalized: ModelOption["supportedReasoningEfforts"] = [];

  for (const effort of efforts) {
    const reasoningEffort = normalizeEffortValue(effort.reasoningEffort);
    if (!reasoningEffort || seen.has(reasoningEffort)) {
      continue;
    }
    seen.add(reasoningEffort);
    normalized.push({
      reasoningEffort,
      description: effort.description.trim(),
    });
  }

  return normalized;
}

export function normalizeModelOptionSource(
  value: string | null | undefined
): ModelOption["source"] {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  return MODEL_SOURCE_ALIASES[normalized] ?? normalized;
}

export function normalizeModelOption(model: ModelOption): ModelOption {
  const displayName = model.displayName.trim() || model.model.trim() || model.id.trim();
  return {
    ...model,
    id: model.id.trim(),
    model: model.model.trim(),
    displayName,
    description: model.description.trim(),
    provider:
      canonicalizeModelProvider(model.provider ?? model.pool ?? model.model) ??
      model.provider?.trim().toLowerCase() ??
      null,
    pool:
      canonicalizeModelPool(model.pool ?? model.provider) ??
      model.pool?.trim().toLowerCase() ??
      null,
    source: normalizeModelOptionSource(model.source),
    supportedReasoningEfforts: normalizeReasoningEfforts(model.supportedReasoningEfforts),
    defaultReasoningEffort: normalizeEffortValue(model.defaultReasoningEffort),
  };
}

export function supportsModelReasoning(model: ModelOption | null): boolean {
  if (!model) {
    return false;
  }
  return (
    model.supportedReasoningEfforts.length > 0 ||
    normalizeEffortValue(model.defaultReasoningEffort) !== null
  );
}

export function getModelReasoningOptions(model: ModelOption | null): string[] {
  if (!model) {
    return [];
  }
  const supported = normalizeReasoningEfforts(model.supportedReasoningEfforts).map(
    (effort) => effort.reasoningEffort
  );
  if (supported.length > 0) {
    return supported;
  }
  const fallback = normalizeEffortValue(model.defaultReasoningEffort);
  return fallback ? [fallback] : [];
}

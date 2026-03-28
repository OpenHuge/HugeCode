import {
  clampReasoningEffortToCapabilityMatrix,
  normalizeRuntimeModelCapabilityMatrix,
} from "@ku0/code-runtime-client/runtimeCapabilityMatrix";
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
  const normalizedLegacyReasoningEfforts = normalizeReasoningEfforts(
    model.supportedReasoningEfforts
  );
  const capabilityMatrix = normalizeRuntimeModelCapabilityMatrix({
    capabilityMatrix: model.capabilityMatrix ?? null,
    reasoningEfforts: normalizedLegacyReasoningEfforts.map((effort) => effort.reasoningEffort),
    supportsReasoning:
      normalizedLegacyReasoningEfforts.length > 0 ||
      normalizeEffortValue(model.defaultReasoningEffort) !== null,
  });
  const normalizedReasoningEfforts =
    capabilityMatrix.supportedReasoningEfforts.length > 0
      ? capabilityMatrix.supportedReasoningEfforts.map((reasoningEffort) => ({
          reasoningEffort,
          description:
            normalizedLegacyReasoningEfforts.find(
              (effort) => effort.reasoningEffort === reasoningEffort
            )?.description ?? "",
        }))
      : normalizedLegacyReasoningEfforts;
  const defaultReasoningEffort = clampReasoningEffortToCapabilityMatrix(
    model.defaultReasoningEffort,
    capabilityMatrix,
    capabilityMatrix.supportedReasoningEfforts[0] ?? null
  );
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
    supportedReasoningEfforts: normalizedReasoningEfforts,
    defaultReasoningEffort,
    capabilityMatrix,
  };
}

export function supportsModelReasoning(model: ModelOption | null): boolean {
  if (!model) {
    return false;
  }
  if (model.capabilityMatrix?.supportsReasoningEffort === "unsupported") {
    return false;
  }
  return (
    model.capabilityMatrix?.supportsReasoningEffort === "supported" ||
    model.supportedReasoningEfforts.length > 0 ||
    normalizeEffortValue(model.defaultReasoningEffort) !== null
  );
}

function resolveModelCapabilitySupport(
  model: ModelOption | null,
  key: "supportsTools" | "supportsVision"
): "supported" | "unsupported" | "unknown" {
  if (!model) {
    return "unknown";
  }
  const modelSupport = model.capabilityMatrix?.[key];
  if (modelSupport === "supported" || modelSupport === "unsupported") {
    return modelSupport;
  }
  const providerSupport = model.providerCapabilityMatrix?.[key];
  if (providerSupport === "supported" || providerSupport === "unsupported") {
    return providerSupport;
  }
  return "unknown";
}

export function resolveModelToolsCapabilitySupport(
  model: ModelOption | null
): "supported" | "unsupported" | "unknown" {
  return resolveModelCapabilitySupport(model, "supportsTools");
}

export function resolveModelVisionCapabilitySupport(
  model: ModelOption | null
): "supported" | "unsupported" | "unknown" {
  return resolveModelCapabilitySupport(model, "supportsVision");
}

export function getModelReasoningOptions(model: ModelOption | null): string[] {
  if (!model) {
    return [];
  }
  if (model.capabilityMatrix?.supportsReasoningEffort === "unsupported") {
    return [];
  }
  const supported = model.capabilityMatrix?.supportedReasoningEfforts.length
    ? model.capabilityMatrix.supportedReasoningEfforts
    : normalizeReasoningEfforts(model.supportedReasoningEfforts).map(
        (effort) => effort.reasoningEffort
      );
  if (supported.length > 0) {
    return supported;
  }
  const fallback = normalizeEffortValue(model.defaultReasoningEffort);
  return fallback ? [fallback] : [];
}

import {
  clampReasoningEffortToCapabilityMatrix,
  clampRuntimeModelCapabilityMatrixByProvider,
} from "@ku0/code-runtime-client/runtimeCapabilityMatrix";
import { normalizeRuntimeProviderCatalogEntry } from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
import type { RuntimeProviderCatalogEntry } from "../../../contracts/runtime";
import type { ModelOption } from "../../../types";
import { resolveModelProviderId } from "./modelProviderSelection";
import { normalizeEffortValue } from "./modelOptionCapabilities";

function buildProviderCatalogIndex(
  entries: ReadonlyArray<RuntimeProviderCatalogEntry>
): Map<string, RuntimeProviderCatalogEntry> {
  const index = new Map<string, RuntimeProviderCatalogEntry>();
  for (const rawEntry of entries) {
    const entry = normalizeRuntimeProviderCatalogEntry(rawEntry);
    const candidates = [entry.providerId, entry.oauthProviderId, entry.pool, ...entry.aliases]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase());
    for (const candidate of candidates) {
      if (!index.has(candidate)) {
        index.set(candidate, entry);
      }
    }
  }
  return index;
}

export function mergeModelsWithProviderCatalogMetadata(
  models: ReadonlyArray<ModelOption>,
  providerCatalogEntries: ReadonlyArray<RuntimeProviderCatalogEntry>
): ModelOption[] {
  const providerCatalogIndex = buildProviderCatalogIndex(providerCatalogEntries);
  return models.map((model) => {
    const catalogEntry =
      providerCatalogIndex.get((model.provider ?? "").trim().toLowerCase()) ??
      providerCatalogIndex.get((model.pool ?? "").trim().toLowerCase()) ??
      providerCatalogIndex.get(resolveModelProviderId(model).trim().toLowerCase()) ??
      null;
    if (!catalogEntry) {
      return model;
    }
    const capabilityMatrix = clampRuntimeModelCapabilityMatrixByProvider(model, catalogEntry);
    const reasoningDescriptions = new Map(
      model.supportedReasoningEfforts
        .map((effort) => {
          const normalizedEffort = normalizeEffortValue(effort.reasoningEffort);
          return normalizedEffort
            ? ([normalizedEffort, effort.description.trim()] satisfies [string, string])
            : null;
        })
        .filter((entry): entry is [string, string] => entry !== null)
    );
    const supportedReasoningEfforts =
      capabilityMatrix.supportedReasoningEfforts.length > 0
        ? capabilityMatrix.supportedReasoningEfforts.map((reasoningEffort) => ({
            reasoningEffort,
            description: reasoningDescriptions.get(reasoningEffort) ?? "",
          }))
        : capabilityMatrix.supportsReasoningEffort === "unsupported"
          ? []
          : model.supportedReasoningEfforts;
    const defaultReasoningEffort = clampReasoningEffortToCapabilityMatrix(
      model.defaultReasoningEffort,
      capabilityMatrix,
      capabilityMatrix.supportedReasoningEfforts[0] ?? null
    );
    return {
      ...model,
      providerReadinessKind: catalogEntry.readinessKind ?? null,
      providerReadinessMessage: catalogEntry.readinessMessage ?? null,
      executionKind: catalogEntry.executionKind ?? null,
      providerCapabilityMatrix: catalogEntry.capabilityMatrix ?? null,
      available: model.available !== false && catalogEntry.available !== false,
      supportedReasoningEfforts,
      defaultReasoningEffort,
      capabilityMatrix,
    };
  });
}

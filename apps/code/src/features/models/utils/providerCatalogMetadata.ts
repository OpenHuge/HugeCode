import { normalizeRuntimeProviderCatalogEntry } from "../../../application/runtime/facades/runtimeMissionControlProjectionNormalization";
import type { RuntimeProviderCatalogEntry } from "../../../contracts/runtime";
import type { ModelOption } from "../../../types";
import { resolveModelProviderId } from "./modelProviderSelection";

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
    return {
      ...model,
      providerReadinessKind: catalogEntry.readinessKind ?? null,
      providerReadinessMessage: catalogEntry.readinessMessage ?? null,
      executionKind: catalogEntry.executionKind ?? null,
      available: model.available !== false && catalogEntry.available !== false,
    };
  });
}

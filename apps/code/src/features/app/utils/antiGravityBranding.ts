import { canonicalizeOAuthProviderId } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import type { RuntimeProviderCatalogEntry } from "../../../contracts/runtime";
import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
  OAuthProviderId,
} from "../../../application/runtime/ports/oauth";
import type { ModelOption } from "../../../types";

export type ProviderBrandId = OAuthProviderId | "antigravity";

export type ProviderBrandOption = {
  id: ProviderBrandId;
  routeProviderId: OAuthProviderId;
  label: string;
  available: boolean;
  supportsNative: boolean;
  supportsOpenaiCompat: boolean;
};

const PROVIDER_BRAND_ORDER: ProviderBrandId[] = ["codex", "claude_code", "gemini", "antigravity"];

const PROVIDER_BRAND_LABELS: Record<ProviderBrandId, string> = {
  codex: "Codex",
  claude_code: "Claude Code",
  gemini: "Gemini",
  antigravity: "Antigravity",
};

const ANTIGRAVITY_ALIAS_SET = new Set(["antigravity", "anti-gravity", "gemini-antigravity"]);

const PROVIDER_BRAND_ORDER_INDEX = new Map(
  PROVIDER_BRAND_ORDER.map((providerId, index) => [providerId, index] as const)
);

function isAntigravityAlias(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return ANTIGRAVITY_ALIAS_SET.has(value.trim().toLowerCase());
}

function isGeminiBackedCatalogEntry(entry: RuntimeProviderCatalogEntry): boolean {
  return (
    canonicalizeProviderBrandId(entry.oauthProviderId ?? entry.pool ?? entry.providerId) ===
      "gemini" ||
    (Array.isArray(entry.aliases) && entry.aliases.some((alias) => isAntigravityAlias(alias)))
  );
}

function isGeminiBackedModel(model: ModelOption): boolean {
  return (
    canonicalizeProviderBrandId(model.provider ?? model.pool ?? model.model ?? null) === "gemini" ||
    isAntigravityAlias(model.id)
  );
}

function createProviderBrandOption(
  id: ProviderBrandId,
  routeProviderId: OAuthProviderId,
  overrides: Partial<Omit<ProviderBrandOption, "id" | "routeProviderId">> = {}
): ProviderBrandOption {
  return {
    id,
    routeProviderId,
    label: PROVIDER_BRAND_LABELS[id],
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: true,
    ...overrides,
  };
}

function sortProviderBrandOptions(options: Iterable<ProviderBrandOption>): ProviderBrandOption[] {
  return Array.from(options).sort((left, right) => {
    const leftIndex = PROVIDER_BRAND_ORDER_INDEX.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = PROVIDER_BRAND_ORDER_INDEX.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
  });
}

function withAntigravityBrand(optionsById: Map<ProviderBrandId, ProviderBrandOption>) {
  const geminiOption = optionsById.get("gemini");
  if (!geminiOption) {
    return;
  }
  optionsById.set(
    "antigravity",
    createProviderBrandOption("antigravity", "gemini", {
      available: geminiOption.available,
      supportsNative: geminiOption.supportsNative,
      supportsOpenaiCompat: geminiOption.supportsOpenaiCompat,
    })
  );
}

export const FALLBACK_PROVIDER_BRAND_OPTIONS: ReadonlyArray<ProviderBrandOption> =
  sortProviderBrandOptions([
    createProviderBrandOption("codex", "codex"),
    createProviderBrandOption("claude_code", "claude_code"),
    createProviderBrandOption("gemini", "gemini"),
    createProviderBrandOption("antigravity", "gemini"),
  ]);

export function canonicalizeProviderBrandId(
  providerId: string | null | undefined
): OAuthProviderId | null {
  if (!providerId) {
    return null;
  }
  const normalized = providerId.trim().toLowerCase();
  if (
    normalized === "antigravity" ||
    normalized === "anti-gravity" ||
    normalized === "gemini-antigravity"
  ) {
    return "gemini";
  }
  return canonicalizeOAuthProviderId(normalized) as OAuthProviderId | null;
}

export function resolveProviderBrandRouteId(providerId: ProviderBrandId): OAuthProviderId {
  return canonicalizeProviderBrandId(providerId) ?? "codex";
}

export function matchesProviderBrand(
  providerBrandId: ProviderBrandId | OAuthProviderId | string,
  providerId: OAuthProviderId | null | undefined
): boolean {
  const canonicalProviderId = canonicalizeProviderBrandId(providerId);
  if (!canonicalProviderId) {
    return false;
  }
  if (providerBrandId === "antigravity") {
    return canonicalProviderId === "gemini";
  }
  return canonicalizeProviderBrandId(providerBrandId) === canonicalProviderId;
}

export function buildProviderBrandOptionsFromCatalog(
  entries: ReadonlyArray<RuntimeProviderCatalogEntry>
): ProviderBrandOption[] {
  const optionsById = new Map<ProviderBrandId, ProviderBrandOption>();
  for (const entry of entries) {
    const providerId = canonicalizeProviderBrandId(
      entry.oauthProviderId ?? entry.pool ?? entry.providerId
    );
    if (!providerId) {
      continue;
    }
    const previous = optionsById.get(providerId);
    optionsById.set(
      providerId,
      createProviderBrandOption(providerId, providerId, {
        label:
          providerId === "gemini"
            ? "Gemini"
            : entry.displayName.trim() || previous?.label || providerId,
        available: (previous?.available ?? false) || entry.available,
        supportsNative: (previous?.supportsNative ?? false) || entry.supportsNative,
        supportsOpenaiCompat:
          (previous?.supportsOpenaiCompat ?? false) || entry.supportsOpenaiCompat,
      })
    );
    if (isGeminiBackedCatalogEntry(entry)) {
      withAntigravityBrand(optionsById);
    }
  }
  return sortProviderBrandOptions(optionsById.values());
}

export function buildProviderBrandOptionsFromState(
  accounts: ReadonlyArray<OAuthAccountSummary>,
  pools: ReadonlyArray<OAuthPoolSummary>
): ProviderBrandOption[] {
  const routeProviderIds = new Set<OAuthProviderId>();
  for (const account of accounts) {
    routeProviderIds.add(account.provider);
  }
  for (const pool of pools) {
    routeProviderIds.add(pool.provider);
  }
  if (routeProviderIds.size === 0) {
    return [...FALLBACK_PROVIDER_BRAND_OPTIONS];
  }
  const optionsById = new Map<ProviderBrandId, ProviderBrandOption>();
  for (const providerId of routeProviderIds) {
    optionsById.set(providerId, createProviderBrandOption(providerId, providerId));
  }
  if (routeProviderIds.has("gemini")) {
    withAntigravityBrand(optionsById);
  }
  return sortProviderBrandOptions(optionsById.values());
}

function stripExistingProviderPrefix(displayName: string): string {
  return displayName
    .trim()
    .replace(/^(gemini|google|anti-gravity|antigravity)\b[\s:-]*/i, "")
    .trim();
}

function formatAntigravityDisplayName(model: ModelOption): string {
  if (isAntigravityAlias(model.model) || isAntigravityAlias(model.id)) {
    return "Antigravity";
  }
  const strippedDisplayName = stripExistingProviderPrefix(model.displayName || model.model);
  if (strippedDisplayName.length === 0) {
    return "Antigravity";
  }
  return `Antigravity ${strippedDisplayName}`;
}

export function applyModelBrandDisplay(model: ModelOption): ModelOption {
  if (
    isAntigravityAlias(model.model) ||
    isAntigravityAlias(model.id) ||
    isAntigravityAlias(model.displayName)
  ) {
    return {
      ...model,
      displayName: "Antigravity",
    };
  }
  return model;
}

export function resolveModelBrandLabel(
  model: Pick<ModelOption, "displayName" | "provider" | "pool" | "model"> | null | undefined
): string | null {
  if (!model) {
    return null;
  }
  if ((model.provider ?? "").trim().toLowerCase() === "claude_code_local") {
    return "Claude Code Local";
  }
  if (
    isAntigravityAlias(model.provider) ||
    isAntigravityAlias(model.pool) ||
    isAntigravityAlias(model.model) ||
    isAntigravityAlias(model.displayName)
  ) {
    return "Antigravity";
  }
  const providerId = canonicalizeProviderBrandId(
    model.provider ?? model.pool ?? model.model ?? null
  );
  if (providerId === "gemini") {
    return "Gemini";
  }
  if (providerId === "claude_code") {
    return "Claude Code";
  }
  if (providerId === "codex") {
    return "Codex";
  }
  return null;
}

export function expandComposerModelBrandOptions(models: ReadonlyArray<ModelOption>): ModelOption[] {
  const brandedModels: ModelOption[] = [];
  for (const model of models) {
    const normalizedModel = applyModelBrandDisplay(model);
    brandedModels.push(normalizedModel);
    if (!isGeminiBackedModel(normalizedModel)) {
      continue;
    }
    if (isAntigravityAlias(normalizedModel.model) || isAntigravityAlias(normalizedModel.id)) {
      continue;
    }
    brandedModels.push({
      ...normalizedModel,
      id: `${normalizedModel.id}::brand:antigravity`,
      displayName: formatAntigravityDisplayName(normalizedModel),
      provider: "antigravity",
      pool: "antigravity",
    });
  }
  return brandedModels;
}

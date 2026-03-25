type RuntimeProviderReadinessKind =
  | "ready"
  | "not_installed"
  | "not_authenticated"
  | "unsupported_platform"
  | "degraded";

type RuntimeProviderExecutionKind = "local" | "cloud";

export type ProviderSelectableModel = {
  id: string;
  model: string;
  displayName: string;
  provider?: string | null;
  pool?: string | null;
  source?: string | null;
  available?: boolean;
  providerReadinessKind?: RuntimeProviderReadinessKind | null;
  providerReadinessMessage?: string | null;
  executionKind?: RuntimeProviderExecutionKind | null;
};

export type ModelProviderOption<TModel extends ProviderSelectableModel = ProviderSelectableModel> =
  {
    id: string;
    label: string;
    models: TModel[];
    defaultModelId: string | null;
    hasAvailableModels: boolean;
    readinessKind: RuntimeProviderReadinessKind | null;
    readinessMessage: string | null;
    executionKind: RuntimeProviderExecutionKind | null;
  };

const CLAUDE_PROVIDER_IDS = new Set(["anthropic", "claude", "claude_code", "claude_code_local"]);
const CODEX_PROVIDER_IDS = new Set(["codex", "openai"]);
const GEMINI_PROVIDER_IDS = new Set(["gemini", "google"]);
const ANTIGRAVITY_PROVIDER_IDS = new Set(["antigravity", "anti-gravity", "gemini-antigravity"]);
const PROVIDER_FAMILY_PRIORITY: Record<string, number> = {
  codex: 0,
  claude: 1,
  gemini: 2,
  antigravity: 3,
};
const PROVIDER_READINESS_PRIORITY: Record<RuntimeProviderReadinessKind, number> = {
  ready: 4,
  degraded: 3,
  not_authenticated: 2,
  not_installed: 1,
  unsupported_platform: 0,
};
const MODEL_TIER_PRIORITY: Record<string, number> = {
  opus: 6,
  max: 5,
  pro: 4,
  sonnet: 3,
  flash: 2,
  haiku: 1,
  mini: 0,
  nano: -1,
};

function normalizeValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function titleCaseFromId(value: string): string {
  return value
    .split(/[_:\-/]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveModelProviderId(model: ProviderSelectableModel): string {
  const resolvedRouteId =
    normalizeValue(model.provider) ?? normalizeValue(model.pool) ?? normalizeValue(model.source);
  const fallbackModelId = normalizeValue(model.model) ?? "";
  const resolvedId = resolvedRouteId ?? (fallbackModelId.length > 0 ? fallbackModelId : "default");
  const normalizedId = resolvedId.trim().toLowerCase();
  if (CLAUDE_PROVIDER_IDS.has(normalizedId) || normalizedId.startsWith("claude-")) {
    return "claude";
  }
  if (CODEX_PROVIDER_IDS.has(normalizedId) || normalizedId.startsWith("gpt-")) {
    return "codex";
  }
  if (GEMINI_PROVIDER_IDS.has(normalizedId)) {
    return "gemini";
  }
  if (ANTIGRAVITY_PROVIDER_IDS.has(normalizedId)) {
    return "antigravity";
  }
  return resolvedRouteId ?? "default";
}

export function resolveModelProviderLabel(providerId: string): string {
  switch (providerId.trim().toLowerCase()) {
    case "codex":
      return "Codex";
    case "claude":
      return "Claude";
    case "gemini":
      return "Gemini";
    case "antigravity":
      return "Antigravity";
    default:
      return titleCaseFromId(providerId);
  }
}

function resolveProviderFamilyPriority(providerId: string): number {
  const normalizedProviderId = providerId.trim().toLowerCase();
  return PROVIDER_FAMILY_PRIORITY[normalizedProviderId] ?? 10;
}

function resolveProviderReadinessPriority(
  readinessKind: RuntimeProviderReadinessKind | null
): number {
  if (!readinessKind) {
    return -1;
  }
  return PROVIDER_READINESS_PRIORITY[readinessKind] ?? -1;
}

function tokenizeModelIdentity(model: ProviderSelectableModel): string {
  return (
    normalizeValue(model.model) ??
    normalizeValue(model.displayName) ??
    normalizeValue(model.id) ??
    ""
  ).toLowerCase();
}

function extractModelVersion(identity: string): number[] {
  const versionMatch =
    identity.match(/(?:gpt|claude|gemini|o\d|o4|o3|grok)[^\d]*(\d+(?:[._-]\d+)*)/) ??
    identity.match(/(\d+(?:[._-]\d+)*)/);
  if (!versionMatch?.[1]) {
    return [];
  }
  return versionMatch[1]
    .split(/[._-]/g)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function compareVersionParts(left: number[], right: number[]): number {
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = left[index] ?? -1;
    const rightPart = right[index] ?? -1;
    if (leftPart !== rightPart) {
      return rightPart - leftPart;
    }
  }
  return 0;
}

function resolveModelTierPriority(identity: string): number {
  return Object.entries(MODEL_TIER_PRIORITY).reduce((best, [token, priority]) => {
    if (!identity.includes(token)) {
      return best;
    }
    return Math.max(best, priority);
  }, -1);
}

function resolveModelPreferenceOrder(
  left: ProviderSelectableModel,
  right: ProviderSelectableModel
): number {
  const leftIdentity = tokenizeModelIdentity(left);
  const rightIdentity = tokenizeModelIdentity(right);
  const versionDelta = compareVersionParts(
    extractModelVersion(leftIdentity),
    extractModelVersion(rightIdentity)
  );
  if (versionDelta !== 0) {
    return versionDelta;
  }
  const tierDelta =
    resolveModelTierPriority(rightIdentity) - resolveModelTierPriority(leftIdentity);
  if (tierDelta !== 0) {
    return tierDelta;
  }
  const leftLabel = normalizeValue(left.displayName) ?? normalizeValue(left.model) ?? left.id;
  const rightLabel = normalizeValue(right.displayName) ?? normalizeValue(right.model) ?? right.id;
  const labelDelta = leftLabel.localeCompare(rightLabel);
  if (labelDelta !== 0) {
    return labelDelta;
  }
  return left.id.localeCompare(right.id);
}

function resolveProviderReadinessKind<TModel extends ProviderSelectableModel>(
  models: ReadonlyArray<TModel>
): RuntimeProviderReadinessKind | null {
  const readinessKinds = models
    .map((model) => model.providerReadinessKind ?? null)
    .filter((value): value is RuntimeProviderReadinessKind => value !== null);
  if (readinessKinds.includes("ready")) {
    return "ready";
  }
  if (readinessKinds.includes("not_authenticated")) {
    return "not_authenticated";
  }
  if (readinessKinds.includes("degraded")) {
    return "degraded";
  }
  if (readinessKinds.includes("not_installed")) {
    return "not_installed";
  }
  if (readinessKinds.includes("unsupported_platform")) {
    return "unsupported_platform";
  }
  return readinessKinds[0] ?? null;
}

function resolveProviderReadinessMessage<TModel extends ProviderSelectableModel>(
  models: ReadonlyArray<TModel>,
  readinessKind: RuntimeProviderReadinessKind | null
): string | null {
  if (!readinessKind) {
    return null;
  }
  const preferredModel =
    models.find(
      (model) => model.providerReadinessKind === readinessKind && model.available !== false
    ) ??
    models.find((model) => model.providerReadinessKind === readinessKind) ??
    null;
  return preferredModel?.providerReadinessMessage ?? null;
}

function resolveProviderExecutionKind<TModel extends ProviderSelectableModel>(
  models: ReadonlyArray<TModel>
): RuntimeProviderExecutionKind | null {
  const representative =
    models.find((model) => model.available !== false && model.executionKind === "local") ??
    models.find((model) => model.available !== false && model.executionKind === "cloud") ??
    models.find((model) => model.executionKind === "local") ??
    models.find((model) => model.executionKind === "cloud") ??
    null;
  return representative?.executionKind ?? null;
}

export function buildProviderModelEntries<TModel extends ProviderSelectableModel>(
  providerModels: ReadonlyArray<TModel>
): TModel[] {
  return [...providerModels].sort((left, right) => {
    const availabilityDelta = Number(right.available !== false) - Number(left.available !== false);
    if (availabilityDelta !== 0) {
      return availabilityDelta;
    }
    return resolveModelPreferenceOrder(left, right);
  });
}

export function buildModelProviderOptions<TModel extends ProviderSelectableModel>(
  models: ReadonlyArray<TModel>
): ModelProviderOption<TModel>[] {
  const modelsByProvider = new Map<string, TModel[]>();
  for (const model of models) {
    const providerId = resolveModelProviderId(model);
    const group = modelsByProvider.get(providerId);
    if (!group) {
      modelsByProvider.set(providerId, [model]);
      continue;
    }
    group.push(model);
  }

  return Array.from(modelsByProvider.entries())
    .map(([providerId, providerModels]) => {
      const prioritizedModels = buildProviderModelEntries(providerModels);
      const defaultModel =
        prioritizedModels.find((model) => model.available !== false) ??
        prioritizedModels[0] ??
        null;
      const readinessKind = resolveProviderReadinessKind(providerModels);
      return {
        id: providerId,
        label: resolveModelProviderLabel(providerId),
        models: prioritizedModels,
        defaultModelId: defaultModel?.id ?? null,
        hasAvailableModels: providerModels.some((model) => model.available !== false),
        readinessKind,
        readinessMessage: resolveProviderReadinessMessage(providerModels, readinessKind),
        executionKind: resolveProviderExecutionKind(providerModels),
      };
    })
    .sort((left, right) => {
      const availabilityDelta = Number(right.hasAvailableModels) - Number(left.hasAvailableModels);
      if (availabilityDelta !== 0) {
        return availabilityDelta;
      }
      const readinessDelta =
        resolveProviderReadinessPriority(right.readinessKind) -
        resolveProviderReadinessPriority(left.readinessKind);
      if (readinessDelta !== 0) {
        return readinessDelta;
      }
      const priorityDelta =
        resolveProviderFamilyPriority(left.id) - resolveProviderFamilyPriority(right.id);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.label.localeCompare(right.label);
    });
}

export function resolveSelectedProviderId<TModel extends ProviderSelectableModel>(
  providerOptions: ReadonlyArray<ModelProviderOption<TModel>>,
  selectedModelId: string | null
): string | null {
  if (selectedModelId) {
    const matchedProvider = providerOptions.find((providerOption) =>
      providerOption.models.some(
        (model) => model.id === selectedModelId || model.model === selectedModelId
      )
    );
    if (matchedProvider) {
      return matchedProvider.id;
    }
  }
  return (
    providerOptions.find((providerOption) => providerOption.hasAvailableModels)?.id ??
    providerOptions[0]?.id ??
    null
  );
}

export function resolveProviderModelId<TModel extends ProviderSelectableModel>(
  providerOptions: ReadonlyArray<ModelProviderOption<TModel>>,
  providerId: string | null,
  selectedModelId: string | null
): string | null {
  if (!providerId) {
    return null;
  }
  const providerOption = providerOptions.find((option) => option.id === providerId);
  if (!providerOption) {
    return null;
  }
  const matchedModel = providerOption.models.find(
    (model) => model.id === selectedModelId || model.model === selectedModelId
  );
  return matchedModel?.id ?? providerOption.defaultModelId;
}

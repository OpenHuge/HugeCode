import type {
  ReasonEffort,
  RuntimeCapabilityMatrix,
  RuntimeCapabilitySupport,
  RuntimeModelCapabilityMatrix,
  RuntimeProviderCapabilityMatrix,
} from "@ku0/code-runtime-host-contract";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function normalizeRuntimeCapabilitySupport(value: unknown): RuntimeCapabilitySupport {
  if (value === true) {
    return "supported";
  }
  if (value === false) {
    return "unsupported";
  }
  const normalized = readString(value)?.toLowerCase();
  switch (normalized) {
    case "supported":
    case "support":
    case "enabled":
    case "available":
    case "true":
      return "supported";
    case "unsupported":
    case "disable":
    case "disabled":
    case "unavailable":
    case "false":
      return "unsupported";
    default:
      return "unknown";
  }
}

function isReasonEffort(value: string): value is ReasonEffort {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh";
}

function normalizeReasoningEfforts(value: unknown): ReasonEffort[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: ReasonEffort[] = [];
  const seen = new Set<ReasonEffort>();
  for (const entry of value) {
    const effort = readString(entry)?.toLowerCase();
    if (!effort || !isReasonEffort(effort) || seen.has(effort)) {
      continue;
    }
    seen.add(effort);
    normalized.push(effort);
  }
  return normalized;
}

function buildCapabilityMatrix(input: {
  explicitMatrix: Record<string, unknown> | null;
  legacySupportsReasoningEffort?: unknown;
  legacySupportsVision?: unknown;
  legacyMaxContextTokens?: unknown;
  legacyReasoningEfforts?: unknown;
}): RuntimeCapabilityMatrix {
  const explicitMatrix = input.explicitMatrix;
  const supportedReasoningEfforts =
    normalizeReasoningEfforts(
      explicitMatrix?.supportedReasoningEfforts ?? explicitMatrix?.supported_reasoning_efforts
    ) || [];
  const fallbackReasoningEfforts =
    supportedReasoningEfforts.length > 0
      ? supportedReasoningEfforts
      : normalizeReasoningEfforts(input.legacyReasoningEfforts);
  const supportsReasoningEffort = (() => {
    const explicitReasoningValue =
      explicitMatrix?.supportsReasoningEffort ?? explicitMatrix?.supports_reasoning_effort;
    if (explicitReasoningValue !== undefined) {
      return normalizeRuntimeCapabilitySupport(explicitReasoningValue);
    }
    const legacy = normalizeRuntimeCapabilitySupport(input.legacySupportsReasoningEffort);
    if (legacy !== "unknown") {
      return legacy;
    }
    return fallbackReasoningEfforts.length > 0 ? "supported" : "unknown";
  })();

  return {
    supportsTools: normalizeRuntimeCapabilitySupport(
      explicitMatrix?.supportsTools ?? explicitMatrix?.supports_tools
    ),
    supportsReasoningEffort,
    supportsVision: (() => {
      const explicitVisionValue = explicitMatrix?.supportsVision ?? explicitMatrix?.supports_vision;
      if (explicitVisionValue !== undefined) {
        return normalizeRuntimeCapabilitySupport(explicitVisionValue);
      }
      return normalizeRuntimeCapabilitySupport(input.legacySupportsVision);
    })(),
    supportsJsonSchema: normalizeRuntimeCapabilitySupport(
      explicitMatrix?.supportsJsonSchema ?? explicitMatrix?.supports_json_schema
    ),
    maxContextTokens:
      readPositiveNumber(explicitMatrix?.maxContextTokens ?? explicitMatrix?.max_context_tokens) ??
      readPositiveNumber(input.legacyMaxContextTokens),
    supportedReasoningEfforts: fallbackReasoningEfforts,
  };
}

export function normalizeRuntimeModelCapabilityMatrix(
  value: unknown
): RuntimeModelCapabilityMatrix {
  const record = asRecord(value);
  const explicitMatrix = asRecord(record?.capabilityMatrix ?? record?.capability_matrix);
  return buildCapabilityMatrix({
    explicitMatrix,
    legacySupportsReasoningEffort: record?.supportsReasoning ?? record?.supports_reasoning,
    legacySupportsVision: record?.supportsVision ?? record?.supports_vision,
    legacyMaxContextTokens: record?.maxContextTokens ?? record?.max_context_tokens,
    legacyReasoningEfforts: record?.reasoningEfforts ?? record?.reasoning_efforts,
  });
}

export function normalizeRuntimeProviderCapabilityMatrix(
  value: unknown
): RuntimeProviderCapabilityMatrix {
  const record = asRecord(value);
  const explicitMatrix = asRecord(record?.capabilityMatrix ?? record?.capability_matrix);
  return buildCapabilityMatrix({
    explicitMatrix,
    legacySupportsReasoningEffort: record?.supportsReasoningEffort,
    legacySupportsVision: record?.supportsVision,
    legacyMaxContextTokens: record?.maxContextTokens ?? record?.max_context_tokens,
    legacyReasoningEfforts: record?.reasoningEfforts ?? record?.reasoning_efforts,
  });
}

function clampCapabilitySupportByProvider(
  modelSupport: RuntimeCapabilitySupport,
  providerSupport: RuntimeCapabilitySupport
): RuntimeCapabilitySupport {
  if (providerSupport === "unsupported") {
    return "unsupported";
  }
  return modelSupport;
}

export function clampRuntimeModelCapabilityMatrixByProvider(
  modelValue: unknown,
  providerValue: unknown
): RuntimeModelCapabilityMatrix {
  const model = normalizeRuntimeModelCapabilityMatrix(modelValue);
  const provider = normalizeRuntimeProviderCapabilityMatrix(providerValue);
  const supportsReasoningEffort = clampCapabilitySupportByProvider(
    model.supportsReasoningEffort,
    provider.supportsReasoningEffort
  );
  const modelSupportedReasoningEfforts = normalizeReasoningEfforts(model.supportedReasoningEfforts);
  const providerSupportedReasoningEfforts = normalizeReasoningEfforts(
    provider.supportedReasoningEfforts
  );

  return {
    supportsTools: clampCapabilitySupportByProvider(model.supportsTools, provider.supportsTools),
    supportsReasoningEffort,
    supportsVision: clampCapabilitySupportByProvider(model.supportsVision, provider.supportsVision),
    supportsJsonSchema: clampCapabilitySupportByProvider(
      model.supportsJsonSchema,
      provider.supportsJsonSchema
    ),
    maxContextTokens:
      model.maxContextTokens !== null && provider.maxContextTokens !== null
        ? Math.min(model.maxContextTokens, provider.maxContextTokens)
        : (model.maxContextTokens ?? provider.maxContextTokens),
    supportedReasoningEfforts:
      supportsReasoningEffort === "unsupported"
        ? []
        : provider.supportsReasoningEffort === "supported" &&
            providerSupportedReasoningEfforts.length > 0 &&
            modelSupportedReasoningEfforts.length > 0
          ? modelSupportedReasoningEfforts.filter((effort) =>
              providerSupportedReasoningEfforts.includes(effort)
            )
          : modelSupportedReasoningEfforts,
  };
}

function normalizeReasoningEffort(value: string | null | undefined): ReasonEffort | null {
  const normalized = readString(value)?.toLowerCase();
  return normalized && isReasonEffort(normalized) ? normalized : null;
}

export function clampReasoningEffortToCapabilityMatrix(
  requestedEffort: string | null | undefined,
  capabilityMatrix: Pick<
    RuntimeModelCapabilityMatrix,
    "supportsReasoningEffort" | "supportedReasoningEfforts"
  > | null,
  fallbackEffort: string | null | undefined = null
): ReasonEffort | null {
  const requested = normalizeReasoningEffort(requestedEffort);
  const fallback = normalizeReasoningEffort(fallbackEffort);
  if (!capabilityMatrix) {
    return requested ?? fallback;
  }
  if (capabilityMatrix.supportsReasoningEffort === "unsupported") {
    return null;
  }
  const supported = normalizeReasoningEfforts(capabilityMatrix.supportedReasoningEfforts);
  if (supported.length === 0) {
    return requested ?? fallback;
  }
  if (requested && supported.includes(requested)) {
    return requested;
  }
  if (fallback && supported.includes(fallback)) {
    return fallback;
  }
  return supported[0] ?? null;
}

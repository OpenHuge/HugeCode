import type { ModelOption } from "../../../types";
import { normalizeEffortValue, normalizeModelOption } from "./modelOptionCapabilities";

function extractModelItems(response: unknown): unknown[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const record = response as Record<string, unknown>;
  const rawResult = record.result;
  if (Array.isArray(rawResult)) {
    return rawResult;
  }

  const result =
    rawResult && typeof rawResult === "object" ? (rawResult as Record<string, unknown>) : null;

  const resultData = result?.data;
  if (Array.isArray(resultData)) {
    return resultData;
  }

  const resultModels = result?.models;
  if (Array.isArray(resultModels)) {
    return resultModels;
  }

  const topLevelData = record.data;
  if (Array.isArray(topLevelData)) {
    return topLevelData;
  }

  const topLevelModels = record.models;
  if (Array.isArray(topLevelModels)) {
    return topLevelModels;
  }

  return [];
}

function parseReasoningEfforts(
  item: Record<string, unknown>
): ModelOption["supportedReasoningEfforts"] {
  const camel = item.supportedReasoningEfforts;
  if (Array.isArray(camel)) {
    return camel
      .map((effort) => {
        if (!effort || typeof effort !== "object") {
          return null;
        }
        const entry = effort as Record<string, unknown>;
        return {
          reasoningEffort: String(entry.reasoningEffort ?? entry.reasoning_effort ?? ""),
          description: String(entry.description ?? ""),
        };
      })
      .filter(
        (effort): effort is { reasoningEffort: string; description: string } => effort !== null
      );
  }

  const snake = item.supported_reasoning_efforts;
  if (Array.isArray(snake)) {
    return snake
      .map((effort) => {
        if (!effort || typeof effort !== "object") {
          return null;
        }
        const entry = effort as Record<string, unknown>;
        return {
          reasoningEffort: String(entry.reasoningEffort ?? entry.reasoning_effort ?? ""),
          description: String(entry.description ?? ""),
        };
      })
      .filter(
        (effort): effort is { reasoningEffort: string; description: string } => effort !== null
      );
  }

  return [];
}

export function parseModelListResponse(response: unknown): ModelOption[] {
  const items = extractModelItems(response);

  return items
    .map((item): ModelOption | null => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const availableRaw = record.available;
      const providerRaw = record.provider;
      const poolRaw = record.pool;
      const sourceRaw = record.source;
      const modelSlug = String(record.model ?? record.id ?? "");
      const rawDisplayName = String(record.displayName ?? record.display_name ?? "");
      const displayName = rawDisplayName.trim().length > 0 ? rawDisplayName : modelSlug;
      return normalizeModelOption({
        id: String(record.id ?? record.model ?? ""),
        model: modelSlug,
        displayName,
        description: String(record.description ?? ""),
        provider: typeof providerRaw === "string" ? providerRaw : null,
        pool: typeof poolRaw === "string" ? poolRaw : null,
        source: typeof sourceRaw === "string" ? sourceRaw : null,
        available: typeof availableRaw === "boolean" ? availableRaw : true,
        supportedReasoningEfforts: parseReasoningEfforts(record),
        defaultReasoningEffort: normalizeEffortValue(
          record.defaultReasoningEffort ?? record.default_reasoning_effort
        ),
        isDefault: Boolean(record.isDefault ?? record.is_default ?? false),
      } satisfies ModelOption);
    })
    .filter((model): model is ModelOption => model !== null);
}

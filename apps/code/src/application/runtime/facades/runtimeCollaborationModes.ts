import { getCollaborationModes } from "../ports/collaboration";
import type { CollaborationModeOption } from "../../../types";

type CollaborationModeSettings = Record<string, unknown> & {
  model?: unknown;
  reasoning_effort?: unknown;
  developer_instructions?: unknown;
};

const CHAT_MODE_ALIASES = new Set(["default", "code", "chat"]);
const PLAN_MODE_ALIASES = new Set(["plan"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeModeKey(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function createSyntheticMode(
  id: "default" | "plan",
  label: "Default" | "Plan"
): CollaborationModeOption {
  const value: Record<string, unknown> = {
    id,
    mode: id,
    settings: {
      id,
    },
  };
  return {
    id,
    label,
    mode: id,
    model: "",
    reasoningEffort: null,
    developerInstructions: null,
    value,
  };
}

function extractModeList(response: unknown): unknown[] {
  const responseRecord = asRecord(response);
  const resultRecord = asRecord(responseRecord?.result);
  const candidates = [
    resultRecord?.data,
    resultRecord?.modes,
    responseRecord?.result,
    responseRecord?.data,
    responseRecord?.modes,
    response,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    const candidateRecord = asRecord(candidate);
    if (!candidateRecord) {
      continue;
    }
    const nested = candidateRecord.data ?? candidateRecord.modes;
    if (Array.isArray(nested)) {
      return nested;
    }
    const nestedRecord = asRecord(nested);
    if (!nestedRecord) {
      continue;
    }
    const deep = nestedRecord.data ?? nestedRecord.modes;
    if (Array.isArray(deep)) {
      return deep;
    }
  }

  return [];
}

export function isChatCollaborationMode(value: string | null | undefined): boolean {
  return CHAT_MODE_ALIASES.has(normalizeModeKey(value));
}

export function isPlanCollaborationMode(value: string | null | undefined): boolean {
  return PLAN_MODE_ALIASES.has(normalizeModeKey(value));
}

export function extractCollaborationModeIdentity(
  value: unknown
): { id: string; mode: string } | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const settings = asRecord(record.settings);
  const id =
    readNonEmptyString(settings?.id) ??
    readNonEmptyString(record.id) ??
    readNonEmptyString(record.modeId) ??
    readNonEmptyString(record.mode_id) ??
    readNonEmptyString(record.mode);
  const mode =
    readNonEmptyString(record.mode) ??
    readNonEmptyString(record.id) ??
    readNonEmptyString(record.modeId) ??
    readNonEmptyString(record.mode_id) ??
    readNonEmptyString(settings?.id);

  if (!id || !mode) {
    return null;
  }

  return { id, mode };
}

export function extractCollaborationModeId(value: unknown): string | null {
  return extractCollaborationModeIdentity(value)?.id ?? null;
}

export function normalizeRuntimeCollaborationModes(
  modes: CollaborationModeOption[]
): CollaborationModeOption[] {
  const planMode =
    modes.find(
      (mode) =>
        isPlanCollaborationMode(mode.id) ||
        isPlanCollaborationMode(mode.mode) ||
        isPlanCollaborationMode(mode.label)
    ) ?? createSyntheticMode("plan", "Plan");
  const chatMode =
    modes.find(
      (mode) =>
        isChatCollaborationMode(mode.id) ||
        isChatCollaborationMode(mode.mode) ||
        isChatCollaborationMode(mode.label)
    ) ?? createSyntheticMode("default", "Default");
  const extras = modes.filter(
    (mode) =>
      !isPlanCollaborationMode(mode.id) &&
      !isPlanCollaborationMode(mode.mode) &&
      !isPlanCollaborationMode(mode.label) &&
      !isChatCollaborationMode(mode.id) &&
      !isChatCollaborationMode(mode.mode) &&
      !isChatCollaborationMode(mode.label)
  );

  return [planMode, ...extras, chatMode];
}

export function getFallbackCollaborationModes(): CollaborationModeOption[] {
  return normalizeRuntimeCollaborationModes([]);
}

export function pickDefaultCollaborationModeId(modes: CollaborationModeOption[]): string | null {
  return (
    modes.find(
      (mode) => normalizeModeKey(mode.id) === "default" || normalizeModeKey(mode.mode) === "default"
    )?.id ??
    modes.find(
      (mode) => normalizeModeKey(mode.id) === "code" || normalizeModeKey(mode.mode) === "code"
    )?.id ??
    modes[0]?.id ??
    null
  );
}

export function parseRuntimeCollaborationModesResponse(
  response: unknown
): CollaborationModeOption[] {
  return normalizeRuntimeCollaborationModes(
    extractModeList(response)
      .map((rawItem) => {
        const item = asRecord(rawItem);
        if (!item) {
          return null;
        }
        const identity = extractCollaborationModeIdentity(item);
        if (!identity) {
          return null;
        }

        const settings: CollaborationModeSettings = (asRecord(
          item.settings
        ) as CollaborationModeSettings | null) ?? {
          model: item.model ?? null,
          reasoning_effort: item.reasoning_effort ?? item.reasoningEffort ?? null,
          developer_instructions: item.developer_instructions ?? item.developerInstructions ?? null,
        };

        const labelSource =
          typeof item.label === "string" && item.label.trim()
            ? item.label
            : typeof item.name === "string" && item.name.trim()
              ? item.name
              : identity.id;

        return {
          id: identity.id,
          label: labelSource,
          mode: identity.mode,
          model: String(settings.model ?? ""),
          reasoningEffort:
            settings.reasoning_effort === null || settings.reasoning_effort === undefined
              ? null
              : String(settings.reasoning_effort),
          developerInstructions:
            settings.developer_instructions === null ||
            settings.developer_instructions === undefined
              ? null
              : String(settings.developer_instructions),
          value: item,
        } satisfies CollaborationModeOption;
      })
      .filter((mode): mode is CollaborationModeOption => mode !== null)
  );
}

export async function loadRuntimeCollaborationModes(
  workspaceId: string
): Promise<CollaborationModeOption[]> {
  return parseRuntimeCollaborationModesResponse(await getCollaborationModes(workspaceId));
}

import type {
  AccessMode,
  AppMention,
  ComposerExecutionMode,
  CustomPromptOption,
} from "../../../types";
import type { HugeCodeTaskMode } from "@ku0/code-runtime-host-contract";
import { splitCommandLine } from "../../../utils/approvalRules";
import { expandCustomCommandText } from "../../../utils/slashCommands";
import { asString } from "../utils/threadNormalize";

export type SendMessageOptions = {
  skipPromptExpansion?: boolean;
  model?: string | null;
  effort?: string | null;
  fastMode?: boolean;
  collaborationMode?: Record<string, unknown> | null;
  accessMode?: AccessMode;
  executionMode?: ComposerExecutionMode;
  missionMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  codexBin?: string | null;
  codexArgs?: string[] | null;
  appMentions?: AppMention[];
  optimisticMessageId?: string;
};

export type ResolvedSendMessageSettings = {
  resolvedModel: string | null | undefined;
  resolvedEffort: string | null | undefined;
  resolvedFastMode: boolean;
  sanitizedCollaborationMode: Record<string, unknown> | null;
  resolvedAccessMode: AccessMode | undefined;
  resolvedExecutionMode: ComposerExecutionMode;
  resolvedMissionMode: HugeCodeTaskMode | null;
  resolvedExecutionProfileId: string | null;
  resolvedPreferredBackendIds: string[] | null;
  resolvedCodexBin: string | null;
  resolvedCodexArgs: string[] | null;
  appMentions: AppMention[];
};

export type TurnRequestMode = "start" | "steer";
export type TurnRoutingReason =
  | "steer_active_turn"
  | "fallback_to_start_missing_turn_id"
  | "start_default";

export type TurnRequestRouting = {
  requestMode: TurnRequestMode;
  activeTurnId: string | null;
  routeReason: TurnRoutingReason;
};

export type StartTurnPayload = {
  model?: string | null;
  effort?: string | null;
  serviceTier?: string | null;
  collaborationMode?: Record<string, unknown> | null;
  accessMode?: AccessMode;
  executionMode?: ComposerExecutionMode;
  missionMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  codexBin?: string | null;
  codexArgs?: string[] | null;
  contextPrefix?: string | null;
  images?: string[];
  appMentions?: AppMention[];
};

function isInlineAttachmentSource(value: string) {
  return /^data:/i.test(value) || /^https?:\/\//i.test(value);
}

function formatAttachmentLabel(value: string) {
  if (value.startsWith("data:")) {
    return "Pasted image";
  }
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? value) : value;
}

export function buildAttachmentContextPrefix(attachments: string[]): string | null {
  const filePaths = attachments
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !isInlineAttachmentSource(entry));
  if (filePaths.length === 0) {
    return null;
  }
  const lines = filePaths.map(
    (path, index) => `${index + 1}. ${formatAttachmentLabel(path)} :: ${path}`
  );
  return ["[ATTACHMENTS v1]", ...lines, "[/ATTACHMENTS]"].join("\n");
}

function normalizeCodexBin(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseCodexArgs(value: string | null | undefined): string[] | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = splitCommandLine(value);
  return parsed.length > 0 ? parsed : null;
}

function sanitizeCollaborationMode(
  value: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const settings =
    value.settings && typeof value.settings === "object"
      ? (value.settings as Record<string, unknown>)
      : null;
  const id =
    sanitizeOptionalString(settings?.id as string | null | undefined) ??
    sanitizeOptionalString(value.id as string | null | undefined) ??
    sanitizeOptionalString(value.modeId as string | null | undefined) ??
    sanitizeOptionalString(value.mode_id as string | null | undefined) ??
    sanitizeOptionalString(value.mode as string | null | undefined);
  const mode =
    sanitizeOptionalString(value.mode as string | null | undefined) ??
    sanitizeOptionalString(value.id as string | null | undefined) ??
    sanitizeOptionalString(value.modeId as string | null | undefined) ??
    sanitizeOptionalString(value.mode_id as string | null | undefined) ??
    id;

  if (!id || !mode) {
    return null;
  }

  return {
    id,
    mode,
    settings: { id },
  };
}

function sanitizeMissionMode(value: HugeCodeTaskMode | null | undefined): HugeCodeTaskMode | null {
  if (value === "ask" || value === "pair" || value === "delegate") {
    return value;
  }
  return null;
}

function sanitizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function sanitizePreferredBackendIds(value: string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = sanitizeOptionalString(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids.length > 0 ? ids : null;
}

export function resolveExpandedMessageText(
  messageText: string,
  skipPromptExpansion: boolean | undefined,
  customPrompts: CustomPromptOption[]
): { finalText: string; errorMessage: string | null } {
  if (skipPromptExpansion) {
    return { finalText: messageText, errorMessage: null };
  }
  const promptExpansion = expandCustomCommandText(messageText, customPrompts);
  if (promptExpansion && "error" in promptExpansion) {
    return { finalText: messageText, errorMessage: promptExpansion.error };
  }
  return { finalText: promptExpansion?.expanded ?? messageText, errorMessage: null };
}

export function resolveSendMessageSettings(
  options: SendMessageOptions | undefined,
  defaults: {
    model: string | null | undefined;
    effort: string | null | undefined;
    fastMode?: boolean | null;
    collaborationMode: Record<string, unknown> | null | undefined;
    accessMode: AccessMode | undefined;
    executionMode: ComposerExecutionMode;
    missionMode?: HugeCodeTaskMode | null;
    executionProfileId?: string | null;
    preferredBackendIds?: string[] | null;
    codexBin?: string | null;
    codexArgs?: string[] | null;
  }
): ResolvedSendMessageSettings {
  const resolvedModel = options?.model !== undefined ? options.model : defaults.model;
  const resolvedEffort = options?.effort !== undefined ? options.effort : defaults.effort;
  const resolvedFastMode =
    options?.fastMode !== undefined ? options.fastMode === true : defaults.fastMode === true;
  const resolvedCollaborationMode =
    options?.collaborationMode !== undefined
      ? options.collaborationMode
      : defaults.collaborationMode;
  const resolvedAccessMode =
    options?.accessMode !== undefined ? options.accessMode : defaults.accessMode;
  const resolvedExecutionMode =
    options?.executionMode !== undefined ? options.executionMode : defaults.executionMode;
  const resolvedMissionMode = sanitizeMissionMode(
    options?.missionMode !== undefined ? options.missionMode : defaults.missionMode
  );
  const resolvedExecutionProfileId = sanitizeOptionalString(
    options?.executionProfileId !== undefined
      ? options.executionProfileId
      : defaults.executionProfileId
  );
  const resolvedPreferredBackendIds = sanitizePreferredBackendIds(
    options?.preferredBackendIds !== undefined
      ? options.preferredBackendIds
      : defaults.preferredBackendIds
  );
  const resolvedCodexBin =
    options?.codexBin !== undefined
      ? normalizeCodexBin(options.codexBin)
      : (defaults.codexBin ?? null);
  const resolvedCodexArgs =
    options?.codexArgs !== undefined ? (options.codexArgs ?? null) : (defaults.codexArgs ?? null);
  return {
    resolvedModel,
    resolvedEffort,
    resolvedFastMode,
    sanitizedCollaborationMode: sanitizeCollaborationMode(resolvedCollaborationMode),
    resolvedAccessMode,
    resolvedExecutionMode,
    resolvedMissionMode,
    resolvedExecutionProfileId,
    resolvedPreferredBackendIds,
    resolvedCodexBin,
    resolvedCodexArgs,
    appMentions: options?.appMentions ?? [],
  };
}

export function resolveTurnRequestRouting(params: {
  steerEnabled: boolean;
  isProcessing: boolean;
  activeTurnId: string | null | undefined;
}): TurnRequestRouting {
  const normalizedActiveTurnId =
    typeof params.activeTurnId === "string" ? params.activeTurnId.trim() : "";
  if (params.steerEnabled && params.isProcessing && normalizedActiveTurnId.length > 0) {
    return {
      requestMode: "steer",
      activeTurnId: normalizedActiveTurnId,
      routeReason: "steer_active_turn",
    };
  }
  if (params.steerEnabled && params.isProcessing) {
    return {
      requestMode: "start",
      activeTurnId: null,
      routeReason: "fallback_to_start_missing_turn_id",
    };
  }
  return {
    requestMode: "start",
    activeTurnId: normalizedActiveTurnId.length > 0 ? normalizedActiveTurnId : null,
    routeReason: "start_default",
  };
}

export function buildStartTurnPayload(params: {
  model: string | null | undefined;
  effort: string | null | undefined;
  fastMode: boolean;
  collaborationMode: Record<string, unknown> | null;
  accessMode: AccessMode | undefined;
  executionMode: ComposerExecutionMode;
  missionMode: HugeCodeTaskMode | null;
  executionProfileId: string | null;
  preferredBackendIds: string[] | null;
  codexBin: string | null;
  codexArgs: string[] | null;
  contextPrefix: string | null;
  images: string[];
  appMentions: AppMention[];
}): StartTurnPayload {
  const payload: StartTurnPayload = {
    model: params.model,
    effort: params.effort,
    serviceTier: params.fastMode ? "fast" : null,
    collaborationMode: params.collaborationMode,
    accessMode: params.accessMode,
    executionMode: params.executionMode,
    missionMode: params.missionMode,
    executionProfileId: params.executionProfileId,
    preferredBackendIds: params.preferredBackendIds,
    codexBin: params.codexBin,
    codexArgs: params.codexArgs,
    contextPrefix: params.contextPrefix,
    images: params.images,
  };
  if (params.appMentions.length > 0) {
    payload.appMentions = params.appMentions;
  }
  return payload;
}

export function extractSteeredTurnId(response: Record<string, unknown>): string {
  const result = (response.result ?? response) as Record<string, unknown>;
  return asString(result.turnId ?? result.turn_id ?? "");
}

export function extractStartedTurnId(response: Record<string, unknown>): string {
  const result = (response.result ?? response) as Record<string, unknown>;
  const turn = (result.turn ?? response.turn ?? null) as Record<string, unknown> | null;
  return asString(turn?.id ?? "");
}

export function isInterruptRequestSuccessful(response: unknown): boolean {
  if (response === true) {
    return true;
  }
  if (!response || typeof response !== "object") {
    return false;
  }
  const record = response as Record<string, unknown>;
  if (record.interrupted === true) {
    return true;
  }
  const result = record.result;
  if (!result || typeof result !== "object") {
    return false;
  }
  return (result as Record<string, unknown>).interrupted === true;
}

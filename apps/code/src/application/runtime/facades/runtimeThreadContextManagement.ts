import type {
  AgentTaskStepInput,
  RuntimeContextLayerV2,
  RuntimeContextWorkingSetV2,
  RuntimeRunPrepareV2Request,
} from "@ku0/code-runtime-host-contract";
import type { AccessMode, ComposerExecutionMode } from "../../../types";
import {
  buildAgentTaskMissionBrief,
  normalizePreferredBackendIds,
} from "./runtimeMissionDraftFacade";

export type RuntimeThreadContextPrepareInput = {
  workspaceId: string;
  threadId: string;
  prompt: string;
  threadTitle?: string | null;
  accessMode?: AccessMode | null;
  executionMode?: ComposerExecutionMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  attachments?: string[];
  contextHints?: string[];
};

function readOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isInlineAttachmentSource(value: string) {
  return /^data:/i.test(value) || /^https?:\/\//i.test(value);
}

function formatAttachmentLabel(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? value) : value;
}

function mapComposerExecutionModeToTaskExecutionMode(
  value: ComposerExecutionMode | null | undefined
): "single" | "distributed" {
  return value === "runtime" ? "distributed" : "single";
}

function buildContextHintSteps(hints: string[]): AgentTaskStepInput[] {
  return hints
    .map((hint) => readOptionalText(hint))
    .filter((hint): hint is string => Boolean(hint))
    .map((hint, index) => ({
      kind: "read" as const,
      input: index === 0 ? `Thread context hint: ${hint}` : hint,
    }));
}

function buildAttachmentSteps(attachments: string[]): AgentTaskStepInput[] {
  return attachments
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !isInlineAttachmentSource(entry))
    .map((path) => ({
      kind: "read" as const,
      path,
      input: `Attachment context: ${formatAttachmentLabel(path)} (${path})`,
    }));
}

export function buildRuntimeThreadContextPrepareRequest(
  input: RuntimeThreadContextPrepareInput
): RuntimeRunPrepareV2Request | null {
  const prompt = readOptionalText(input.prompt);
  if (!prompt) {
    return null;
  }

  const preferredBackendIds = normalizePreferredBackendIds(input.preferredBackendIds);
  const accessMode = input.accessMode ?? "on-request";
  const contextHintSteps = buildContextHintSteps(input.contextHints ?? []);
  const attachmentSteps = buildAttachmentSteps(input.attachments ?? []);
  const objectiveTitle = readOptionalText(input.threadTitle) ?? truncateText(prompt, 80);

  return {
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    title: objectiveTitle,
    taskSource: {
      kind: "manual",
      title: objectiveTitle,
    },
    ...(readOptionalText(input.executionProfileId)
      ? { executionProfileId: readOptionalText(input.executionProfileId) }
      : {}),
    accessMode,
    executionMode: mapComposerExecutionModeToTaskExecutionMode(input.executionMode),
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    missionBrief: buildAgentTaskMissionBrief({
      objective: prompt,
      accessMode,
      preferredBackendIds,
    }),
    steps: [
      {
        kind: "read",
        input: prompt,
      },
      ...contextHintSteps,
      ...attachmentSteps,
    ],
  };
}

function formatEntryLine(
  entry: RuntimeContextLayerV2["entries"][number],
  index: number,
  includeSource: boolean
) {
  const detail = readOptionalText(entry.detail);
  const source = includeSource ? readOptionalText(entry.source) : null;
  const parts = [entry.label, detail, source ? `source=${source}` : null].filter(
    (part): part is string => Boolean(part)
  );
  return `${index + 1}. ${parts.join(" :: ")}`;
}

export function buildRuntimeContextPrefix(
  workingSet: RuntimeContextWorkingSetV2 | null | undefined
): string | null {
  if (!workingSet) {
    return null;
  }

  const selectionPolicy = workingSet.selectionPolicy ?? {
    strategy: "balanced",
    tokenBudgetTarget: 1500,
    toolExposureProfile: "slim",
    preferColdFetch: true,
  };
  const strategy = selectionPolicy.strategy;
  const includeColdEntries = !selectionPolicy.preferColdFetch || strategy === "deep";
  const renderedLayers = workingSet.layers.flatMap((layer) => {
    if (layer.entries.length === 0) {
      return [];
    }
    if (layer.tier === "cold" && !includeColdEntries) {
      return [`${layer.tier.toUpperCase()}: ${layer.summary}`];
    }
    return [
      `${layer.tier.toUpperCase()}: ${layer.summary}`,
      ...layer.entries
        .slice(0, layer.tier === "cold" ? 3 : 6)
        .map((entry, index) => formatEntryLine(entry, index, layer.tier !== "hot")),
    ];
  });

  if (renderedLayers.length === 0) {
    return null;
  }

  return [
    "[RUNTIME_CONTEXT v2]",
    "Internal runtime context only. Use silently to answer the real user request after this block.",
    `Selection: strategy=${strategy}, budget=${selectionPolicy.tokenBudgetTarget}, tools=${selectionPolicy.toolExposureProfile}.`,
    `Fingerprints: stable=${workingSet.stablePrefixFingerprint ?? "unavailable"}, working=${workingSet.contextFingerprint ?? "unavailable"}.`,
    readOptionalText(workingSet.workspaceRoot)
      ? `Workspace root: ${workingSet.workspaceRoot}`
      : null,
    workingSet.summary,
    ...renderedLayers,
    "[/RUNTIME_CONTEXT]",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

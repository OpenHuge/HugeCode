import type { AgentTaskSourceSummary } from "@ku0/code-runtime-host-contract";
import type { DesktopAiWebLabArtifact } from "../ports/aiWebLab";
import type { RuntimeTaskLauncherSourceDraft } from "./runtimeTaskInterventionDraftFacade";

type AiWebLabDraftWorkspace = {
  id: string;
  name: string;
};

type BuildRuntimeAiWebLabSourceDraftInput = {
  artifact: DesktopAiWebLabArtifact;
  workspace: AiWebLabDraftWorkspace;
  profileId: string;
  draftTitle?: string | null;
};

type RuntimeAiWebLabSourceDraftResult = {
  draftTitle: string;
  draftInstruction: string;
  sourceDraft: RuntimeTaskLauncherSourceDraft;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatArtifactKindLabel(value: DesktopAiWebLabArtifact["artifactKind"]): string {
  return value.replaceAll("_", " ");
}

function buildAiWebLabArtifactExternalId(artifact: DesktopAiWebLabArtifact): string {
  const entrypointId = readOptionalText(artifact.entrypointId) ?? "default";
  return `ai-web-lab:${artifact.providerId}:${artifact.artifactKind}:${entrypointId}`;
}

function buildAiWebLabArtifactInstruction(artifact: DesktopAiWebLabArtifact): string | null {
  const content = readOptionalText(artifact.content);
  const sourceUrl = readOptionalText(artifact.sourceUrl);
  const pageTitle = readOptionalText(artifact.pageTitle);
  if (artifact.format !== "url" && content) {
    return content;
  }

  const lines = [
    pageTitle ? `AI Web Lab artifact: ${pageTitle}` : "AI Web Lab artifact",
    `Provider: ${artifact.providerId}`,
    `Artifact kind: ${formatArtifactKindLabel(artifact.artifactKind)}`,
    sourceUrl ? `Source URL: ${sourceUrl}` : null,
    "",
    content ?? "Open the linked AI Web Lab artifact and execute the requested work.",
  ].filter((entry): entry is string => entry !== null);

  return lines.join("\n");
}

function buildAiWebLabTaskSource(input: {
  artifact: DesktopAiWebLabArtifact;
  workspaceId: string;
  title: string;
}): AgentTaskSourceSummary {
  const sourceUrl = readOptionalText(input.artifact.sourceUrl);
  const externalId = buildAiWebLabArtifactExternalId(input.artifact);
  return {
    kind: "external_ref",
    label: "AI Web Lab",
    shortLabel: "AI Web Lab",
    title: input.title,
    reference: `${input.artifact.providerId}/${input.artifact.artifactKind}`,
    ...(sourceUrl ? { url: sourceUrl } : {}),
    workspaceId: input.workspaceId,
    externalId,
    canonicalUrl: sourceUrl,
    sourceTaskId: externalId,
    sourceRunId: externalId,
  };
}

export function buildRuntimeAiWebLabSourceDraft(
  input: BuildRuntimeAiWebLabSourceDraftInput
): RuntimeAiWebLabSourceDraftResult | null {
  if (input.artifact.status !== "succeeded") {
    return null;
  }

  const draftInstruction = buildAiWebLabArtifactInstruction(input.artifact);
  if (!draftInstruction) {
    return null;
  }

  const sourceTitle =
    readOptionalText(input.artifact.pageTitle) ??
    `AI Web Lab - ${input.workspace.name} (${input.artifact.providerId})`;
  const draftTitle = readOptionalText(input.draftTitle) ?? sourceTitle;

  return {
    draftTitle,
    draftInstruction,
    sourceDraft: {
      kind: "source_launch",
      taskId: buildAiWebLabArtifactExternalId(input.artifact),
      title: sourceTitle,
      instruction: draftInstruction,
      profileId: input.profileId,
      reviewProfileId: null,
      taskSource: buildAiWebLabTaskSource({
        artifact: input.artifact,
        workspaceId: input.workspace.id,
        title: sourceTitle,
      }),
      validationPresetId: null,
      accessMode: null,
      fieldOrigins: {
        executionProfileId: "explicit_override",
        preferredBackendIds: "explicit_override",
        accessMode: "explicit_override",
        reviewProfileId: "explicit_override",
        validationPresetId: "explicit_override",
      },
    },
  };
}

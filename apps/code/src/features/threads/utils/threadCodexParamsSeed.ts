import type { AccessMode, ComposerExecutionMode } from "../../../types";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import type { ThreadCodexParams } from "./threadStorage";
import { makeThreadCodexParamsKey } from "./threadStorage";

export const NO_THREAD_SCOPE_SUFFIX = "__no_thread__";

export type PendingNewThreadSeed = {
  workspaceId: string;
  collaborationModeId: string | null;
  accessMode: AccessMode;
  executionMode: ComposerExecutionMode;
  fastMode: boolean;
  autoDriveDraft: AutoDriveControllerHookDraft | null;
};

type ResolveThreadCodexStateInput = {
  workspaceId: string;
  threadId: string | null;
  defaultAccessMode: AccessMode;
  lastComposerModelId: string | null;
  lastComposerReasoningEffort: string | null;
  lastComposerFastMode: boolean | null | undefined;
  lastComposerExecutionMode: ComposerExecutionMode | null | undefined;
  stored: ThreadCodexParams | null;
  pendingSeed: PendingNewThreadSeed | null;
};

export type ResolvedThreadCodexState = {
  scopeKey: string;
  accessMode: AccessMode;
  preferredModelId: string | null;
  preferredEffort: string | null;
  preferredFastMode: boolean;
  preferredCollabModeId: string | null;
  executionMode: ComposerExecutionMode;
};

export type ThreadCodexSeedPatch = {
  modelId: string | null;
  effort: string | null;
  fastMode: boolean;
  accessMode: AccessMode;
  collaborationModeId: string | null;
  executionMode: ComposerExecutionMode;
  autoDriveDraft: AutoDriveControllerHookDraft | null;
};

export function createPendingThreadSeed(options: {
  activeThreadId: string | null;
  activeWorkspaceId: string | null;
  selectedCollaborationModeId: string | null;
  accessMode: AccessMode;
  executionMode: ComposerExecutionMode;
  fastMode: boolean;
  autoDriveDraft?: AutoDriveControllerHookDraft | null;
}): PendingNewThreadSeed | null {
  const {
    activeThreadId,
    activeWorkspaceId,
    selectedCollaborationModeId,
    accessMode,
    executionMode,
    fastMode,
    autoDriveDraft,
  } = options;
  if (activeThreadId || !activeWorkspaceId) {
    return null;
  }
  return {
    workspaceId: activeWorkspaceId,
    collaborationModeId: selectedCollaborationModeId,
    accessMode,
    executionMode,
    fastMode,
    autoDriveDraft: autoDriveDraft?.enabled ? autoDriveDraft : null,
  };
}

export function resolveThreadCodexState(
  input: ResolveThreadCodexStateInput
): ResolvedThreadCodexState {
  const {
    workspaceId,
    threadId,
    defaultAccessMode,
    lastComposerModelId,
    lastComposerReasoningEffort,
    lastComposerFastMode,
    lastComposerExecutionMode,
    stored,
    pendingSeed,
  } = input;

  if (!threadId) {
    return {
      scopeKey: `${workspaceId}:${NO_THREAD_SCOPE_SUFFIX}`,
      accessMode: defaultAccessMode,
      preferredModelId: lastComposerModelId,
      preferredEffort: lastComposerReasoningEffort,
      preferredFastMode: lastComposerFastMode === true,
      preferredCollabModeId: null,
      executionMode: lastComposerExecutionMode ?? "runtime",
    };
  }

  const pendingAccessMode =
    pendingSeed && pendingSeed.workspaceId === workspaceId ? pendingSeed.accessMode : null;
  const pendingCollabModeId =
    pendingSeed && pendingSeed.workspaceId === workspaceId ? pendingSeed.collaborationModeId : null;
  const pendingExecutionMode =
    pendingSeed && pendingSeed.workspaceId === workspaceId ? pendingSeed.executionMode : null;
  const pendingFastMode =
    pendingSeed && pendingSeed.workspaceId === workspaceId ? pendingSeed.fastMode : null;

  return {
    scopeKey: makeThreadCodexParamsKey(workspaceId, threadId),
    accessMode: stored?.accessMode ?? pendingAccessMode ?? defaultAccessMode,
    preferredModelId: stored?.modelId ?? lastComposerModelId ?? null,
    preferredEffort: stored?.effort ?? lastComposerReasoningEffort ?? null,
    preferredFastMode: stored?.fastMode ?? pendingFastMode ?? lastComposerFastMode === true,
    preferredCollabModeId: stored?.collaborationModeId ?? pendingCollabModeId ?? null,
    executionMode:
      stored?.executionMode ?? pendingExecutionMode ?? lastComposerExecutionMode ?? "runtime",
  };
}

export function buildThreadCodexSeedPatch(options: {
  workspaceId: string;
  resolvedModel: string | null;
  resolvedEffort: string | null;
  fastMode: boolean;
  accessMode: AccessMode;
  selectedCollaborationModeId: string | null;
  executionMode: ComposerExecutionMode;
  pendingSeed: PendingNewThreadSeed | null;
}): ThreadCodexSeedPatch {
  const {
    workspaceId,
    resolvedModel,
    resolvedEffort,
    fastMode,
    accessMode,
    selectedCollaborationModeId,
    executionMode,
    pendingSeed,
  } = options;

  const pendingForWorkspace =
    pendingSeed && pendingSeed.workspaceId === workspaceId ? pendingSeed : null;

  return {
    modelId: resolvedModel,
    effort: resolvedEffort,
    fastMode: pendingForWorkspace?.fastMode ?? fastMode,
    accessMode: pendingForWorkspace?.accessMode ?? accessMode,
    collaborationModeId: pendingForWorkspace?.collaborationModeId ?? selectedCollaborationModeId,
    executionMode: pendingForWorkspace?.executionMode ?? executionMode,
    autoDriveDraft: pendingForWorkspace?.autoDriveDraft ?? null,
  };
}

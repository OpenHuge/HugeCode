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
  currentScopeKey?: string | null;
  currentModelId?: string | null;
  currentReasoningEffort?: string | null;
  currentAccessMode?: AccessMode | null;
  currentFastMode?: boolean;
  currentCollaborationModeId?: string | null;
  currentExecutionMode?: ComposerExecutionMode | null;
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
    currentScopeKey,
    currentModelId,
    currentReasoningEffort,
    currentAccessMode,
    currentFastMode,
    currentCollaborationModeId,
    currentExecutionMode,
  } = input;
  const noThreadScopeKey = `${workspaceId}:${NO_THREAD_SCOPE_SUFFIX}`;
  const pendingForWorkspace =
    pendingSeed && pendingSeed.workspaceId === workspaceId ? pendingSeed : null;
  const preservingCurrentNoThreadScope = currentScopeKey === noThreadScopeKey;

  if (!threadId) {
    return {
      scopeKey: noThreadScopeKey,
      accessMode:
        pendingForWorkspace?.accessMode ??
        (preservingCurrentNoThreadScope && currentAccessMode
          ? currentAccessMode
          : defaultAccessMode),
      preferredModelId:
        (preservingCurrentNoThreadScope ? currentModelId : null) ?? lastComposerModelId,
      preferredEffort:
        (preservingCurrentNoThreadScope ? currentReasoningEffort : null) ??
        lastComposerReasoningEffort,
      preferredFastMode:
        pendingForWorkspace?.fastMode ??
        (preservingCurrentNoThreadScope ? currentFastMode === true : lastComposerFastMode === true),
      preferredCollabModeId:
        pendingForWorkspace?.collaborationModeId ??
        (preservingCurrentNoThreadScope ? (currentCollaborationModeId ?? null) : null),
      executionMode:
        pendingForWorkspace?.executionMode ??
        (preservingCurrentNoThreadScope && currentExecutionMode
          ? currentExecutionMode
          : (lastComposerExecutionMode ?? "runtime")),
    };
  }

  return {
    scopeKey: makeThreadCodexParamsKey(workspaceId, threadId),
    accessMode: stored?.accessMode ?? pendingForWorkspace?.accessMode ?? defaultAccessMode,
    preferredModelId: stored?.modelId ?? lastComposerModelId ?? null,
    preferredEffort: stored?.effort ?? lastComposerReasoningEffort ?? null,
    preferredFastMode:
      stored?.fastMode ?? pendingForWorkspace?.fastMode ?? lastComposerFastMode === true,
    preferredCollabModeId:
      stored?.collaborationModeId ?? pendingForWorkspace?.collaborationModeId ?? null,
    executionMode:
      stored?.executionMode ??
      pendingForWorkspace?.executionMode ??
      lastComposerExecutionMode ??
      "runtime",
  };
}

export function buildThreadCodexSeedPatch(options: {
  workspaceId: string;
  selectedModelId: string | null;
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
    selectedModelId,
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
    modelId: selectedModelId ?? resolvedModel,
    effort: resolvedEffort,
    fastMode: pendingForWorkspace?.fastMode ?? fastMode,
    accessMode: pendingForWorkspace?.accessMode ?? accessMode,
    collaborationModeId: pendingForWorkspace?.collaborationModeId ?? selectedCollaborationModeId,
    executionMode: pendingForWorkspace?.executionMode ?? executionMode,
    autoDriveDraft: pendingForWorkspace?.autoDriveDraft ?? null,
  };
}

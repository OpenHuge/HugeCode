import type {
  AccessMode,
  ComposerExecutionMode,
  ComposerModelSelectionMode,
  ModelProviderFamilyId,
} from "../../../types";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import type { ThreadCodexParams } from "./threadStorage";
import { makeThreadCodexParamsKey } from "./threadStorage";

export const NO_THREAD_SCOPE_SUFFIX = "__no_thread__";

export type PendingNewThreadSeed = {
  workspaceId: string;
  selectionMode: ComposerModelSelectionMode;
  providerFamilyId: ModelProviderFamilyId | null;
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
  composerModelSelectionMode?: ComposerModelSelectionMode | null;
  lastComposerProviderFamilyId?: ModelProviderFamilyId | null;
  lastComposerFastMode: boolean | null | undefined;
  lastComposerExecutionMode: ComposerExecutionMode | null | undefined;
  stored: ThreadCodexParams | null;
  pendingSeed: PendingNewThreadSeed | null;
  currentScopeKey?: string | null;
  currentModelId?: string | null;
  currentReasoningEffort?: string | null;
  currentSelectionMode?: ComposerModelSelectionMode | null;
  currentProviderFamilyId?: ModelProviderFamilyId | null;
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
  selectionMode: ComposerModelSelectionMode;
  providerFamilyId: ModelProviderFamilyId | null;
  preferredFastMode: boolean;
  preferredCollabModeId: string | null;
  executionMode: ComposerExecutionMode;
};

export type ThreadCodexSeedPatch = {
  modelId: string | null;
  effort: string | null;
  selectionMode: ComposerModelSelectionMode;
  providerFamilyId: ModelProviderFamilyId | null;
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
  selectionMode: ComposerModelSelectionMode;
  providerFamilyId: ModelProviderFamilyId | null;
  accessMode: AccessMode;
  executionMode: ComposerExecutionMode;
  fastMode: boolean;
  autoDriveDraft?: AutoDriveControllerHookDraft | null;
}): PendingNewThreadSeed | null {
  const {
    activeThreadId,
    activeWorkspaceId,
    selectionMode,
    providerFamilyId,
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
    selectionMode,
    providerFamilyId,
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
    composerModelSelectionMode,
    lastComposerProviderFamilyId,
    lastComposerFastMode,
    lastComposerExecutionMode,
    stored,
    pendingSeed,
    currentScopeKey,
    currentModelId,
    currentReasoningEffort,
    currentSelectionMode,
    currentProviderFamilyId,
    currentAccessMode,
    currentFastMode,
    currentCollaborationModeId,
    currentExecutionMode,
  } = input;
  const noThreadScopeKey = `${workspaceId}:${NO_THREAD_SCOPE_SUFFIX}`;
  const pendingForWorkspace =
    pendingSeed && pendingSeed.workspaceId === workspaceId ? pendingSeed : null;
  const preservingCurrentNoThreadScope = currentScopeKey === noThreadScopeKey;
  const defaultSelectionMode = composerModelSelectionMode === "manual" ? "manual" : "auto";

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
      selectionMode:
        pendingForWorkspace?.selectionMode ??
        (preservingCurrentNoThreadScope
          ? (currentSelectionMode ?? defaultSelectionMode)
          : defaultSelectionMode),
      providerFamilyId:
        pendingForWorkspace?.providerFamilyId ??
        (preservingCurrentNoThreadScope
          ? (currentProviderFamilyId ?? lastComposerProviderFamilyId ?? null)
          : (lastComposerProviderFamilyId ?? null)),
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
    selectionMode:
      stored?.selectionMode ?? pendingForWorkspace?.selectionMode ?? defaultSelectionMode,
    providerFamilyId:
      stored?.providerFamilyId ??
      pendingForWorkspace?.providerFamilyId ??
      lastComposerProviderFamilyId ??
      null,
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
  selectionMode: ComposerModelSelectionMode;
  providerFamilyId: ModelProviderFamilyId | null;
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
    selectionMode,
    providerFamilyId,
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
    selectionMode: pendingForWorkspace?.selectionMode ?? selectionMode,
    providerFamilyId: pendingForWorkspace?.providerFamilyId ?? providerFamilyId,
    fastMode: pendingForWorkspace?.fastMode ?? fastMode,
    accessMode: pendingForWorkspace?.accessMode ?? accessMode,
    collaborationModeId: pendingForWorkspace?.collaborationModeId ?? selectedCollaborationModeId,
    executionMode: pendingForWorkspace?.executionMode ?? executionMode,
    autoDriveDraft: pendingForWorkspace?.autoDriveDraft ?? null,
  };
}

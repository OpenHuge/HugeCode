import { type MutableRefObject, useEffect, useLayoutEffect, useRef } from "react";
import type { AccessMode, ComposerExecutionMode } from "../../../types";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import {
  buildThreadCodexSeedPatch,
  type PendingNewThreadSeed,
  resolveThreadCodexState,
} from "../../threads/utils/threadCodexParamsSeed";
import { makeThreadCodexParamsKey } from "../../threads/utils/threadStorage";

type UseThreadCodexSyncOptions = {
  activeThreadId: string | null;
  activeThreadIdRef: MutableRefObject<string | null>;
  activeWorkspaceId: string | null;
  appDefaultAccessMode: AccessMode;
  lastComposerModelId: string | null;
  lastComposerReasoningEffort: string | null;
  lastComposerFastMode: boolean | null | undefined;
  lastComposerExecutionMode: ComposerExecutionMode | null | undefined;
  threadCodexParamsVersion: number;
  getThreadCodexParams: (
    workspaceId: string,
    threadId: string
  ) => {
    modelId: string | null;
    effort: string | null;
    fastMode?: boolean | null;
    accessMode: AccessMode | null;
    collaborationModeId: string | null;
    executionMode: ComposerExecutionMode | null;
    autoDriveDraft?: AutoDriveControllerHookDraft | null;
    updatedAt: number;
  } | null;
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: {
      modelId?: string | null;
      effort?: string | null;
      fastMode?: boolean | null;
      accessMode?: AccessMode | null;
      collaborationModeId?: string | null;
      executionMode?: ComposerExecutionMode | null;
      autoDriveDraft?: AutoDriveControllerHookDraft | null;
    }
  ) => void;
  setThreadCodexSelectionKey: (key: string | null) => void;
  setAccessMode: (mode: AccessMode) => void;
  setPreferredModelId: (id: string | null) => void;
  setPreferredEffort: (effort: string | null) => void;
  setPreferredFastMode: (enabled: boolean) => void;
  setPreferredCollabModeId: (id: string | null) => void;
  setExecutionMode: (mode: ComposerExecutionMode) => void;
  pendingNewThreadSeedRef: MutableRefObject<PendingNewThreadSeed | null>;
  resolvedModel: string | null;
  resolvedEffort: string | null;
  accessMode: AccessMode;
  fastModeEnabled: boolean;
  selectedCollaborationModeId: string | null;
  executionMode: ComposerExecutionMode;
};

export function useThreadCodexSync({
  activeThreadId,
  activeThreadIdRef,
  activeWorkspaceId,
  appDefaultAccessMode,
  lastComposerModelId,
  lastComposerReasoningEffort,
  lastComposerFastMode,
  lastComposerExecutionMode,
  threadCodexParamsVersion,
  getThreadCodexParams,
  patchThreadCodexParams,
  setThreadCodexSelectionKey,
  setAccessMode,
  setPreferredModelId,
  setPreferredEffort,
  setPreferredFastMode,
  setPreferredCollabModeId,
  setExecutionMode,
  pendingNewThreadSeedRef,
  resolvedModel,
  resolvedEffort,
  accessMode,
  fastModeEnabled,
  selectedCollaborationModeId,
  executionMode,
}: UseThreadCodexSyncOptions) {
  useLayoutEffect(() => {
    void threadCodexParamsVersion;
    const workspaceId = activeWorkspaceId ?? null;
    const threadId = activeThreadId ?? null;
    activeThreadIdRef.current = threadId;

    if (!workspaceId) {
      return;
    }

    const stored = threadId ? getThreadCodexParams(workspaceId, threadId) : null;
    const resolved = resolveThreadCodexState({
      workspaceId,
      threadId,
      defaultAccessMode: appDefaultAccessMode,
      lastComposerModelId,
      lastComposerReasoningEffort,
      lastComposerFastMode,
      lastComposerExecutionMode,
      stored,
      pendingSeed: pendingNewThreadSeedRef.current,
    });

    setThreadCodexSelectionKey(resolved.scopeKey);
    setAccessMode(resolved.accessMode);
    setPreferredModelId(resolved.preferredModelId);
    setPreferredEffort(resolved.preferredEffort);
    setPreferredFastMode(resolved.preferredFastMode);
    setPreferredCollabModeId(resolved.preferredCollabModeId);
    setExecutionMode(resolved.executionMode);
  }, [
    activeThreadId,
    activeWorkspaceId,
    appDefaultAccessMode,
    getThreadCodexParams,
    lastComposerModelId,
    lastComposerReasoningEffort,
    lastComposerFastMode,
    lastComposerExecutionMode,
    pendingNewThreadSeedRef,
    setAccessMode,
    setPreferredCollabModeId,
    setPreferredEffort,
    setPreferredFastMode,
    setPreferredModelId,
    setExecutionMode,
    setThreadCodexSelectionKey,
    threadCodexParamsVersion,
    activeThreadIdRef,
  ]);

  const seededThreadParamsRef = useRef(new Set<string>());
  useEffect(() => {
    const workspaceId = activeWorkspaceId ?? null;
    const threadId = activeThreadId ?? null;
    if (!workspaceId || !threadId) {
      return;
    }

    const key = makeThreadCodexParamsKey(workspaceId, threadId);
    if (seededThreadParamsRef.current.has(key)) {
      return;
    }

    const stored = getThreadCodexParams(workspaceId, threadId);
    if (stored) {
      seededThreadParamsRef.current.add(key);
      return;
    }

    seededThreadParamsRef.current.add(key);
    const pendingSeed = pendingNewThreadSeedRef.current;
    patchThreadCodexParams(
      workspaceId,
      threadId,
      buildThreadCodexSeedPatch({
        workspaceId,
        resolvedModel,
        resolvedEffort,
        fastMode: fastModeEnabled,
        accessMode,
        selectedCollaborationModeId,
        executionMode,
        pendingSeed,
      })
    );
    if (pendingSeed?.workspaceId === workspaceId) {
      pendingNewThreadSeedRef.current = null;
    }
  }, [
    accessMode,
    activeThreadId,
    activeWorkspaceId,
    getThreadCodexParams,
    patchThreadCodexParams,
    pendingNewThreadSeedRef,
    resolvedModel,
    resolvedEffort,
    fastModeEnabled,
    selectedCollaborationModeId,
    executionMode,
  ]);
}

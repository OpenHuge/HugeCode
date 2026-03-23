import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HugeCodeTaskMode } from "@ku0/code-runtime-host-contract";
import type { AccessMode, ComposerExecutionMode } from "../../../types";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import { normalizePreferredBackendIds } from "../../../application/runtime/facades/runtimeMissionDraftFacade";
import {
  loadThreadCodexParams,
  makeThreadCodexParamsKey,
  STORAGE_KEY_THREAD_CODEX_PARAMS,
  saveThreadCodexParams,
  type ThreadCodexParams,
  type ThreadCodexParamsMap,
} from "../utils/threadStorage";

export type ThreadCodexParamsPatch = Partial<
  Pick<
    ThreadCodexParams,
    | "modelId"
    | "effort"
    | "fastMode"
    | "accessMode"
    | "collaborationModeId"
    | "executionMode"
    | "missionMode"
    | "executionProfileId"
    | "preferredBackendIds"
    | "autoDriveDraft"
  >
>;

type UseThreadCodexParamsResult = {
  version: number;
  getThreadCodexParams: (workspaceId: string, threadId: string) => ThreadCodexParams | null;
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadCodexParamsPatch
  ) => void;
  deleteThreadCodexParams: (workspaceId: string, threadId: string) => void;
};

const DEFAULT_ENTRY: ThreadCodexParams = {
  modelId: null,
  effort: null,
  fastMode: null,
  accessMode: null,
  collaborationModeId: null,
  executionMode: null,
  missionMode: null,
  executionProfileId: null,
  preferredBackendIds: null,
  autoDriveDraft: null,
  updatedAt: 0,
};

function sanitizeAutoDriveDraft(value: unknown): AutoDriveControllerHookDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const budget = (entry.budget ?? {}) as Record<string, unknown>;
  const riskPolicy = (entry.riskPolicy ?? {}) as Record<string, unknown>;
  const continuation = (entry.continuation ?? {}) as Record<string, unknown>;
  const destination = (entry.destination ?? {}) as Record<string, unknown>;
  return {
    enabled: entry.enabled === true,
    scenarioProfile:
      entry.scenarioProfile === "browser_repro_fix_verify"
        ? entry.scenarioProfile
        : "browser_repro_fix_verify",
    destination: {
      title:
        typeof destination.title === "string"
          ? destination.title
          : typeof entry.goal === "string"
            ? entry.goal
            : "",
      endState: typeof destination.endState === "string" ? destination.endState : "",
      doneDefinition:
        typeof destination.doneDefinition === "string" ? destination.doneDefinition : "",
      avoid:
        typeof destination.avoid === "string"
          ? destination.avoid
          : typeof entry.constraints === "string"
            ? entry.constraints
            : "",
      routePreference:
        destination.routePreference === "minimal_change" ||
        destination.routePreference === "validation_first" ||
        destination.routePreference === "docs_first" ||
        destination.routePreference === "speed_first" ||
        destination.routePreference === "stability_first"
          ? destination.routePreference
          : "stability_first",
    },
    budget: {
      maxTokens: typeof budget.maxTokens === "number" ? budget.maxTokens : 12000,
      maxIterations: typeof budget.maxIterations === "number" ? budget.maxIterations : 3,
      maxDurationMinutes:
        typeof budget.maxDurationMinutes === "number" ? budget.maxDurationMinutes : 30,
      maxFilesPerIteration:
        typeof budget.maxFilesPerIteration === "number" ? budget.maxFilesPerIteration : 6,
      maxNoProgressIterations:
        typeof budget.maxNoProgressIterations === "number" ? budget.maxNoProgressIterations : 2,
      maxValidationFailures:
        typeof budget.maxValidationFailures === "number" ? budget.maxValidationFailures : 2,
      maxReroutes: typeof budget.maxReroutes === "number" ? budget.maxReroutes : 2,
    },
    riskPolicy: {
      pauseOnDestructiveChange: riskPolicy.pauseOnDestructiveChange !== false,
      pauseOnDependencyChange: riskPolicy.pauseOnDependencyChange !== false,
      pauseOnLowConfidence: riskPolicy.pauseOnLowConfidence !== false,
      pauseOnHumanCheckpoint: riskPolicy.pauseOnHumanCheckpoint !== false,
      allowNetworkAnalysis: riskPolicy.allowNetworkAnalysis === true,
      allowValidationCommands: riskPolicy.allowValidationCommands !== false,
      allowChatgptDecisionLab: riskPolicy.allowChatgptDecisionLab !== false,
      autoRunChatgptDecisionLab: riskPolicy.autoRunChatgptDecisionLab !== false,
      chatgptDecisionLabMinConfidence:
        riskPolicy.chatgptDecisionLabMinConfidence === "low" ||
        riskPolicy.chatgptDecisionLabMinConfidence === "medium" ||
        riskPolicy.chatgptDecisionLabMinConfidence === "high"
          ? riskPolicy.chatgptDecisionLabMinConfidence
          : "medium",
      chatgptDecisionLabMaxScoreGap:
        typeof riskPolicy.chatgptDecisionLabMaxScoreGap === "number"
          ? riskPolicy.chatgptDecisionLabMaxScoreGap
          : 8,
      minimumConfidence:
        riskPolicy.minimumConfidence === "low" ||
        riskPolicy.minimumConfidence === "medium" ||
        riskPolicy.minimumConfidence === "high"
          ? riskPolicy.minimumConfidence
          : "medium",
    },
    continuation: {
      enabled: continuation.enabled !== false,
      maxAutomaticFollowUps:
        typeof continuation.maxAutomaticFollowUps === "number"
          ? Math.max(0, Math.round(continuation.maxAutomaticFollowUps))
          : 2,
      requireValidationSuccessToStop: continuation.requireValidationSuccessToStop !== false,
      minimumConfidenceToStop:
        continuation.minimumConfidenceToStop === "low" ||
        continuation.minimumConfidenceToStop === "medium" ||
        continuation.minimumConfidenceToStop === "high"
          ? continuation.minimumConfidenceToStop
          : "high",
    },
  };
}

function coerceAccessMode(value: unknown): AccessMode | null {
  if (value === "current") {
    return "on-request";
  }
  if (value === "read-only" || value === "on-request" || value === "full-access") {
    return value;
  }
  return null;
}

function coerceExecutionMode(value: unknown): ComposerExecutionMode | null {
  if (value === "runtime" || value === "local-cli" || value === "hybrid") {
    return value;
  }
  if (value === "local_cli") {
    return "local-cli";
  }
  return null;
}

function coerceMissionMode(value: unknown): HugeCodeTaskMode | null {
  if (value === "ask" || value === "pair" || value === "delegate") {
    return value;
  }
  return null;
}

function coerceExecutionProfileId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function coerceOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function sanitizeEntry(value: unknown): ThreadCodexParams | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as Record<string, unknown>;
  return {
    modelId: typeof entry.modelId === "string" ? entry.modelId : null,
    effort: typeof entry.effort === "string" ? entry.effort : null,
    fastMode: coerceOptionalBoolean(entry.fastMode),
    accessMode: coerceAccessMode(entry.accessMode),
    collaborationModeId:
      typeof entry.collaborationModeId === "string" ? entry.collaborationModeId : null,
    executionMode: coerceExecutionMode(entry.executionMode),
    missionMode: coerceMissionMode(entry.missionMode),
    executionProfileId: coerceExecutionProfileId(entry.executionProfileId),
    preferredBackendIds: normalizePreferredBackendIds(entry.preferredBackendIds),
    autoDriveDraft: sanitizeAutoDriveDraft(entry.autoDriveDraft),
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
  };
}

export function useThreadCodexParams(): UseThreadCodexParamsResult {
  const paramsRef = useRef<ThreadCodexParamsMap>(loadThreadCodexParams());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY_THREAD_CODEX_PARAMS) {
        return;
      }
      paramsRef.current = loadThreadCodexParams();
      setVersion((v) => v + 1);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const getThreadCodexParams = useCallback(
    (workspaceId: string, threadId: string): ThreadCodexParams | null => {
      const key = makeThreadCodexParamsKey(workspaceId, threadId);
      const entry = paramsRef.current[key];
      return sanitizeEntry(entry) ?? null;
    },
    []
  );

  const patchThreadCodexParams = useCallback(
    (workspaceId: string, threadId: string, patch: ThreadCodexParamsPatch) => {
      const key = makeThreadCodexParamsKey(workspaceId, threadId);
      const current = sanitizeEntry(paramsRef.current[key]) ?? DEFAULT_ENTRY;
      const nextEntry: ThreadCodexParams = {
        ...current,
        ...patch,
        updatedAt: Date.now(),
      };
      const next: ThreadCodexParamsMap = { ...paramsRef.current, [key]: nextEntry };
      paramsRef.current = next;
      saveThreadCodexParams(next);
      setVersion((v) => v + 1);
    },
    []
  );

  const deleteThreadCodexParams = useCallback((workspaceId: string, threadId: string) => {
    const key = makeThreadCodexParamsKey(workspaceId, threadId);
    if (!(key in paramsRef.current)) {
      return;
    }
    const { [key]: _removed, ...rest } = paramsRef.current;
    paramsRef.current = rest;
    saveThreadCodexParams(rest);
    setVersion((v) => v + 1);
  }, []);

  return useMemo(
    () => ({
      version,
      getThreadCodexParams,
      patchThreadCodexParams,
      deleteThreadCodexParams,
    }),
    [deleteThreadCodexParams, getThreadCodexParams, patchThreadCodexParams, version]
  );
}

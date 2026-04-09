import type {
  AgentTaskAutoDriveState,
  HugeCodeMissionControlSnapshot,
} from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoDriveConfidence,
  AutoDriveControllerHookDraft,
  AutoDriveRiskPolicy,
  AutoDriveRoutePreference,
} from "../../../application/runtime/types/autoDrive";
import type { RuntimeAgentControl } from "../../../application/runtime/types/webMcpBridge";
import { buildAgentTaskLaunchControls } from "../../../application/runtime/facades/runtimeMissionDraftFacade";
import { launchAutoDriveThread } from "../../../application/runtime/facades/runtimeAutoDriveThreadLaunch";
import type { AccessMode, WorkspaceInfo } from "../../../types";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import type { ThreadCodexParamsPatch } from "../../threads/hooks/useThreadCodexParams";
import {
  mapDraftToRuntimeAutoDriveState,
  type AutoDriveRuntimeRunRecord,
  selectAutoDriveSnapshot,
} from "./autoDriveRuntimeSnapshotAdapter";
import {
  appendActivityEntries,
  buildRunActivityEntries,
  type AutoDriveActivityEntry,
} from "./autoDriveActivityModel";
import {
  AUTO_DRIVE_PRESETS,
  DEFAULT_CONTINUATION_POLICY,
  DEFAULT_DRAFT,
  normalizeBudgetDraftValue,
  normalizeDraft,
  resolveActivePresetKey,
  sanitizeBudgetValue,
  type AutoDrivePresetKey,
} from "./autoDriveDraftState";
import { buildLaunchReadiness } from "./autoDriveLaunchReadiness";
import {
  buildAutoDriveInstruction,
  buildNightOperatorAutonomyRequest,
  canStartAutoDriveRun,
  normalizeReasonEffort,
  type AutoDriveBusyAction,
} from "./autoDriveRuntimeConfig";

type RuntimeAutoDriveControl = Pick<RuntimeAgentControl, "startTask" | "interveneTask">;

type UseAutoDriveControllerOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  accessMode: AccessMode;
  selectedModelId: string | null;
  selectedEffort: string | null;
  preferredBackendIds?: string[] | null;
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  runtimeControl: RuntimeAutoDriveControl | null;
  onRefreshMissionControl?: (() => Promise<void> | void) | null;
  threadCodexParamsVersion: number;
  getThreadCodexParams: (
    workspaceId: string,
    threadId: string
  ) => {
    autoDriveDraft?: AutoDriveControllerHookDraft | null;
  } | null;
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadCodexParamsPatch
  ) => void;
  runtimeOverrides?: {
    now?: () => number;
    missionControlProjection?: HugeCodeMissionControlSnapshot | null;
    runtimeControl?: RuntimeAutoDriveControl | null;
    launchTaskThroughRuntimeControl?: boolean;
  };
};

export function useAutoDriveController({
  activeWorkspace,
  activeThreadId,
  accessMode,
  selectedModelId,
  selectedEffort,
  preferredBackendIds,
  missionControlProjection,
  runtimeControl,
  onRefreshMissionControl,
  threadCodexParamsVersion,
  getThreadCodexParams,
  patchThreadCodexParams,
  runtimeOverrides,
}: UseAutoDriveControllerOptions) {
  const now = useMemo(() => runtimeOverrides?.now ?? Date.now, [runtimeOverrides?.now]);
  const runtimeProjection = runtimeOverrides?.missionControlProjection ?? missionControlProjection;
  const runtimeControlSource = runtimeOverrides?.runtimeControl ?? runtimeControl;
  const launchTaskThroughRuntimeControl =
    runtimeOverrides?.launchTaskThroughRuntimeControl === true;
  const [draft, setDraft] = useState<AutoDriveControllerHookDraft>(DEFAULT_DRAFT);
  const [busyAction, setBusyAction] = useState<AutoDriveBusyAction | null>(null);
  const [activity, setActivity] = useState<AutoDriveActivityEntry[]>([]);
  const previousRunRef = useRef<AutoDriveRuntimeRunRecord | null>(null);

  const appendActivity = useCallback(
    (nextEntries: AutoDriveActivityEntry | AutoDriveActivityEntry[] | null | undefined) => {
      if (!nextEntries) {
        return;
      }
      const entries = Array.isArray(nextEntries) ? nextEntries : [nextEntries];
      if (entries.length === 0) {
        return;
      }
      setActivity((current) => appendActivityEntries(current, entries));
    },
    []
  );

  const persistDraft = useCallback(
    (next: AutoDriveControllerHookDraft) => {
      if (!activeWorkspace?.id || !activeThreadId) {
        return;
      }
      patchThreadCodexParams(activeWorkspace.id, activeThreadId, { autoDriveDraft: next });
    },
    [activeThreadId, activeWorkspace?.id, patchThreadCodexParams]
  );

  const updateDraft = useCallback(
    (updater: (current: AutoDriveControllerHookDraft) => AutoDriveControllerHookDraft) => {
      setDraft((current) => {
        const next = updater(current);
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  useEffect(() => {
    if (!activeWorkspace?.id || !activeThreadId) {
      setDraft(DEFAULT_DRAFT);
      setActivity([]);
      previousRunRef.current = null;
      return;
    }
    void threadCodexParamsVersion;
    const stored = getThreadCodexParams(activeWorkspace.id, activeThreadId)?.autoDriveDraft ?? null;
    setDraft(normalizeDraft(stored));
  }, [activeThreadId, activeWorkspace?.id, getThreadCodexParams, threadCodexParamsVersion]);

  const snapshot = useMemo(
    () =>
      selectAutoDriveSnapshot({
        missionControlProjection: runtimeProjection,
        workspaceId: activeWorkspace?.id ?? null,
        threadId: activeThreadId,
      }),
    [activeThreadId, activeWorkspace?.id, runtimeProjection]
  );

  const run = snapshot.adaptedRun;

  useEffect(() => {
    if (!run) {
      previousRunRef.current = null;
      return;
    }
    const entries = buildRunActivityEntries({
      previousRun: previousRunRef.current,
      nextRun: run,
      now: now(),
    });
    previousRunRef.current = run;
    if (entries.length > 0) {
      setActivity((current) => appendActivityEntries(current, entries));
    }
  }, [now, run]);

  useEffect(() => {
    if (!busyAction) {
      return;
    }
    const status = run?.status ?? null;
    if (!status) {
      return;
    }
    if (
      (busyAction === "starting" && (status === "running" || status === "review_ready")) ||
      (busyAction === "pausing" && (status === "paused" || status === "review_ready")) ||
      (busyAction === "resuming" && (status === "running" || status === "review_ready")) ||
      (busyAction === "stopping" && (status === "cancelled" || status === "review_ready"))
    ) {
      setBusyAction(null);
    }
  }, [busyAction, run?.status]);

  const readiness = useMemo(
    () =>
      buildLaunchReadiness({
        draft,
        hasWorkspace: Boolean(activeWorkspace?.id),
        source: snapshot.source,
      }),
    [activeWorkspace?.id, draft, snapshot.source]
  );
  const activePreset = useMemo(() => resolveActivePresetKey(draft), [draft]);

  const supportsIntervention = typeof runtimeControlSource?.interveneTask === "function";
  const runtimeOnlyControlsEnabled = snapshot.source === "runtime_snapshot_v1";

  const handleStart = useCallback(async () => {
    if (!activeWorkspace?.id || !activeThreadId || !runtimeOnlyControlsEnabled) {
      return;
    }
    if (!readiness.readyToLaunch || !draft.enabled) {
      return;
    }
    const launchControls = buildAgentTaskLaunchControls({
      objective: draft.destination.title.trim() || "AutoDrive mission",
      accessMode,
      preferredBackendIds: preferredBackendIds ?? null,
      autoDriveDraft: draft,
    });

    const autoDrivePayload: AgentTaskAutoDriveState = mapDraftToRuntimeAutoDriveState({
      ...draft,
      budget: {
        maxTokens: sanitizeBudgetValue("maxTokens", draft.budget.maxTokens),
        maxIterations: sanitizeBudgetValue("maxIterations", draft.budget.maxIterations),
        maxDurationMinutes: sanitizeBudgetValue(
          "maxDurationMinutes",
          draft.budget.maxDurationMinutes
        ),
        maxFilesPerIteration: sanitizeBudgetValue(
          "maxFilesPerIteration",
          draft.budget.maxFilesPerIteration
        ),
        maxNoProgressIterations: sanitizeBudgetValue(
          "maxNoProgressIterations",
          draft.budget.maxNoProgressIterations
        ),
        maxValidationFailures: sanitizeBudgetValue(
          "maxValidationFailures",
          draft.budget.maxValidationFailures
        ),
        maxReroutes: sanitizeBudgetValue("maxReroutes", draft.budget.maxReroutes),
      },
    });
    autoDrivePayload.contextPolicy = {
      scope: "workspace_graph",
      authoritySources: ["repo_authority", "workspace_graph"],
    };
    autoDrivePayload.decisionPolicy = {
      independentThread: true,
      autonomyPriority: "operator",
      promptStrategy: "workspace_graph_first",
      researchMode: draft.riskPolicy.allowNetworkAnalysis ? "live_when_allowed" : "repository_only",
    };
    autoDrivePayload.continuationPolicy = {
      enabled: draft.continuation?.enabled ?? DEFAULT_CONTINUATION_POLICY.enabled,
      maxAutomaticFollowUps:
        draft.continuation?.maxAutomaticFollowUps ??
        DEFAULT_CONTINUATION_POLICY.maxAutomaticFollowUps,
      requireValidationSuccessToStop:
        draft.continuation?.requireValidationSuccessToStop ??
        DEFAULT_CONTINUATION_POLICY.requireValidationSuccessToStop,
      minimumConfidenceToStop:
        draft.continuation?.minimumConfidenceToStop ??
        DEFAULT_CONTINUATION_POLICY.minimumConfidenceToStop,
    };
    const autonomyRequest = buildNightOperatorAutonomyRequest(draft);
    const launchInstruction = buildAutoDriveInstruction(draft, launchControls);

    setBusyAction("starting");
    appendActivity({
      id: `control:start:${now()}`,
      kind: "control",
      title: "Start requested",
      detail: `Dispatching an AutoDrive route through the active thread toward ${draft.destination.title.trim() || "the destination"}.`,
      iteration: run?.iteration ?? 0,
      timestamp: now(),
    });

    try {
      void trackProductAnalyticsEvent("delegate_started", {
        workspaceId: activeWorkspace.id,
        threadId: activeThreadId,
        executionProfileId: snapshot.run?.executionProfile?.id ?? null,
        backendId: preferredBackendIds?.[0] ?? null,
        runState: run?.status ?? null,
        requestMode: "start",
        eventSource: "auto_drive",
      });
      if (launchTaskThroughRuntimeControl && runtimeControlSource?.startTask) {
        await runtimeControlSource.startTask({
          workspaceId: activeWorkspace.id,
          threadId: activeThreadId,
          title: draft.destination.title.trim() || "AutoDrive mission",
          instruction: launchInstruction,
          accessMode,
          executionMode: "distributed",
          reasonEffort: normalizeReasonEffort(selectedEffort),
          modelId: selectedModelId,
          preferredBackendIds: preferredBackendIds ?? undefined,
          autoDrive: autoDrivePayload,
        });
      } else {
        await launchAutoDriveThread({
          workspaceId: activeWorkspace.id,
          threadId: activeThreadId,
          instruction: launchInstruction,
          accessMode,
          modelId: selectedModelId,
          reasonEffort: normalizeReasonEffort(selectedEffort),
          preferredBackendIds: preferredBackendIds ?? null,
          autoDrive: autoDrivePayload,
          autonomyRequest,
        });
      }
      await onRefreshMissionControl?.();
    } finally {
      setBusyAction(null);
    }
  }, [
    accessMode,
    activeThreadId,
    activeWorkspace?.id,
    appendActivity,
    draft,
    now,
    onRefreshMissionControl,
    preferredBackendIds,
    readiness.readyToLaunch,
    run?.iteration,
    runtimeControlSource,
    launchTaskThroughRuntimeControl,
    runtimeOnlyControlsEnabled,
    selectedEffort,
    selectedModelId,
  ]);

  const runTaskId = snapshot.runtimeTaskId;

  const handleIntervene = useCallback(
    async (action: "pause" | "resume" | "cancel", busy: AutoDriveBusyAction, detail: string) => {
      if (!runTaskId || !runtimeOnlyControlsEnabled || !supportsIntervention) {
        return;
      }
      setBusyAction(busy);
      appendActivity({
        id: `control:${action}:${now()}`,
        kind: "control",
        title: `${action.charAt(0).toUpperCase()}${action.slice(1)} requested`,
        detail,
        iteration: run?.iteration ?? null,
        timestamp: now(),
      });
      try {
        void trackProductAnalyticsEvent("manual_rescue_invoked", {
          workspaceId: activeWorkspace?.id ?? null,
          threadId: activeThreadId,
          runId: runTaskId,
          interventionKind: action,
          runState: run?.status ?? null,
          eventSource: "auto_drive",
        });
        await runtimeControlSource.interveneTask?.({
          taskId: runTaskId,
          action,
          reason: `auto_drive_${action}`,
        });
        await onRefreshMissionControl?.();
      } finally {
        setBusyAction(null);
      }
    },
    [
      appendActivity,
      now,
      onRefreshMissionControl,
      run?.iteration,
      runTaskId,
      runtimeControlSource,
      runtimeOnlyControlsEnabled,
      supportsIntervention,
    ]
  );

  const handlePause = useCallback(
    async () =>
      handleIntervene(
        "pause",
        "pausing",
        "Operator asked AutoDrive to yield control after the active waypoint handoff."
      ),
    [handleIntervene]
  );

  const handleResume = useCallback(
    async () =>
      handleIntervene(
        "resume",
        "resuming",
        "Operator asked AutoDrive to continue from the current route state."
      ),
    [handleIntervene]
  );

  const handleStop = useCallback(
    async () =>
      handleIntervene(
        "cancel",
        "stopping",
        "Operator asked AutoDrive to cancel the active route safely."
      ),
    [handleIntervene]
  );

  return {
    enabled: draft.enabled,
    draft,
    activity,
    recovering: snapshot.recovering,
    recoverySummary: snapshot.recoverySummary,
    run,
    setEnabled: (enabled: boolean) =>
      updateDraft((current) => ({
        ...current,
        enabled,
      })),
    setDestinationValue: (
      key: keyof AutoDriveControllerHookDraft["destination"],
      value: string | AutoDriveRoutePreference
    ) =>
      updateDraft((current) => ({
        ...current,
        destination: {
          ...current.destination,
          [key]: value,
        },
      })),
    setBudgetValue: (key: keyof AutoDriveControllerHookDraft["budget"], value: number) =>
      updateDraft((current) => ({
        ...current,
        budget: {
          ...current.budget,
          [key]: normalizeBudgetDraftValue(current.budget[key], value),
        },
      })),
    setRiskPolicyValue: (key: keyof AutoDriveRiskPolicy, value: boolean | AutoDriveConfidence) =>
      updateDraft((current) => ({
        ...current,
        riskPolicy: {
          ...current.riskPolicy,
          [key]: value,
        },
      })),
    preset: {
      active: activePreset,
      apply: (key: AutoDrivePresetKey) =>
        updateDraft((current) => {
          const preset = AUTO_DRIVE_PRESETS[key];
          return {
            ...current,
            destination: {
              ...current.destination,
              routePreference: preset.routePreference,
            },
            budget: preset.budget,
            riskPolicy: preset.riskPolicy,
          };
        }),
    },
    controls: {
      canStart: canStartAutoDriveRun({
        enabled: draft.enabled,
        hasWorkspace: Boolean(activeWorkspace?.id),
        hasThread: Boolean(activeThreadId),
        readyToLaunch: readiness.readyToLaunch,
        source: snapshot.source,
        runStatus: run?.status ?? null,
        busyAction,
      }),
      canPause:
        runtimeOnlyControlsEnabled &&
        supportsIntervention &&
        run?.status === "running" &&
        busyAction === null,
      canResume:
        runtimeOnlyControlsEnabled &&
        supportsIntervention &&
        run?.status === "paused" &&
        busyAction === null,
      canStop:
        runtimeOnlyControlsEnabled &&
        supportsIntervention &&
        (run?.status === "running" || run?.status === "paused") &&
        busyAction === null,
      busyAction,
      onStart: handleStart,
      onPause: handlePause,
      onResume: handleResume,
      onStop: handleStop,
    },
    readiness: {
      ...readiness,
      warnings: readiness.warnings,
    },
  };
}

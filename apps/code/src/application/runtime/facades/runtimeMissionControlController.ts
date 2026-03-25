import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceRuntimeAgentControl } from "../ports/runtimeAgentControl";
import { startRuntimeRunV2 } from "../ports/tauriRuntimeJobs";
import { readRuntimeErrorCode, readRuntimeErrorMessage } from "../ports/runtimeErrorClassifier";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { listRunExecutionProfiles } from "./runtimeMissionControlFacade";
import {
  buildRuntimeMissionLaunchPrepareRequest,
  useRuntimeMissionLaunchPreview,
} from "./runtimeMissionLaunchPreparation";
import { buildWorkspaceRuntimeMissionControlProjection } from "./runtimeWorkspaceMissionControlProjection";
import { useRuntimeWorkspaceLaunchDefaults } from "./runtimeWorkspaceLaunchDefaultsFacade";
import {
  collectInterruptibleRuntimeTasks,
  summarizeResumeBatchResults,
  type RuntimeResumeBatchOutcome,
} from "./runtimeMissionControlActions";
import { useRuntimeMissionControlDraftState } from "./runtimeMissionControlDraftState";
import {
  formatRuntimeError,
  resolveRuntimeErrorLabel,
  useRuntimeMissionControlSnapshot,
  type RuntimeDurabilityWarningState,
} from "./runtimeMissionControlSnapshot";

export type { RuntimeDurabilityWarningState };

export function useWorkspaceRuntimeMissionControlController(workspaceId: string) {
  const runtimeControl = useWorkspaceRuntimeAgentControl(workspaceId);
  const executionProfiles = useMemo(() => [...listRunExecutionProfiles()], []);
  const [pollSeconds, setPollSeconds] = useState(15);
  const [runtimeStatusFilter, setRuntimeStatusFilter] = useState<
    RuntimeAgentTaskSummary["status"] | "all"
  >("all");
  const [runtimeActionLoading, setRuntimeActionLoading] = useState(false);
  const [runtimeActionError, setRuntimeActionError] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<string | null>(null);
  const [repositoryExecutionProfileId, setRepositoryExecutionProfileId] = useState<string | null>(
    null
  );
  const [normalizedProviderRoute, setNormalizedProviderRoute] = useState<string | null>(null);

  const draft = useRuntimeMissionControlDraftState({
    workspaceId,
    executionProfiles,
    repositoryExecutionProfileId,
    normalizedProviderRoute,
  });

  const {
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryLaunchDefaults,
  } = useRuntimeWorkspaceLaunchDefaults({
    workspaceId,
    draftTitle: draft.runtimeDraftTitle,
    draftInstruction: draft.runtimeDraftInstruction,
  });

  const snapshot = useRuntimeMissionControlSnapshot({
    workspaceId,
    runtimeControl,
    pollSeconds,
  });

  const missionControlProjection = useMemo(
    () =>
      buildWorkspaceRuntimeMissionControlProjection({
        workspaceId,
        runtimeTasks: snapshot.runtimeTasks,
        runtimeProviders: snapshot.runtimeProviders,
        runtimeAccounts: snapshot.runtimeAccounts,
        runtimePools: snapshot.runtimePools,
        runtimeCapabilities: snapshot.runtimeCapabilities,
        runtimeHealth: snapshot.runtimeHealth,
        runtimeHealthError: snapshot.runtimeHealthError,
        runtimeToolMetrics: snapshot.runtimeToolMetrics,
        runtimeToolGuardrails: snapshot.runtimeToolGuardrails,
        selectedProviderRoute: draft.runtimeDraftProviderRoute,
        runtimeStatusFilter,
        runtimeDurabilityWarning: snapshot.runtimeDurabilityWarning,
      }),
    [
      draft.runtimeDraftProviderRoute,
      runtimeStatusFilter,
      snapshot.runtimeAccounts,
      snapshot.runtimeCapabilities,
      snapshot.runtimeDurabilityWarning,
      snapshot.runtimeHealth,
      snapshot.runtimeHealthError,
      snapshot.runtimePools,
      snapshot.runtimeProviders,
      snapshot.runtimeTasks,
      snapshot.runtimeToolGuardrails,
      snapshot.runtimeToolMetrics,
      workspaceId,
    ]
  );

  useEffect(() => {
    setRepositoryExecutionProfileId(repositoryLaunchDefaults.executionProfileId ?? null);
  }, [repositoryLaunchDefaults.executionProfileId]);

  useEffect(() => {
    setNormalizedProviderRoute(missionControlProjection.routeSelection.normalizedValue);
  }, [missionControlProjection.routeSelection.normalizedValue]);

  const selectedExecutionProfile = draft.selectedExecutionProfile;
  const selectedProviderRoute = missionControlProjection.routeSelection.selected;
  const providerRouteOptions = missionControlProjection.routeSelection.options;
  const routedProvider =
    draft.runtimeDraftProviderRoute === "auto" ? null : draft.runtimeDraftProviderRoute;
  const runtimeLaunchPreview = useRuntimeMissionLaunchPreview({
    workspaceId,
    draftTitle: draft.runtimeDraftTitle,
    draftInstruction: draft.runtimeDraftInstruction,
    selectedExecutionProfile,
    repositoryLaunchDefaults,
    runtimeSourceDraft: draft.runtimeSourceDraft,
    routedProvider,
  });

  const setRuntimeError = useCallback((value: string | null) => {
    setRuntimeActionError(value);
  }, []);

  const startRuntimeManagedTask = useCallback(async () => {
    if (draft.runtimeDraftInstruction.trim().length === 0) {
      return;
    }
    const launchRequest =
      runtimeLaunchPreview.request ??
      buildRuntimeMissionLaunchPrepareRequest({
        workspaceId,
        draftTitle: draft.runtimeDraftTitle,
        draftInstruction: draft.runtimeDraftInstruction,
        selectedExecutionProfile,
        repositoryLaunchDefaults,
        runtimeSourceDraft: draft.runtimeSourceDraft,
        routedProvider,
      });
    if (!launchRequest) {
      return;
    }
    setRuntimeActionLoading(true);
    try {
      await startRuntimeRunV2(launchRequest);
      draft.resetRuntimeDraftState();
      setRuntimeError(null);
      setRuntimeInfo(
        `Mission run started with ${selectedExecutionProfile.name}${routedProvider ? ` via ${selectedProviderRoute?.label ?? routedProvider}` : ""}.`
      );
      await snapshot.refreshRuntimeTasks();
    } catch (error) {
      setRuntimeError(formatRuntimeError(error));
    } finally {
      setRuntimeActionLoading(false);
    }
  }, [
    draft,
    runtimeControl,
    selectedExecutionProfile,
    repositoryLaunchDefaults,
    selectedProviderRoute,
    snapshot,
    workspaceId,
    setRuntimeError,
    routedProvider,
    runtimeLaunchPreview.request,
  ]);

  const interruptRuntimeTaskById = useCallback(
    async (taskId: string, reason: string | null) => {
      setRuntimeActionLoading(true);
      try {
        await runtimeControl.interruptTask({ taskId, reason });
        setRuntimeError(null);
        setRuntimeInfo(`Run ${taskId} interruption submitted.`);
        await snapshot.refreshRuntimeTasks();
      } catch (error) {
        setRuntimeError(formatRuntimeError(error));
      } finally {
        setRuntimeActionLoading(false);
      }
    },
    [runtimeControl, setRuntimeError, snapshot]
  );

  const resumeRuntimeTaskById = useCallback(
    async (taskId: string) => {
      const resumeTask = runtimeControl.resumeTask;
      if (!resumeTask) {
        setRuntimeError("Runtime does not currently support resuming mission runs.");
        return;
      }
      setRuntimeActionLoading(true);
      try {
        const ack = await resumeTask({ taskId });
        await snapshot.refreshRuntimeTasks();
        if (ack.accepted) {
          const checkpointSuffix =
            typeof ack.checkpointId === "string" && ack.checkpointId.trim().length > 0
              ? ` (checkpoint ${ack.checkpointId})`
              : "";
          setRuntimeError(null);
          setRuntimeInfo(`Run ${taskId} resumed${checkpointSuffix}.`);
        } else {
          setRuntimeInfo(null);
          setRuntimeError(ack.message || `Run ${taskId} could not be resumed.`);
        }
      } catch (error) {
        setRuntimeError(formatRuntimeError(error));
      } finally {
        setRuntimeActionLoading(false);
      }
    },
    [runtimeControl, setRuntimeError, snapshot]
  );

  const decideRuntimeApproval = useCallback(
    async (approvalId: string, decision: "approved" | "rejected") => {
      setRuntimeActionLoading(true);
      try {
        await runtimeControl.submitTaskApprovalDecision({
          approvalId,
          decision,
          reason: `ui:webmcp-runtime-${decision}`,
        });
        setRuntimeError(null);
        setRuntimeInfo(`Input request ${approvalId} marked as ${decision}.`);
        await snapshot.refreshRuntimeTasks();
      } catch (error) {
        setRuntimeError(formatRuntimeError(error));
      } finally {
        setRuntimeActionLoading(false);
      }
    },
    [runtimeControl, setRuntimeError, snapshot]
  );

  const interruptAllActiveTasks = useCallback(async () => {
    const activeTasks = collectInterruptibleRuntimeTasks(snapshot.runtimeTasks);
    if (activeTasks.length === 0) {
      setRuntimeInfo("No active runs to interrupt.");
      return;
    }
    setRuntimeActionLoading(true);
    try {
      await Promise.all(
        activeTasks.map((task) =>
          runtimeControl.interruptTask({
            taskId: task.taskId,
            reason: "ui:webmcp-runtime-batch-interrupt",
          })
        )
      );
      await snapshot.refreshRuntimeTasks();
      setRuntimeError(null);
      setRuntimeInfo(`Interrupted ${activeTasks.length} active run(s).`);
    } catch (error) {
      setRuntimeError(formatRuntimeError(error));
    } finally {
      setRuntimeActionLoading(false);
    }
  }, [runtimeControl, setRuntimeError, snapshot]);

  const resumeRecoverableTasks = useCallback(async () => {
    if (missionControlProjection.continuity.resumeReadyTasks.length === 0) {
      const nonResumeItem = missionControlProjection.continuity.summary.items.find(
        (item) => item.pathKind !== "resume"
      );
      setRuntimeInfo(
        nonResumeItem?.recommendedAction ?? "No resume-ready runs found in continuity readiness."
      );
      return;
    }
    const resumeTask = runtimeControl.resumeTask;
    if (!resumeTask) {
      setRuntimeError("Runtime does not currently support resuming mission runs.");
      return;
    }
    setRuntimeActionLoading(true);
    try {
      const responses = await Promise.allSettled(
        missionControlProjection.continuity.resumeReadyTasks.map((task) =>
          resumeTask({ taskId: task.taskId })
        )
      );
      const outcomes: RuntimeResumeBatchOutcome[] = responses.map((entry) => {
        if (entry.status === "fulfilled") {
          if (entry.value.accepted) {
            return { status: "accepted" };
          }
          return {
            status: "rejected",
            errorLabel: resolveRuntimeErrorLabel(entry.value),
          };
        }
        const failureCode = readRuntimeErrorCode(entry.reason);
        const failureMessage = readRuntimeErrorMessage(entry.reason);
        return {
          status: "failed",
          errorLabel:
            failureCode ??
            failureMessage ??
            (typeof entry.reason === "string" && entry.reason.trim().length > 0
              ? entry.reason.trim()
              : null),
        };
      });
      const summary = summarizeResumeBatchResults(outcomes);
      await snapshot.refreshRuntimeTasks();
      setRuntimeInfo(summary.info);
      setRuntimeError(summary.error);
    } catch (error) {
      setRuntimeError(formatRuntimeError(error));
    } finally {
      setRuntimeActionLoading(false);
    }
  }, [missionControlProjection.continuity, runtimeControl, setRuntimeError, snapshot]);

  const interruptStalePendingApprovals = useCallback(async () => {
    if (missionControlProjection.approvalPressure.staleTasks.length === 0) {
      setRuntimeInfo("No stale pending approvals to interrupt.");
      return;
    }
    setRuntimeActionLoading(true);
    try {
      await Promise.all(
        missionControlProjection.approvalPressure.staleTasks.map((task) =>
          runtimeControl.interruptTask({
            taskId: task.taskId,
            reason: "ui:webmcp-runtime-stale-approval-interrupt",
          })
        )
      );
      await snapshot.refreshRuntimeTasks();
      setRuntimeError(null);
      setRuntimeInfo(
        `Interrupted ${missionControlProjection.approvalPressure.staleTasks.length} stale pending approval task(s).`
      );
    } catch (error) {
      setRuntimeError(formatRuntimeError(error));
    } finally {
      setRuntimeActionLoading(false);
    }
  }, [
    missionControlProjection.approvalPressure.staleTasks,
    runtimeControl,
    setRuntimeError,
    snapshot,
  ]);

  const prepareRunLauncher = useCallback(
    (
      task: RuntimeAgentTaskSummary,
      intent: Parameters<typeof draft.prepareRunLauncher>[0]["intent"],
      options: { profileId?: string | null } = {}
    ) => {
      const result = draft.prepareRunLauncher({
        task,
        intent,
        executionProfileId:
          options.profileId?.trim() ||
          missionControlProjection.runList.projectedRunsByTaskId.get(task.taskId)?.executionProfile
            ?.id,
        fallbackProfileId: "balanced-delegate",
        repositoryExecutionContract,
      });
      if (!result.ok) {
        setRuntimeError(result.error);
        return;
      }
      setRuntimeInfo(result.infoMessage);
      setRuntimeError(null);
    },
    [
      draft,
      missionControlProjection.runList.projectedRunsByTaskId,
      repositoryExecutionContract,
      setRuntimeError,
    ]
  );

  return {
    executionProfiles,
    missionControlProjection,
    pollSeconds,
    prepareRunLauncher,
    providerRouteOptions,
    refreshRuntimeTasks: snapshot.refreshRuntimeTasks,
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryLaunchDefaults,
    runtimeLaunchPreparation: runtimeLaunchPreview.preparation,
    runtimeLaunchPreparationContextTruth: runtimeLaunchPreview.contextTruth,
    runtimeLaunchPreparationGuidanceStack: runtimeLaunchPreview.guidanceStack,
    runtimeLaunchPreparationDelegationContract: runtimeLaunchPreview.delegationContract,
    runtimeLaunchPreparationError: runtimeLaunchPreview.error,
    runtimeLaunchPreparationLoading: runtimeLaunchPreview.loading,
    runtimeLaunchPreparationTruthSourceLabel: runtimeLaunchPreview.truthSourceLabel,
    resumeRecoverableTasks,
    runtimeDraftInstruction: draft.runtimeDraftInstruction,
    setRuntimeDraftInstruction: draft.setRuntimeDraftInstruction,
    runtimeDraftProfileId: draft.runtimeDraftProfileId,
    runtimeDraftProfileTouched: draft.runtimeDraftProfileTouched,
    selectRuntimeDraftProfile: draft.selectRuntimeDraftProfile,
    runtimeDraftProviderRoute: draft.runtimeDraftProviderRoute,
    setRuntimeDraftProviderRoute: draft.setRuntimeDraftProviderRoute,
    runtimeDraftTitle: draft.runtimeDraftTitle,
    setRuntimeDraftTitle: draft.setRuntimeDraftTitle,
    runtimeDurabilityWarning: snapshot.runtimeDurabilityWarning,
    runtimeError: runtimeActionError ?? snapshot.runtimeError,
    runtimeInfo,
    runtimeLoading: runtimeActionLoading || snapshot.runtimeLoading,
    runtimeSourceDraft: draft.runtimeSourceDraft,
    setPollSeconds,
    setRuntimeSourceDraft: draft.setRuntimeSourceDraft,
    selectedExecutionProfile,
    selectedProviderRoute,
    setRuntimeStatusFilter,
    startRuntimeManagedTask,
    runtimeStatusFilter,
    interruptAllActiveTasks,
    interruptRuntimeTaskById,
    interruptStalePendingApprovals,
    resumeRuntimeTaskById,
    decideRuntimeApproval,
  };
}

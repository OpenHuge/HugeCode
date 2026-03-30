import { useCallback, useEffect, useMemo, useState } from "react";
import type { RuntimeAgentTaskInterventionInput } from "../types/webMcpBridge";
import { readBrowserReadiness } from "../ports/browserCapability";
import { useWorkspaceRuntimeAgentControl } from "../ports/runtimeAgentControl";
import { readRuntimeErrorCode, readRuntimeErrorMessage } from "../ports/runtimeErrorClassifier";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { listRunExecutionProfiles } from "./runtimeMissionControlFacade";
import { startRuntimeRunWithRemoteSelection } from "./runtimeRemoteExecutionFacade";
import {
  buildRuntimeRunStartRequestFromPreparation,
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
import { useRuntimeBrowserAssessmentOperator } from "./runtimeBrowserAssessmentOperator";
import { buildRuntimeBrowserAssessmentPluginDescriptor } from "./runtimeBrowserAssessmentPlugin";
import { useRuntimeBrowserExtractionOperator } from "./runtimeBrowserExtractionOperator";

export type { RuntimeDurabilityWarningState };

function buildMissionInterventionInfoMessage(
  action: RuntimeAgentTaskInterventionInput["action"],
  taskId: string
) {
  switch (action) {
    case "replan_scope":
      return `Mission replan requested for ${taskId}.`;
    case "drop_feature":
      return `Feature drop requested for ${taskId}.`;
    case "insert_feature":
      return `Feature insertion requested for ${taskId}.`;
    case "change_validation_lane":
      return `Validation lane change requested for ${taskId}.`;
    case "change_backend_preference":
      return `Backend preference change requested for ${taskId}.`;
    case "mark_blocked_with_reason":
      return `Blocked state recorded for ${taskId}.`;
    default:
      return `Mission intervention ${action} submitted for ${taskId}.`;
  }
}

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
  const [approvedRuntimePlanVersion, setApprovedRuntimePlanVersion] = useState<string | null>(null);
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
  const browserReadiness = readBrowserReadiness();
  const browserAssessment = useRuntimeBrowserAssessmentOperator(workspaceId, browserReadiness);
  const browserExtraction = useRuntimeBrowserExtractionOperator(browserReadiness);
  const runtimePlugins = useMemo(() => {
    const browserAssessmentPlugin = buildRuntimeBrowserAssessmentPluginDescriptor({
      readiness: browserReadiness,
      result: browserAssessment.result,
    });
    if (!browserAssessmentPlugin) {
      return snapshot.runtimePlugins;
    }
    return [
      ...snapshot.runtimePlugins.filter((plugin) => plugin.id !== browserAssessmentPlugin.id),
      browserAssessmentPlugin,
    ];
  }, [browserAssessment.result, browserReadiness, snapshot.runtimePlugins]);
  const runtimePluginControlPlaneSurface = useMemo(
    () => ({
      plugins: runtimePlugins,
      pluginsError: snapshot.runtimePluginsError,
      profiles: snapshot.runtimeCompositionProfiles,
      activeProfileId: snapshot.runtimeCompositionActiveProfileId,
      activeProfile: snapshot.runtimeCompositionActiveProfile,
      resolution: snapshot.runtimeCompositionResolution,
      compositionError: snapshot.runtimeCompositionError,
      registryError: snapshot.runtimePluginRegistryError,
    }),
    [
      runtimePlugins,
      snapshot.runtimePluginsError,
      snapshot.runtimeCompositionProfiles,
      snapshot.runtimeCompositionActiveProfileId,
      snapshot.runtimeCompositionActiveProfile,
      snapshot.runtimeCompositionResolution,
      snapshot.runtimeCompositionError,
      snapshot.runtimePluginRegistryError,
    ]
  );

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
        runtimePolicy: snapshot.runtimePolicy,
        runtimePolicyError: snapshot.runtimePolicyError,
        browserReadiness,
        runtimePlugins,
        runtimePluginsError: snapshot.runtimePluginsError,
        runtimePluginsProjectionBacked: snapshot.runtimePluginsProjectionBacked,
        runtimePluginRegistryPackages: snapshot.runtimePluginRegistryPackages,
        runtimePluginRegistryError: snapshot.runtimePluginRegistryError,
        runtimeCompositionProfiles: snapshot.runtimeCompositionProfiles,
        runtimeCompositionActiveProfileId: snapshot.runtimeCompositionActiveProfileId,
        runtimeCompositionActiveProfile: snapshot.runtimeCompositionActiveProfile,
        runtimeCompositionResolution: snapshot.runtimeCompositionResolution,
        runtimeCompositionError: snapshot.runtimeCompositionError,
        selectedProviderRoute: draft.runtimeDraftProviderRoute,
        runtimeStatusFilter,
        runtimeDurabilityWarning: snapshot.runtimeDurabilityWarning,
      }),
    [
      browserReadiness,
      draft.runtimeDraftProviderRoute,
      runtimeStatusFilter,
      snapshot.runtimeAccounts,
      snapshot.runtimeCapabilities,
      snapshot.runtimeDurabilityWarning,
      snapshot.runtimeHealth,
      snapshot.runtimeHealthError,
      snapshot.runtimePolicy,
      snapshot.runtimePolicyError,
      snapshot.runtimePools,
      runtimePlugins,
      snapshot.runtimePluginsError,
      snapshot.runtimePluginsProjectionBacked,
      snapshot.runtimePluginRegistryPackages,
      snapshot.runtimePluginRegistryError,
      snapshot.runtimeCompositionProfiles,
      snapshot.runtimeCompositionActiveProfileId,
      snapshot.runtimeCompositionActiveProfile,
      snapshot.runtimeCompositionResolution,
      snapshot.runtimeCompositionError,
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
    preferredBackendIds: selectedProviderRoute?.preferredBackendIds ?? null,
    defaultBackendId: selectedProviderRoute?.resolvedBackendId ?? null,
  });
  const runtimeLaunchPlanVersion = runtimeLaunchPreview.preparation?.plan?.planVersion ?? null;
  const runtimeLaunchPlanApprovalRequired = runtimeLaunchPlanVersion !== null;
  const runtimeLaunchPlanApproved =
    runtimeLaunchPlanVersion !== null && approvedRuntimePlanVersion === runtimeLaunchPlanVersion;

  useEffect(() => {
    if (!runtimeLaunchPlanVersion) {
      setApprovedRuntimePlanVersion(null);
      return;
    }
    setApprovedRuntimePlanVersion((current) =>
      current === runtimeLaunchPlanVersion ? current : null
    );
  }, [runtimeLaunchPlanVersion]);

  const setRuntimeError = useCallback((value: string | null) => {
    setRuntimeActionError(value);
  }, []);

  const approveRuntimeLaunchPlan = useCallback(() => {
    if (!runtimeLaunchPlanVersion) {
      return;
    }
    setApprovedRuntimePlanVersion(runtimeLaunchPlanVersion);
    setRuntimeInfo(`Approved mission plan ${runtimeLaunchPlanVersion}.`);
    setRuntimeError(null);
  }, [runtimeLaunchPlanVersion, setRuntimeError]);

  const clearRuntimeLaunchPlanApproval = useCallback(() => {
    setApprovedRuntimePlanVersion(null);
  }, []);

  const startRuntimeManagedTask = useCallback(async () => {
    if (draft.runtimeDraftInstruction.trim().length === 0) {
      return;
    }
    if (!runtimeLaunchPreview.preparation || !runtimeLaunchPreview.request) {
      setRuntimeError("Review the runtime mission plan before starting the run.");
      return;
    }
    if (runtimeLaunchPlanApprovalRequired && !runtimeLaunchPlanApproved) {
      setRuntimeError("Approve the current mission plan before starting the run.");
      return;
    }
    const launchRequest =
      buildRuntimeRunStartRequestFromPreparation({
        request: runtimeLaunchPreview.request,
        preparation: runtimeLaunchPreview.preparation,
      }) ??
      buildRuntimeMissionLaunchPrepareRequest({
        workspaceId,
        draftTitle: draft.runtimeDraftTitle,
        draftInstruction: draft.runtimeDraftInstruction,
        selectedExecutionProfile,
        repositoryLaunchDefaults,
        runtimeSourceDraft: draft.runtimeSourceDraft,
        routedProvider,
        preferredBackendIds: selectedProviderRoute?.preferredBackendIds ?? null,
        defaultBackendId: selectedProviderRoute?.resolvedBackendId ?? null,
      });
    if (!launchRequest) {
      return;
    }
    setRuntimeActionLoading(true);
    try {
      await startRuntimeRunWithRemoteSelection(launchRequest);
      draft.resetRuntimeDraftState();
      setApprovedRuntimePlanVersion(null);
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
    runtimeLaunchPlanApprovalRequired,
    runtimeLaunchPlanApproved,
    runtimeLaunchPreview.preparation,
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

  const interveneRuntimeTaskById = useCallback(
    async (taskId: string, input: Omit<RuntimeAgentTaskInterventionInput, "taskId">) => {
      if (typeof runtimeControl.interveneTask !== "function") {
        setRuntimeError("Runtime does not currently support mission interventions.");
        return;
      }
      setRuntimeActionLoading(true);
      try {
        const result = await runtimeControl.interveneTask({
          taskId,
          ...input,
        });
        await snapshot.refreshRuntimeTasks();
        if (result.accepted) {
          setRuntimeError(null);
          setRuntimeInfo(buildMissionInterventionInfoMessage(input.action, taskId));
          return;
        }
        setRuntimeInfo(null);
        setRuntimeError(`Mission intervention ${input.action} was not accepted for ${taskId}.`);
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
    browserAssessment,
    browserExtraction,
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
    runtimeLaunchPreparationTriageSummary: runtimeLaunchPreview.triageSummary,
    runtimeLaunchPreparationDelegationContract: runtimeLaunchPreview.delegationContract,
    runtimeLaunchPreparationRepoGuidanceSummary: runtimeLaunchPreview.repoGuidanceSummary,
    runtimeLaunchPreparationError: runtimeLaunchPreview.error,
    runtimeLaunchPreparationLoading: runtimeLaunchPreview.loading,
    runtimeLaunchPlanApprovalRequired,
    runtimeLaunchPlanApproved,
    runtimeLaunchPlanVersion,
    approveRuntimeLaunchPlan,
    clearRuntimeLaunchPlanApproval,
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
    runtimePluginControlPlaneSurface,
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
    interveneRuntimeTaskById,
    decideRuntimeApproval,
  };
}

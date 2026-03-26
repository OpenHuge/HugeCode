import type { MainAppConversationBridgeParams } from "../../types/mainAppLayoutContracts";
import type {
  MainAppLayoutBridgeParams,
  MainAppLayoutConversationBridgeDomainInput,
} from "./types";

type ComposerAutoDriveView = NonNullable<MainAppLayoutBridgeParams["autoDrive"]>;
type ComposerPlacementView = NonNullable<MainAppLayoutBridgeParams["resolvedRemotePlacement"]>;

export function buildComposerAutoDriveView(params: {
  source: ComposerAutoDriveView["source"];
  autoDriveState: MainAppConversationBridgeParams["autoDriveState"];
}): MainAppLayoutBridgeParams["autoDrive"] | null {
  const { source, autoDriveState } = params;
  return {
    source,
    enabled: autoDriveState.enabled,
    destination: autoDriveState.draft.destination,
    budget: autoDriveState.draft.budget,
    riskPolicy: autoDriveState.draft.riskPolicy,
    preset: autoDriveState.preset,
    controls: autoDriveState.controls,
    recovering: autoDriveState.recovering,
    recoverySummary: autoDriveState.recoverySummary,
    activity: autoDriveState.activity,
    readiness: autoDriveState.readiness,
    run: autoDriveState.run
      ? {
          status: autoDriveState.run.status,
          stage: autoDriveState.run.stage,
          iteration: autoDriveState.run.iteration,
          consumedTokensEstimate: autoDriveState.run.totals.consumedTokensEstimate,
          maxTokens: autoDriveState.run.budget.maxTokens,
          maxIterations: autoDriveState.run.budget.maxIterations,
          startStateSummary: autoDriveState.run.navigation.startStateSummary,
          destinationSummary: autoDriveState.run.navigation.destinationSummary,
          routeSummary: autoDriveState.run.navigation.routeSummary,
          currentMilestone: autoDriveState.run.navigation.currentMilestone,
          currentWaypointTitle: autoDriveState.run.navigation.currentWaypointTitle,
          currentWaypointObjective: autoDriveState.run.navigation.currentWaypointObjective,
          currentWaypointArrivalCriteria:
            autoDriveState.run.navigation.currentWaypointArrivalCriteria,
          remainingMilestones: autoDriveState.run.navigation.remainingMilestones,
          offRoute: autoDriveState.run.navigation.offRoute,
          rerouting: autoDriveState.run.navigation.rerouting,
          rerouteReason: autoDriveState.run.navigation.rerouteReason,
          overallProgress: autoDriveState.run.navigation.overallProgress,
          waypointCompletion: autoDriveState.run.navigation.waypointCompletion,
          stopRisk: autoDriveState.run.navigation.stopRisk,
          arrivalConfidence: autoDriveState.run.navigation.arrivalConfidence,
          remainingTokens: autoDriveState.run.navigation.remainingTokens,
          remainingIterations: autoDriveState.run.navigation.remainingIterations,
          remainingDurationMs: autoDriveState.run.navigation.remainingDurationMs,
          remainingBlockers: autoDriveState.run.navigation.remainingBlockers,
          lastValidationSummary: autoDriveState.run.lastValidationSummary ?? null,
          stopReason: autoDriveState.run.lastStopReason?.detail ?? null,
          stopReasonCode: autoDriveState.run.lastStopReason?.code ?? null,
          lastDecision: autoDriveState.run.navigation.lastDecision,
          waypointStatus: autoDriveState.run.navigation.waypointStatus ?? null,
          runtimeScenarioProfile: autoDriveState.run.runtimeScenarioProfile ?? null,
          runtimeDecisionTrace: autoDriveState.run.runtimeDecisionTrace ?? null,
          runtimeOutcomeFeedback: autoDriveState.run.runtimeOutcomeFeedback ?? null,
          runtimeAutonomyState: autoDriveState.run.runtimeAutonomyState ?? null,
          latestReroute: autoDriveState.run.latestReroute
            ? {
                mode: autoDriveState.run.latestReroute.mode,
                reason: autoDriveState.run.latestReroute.reason,
                trigger: autoDriveState.run.latestReroute.trigger,
                previousRouteSummary: autoDriveState.run.latestReroute.previousRouteSummary,
                nextRouteSummary: autoDriveState.run.latestReroute.nextRouteSummary,
              }
            : null,
        }
      : null,
    onToggleEnabled: autoDriveState.setEnabled,
    onChangeDestination: autoDriveState.setDestinationValue,
    onChangeBudget: autoDriveState.setBudgetValue,
    onChangeRiskPolicy: autoDriveState.setRiskPolicyValue,
  };
}

export function buildComposerResolvedPlacementView(input: {
  workspaceId: string | null;
  projection: MainAppLayoutBridgeParams["missionControlProjection"];
}): MainAppLayoutBridgeParams["resolvedRemotePlacement"] | null {
  if (!input.workspaceId || !input.projection) {
    return null;
  }
  const latestRun = input.projection.runs
    .filter((run) => run.workspaceId === input.workspaceId && run.placement)
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const placement = latestRun?.placement ?? null;
  if (!placement) {
    return null;
  }
  const detailParts = [placement.rationale?.trim() || null];
  if (latestRun?.routing?.routeLabel?.trim()) {
    detailParts.push(`Route: ${latestRun.routing.routeLabel.trim()}`);
  }
  return {
    summary: placement.summary,
    detail: detailParts.filter((part): part is string => Boolean(part)).join(" · ") || null,
    tone: placement.healthSummary === "placement_ready" ? "neutral" : "warning",
  } satisfies ComposerPlacementView;
}

export function buildMainAppConversationAndComposerBridgeInput(
  input: MainAppLayoutConversationBridgeDomainInput
) {
  const {
    state: {
      threadsState,
      threadCodexState,
      autoDriveState,
      skills,
      prompts,
      composerInputRef,
      composerEditorSettings,
      composerEditorExpanded,
      activeWorkspace,
      conversationState: {
        homeState,
        fileListingState,
        processingState,
        composerState,
        canInsertComposerText,
        handleInsertComposerText,
      },
    },
    actions: { toggleComposerEditorExpanded },
  } = input;

  return {
    latestAgentRuns: homeState.latestAgentRuns,
    isLoadingLatestAgents: homeState.isLoadingLatestAgents,
    localUsageSnapshot: homeState.localUsageSnapshot,
    isLoadingLocalUsage: homeState.isLoadingLocalUsage,
    localUsageError: homeState.localUsageError,
    usageMetric: homeState.usageMetric,
    onUsageMetricChange: homeState.setUsageMetric,
    usageWorkspaceId: homeState.usageWorkspaceId,
    usageWorkspaceOptions: homeState.usageWorkspaceOptions,
    onUsageWorkspaceChange: homeState.setUsageWorkspaceId,
    activeRateLimits: homeState.activeRateLimits,
    onSendPrompt: async (text: string) => {
      await composerState.handleSendPrompt(text);
    },
    onStop: threadsState.interruptTurn,
    canStop: homeState.canInterrupt,
    onFileAutocompleteActiveChange: fileListingState.setFileAutocompleteActive,
    isReviewing: processingState.isReviewing,
    isProcessing: processingState.isProcessing,
    onReviewPromptClose: threadsState.closeReviewPrompt,
    onReviewPromptShowPreset: threadsState.showPresetStep,
    onReviewPromptChoosePreset: threadsState.choosePreset,
    onReviewPromptHighlightPreset: threadsState.setHighlightedPresetIndex,
    onReviewPromptHighlightBranch: threadsState.setHighlightedBranchIndex,
    onReviewPromptHighlightCommit: threadsState.setHighlightedCommitIndex,
    onReviewPromptKeyDown: threadsState.handleReviewPromptKeyDown,
    onReviewPromptSelectBranch: threadsState.selectBranch,
    onReviewPromptSelectBranchAtIndex: threadsState.selectBranchAtIndex,
    onReviewPromptConfirmBranch: threadsState.confirmBranch,
    onReviewPromptSelectCommit: threadsState.selectCommit,
    onReviewPromptSelectCommitAtIndex: threadsState.selectCommitAtIndex,
    onReviewPromptConfirmCommit: threadsState.confirmCommit,
    onReviewPromptUpdateCustomInstructions: threadsState.updateCustomInstructions,
    onReviewPromptConfirmCustom: threadsState.confirmCustom,
    activeTokenUsage: homeState.activeTokenUsage,
    activeQueue: composerState.activeQueue,
    queuePausedReason: processingState.queuePausedReason,
    draftText: composerState.activeDraft,
    onDraftChange: composerState.handleDraftChange,
    activeImages: composerState.activeImages,
    onPickImages: composerState.pickImages,
    onAttachImages: composerState.attachImages,
    onRemoveImage: composerState.removeImage,
    onEditQueued: composerState.handleEditQueued,
    onDeleteQueued: composerState.handleDeleteQueued,
    collaborationModes: threadCodexState.collaborationModes,
    selectedCollaborationModeId: threadCodexState.selectedCollaborationModeId,
    onSelectCollaborationMode: threadCodexState.handleSelectCollaborationMode,
    composerAccountOptions: threadCodexState.composerAccountOptions,
    selectedAccountIds: threadCodexState.selectedAccountIds,
    onSelectAccountIds: threadCodexState.handleSelectAccountIds,
    modelSelectionMode: threadCodexState.selectionMode,
    selectedProviderId: threadCodexState.selectedProviderId,
    onSelectProvider: threadCodexState.handleSelectProviderFamily,
    onSelectAutoRoute: threadCodexState.handleSelectAutoRoute,
    onSelectModelSelectionMode: threadCodexState.handleSelectModelSelectionMode,
    models: threadCodexState.models,
    selectedModelId: threadCodexState.selectedModelId,
    onSelectModel: threadCodexState.handleSelectModel,
    reasoningOptions: threadCodexState.reasoningOptions,
    selectedEffort: threadCodexState.selectedEffort,
    onSelectEffort: threadCodexState.handleSelectEffort,
    fastModeEnabled: threadCodexState.fastModeEnabled,
    onToggleFastMode: threadCodexState.handleToggleFastMode,
    reasoningSupported: threadCodexState.reasoningSupported,
    accessMode: threadCodexState.accessMode,
    onSelectAccessMode: threadCodexState.handleSelectAccessMode,
    executionOptions: threadCodexState.executionOptions,
    selectedExecutionMode: threadCodexState.executionMode,
    onSelectExecutionMode: threadCodexState.handleSelectExecutionMode,
    remoteBackendOptions: threadCodexState.remoteBackendOptions,
    selectedRemoteBackendId: threadCodexState.selectedRemoteBackendId,
    onSelectRemoteBackendId: threadCodexState.handleSelectRemoteBackendId,
    resolvedRemotePlacement: buildComposerResolvedPlacementView({
      workspaceId: activeWorkspace?.id ?? null,
      projection: homeState.missionControlProjection ?? null,
    }),
    autoDrive: buildComposerAutoDriveView({
      source: homeState.missionControlProjection?.source ?? null,
      autoDriveState,
    }),
    skills,
    prompts,
    files: fileListingState.files,
    onInsertComposerText: handleInsertComposerText,
    canInsertComposerText,
    textareaRef: composerInputRef,
    composerEditorSettings,
    composerEditorExpanded,
    onToggleComposerEditorExpanded: toggleComposerEditorExpanded,
    showComposer: homeState.showComposer,
    plan: homeState.activePlan,
  };
}

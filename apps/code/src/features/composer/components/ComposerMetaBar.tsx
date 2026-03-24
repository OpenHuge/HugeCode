import { CoreLoopMetaRail, type SelectOption } from "../../../design-system";
import { memo, useCallback, useMemo, useRef } from "react";
import type {
  AutoDriveChatgptDecisionLabResult,
  AutoDriveChatgptResearchRouteLabResult,
  AutoDriveResearchSource,
  AutoDriveRuntimeAutonomyState,
  AutoDriveRuntimeContinuationState,
  AutoDriveRuntimeDecisionTrace,
  AutoDriveRuntimeOutcomeFeedback,
  AutoDriveRuntimeResearchSession,
  AutoDriveRuntimeResearchTrace,
  AutoDriveRuntimeScenarioProfile,
  AutoDriveStopReason,
  AutoDriveWaypointStatus,
} from "../../../application/runtime/types/autoDrive";
import type { AccessMode, CollaborationModeOption, ComposerExecutionMode } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { ComposerMetaBarAutoDriveMeta } from "./ComposerMetaBarAutoDriveMeta";
import { resolveComposerCollaborationModes } from "../utils/collaborationModes";
import { ComposerMetaBarControls } from "./ComposerMetaBarControls";
import * as summaryStyles from "./ComposerMetaBarSummary.styles.css";

type ModelOption = {
  id: string;
  displayName: string;
  model: string;
  description?: string;
  provider?: string | null;
  pool?: string | null;
  source?: string | null;
  available?: boolean;
};

type ExecutionOption = {
  value: ComposerExecutionMode;
  label: string;
  disabled?: boolean;
};

type RemoteBackendOption = {
  value: string;
  label: string;
};

type AutoDrivePresetKey = "safe_default" | "tight_validation" | "fast_explore";

type ComposerMetaBarProps = {
  disabled: boolean;
  collaborationModes: CollaborationModeOption[];
  selectedCollaborationModeId: string | null;
  onSelectCollaborationMode: (id: string | null) => void;
  models: ModelOption[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  fastModeEnabled?: boolean;
  reasoningSupported: boolean;
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  executionOptions: ExecutionOption[];
  selectedExecutionMode: ComposerExecutionMode;
  onSelectExecutionMode: (mode: ComposerExecutionMode) => void;
  remoteBackendOptions?: RemoteBackendOption[];
  selectedRemoteBackendId?: string | null;
  onSelectRemoteBackendId?: (backendId: string | null) => void;
  autoDrive?: {
    source?: string | null;
    enabled: boolean;
    destination: {
      title: string;
      endState: string;
      doneDefinition: string;
      avoid: string;
      routePreference:
        | "stability_first"
        | "minimal_change"
        | "validation_first"
        | "docs_first"
        | "speed_first";
    };
    budget: {
      maxTokens: number;
      maxIterations: number;
      maxDurationMinutes: number;
      maxFilesPerIteration: number;
      maxNoProgressIterations: number;
      maxValidationFailures: number;
      maxReroutes: number;
    };
    riskPolicy: {
      pauseOnDestructiveChange: boolean;
      pauseOnDependencyChange: boolean;
      pauseOnLowConfidence: boolean;
      pauseOnHumanCheckpoint: boolean;
      allowNetworkAnalysis: boolean;
      allowValidationCommands: boolean;
      minimumConfidence: "low" | "medium" | "high";
    };
    preset: {
      active: AutoDrivePresetKey | "custom";
      apply: (key: AutoDrivePresetKey) => void;
    };
    controls: {
      canStart: boolean;
      canPause: boolean;
      canResume: boolean;
      canStop: boolean;
      busyAction: "starting" | "pausing" | "resuming" | "stopping" | null;
      onStart: () => void | Promise<void>;
      onPause: () => void | Promise<void>;
      onResume: () => void | Promise<void>;
      onStop: () => void | Promise<void>;
    };
    recovering: boolean;
    recoverySummary?: string | null;
    activity: Array<{
      id: string;
      kind: "control" | "status" | "stage" | "waypoint" | "reroute" | "stop";
      title: string;
      detail: string;
      iteration: number | null;
      timestamp: number;
    }>;
    readiness: {
      readyToLaunch: boolean;
      issues: string[];
      warnings: string[];
      checklist: Array<{
        label: string;
        complete: boolean;
      }>;
      setupProgress: number;
    };
    run?: {
      status:
        | "created"
        | "running"
        | "paused"
        | "review_ready"
        | "completed"
        | "cancelled"
        | "stopped"
        | "failed";
      stage: string;
      iteration: number;
      consumedTokensEstimate: number;
      maxTokens: number;
      maxIterations: number;
      startStateSummary: string | null;
      destinationSummary: string;
      routeSummary: string | null;
      currentMilestone: string | null;
      currentWaypointTitle: string | null;
      currentWaypointObjective: string | null;
      currentWaypointArrivalCriteria: string[];
      remainingMilestones: string[];
      offRoute: boolean;
      rerouting: boolean;
      rerouteReason: string | null;
      overallProgress: number;
      waypointCompletion: number;
      stopRisk: "low" | "medium" | "high";
      arrivalConfidence: "low" | "medium" | "high";
      remainingTokens: number | null;
      remainingIterations: number;
      remainingDurationMs: number | null;
      remainingBlockers: string[];
      lastValidationSummary: string | null;
      stopReason: string | null;
      stopReasonCode?: AutoDriveStopReason["code"] | null;
      lastDecision: string | null;
      waypointStatus?: AutoDriveWaypointStatus | null;
      runtimeScenarioProfile?: AutoDriveRuntimeScenarioProfile | null;
      runtimeDecisionTrace?: AutoDriveRuntimeDecisionTrace | null;
      runtimeOutcomeFeedback?: AutoDriveRuntimeOutcomeFeedback | null;
      runtimeAutonomyState?: AutoDriveRuntimeAutonomyState | null;
      runtimeContinuationState?: AutoDriveRuntimeContinuationState | null;
      lastChatgptDecisionLab?: AutoDriveChatgptDecisionLabResult | null;
      runtimeResearchSession?: AutoDriveRuntimeResearchSession | null;
      runtimeResearchTrace?: AutoDriveRuntimeResearchTrace | null;
      runtimeResearchSources?: AutoDriveResearchSource[];
      lastChatgptResearchRouteLab?: AutoDriveChatgptResearchRouteLabResult | null;
      latestReroute: {
        mode: "soft" | "hard";
        reason: string;
        trigger: string;
        previousRouteSummary: string | null;
        nextRouteSummary: string | null;
      } | null;
    } | null;
    onToggleEnabled: (enabled: boolean) => void;
    onChangeDestination: (
      key: "title" | "endState" | "doneDefinition" | "avoid" | "routePreference",
      value: string
    ) => void;
    onChangeBudget: (
      key:
        | "maxTokens"
        | "maxIterations"
        | "maxDurationMinutes"
        | "maxFilesPerIteration"
        | "maxNoProgressIterations"
        | "maxValidationFailures"
        | "maxReroutes",
      value: number
    ) => void;
    onChangeRiskPolicy: (
      key:
        | "pauseOnDestructiveChange"
        | "pauseOnDependencyChange"
        | "pauseOnLowConfidence"
        | "pauseOnHumanCheckpoint"
        | "allowNetworkAnalysis"
        | "allowValidationCommands"
        | "minimumConfidence",
      value: boolean | "low" | "medium" | "high"
    ) => void;
  } | null;
};

const DEFAULT_MODE_LABEL = "Chat";

function formatModeLabel(label: string | null | undefined): string {
  if (!label) {
    return DEFAULT_MODE_LABEL;
  }
  if (label.toLowerCase() === "default") {
    return DEFAULT_MODE_LABEL;
  }
  return label;
}

function formatModelQualifier(model: ModelOption): string | null {
  const candidates = [model.pool, model.provider, model.source, model.id];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const normalized = candidate.trim();
    if (normalized.length === 0) {
      continue;
    }
    return normalized;
  }
  return null;
}

export const ComposerMetaBar = memo(function ComposerMetaBar({
  disabled,
  collaborationModes,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  models,
  selectedModelId,
  onSelectModel,
  reasoningOptions,
  selectedEffort,
  onSelectEffort,
  fastModeEnabled = false,
  reasoningSupported,
  executionOptions,
  selectedExecutionMode,
  onSelectExecutionMode,
  remoteBackendOptions = [],
  selectedRemoteBackendId = null,
  onSelectRemoteBackendId,
  autoDrive = null,
}: ComposerMetaBarProps) {
  const duplicateModelKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const model of models) {
      const key = `${model.displayName || model.model}::${model.model}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [models]);
  const renderModelLabel = useCallback(
    (model: ModelOption) => {
      const base = model.displayName || model.model;
      const duplicateKey = `${base}::${model.model}`;
      const qualifier =
        (duplicateModelKeys.get(duplicateKey) ?? 0) > 1 ? formatModelQualifier(model) : null;
      const withQualifier = qualifier ? `${base} / ${qualifier}` : base;
      if (model.available === false) {
        return `${withQualifier} (unavailable)`;
      }
      return withQualifier;
    },
    [duplicateModelKeys]
  );
  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId]
  );
  const modelSelectOptions: SelectOption[] = useMemo(() => {
    const availableModels = models.filter((model) => model.available !== false);
    const visibleModels = availableModels.length > 0 ? availableModels : models;
    const modelOptions =
      selectedModel && !visibleModels.some((model) => model.id === selectedModel.id)
        ? [selectedModel, ...visibleModels]
        : visibleModels;
    return modelOptions.map((model) => ({
      value: model.id,
      label: renderModelLabel(model),
      disabled: model.available === false,
    }));
  }, [models, renderModelLabel, selectedModel]);
  const effortSelectOptions: SelectOption[] = useMemo(
    () =>
      reasoningOptions.map((effort) => ({
        value: effort,
        label: effort,
      })),
    [reasoningOptions]
  );
  const executionSelectOptions: SelectOption[] = useMemo(
    () =>
      executionOptions.map((entry) => ({
        value: entry.value,
        label: entry.label,
        disabled: entry.disabled,
      })),
    [executionOptions]
  );
  const remoteBackendSelectOptions: SelectOption[] = useMemo(
    () =>
      remoteBackendOptions.map((entry) => ({
        value: entry.value,
        label: entry.label,
      })),
    [remoteBackendOptions]
  );
  const { activeModeId, chatMode, planMode } = useMemo(
    () => resolveComposerCollaborationModes(collaborationModes, selectedCollaborationModeId),
    [collaborationModes, selectedCollaborationModeId]
  );
  const chatModeId = chatMode?.id ?? null;

  const metaControlsRef = useRef<HTMLDivElement | null>(null);
  const selectedExecutionLabel = useMemo(() => {
    const selectedExecution = executionOptions.find(
      (entry) => entry.value === selectedExecutionMode
    );
    return selectedExecution?.label ?? selectedExecutionMode;
  }, [executionOptions, selectedExecutionMode]);
  const shouldShowExecutionControl =
    executionSelectOptions.length > 1 ||
    selectedExecutionMode !== "runtime" ||
    selectedExecutionLabel !== "Runtime";
  const shouldShowRemoteBackendControl =
    remoteBackendSelectOptions.length > 0 ||
    (typeof selectedRemoteBackendId === "string" && selectedRemoteBackendId.trim().length > 0);
  const selectedRemoteBackendLabel = useMemo(() => {
    const normalizedSelectedBackendId = selectedRemoteBackendId?.trim() || null;
    if (!normalizedSelectedBackendId) {
      return "Automatic runtime routing";
    }
    return (
      remoteBackendOptions.find((entry) => entry.value === normalizedSelectedBackendId)?.label ??
      normalizedSelectedBackendId
    );
  }, [remoteBackendOptions, selectedRemoteBackendId]);
  const isPlanActive = Boolean(planMode && activeModeId === planMode.id);
  const planModeLabel = formatModeLabel(planMode?.label ?? "Plan");
  const autoDriveControlsDisabled = disabled;

  const handleChatModeSelect = useCallback(() => {
    if (disabled || !isPlanActive) {
      return;
    }
    onSelectCollaborationMode(chatModeId);
  }, [chatModeId, disabled, isPlanActive, onSelectCollaborationMode]);

  const handlePlanModeSelect = useCallback(() => {
    if (disabled || isPlanActive || !planMode?.id) {
      return;
    }
    onSelectCollaborationMode(planMode.id);
  }, [disabled, isPlanActive, onSelectCollaborationMode, planMode]);

  return (
    <div className="composer-bar">
      <div className={joinClassNames(summaryStyles.metaShell, "composer-meta-shell")}>
        <CoreLoopMetaRail
          className={joinClassNames(summaryStyles.metaControls, "composer-meta")}
          data-core-loop-surface="composer-meta"
        >
          <ComposerMetaBarControls
            controlsRef={metaControlsRef}
            disabled={disabled}
            modelSelectOptions={modelSelectOptions}
            selectedModelId={selectedModelId}
            onSelectModel={onSelectModel}
            effortSelectOptions={effortSelectOptions}
            selectedEffort={selectedEffort}
            onSelectEffort={onSelectEffort}
            fastModeEnabled={fastModeEnabled}
            reasoningSupported={reasoningSupported}
            shouldShowExecutionControl={shouldShowExecutionControl}
            executionSelectOptions={executionSelectOptions}
            selectedExecutionMode={selectedExecutionMode}
            onSelectExecutionMode={onSelectExecutionMode}
            shouldShowRemoteBackendControl={shouldShowRemoteBackendControl}
            remoteBackendSelectOptions={remoteBackendSelectOptions}
            selectedRemoteBackendId={selectedRemoteBackendId}
            onSelectRemoteBackendId={onSelectRemoteBackendId}
            isPlanActive={isPlanActive}
            planModeLabel={planModeLabel}
            planModeAvailable={Boolean(planMode)}
            onSelectChatMode={handleChatModeSelect}
            onSelectPlanMode={handlePlanModeSelect}
          />
          {autoDrive ? (
            <ComposerMetaBarAutoDriveMeta
              autoDrive={autoDrive}
              disabled={autoDriveControlsDisabled}
            />
          ) : null}
          {shouldShowRemoteBackendControl ? (
            <div
              className={joinClassNames(summaryStyles.context, "composer-backend-preference")}
              aria-label="Backend preference"
              title="Backend selection sets mission preference. Runtime confirms actual placement in Mission Control and Review."
            >
              <span className={summaryStyles.contextCopy}>
                <span className={summaryStyles.contextLabel}>Backend preference</span>
                <span className={summaryStyles.contextTokens}>{selectedRemoteBackendLabel}</span>
              </span>
            </div>
          ) : null}
        </CoreLoopMetaRail>
      </div>
    </div>
  );
});

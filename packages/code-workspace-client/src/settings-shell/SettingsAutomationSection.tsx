import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Select,
  StatusBadge,
  Switch,
  Textarea,
  type SelectOption,
} from "@ku0/design-system";
import * as controlStyles from "./SettingsFormControls.css";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
  SettingsFooterBar,
} from "./SettingsSectionGrammar";
import * as grammar from "./SettingsSectionGrammar.css";
import { settingsServerCompactSelectProps } from "./settingsServerControlPlaneShared";
import {
  createSettingsServerOperabilityState,
  resolveSettingsServerOperabilityNotice,
  type SettingsAutomationScheduleAction,
  type SettingsAutomationScheduleActionAvailability,
  type SettingsAutomationScheduleDraft,
  type SettingsAutomationScheduleStatus,
  type SettingsAutomationScheduleSummary,
  type SettingsServerMissionNavigationTarget,
  type SettingsServerOperabilityState,
} from "./serverControlPlaneTypes";

export type SettingsAutomationSectionProps = {
  backendOptions?: Array<{ id: string; label: string }>;
  workspaceOptions?: Array<{ id: string; label: string }>;
  defaultBackendId?: string | null;
  schedules?: SettingsAutomationScheduleSummary[];
  operability?: SettingsServerOperabilityState;
  actionAvailability?: SettingsAutomationScheduleActionAvailability;
  onRefreshSchedules?: () => void | Promise<void>;
  onCreateSchedule?: (draft: SettingsAutomationScheduleDraft) => void | Promise<void>;
  onUpdateSchedule?: (
    scheduleId: string,
    draft: SettingsAutomationScheduleDraft
  ) => void | Promise<void>;
  onScheduleAction?: (request: {
    scheduleId: string;
    action: SettingsAutomationScheduleAction;
  }) => void | Promise<void>;
  onOpenMissionTarget?: (target: SettingsServerMissionNavigationTarget) => void | Promise<void>;
};

type ScheduleFieldValue = string | number | null | undefined;

function createBlankDraft(
  defaultBackendId: string | null | undefined,
  defaultWorkspaceId: string | null | undefined
): SettingsAutomationScheduleDraft {
  return {
    name: "",
    prompt: "",
    workspaceId: defaultWorkspaceId ?? "",
    cadence: "",
    backendId: defaultBackendId ?? "",
    reviewProfileId: "",
    validationPresetId: "",
    enabled: true,
    autonomyProfile: "night_operator",
    sourceScope: "workspace_graph",
    wakePolicy: "auto_queue",
    researchPolicy: "repository_only",
    queueBudget: "2",
    safeFollowUp: true,
  };
}

function mapSummaryToDraft(
  summary: SettingsAutomationScheduleSummary,
  defaultBackendId: string | null | undefined,
  defaultWorkspaceId: string | null | undefined
): SettingsAutomationScheduleDraft {
  return {
    name: summary.name,
    prompt: summary.prompt,
    workspaceId: summary.workspaceId ?? defaultWorkspaceId ?? "",
    cadence: summary.cadenceLabel,
    backendId: summary.backendId ?? defaultBackendId ?? "",
    reviewProfileId: summary.reviewProfileId ?? "",
    validationPresetId: summary.validationPresetId ?? "",
    enabled: summary.status !== "paused",
    autonomyProfile: summary.autonomyProfile ?? "night_operator",
    sourceScope: summary.sourceScope ?? "workspace_graph",
    wakePolicy: summary.wakePolicy ?? "auto_queue",
    researchPolicy: summary.researchPolicy ?? "repository_only",
    queueBudget:
      typeof summary.queueBudget === "number" && Number.isFinite(summary.queueBudget)
        ? String(summary.queueBudget)
        : "2",
    safeFollowUp: summary.safeFollowUp ?? true,
  };
}

function formatTime(value: ScheduleFieldValue): string {
  if (value === null || value === undefined) {
    return "Awaiting runtime confirmation";
  }

  return new Date(value).toLocaleString();
}

function formatStatusLabel(status: SettingsAutomationScheduleStatus): string {
  if (status === "active") {
    return "Active";
  }
  if (status === "paused") {
    return "Paused";
  }
  if (status === "running") {
    return "Running";
  }
  return "Blocked";
}

function getStatusTone(
  status: SettingsAutomationScheduleStatus
): "default" | "success" | "warning" | "progress" {
  if (status === "active") {
    return "success";
  }
  if (status === "paused") {
    return "default";
  }
  if (status === "running") {
    return "progress";
  }
  return "warning";
}

function formatReviewActionabilityLabel(state: string | null): string | null {
  if (!state) {
    return null;
  }
  if (state === "ready") {
    return "Review ready";
  }
  if (state === "degraded") {
    return "Needs attention";
  }
  if (state === "blocked") {
    return "Review blocked";
  }
  if (state === "pending") {
    return "Review pending";
  }
  return state;
}

function getReviewActionabilityTone(
  state: string | null
): "default" | "success" | "warning" | "progress" {
  if (state === "ready") {
    return "success";
  }
  if (state === "pending") {
    return "progress";
  }
  if (state === "degraded" || state === "blocked") {
    return "warning";
  }
  return "default";
}

function resolveBackendLabel(
  backendId: string | null,
  backendLabel: string | null,
  backendOptions: Array<{ id: string; label: string }>
): string {
  if (backendLabel && backendLabel.length > 0) {
    return backendLabel;
  }
  if (backendId) {
    const backendOption = backendOptions.find((option) => option.id === backendId);
    return backendOption?.label ?? backendId;
  }
  return "Automatic runtime routing";
}

function resolveWorkspaceLabel(
  workspaceId: string | null,
  workspaceOptions: Array<{ id: string; label: string }>
): string {
  if (!workspaceId) {
    return "No workspace selected";
  }
  const workspaceOption = workspaceOptions.find((option) => option.id === workspaceId);
  return workspaceOption?.label ?? workspaceId;
}

function resolveFieldLabel(value: string | null, fallback: string): string {
  if (value && value.length > 0) {
    return value;
  }
  return fallback;
}

function readScheduleLinkageValue(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function resolveScheduleNavigationTarget(
  summary: SettingsAutomationScheduleSummary
): SettingsServerMissionNavigationTarget | null {
  const workspaceId = readScheduleLinkageValue(summary.workspaceId);
  if (!workspaceId) {
    return null;
  }

  const reviewPackId = readScheduleLinkageValue(summary.reviewPackId);
  const currentTaskId = readScheduleLinkageValue(summary.currentTaskId);
  const currentRunId = readScheduleLinkageValue(summary.currentRunId);
  const lastTriggeredTaskId = readScheduleLinkageValue(summary.lastTriggeredTaskId);
  const lastTriggeredRunId = readScheduleLinkageValue(summary.lastTriggeredRunId);

  if (reviewPackId) {
    const taskId = lastTriggeredTaskId ?? currentTaskId;
    if (!taskId) {
      return null;
    }

    return {
      kind: "review",
      workspaceId,
      taskId,
      runId: lastTriggeredTaskId ? lastTriggeredRunId : currentRunId,
      reviewPackId,
      limitation: "thread_unavailable",
    };
  }

  const taskId = currentTaskId ?? lastTriggeredTaskId;
  if (!taskId) {
    return null;
  }

  return {
    kind: "mission",
    workspaceId,
    taskId,
    runId: currentTaskId ? currentRunId : lastTriggeredRunId,
    reviewPackId: null,
    threadId: null,
    limitation: "thread_unavailable",
  };
}

function resolveScheduleNavigationLabel(target: SettingsServerMissionNavigationTarget): string {
  return target.kind === "review" ? "Open review" : "Open mission";
}

export function SettingsAutomationSection({
  backendOptions = [],
  workspaceOptions = [],
  defaultBackendId = null,
  schedules = [],
  operability = createSettingsServerOperabilityState(),
  actionAvailability,
  onRefreshSchedules,
  onCreateSchedule,
  onUpdateSchedule,
  onScheduleAction,
  onOpenMissionTarget,
}: SettingsAutomationSectionProps) {
  const {
    createEnabled = true,
    updateEnabled = true,
    runNowEnabled = true,
    cancelRunEnabled = true,
  } = actionAvailability ?? {};
  const compactInputFieldClassName = `${controlStyles.inputField} ${controlStyles.inputFieldCompact}`;
  const compactSelectProps = settingsServerCompactSelectProps;
  const defaultWorkspaceId =
    workspaceOptions.length === 1 ? (workspaceOptions[0]?.id ?? null) : null;
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    () => schedules[0]?.id ?? null
  );
  const [draft, setDraft] = useState<SettingsAutomationScheduleDraft>(() =>
    createBlankDraft(defaultBackendId, defaultWorkspaceId)
  );

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );
  const loading = operability.loading;
  const error = operability.error;
  const readOnlyReason = operability.readOnlyReason;
  const unavailableReason = operability.unavailableReason;
  const operabilityNotice = resolveSettingsServerOperabilityNotice(operability);
  const mutationBlockedReason = unavailableReason ?? readOnlyReason ?? error;
  const emptyStateMessage = unavailableReason
    ? "No runtime-confirmed schedules are available because this surface is unavailable."
    : error
      ? "No runtime-confirmed schedules are available until runtime summary loading succeeds."
      : loading
        ? "Runtime-confirmed schedules are still loading."
        : "No runtime-confirmed schedules are currently published by the runtime. Create one here to populate confirmed cadence, review state, placement, and blockers.";

  useEffect(() => {
    if (selectedScheduleId !== null && selectedSchedule === null) {
      setSelectedScheduleId(schedules[0]?.id ?? null);
    }
  }, [schedules, selectedSchedule, selectedScheduleId]);

  useEffect(() => {
    if (selectedSchedule === null) {
      setDraft(createBlankDraft(defaultBackendId, defaultWorkspaceId));
      return;
    }

    setDraft(mapSummaryToDraft(selectedSchedule, defaultBackendId, defaultWorkspaceId));
  }, [defaultBackendId, defaultWorkspaceId, selectedSchedule]);

  const handleCreateNew = () => {
    setSelectedScheduleId(null);
    setDraft(createBlankDraft(defaultBackendId, defaultWorkspaceId));
  };

  const handleResetDraft = () => {
    if (selectedSchedule === null) {
      setDraft(createBlankDraft(defaultBackendId, defaultWorkspaceId));
      return;
    }

    setDraft(mapSummaryToDraft(selectedSchedule, defaultBackendId, defaultWorkspaceId));
  };

  const handleSaveDraft = async () => {
    if (selectedScheduleId === null) {
      if (!onCreateSchedule || !createEnabled || mutationBlockedReason) {
        return;
      }
      await onCreateSchedule(draft);
      return;
    }

    if (!onUpdateSchedule || !updateEnabled || mutationBlockedReason) {
      return;
    }

    await onUpdateSchedule(selectedScheduleId, draft);
  };

  const handleScheduleAction = async (action: SettingsAutomationScheduleAction) => {
    if (!selectedScheduleId || !onScheduleAction) {
      return;
    }

    if (mutationBlockedReason) {
      return;
    }
    if (action === "run-now" && !runNowEnabled) {
      return;
    }
    if (action === "cancel-run" && !cancelRunEnabled) {
      return;
    }
    if ((action === "pause" || action === "resume") && !updateEnabled) {
      return;
    }

    await onScheduleAction({ scheduleId: selectedScheduleId, action });
  };

  const canSave =
    selectedScheduleId === null
      ? onCreateSchedule !== undefined && createEnabled && mutationBlockedReason === null
      : onUpdateSchedule !== undefined && updateEnabled && mutationBlockedReason === null;
  const saveLabel = selectedScheduleId === null ? "Create schedule" : "Save changes";
  const backendSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "Automatic runtime routing" },
      ...backendOptions.map((backend) => ({
        value: backend.id,
        label: backend.label,
      })),
    ],
    [backendOptions]
  );
  const workspaceSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "Select workspace" },
      ...workspaceOptions.map((workspace) => ({
        value: workspace.id,
        label: workspace.label,
      })),
    ],
    [workspaceOptions]
  );
  const autonomyProfileOptions: SelectOption[] = [
    { value: "night_operator", label: "Night Operator" },
    { value: "supervised", label: "Supervised" },
  ];
  const sourceScopeOptions: SelectOption[] = [
    { value: "workspace_graph", label: "Workspace graph" },
    { value: "repository_only", label: "Repository only" },
    { value: "workspace_graph_and_public_web", label: "Workspace + public web" },
  ];
  const wakePolicyOptions: SelectOption[] = [
    { value: "auto_queue", label: "Auto Queue" },
    { value: "review_queue", label: "Review Queue" },
    { value: "hold", label: "Hold" },
  ];
  const researchPolicyOptions: SelectOption[] = [
    { value: "repository_only", label: "Repository only" },
    { value: "staged", label: "Staged research" },
    { value: "public_web", label: "Public web first" },
  ];
  const selectedScheduleLabel = selectedSchedule?.name ?? "No schedule selected";
  const selectedScheduleActionLabel =
    selectedSchedule?.status === "paused" ? "Resume schedule" : "Pause schedule";
  const selectedScheduleSupportsToggle =
    selectedSchedule !== null && updateEnabled && mutationBlockedReason === null;
  const cancelDisabled =
    loading ||
    mutationBlockedReason !== null ||
    !cancelRunEnabled ||
    selectedSchedule?.status !== "running" ||
    onScheduleAction === undefined;
  const runNowDisabled =
    loading || mutationBlockedReason !== null || !runNowEnabled || onScheduleAction === undefined;
  const selectedScheduleCanLaunch =
    Boolean(selectedSchedule?.workspaceId) && Boolean(selectedSchedule?.prompt.trim().length);
  const pauseResumeDisabled =
    loading || !selectedScheduleSupportsToggle || onScheduleAction === undefined;
  const selectedBackendLabel = resolveBackendLabel(
    selectedSchedule?.backendId ?? draft.backendId ?? null,
    selectedSchedule?.backendLabel ?? null,
    backendOptions
  );
  const selectedWorkspaceLabel = resolveWorkspaceLabel(
    selectedSchedule?.workspaceId ?? draft.workspaceId ?? null,
    workspaceOptions
  );
  const selectedScheduleNavigationTarget = selectedSchedule
    ? resolveScheduleNavigationTarget(selectedSchedule)
    : null;
  const selectedScheduleNavigationLabel = selectedScheduleNavigationTarget
    ? resolveScheduleNavigationLabel(selectedScheduleNavigationTarget)
    : null;

  return (
    <>
      <SettingsFieldGroup
        title="Scheduled automations"
        subtitle="Runtime-confirmed summaries stay in the server area. The runtime remains the source of truth for next run, last run, blocking state, and review outcome."
      >
        <SettingsField
          label="Schedule summaries"
          help="Each summary reflects runtime-confirmed placement. The panel does not maintain its own scheduler."
        >
          <div className="settings-field">
            <SettingsFooterBar>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void onRefreshSchedules?.();
                }}
                disabled={loading || unavailableReason !== null || onRefreshSchedules === undefined}
              >
                {loading ? "Refreshing..." : "Refresh summaries"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={handleCreateNew}
                disabled={loading || mutationBlockedReason !== null || !createEnabled}
                title={
                  mutationBlockedReason ??
                  (!createEnabled
                    ? "Runtime schedule create is unavailable in current runtime."
                    : undefined)
                }
              >
                New schedule
              </Button>
            </SettingsFooterBar>

            {operabilityNotice ? (
              <div
                className={
                  operabilityNotice.tone === "error" ? grammar.errorText : grammar.helpText
                }
              >
                {operabilityNotice.text}
              </div>
            ) : null}
            {schedules.length === 0 ? (
              <div className={grammar.helpText}>{emptyStateMessage}</div>
            ) : (
              schedules.map((schedule) => {
                const isSelected = schedule.id === selectedScheduleId;
                const backendLabel = resolveBackendLabel(
                  schedule.backendId,
                  schedule.backendLabel,
                  backendOptions
                );
                const reviewProfileLabel = resolveFieldLabel(
                  schedule.reviewProfileLabel ?? schedule.reviewProfileId,
                  "Default review profile"
                );
                const validationPresetLabel = resolveFieldLabel(
                  schedule.validationPresetLabel ?? schedule.validationPresetId,
                  "Default validation preset"
                );
                const workspaceLabel = resolveWorkspaceLabel(
                  schedule.workspaceId,
                  workspaceOptions
                );
                const navigationTarget = resolveScheduleNavigationTarget(schedule);
                const navigationLabel = navigationTarget
                  ? resolveScheduleNavigationLabel(navigationTarget)
                  : null;
                const reviewActionabilityLabel = formatReviewActionabilityLabel(
                  schedule.reviewActionabilityState
                );

                return (
                  <SettingsField
                    key={schedule.id}
                    label={schedule.name}
                    help={`Cadence: ${schedule.cadenceLabel} · Next run: ${formatTime(
                      schedule.nextRunAtMs
                    )}`}
                  >
                    <div className="settings-field">
                      <div className="settings-field-row">
                        <StatusBadge tone={getStatusTone(schedule.status)}>
                          {formatStatusLabel(schedule.status)}
                        </StatusBadge>
                        {isSelected ? <StatusBadge tone="progress">Selected</StatusBadge> : null}
                        {reviewActionabilityLabel ? (
                          <StatusBadge
                            tone={getReviewActionabilityTone(schedule.reviewActionabilityState)}
                          >
                            {reviewActionabilityLabel}
                          </StatusBadge>
                        ) : null}
                        {schedule.safeFollowUp ? (
                          <StatusBadge tone="success">Safe follow-up</StatusBadge>
                        ) : null}
                      </div>
                      <div className={grammar.helpText}>{schedule.prompt}</div>
                      <div className={grammar.helpText}>
                        Last run: {formatTime(schedule.lastRunAtMs)}
                      </div>
                      <div className={grammar.helpText}>
                        Last outcome:{" "}
                        {resolveFieldLabel(schedule.lastOutcomeLabel, "Awaiting runtime result")}
                      </div>
                      <div className={grammar.helpText}>Workspace: {workspaceLabel}</div>
                      <div className={grammar.helpText}>Backend: {backendLabel}</div>
                      <div className={grammar.helpText}>
                        Autonomy: {resolveFieldLabel(schedule.autonomyProfile, "Night Operator")}
                      </div>
                      <div className={grammar.helpText}>
                        Wake policy: {resolveFieldLabel(schedule.wakePolicy, "Auto Queue")}
                      </div>
                      <div className={grammar.helpText}>
                        Source scope: {resolveFieldLabel(schedule.sourceScope, "Workspace graph")}
                      </div>
                      <div className={grammar.helpText}>Review profile: {reviewProfileLabel}</div>
                      <div className={grammar.helpText}>
                        Validation preset: {validationPresetLabel}
                      </div>
                      {reviewActionabilityLabel ? (
                        <div className={grammar.helpText}>
                          Review actionability: {reviewActionabilityLabel}
                        </div>
                      ) : null}
                      {schedule.triggerSourceLabel ? (
                        <div className={grammar.helpText}>
                          Trigger source: {schedule.triggerSourceLabel}
                        </div>
                      ) : null}
                      {schedule.blockingReason ? (
                        <div className={grammar.errorText}>
                          Blocking reason: {schedule.blockingReason}
                        </div>
                      ) : null}
                      {schedule.reviewPackId ? (
                        <div className={grammar.helpText}>Review pack: {schedule.reviewPackId}</div>
                      ) : null}
                      <SettingsFooterBar>
                        {navigationTarget && navigationLabel && onOpenMissionTarget ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="settings-button-compact"
                            aria-label={`${navigationLabel} for ${schedule.name}`}
                            onClick={() => {
                              void onOpenMissionTarget(navigationTarget);
                            }}
                          >
                            {navigationLabel}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="settings-button-compact"
                          onClick={() => setSelectedScheduleId(schedule.id)}
                        >
                          Edit
                        </Button>
                      </SettingsFooterBar>
                    </div>
                  </SettingsField>
                );
              })
            )}
          </div>
        </SettingsField>
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title={selectedScheduleId === null ? "Create schedule" : "Edit selected schedule"}
        subtitle="Create or edit the prompt, cadence, backend preference, review profile, and validation preset. Saving still flows through the runtime facade."
      >
        <SettingsField label="Schedule enabled" help="New schedules start enabled by default.">
          <SettingsControlRow
            title="Enabled"
            subtitle="Pause/resume state is still runtime-owned; this only seeds the draft."
            control={
              <Switch
                checked={draft.enabled}
                aria-label="Toggle schedule enabled"
                onCheckedChange={() =>
                  setDraft((previous) => ({ ...previous, enabled: !previous.enabled }))
                }
              />
            }
          />
        </SettingsField>

        <SettingsField label="Schedule name" htmlFor="schedule-name">
          <Input
            id="schedule-name"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.name}
            onValueChange={(value) => setDraft((previous) => ({ ...previous, name: value }))}
            placeholder="Nightly review sweep"
          />
        </SettingsField>

        <SettingsField
          label="Prompt"
          htmlFor="schedule-prompt"
          help="Describe the repeated task. The runtime will execute the prompt against the selected backend and review profile."
        >
          <Textarea
            id="schedule-prompt"
            fieldClassName={controlStyles.textareaField}
            className={controlStyles.textareaCode}
            value={draft.prompt}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, prompt: event.target.value }))
            }
            placeholder="Inspect open PRs, summarize risks, and propose follow-up actions."
            spellCheck={false}
            textareaSize="lg"
          />
        </SettingsField>

        {workspaceOptions.length > 0 ? (
          <SettingsField
            label="Workspace"
            help="Schedules must target a workspace before Run now can launch a runtime task."
          >
            <Select
              {...compactSelectProps}
              ariaLabel="Workspace"
              options={workspaceSelectOptions}
              value={draft.workspaceId}
              onValueChange={(value) =>
                setDraft((previous) => ({ ...previous, workspaceId: value }))
              }
            />
          </SettingsField>
        ) : (
          <SettingsField
            label="Workspace"
            htmlFor="schedule-workspace"
            help="Enter the workspace ID that this schedule should launch against."
          >
            <Input
              id="schedule-workspace"
              fieldClassName={compactInputFieldClassName}
              inputSize="sm"
              value={draft.workspaceId}
              onValueChange={(value) =>
                setDraft((previous) => ({ ...previous, workspaceId: value }))
              }
              placeholder="workspace-1"
            />
          </SettingsField>
        )}

        <SettingsField
          label="Cadence"
          htmlFor="schedule-cadence"
          help="Use the human-readable cadence that the runtime facade will translate into a schedule."
        >
          <Input
            id="schedule-cadence"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.cadence}
            onValueChange={(value) => setDraft((previous) => ({ ...previous, cadence: value }))}
            placeholder="Every weekday at 09:00"
          />
        </SettingsField>

        {backendOptions.length > 0 ? (
          <SettingsField
            label="Backend preference"
            help="Leave the default runtime routing in place or pick a backend explicitly."
          >
            <Select
              {...compactSelectProps}
              ariaLabel="Backend preference"
              options={backendSelectOptions}
              value={draft.backendId}
              onValueChange={(value) => setDraft((previous) => ({ ...previous, backendId: value }))}
            />
          </SettingsField>
        ) : (
          <SettingsField
            label="Backend preference"
            help="No backend list is available yet, so the draft keeps the runtime default."
          >
            <Input
              fieldClassName={compactInputFieldClassName}
              inputSize="sm"
              value={draft.backendId}
              onValueChange={(value) => setDraft((previous) => ({ ...previous, backendId: value }))}
              placeholder={defaultBackendId ?? "Automatic runtime routing"}
            />
          </SettingsField>
        )}

        <SettingsField
          label="Autonomy profile"
          help="Night Operator keeps bounded unattended execution on the runtime side without creating a second scheduler in the UI."
        >
          <Select
            {...compactSelectProps}
            ariaLabel="Autonomy profile"
            options={autonomyProfileOptions}
            value={draft.autonomyProfile}
            onValueChange={(value) =>
              setDraft((previous) => ({ ...previous, autonomyProfile: value }))
            }
          />
        </SettingsField>

        <SettingsField
          label="Source scope"
          help="Control whether the runtime stays repo-local or may expand into public-web research."
        >
          <Select
            {...compactSelectProps}
            ariaLabel="Source scope"
            options={sourceScopeOptions}
            value={draft.sourceScope}
            onValueChange={(value) => setDraft((previous) => ({ ...previous, sourceScope: value }))}
          />
        </SettingsField>

        <SettingsField
          label="Wake policy"
          help="Auto Queue allows bounded follow-up chaining; hold pauses for operator review."
        >
          <Select
            {...compactSelectProps}
            ariaLabel="Wake policy"
            options={wakePolicyOptions}
            value={draft.wakePolicy}
            onValueChange={(value) => setDraft((previous) => ({ ...previous, wakePolicy: value }))}
          />
        </SettingsField>

        <SettingsField
          label="Research policy"
          help="Staged research keeps public-web work and private-context work separated."
        >
          <Select
            {...compactSelectProps}
            ariaLabel="Research policy"
            options={researchPolicyOptions}
            value={draft.researchPolicy}
            onValueChange={(value) =>
              setDraft((previous) => ({ ...previous, researchPolicy: value }))
            }
          />
        </SettingsField>

        <SettingsField
          label="Queue budget"
          htmlFor="schedule-queue-budget"
          help="Maximum number of runtime-owned next actions that can be chained before waking the operator."
        >
          <Input
            id="schedule-queue-budget"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.queueBudget}
            onValueChange={(value) => setDraft((previous) => ({ ...previous, queueBudget: value }))}
            placeholder="2"
          />
        </SettingsField>

        <SettingsField
          label="Safe follow-up"
          help="Keeps follow-up chaining constrained to bounded, review-friendly continuation."
        >
          <SettingsControlRow
            title="Allow safe follow-up"
            subtitle="The runtime still decides whether continuation is eligible."
            control={
              <Switch
                checked={draft.safeFollowUp}
                aria-label="Toggle safe follow-up"
                onCheckedChange={() =>
                  setDraft((previous) => ({ ...previous, safeFollowUp: !previous.safeFollowUp }))
                }
              />
            }
          />
        </SettingsField>

        <SettingsField
          label="Review profile"
          htmlFor="schedule-review-profile"
          help="Optional review profile identifier. The runtime will use its own confirmed mapping."
        >
          <Input
            id="schedule-review-profile"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.reviewProfileId}
            onValueChange={(value) =>
              setDraft((previous) => ({ ...previous, reviewProfileId: value }))
            }
            placeholder="issue-review"
          />
        </SettingsField>

        <SettingsField
          label="Validation preset"
          htmlFor="schedule-validation-preset"
          help="Optional validation preset identifier used by the runtime for follow-up checks."
        >
          <Input
            id="schedule-validation-preset"
            fieldClassName={compactInputFieldClassName}
            inputSize="sm"
            value={draft.validationPresetId}
            onValueChange={(value) =>
              setDraft((previous) => ({ ...previous, validationPresetId: value }))
            }
            placeholder="standard"
          />
        </SettingsField>

        <SettingsFooterBar>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="settings-button-compact"
            onClick={handleResetDraft}
            disabled={loading}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="settings-button-compact"
            onClick={() => {
              void handleSaveDraft();
            }}
            disabled={loading || !canSave}
            title={
              !canSave
                ? (mutationBlockedReason ??
                  (selectedScheduleId === null
                    ? "Runtime schedule create is unavailable in current runtime."
                    : "Runtime schedule update is unavailable in current runtime."))
                : undefined
            }
          >
            {saveLabel}
          </Button>
        </SettingsFooterBar>
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Selected runtime summary"
        subtitle="The runtime confirms next run, last run, last outcome, backend, review profile, validation preset, and blocking state here."
      >
        {selectedSchedule ? (
          <div className="settings-field">
            <div className="settings-field-row">
              <StatusBadge tone={getStatusTone(selectedSchedule.status)}>
                {formatStatusLabel(selectedSchedule.status)}
              </StatusBadge>
              {selectedSchedule.reviewActionabilityState ? (
                <StatusBadge
                  tone={getReviewActionabilityTone(selectedSchedule.reviewActionabilityState)}
                >
                  {formatReviewActionabilityLabel(selectedSchedule.reviewActionabilityState)}
                </StatusBadge>
              ) : null}
              <StatusBadge tone="progress">{selectedScheduleLabel}</StatusBadge>
            </div>
            <div className={grammar.helpText}>Cadence: {selectedSchedule.cadenceLabel}</div>
            <div className={grammar.helpText}>
              Next run: {formatTime(selectedSchedule.nextRunAtMs)}
            </div>
            <div className={grammar.helpText}>
              Last run: {formatTime(selectedSchedule.lastRunAtMs)}
            </div>
            <div className={grammar.helpText}>
              Last outcome:{" "}
              {resolveFieldLabel(selectedSchedule.lastOutcomeLabel, "Awaiting runtime result")}
            </div>
            <div className={grammar.helpText}>Workspace: {selectedWorkspaceLabel}</div>
            <div className={grammar.helpText}>Backend: {selectedBackendLabel}</div>
            <div className={grammar.helpText}>
              Autonomy profile:{" "}
              {resolveFieldLabel(selectedSchedule.autonomyProfile, "Night Operator")}
            </div>
            <div className={grammar.helpText}>
              Wake policy: {resolveFieldLabel(selectedSchedule.wakePolicy, "Auto Queue")}
            </div>
            <div className={grammar.helpText}>
              Source scope: {resolveFieldLabel(selectedSchedule.sourceScope, "Workspace graph")}
            </div>
            <div className={grammar.helpText}>
              Research policy:{" "}
              {resolveFieldLabel(selectedSchedule.researchPolicy, "Repository only")}
            </div>
            <div className={grammar.helpText}>
              Queue budget: {selectedSchedule.queueBudget ?? "runtime default"}
            </div>
            <div className={grammar.helpText}>
              Review profile:{" "}
              {resolveFieldLabel(
                selectedSchedule.reviewProfileLabel ?? selectedSchedule.reviewProfileId,
                "Default review profile"
              )}
            </div>
            <div className={grammar.helpText}>
              Validation preset:{" "}
              {resolveFieldLabel(
                selectedSchedule.validationPresetLabel ?? selectedSchedule.validationPresetId,
                "Default validation preset"
              )}
            </div>
            {selectedSchedule.triggerSourceLabel ? (
              <div className={grammar.helpText}>
                Trigger source: {selectedSchedule.triggerSourceLabel}
              </div>
            ) : null}
            {selectedSchedule.currentTaskId ? (
              <div className={grammar.helpText}>
                Active task: {selectedSchedule.currentTaskId}
                {selectedSchedule.currentTaskStatus
                  ? ` (${selectedSchedule.currentTaskStatus})`
                  : ""}
              </div>
            ) : null}
            {selectedSchedule.currentRunId ? (
              <div className={grammar.helpText}>Active run: {selectedSchedule.currentRunId}</div>
            ) : null}
            {selectedSchedule.lastTriggeredTaskId ? (
              <div className={grammar.helpText}>
                Last triggered task: {selectedSchedule.lastTriggeredTaskId}
                {selectedSchedule.lastTriggeredTaskStatus
                  ? ` (${selectedSchedule.lastTriggeredTaskStatus})`
                  : ""}
              </div>
            ) : null}
            {selectedSchedule.lastTriggeredRunId ? (
              <div className={grammar.helpText}>
                Last triggered run: {selectedSchedule.lastTriggeredRunId}
              </div>
            ) : null}
            {selectedSchedule.reviewPackId ? (
              <div className={grammar.helpText}>Review pack: {selectedSchedule.reviewPackId}</div>
            ) : null}
            {selectedSchedule.reviewActionabilityState ? (
              <div className={grammar.helpText}>
                Review actionability: {selectedSchedule.reviewActionabilityState}
              </div>
            ) : null}
            {selectedSchedule.blockingReason ? (
              <div className={grammar.errorText}>
                Blocking reason: {selectedSchedule.blockingReason}
              </div>
            ) : null}
            <div className={grammar.helpText}>
              Safe follow-up:{" "}
              {selectedSchedule.safeFollowUp
                ? "yes"
                : selectedSchedule.safeFollowUp === false
                  ? "no"
                  : "unknown"}
            </div>
            <SettingsFooterBar>
              {selectedScheduleNavigationTarget && onOpenMissionTarget ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="settings-button-compact"
                  aria-label={`${selectedScheduleNavigationLabel} for ${selectedScheduleLabel}`}
                  onClick={() => {
                    void onOpenMissionTarget(selectedScheduleNavigationTarget);
                  }}
                >
                  {selectedScheduleNavigationLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void handleScheduleAction(
                    selectedSchedule?.status === "paused" ? "resume" : "pause"
                  );
                }}
                disabled={pauseResumeDisabled}
                title={
                  pauseResumeDisabled
                    ? (mutationBlockedReason ??
                      (updateEnabled
                        ? undefined
                        : "Runtime schedule state changes are unavailable."))
                    : undefined
                }
              >
                {selectedScheduleActionLabel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void handleScheduleAction("run-now");
                }}
                disabled={runNowDisabled || !selectedScheduleCanLaunch}
                title={
                  runNowDisabled
                    ? (mutationBlockedReason ??
                      (!runNowEnabled ? "Runtime schedule run-now is unavailable." : undefined))
                    : !selectedScheduleCanLaunch
                      ? "Select a workspace and prompt before launching."
                      : undefined
                }
              >
                Run now
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void handleScheduleAction("cancel-run");
                }}
                disabled={cancelDisabled}
                title={
                  cancelDisabled
                    ? (mutationBlockedReason ??
                      (!cancelRunEnabled
                        ? "Runtime schedule cancel-run is unavailable."
                        : "No current run is active."))
                    : undefined
                }
              >
                Cancel current run
              </Button>
            </SettingsFooterBar>
          </div>
        ) : (
          <div className={grammar.helpText}>
            Select an existing schedule above, or create a new one, to inspect the runtime summary
            and issue run controls.
          </div>
        )}
      </SettingsFieldGroup>
    </>
  );
}

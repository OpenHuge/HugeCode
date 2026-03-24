import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Select,
  StatusBadge,
  Textarea,
  type SelectOption,
} from "../../../../design-system";
import {
  SettingsField,
  SettingsFieldGroup,
  SettingsFooterBar,
  SettingsControlRow,
} from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import * as grammar from "../SettingsSectionGrammar.css";
import { SettingsToggleControl } from "../SettingsToggleControl";

export type SettingsAutomationScheduleStatus = "active" | "paused" | "running" | "blocked";

export type SettingsAutomationScheduleAction = "pause" | "resume" | "run-now" | "cancel-run";

export type SettingsAutomationScheduleSummary = {
  id: string;
  name: string;
  prompt: string;
  cadenceLabel: string;
  status: SettingsAutomationScheduleStatus;
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastOutcomeLabel: string | null;
  backendId: string | null;
  backendLabel: string | null;
  reviewProfileId: string | null;
  reviewProfileLabel: string | null;
  validationPresetId: string | null;
  validationPresetLabel: string | null;
  triggerSourceLabel: string | null;
  blockingReason: string | null;
  safeFollowUp: boolean | null;
  autonomyProfile: string | null;
  sourceScope: string | null;
  wakePolicy: string | null;
  researchPolicy: string | null;
  queueBudget: number | null;
};

export type SettingsAutomationScheduleDraft = {
  name: string;
  prompt: string;
  cadence: string;
  backendId: string;
  reviewProfileId: string;
  validationPresetId: string;
  enabled: boolean;
  autonomyProfile: string;
  sourceScope: string;
  wakePolicy: string;
  researchPolicy: string;
  queueBudget: string;
  safeFollowUp: boolean;
};

export type SettingsAutomationSectionProps = {
  backendOptions?: Array<{ id: string; label: string }>;
  defaultBackendId?: string | null;
  schedules?: SettingsAutomationScheduleSummary[];
  loading?: boolean;
  error?: string | null;
  readOnlyReason?: string | null;
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
};

type ScheduleFieldValue = string | number | null | undefined;

function createBlankDraft(
  defaultBackendId: string | null | undefined
): SettingsAutomationScheduleDraft {
  return {
    name: "",
    prompt: "",
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
  defaultBackendId: string | null | undefined
): SettingsAutomationScheduleDraft {
  return {
    name: summary.name,
    prompt: summary.prompt,
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

function resolveFieldLabel(value: string | null, fallback: string): string {
  if (value && value.length > 0) {
    return value;
  }
  return fallback;
}

function resolveReadOnlyReason(
  readOnlyReason: string | null | undefined,
  loading: boolean | undefined,
  onRefreshSchedules: SettingsAutomationSectionProps["onRefreshSchedules"],
  onCreateSchedule: SettingsAutomationSectionProps["onCreateSchedule"],
  onUpdateSchedule: SettingsAutomationSectionProps["onUpdateSchedule"],
  onScheduleAction: SettingsAutomationSectionProps["onScheduleAction"]
): string | null {
  if (readOnlyReason) {
    return readOnlyReason;
  }
  if (loading) {
    return "Runtime is still loading schedule summaries.";
  }
  if (onRefreshSchedules || onCreateSchedule || onUpdateSchedule || onScheduleAction) {
    return null;
  }
  return "Schedule facade is not wired yet.";
}

export function SettingsAutomationSection({
  backendOptions = [],
  defaultBackendId = null,
  schedules = [],
  loading = false,
  error = null,
  readOnlyReason = null,
  onRefreshSchedules,
  onCreateSchedule,
  onUpdateSchedule,
  onScheduleAction,
}: SettingsAutomationSectionProps) {
  const compactInputFieldClassName = `${controlStyles.inputField} ${controlStyles.inputFieldCompact}`;
  const compactSelectProps = {
    className: controlStyles.selectRoot,
    triggerClassName: controlStyles.selectTrigger,
    menuClassName: controlStyles.selectMenu,
    optionClassName: controlStyles.selectOption,
    triggerDensity: "compact" as const,
  };
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    () => schedules[0]?.id ?? null
  );
  const [draft, setDraft] = useState<SettingsAutomationScheduleDraft>(() =>
    createBlankDraft(defaultBackendId)
  );

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );
  const readOnlyStateReason = resolveReadOnlyReason(
    readOnlyReason,
    loading,
    onRefreshSchedules,
    onCreateSchedule,
    onUpdateSchedule,
    onScheduleAction
  );

  useEffect(() => {
    if (selectedScheduleId !== null && selectedSchedule === null) {
      setSelectedScheduleId(schedules[0]?.id ?? null);
    }
  }, [schedules, selectedSchedule, selectedScheduleId]);

  useEffect(() => {
    if (selectedSchedule === null) {
      setDraft(createBlankDraft(defaultBackendId));
      return;
    }

    setDraft(mapSummaryToDraft(selectedSchedule, defaultBackendId));
  }, [defaultBackendId, selectedSchedule]);

  const handleCreateNew = () => {
    setSelectedScheduleId(null);
    setDraft(createBlankDraft(defaultBackendId));
  };

  const handleResetDraft = () => {
    if (selectedSchedule === null) {
      setDraft(createBlankDraft(defaultBackendId));
      return;
    }

    setDraft(mapSummaryToDraft(selectedSchedule, defaultBackendId));
  };

  const handleSaveDraft = async () => {
    if (selectedScheduleId === null) {
      if (!onCreateSchedule) {
        return;
      }
      await onCreateSchedule(draft);
      return;
    }

    if (!onUpdateSchedule) {
      return;
    }

    await onUpdateSchedule(selectedScheduleId, draft);
  };

  const handleScheduleAction = async (action: SettingsAutomationScheduleAction) => {
    if (!selectedScheduleId || !onScheduleAction) {
      return;
    }

    await onScheduleAction({ scheduleId: selectedScheduleId, action });
  };

  const canSave =
    selectedScheduleId === null ? onCreateSchedule !== undefined : onUpdateSchedule !== undefined;
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
  const cancelDisabled =
    loading || selectedSchedule?.status !== "running" || onScheduleAction === undefined;
  const runNowDisabled = loading || onScheduleAction === undefined;
  const pauseResumeDisabled =
    loading || selectedSchedule === null || onScheduleAction === undefined;
  const selectedBackendLabel = resolveBackendLabel(
    selectedSchedule?.backendId ?? draft.backendId ?? null,
    selectedSchedule?.backendLabel ?? null,
    backendOptions
  );

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
                disabled={loading || onRefreshSchedules === undefined}
              >
                {loading ? "Refreshing..." : "Refresh summaries"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="settings-button-compact"
                onClick={handleCreateNew}
                disabled={loading}
              >
                New schedule
              </Button>
            </SettingsFooterBar>

            {error ? <div className={grammar.errorText}>{error}</div> : null}
            {readOnlyStateReason ? (
              <div className={grammar.helpText}>{readOnlyStateReason}</div>
            ) : null}
            {schedules.length === 0 ? (
              <div className={grammar.helpText}>
                No runtime-confirmed schedules are available yet. Wire the schedule facade to show
                confirmed runs, timing, review state, and blockers here.
              </div>
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
                      <SettingsFooterBar>
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
              <SettingsToggleControl
                checked={draft.enabled}
                ariaLabel="Toggle schedule enabled"
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
              <SettingsToggleControl
                checked={draft.safeFollowUp}
                ariaLabel="Toggle safe follow-up"
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
            title={!canSave ? (readOnlyStateReason ?? undefined) : undefined}
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
                title={pauseResumeDisabled ? (readOnlyStateReason ?? undefined) : undefined}
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
                disabled={runNowDisabled}
                title={runNowDisabled ? (readOnlyStateReason ?? undefined) : undefined}
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
                title={cancelDisabled ? "No current run is active." : undefined}
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

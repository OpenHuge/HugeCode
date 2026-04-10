import { Select, type SelectOption } from "@ku0/design-system";
import { SettingsField, SettingsFieldGroup } from "./SettingsSectionGrammar";
import { settingsServerCompactSelectProps } from "./settingsServerControlPlaneShared";
import { SettingsAutomationSection } from "./SettingsAutomationSection";
import { SettingsBackendPoolSection } from "./SettingsBackendPoolSection";
import { SettingsRuntimeCompositionFieldGroup } from "./SettingsRuntimeCompositionFieldGroup";
import {
  createSettingsServerOperabilityState,
  type SettingsServerControlPlaneSectionProps,
} from "./serverControlPlaneTypes";

export function SettingsServerControlPlaneSection({
  isMobileSimplified = false,
  remoteExecutionBackendOptions,
  defaultRemoteExecutionBackendId,
  onSetDefaultExecutionBackend,
  workspaceOptions,
  backendPoolVisible,
  backendPool,
  backendPoolLoading = false,
  backendPoolError = null,
  backendPoolReadOnlyReason = null,
  backendPoolStateActionsEnabled = false,
  backendPoolRemoveEnabled = false,
  backendPoolUpsertEnabled = false,
  backendPoolProbeEnabled = false,
  backendPoolEditEnabled = false,
  backendPoolBootstrapPreview = null,
  backendPoolBootstrapPreviewError = null,
  backendPoolDiagnostics = null,
  backendPoolDiagnosticsError = null,
  onRefreshBackendPool,
  onBackendPoolAction,
  onBackendPoolUpsert,
  onNativeBackendEdit,
  onAcpBackendUpsert,
  onAcpBackendEdit,
  onAcpBackendProbe,
  automationSchedules = [],
  automationSchedulesOperability = createSettingsServerOperabilityState(),
  automationScheduleActionAvailability,
  onRefreshAutomationSchedules,
  onCreateAutomationSchedule,
  onUpdateAutomationSchedule,
  onAutomationScheduleAction,
  onOpenMissionTarget,
}: SettingsServerControlPlaneSectionProps) {
  if (isMobileSimplified) {
    return null;
  }

  const defaultExecutionBackendSelectOptions: SelectOption[] = [
    { value: "", label: "Automatic runtime routing" },
    ...remoteExecutionBackendOptions.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  ];

  return (
    <>
      <SettingsFieldGroup
        title="Execution routing defaults"
        subtitle="Choose the default backend route first. Transport and daemon controls stay below as advanced maintenance settings, and backend pool status remains observability rather than execution truth."
      >
        {remoteExecutionBackendOptions.length > 0 ? (
          <SettingsField
            label="Default execution backend"
            help="This backend is applied by the application runtime facade whenever a task starts without an explicit backend preference. It sets routing intent, not confirmed placement truth; Mission Control and Review show the runtime-resolved backend, source, and routing health for each run."
          >
            <Select
              {...settingsServerCompactSelectProps}
              ariaLabel="Default execution backend"
              options={defaultExecutionBackendSelectOptions}
              value={defaultRemoteExecutionBackendId ?? ""}
              onValueChange={(value) => {
                void onSetDefaultExecutionBackend(value || null);
              }}
            />
          </SettingsField>
        ) : null}
      </SettingsFieldGroup>

      <SettingsRuntimeCompositionFieldGroup
        workspaceOptions={workspaceOptions}
        remoteExecutionBackendOptions={remoteExecutionBackendOptions}
        defaultRemoteExecutionBackendId={defaultRemoteExecutionBackendId}
      />

      {backendPoolVisible ? (
        <SettingsFieldGroup
          title="Backend pool state"
          subtitle="Observe backend health, onboarding, and diagnostics here. This explains routing capacity, degraded state, and self-host next steps without replacing runtime-confirmed placement."
        >
          <SettingsBackendPoolSection
            backendPool={backendPool}
            loading={backendPoolLoading}
            error={backendPoolError}
            readOnlyReason={backendPoolReadOnlyReason}
            stateActionsEnabled={backendPoolStateActionsEnabled}
            removeEnabled={backendPoolRemoveEnabled}
            upsertEnabled={backendPoolUpsertEnabled}
            probeEnabled={backendPoolProbeEnabled}
            editEnabled={backendPoolEditEnabled}
            bootstrapPreview={backendPoolBootstrapPreview}
            bootstrapPreviewError={backendPoolBootstrapPreviewError}
            diagnostics={backendPoolDiagnostics}
            diagnosticsError={backendPoolDiagnosticsError}
            showFieldGroup={false}
            onRefresh={onRefreshBackendPool}
            onBackendAction={onBackendPoolAction}
            onBackendUpsert={onBackendPoolUpsert}
            onNativeBackendEdit={onNativeBackendEdit}
            onAcpBackendUpsert={onAcpBackendUpsert}
            onAcpBackendEdit={onAcpBackendEdit}
            onAcpBackendProbe={onAcpBackendProbe}
          />
        </SettingsFieldGroup>
      ) : null}

      <SettingsAutomationSection
        backendOptions={remoteExecutionBackendOptions}
        workspaceOptions={workspaceOptions}
        defaultBackendId={defaultRemoteExecutionBackendId}
        schedules={automationSchedules}
        operability={automationSchedulesOperability}
        actionAvailability={automationScheduleActionAvailability}
        onRefreshSchedules={onRefreshAutomationSchedules}
        onCreateSchedule={onCreateAutomationSchedule}
        onUpdateSchedule={onUpdateAutomationSchedule}
        onScheduleAction={onAutomationScheduleAction}
        onOpenMissionTarget={onOpenMissionTarget}
      />
    </>
  );
}

export {
  SettingsAutomationSection,
  SettingsBackendPoolSection,
  SettingsRuntimeCompositionFieldGroup,
};

import { useEffect, useState } from "react";
import type { RuntimeCompositionSettingsEntry } from "@ku0/code-platform-interfaces";
import {
  useMaybeWorkspaceClientBindings,
  useSharedRuntimeCompositionState,
} from "@ku0/code-workspace-client";
import { Button, Select, type SelectOption } from "../../../../../design-system";
import { SettingsField, SettingsFieldGroup, SettingsFooterBar } from "../../SettingsSectionGrammar";
import type { SettingsServerCompactSelectProps } from "./shared";

type SettingsRuntimeCompositionFieldGroupProps = {
  workspaceOptions: Array<{ id: string; label: string }>;
  remoteExecutionBackendOptions: Array<{ id: string; label: string }>;
  defaultRemoteExecutionBackendId: string | null;
  compactSelectProps: SettingsServerCompactSelectProps;
};

function resolveInitialWorkspaceId(
  workspaceOptions: Array<{ id: string; label: string }>,
  routeWorkspaceId: string | null
) {
  if (
    routeWorkspaceId &&
    workspaceOptions.some((workspaceOption) => workspaceOption.id === routeWorkspaceId)
  ) {
    return routeWorkspaceId;
  }
  return workspaceOptions[0]?.id ?? null;
}

export function SettingsRuntimeCompositionFieldGroup({
  workspaceOptions,
  remoteExecutionBackendOptions,
  defaultRemoteExecutionBackendId,
  compactSelectProps,
}: SettingsRuntimeCompositionFieldGroupProps) {
  const bindings = useMaybeWorkspaceClientBindings();
  const routeSelection = bindings?.navigation.readRouteSelection();
  const routeWorkspaceId = routeSelection?.kind === "workspace" ? routeSelection.workspaceId : null;

  if (!bindings || workspaceOptions.length === 0) {
    return null;
  }

  return (
    <SettingsRuntimeCompositionFieldGroupContent
      workspaceOptions={workspaceOptions}
      remoteExecutionBackendOptions={remoteExecutionBackendOptions}
      defaultRemoteExecutionBackendId={defaultRemoteExecutionBackendId}
      compactSelectProps={compactSelectProps}
      routeWorkspaceId={routeWorkspaceId}
    />
  );
}

type SettingsRuntimeCompositionFieldGroupContentProps =
  SettingsRuntimeCompositionFieldGroupProps & {
    routeWorkspaceId: string | null;
  };

function SettingsRuntimeCompositionFieldGroupContent({
  workspaceOptions,
  remoteExecutionBackendOptions,
  defaultRemoteExecutionBackendId,
  compactSelectProps,
  routeWorkspaceId,
}: SettingsRuntimeCompositionFieldGroupContentProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() =>
    resolveInitialWorkspaceId(workspaceOptions, routeWorkspaceId)
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const runtimeComposition = useSharedRuntimeCompositionState({
    workspaceId: selectedWorkspaceId,
    enabled: selectedWorkspaceId !== null,
  });

  useEffect(() => {
    setSelectedWorkspaceId((currentWorkspaceId) => {
      if (
        currentWorkspaceId &&
        workspaceOptions.some((workspaceOption) => workspaceOption.id === currentWorkspaceId)
      ) {
        return currentWorkspaceId;
      }
      return resolveInitialWorkspaceId(workspaceOptions, routeWorkspaceId);
    });
  }, [routeWorkspaceId, workspaceOptions]);

  useEffect(() => {
    setActionError(null);
    setActionInfo(null);
  }, [selectedWorkspaceId]);

  if (!selectedWorkspaceId) {
    return null;
  }

  const profileOptions: SelectOption[] = [
    { value: "", label: "Automatic runtime composition" },
    ...runtimeComposition.profiles.map((profile) => ({
      value: profile.id,
      label: `${profile.name} (${profile.scope})`,
    })),
  ];
  const backendOptions: SelectOption[] = [
    { value: "", label: "Automatic runtime routing" },
    ...remoteExecutionBackendOptions.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  ];
  const selectedBackendId = runtimeComposition.settings?.selection.preferredBackendIds[0] ?? "";
  const backendPreferenceHelp = defaultRemoteExecutionBackendId
    ? `This persists a workspace-specific routing hint. Leaving it automatic falls back to shared runtime routing, starting from the current default backend ${defaultRemoteExecutionBackendId} when no narrower runtime choice applies.`
    : "This persists a workspace-specific routing hint. Leaving it automatic falls back to shared runtime routing and runtime-selected placement.";
  const resolutionSummary = runtimeComposition.summary;
  const authoritySummary = runtimeComposition.authoritySummary;
  const actionBusy = runtimeComposition.isLoading || runtimeComposition.isMutating;

  async function handleProfileChange(profileId: string) {
    setActionError(null);
    setActionInfo(null);
    try {
      if (profileId) {
        await runtimeComposition.applyProfile(profileId);
        setActionInfo(`Applied runtime composition profile ${profileId}.`);
        return;
      }
      await runtimeComposition.saveSettings((currentSettings: RuntimeCompositionSettingsEntry) => ({
        ...currentSettings,
        selection: {
          ...currentSettings.selection,
          profileId: null,
        },
      }));
      await runtimeComposition.refresh();
      setActionInfo("Cleared the workspace composition profile override.");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update the workspace composition profile."
      );
    }
  }

  async function handleBackendChange(nextBackendId: string) {
    const preferredBackendIds = nextBackendId ? [nextBackendId] : [];
    setActionError(null);
    setActionInfo(null);
    try {
      await runtimeComposition.saveSettings((currentSettings: RuntimeCompositionSettingsEntry) => ({
        ...currentSettings,
        selection: {
          ...currentSettings.selection,
          preferredBackendIds,
        },
      }));
      await runtimeComposition.refresh();
      setActionInfo(
        preferredBackendIds.length > 0
          ? `Saved workspace backend preference ${preferredBackendIds[0]}.`
          : "Cleared the workspace backend preference."
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update the workspace backend preference."
      );
    }
  }

  async function handleRefresh() {
    setActionError(null);
    setActionInfo(null);
    try {
      await runtimeComposition.refresh();
      setActionInfo("Refreshed workspace runtime composition.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to refresh workspace runtime composition."
      );
    }
  }

  async function handlePublish() {
    setActionError(null);
    setActionInfo(null);
    try {
      await runtimeComposition.publishActiveResolution();
      setActionInfo("Published the active runtime composition authority snapshot.");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to publish the runtime composition authority snapshot."
      );
    }
  }

  return (
    <SettingsFieldGroup
      title="Workspace composition & routing"
      subtitle="Choose a workspace-scoped composition profile and backend preference using the shared runtime composition state. Mission Control still shows runtime-confirmed placement for each run."
    >
      {workspaceOptions.length > 1 ? (
        <SettingsField
          label="Workspace"
          help="Pick which workspace-scoped composition defaults to inspect and update."
        >
          <Select
            {...compactSelectProps}
            ariaLabel="Workspace composition workspace"
            options={workspaceOptions.map((workspaceOption) => ({
              value: workspaceOption.id,
              label: workspaceOption.label,
            }))}
            value={selectedWorkspaceId}
            disabled={actionBusy}
            onValueChange={setSelectedWorkspaceId}
          />
        </SettingsField>
      ) : null}

      <SettingsField
        label="Composition profile"
        help="This updates the durable workspace profile selection that shared runtime consumers resolve before launch."
      >
        <Select
          {...compactSelectProps}
          ariaLabel="Composition profile"
          options={profileOptions}
          value={runtimeComposition.settings?.selection.profileId ?? ""}
          disabled={actionBusy}
          onValueChange={(value) => {
            void handleProfileChange(value);
          }}
        />
      </SettingsField>

      <SettingsField label="Workspace backend preference" help={backendPreferenceHelp}>
        <Select
          {...compactSelectProps}
          ariaLabel="Workspace backend preference"
          options={backendOptions}
          value={selectedBackendId}
          disabled={actionBusy}
          onValueChange={(value) => {
            void handleBackendChange(value);
          }}
        />
      </SettingsField>

      <SettingsField
        label="Current authority"
        help="Authority and freshness are runtime-published truth. The settings surface only edits shared defaults and can publish the current snapshot."
      >
        <div>
          <div>{authoritySummary}</div>
          <div>
            Active profile:{" "}
            {runtimeComposition.activeProfile?.name ?? "automatic runtime composition"}
          </div>
        </div>
      </SettingsField>

      <SettingsField
        label="Resolved summary"
        help={`Layer order: ${resolutionSummary.layerSummary}.`}
      >
        <div>
          <div>{resolutionSummary.countsSummary}</div>
          <div>Backend candidates: {resolutionSummary.backendSummary}.</div>
        </div>
      </SettingsField>

      {runtimeComposition.error ? (
        <div className="settings-help settings-help-error">{runtimeComposition.error}</div>
      ) : null}
      {actionError ? <div className="settings-help settings-help-error">{actionError}</div> : null}
      {actionInfo ? <div className="settings-help">{actionInfo}</div> : null}

      <SettingsFooterBar>
        <Button
          variant="secondary"
          size="sm"
          disabled={actionBusy}
          onClick={() => {
            void handleRefresh();
          }}
        >
          Refresh composition
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={actionBusy}
          onClick={() => {
            void handlePublish();
          }}
        >
          Publish authority snapshot
        </Button>
      </SettingsFooterBar>
    </SettingsFieldGroup>
  );
}

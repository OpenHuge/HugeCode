import { useEffect, useState } from "react";
import type { RuntimeCompositionSettingsEntry } from "@ku0/code-platform-interfaces";
import { Button, Select, type SelectOption } from "@ku0/design-system";
import { useSharedRuntimeCompositionState } from "../settings-state";
import { useMaybeWorkspaceClientBindings } from "../workspace/WorkspaceClientBindingsProvider";
import { SettingsField, SettingsFieldGroup, SettingsFooterBar } from "./SettingsSectionGrammar";
import { settingsServerCompactSelectProps } from "./settingsServerControlPlaneShared";
import type { SettingsServerCompactSelectProps } from "./serverControlPlaneTypes";

type SettingsRuntimeCompositionFieldGroupProps = {
  workspaceOptions: Array<{ id: string; label: string }>;
  remoteExecutionBackendOptions: Array<{ id: string; label: string }>;
  defaultRemoteExecutionBackendId: string | null;
  compactSelectProps?: SettingsServerCompactSelectProps;
};

export type { SettingsRuntimeCompositionFieldGroupProps };

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

function summarizeResolution(input: {
  selectedPluginCount: number;
  blockedPluginCount: number;
  routeCandidateCount: number;
  backendCandidates: string[];
  appliedLayerOrder: string[];
}) {
  return {
    backendSummary:
      input.backendCandidates.length > 0 ? input.backendCandidates.join(", ") : "runtime fallback",
    layerSummary:
      input.appliedLayerOrder.length > 0 ? input.appliedLayerOrder.join(" -> ") : "runtime default",
    countsSummary: `Selected plugins ${input.selectedPluginCount}, blocked plugins ${input.blockedPluginCount}, route candidates ${input.routeCandidateCount}.`,
  };
}

function formatTimestamp(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  return new Date(value).toLocaleString();
}

function formatSelectorDecisions(selectorDecisions: Record<string, string>): string {
  const entries = Object.entries(selectorDecisions);
  if (entries.length === 0) {
    return "Runtime defaults";
  }
  return entries.map(([key, value]) => `${key}: ${value}`).join(" | ");
}

export function SettingsRuntimeCompositionFieldGroup({
  workspaceOptions,
  remoteExecutionBackendOptions,
  defaultRemoteExecutionBackendId,
  compactSelectProps = settingsServerCompactSelectProps,
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
    compactSelectProps: SettingsServerCompactSelectProps;
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
  const [previewBusy, setPreviewBusy] = useState(false);
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
  const resolutionSummary = summarizeResolution({
    selectedPluginCount: runtimeComposition.resolution?.selectedPlugins.length ?? 0,
    blockedPluginCount: runtimeComposition.resolution?.blockedPlugins.length ?? 0,
    routeCandidateCount: runtimeComposition.resolution?.selectedRouteCandidates.length ?? 0,
    backendCandidates:
      runtimeComposition.resolution?.selectedBackendCandidates.map(
        (candidate) => candidate.backendId
      ) ?? [],
    appliedLayerOrder: runtimeComposition.resolution?.provenance.appliedLayerOrder ?? [],
  });
  const authoritySummary = runtimeComposition.snapshot
    ? `${runtimeComposition.snapshot.authorityState} / ${runtimeComposition.snapshot.freshnessState}`
    : "unavailable";
  const persistence = runtimeComposition.settings?.persistence ?? null;
  const previewSummary = runtimeComposition.previewResolution
    ? summarizeResolution({
        selectedPluginCount: runtimeComposition.previewResolution.selectedPlugins.length,
        blockedPluginCount: runtimeComposition.previewResolution.blockedPlugins.length,
        routeCandidateCount: runtimeComposition.previewResolution.selectedRouteCandidates.length,
        backendCandidates: runtimeComposition.previewResolution.selectedBackendCandidates.map(
          (candidate) => candidate.backendId
        ),
        appliedLayerOrder: runtimeComposition.previewResolution.provenance.appliedLayerOrder ?? [],
      })
    : null;
  const previewProfileOptions: SelectOption[] = [
    { value: "", label: "No preview" },
    ...runtimeComposition.profiles.map((profile) => ({
      value: profile.id,
      label: `${profile.name} (${profile.scope})`,
    })),
  ];
  const activeSelectorDecisions = formatSelectorDecisions(
    runtimeComposition.resolution?.provenance.selectorDecisions ?? {}
  );
  const previewSelectorDecisions = formatSelectorDecisions(
    runtimeComposition.previewResolution?.provenance.selectorDecisions ?? {}
  );
  const actionBusy = runtimeComposition.isLoading || runtimeComposition.isMutating || previewBusy;

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

  async function handlePreviewChange(profileId: string) {
    setActionError(null);
    setActionInfo(null);
    setPreviewBusy(true);
    try {
      if (!profileId) {
        runtimeComposition.clearPreview();
        setActionInfo("Cleared the previewed runtime composition profile.");
        return;
      }
      await runtimeComposition.previewProfile(profileId);
      setActionInfo(`Previewed runtime composition profile ${profileId}.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to preview the runtime composition profile."
      );
    } finally {
      setPreviewBusy(false);
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

      <SettingsField
        label="Selector provenance"
        help="Inspect the active layer order and selector decisions from the shared runtime resolver instead of inferring effective routing locally."
      >
        <div>
          <div>Layer order: {resolutionSummary.layerSummary}</div>
          <div>Selector decisions: {activeSelectorDecisions}</div>
        </div>
      </SettingsField>

      <SettingsField
        label="Published persistence"
        help="These durable settings track which session last published authority and which revision the workspace accepted."
      >
        <div>
          <div>Publisher session: {persistence?.publisherSessionId ?? "Not published yet"}</div>
          <div>
            Accepted authority revision:{" "}
            {persistence?.lastAcceptedAuthorityRevision ?? "Not recorded"}
          </div>
          <div>Last publish attempt: {formatTimestamp(persistence?.lastPublishAttemptAt)}</div>
          <div>Last published: {formatTimestamp(persistence?.lastPublishedAt)}</div>
        </div>
      </SettingsField>

      <SettingsField
        label="Preview profile"
        help="Preview another workspace profile and inspect its effective routing and provenance before applying it."
      >
        <Select
          {...compactSelectProps}
          ariaLabel="Preview profile"
          options={previewProfileOptions}
          value={runtimeComposition.previewProfileId ?? ""}
          disabled={actionBusy}
          onValueChange={(value) => {
            void handlePreviewChange(value);
          }}
        />
      </SettingsField>

      {previewSummary ? (
        <SettingsField
          label="Previewed effective state"
          help={`Preview layer order: ${previewSummary.layerSummary}.`}
        >
          <div>
            <div>
              Preview profile:{" "}
              {runtimeComposition.previewSnapshot?.activeProfile?.name ??
                runtimeComposition.previewProfileId}
            </div>
            <div>{previewSummary.countsSummary}</div>
            <div>Backend candidates: {previewSummary.backendSummary}.</div>
            <div>Selector decisions: {previewSelectorDecisions}</div>
            <div>
              Preview authority:{" "}
              {runtimeComposition.previewSnapshot
                ? `${runtimeComposition.previewSnapshot.authorityState} / ${runtimeComposition.previewSnapshot.freshnessState}`
                : "unavailable"}
            </div>
          </div>
        </SettingsField>
      ) : null}

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
          disabled={actionBusy || runtimeComposition.previewProfileId === null}
          onClick={() => {
            runtimeComposition.clearPreview();
            setActionError(null);
            setActionInfo("Cleared the previewed runtime composition profile.");
          }}
        >
          Clear preview
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

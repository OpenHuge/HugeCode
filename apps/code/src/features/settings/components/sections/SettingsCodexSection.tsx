import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Select, type SelectOption } from "../../../../design-system";
import { getProvidersCatalog } from "../../../../application/runtime/ports/oauth";
import { useRuntimeUpdatedRefresh } from "../../../app/hooks/useRuntimeUpdatedRefresh";
import type { RuntimeProviderCatalogEntry } from "../../../../contracts/runtime";
import type {
  AppSettings,
  CodexDoctorResult,
  CodexUpdateResult,
  ModelOption,
  WorkspaceInfo,
} from "../../../../types";
import { normalizePathForDisplay } from "../../../../utils/platformPaths";
import { FileEditorCard } from "../../../shared/components/FileEditorCard";
import { ModelProviderPicker } from "../../../models/components/ModelProviderPicker";
import { mergeModelsWithProviderCatalogMetadata } from "../../../models/utils/providerCatalogMetadata";
import {
  getModelReasoningOptions,
  normalizeEffortValue,
  supportsModelReasoning,
} from "../../../models/utils/modelOptionCapabilities";
import {
  buildModelProviderOptions,
  resolveAutoModelProviderSelection,
  resolveModelProviderId,
  resolveSelectedProviderId,
} from "../../../models/utils/modelProviderSelection";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
  SettingsFooterBar,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import { SettingsCodexAccountsCard } from "./SettingsCodexAccountsCard";
import * as styles from "./SettingsCodexSection.css";

type SettingsCodexSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  defaultModels: ModelOption[];
  defaultModelsLoading: boolean;
  defaultModelsError: string | null;
  defaultModelsConnectedWorkspaceCount: number;
  onRefreshDefaultModels: () => void;
  codexPathDraft: string;
  codexArgsDraft: string;
  codexDirty: boolean;
  isSavingSettings: boolean;
  doctorState: {
    status: "idle" | "running" | "done";
    result: CodexDoctorResult | null;
  };
  codexUpdateState: {
    status: "idle" | "running" | "done";
    result: CodexUpdateResult | null;
  };
  globalAgentsMeta: string;
  globalAgentsError: string | null;
  globalAgentsContent: string;
  globalAgentsLoading: boolean;
  globalAgentsRefreshDisabled: boolean;
  globalAgentsSaveDisabled: boolean;
  globalAgentsSaveLabel: string;
  globalConfigMeta: string;
  globalConfigError: string | null;
  globalConfigContent: string;
  globalConfigLoading: boolean;
  globalConfigRefreshDisabled: boolean;
  globalConfigSaveDisabled: boolean;
  globalConfigSaveLabel: string;
  projects: WorkspaceInfo[];
  codexBinOverrideDrafts: Record<string, string>;
  codexHomeOverrideDrafts: Record<string, string>;
  codexArgsOverrideDrafts: Record<string, string>;
  onSetCodexPathDraft: Dispatch<SetStateAction<string>>;
  onSetCodexArgsDraft: Dispatch<SetStateAction<string>>;
  onSetGlobalAgentsContent: (value: string) => void;
  onSetGlobalConfigContent: (value: string) => void;
  onSetCodexBinOverrideDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onSetCodexHomeOverrideDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onSetCodexArgsOverrideDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onBrowseCodex: () => Promise<void>;
  onSaveCodexSettings: () => Promise<void>;
  onRunDoctor: () => Promise<void>;
  onRunCodexUpdate: () => Promise<void>;
  onRefreshGlobalAgents: () => void;
  onSaveGlobalAgents: () => void;
  onRefreshGlobalConfig: () => void;
  onSaveGlobalConfig: () => void;
  onUpdateWorkspaceCodexBin: (id: string, codexBin: string | null) => Promise<void>;
  onUpdateWorkspaceSettings: (
    id: string,
    settings: Partial<WorkspaceInfo["settings"]>
  ) => Promise<void>;
};

const normalizeOverrideValue = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const DEFAULT_REASONING_EFFORT = "high";
const accessModeOptions: SelectOption[] = [
  { value: "read-only", label: "Read only" },
  { value: "on-request", label: "On-request" },
  { value: "full-access", label: "Full access" },
];
const reviewModeOptions: SelectOption[] = [
  { value: "inline", label: "Inline (same thread)" },
  { value: "detached", label: "Detached (new review thread)" },
];
function coerceSavedModelSelectionId(value: string | null, models: ModelOption[]): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const byId = models.find((model) => model.id === trimmed);
  if (byId) {
    return byId.id;
  }
  const bySlug = models.find((model) => model.model === trimmed);
  return bySlug ? bySlug.id : null;
}

export function SettingsCodexSection({
  appSettings,
  onUpdateAppSettings,
  defaultModels,
  defaultModelsLoading,
  defaultModelsError,
  defaultModelsConnectedWorkspaceCount,
  onRefreshDefaultModels,
  codexPathDraft,
  codexArgsDraft,
  codexDirty,
  isSavingSettings,
  doctorState,
  codexUpdateState,
  globalAgentsMeta,
  globalAgentsError,
  globalAgentsContent,
  globalAgentsLoading,
  globalAgentsRefreshDisabled,
  globalAgentsSaveDisabled,
  globalAgentsSaveLabel,
  globalConfigMeta,
  globalConfigError,
  globalConfigContent,
  globalConfigLoading,
  globalConfigRefreshDisabled,
  globalConfigSaveDisabled,
  globalConfigSaveLabel,
  projects,
  codexBinOverrideDrafts,
  codexHomeOverrideDrafts,
  codexArgsOverrideDrafts,
  onSetCodexPathDraft,
  onSetCodexArgsDraft,
  onSetGlobalAgentsContent,
  onSetGlobalConfigContent,
  onSetCodexBinOverrideDrafts,
  onSetCodexHomeOverrideDrafts,
  onSetCodexArgsOverrideDrafts,
  onBrowseCodex,
  onSaveCodexSettings,
  onRunDoctor,
  onRunCodexUpdate,
  onRefreshGlobalAgents,
  onSaveGlobalAgents,
  onRefreshGlobalConfig,
  onSaveGlobalConfig,
  onUpdateWorkspaceCodexBin,
  onUpdateWorkspaceSettings,
}: SettingsCodexSectionProps) {
  const [providerCatalog, setProviderCatalog] = useState<RuntimeProviderCatalogEntry[]>([]);
  const selectionMode = appSettings.composerModelSelectionMode ?? "auto";

  const refreshProviderCatalog = useCallback(async () => {
    try {
      setProviderCatalog(await getProvidersCatalog());
    } catch {
      setProviderCatalog([]);
    }
  }, []);

  useEffect(() => {
    void refreshProviderCatalog();
  }, [refreshProviderCatalog]);

  useRuntimeUpdatedRefresh({
    scopes: ["bootstrap", "models", "oauth"],
    onRefresh: () => {
      void refreshProviderCatalog();
    },
  });

  const modelsWithProviderMetadata = useMemo(
    () => mergeModelsWithProviderCatalogMetadata(defaultModels, providerCatalog),
    [defaultModels, providerCatalog]
  );
  const savedModelId = useMemo(
    () => coerceSavedModelSelectionId(appSettings.lastComposerModelId, modelsWithProviderMetadata),
    [appSettings.lastComposerModelId, modelsWithProviderMetadata]
  );
  const providerOptions = useMemo(
    () => buildModelProviderOptions(modelsWithProviderMetadata),
    [modelsWithProviderMetadata]
  );
  const recommendedSelection = useMemo(
    () =>
      resolveAutoModelProviderSelection(
        providerOptions,
        appSettings.lastComposerProviderFamilyId ?? null,
        null
      ),
    [appSettings.lastComposerProviderFamilyId, providerOptions]
  );
  const fallbackSelectedModelId = savedModelId ?? recommendedSelection.modelId ?? null;
  const autoSelection = useMemo(
    () =>
      resolveAutoModelProviderSelection(
        providerOptions,
        appSettings.lastComposerProviderFamilyId ?? null,
        fallbackSelectedModelId
      ),
    [appSettings.lastComposerProviderFamilyId, fallbackSelectedModelId, providerOptions]
  );
  const selectedModelId =
    (selectionMode === "auto" ? autoSelection.modelId : fallbackSelectedModelId) ?? "";
  const selectedModel = useMemo(
    () =>
      modelsWithProviderMetadata.find((model) => model.id === selectedModelId) ??
      modelsWithProviderMetadata.find((model) => model.model === selectedModelId) ??
      null,
    [modelsWithProviderMetadata, selectedModelId]
  );
  const resolvedModelProviderId = selectedModel
    ? resolveModelProviderId(selectedModel)
    : resolveSelectedProviderId(providerOptions, selectedModelId);
  const selectedProviderId = useMemo(
    () =>
      selectionMode === "auto"
        ? autoSelection.providerId
        : (appSettings.lastComposerProviderFamilyId ?? resolvedModelProviderId),
    [
      autoSelection.providerId,
      appSettings.lastComposerProviderFamilyId,
      providerOptions,
      resolvedModelProviderId,
      selectionMode,
    ]
  );
  const selectedProvider = useMemo(
    () => providerOptions.find((option) => option.id === selectedProviderId) ?? null,
    [providerOptions, selectedProviderId]
  );
  const selectedRouteReadinessMessage =
    selectedModel?.providerReadinessMessage ?? selectedProvider?.readinessMessage ?? null;
  const reasoningSupported = useMemo(() => supportsModelReasoning(selectedModel), [selectedModel]);
  const reasoningOptions = useMemo(() => getModelReasoningOptions(selectedModel), [selectedModel]);
  const reasoningSelectOptions = useMemo<SelectOption[]>(
    () => reasoningOptions.map((effort) => ({ value: effort, label: effort })),
    [reasoningOptions]
  );
  const savedEffort = useMemo(
    () => normalizeEffortValue(appSettings.lastComposerReasoningEffort),
    [appSettings.lastComposerReasoningEffort]
  );
  const selectedEffort = useMemo(() => {
    if (!reasoningSupported) {
      return "";
    }
    if (savedEffort && reasoningOptions.includes(savedEffort)) {
      return savedEffort;
    }
    if (reasoningOptions.includes(DEFAULT_REASONING_EFFORT)) {
      return DEFAULT_REASONING_EFFORT;
    }
    const fallback = normalizeEffortValue(selectedModel?.defaultReasoningEffort);
    if (fallback && reasoningOptions.includes(fallback)) {
      return fallback;
    }
    return reasoningOptions[0] ?? "";
  }, [reasoningOptions, reasoningSupported, savedEffort, selectedModel]);

  const didNormalizeDefaultsRef = useRef(false);
  useEffect(() => {
    if (didNormalizeDefaultsRef.current) {
      return;
    }
    if (!modelsWithProviderMetadata.length) {
      return;
    }
    const savedRawModel = (appSettings.lastComposerModelId ?? "").trim();
    const savedRawEffort = (appSettings.lastComposerReasoningEffort ?? "").trim();
    const shouldNormalizeModel = savedRawModel.length === 0 || savedModelId === null;
    const shouldNormalizeSelectionMode =
      appSettings.composerModelSelectionMode !== "auto" &&
      appSettings.composerModelSelectionMode !== "manual";
    const shouldNormalizeProviderFamily =
      typeof appSettings.lastComposerProviderFamilyId !== "string" && selectedProviderId !== null;
    const shouldNormalizeEffort =
      reasoningSupported &&
      (savedRawEffort.length === 0 ||
        savedEffort === null ||
        !reasoningOptions.includes(savedEffort));
    if (
      !shouldNormalizeModel &&
      !shouldNormalizeEffort &&
      !shouldNormalizeSelectionMode &&
      !shouldNormalizeProviderFamily
    ) {
      didNormalizeDefaultsRef.current = true;
      return;
    }

    const next: AppSettings = {
      ...appSettings,
      lastComposerModelId: shouldNormalizeModel ? selectedModelId : appSettings.lastComposerModelId,
      lastComposerReasoningEffort: shouldNormalizeEffort
        ? selectedEffort
        : appSettings.lastComposerReasoningEffort,
      composerModelSelectionMode: shouldNormalizeSelectionMode
        ? "auto"
        : appSettings.composerModelSelectionMode,
      lastComposerProviderFamilyId: shouldNormalizeProviderFamily
        ? (selectedProviderId as AppSettings["lastComposerProviderFamilyId"])
        : appSettings.lastComposerProviderFamilyId,
    };
    didNormalizeDefaultsRef.current = true;
    void onUpdateAppSettings(next).catch(() => undefined);
  }, [
    appSettings,
    appSettings.composerModelSelectionMode,
    appSettings.lastComposerProviderFamilyId,
    modelsWithProviderMetadata.length,
    onUpdateAppSettings,
    reasoningOptions,
    reasoningSupported,
    savedEffort,
    savedModelId,
    selectedModelId,
    selectedEffort,
    selectedProviderId,
  ]);

  return (
    <SettingsSectionFrame
      title="Codex"
      subtitle="Configure the Codex CLI used by CodexMonitor and validate the install."
    >
      <SettingsFieldGroup
        title="CLI defaults"
        subtitle="Set the default Codex binary, startup args, and validation actions used by the app."
      >
        <SettingsField
          label="Default Codex path"
          htmlFor="codex-path"
          help="Leave empty to use the system PATH resolution."
        >
          <Input
            id="codex-path"
            fieldClassName={styles.inputField}
            inputSize="md"
            value={codexPathDraft}
            placeholder="codex"
            onValueChange={onSetCodexPathDraft}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void onBrowseCodex();
            }}
          >
            Browse
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSetCodexPathDraft("")}>
            Use PATH
          </Button>
        </SettingsField>

        <SettingsField
          label="Default Codex args"
          htmlFor="codex-args"
          help={
            <>
              Extra flags passed before <code>app-server</code>. Use quotes for values with spaces.
            </>
          }
        >
          <Input
            id="codex-args"
            fieldClassName={styles.inputField}
            inputSize="md"
            value={codexArgsDraft}
            placeholder="--profile personal"
            onValueChange={onSetCodexArgsDraft}
          />
          <Button variant="ghost" size="sm" onClick={() => onSetCodexArgsDraft("")}>
            Clear
          </Button>
        </SettingsField>

        <SettingsField label="Validation and update actions">
          <SettingsFooterBar>
            {codexDirty ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void onSaveCodexSettings();
                }}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? "Saving..." : "Save"}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="settings-button-compact"
              onClick={() => {
                void onRunDoctor();
              }}
              disabled={doctorState.status === "running"}
            >
              <Stethoscope aria-hidden />
              {doctorState.status === "running" ? "Running..." : "Run doctor"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="settings-button-compact"
              onClick={() => {
                void onRunCodexUpdate();
              }}
              disabled={codexUpdateState.status === "running"}
              title="Update Codex"
            >
              <Stethoscope aria-hidden />
              {codexUpdateState.status === "running" ? "Updating..." : "Update"}
            </Button>
          </SettingsFooterBar>

          {doctorState.result ? (
            <div
              className={`${styles.doctor} ${doctorState.result.ok ? styles.doctorState.ok : styles.doctorState.error}`}
            >
              <div className={styles.doctorTitle}>
                {doctorState.result.ok ? "Codex looks good" : "Codex issue detected"}
              </div>
              <div className={styles.doctorBody}>
                <div>Version: {doctorState.result.version ?? "unknown"}</div>
                <div>App-server: {doctorState.result.appServerOk ? "ok" : "failed"}</div>
                <div>
                  Node:{" "}
                  {doctorState.result.nodeOk
                    ? `ok (${doctorState.result.nodeVersion ?? "unknown"})`
                    : "missing"}
                </div>
                {doctorState.result.details ? <div>{doctorState.result.details}</div> : null}
                {doctorState.result.nodeDetails ? (
                  <div>{doctorState.result.nodeDetails}</div>
                ) : null}
                {doctorState.result.path ? (
                  <div className={styles.doctorPath}>PATH: {doctorState.result.path}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {codexUpdateState.result ? (
            <div
              className={`${styles.doctor} ${codexUpdateState.result.ok ? styles.doctorState.ok : styles.doctorState.error}`}
            >
              <div className={styles.doctorTitle}>
                {codexUpdateState.result.ok
                  ? codexUpdateState.result.upgraded
                    ? "Codex updated"
                    : "Codex already up-to-date"
                  : "Codex update failed"}
              </div>
              <div className={styles.doctorBody}>
                <div>Method: {codexUpdateState.result.method}</div>
                {codexUpdateState.result.package ? (
                  <div>Package: {codexUpdateState.result.package}</div>
                ) : null}
                <div>
                  Version:{" "}
                  {codexUpdateState.result.afterVersion ??
                    codexUpdateState.result.beforeVersion ??
                    "unknown"}
                </div>
                {codexUpdateState.result.details ? (
                  <div>{codexUpdateState.result.details}</div>
                ) : null}
                {codexUpdateState.result.output ? (
                  <details>
                    <summary>output</summary>
                    <pre>{codexUpdateState.result.output}</pre>
                  </details>
                ) : null}
              </div>
            </div>
          ) : null}
        </SettingsField>
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Accounts"
        subtitle="Manage provider accounts and pools used by Codex routing and account selection."
      >
        <SettingsCodexAccountsCard />
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Default parameters"
        subtitle="Choose the model, reasoning, and access defaults used when threads do not override them."
      >
        <SettingsControlRow
          title="Provider / Model"
          subtitle={
            defaultModelsConnectedWorkspaceCount === 0
              ? "Connect a project to load available models."
              : defaultModelsLoading
                ? "Loading models…"
                : defaultModelsError
                  ? `Couldn’t load models: ${defaultModelsError}`
                  : selectedRouteReadinessMessage
                    ? selectedRouteReadinessMessage
                    : "Choose provider and model together when there is no thread-specific override."
          }
          control={
            <div className={styles.controlRow}>
              <ModelProviderPicker
                ariaLabel="Model"
                providerOptions={providerOptions}
                selectionMode={selectionMode}
                selectedProviderId={selectedProviderId}
                selectedModelId={selectedModelId}
                onSelectAutoRoute={(providerId) =>
                  void onUpdateAppSettings({
                    ...appSettings,
                    composerModelSelectionMode: "auto",
                    lastComposerProviderFamilyId:
                      (providerId as AppSettings["lastComposerProviderFamilyId"]) ??
                      appSettings.lastComposerProviderFamilyId ??
                      (resolvedModelProviderId as AppSettings["lastComposerProviderFamilyId"]) ??
                      null,
                  })
                }
                onSelectProvider={(providerId) =>
                  void onUpdateAppSettings({
                    ...appSettings,
                    lastComposerProviderFamilyId:
                      providerId as AppSettings["lastComposerProviderFamilyId"],
                  })
                }
                disabled={!providerOptions.length || defaultModelsLoading}
                fullWidth
                className={styles.selectRoot}
                triggerClassName={styles.selectTrigger}
                onSelectModel={(modelId) =>
                  void onUpdateAppSettings({
                    ...appSettings,
                    lastComposerModelId: modelId,
                    composerModelSelectionMode: "manual",
                    lastComposerProviderFamilyId:
                      (resolveModelProviderId(
                        modelsWithProviderMetadata.find((model) => model.id === modelId) ?? {
                          id: modelId,
                          model: modelId,
                          displayName: modelId,
                          description: "",
                          supportedReasoningEfforts: [],
                          defaultReasoningEffort: null,
                          isDefault: false,
                        }
                      ) as AppSettings["lastComposerProviderFamilyId"]) ?? null,
                  })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefreshDefaultModels}
                disabled={defaultModelsLoading || defaultModelsConnectedWorkspaceCount === 0}
              >
                Refresh
              </Button>
            </div>
          }
        />

        <SettingsControlRow
          title="Reasoning effort"
          subtitle={
            reasoningSupported
              ? "Available options depend on the selected model."
              : "The selected model does not expose reasoning effort options."
          }
          control={
            <Select
              className={styles.selectRoot}
              triggerClassName={styles.selectTrigger}
              menuClassName={styles.selectMenu}
              optionClassName={styles.selectOption}
              ariaLabel="Reasoning effort"
              options={
                reasoningSupported
                  ? reasoningSelectOptions
                  : [{ value: "", label: "not supported", disabled: true }]
              }
              value={selectedEffort}
              onValueChange={(effort) =>
                void onUpdateAppSettings({
                  ...appSettings,
                  lastComposerReasoningEffort: effort,
                })
              }
              disabled={!reasoningSupported}
            />
          }
        />

        <SettingsControlRow
          title="Access mode"
          subtitle="Used when there is no thread-specific override."
          control={
            <Select
              className={styles.selectRoot}
              triggerClassName={styles.selectTrigger}
              menuClassName={styles.selectMenu}
              optionClassName={styles.selectOption}
              ariaLabel="Access mode"
              options={accessModeOptions}
              value={appSettings.defaultAccessMode}
              onValueChange={(defaultAccessMode) =>
                void onUpdateAppSettings({
                  ...appSettings,
                  defaultAccessMode: defaultAccessMode as AppSettings["defaultAccessMode"],
                })
              }
            />
          }
        />

        <SettingsField
          label="Review mode"
          help={
            <>
              Choose whether <code>/review</code> runs in the current thread or a detached review
              thread.
            </>
          }
        >
          <Select
            className={styles.selectRoot}
            triggerClassName={styles.selectTrigger}
            menuClassName={styles.selectMenu}
            optionClassName={styles.selectOption}
            ariaLabel="Review mode"
            options={reviewModeOptions}
            value={appSettings.reviewDeliveryMode}
            onValueChange={(reviewDeliveryMode) =>
              void onUpdateAppSettings({
                ...appSettings,
                reviewDeliveryMode: reviewDeliveryMode as AppSettings["reviewDeliveryMode"],
              })
            }
          />
        </SettingsField>
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Global agent files"
        subtitle="Edit the repo-wide AGENTS and config defaults that shape Codex behavior."
      >
        <FileEditorCard
          title="Global AGENTS.md"
          meta={globalAgentsMeta}
          error={globalAgentsError}
          value={globalAgentsContent}
          placeholder="Add global instructions for Codex agents…"
          disabled={globalAgentsLoading}
          refreshDisabled={globalAgentsRefreshDisabled}
          saveDisabled={globalAgentsSaveDisabled}
          saveLabel={globalAgentsSaveLabel}
          onChange={onSetGlobalAgentsContent}
          onRefresh={onRefreshGlobalAgents}
          onSave={onSaveGlobalAgents}
          helpText={
            <>
              Stored at <code>~/.codex/AGENTS.md</code>.
            </>
          }
          classNames={{
            container: "settings-field settings-agents",
            header: "settings-agents-header",
            title: "settings-field-label",
            actions: "settings-agents-actions",
            meta: "settings-help settings-help-inline",
            iconButton: "settings-icon-button",
            error: "settings-agents-error",
            textareaField: styles.textareaField,
            textarea: styles.textarea,
            help: "settings-help",
          }}
        />

        <FileEditorCard
          title="Global config.toml"
          meta={globalConfigMeta}
          error={globalConfigError}
          value={globalConfigContent}
          placeholder="Edit the global Codex config.toml…"
          disabled={globalConfigLoading}
          refreshDisabled={globalConfigRefreshDisabled}
          saveDisabled={globalConfigSaveDisabled}
          saveLabel={globalConfigSaveLabel}
          onChange={onSetGlobalConfigContent}
          onRefresh={onRefreshGlobalConfig}
          onSave={onSaveGlobalConfig}
          helpText={
            <>
              Stored at <code>CODEX_HOME/config.toml</code> and defaults to{" "}
              <code>~/.codex/config.toml</code>.
            </>
          }
          classNames={{
            container: "settings-field settings-agents",
            header: "settings-agents-header",
            title: "settings-field-label",
            actions: "settings-agents-actions",
            meta: "settings-help settings-help-inline",
            iconButton: "settings-icon-button",
            error: "settings-agents-error",
            textareaField: styles.textareaField,
            textarea: styles.textarea,
            help: "settings-help",
          }}
        />
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Workspace overrides"
        subtitle="Override the global Codex binary, CODEX_HOME, and args per connected workspace."
      >
        <div className={styles.overrideList}>
          {projects.map((workspace) => (
            <SettingsField
              key={workspace.id}
              label={workspace.name}
              help={normalizePathForDisplay(workspace.path)}
            >
              <div className={styles.overrideActions}>
                <div className={styles.overrideField}>
                  <Input
                    fieldClassName={`${styles.inputField} ${styles.inputFieldCompact}`}
                    inputSize="sm"
                    value={codexBinOverrideDrafts[workspace.id] ?? ""}
                    placeholder="Codex binary override"
                    onValueChange={(codexBin) =>
                      onSetCodexBinOverrideDrafts((prev) => ({
                        ...prev,
                        [workspace.id]: codexBin,
                      }))
                    }
                    onBlur={async () => {
                      const draft = codexBinOverrideDrafts[workspace.id] ?? "";
                      const nextValue = normalizeOverrideValue(draft);
                      if (nextValue === (workspace.codex_bin ?? null)) {
                        return;
                      }
                      await onUpdateWorkspaceCodexBin(workspace.id, nextValue);
                    }}
                    aria-label={`Codex binary override for ${workspace.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      onSetCodexBinOverrideDrafts((prev) => ({
                        ...prev,
                        [workspace.id]: "",
                      }));
                      await onUpdateWorkspaceCodexBin(workspace.id, null);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className={styles.overrideField}>
                  <Input
                    fieldClassName={`${styles.inputField} ${styles.inputFieldCompact}`}
                    inputSize="sm"
                    value={codexHomeOverrideDrafts[workspace.id] ?? ""}
                    placeholder="CODEX_HOME override"
                    onValueChange={(codexHome) =>
                      onSetCodexHomeOverrideDrafts((prev) => ({
                        ...prev,
                        [workspace.id]: codexHome,
                      }))
                    }
                    onBlur={async () => {
                      const draft = codexHomeOverrideDrafts[workspace.id] ?? "";
                      const nextValue = normalizeOverrideValue(draft);
                      if (nextValue === (workspace.settings.codexHome ?? null)) {
                        return;
                      }
                      await onUpdateWorkspaceSettings(workspace.id, {
                        codexHome: nextValue,
                      });
                    }}
                    aria-label={`CODEX_HOME override for ${workspace.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      onSetCodexHomeOverrideDrafts((prev) => ({
                        ...prev,
                        [workspace.id]: "",
                      }));
                      await onUpdateWorkspaceSettings(workspace.id, {
                        codexHome: null,
                      });
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className={styles.overrideField}>
                  <Input
                    fieldClassName={`${styles.inputField} ${styles.inputFieldCompact}`}
                    inputSize="sm"
                    value={codexArgsOverrideDrafts[workspace.id] ?? ""}
                    placeholder="Codex args override"
                    onValueChange={(codexArgs) =>
                      onSetCodexArgsOverrideDrafts((prev) => ({
                        ...prev,
                        [workspace.id]: codexArgs,
                      }))
                    }
                    onBlur={async () => {
                      const draft = codexArgsOverrideDrafts[workspace.id] ?? "";
                      const nextValue = normalizeOverrideValue(draft);
                      if (nextValue === (workspace.settings.codexArgs ?? null)) {
                        return;
                      }
                      await onUpdateWorkspaceSettings(workspace.id, {
                        codexArgs: nextValue,
                      });
                    }}
                    aria-label={`Codex args override for ${workspace.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      onSetCodexArgsOverrideDrafts((prev) => ({
                        ...prev,
                        [workspace.id]: "",
                      }));
                      await onUpdateWorkspaceSettings(workspace.id, {
                        codexArgs: null,
                      });
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </SettingsField>
          ))}
          {projects.length === 0 ? <div className="settings-empty">No projects yet.</div> : null}
        </div>
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}

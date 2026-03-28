import { canonicalizeModelPool } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import type { RuntimeProviderCatalogEntry } from "@ku0/code-runtime-host-contract";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildMissionDraftFromThreadState } from "../../../application/runtime/facades/runtimeMissionDraftFacade";
import {
  resolveRuntimeModelProviderRoute,
  type RuntimeResolvedProviderRoute,
} from "../../../application/runtime/facades/runtimeProviderRouting";
import { resolveRuntimePreferredBackendIdsInput } from "../../../application/runtime/facades/runtimeRemoteExecutionFacade";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import {
  type OAuthAccountSummary,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPools,
  replaceOAuthPoolMembers,
  setOAuthPrimaryAccount,
  upsertOAuthPool,
} from "../../../application/runtime/ports/tauriOauth";
import { runCodexDoctor } from "../../../application/runtime/ports/tauriCodexOperations";
import type {
  AccessMode,
  AppSettings,
  ComposerExecutionMode,
  ComposerModelSelectionMode,
  DebugEntry,
  ModelProviderFamilyId,
  WorkspaceInfo,
} from "../../../types";
import { useCollaborationModes } from "../../collaboration/hooks/useCollaborationModes";
import { useComposerMenuActions } from "../../composer/hooks/useComposerMenuActions";
import { useComposerShortcuts } from "../../composer/hooks/useComposerShortcuts";
import { useModels } from "../../models/hooks/useModels";
import { resolveModelVisionCapabilitySupport } from "../../models/utils/modelOptionCapabilities";
import { resolveModelProviderId } from "../../models/utils/modelProviderSelection";
import { resolveModelBrandLabel } from "../utils/antiGravityBranding";
import { NO_THREAD_SCOPE_SUFFIX } from "../../threads/utils/threadCodexParamsSeed";
import type { ThreadCodexParamsPatch } from "../../threads/hooks/useThreadCodexParams";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../../../utils/runtimeWorkspaceIds";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";

type ComposerAccountOption = {
  id: string;
  label: string;
  status: OAuthAccountSummary["status"];
};

type ComposerExecutionOption = {
  value: ComposerExecutionMode;
  label: string;
  disabled?: boolean;
};

type RemoteBackendOption = {
  value: string;
  label: string;
};

const LOCAL_CODEX_CLI_LABEL = "Local Codex CLI";
const LOCAL_CODEX_CLI_UNAVAILABLE_LABEL = `${LOCAL_CODEX_CLI_LABEL} unavailable`;
const HYBRID_UNAVAILABLE_LABEL = "Hybrid (Local Codex CLI unavailable)";

function normalizeModelSelectionId(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProviderFamilyId(value: string | null): ModelProviderFamilyId | null {
  if (typeof value !== "string") {
    return null;
  }
  switch (value.trim().toLowerCase()) {
    case "codex":
      return "codex";
    case "claude":
      return "claude";
    case "gemini":
      return "gemini";
    case "antigravity":
      return "antigravity";
    default:
      return null;
  }
}

function formatComposerAccountLabel(account: OAuthAccountSummary): string {
  const display = typeof account.displayName === "string" ? account.displayName.trim() : "";
  const email = typeof account.email === "string" ? account.email.trim() : "";
  if (display && email) {
    if (display.toLowerCase() === email.toLowerCase()) {
      return email;
    }
    return `${display} (${email})`;
  }
  if (display) {
    return display;
  }
  if (email) {
    return email;
  }
  return account.accountId;
}

function buildPoolMembers(accountIds: readonly string[]) {
  return accountIds.map((accountId, index) => ({
    accountId,
    weight: 1,
    priority: index,
    position: index,
    enabled: true,
  }));
}

function normalizeRemoteBackendOptions(value: unknown): RemoteBackendOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const backendId =
      typeof record.backendId === "string"
        ? record.backendId.trim()
        : typeof record.backend_id === "string"
          ? record.backend_id.trim()
          : "";
    if (!backendId) {
      return [];
    }
    const label =
      typeof record.displayName === "string"
        ? record.displayName.trim()
        : typeof record.display_name === "string"
          ? record.display_name.trim()
          : typeof record.label === "string"
            ? record.label.trim()
            : "";
    return [{ value: backendId, label: label || backendId }];
  });
}

type UseThreadCodexControlsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  appSettings: AppSettings;
  appSettingsLoading: boolean;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
  addDebugEntry: (entry: DebugEntry) => void;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  activeWorkspaceIdForParamsRef: RefObject<string | null>;
  activeThreadIdRef: RefObject<string | null>;
  visibleActiveThreadIdRef: RefObject<string | null>;
  getThreadCodexParams: (
    workspaceId: string,
    threadId: string
  ) => {
    modelId: string | null;
    effort: string | null;
    selectionMode?: ComposerModelSelectionMode | null;
    providerFamilyId?: ModelProviderFamilyId | null;
    accessMode: AccessMode | null;
    collaborationModeId: string | null;
    executionProfileId?: string | null;
    preferredBackendIds?: string[] | null;
    autoDriveDraft?: AutoDriveControllerHookDraft | null;
  } | null;
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadCodexParamsPatch
  ) => void;
};

export function useThreadCodexControls({
  activeWorkspace,
  appSettings,
  appSettingsLoading,
  setAppSettings,
  queueSaveSettings,
  addDebugEntry,
  composerInputRef,
  activeWorkspaceIdForParamsRef,
  activeThreadIdRef,
  visibleActiveThreadIdRef,
  getThreadCodexParams,
  patchThreadCodexParams,
}: UseThreadCodexControlsOptions) {
  const [accessMode, setAccessMode] = useState<AccessMode>("full-access");
  const [preferredModelId, setPreferredModelId] = useState<string | null>(null);
  const [preferredEffort, setPreferredEffort] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<ComposerModelSelectionMode>("auto");
  const [preferredProviderFamilyId, setPreferredProviderFamilyId] =
    useState<ModelProviderFamilyId | null>(null);
  const [preferredFastMode, setPreferredFastMode] = useState(false);
  const [preferredCollabModeId, setPreferredCollabModeId] = useState<string | null>(null);
  const [threadCodexSelectionKey, setThreadCodexSelectionKey] = useState<string | null>(null);
  const [autoSelectionNeedsVision, setAutoSelectionNeedsVision] = useState(false);
  const [composerAccountOptions, setComposerAccountOptions] = useState<ComposerAccountOption[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [executionMode, setExecutionMode] = useState<ComposerExecutionMode>("runtime");
  const [localCliAvailable, setLocalCliAvailable] = useState(false);
  const [localCliVersion, setLocalCliVersion] = useState<string | null>(null);
  const [remoteBackendOptions, setRemoteBackendOptions] = useState<RemoteBackendOption[]>([]);
  const [runtimeProviders, setRuntimeProviders] = useState<RuntimeProviderCatalogEntry[]>([]);
  const [selectedProviderAccounts, setSelectedProviderAccounts] = useState<OAuthAccountSummary[]>(
    []
  );
  const [selectedProviderPools, setSelectedProviderPools] = useState<
    Array<Awaited<ReturnType<typeof listOAuthPools>>[number]>
  >([]);
  const runtimeMode = detectRuntimeMode();
  const runtimeControl = useWorkspaceRuntimeAgentControl(
    (activeWorkspace?.id ?? DEFAULT_RUNTIME_WORKSPACE_ID) as Parameters<
      typeof useWorkspaceRuntimeAgentControl
    >[0]
  );

  const {
    models,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    reasoningSupported,
    reasoningOptions,
    selectedEffort,
    setSelectedEffort,
  } = useModels({
    activeWorkspace,
    onDebug: addDebugEntry,
    preferredModelId,
    preferredEffort,
    selectionMode,
    preferredProviderId: preferredProviderFamilyId,
    selectionKey: threadCodexSelectionKey,
    autoSelectionRequirements: autoSelectionNeedsVision ? { requiresVision: true } : null,
  });

  const {
    collaborationModes,
    selectedCollaborationMode,
    selectedCollaborationModeId,
    setSelectedCollaborationModeId,
  } = useCollaborationModes({
    activeWorkspace,
    enabled: appSettings.collaborationModesEnabled,
    preferredModeId: preferredCollabModeId,
    selectionKey: threadCodexSelectionKey,
    onDebug: addDebugEntry,
  });

  const persistThreadCodexParams = useCallback(
    (patch: ThreadCodexParamsPatch) => {
      const workspaceId = activeWorkspaceIdForParamsRef.current;
      const threadId = activeThreadIdRef.current;
      if (!workspaceId || !threadId) {
        return;
      }
      patchThreadCodexParams(workspaceId, threadId, patch);
    },
    [activeThreadIdRef, activeWorkspaceIdForParamsRef, patchThreadCodexParams]
  );

  const isThreadScopedSelection =
    threadCodexSelectionKey !== null
      ? !threadCodexSelectionKey.endsWith(NO_THREAD_SCOPE_SUFFIX)
      : Boolean(visibleActiveThreadIdRef.current);

  const resolvePersistedModelSelectionId = useCallback(
    (id: string | null) => {
      const normalizedId = normalizeModelSelectionId(id);
      if (!normalizedId) {
        return null;
      }
      const matchedModel =
        models.find((model) => model.id === normalizedId) ??
        models.find((model) => model.model === normalizedId) ??
        null;
      return matchedModel?.id ?? normalizedId;
    },
    [models]
  );

  const handleSelectModel = useCallback(
    (id: string | null) => {
      const normalizedId = normalizeModelSelectionId(id);
      const persistedModelId = resolvePersistedModelSelectionId(normalizedId);
      const nextProviderFamilyId =
        (models.find(
          (model) => model.id === persistedModelId || model.model === persistedModelId
        ) ?? null)
          ? (resolveModelProviderId(
              models.find(
                (model) => model.id === persistedModelId || model.model === persistedModelId
              )!
            ) as ModelProviderFamilyId)
          : preferredProviderFamilyId;
      setSelectionMode("manual");
      setPreferredProviderFamilyId(nextProviderFamilyId ?? null);
      setSelectedModelId(normalizedId);
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if (
            current.lastComposerModelId === persistedModelId &&
            current.composerModelSelectionMode === "manual" &&
            current.lastComposerProviderFamilyId === (nextProviderFamilyId ?? null)
          ) {
            return current;
          }
          const nextSettings = {
            ...current,
            lastComposerModelId: persistedModelId,
            composerModelSelectionMode: "manual" as const,
            lastComposerProviderFamilyId: nextProviderFamilyId ?? null,
          };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({
          modelId: persistedModelId,
          selectionMode: "manual",
          providerFamilyId: nextProviderFamilyId ?? null,
        });
      }
      void trackProductAnalyticsEvent("provider_family_switched", {
        workspaceId: activeWorkspace?.id ?? null,
        threadId: activeThreadIdRef.current,
        eventSource: "composer",
        requestMode: nextProviderFamilyId ?? null,
      });
    },
    [
      activeThreadIdRef,
      activeWorkspace?.id,
      appSettingsLoading,
      isThreadScopedSelection,
      models,
      persistThreadCodexParams,
      preferredProviderFamilyId,
      queueSaveSettings,
      resolvePersistedModelSelectionId,
      setAppSettings,
      setPreferredProviderFamilyId,
      setSelectedModelId,
      setSelectionMode,
    ]
  );

  const handleSelectModelSelectionMode = useCallback(
    (mode: ComposerModelSelectionMode) => {
      setSelectionMode(mode);
      const nextProviderFamilyId =
        preferredProviderFamilyId ??
        (selectedModel ? (resolveModelProviderId(selectedModel) as ModelProviderFamilyId) : null);
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if (
            current.composerModelSelectionMode === mode &&
            current.lastComposerProviderFamilyId === nextProviderFamilyId
          ) {
            return current;
          }
          const nextSettings = {
            ...current,
            composerModelSelectionMode: mode,
            lastComposerProviderFamilyId: nextProviderFamilyId,
          };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({
          selectionMode: mode,
          providerFamilyId: nextProviderFamilyId,
        });
      }
      void trackProductAnalyticsEvent("model_selection_mode_changed", {
        workspaceId: activeWorkspace?.id ?? null,
        threadId: activeThreadIdRef.current,
        eventSource: "composer",
        requestMode: mode,
      });
    },
    [
      activeThreadIdRef,
      activeWorkspace?.id,
      appSettingsLoading,
      isThreadScopedSelection,
      persistThreadCodexParams,
      preferredProviderFamilyId,
      queueSaveSettings,
      selectedModel,
      setAppSettings,
    ]
  );

  const handleSelectProviderFamily = useCallback(
    (providerFamilyId: ModelProviderFamilyId | string | null) => {
      const normalizedProviderFamilyId = normalizeProviderFamilyId(providerFamilyId);
      setPreferredProviderFamilyId(normalizedProviderFamilyId);
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if (current.lastComposerProviderFamilyId === normalizedProviderFamilyId) {
            return current;
          }
          const nextSettings = {
            ...current,
            lastComposerProviderFamilyId: normalizedProviderFamilyId,
          };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({ providerFamilyId: normalizedProviderFamilyId });
      }
      void trackProductAnalyticsEvent("provider_family_switched", {
        workspaceId: activeWorkspace?.id ?? null,
        threadId: activeThreadIdRef.current,
        eventSource: "composer",
        requestMode: normalizedProviderFamilyId,
      });
    },
    [
      activeThreadIdRef,
      activeWorkspace?.id,
      appSettingsLoading,
      isThreadScopedSelection,
      persistThreadCodexParams,
      queueSaveSettings,
      setAppSettings,
    ]
  );

  const handleSelectAutoRoute = useCallback(
    (providerFamilyId: ModelProviderFamilyId | string | null) => {
      const normalizedProviderFamilyId = normalizeProviderFamilyId(
        providerFamilyId ??
          preferredProviderFamilyId ??
          (selectedModel ? (resolveModelProviderId(selectedModel) as ModelProviderFamilyId) : null)
      );
      setSelectionMode("auto");
      setPreferredProviderFamilyId(normalizedProviderFamilyId);
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if (
            current.composerModelSelectionMode === "auto" &&
            current.lastComposerProviderFamilyId === normalizedProviderFamilyId
          ) {
            return current;
          }
          const nextSettings = {
            ...current,
            composerModelSelectionMode: "auto" as const,
            lastComposerProviderFamilyId: normalizedProviderFamilyId,
          };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({
          selectionMode: "auto",
          providerFamilyId: normalizedProviderFamilyId,
        });
      }
      void trackProductAnalyticsEvent("provider_family_switched", {
        workspaceId: activeWorkspace?.id ?? null,
        threadId: activeThreadIdRef.current,
        eventSource: "composer",
        requestMode: normalizedProviderFamilyId,
      });
      void trackProductAnalyticsEvent("model_selection_mode_changed", {
        workspaceId: activeWorkspace?.id ?? null,
        threadId: activeThreadIdRef.current,
        eventSource: "composer",
        requestMode: "auto",
      });
    },
    [
      activeThreadIdRef,
      activeWorkspace?.id,
      appSettingsLoading,
      isThreadScopedSelection,
      persistThreadCodexParams,
      preferredProviderFamilyId,
      queueSaveSettings,
      selectedModel,
      setAppSettings,
      setPreferredProviderFamilyId,
      setSelectionMode,
    ]
  );

  const handleSelectEffort = useCallback(
    (raw: string | null) => {
      const next = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
      setSelectedEffort(next);
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if (current.lastComposerReasoningEffort === next) {
            return current;
          }
          const nextSettings = { ...current, lastComposerReasoningEffort: next };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({ effort: next });
      }
    },
    [
      appSettingsLoading,
      isThreadScopedSelection,
      persistThreadCodexParams,
      queueSaveSettings,
      setAppSettings,
      setSelectedEffort,
    ]
  );

  const handleToggleFastMode = useCallback(
    (enabled: boolean) => {
      const next = enabled === true;
      setPreferredFastMode(next);
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if ((current.lastComposerFastMode ?? null) === next) {
            return current;
          }
          const nextSettings = { ...current, lastComposerFastMode: next };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({ fastMode: next });
      }
    },
    [
      appSettingsLoading,
      isThreadScopedSelection,
      persistThreadCodexParams,
      queueSaveSettings,
      setAppSettings,
    ]
  );

  const handleSelectCollaborationMode = useCallback(
    (id: string | null) => {
      setSelectedCollaborationModeId(id);
      persistThreadCodexParams({ collaborationModeId: id });
    },
    [persistThreadCodexParams, setSelectedCollaborationModeId]
  );

  const handleSelectAccessMode = useCallback(
    (mode: AccessMode) => {
      setAccessMode(mode);
      persistThreadCodexParams({ accessMode: mode });
    },
    [persistThreadCodexParams]
  );

  const handleSelectExecutionMode = useCallback(
    (mode: ComposerExecutionMode) => {
      if (mode !== "runtime" && !localCliAvailable) {
        return;
      }
      setExecutionMode(mode);
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if (current.lastComposerExecutionMode === mode) {
            return current;
          }
          const nextSettings = { ...current, lastComposerExecutionMode: mode };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({ executionMode: mode });
      }
    },
    [
      appSettingsLoading,
      isThreadScopedSelection,
      localCliAvailable,
      persistThreadCodexParams,
      queueSaveSettings,
      setAppSettings,
    ]
  );

  const handleSelectRemoteBackendId = useCallback(
    (backendId: string | null) => {
      const normalizedBackendId =
        typeof backendId === "string" && backendId.trim().length > 0 ? backendId.trim() : null;
      if (!appSettingsLoading && !isThreadScopedSelection) {
        setAppSettings((current) => {
          if (current.defaultRemoteExecutionBackendId === normalizedBackendId) {
            return current;
          }
          const nextSettings = {
            ...current,
            defaultRemoteExecutionBackendId: normalizedBackendId,
          };
          void queueSaveSettings(nextSettings);
          return nextSettings;
        });
      }
      if (isThreadScopedSelection) {
        persistThreadCodexParams({
          preferredBackendIds: normalizedBackendId ? [normalizedBackendId] : null,
        });
      }
    },
    [
      appSettingsLoading,
      isThreadScopedSelection,
      persistThreadCodexParams,
      queueSaveSettings,
      setAppSettings,
    ]
  );

  useComposerShortcuts({
    textareaRef: composerInputRef,
    modelShortcut: appSettings.composerModelShortcut,
    accessShortcut: appSettings.composerAccessShortcut,
    reasoningShortcut: appSettings.composerReasoningShortcut,
    collaborationShortcut: appSettings.collaborationModesEnabled
      ? appSettings.composerCollaborationShortcut
      : null,
    models,
    collaborationModes,
    selectedModelId,
    onSelectModel: handleSelectModel,
    selectedCollaborationModeId,
    onSelectCollaborationMode: handleSelectCollaborationMode,
    accessMode,
    onSelectAccessMode: handleSelectAccessMode,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: handleSelectEffort,
    reasoningSupported,
  });

  useComposerMenuActions({
    models,
    selectedModelId,
    onSelectModel: handleSelectModel,
    collaborationModes,
    selectedCollaborationModeId,
    onSelectCollaborationMode: handleSelectCollaborationMode,
    accessMode,
    onSelectAccessMode: handleSelectAccessMode,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: handleSelectEffort,
    reasoningSupported,
    onFocusComposer: () => composerInputRef.current?.focus(),
  });

  useEffect(() => {
    let canceled = false;
    if (runtimeMode === "unavailable") {
      setLocalCliAvailable(false);
      setLocalCliVersion(null);
      return;
    }
    const loadLocalCliStatus = async () => {
      try {
        const doctor = await runCodexDoctor(appSettings.codexBin, appSettings.codexArgs);
        if (canceled) {
          return;
        }
        const version =
          typeof doctor.version === "string" && doctor.version.trim().length > 0
            ? doctor.version.trim()
            : null;
        const available = doctor.ok;
        setLocalCliAvailable(available);
        setLocalCliVersion(version);
      } catch {
        if (canceled) {
          return;
        }
        setLocalCliAvailable(false);
        setLocalCliVersion(null);
      }
    };
    void loadLocalCliStatus();
    return () => {
      canceled = true;
    };
  }, [appSettings.codexArgs, appSettings.codexBin, runtimeMode]);

  const effectiveExecutionMode: ComposerExecutionMode =
    localCliAvailable || executionMode === "runtime" ? executionMode : "runtime";
  const resolvedModel = selectedModel?.model ?? null;
  const selectedProviderId =
    preferredProviderFamilyId ??
    (selectedModel ? (resolveModelProviderId(selectedModel) as ModelProviderFamilyId) : null);
  const resolvedEffort = reasoningSupported ? selectedEffort : null;
  const visionCapabilitySupport = resolveModelVisionCapabilitySupport(selectedModel);
  const executionOptions = useMemo<ComposerExecutionOption[]>(
    () =>
      localCliAvailable
        ? [
            { value: "runtime", label: "Runtime" },
            { value: "hybrid", label: "Hybrid" },
            {
              value: "local-cli",
              label: localCliVersion
                ? `${LOCAL_CODEX_CLI_LABEL} (${localCliVersion})`
                : LOCAL_CODEX_CLI_LABEL,
            },
          ]
        : [
            { value: "runtime", label: "Runtime" },
            { value: "hybrid", label: HYBRID_UNAVAILABLE_LABEL, disabled: true },
            {
              value: "local-cli",
              label: LOCAL_CODEX_CLI_UNAVAILABLE_LABEL,
              disabled: true,
            },
          ],
    [localCliAvailable, localCliVersion]
  );
  const hasAvailableModel = models.some((model) => model.available !== false);
  const selectedProviderRoute = useMemo<RuntimeResolvedProviderRoute | null>(
    () =>
      resolveRuntimeModelProviderRoute({
        model: selectedModel,
        providers: runtimeProviders,
        accounts: selectedProviderAccounts,
        pools: selectedProviderPools,
      }),
    [runtimeProviders, selectedModel, selectedProviderAccounts, selectedProviderPools]
  );
  const selectedOAuthProviderId = selectedProviderRoute?.oauthProviderId ?? null;
  const selectedRoutingPoolId = useMemo(() => {
    const canonicalPool =
      selectedProviderRoute?.pool ??
      canonicalizeModelPool(selectedModel?.pool ?? null) ??
      canonicalizeModelPool(selectedModel?.provider ?? null) ??
      canonicalizeModelPool(selectedModel?.model ?? null);
    return canonicalPool ? `pool-${canonicalPool}` : null;
  }, [
    selectedModel?.model,
    selectedModel?.pool,
    selectedModel?.provider,
    selectedProviderRoute?.pool,
  ]);

  useEffect(() => {
    let canceled = false;
    if (runtimeMode === "unavailable") {
      setRuntimeProviders([]);
      return;
    }
    void getProvidersCatalog()
      .then((providers) => {
        if (!canceled) {
          setRuntimeProviders(providers);
        }
      })
      .catch(() => {
        if (!canceled) {
          setRuntimeProviders([]);
        }
      });
    return () => {
      canceled = true;
    };
  }, [activeWorkspace?.id, runtimeMode]);

  useEffect(() => {
    let canceled = false;
    if (runtimeMode === "unavailable") {
      setComposerAccountOptions([]);
      setSelectedAccountIds([]);
      setSelectedProviderAccounts([]);
      setSelectedProviderPools([]);
      return;
    }
    if (!selectedOAuthProviderId) {
      setComposerAccountOptions([]);
      setSelectedAccountIds([]);
      setSelectedProviderAccounts([]);
      setSelectedProviderPools([]);
      return;
    }
    const loadAccounts = async () => {
      try {
        const [accounts, pools, primaryAccount] = await Promise.all([
          listOAuthAccounts(selectedOAuthProviderId),
          listOAuthPools(selectedOAuthProviderId),
          selectedOAuthProviderId === "codex"
            ? getOAuthPrimaryAccount("codex").catch(() => null)
            : Promise.resolve(null),
        ]);
        if (canceled) {
          return;
        }
        setSelectedProviderAccounts(accounts);
        setSelectedProviderPools(pools);
        const options = accounts.map((account) => ({
          id: account.accountId,
          label: formatComposerAccountLabel(account),
          status: account.status,
        }));
        setComposerAccountOptions(options);
        setSelectedAccountIds((current) => {
          const optionIdSet = new Set(options.map((option) => option.id));
          const retained = current.filter((id) => optionIdSet.has(id));
          const primaryAccountId =
            selectedOAuthProviderId === "codex"
              ? (primaryAccount?.routeAccountId ?? primaryAccount?.accountId ?? null)
              : null;
          if (primaryAccountId && optionIdSet.has(primaryAccountId)) {
            return [primaryAccountId, ...retained.filter((id) => id !== primaryAccountId)];
          }
          if (retained.length > 0) {
            return retained;
          }
          const enabledAccountIds = accounts
            .filter((account) => account.status === "enabled")
            .map((account) => account.accountId);
          if (enabledAccountIds.length > 0) {
            return enabledAccountIds;
          }
          return options.map((option) => option.id);
        });
      } catch {
        if (canceled) {
          return;
        }
        setComposerAccountOptions([]);
        setSelectedAccountIds([]);
        setSelectedProviderAccounts([]);
        setSelectedProviderPools([]);
      }
    };
    void loadAccounts();
    return () => {
      canceled = true;
    };
  }, [runtimeMode, selectedOAuthProviderId]);

  useEffect(() => {
    const listRuntimeBackends = runtimeControl.runtimeBackendsList;
    if (!listRuntimeBackends) {
      setRemoteBackendOptions([]);
      return;
    }
    let canceled = false;
    void listRuntimeBackends(activeWorkspace?.id ?? DEFAULT_RUNTIME_WORKSPACE_ID)
      .then((result) => {
        if (canceled) {
          return;
        }
        setRemoteBackendOptions(normalizeRemoteBackendOptions(result));
      })
      .catch(() => {
        if (canceled) {
          return;
        }
        setRemoteBackendOptions([]);
      });
    return () => {
      canceled = true;
    };
  }, [activeWorkspace?.id, runtimeControl]);

  useEffect(() => {
    if (runtimeMode === "unavailable") {
      return;
    }
    if (!selectedOAuthProviderId || !selectedRoutingPoolId || composerAccountOptions.length === 0) {
      return;
    }
    const optionIdSet = new Set(composerAccountOptions.map((option) => option.id));
    const selectedIds = selectedAccountIds.filter((id) => optionIdSet.has(id));
    let canceled = false;
    const syncPoolSelection = async () => {
      try {
        const pools = await listOAuthPools(selectedOAuthProviderId);
        if (canceled) {
          return;
        }
        const existingPool = pools.find((pool) => pool.poolId === selectedRoutingPoolId) ?? null;
        const nextPreferredAccountId = selectedIds[0] ?? null;
        if (!existingPool) {
          await upsertOAuthPool({
            poolId: selectedRoutingPoolId,
            provider: selectedOAuthProviderId,
            name: `${resolveModelBrandLabel(selectedModel) ?? selectedOAuthProviderId} routing`,
            preferredAccountId: selectedOAuthProviderId === "codex" ? null : nextPreferredAccountId,
            enabled: true,
          });
        } else {
          if (
            selectedOAuthProviderId !== "codex" &&
            existingPool.preferredAccountId !== nextPreferredAccountId
          ) {
            await upsertOAuthPool({
              poolId: existingPool.poolId,
              provider: existingPool.provider,
              name: existingPool.name,
              strategy: existingPool.strategy,
              stickyMode: existingPool.stickyMode,
              preferredAccountId: nextPreferredAccountId,
              enabled: existingPool.enabled,
              metadata: existingPool.metadata,
            });
          }
        }
        if (
          selectedOAuthProviderId === "codex" &&
          existingPool?.preferredAccountId !== nextPreferredAccountId
        ) {
          await setOAuthPrimaryAccount({
            provider: "codex",
            accountId: nextPreferredAccountId,
          });
        }
        await replaceOAuthPoolMembers(selectedRoutingPoolId, buildPoolMembers(selectedIds));
      } catch {
        // Best effort only: keep composer responsive even if pool sync fails.
      }
    };
    void syncPoolSelection();
    return () => {
      canceled = true;
    };
  }, [
    composerAccountOptions,
    runtimeMode,
    selectedAccountIds,
    selectedOAuthProviderId,
    selectedRoutingPoolId,
  ]);

  const handleSelectAccountIds = useCallback((ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));
    setSelectedAccountIds(uniqueIds);
  }, []);

  const currentMissionWorkspaceId = activeWorkspaceIdForParamsRef.current;
  const currentMissionThreadId = visibleActiveThreadIdRef.current ?? activeThreadIdRef.current;
  const missionDraft = useMemo(() => {
    const stored =
      currentMissionWorkspaceId && currentMissionThreadId
        ? getThreadCodexParams(currentMissionWorkspaceId, currentMissionThreadId)
        : null;
    return buildMissionDraftFromThreadState({
      objective: "",
      accessMode: stored?.accessMode ?? accessMode,
      collaborationModeId: stored?.collaborationModeId ?? selectedCollaborationModeId,
      executionProfileId: stored?.executionProfileId ?? null,
      preferredBackendIds:
        resolveRuntimePreferredBackendIdsInput({
          preferredBackendIds: stored?.preferredBackendIds ?? null,
          fallbackDefaultBackendId: appSettings.defaultRemoteExecutionBackendId,
        }) ?? null,
      autoDriveDraft: stored?.autoDriveDraft ?? null,
    });
  }, [
    accessMode,
    appSettings.defaultRemoteExecutionBackendId,
    currentMissionThreadId,
    currentMissionWorkspaceId,
    getThreadCodexParams,
    selectedCollaborationModeId,
  ]);

  return {
    accessMode,
    selectionMode,
    composerAccountOptions,
    collaborationModes,
    executionMode: effectiveExecutionMode,
    executionOptions,
    handleSelectAccountIds,
    handleSelectAccessMode,
    handleSelectCollaborationMode,
    handleSelectExecutionMode,
    handleSelectEffort,
    handleSelectModel,
    handleSelectAutoRoute,
    handleSelectModelSelectionMode,
    handleSelectProviderFamily,
    handleSelectRemoteBackendId,
    handleToggleFastMode,
    hasAvailableModel,
    models,
    preferredCollabModeId,
    preferredEffort,
    preferredFastMode,
    preferredModelId,
    preferredProviderFamilyId,
    reasoningOptions,
    reasoningSupported,
    resolvedEffort,
    resolvedModel,
    visionCapabilitySupport,
    missionMode: missionDraft.mode,
    executionProfileId: missionDraft.executionProfileId,
    preferredBackendIds: missionDraft.preferredBackendIds,
    resolvedProvider: selectedProviderRoute?.providerId ?? null,
    selectedProviderRoute,
    remoteBackendOptions,
    selectedCollaborationMode,
    selectedCollaborationModeId,
    selectedEffort,
    fastModeEnabled: preferredFastMode,
    selectedAccountIds,
    selectedModelId,
    selectedProviderId,
    selectedRemoteBackendId: missionDraft.preferredBackendIds?.[0] ?? null,
    setAutoSelectionNeedsVision,
    setAccessMode,
    setPreferredCollabModeId,
    setPreferredEffort,
    setPreferredFastMode,
    setPreferredModelId,
    setPreferredProviderFamilyId,
    setSelectionMode,
    setSelectedCollaborationModeId,
    setSelectedEffort,
    setExecutionMode,
    setSelectedModelId,
    setThreadCodexSelectionKey,
    threadCodexSelectionKey,
  };
}

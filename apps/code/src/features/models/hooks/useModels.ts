import { clampReasoningEffortToCapabilityMatrix } from "@ku0/code-runtime-client/runtimeCapabilityMatrix";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConfigModel, getModelList } from "../../../application/runtime/ports/models";
import { getProvidersCatalog } from "../../../application/runtime/ports/oauth";
import type {
  ComposerModelSelectionMode,
  DebugEntry,
  ModelOption,
  ModelProviderFamilyId,
  WorkspaceInfo,
} from "../../../types";
import { useRuntimeUpdatedRefresh } from "../../app/hooks/useRuntimeUpdatedRefresh";
import { expandComposerModelBrandOptions } from "../../app/utils/antiGravityBranding";
import { parseModelListResponse } from "../utils/modelListResponse";
import {
  getModelReasoningOptions,
  normalizeEffortValue,
  normalizeModelOption,
  supportsModelReasoning,
} from "../utils/modelOptionCapabilities";
import {
  type AutoSelectionRequirements,
  buildModelProviderOptions,
  resolveAutoModelProviderSelection,
} from "../utils/modelProviderSelection";
import { mergeModelsWithProviderCatalogMetadata } from "../utils/providerCatalogMetadata";

type UseModelsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
  preferredModelId?: string | null;
  preferredEffort?: string | null;
  selectionMode?: ComposerModelSelectionMode | null;
  preferredProviderId?: ModelProviderFamilyId | string | null;
  selectionKey?: string | null;
  autoSelectionRequirements?: AutoSelectionRequirements | null;
};

const GLOBAL_MODEL_SCOPE_ID = "__global__";
const MODEL_REFRESH_RETRY_MAX_ATTEMPTS = 5;
const MODEL_REFRESH_RETRY_BASE_DELAY_MS = 600;
const COMPOSER_BOOTSTRAP_MODEL_SLUGS = [
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2-codex",
  "gpt-5.2",
] as const;
const COMPOSER_BOOTSTRAP_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;
const COMPOSER_BOOTSTRAP_MODEL_ORDER = new Map<string, number>(
  COMPOSER_BOOTSTRAP_MODEL_SLUGS.map((slug, index) => [slug, index])
);

const isModelAvailable = (model: ModelOption | null | undefined) => model?.available !== false;

const findModelByIdOrModel = (
  models: ModelOption[],
  idOrModel: string | null
): ModelOption | null => {
  if (!idOrModel) {
    return null;
  }
  return (
    models.find((model) => model.id === idOrModel) ??
    models.find((model) => model.model === idOrModel) ??
    null
  );
};

const pickDefaultModel = (models: ModelOption[], configModel: string | null) =>
  findModelByIdOrModel(
    models.filter((model) => isModelAvailable(model)),
    configModel
  ) ??
  models.find((model) => isModelAvailable(model) && model.isDefault) ??
  models.find((model) => isModelAvailable(model)) ??
  findModelByIdOrModel(models, configModel) ??
  models.find((model) => model.isDefault) ??
  models[0] ??
  null;

function createBootstrapModelOptions(): ModelOption[] {
  return COMPOSER_BOOTSTRAP_MODEL_SLUGS.map((model) =>
    normalizeModelOption({
      id: model,
      model,
      displayName: model,
      description: "Loading account models...",
      provider: "openai",
      pool: "codex",
      source: "fallback",
      available: true,
      supportedReasoningEfforts: COMPOSER_BOOTSTRAP_REASONING_EFFORTS.map((reasoningEffort) => ({
        reasoningEffort,
        description: `${reasoningEffort} reasoning effort`,
      })),
      defaultReasoningEffort: "high",
      isDefault: model === "gpt-5.4",
    })
  );
}

function modelSourceScore(source: ModelOption["source"]): number {
  if (source === "oauth-account") {
    return 40;
  }
  if (source === "local-codex") {
    return 30;
  }
  if (source === "workspace-default") {
    return 20;
  }
  if (source === "fallback") {
    return 10;
  }
  return 0;
}

function scoreComposerModelCandidate(model: ModelOption): number {
  let score = 0;
  if (model.available !== false) {
    score += 100;
  }
  if (model.isDefault) {
    score += 20;
  }
  score += modelSourceScore(model.source);
  if (model.id === model.model) {
    score += 1;
  }
  return score;
}

function prioritizeComposerModels(models: ModelOption[]): ModelOption[] {
  if (models.length === 0) {
    return createBootstrapModelOptions();
  }
  return expandComposerModelBrandOptions(
    models
      .slice()
      .sort((left, right) => {
        const leftRank = COMPOSER_BOOTSTRAP_MODEL_ORDER.get(left.model) ?? Number.MAX_SAFE_INTEGER;
        const rightRank =
          COMPOSER_BOOTSTRAP_MODEL_ORDER.get(right.model) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        const scoreDelta = scoreComposerModelCandidate(right) - scoreComposerModelCandidate(left);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        const displayNameDelta = left.displayName.localeCompare(right.displayName, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (displayNameDelta !== 0) {
          return displayNameDelta;
        }
        return left.id.localeCompare(right.id, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      })
      .map((model) => ({
        ...model,
        displayName: model.displayName || model.model,
      }))
  );
}

export function useModels({
  activeWorkspace,
  onDebug,
  preferredModelId = null,
  preferredEffort = null,
  selectionMode = "manual",
  preferredProviderId = null,
  selectionKey = null,
  autoSelectionRequirements = null,
}: UseModelsOptions) {
  const [models, setModels] = useState<ModelOption[]>(() => createBootstrapModelOptions());
  const [configModel, setConfigModel] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelIdState] = useState<string | null>(null);
  const [selectedEffort, setSelectedEffortState] = useState<string | null>(null);
  const preferredSelectedEffort = useRef<string | null>(normalizeEffortValue(preferredEffort));
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const inFlightScopeId = useRef<string | null>(null);
  const refreshQueued = useRef(false);
  const queuedScopeId = useRef<string | null>(null);
  const modelRefreshRetryAttempt = useRef(0);
  const modelRefreshRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestWorkspaceIdRef = useRef<string | null>(null);
  const refreshModelsRef = useRef<() => Promise<void>>(async () => undefined);
  const hasUserSelectedModel = useRef(false);
  const hasUserSelectedEffort = useRef(false);
  const lastWorkspaceId = useRef<string | null>(null);
  const lastSelectionKey = useRef<string | null>(null);

  const workspaceId = activeWorkspace?.id ?? null;
  const fetchScopeId = workspaceId ?? GLOBAL_MODEL_SCOPE_ID;

  useEffect(() => {
    latestWorkspaceIdRef.current = fetchScopeId;
  }, [fetchScopeId]);

  useEffect(() => {
    modelRefreshRetryAttempt.current = 0;
    if (modelRefreshRetryTimer.current) {
      clearTimeout(modelRefreshRetryTimer.current);
      modelRefreshRetryTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (selectionKey === lastSelectionKey.current) {
      return;
    }
    lastSelectionKey.current = selectionKey;
    hasUserSelectedModel.current = false;
    hasUserSelectedEffort.current = false;
    preferredSelectedEffort.current = normalizeEffortValue(preferredEffort);
  }, [preferredEffort, selectionKey]);

  useEffect(() => {
    if (workspaceId === lastWorkspaceId.current) {
      return;
    }
    hasUserSelectedModel.current = false;
    hasUserSelectedEffort.current = false;
    preferredSelectedEffort.current = normalizeEffortValue(preferredEffort);
    lastWorkspaceId.current = workspaceId;
    setConfigModel(null);
  }, [preferredEffort, workspaceId]);

  useEffect(() => {
    if (hasUserSelectedEffort.current) {
      return;
    }
    preferredSelectedEffort.current = normalizeEffortValue(preferredEffort);
  }, [preferredEffort]);

  useEffect(() => {
    if (selectedEffort === null) {
      return;
    }
    if (selectedEffort.trim().length > 0) {
      return;
    }
    hasUserSelectedEffort.current = false;
    setSelectedEffortState(null);
  }, [selectedEffort]);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId]
  );

  const setSelectedModelId = useCallback((next: string | null) => {
    hasUserSelectedModel.current = true;
    setSelectedModelIdState(next);
  }, []);

  const setSelectedEffort = useCallback(
    (next: string | null) => {
      const normalizedEffort = normalizeEffortValue(next);
      hasUserSelectedEffort.current = normalizedEffort !== null;
      preferredSelectedEffort.current = normalizedEffort;
      setSelectedEffortState(
        clampReasoningEffortToCapabilityMatrix(
          normalizedEffort,
          selectedModel?.capabilityMatrix ?? null,
          selectedModel?.defaultReasoningEffort ?? null
        )
      );
    },
    [selectedModel?.capabilityMatrix, selectedModel?.defaultReasoningEffort]
  );

  const reasoningSupported = useMemo(() => {
    return supportsModelReasoning(selectedModel);
  }, [selectedModel]);

  const reasoningOptions = useMemo(() => {
    return getModelReasoningOptions(selectedModel);
  }, [selectedModel]);

  const resolveEffort = useCallback(
    (model: ModelOption, preferCurrent: boolean) => {
      const currentEffort = preferCurrent
        ? (preferredSelectedEffort.current ??
          normalizeEffortValue(selectedEffort) ??
          normalizeEffortValue(preferredEffort))
        : normalizeEffortValue(preferredEffort);
      if (currentEffort) {
        return clampReasoningEffortToCapabilityMatrix(
          currentEffort,
          model.capabilityMatrix ?? null,
          model.defaultReasoningEffort
        );
      }
      return clampReasoningEffortToCapabilityMatrix(
        null,
        model.capabilityMatrix ?? null,
        model.defaultReasoningEffort
      );
    },
    [preferredEffort, selectedEffort]
  );

  const refreshModels = useCallback(async () => {
    let scheduleRetry = false;
    if (inFlight.current) {
      if (inFlightScopeId.current === fetchScopeId || queuedScopeId.current === fetchScopeId) {
        return;
      }
      refreshQueued.current = true;
      queuedScopeId.current = fetchScopeId;
      return;
    }
    inFlight.current = true;
    inFlightScopeId.current = fetchScopeId;
    const scopeIdAtRequest = fetchScopeId;
    onDebug?.({
      id: `${Date.now()}-client-model-list`,
      timestamp: Date.now(),
      source: "client",
      label: "model/list",
      payload: { workspaceId, scopeId: fetchScopeId },
    });
    try {
      const [modelListResult, configModelResult, providersCatalogResult] = await Promise.allSettled(
        [
          getModelList(fetchScopeId),
          workspaceId ? getConfigModel(workspaceId) : Promise.resolve(null),
          getProvidersCatalog(),
        ]
      );
      const configModelFromConfig =
        configModelResult.status === "fulfilled" ? configModelResult.value : null;
      if (configModelResult.status === "rejected") {
        onDebug?.({
          id: `${Date.now()}-client-config-model-error`,
          timestamp: Date.now(),
          source: "error",
          label: "config/model error",
          payload:
            configModelResult.reason instanceof Error
              ? configModelResult.reason.message
              : String(configModelResult.reason),
        });
      }
      const response = modelListResult.status === "fulfilled" ? modelListResult.value : null;
      if (modelListResult.status === "rejected") {
        onDebug?.({
          id: `${Date.now()}-client-model-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "model/list error",
          payload:
            modelListResult.reason instanceof Error
              ? modelListResult.reason.message
              : String(modelListResult.reason),
        });
      }
      if (providersCatalogResult.status === "rejected") {
        onDebug?.({
          id: `${Date.now()}-client-providers-catalog-error`,
          timestamp: Date.now(),
          source: "error",
          label: "providers/catalog error",
          payload:
            providersCatalogResult.reason instanceof Error
              ? providersCatalogResult.reason.message
              : String(providersCatalogResult.reason),
        });
      }
      onDebug?.({
        id: `${Date.now()}-server-model-list`,
        timestamp: Date.now(),
        source: "server",
        label: "model/list response",
        payload: response,
      });
      if (latestWorkspaceIdRef.current !== scopeIdAtRequest) {
        return;
      }
      setConfigModel(configModelFromConfig);
      const data = parseModelListResponse(response);
      const hasModelData = data.length > 0;
      const modelListFailed = modelListResult.status === "rejected";
      scheduleRetry = modelListFailed || !hasModelData;
      if (!scheduleRetry) {
        modelRefreshRetryAttempt.current = 0;
        if (modelRefreshRetryTimer.current) {
          clearTimeout(modelRefreshRetryTimer.current);
          modelRefreshRetryTimer.current = null;
        }
      }
      const providerCatalogEntries =
        providersCatalogResult.status === "fulfilled" ? providersCatalogResult.value : [];
      const resolvedModels = prioritizeComposerModels(
        mergeModelsWithProviderCatalogMetadata(data, providerCatalogEntries)
      );
      setModels(resolvedModels);
      lastFetchedWorkspaceId.current = scopeIdAtRequest;
      const defaultModel = pickDefaultModel(resolvedModels, configModelFromConfig);
      const hasAvailableModel = resolvedModels.some((model) => isModelAvailable(model));
      const existingSelection = findModelByIdOrModel(resolvedModels, selectedModelId);
      if (selectedModelId && !existingSelection) {
        hasUserSelectedModel.current = false;
      }
      const preferredSelection = findModelByIdOrModel(resolvedModels, preferredModelId);
      const existingSelectionUsable =
        existingSelection && (isModelAvailable(existingSelection) || !hasAvailableModel)
          ? existingSelection
          : null;
      const preferredSelectionUsable =
        preferredSelection && (isModelAvailable(preferredSelection) || !hasAvailableModel)
          ? preferredSelection
          : null;
      const providerOptions = buildModelProviderOptions(resolvedModels);
      const shouldKeepExisting =
        selectionMode !== "auto" &&
        hasUserSelectedModel.current &&
        existingSelectionUsable !== null;
      const nextSelection =
        selectionMode === "auto"
          ? (() => {
              const autoSelection = resolveAutoModelProviderSelection(
                providerOptions,
                preferredProviderId,
                preferredSelectionUsable?.id ??
                  defaultModel?.id ??
                  existingSelectionUsable?.id ??
                  existingSelection?.id ??
                  null,
                autoSelectionRequirements
              );
              return (
                findModelByIdOrModel(resolvedModels, autoSelection.modelId) ??
                preferredSelectionUsable ??
                defaultModel ??
                existingSelectionUsable ??
                existingSelection
              );
            })()
          : ((shouldKeepExisting ? existingSelectionUsable : null) ??
            preferredSelectionUsable ??
            defaultModel ??
            existingSelectionUsable ??
            existingSelection);
      if (nextSelection) {
        if (nextSelection.id !== selectedModelId) {
          setSelectedModelIdState(nextSelection.id);
        }
        const nextEffort = resolveEffort(nextSelection, hasUserSelectedEffort.current);
        if (nextEffort !== selectedEffort) {
          setSelectedEffortState(nextEffort);
        }
      }
    } finally {
      inFlight.current = false;
      inFlightScopeId.current = null;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        queuedScopeId.current = null;
        void refreshModelsRef.current();
      }
      if (
        scheduleRetry &&
        !refreshQueued.current &&
        modelRefreshRetryAttempt.current < MODEL_REFRESH_RETRY_MAX_ATTEMPTS &&
        !modelRefreshRetryTimer.current
      ) {
        const attempt = modelRefreshRetryAttempt.current;
        modelRefreshRetryAttempt.current += 1;
        const retryDelayMs = Math.min(MODEL_REFRESH_RETRY_BASE_DELAY_MS * 2 ** attempt, 4_800);
        modelRefreshRetryTimer.current = setTimeout(() => {
          modelRefreshRetryTimer.current = null;
          void refreshModelsRef.current();
        }, retryDelayMs);
      }
    }
  }, [
    fetchScopeId,
    onDebug,
    preferredModelId,
    preferredProviderId,
    autoSelectionRequirements,
    selectionMode,
    selectedEffort,
    selectedModelId,
    resolveEffort,
    workspaceId,
  ]);

  useEffect(() => {
    refreshModelsRef.current = refreshModels;
  }, [refreshModels]);

  useEffect(() => {
    if (lastFetchedWorkspaceId.current === fetchScopeId && models.length > 0) {
      return;
    }
    refreshModels();
  }, [fetchScopeId, models.length, refreshModels]);

  useRuntimeUpdatedRefresh({
    scopes: ["bootstrap", "models", "oauth"],
    onRefresh: () => {
      void refreshModelsRef.current();
    },
    onDebug,
    debugLabel: "native state fabric models refresh",
  });

  useEffect(
    () => () => {
      if (modelRefreshRetryTimer.current) {
        clearTimeout(modelRefreshRetryTimer.current);
        modelRefreshRetryTimer.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedModel) {
      return;
    }
    const currentEffort = normalizeEffortValue(selectedEffort);
    if (!currentEffort) {
      return;
    }
    const nextEffort = clampReasoningEffortToCapabilityMatrix(
      currentEffort,
      selectedModel.capabilityMatrix ?? null,
      selectedModel.defaultReasoningEffort
    );
    if (nextEffort === currentEffort) {
      return;
    }
    setSelectedEffortState(nextEffort);
  }, [selectedEffort, selectedModel]);

  useEffect(() => {
    if (!models.length) {
      return;
    }
    const hasAvailableModel = models.some((model) => isModelAvailable(model));
    const preferredSelection = (() => {
      const candidate = findModelByIdOrModel(models, preferredModelId);
      if (!candidate) {
        return null;
      }
      if (isModelAvailable(candidate) || !hasAvailableModel) {
        return candidate;
      }
      return null;
    })();
    const defaultModel = pickDefaultModel(models, configModel);
    const existingSelection = findModelByIdOrModel(models, selectedModelId);
    if (selectedModelId && !existingSelection) {
      hasUserSelectedModel.current = false;
    }
    const existingSelectionUsable =
      existingSelection && (isModelAvailable(existingSelection) || !hasAvailableModel)
        ? existingSelection
        : null;
    const shouldKeepUserSelection =
      selectionMode !== "auto" && hasUserSelectedModel.current && existingSelectionUsable !== null;
    if (shouldKeepUserSelection) {
      const nextEffort = resolveEffort(existingSelectionUsable, hasUserSelectedEffort.current);
      if (nextEffort !== selectedEffort) {
        setSelectedEffortState(nextEffort);
      }
      return;
    }
    const nextSelection =
      selectionMode === "auto"
        ? (() => {
            const providerOptions = buildModelProviderOptions(models);
            const autoSelection = resolveAutoModelProviderSelection(
              providerOptions,
              preferredProviderId,
              preferredSelection?.id ??
                defaultModel?.id ??
                existingSelectionUsable?.id ??
                existingSelection?.id ??
                null,
              autoSelectionRequirements
            );
            return (
              findModelByIdOrModel(models, autoSelection.modelId) ??
              preferredSelection ??
              defaultModel ??
              existingSelectionUsable ??
              existingSelection ??
              null
            );
          })()
        : (preferredSelection ??
          defaultModel ??
          existingSelectionUsable ??
          existingSelection ??
          null);
    if (!nextSelection) {
      return;
    }
    if (nextSelection.id !== selectedModelId) {
      setSelectedModelIdState(nextSelection.id);
    }
    const nextEffort = resolveEffort(nextSelection, hasUserSelectedEffort.current);
    if (nextEffort !== selectedEffort) {
      setSelectedEffortState(nextEffort);
    }
  }, [
    configModel,
    models,
    preferredModelId,
    preferredProviderId,
    autoSelectionRequirements,
    selectedEffort,
    selectedModelId,
    selectionMode,
    resolveEffort,
  ]);

  return {
    models,
    selectedModel,
    reasoningSupported,
    selectedModelId,
    setSelectedModelId,
    reasoningOptions,
    selectedEffort,
    setSelectedEffort,
    refreshModels,
  };
}

type UnknownRecord = Record<string, unknown>;

export const RUNTIME_COMPOSITION_SETTINGS_BY_WORKSPACE_ID_KEY =
  "runtimeCompositionSettingsByWorkspaceId";

export type RuntimeCompositionSettingsSelection = {
  profileId: string | null;
  preferredRoutePluginIds: string[];
  preferredBackendIds: string[];
};

export type RuntimeCompositionLaunchOverrideDraft = {
  routePolicy?: {
    preferredRoutePluginIds?: string[] | null;
    providerPreference?: string[] | null;
    allowRuntimeFallback?: boolean | null;
  };
  backendPolicy?: {
    preferredBackendIds?: string[] | null;
    resolvedBackendId?: string | null;
  };
  executionPolicyRefs?: string[] | null;
};

export type RuntimeCompositionSettingsPersistenceEnvelope = {
  publisherSessionId: string | null;
  lastAcceptedAuthorityRevision: number | null;
  lastPublishAttemptAt: number | null;
  lastPublishedAt: number | null;
};

export type RuntimeCompositionSettingsEntry = {
  selection: RuntimeCompositionSettingsSelection;
  launchOverride: RuntimeCompositionLaunchOverrideDraft | null;
  persistence: RuntimeCompositionSettingsPersistenceEnvelope;
};

export type RuntimeCompositionSettingsByWorkspaceId = Record<
  string,
  RuntimeCompositionSettingsEntry
>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(value.map(normalizeOptionalText).filter((entry): entry is string => entry !== null)),
  ];
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLaunchOverride(value: unknown): RuntimeCompositionLaunchOverrideDraft | null {
  if (!isRecord(value)) {
    return null;
  }
  const routePolicy = isRecord(value.routePolicy)
    ? {
        preferredRoutePluginIds: normalizeStringArray(value.routePolicy.preferredRoutePluginIds),
        providerPreference: normalizeStringArray(value.routePolicy.providerPreference),
        allowRuntimeFallback:
          typeof value.routePolicy.allowRuntimeFallback === "boolean"
            ? value.routePolicy.allowRuntimeFallback
            : null,
      }
    : null;
  const backendPolicy = isRecord(value.backendPolicy)
    ? {
        preferredBackendIds: normalizeStringArray(value.backendPolicy.preferredBackendIds),
        resolvedBackendId: normalizeOptionalText(value.backendPolicy.resolvedBackendId),
      }
    : null;
  const executionPolicyRefs = normalizeStringArray(value.executionPolicyRefs);
  const normalized: RuntimeCompositionLaunchOverrideDraft = {};

  if (
    routePolicy &&
    (routePolicy.preferredRoutePluginIds.length > 0 ||
      routePolicy.providerPreference.length > 0 ||
      routePolicy.allowRuntimeFallback !== null)
  ) {
    normalized.routePolicy = routePolicy;
  }

  if (
    backendPolicy &&
    (backendPolicy.preferredBackendIds.length > 0 || backendPolicy.resolvedBackendId !== null)
  ) {
    normalized.backendPolicy = backendPolicy;
  }

  if (executionPolicyRefs.length > 0) {
    normalized.executionPolicyRefs = executionPolicyRefs;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function createDefaultRuntimeCompositionSettingsEntry(
  defaultBackendId?: string | null
): RuntimeCompositionSettingsEntry {
  const normalizedBackendId = normalizeOptionalText(defaultBackendId);
  return {
    selection: {
      profileId: null,
      preferredRoutePluginIds: [],
      preferredBackendIds: normalizedBackendId ? [normalizedBackendId] : [],
    },
    launchOverride: null,
    persistence: {
      publisherSessionId: null,
      lastAcceptedAuthorityRevision: null,
      lastPublishAttemptAt: null,
      lastPublishedAt: null,
    },
  };
}

export function normalizeRuntimeCompositionSettingsEntry(
  value: unknown,
  defaultBackendId?: string | null
): RuntimeCompositionSettingsEntry {
  if (!isRecord(value)) {
    return createDefaultRuntimeCompositionSettingsEntry(defaultBackendId);
  }
  const fallback = createDefaultRuntimeCompositionSettingsEntry(defaultBackendId);
  const selection = isRecord(value.selection) ? value.selection : null;
  const persistence = isRecord(value.persistence) ? value.persistence : null;
  const launchOverride = normalizeLaunchOverride(value.launchOverride);

  return {
    selection: {
      profileId: normalizeOptionalText(selection?.profileId) ?? fallback.selection.profileId,
      preferredRoutePluginIds: normalizeStringArray(selection?.preferredRoutePluginIds),
      preferredBackendIds:
        normalizeStringArray(selection?.preferredBackendIds).length > 0
          ? normalizeStringArray(selection?.preferredBackendIds)
          : fallback.selection.preferredBackendIds,
    },
    launchOverride,
    persistence: {
      publisherSessionId: normalizeOptionalText(persistence?.publisherSessionId),
      lastAcceptedAuthorityRevision: normalizeOptionalNumber(
        persistence?.lastAcceptedAuthorityRevision
      ),
      lastPublishAttemptAt: normalizeOptionalNumber(persistence?.lastPublishAttemptAt),
      lastPublishedAt: normalizeOptionalNumber(persistence?.lastPublishedAt),
    },
  };
}

export function normalizeRuntimeCompositionSettingsByWorkspaceId(
  value: unknown,
  defaultBackendId?: string | null
): RuntimeCompositionSettingsByWorkspaceId {
  if (!isRecord(value)) {
    return {};
  }
  const normalized: RuntimeCompositionSettingsByWorkspaceId = {};
  for (const [workspaceId, entry] of Object.entries(value)) {
    const trimmedWorkspaceId = workspaceId.trim();
    if (!trimmedWorkspaceId) {
      continue;
    }
    normalized[trimmedWorkspaceId] = normalizeRuntimeCompositionSettingsEntry(
      entry,
      defaultBackendId
    );
  }
  return normalized;
}

export function readRuntimeCompositionSettingsForWorkspace(
  appSettings: UnknownRecord | null | undefined,
  workspaceId: string,
  options?: {
    defaultBackendId?: string | null;
  }
): RuntimeCompositionSettingsEntry {
  const trimmedWorkspaceId = workspaceId.trim();
  const defaultBackendId =
    options?.defaultBackendId ??
    normalizeOptionalText(appSettings?.defaultRemoteExecutionBackendId);
  if (!trimmedWorkspaceId) {
    return createDefaultRuntimeCompositionSettingsEntry(defaultBackendId);
  }
  const byWorkspace = normalizeRuntimeCompositionSettingsByWorkspaceId(
    appSettings?.[RUNTIME_COMPOSITION_SETTINGS_BY_WORKSPACE_ID_KEY],
    defaultBackendId
  );
  return (
    byWorkspace[trimmedWorkspaceId] ??
    createDefaultRuntimeCompositionSettingsEntry(defaultBackendId)
  );
}

export function writeRuntimeCompositionSettingsForWorkspace(
  appSettings: UnknownRecord,
  workspaceId: string,
  entry: RuntimeCompositionSettingsEntry
): UnknownRecord {
  const trimmedWorkspaceId = workspaceId.trim();
  if (!trimmedWorkspaceId) {
    return { ...appSettings };
  }
  const normalizedEntry = normalizeRuntimeCompositionSettingsEntry(
    entry,
    normalizeOptionalText(appSettings.defaultRemoteExecutionBackendId)
  );
  const byWorkspace = normalizeRuntimeCompositionSettingsByWorkspaceId(
    appSettings[RUNTIME_COMPOSITION_SETTINGS_BY_WORKSPACE_ID_KEY],
    normalizeOptionalText(appSettings.defaultRemoteExecutionBackendId)
  );
  byWorkspace[trimmedWorkspaceId] = normalizedEntry;
  return {
    ...appSettings,
    [RUNTIME_COMPOSITION_SETTINGS_BY_WORKSPACE_ID_KEY]: byWorkspace,
  };
}

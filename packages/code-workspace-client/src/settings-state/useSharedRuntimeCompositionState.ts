import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  RuntimeCompositionProfile,
  RuntimeCompositionProfileLaunchOverride,
  RuntimeCompositionResolution,
  RuntimeCompositionResolveV2Response,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeCompositionSettingsEntry } from "@ku0/code-platform-interfaces";
import { useWorkspaceClientRuntimeBindings } from "../workspace/WorkspaceClientBindingsProvider";

function convertCompositionSnapshotToResolution(
  snapshot: RuntimeCompositionResolveV2Response
): RuntimeCompositionResolution {
  return {
    selectedPlugins: snapshot.pluginEntries
      .filter((entry) => entry.selectedInActiveProfile)
      .map((entry) => ({
        pluginId: entry.pluginId,
        packageRef: entry.packageRef ?? null,
        source: entry.source,
        reason: entry.selectedReason ?? null,
      })),
    selectedRouteCandidates: snapshot.selectedRouteCandidates,
    selectedBackendCandidates: snapshot.selectedBackendCandidates,
    blockedPlugins: snapshot.blockedPlugins,
    trustDecisions: snapshot.trustDecisions,
    provenance: snapshot.provenance,
  };
}

function buildLaunchOverride(
  settings: RuntimeCompositionSettingsEntry
): RuntimeCompositionProfileLaunchOverride | null {
  const preferredBackendIds =
    settings.selection.preferredBackendIds.length > 0
      ? settings.selection.preferredBackendIds
      : (settings.launchOverride?.backendPolicy?.preferredBackendIds ?? []);
  const launchOverride = settings.launchOverride;
  const routePolicy = launchOverride?.routePolicy
    ? {
        ...(launchOverride.routePolicy.preferredRoutePluginIds !== undefined
          ? {
              preferredRoutePluginIds: launchOverride.routePolicy.preferredRoutePluginIds ?? [],
            }
          : {}),
        ...(launchOverride.routePolicy.providerPreference !== undefined
          ? {
              providerPreference: launchOverride.routePolicy.providerPreference ?? [],
            }
          : {}),
        ...(launchOverride.routePolicy.allowRuntimeFallback !== null &&
        launchOverride.routePolicy.allowRuntimeFallback !== undefined
          ? {
              allowRuntimeFallback: launchOverride.routePolicy.allowRuntimeFallback,
            }
          : {}),
      }
    : undefined;
  const backendPolicy =
    preferredBackendIds.length > 0 || launchOverride?.backendPolicy?.resolvedBackendId !== undefined
      ? {
          preferredBackendIds,
          ...(launchOverride?.backendPolicy?.resolvedBackendId !== undefined
            ? {
                resolvedBackendId: launchOverride.backendPolicy.resolvedBackendId ?? null,
              }
            : {}),
        }
      : undefined;
  const executionPolicyRefs =
    launchOverride?.executionPolicyRefs !== undefined
      ? (launchOverride.executionPolicyRefs ?? [])
      : undefined;

  const nextLaunchOverride: RuntimeCompositionProfileLaunchOverride = {};
  if (routePolicy) {
    nextLaunchOverride.routePolicy = routePolicy;
  }
  if (backendPolicy) {
    nextLaunchOverride.backendPolicy = backendPolicy;
  }
  if (executionPolicyRefs !== undefined) {
    nextLaunchOverride.executionPolicyRefs = executionPolicyRefs;
  }
  return Object.keys(nextLaunchOverride).length > 0 ? nextLaunchOverride : null;
}

function createPublisherSessionId(workspaceId: string) {
  return `composition:${workspaceId}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export type SharedRuntimeCompositionState = {
  settings: RuntimeCompositionSettingsEntry | null;
  profiles: RuntimeCompositionProfile[];
  activeProfileId: string | null;
  activeProfile: RuntimeCompositionProfile | null;
  resolution: RuntimeCompositionResolution | null;
  snapshot: RuntimeCompositionResolveV2Response | null;
  previewProfileId: string | null;
  previewResolution: RuntimeCompositionResolution | null;
  previewSnapshot: RuntimeCompositionResolveV2Response | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  previewProfile: (profileId: string) => Promise<RuntimeCompositionResolveV2Response>;
  applyProfile: (profileId: string) => Promise<RuntimeCompositionResolveV2Response>;
  publishActiveResolution: () => Promise<RuntimeCompositionResolveV2Response>;
  saveSettings: (
    next:
      | RuntimeCompositionSettingsEntry
      | ((current: RuntimeCompositionSettingsEntry) => RuntimeCompositionSettingsEntry)
  ) => Promise<RuntimeCompositionSettingsEntry>;
  clearPreview: () => void;
};

type UseSharedRuntimeCompositionStateOptions = {
  workspaceId: string | null;
  enabled?: boolean;
};

const EMPTY_PROFILES: RuntimeCompositionProfile[] = [];

export function useSharedRuntimeCompositionState({
  workspaceId,
  enabled = true,
}: UseSharedRuntimeCompositionStateOptions): SharedRuntimeCompositionState {
  const runtime = useWorkspaceClientRuntimeBindings();
  const composition = runtime.composition;
  const [settings, setSettings] = useState<RuntimeCompositionSettingsEntry | null>(null);
  const [profiles, setProfiles] = useState<RuntimeCompositionProfile[]>(EMPTY_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<RuntimeCompositionProfile | null>(null);
  const [resolution, setResolution] = useState<RuntimeCompositionResolution | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeCompositionResolveV2Response | null>(null);
  const [previewProfileId, setPreviewProfileId] = useState<string | null>(null);
  const [previewResolution, setPreviewResolution] = useState<RuntimeCompositionResolution | null>(
    null
  );
  const [previewSnapshot, setPreviewSnapshot] =
    useState<RuntimeCompositionResolveV2Response | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(
    async (resolvedWorkspaceId: string) => {
      if (!composition) {
        return EMPTY_PROFILES;
      }
      const summaries = await composition.listProfilesV2(resolvedWorkspaceId);
      const loaded = await Promise.all(
        summaries.map(
          async (summary) => await composition.getProfileV2(resolvedWorkspaceId, summary.id)
        )
      );
      return loaded.filter((profile): profile is RuntimeCompositionProfile => profile !== null);
    },
    [composition]
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    if (!workspaceId) {
      setIsLoading(false);
      setError("Workspace runtime composition is unavailable.");
      return;
    }
    if (!composition) {
      setIsLoading(false);
      setError("Workspace runtime composition bindings are unavailable.");
      return;
    }
    setIsLoading(true);
    try {
      const nextSettings = await composition.getSettings(workspaceId);
      const nextProfiles = await loadProfiles(workspaceId);
      const selectedProfileId = nextProfiles.some(
        (profile) => profile.id === nextSettings.selection.profileId
      )
        ? nextSettings.selection.profileId
        : null;
      const resolvedSnapshot = await composition.resolveV2({
        workspaceId,
        profileId: selectedProfileId,
        launchOverride: buildLaunchOverride(nextSettings),
      });
      setSettings(nextSettings);
      setProfiles(nextProfiles);
      setActiveProfile(resolvedSnapshot.activeProfile);
      setActiveProfileId(
        resolvedSnapshot.activeProfile?.id ??
          resolvedSnapshot.provenance.activeProfileId ??
          selectedProfileId
      );
      setSnapshot(resolvedSnapshot);
      setResolution(convertCompositionSnapshotToResolution(resolvedSnapshot));
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load runtime composition."
      );
    } finally {
      setIsLoading(false);
    }
  }, [composition, enabled, loadProfiles, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveSettings = useCallback(
    async (
      next:
        | RuntimeCompositionSettingsEntry
        | ((current: RuntimeCompositionSettingsEntry) => RuntimeCompositionSettingsEntry)
    ) => {
      if (!workspaceId || !composition) {
        throw new Error("Workspace runtime composition bindings are unavailable.");
      }
      const currentSettings = settings ?? (await composition.getSettings(workspaceId));
      const resolvedNext = typeof next === "function" ? next(currentSettings) : next;
      const savedSettings = await composition.updateSettings(workspaceId, resolvedNext);
      setSettings(savedSettings);
      return savedSettings;
    },
    [composition, settings, workspaceId]
  );

  const previewProfile = useCallback(
    async (profileId: string) => {
      if (!workspaceId || !composition) {
        throw new Error("Workspace runtime composition bindings are unavailable.");
      }
      const resolvedSettings = settings ?? (await composition.getSettings(workspaceId));
      const nextSnapshot = await composition.resolveV2({
        workspaceId,
        profileId,
        launchOverride: buildLaunchOverride(resolvedSettings),
      });
      setPreviewProfileId(profileId);
      setPreviewSnapshot(nextSnapshot);
      setPreviewResolution(convertCompositionSnapshotToResolution(nextSnapshot));
      return nextSnapshot;
    },
    [composition, settings, workspaceId]
  );

  const applyProfile = useCallback(
    async (profileId: string) => {
      if (!workspaceId || !composition) {
        throw new Error("Workspace runtime composition bindings are unavailable.");
      }
      setIsMutating(true);
      try {
        const savedSettings = await saveSettings((current: RuntimeCompositionSettingsEntry) => ({
          ...current,
          selection: {
            ...current.selection,
            profileId,
          },
        }));
        const nextSnapshot = await composition.resolveV2({
          workspaceId,
          profileId,
          launchOverride: buildLaunchOverride(savedSettings),
        });
        setActiveProfile(nextSnapshot.activeProfile);
        setActiveProfileId(
          nextSnapshot.activeProfile?.id ?? nextSnapshot.provenance.activeProfileId
        );
        setSnapshot(nextSnapshot);
        setResolution(convertCompositionSnapshotToResolution(nextSnapshot));
        setPreviewProfileId(profileId);
        setPreviewSnapshot(nextSnapshot);
        setPreviewResolution(convertCompositionSnapshotToResolution(nextSnapshot));
        setError(null);
        return nextSnapshot;
      } finally {
        setIsMutating(false);
      }
    },
    [composition, saveSettings, workspaceId]
  );

  const publishActiveResolution = useCallback(async () => {
    if (!workspaceId || !composition) {
      throw new Error("Workspace runtime composition bindings are unavailable.");
    }
    setIsMutating(true);
    try {
      const resolvedSettings = settings ?? (await composition.getSettings(workspaceId));
      const resolvedProfiles = profiles.length > 0 ? profiles : await loadProfiles(workspaceId);
      const resolvedSnapshot =
        snapshot ??
        (await composition.resolveV2({
          workspaceId,
          profileId: resolvedSettings.selection.profileId,
          launchOverride: buildLaunchOverride(resolvedSettings),
        }));
      const nextAuthorityRevision =
        Math.max(
          resolvedSettings.persistence.lastAcceptedAuthorityRevision ?? 0,
          resolvedSnapshot.authorityRevision ?? 0
        ) + 1;
      const publisherSessionId =
        resolvedSettings.persistence.publisherSessionId ?? createPublisherSessionId(workspaceId);
      const publishResult = await composition.publishSnapshotV1({
        workspaceId,
        profiles: resolvedProfiles,
        snapshot: resolvedSnapshot,
        authorityRevision: nextAuthorityRevision,
        publisherSessionId,
      });
      const nextSettings = await saveSettings((current: RuntimeCompositionSettingsEntry) => ({
        ...current,
        persistence: {
          ...current.persistence,
          publisherSessionId,
          lastAcceptedAuthorityRevision:
            publishResult.lastAcceptedRevision ?? publishResult.authorityRevision,
          lastPublishAttemptAt: publishResult.lastPublishAttemptAt,
          lastPublishedAt: publishResult.publishedAt,
        },
      }));
      const nextSnapshot = {
        ...resolvedSnapshot,
        authorityState: publishResult.authorityState,
        freshnessState: publishResult.freshnessState,
        authorityRevision: publishResult.authorityRevision,
        lastAcceptedRevision: publishResult.lastAcceptedRevision,
        lastPublishAttemptAt: publishResult.lastPublishAttemptAt,
        publishedAt: publishResult.publishedAt,
        publisherSessionId: publishResult.publisherSessionId,
      } satisfies RuntimeCompositionResolveV2Response;
      setSettings(nextSettings);
      setSnapshot(nextSnapshot);
      setResolution(convertCompositionSnapshotToResolution(nextSnapshot));
      setActiveProfile(nextSnapshot.activeProfile);
      setActiveProfileId(
        nextSnapshot.activeProfile?.id ??
          nextSnapshot.provenance.activeProfileId ??
          resolvedSettings.selection.profileId
      );
      setError(null);
      return nextSnapshot;
    } finally {
      setIsMutating(false);
    }
  }, [composition, loadProfiles, profiles, saveSettings, settings, snapshot, workspaceId]);

  const clearPreview = useCallback(() => {
    setPreviewProfileId(null);
    setPreviewResolution(null);
    setPreviewSnapshot(null);
  }, []);

  return useMemo(
    () => ({
      settings,
      profiles,
      activeProfileId,
      activeProfile,
      resolution,
      snapshot,
      previewProfileId,
      previewResolution,
      previewSnapshot,
      isLoading,
      isMutating,
      error,
      refresh,
      previewProfile,
      applyProfile,
      publishActiveResolution,
      saveSettings,
      clearPreview,
    }),
    [
      activeProfile,
      activeProfileId,
      applyProfile,
      clearPreview,
      error,
      isLoading,
      isMutating,
      previewProfile,
      previewProfileId,
      previewResolution,
      previewSnapshot,
      profiles,
      publishActiveResolution,
      refresh,
      resolution,
      saveSettings,
      settings,
      snapshot,
    ]
  );
}

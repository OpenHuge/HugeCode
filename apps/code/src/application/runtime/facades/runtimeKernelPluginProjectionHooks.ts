import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  getKernelProjectionStore,
  readCapabilitiesProjectionSlice,
  readExtensionsProjectionSlice,
} from "@ku0/code-workspace-client";
import type {
  RuntimeCompositionProfile,
  RuntimeCompositionResolveV2Response,
  RuntimeCompositionResolution,
  RuntimeRegistryPackageDescriptor,
} from "@ku0/code-runtime-host-contract";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPlugins";
import { mergeRuntimeKernelProjectionPlugins } from "./runtimeKernelPluginProjection";
import { useWorkspaceRuntimePluginCatalog } from "./runtimeKernelPluginCatalogFacadeHooks";
import {
  useWorkspaceRuntimeComposition,
  useWorkspaceRuntimePluginRegistry,
} from "./runtimeKernelControlPlaneFacadeHooks";

export type WorkspaceRuntimePluginProjectionState = {
  plugins: RuntimeKernelPluginDescriptor[];
  loading: boolean;
  error: string | null;
  projectionBacked: boolean;
  refresh: () => Promise<void>;
  registry: {
    packages: RuntimeRegistryPackageDescriptor[];
    installedCount: number;
    verifiedCount: number;
    blockedCount: number;
    error: string | null;
  };
  composition: {
    profiles: RuntimeCompositionProfile[];
    activeProfileId: string | null;
    activeProfile: RuntimeCompositionProfile | null;
    resolution: RuntimeCompositionResolution | null;
    snapshot: RuntimeCompositionResolveV2Response | null;
    error: string | null;
  };
};

function formatPluginProjectionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

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

function collectRegistryPackagesFromSnapshot(
  snapshot: RuntimeCompositionResolveV2Response | null
): RuntimeRegistryPackageDescriptor[] {
  if (!snapshot) {
    return [];
  }
  const packages = new Map<string, RuntimeRegistryPackageDescriptor>();
  for (const entry of snapshot.pluginEntries) {
    if (!entry.registryPackage) {
      continue;
    }
    packages.set(entry.registryPackage.packageRef, entry.registryPackage);
  }
  return [...packages.values()].sort((left, right) =>
    left.packageRef.localeCompare(right.packageRef)
  );
}

export function useWorkspaceRuntimePluginProjection(input: {
  workspaceId: string | null;
  enabled: boolean;
}): WorkspaceRuntimePluginProjectionState {
  const runtimeKernel = useRuntimeKernel();
  const kernelProjectionEnabled =
    runtimeKernel.workspaceClientRuntime.kernelProjection !== undefined;
  const pluginCatalog = useWorkspaceRuntimePluginCatalog(input.workspaceId);
  const pluginRegistry = useWorkspaceRuntimePluginRegistry(input.workspaceId);
  const compositionRuntime = useWorkspaceRuntimeComposition(input.workspaceId);
  const kernelProjectionStore = getKernelProjectionStore(runtimeKernel.workspaceClientRuntime);
  const kernelProjectionState = useSyncExternalStore(
    kernelProjectionStore.subscribe,
    kernelProjectionStore.getSnapshot,
    kernelProjectionStore.getSnapshot
  );
  const extensionBundles = readExtensionsProjectionSlice(kernelProjectionState);
  const capabilityProjection = readCapabilitiesProjectionSlice(kernelProjectionState);
  const projectionBacked = extensionBundles !== null || capabilityProjection !== null;
  const [capabilityPlugins, setCapabilityPlugins] = useState<RuntimeKernelPluginDescriptor[]>([]);
  const [registryPackages, setRegistryPackages] = useState<RuntimeRegistryPackageDescriptor[]>([]);
  const [compositionProfiles, setCompositionProfiles] = useState<RuntimeCompositionProfile[]>([]);
  const [compositionResolution, setCompositionResolution] =
    useState<RuntimeCompositionResolution | null>(null);
  const [compositionSnapshot, setCompositionSnapshot] =
    useState<RuntimeCompositionResolveV2Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [compositionError, setCompositionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!input.enabled) {
      setCapabilityPlugins([]);
      setRegistryPackages([]);
      setCompositionProfiles([]);
      setCompositionResolution(null);
      setCompositionSnapshot(null);
      setLoading(false);
      setError(null);
      setRegistryError(null);
      setCompositionError(null);
      return;
    }

    if (!pluginRegistry || !compositionRuntime || (!kernelProjectionEnabled && !pluginCatalog)) {
      setCapabilityPlugins([]);
      setRegistryPackages([]);
      setCompositionProfiles([]);
      setCompositionResolution(null);
      setCompositionSnapshot(null);
      setLoading(false);
      setError(null);
      setRegistryError(null);
      setCompositionError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setRegistryError(null);
    setCompositionError(null);

    const pluginPromise = kernelProjectionEnabled
      ? Promise.resolve<RuntimeKernelPluginDescriptor[]>([])
      : pluginCatalog!.listPlugins();

    const [pluginsResult, profilesResult, snapshotResult] = await Promise.allSettled([
      pluginPromise,
      compositionRuntime.listProfiles(),
      compositionRuntime.getActiveResolutionV2(),
    ]);

    if (pluginsResult.status === "fulfilled") {
      setCapabilityPlugins(pluginsResult.value);
      setError(null);
    } else {
      setCapabilityPlugins([]);
      setError(
        formatPluginProjectionError(pluginsResult.reason, "Unable to load runtime plugins.")
      );
    }

    if (snapshotResult.status === "fulfilled") {
      const nextPackages = collectRegistryPackagesFromSnapshot(snapshotResult.value);
      setRegistryPackages(nextPackages);
      setRegistryError(null);
      setCompositionSnapshot(snapshotResult.value);
      setCompositionResolution(convertCompositionSnapshotToResolution(snapshotResult.value));
    } else {
      setRegistryPackages([]);
      setCompositionSnapshot(null);
      setCompositionResolution(null);
      setRegistryError(
        formatPluginProjectionError(
          snapshotResult.reason,
          "Unable to resolve runtime package registry truth."
        )
      );
    }

    if (profilesResult.status === "fulfilled") {
      setCompositionProfiles(profilesResult.value);
      setCompositionError(null);
    } else {
      setCompositionProfiles([]);
      setCompositionError(
        formatPluginProjectionError(
          profilesResult.reason,
          "Unable to load runtime composition profiles."
        )
      );
    }

    if (snapshotResult.status === "rejected") {
      setCompositionError(
        (current) =>
          current ??
          formatPluginProjectionError(
            snapshotResult.reason,
            "Unable to resolve runtime composition control plane."
          )
      );
    } else if (profilesResult.status !== "rejected") {
      setCompositionError(null);
    }

    setLoading(false);
  }, [compositionRuntime, input.enabled, kernelProjectionEnabled, pluginCatalog, pluginRegistry]);

  useEffect(() => {
    if (!input.enabled || !runtimeKernel.workspaceClientRuntime.kernelProjection) {
      return;
    }
    kernelProjectionStore.ensureScopes(["extensions", "capabilities"]);
  }, [input.enabled, kernelProjectionStore, runtimeKernel.workspaceClientRuntime.kernelProjection]);

  useEffect(() => {
    let cancelled = false;

    void refresh().catch((nextError: unknown) => {
      if (cancelled) {
        return;
      }
      setCapabilityPlugins([]);
      setRegistryPackages([]);
      setCompositionProfiles([]);
      setCompositionResolution(null);
      setCompositionSnapshot(null);
      setLoading(false);
      setError(nextError instanceof Error ? nextError.message : "Unable to load runtime plugins.");
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const activeProfileId = compositionResolution?.provenance.activeProfileId ?? null;
  const activeProfile =
    compositionSnapshot?.activeProfile ??
    compositionProfiles.find((profile) => profile.id === activeProfileId) ??
    null;

  return {
    plugins: mergeRuntimeKernelProjectionPlugins({
      extensionBundles,
      capabilities: capabilityProjection,
      capabilityPlugins,
      registryPackages,
      compositionResolution,
      compositionSnapshot,
    }),
    loading,
    error: error ?? registryError ?? compositionError,
    projectionBacked,
    refresh,
    registry: {
      packages: registryPackages,
      installedCount: registryPackages.filter((entry) => entry.installed).length,
      verifiedCount: registryPackages.filter(
        (entry) => entry.trust.status === "verified" || entry.trust.status === "runtime_managed"
      ).length,
      blockedCount: registryPackages.filter((entry) => entry.trust.status === "blocked").length,
      error: registryError,
    },
    composition: {
      profiles: compositionProfiles,
      activeProfileId,
      activeProfile,
      resolution: compositionResolution,
      snapshot: compositionSnapshot,
      error: compositionError,
    },
  };
}

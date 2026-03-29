import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  getKernelProjectionStore,
  readCapabilitiesProjectionSlice,
  readExtensionsProjectionSlice,
} from "@ku0/code-workspace-client";
import type {
  RuntimeCompositionProfile,
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
    error: string | null;
  };
};

function formatPluginProjectionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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

    const [pluginsResult, packagesResult, profilesResult, resolutionResult] =
      await Promise.allSettled([
        pluginPromise,
        pluginRegistry.listInstalledPackages(),
        compositionRuntime.listProfiles(),
        compositionRuntime.getActiveResolution(),
      ]);

    if (pluginsResult.status === "fulfilled") {
      setCapabilityPlugins(pluginsResult.value);
    } else {
      setCapabilityPlugins([]);
      setError(
        formatPluginProjectionError(pluginsResult.reason, "Unable to load runtime plugins.")
      );
    }

    if (packagesResult.status === "fulfilled") {
      setRegistryPackages(packagesResult.value);
    } else {
      setRegistryPackages([]);
      setRegistryError(
        formatPluginProjectionError(
          packagesResult.reason,
          "Unable to load runtime package registry."
        )
      );
    }

    if (profilesResult.status === "fulfilled") {
      setCompositionProfiles(profilesResult.value);
    } else {
      setCompositionProfiles([]);
      setCompositionError(
        formatPluginProjectionError(
          profilesResult.reason,
          "Unable to load runtime composition profiles."
        )
      );
    }

    if (resolutionResult.status === "fulfilled") {
      setCompositionResolution(resolutionResult.value);
    } else {
      setCompositionResolution(null);
      setCompositionError(
        (current) =>
          current ??
          formatPluginProjectionError(
            resolutionResult.reason,
            "Unable to resolve runtime composition control plane."
          )
      );
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
      setLoading(false);
      setError(nextError instanceof Error ? nextError.message : "Unable to load runtime plugins.");
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const activeProfileId = compositionResolution?.provenance.activeProfileId ?? null;
  const activeProfile =
    compositionProfiles.find((profile) => profile.id === activeProfileId) ?? null;

  return {
    plugins: mergeRuntimeKernelProjectionPlugins({
      extensionBundles,
      capabilities: capabilityProjection,
      capabilityPlugins,
      registryPackages,
      compositionResolution,
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
      error: compositionError,
    },
  };
}

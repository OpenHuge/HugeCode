import { useEffect, useState, useSyncExternalStore } from "react";
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

export function useWorkspaceRuntimePluginProjection(input: {
  workspaceId: string | null;
  enabled: boolean;
}): WorkspaceRuntimePluginProjectionState {
  const runtimeKernel = useRuntimeKernel();
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
  const [capabilityPlugins, setCapabilityPlugins] = useState<RuntimeKernelPluginDescriptor[]>([]);
  const [registryPackages, setRegistryPackages] = useState<RuntimeRegistryPackageDescriptor[]>([]);
  const [compositionProfiles, setCompositionProfiles] = useState<RuntimeCompositionProfile[]>([]);
  const [compositionResolution, setCompositionResolution] =
    useState<RuntimeCompositionResolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [compositionError, setCompositionError] = useState<string | null>(null);

  useEffect(() => {
    if (!input.enabled || !runtimeKernel.workspaceClientRuntime.kernelProjection) {
      return;
    }
    kernelProjectionStore.ensureScopes(["extensions", "capabilities"]);
  }, [input.enabled, kernelProjectionStore, runtimeKernel.workspaceClientRuntime.kernelProjection]);

  useEffect(() => {
    let cancelled = false;

    if (!input.enabled || !pluginCatalog || !pluginRegistry || !compositionRuntime) {
      setCapabilityPlugins([]);
      setRegistryPackages([]);
      setCompositionProfiles([]);
      setCompositionResolution(null);
      setLoading(false);
      setError(null);
      setRegistryError(null);
      setCompositionError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    void Promise.all([
      pluginCatalog.listPlugins(),
      pluginRegistry.listInstalledPackages(),
      compositionRuntime.listProfiles(),
      compositionRuntime.getActiveResolution(),
    ])
      .then(([plugins, packages, profiles, resolution]) => {
        if (cancelled) {
          return;
        }
        setCapabilityPlugins(plugins);
        setRegistryPackages(packages);
        setCompositionProfiles(profiles);
        setCompositionResolution(resolution);
        setLoading(false);
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return;
        }
        setCapabilityPlugins([]);
        setRegistryPackages([]);
        setCompositionProfiles([]);
        setCompositionResolution(null);
        setLoading(false);
        setError(
          nextError instanceof Error ? nextError.message : "Unable to load runtime plugins."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [compositionRuntime, input.enabled, pluginCatalog, pluginRegistry]);

  useEffect(() => {
    let cancelled = false;

    if (!input.enabled || !pluginRegistry) {
      setRegistryError(null);
      return () => {
        cancelled = true;
      };
    }

    void pluginRegistry.listInstalledPackages().catch((nextError: unknown) => {
      if (cancelled) {
        return;
      }
      setRegistryError(
        nextError instanceof Error ? nextError.message : "Unable to load runtime package registry."
      );
    });

    return () => {
      cancelled = true;
    };
  }, [input.enabled, pluginRegistry]);

  useEffect(() => {
    let cancelled = false;

    if (!input.enabled || !compositionRuntime) {
      setCompositionError(null);
      return () => {
        cancelled = true;
      };
    }

    void compositionRuntime.getActiveResolution().catch((nextError: unknown) => {
      if (cancelled) {
        return;
      }
      setCompositionError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to resolve runtime composition control plane."
      );
    });

    return () => {
      cancelled = true;
    };
  }, [compositionRuntime, input.enabled]);

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
    projectionBacked: extensionBundles !== null || capabilityProjection !== null,
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

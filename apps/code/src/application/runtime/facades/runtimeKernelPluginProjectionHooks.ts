import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getKernelProjectionStore,
  readCapabilitiesProjectionSlice,
  readExtensionsProjectionSlice,
} from "@ku0/code-workspace-client";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPlugins";
import { mergeRuntimeKernelProjectionPlugins } from "./runtimeKernelPluginProjection";
import { useWorkspaceRuntimePluginCatalog } from "./runtimeKernelPluginCatalogFacadeHooks";

export type WorkspaceRuntimePluginProjectionState = {
  plugins: RuntimeKernelPluginDescriptor[];
  loading: boolean;
  error: string | null;
  projectionBacked: boolean;
};

export function useWorkspaceRuntimePluginProjection(input: {
  workspaceId: string | null;
  enabled: boolean;
}): WorkspaceRuntimePluginProjectionState {
  const runtimeKernel = useRuntimeKernel();
  const pluginCatalog = useWorkspaceRuntimePluginCatalog(input.workspaceId);
  const kernelProjectionStore = getKernelProjectionStore(runtimeKernel.workspaceClientRuntime);
  const kernelProjectionState = useSyncExternalStore(
    kernelProjectionStore.subscribe,
    kernelProjectionStore.getSnapshot,
    kernelProjectionStore.getSnapshot
  );
  const extensionBundles = readExtensionsProjectionSlice(kernelProjectionState);
  const capabilityProjection = readCapabilitiesProjectionSlice(kernelProjectionState);
  const [capabilityPlugins, setCapabilityPlugins] = useState<RuntimeKernelPluginDescriptor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input.enabled || !runtimeKernel.workspaceClientRuntime.kernelProjection) {
      return;
    }
    kernelProjectionStore.ensureScopes(["extensions", "capabilities"]);
  }, [input.enabled, kernelProjectionStore, runtimeKernel.workspaceClientRuntime.kernelProjection]);

  useEffect(() => {
    let cancelled = false;

    if (!input.enabled || !pluginCatalog) {
      setCapabilityPlugins([]);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    void pluginCatalog
      .listPlugins()
      .then((plugins) => {
        if (cancelled) {
          return;
        }
        setCapabilityPlugins(plugins);
        setLoading(false);
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return;
        }
        setCapabilityPlugins([]);
        setLoading(false);
        setError(
          nextError instanceof Error ? nextError.message : "Unable to load runtime plugins."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [input.enabled, pluginCatalog]);

  return {
    plugins: mergeRuntimeKernelProjectionPlugins({
      extensionBundles,
      capabilities: capabilityProjection,
      capabilityPlugins,
    }),
    loading,
    error,
    projectionBacked: extensionBundles !== null || capabilityProjection !== null,
  };
}

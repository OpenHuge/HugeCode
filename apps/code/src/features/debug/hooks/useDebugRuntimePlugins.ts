import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getKernelProjectionStore,
  readExtensionsProjectionSlice,
} from "@ku0/code-workspace-client";
import { useRuntimeKernel } from "../../../application/runtime/kernel/RuntimeKernelContext";
import { mergeRuntimeKernelProjectionPlugins } from "../../../application/runtime/facades/runtimeKernelPluginProjection";
import { useWorkspaceRuntimePluginCatalog } from "../../../application/runtime/facades/runtimeKernelPluginCatalogFacadeHooks";
import type { RuntimeKernelPluginDescriptor } from "../../../application/runtime/kernel/runtimeKernelPlugins";

export type DebugRuntimePluginsState = {
  plugins: RuntimeKernelPluginDescriptor[];
  loading: boolean;
  error: string | null;
  projectionBacked: boolean;
};

export function useDebugRuntimePlugins(input: {
  workspaceId: string | null;
  enabled: boolean;
}): DebugRuntimePluginsState {
  const runtimeKernel = useRuntimeKernel();
  const pluginCatalog = useWorkspaceRuntimePluginCatalog(input.workspaceId);
  const kernelProjectionStore = getKernelProjectionStore(runtimeKernel.workspaceClientRuntime);
  const kernelProjectionState = useSyncExternalStore(
    kernelProjectionStore.subscribe,
    kernelProjectionStore.getSnapshot,
    kernelProjectionStore.getSnapshot
  );
  const extensionBundles = readExtensionsProjectionSlice(kernelProjectionState);
  const [capabilityPlugins, setCapabilityPlugins] = useState<RuntimeKernelPluginDescriptor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input.enabled || !runtimeKernel.workspaceClientRuntime.kernelProjection) {
      return;
    }
    kernelProjectionStore.ensureScopes(["extensions"]);
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
      capabilityPlugins,
    }),
    loading,
    error,
    projectionBacked: extensionBundles !== null,
  };
}

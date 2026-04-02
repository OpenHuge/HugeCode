import { useCallback, useState } from "react";
import type {
  RuntimeCompositionResolution,
  RuntimeCompositionResolveV2Response,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeKernelCompositionFacade } from "../kernel/runtimeKernelComposition";
import type { RuntimeKernelPluginRegistryFacade } from "../kernel/runtimeKernelPluginRegistry";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  resolveWorkspaceRuntimeCapability,
} from "../kernel/runtimeKernelCapabilities";
import type { RuntimeControlPlaneOperatorAction } from "./runtimeKernelControlPlaneOperatorModel";

export type RuntimeControlPlaneOperatorState = {
  busyActionId: string | null;
  error: string | null;
  info: string | null;
  previewProfileId: string | null;
  previewResolution: RuntimeCompositionResolution | null;
  previewSnapshot: RuntimeCompositionResolveV2Response | null;
  clearPreview: () => void;
  runAction: (action: RuntimeControlPlaneOperatorAction) => Promise<void>;
};

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

export function useWorkspaceRuntimePluginRegistry(
  workspaceId: string | null
): RuntimeKernelPluginRegistryFacade | null {
  const runtimeKernel = useRuntimeKernel();
  if (!workspaceId) {
    return null;
  }
  return resolveWorkspaceRuntimeCapability(
    runtimeKernel.getWorkspaceScope(workspaceId),
    RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry
  );
}

export function useWorkspaceRuntimeComposition(
  workspaceId: string | null
): RuntimeKernelCompositionFacade | null {
  const runtimeKernel = useRuntimeKernel();
  if (!workspaceId) {
    return null;
  }
  return resolveWorkspaceRuntimeCapability(
    runtimeKernel.getWorkspaceScope(workspaceId),
    RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime
  );
}

export function useWorkspaceRuntimeControlPlaneOperatorState(input: {
  workspaceId: string | null;
  refresh: () => Promise<void>;
}): RuntimeControlPlaneOperatorState {
  const { refresh, workspaceId } = input;
  const pluginRegistry = useWorkspaceRuntimePluginRegistry(input.workspaceId);
  const compositionRuntime = useWorkspaceRuntimeComposition(input.workspaceId);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [previewProfileId, setPreviewProfileId] = useState<string | null>(null);
  const [previewResolution, setPreviewResolution] = useState<RuntimeCompositionResolution | null>(
    null
  );
  const [previewSnapshot, setPreviewSnapshot] =
    useState<RuntimeCompositionResolveV2Response | null>(null);

  const clearPreview = useCallback(() => {
    setPreviewProfileId(null);
    setPreviewResolution(null);
    setPreviewSnapshot(null);
  }, []);

  const runAction = useCallback(
    async (action: RuntimeControlPlaneOperatorAction) => {
      if (!workspaceId) {
        setError("Workspace runtime control plane is unavailable.");
        return;
      }
      setBusyActionId(action.id);
      setError(null);
      try {
        switch (action.kind) {
          case "install": {
            if (!pluginRegistry || !action.packageRef) {
              throw new Error("Runtime plugin registry is unavailable.");
            }
            const result = await pluginRegistry.installPackage({
              packageRef: action.packageRef,
            });
            if (!result.installed) {
              throw new Error(result.blockedReason ?? `Failed to install ${action.packageRef}.`);
            }
            await refresh();
            setInfo(`Installed runtime plugin package ${action.packageRef}.`);
            break;
          }
          case "install_with_dev_override": {
            if (!pluginRegistry || !action.packageRef) {
              throw new Error("Runtime plugin registry is unavailable.");
            }
            const result = await pluginRegistry.installPackage({
              packageRef: action.packageRef,
              trustOverride: "allow_unsigned_local_dev",
            });
            if (!result.installed) {
              throw new Error(
                result.blockedReason ??
                  `Failed to install ${action.packageRef} with a development trust override.`
              );
            }
            await refresh();
            setInfo(`Installed ${action.packageRef} with a development trust override.`);
            break;
          }
          case "update": {
            if (!pluginRegistry || (!action.packageRef && !action.pluginId)) {
              throw new Error("Runtime plugin registry is unavailable.");
            }
            const updateTarget = action.packageRef ?? action.pluginId;
            if (!updateTarget) {
              throw new Error("Runtime plugin registry is unavailable.");
            }
            const result = await pluginRegistry.updatePackage(updateTarget);
            if (result.blockedReason) {
              throw new Error(result.blockedReason);
            }
            await refresh();
            setInfo(
              result.updated
                ? `Updated runtime plugin package ${updateTarget}.`
                : `Checked runtime plugin package ${updateTarget}; no update was applied.`
            );
            break;
          }
          case "uninstall": {
            if (!pluginRegistry || !action.pluginId) {
              throw new Error("Runtime plugin registry is unavailable.");
            }
            const result = await pluginRegistry.uninstallPackage(action.pluginId);
            if (!result.removed) {
              throw new Error(result.blockedReason ?? `Failed to uninstall ${action.pluginId}.`);
            }
            await refresh();
            clearPreview();
            setInfo(`Uninstalled runtime plugin package ${result.packageRef}.`);
            break;
          }
          case "preview_profile": {
            if (!compositionRuntime || !action.profileId) {
              throw new Error("Runtime composition control plane is unavailable.");
            }
            const result = await compositionRuntime.previewResolutionV2({
              profileId: action.profileId,
            });
            setPreviewProfileId(action.profileId);
            setPreviewSnapshot(result);
            setPreviewResolution(convertCompositionSnapshotToResolution(result));
            setInfo(`Previewed runtime composition profile ${action.profileId}.`);
            break;
          }
          case "apply_profile": {
            if (!compositionRuntime || !action.profileId) {
              throw new Error("Runtime composition control plane is unavailable.");
            }
            const result = await compositionRuntime.applyProfileV2({
              profileId: action.profileId,
            });
            setPreviewProfileId(action.profileId);
            setPreviewSnapshot(result);
            setPreviewResolution(convertCompositionSnapshotToResolution(result));
            await refresh();
            setInfo(`Applied runtime composition profile ${action.profileId}.`);
            break;
          }
        }
      } catch (nextError) {
        setInfo(null);
        setError(
          nextError instanceof Error ? nextError.message : "Runtime control-plane action failed."
        );
      } finally {
        setBusyActionId(null);
      }
    },
    [clearPreview, compositionRuntime, pluginRegistry, refresh, workspaceId]
  );

  return {
    busyActionId,
    error,
    info,
    previewProfileId,
    previewResolution,
    previewSnapshot,
    clearPreview,
    runAction,
  };
}

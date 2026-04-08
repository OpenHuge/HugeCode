import { useCallback, useMemo, useState } from "react";
import type {
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimeCompositionResolveV2Response,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeControlPlaneOperatorAction } from "@ku0/code-application/runtimeControlPlaneOperatorModel";
import { useSharedRuntimeCompositionState } from "@ku0/code-workspace-client/settings-state";
import type { RuntimeKernelCompositionFacade } from "../kernel/runtimeKernelComposition";
import type { RuntimeKernelPluginRegistryFacade } from "../kernel/runtimeKernelPluginRegistry";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  resolveWorkspaceRuntimeCapability,
} from "../kernel/runtimeKernelCapabilities";

export type RuntimeControlPlaneOperatorState = {
  busyActionId: string | null;
  error: string | null;
  info: string | null;
  profiles: RuntimeCompositionProfile[];
  activeProfileId: string | null;
  activeProfile: RuntimeCompositionProfile | null;
  resolution: RuntimeCompositionResolution | null;
  snapshot: RuntimeCompositionResolveV2Response | null;
  compositionError: string | null;
  compositionLoading: boolean;
  previewProfileId: string | null;
  previewResolution: RuntimeCompositionResolution | null;
  previewSnapshot: RuntimeCompositionResolveV2Response | null;
  clearPreview: () => void;
  runAction: (action: RuntimeControlPlaneOperatorAction) => Promise<void>;
};

export function useWorkspaceRuntimePluginRegistry(
  workspaceId: string | null
): RuntimeKernelPluginRegistryFacade | null {
  const runtimeKernel = useRuntimeKernel();
  const workspaceScope = useMemo(
    () => (workspaceId ? runtimeKernel.getWorkspaceScope(workspaceId) : null),
    [runtimeKernel, workspaceId]
  );

  return useMemo(
    () =>
      workspaceScope
        ? resolveWorkspaceRuntimeCapability(
            workspaceScope,
            RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry
          )
        : null,
    [workspaceScope]
  );
}

export function useWorkspaceRuntimeComposition(
  workspaceId: string | null
): RuntimeKernelCompositionFacade | null {
  const runtimeKernel = useRuntimeKernel();
  const workspaceScope = useMemo(
    () => (workspaceId ? runtimeKernel.getWorkspaceScope(workspaceId) : null),
    [runtimeKernel, workspaceId]
  );

  return useMemo(
    () =>
      workspaceScope
        ? resolveWorkspaceRuntimeCapability(
            workspaceScope,
            RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime
          )
        : null,
    [workspaceScope]
  );
}

export function useWorkspaceRuntimeControlPlaneOperatorState(input: {
  workspaceId: string | null;
  refresh: () => Promise<void>;
}): RuntimeControlPlaneOperatorState {
  const { refresh, workspaceId } = input;
  const pluginRegistry = useWorkspaceRuntimePluginRegistry(input.workspaceId);
  const runtimeComposition = useSharedRuntimeCompositionState({
    workspaceId,
    enabled: workspaceId !== null,
  });
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const clearPreview = useCallback(() => {
    runtimeComposition.clearPreview();
  }, [runtimeComposition]);

  const runAction = useCallback(
    async (action: RuntimeControlPlaneOperatorAction) => {
      if (!workspaceId) {
        setLocalError("Workspace runtime control plane is unavailable.");
        return;
      }
      setBusyActionId(action.id);
      setLocalError(null);
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
            await runtimeComposition.publishActiveResolution();
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
            await runtimeComposition.publishActiveResolution();
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
            await runtimeComposition.publishActiveResolution();
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
            await runtimeComposition.publishActiveResolution();
            await refresh();
            clearPreview();
            setInfo(`Uninstalled runtime plugin package ${result.packageRef}.`);
            break;
          }
          case "preview_profile": {
            if (!action.profileId) {
              throw new Error("Runtime composition control plane is unavailable.");
            }
            await runtimeComposition.previewProfile(action.profileId);
            setInfo(`Previewed runtime composition profile ${action.profileId}.`);
            break;
          }
          case "apply_profile": {
            if (!action.profileId) {
              throw new Error("Runtime composition control plane is unavailable.");
            }
            await runtimeComposition.applyProfile(action.profileId);
            await refresh();
            setInfo(`Applied runtime composition profile ${action.profileId}.`);
            break;
          }
        }
      } catch (nextError) {
        setInfo(null);
        setLocalError(
          nextError instanceof Error ? nextError.message : "Runtime control-plane action failed."
        );
      } finally {
        setBusyActionId(null);
      }
    },
    [clearPreview, pluginRegistry, refresh, runtimeComposition, workspaceId]
  );

  return {
    busyActionId,
    error: localError ?? runtimeComposition.error,
    info,
    profiles: runtimeComposition.profiles,
    activeProfileId: runtimeComposition.activeProfileId,
    activeProfile: runtimeComposition.activeProfile,
    resolution: runtimeComposition.resolution,
    snapshot: runtimeComposition.snapshot,
    compositionError: runtimeComposition.error,
    compositionLoading: runtimeComposition.isLoading || runtimeComposition.isMutating,
    previewProfileId: runtimeComposition.previewProfileId,
    previewResolution: runtimeComposition.previewResolution,
    previewSnapshot: runtimeComposition.previewSnapshot,
    clearPreview,
    runAction,
  };
}

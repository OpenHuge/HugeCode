import { createDesktopHostAdapter } from "../adapters/DesktopHostAdapter";
import { createRuntimeGateway } from "../facades/RuntimeGateway";
import { createRuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import { createRuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import { discoverLocalRuntimeGatewayTargets } from "../facades/discoverLocalRuntimeGatewayTargets";
import { configureManualWebRuntimeGatewayTarget } from "../ports/runtimeWebGatewayConfig";
import { getMissionControlSnapshot } from "../ports/tauriMissionControl";
import { detectRuntimeMode, readRuntimeCapabilitiesSummary } from "../ports/runtimeClient";
import { createWorkspaceRuntimeScope } from "./createWorkspaceRuntimeScope";
import { createRuntimeAgentControlDependencies } from "./createRuntimeAgentControlDependencies";
import { createWorkspaceClientRuntimeBindings } from "./createWorkspaceClientRuntimeBindings";
import type { RuntimeKernel } from "./runtimeKernelTypes";
import type { WorkspaceClientRuntimeMode } from "@ku0/code-workspace-client";
import { subscribeConfiguredWebRuntimeGatewayProfile } from "../../../services/runtimeWebGatewayConfig";
import {
  bootstrapRuntimeKernelProjection,
  subscribeRuntimeKernelProjection,
} from "../../../services/runtimeKernelProjectionTransport";
import { createRuntimeKernelPluginCatalogFacade } from "./runtimeKernelPlugins";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  type WorkspaceRuntimeCapabilityProvider,
} from "./runtimeKernelCapabilities";
import { createRuntimeKernelPluginRegistryFacade } from "./runtimeKernelPluginRegistry";
import { createRuntimeKernelCompositionFacade } from "./runtimeKernelComposition";

function mapWorkspaceClientRuntimeMode(
  mode: ReturnType<typeof detectRuntimeMode>
): WorkspaceClientRuntimeMode {
  return mode === "unavailable" ? "unavailable" : "connected";
}

export function createRuntimeKernel(): RuntimeKernel {
  const runtimeGateway = createRuntimeGateway({
    detectMode: detectRuntimeMode,
    discoverLocalTargets: discoverLocalRuntimeGatewayTargets,
    configureManualWebTarget: configureManualWebRuntimeGatewayTarget,
    readCapabilitiesSummary: readRuntimeCapabilitiesSummary,
    readMissionControlSnapshot: getMissionControlSnapshot,
  });
  const desktopHost = createDesktopHostAdapter();
  const readMissionControlSnapshot = () => runtimeGateway.readMissionControlSnapshot();
  const workspaceClientRuntime = createWorkspaceClientRuntimeBindings({
    readMissionControlSnapshot,
    bootstrapKernelProjection: bootstrapRuntimeKernelProjection,
    subscribeKernelProjection: subscribeRuntimeKernelProjection,
  });
  const workspaceScopeCache = new Map<string, ReturnType<typeof createWorkspaceRuntimeScope>>();

  return {
    runtimeGateway,
    workspaceClientRuntimeGateway: {
      readRuntimeMode: () => mapWorkspaceClientRuntimeMode(runtimeGateway.detectMode()),
      subscribeRuntimeMode: subscribeConfiguredWebRuntimeGatewayProfile,
      discoverLocalRuntimeGatewayTargets: runtimeGateway.discoverLocalTargets,
      configureManualWebRuntimeGatewayTarget: runtimeGateway.configureManualWebTarget,
    },
    workspaceClientRuntime,
    desktopHost,
    getWorkspaceScope: (workspaceId) => {
      const cachedScope = workspaceScopeCache.get(workspaceId);
      if (cachedScope) {
        return cachedScope;
      }

      const runtimeAgentControlDependencies = createRuntimeAgentControlDependencies(workspaceId, {
        workspaceClientRuntime,
      });
      const pluginCatalog = createRuntimeKernelPluginCatalogFacade({ workspaceId });
      const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
        workspaceId,
        pluginCatalog,
      });
      const compositionRuntime = createRuntimeKernelCompositionFacade({
        workspaceId,
        pluginCatalog,
        pluginRegistry,
      });
      const capabilityProviders: WorkspaceRuntimeCapabilityProvider[] = [
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl,
          createCapability: () =>
            createRuntimeAgentControlFacade(workspaceId, runtimeAgentControlDependencies),
        },
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands,
          createCapability: () => createRuntimeSessionCommandFacade(workspaceId),
        },
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog,
          createCapability: () => pluginCatalog,
        },
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry,
          createCapability: () => pluginRegistry,
        },
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime,
          createCapability: () => compositionRuntime,
        },
      ];
      const scope = createWorkspaceRuntimeScope({
        workspaceId,
        runtimeGateway,
        capabilityProviders,
      });
      workspaceScopeCache.set(workspaceId, scope);
      return scope;
    },
  };
}

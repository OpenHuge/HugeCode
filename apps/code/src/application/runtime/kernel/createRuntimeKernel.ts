import { createRuntimeExecutableSkillFacade } from "@ku0/code-application/runtimeExecutableSkillFacade";
import { createRuntimeInvocationCatalogFacade as createActivationRuntimeInvocationCatalogFacade } from "@ku0/code-application/runtimeInvocationCatalogFacade";
import type {
  KernelCapabilityDescriptor,
  KernelExtensionBundle,
} from "@ku0/code-runtime-host-contract";
import type { WorkspaceClientRuntimeMode } from "@ku0/code-workspace-client";
import { subscribeConfiguredWebRuntimeGatewayProfile } from "../../../services/runtimeWebGatewayConfig";
import {
  bootstrapRuntimeKernelProjection,
  subscribeRuntimeKernelProjection,
} from "../../../services/runtimeKernelProjectionTransport";
import { createDesktopHostAdapter } from "../adapters/DesktopHostAdapter";
import { discoverLocalRuntimeGatewayTargets } from "../facades/discoverLocalRuntimeGatewayTargets";
import { createRuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import { createRuntimeGateway } from "../facades/RuntimeGateway";
import { createRuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import { getMissionControlSnapshot } from "../ports/missionControl";
import { detectRuntimeMode, readRuntimeCapabilitiesSummary } from "../ports/runtimeClient";
import { invokeRuntimeExtensionTool, listRuntimeExtensionTools } from "../ports/runtimeExtensions";
import { startRuntimeRunV2 } from "../ports/runtimeJobs";
import { listRuntimePrompts } from "../ports/runtimePrompts";
import { runRuntimeLiveSkill } from "../ports/runtime";
import { listRuntimeLiveSkills } from "../ports/runtimeSkills";
import { configureManualWebRuntimeGatewayTarget } from "../ports/runtimeWebGatewayConfig";
import { createRuntimeAgentControlDependencies } from "./createRuntimeAgentControlDependencies";
import { createWorkspaceClientRuntimeBindings } from "./createWorkspaceClientRuntimeBindings";
import { createWorkspaceRuntimeScope } from "./createWorkspaceRuntimeScope";
import { createRuntimeExtensionActivationService } from "./runtimeExtensionActivation";
import { createRuntimeInvocationCatalogFacade } from "./runtimeInvocationCatalog";
import { createRuntimeInvocationExecuteFacade } from "./runtimeInvocationExecute";
import { createRuntimeKernelCompositionFacade } from "./runtimeKernelComposition";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  type WorkspaceRuntimeCapabilityProvider,
} from "./runtimeKernelCapabilities";
import { createRuntimeKernelPluginRegistryFacade } from "./runtimeKernelPluginRegistry";
import {
  createRuntimeKernelPluginCatalogFacade,
  createRuntimeKernelPluginExecutionProvider,
} from "./runtimeKernelPlugins";
import type { RuntimeKernel } from "./runtimeKernelTypes";
import { readRuntimeWorkspaceSkillManifests } from "./runtimeWorkspaceSkillManifests";

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

      let runtimeExecutableSkills: ReturnType<typeof createRuntimeExecutableSkillFacade> | null =
        null;
      const pluginCatalog = createRuntimeKernelPluginCatalogFacade({
        workspaceId,
        executionProvider: createRuntimeKernelPluginExecutionProvider({
          executableSkills: () => runtimeExecutableSkills,
        }),
      });
      const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
        workspaceId,
        pluginCatalog,
      });
      const sessionCommands = createRuntimeSessionCommandFacade(workspaceId);
      const compositionRuntime = createRuntimeKernelCompositionFacade({
        workspaceId,
        pluginCatalog,
        pluginRegistry,
      });
      const extensionActivation = createRuntimeExtensionActivationService({
        workspaceId,
        pluginCatalog,
        pluginRegistry,
        readWorkspaceSkillManifests: readRuntimeWorkspaceSkillManifests,
        listRuntimeLiveSkills,
      });
      const activationInvocationCatalog = createActivationRuntimeInvocationCatalogFacade({
        activation: extensionActivation,
      });
      const invocationCatalog = createRuntimeInvocationCatalogFacade({
        workspaceId,
        pluginCatalog,
        readProjection: async () => {
          if (!workspaceClientRuntime.kernelProjection) {
            return {
              projectionBacked: false,
              extensionBundles: null,
              capabilities: null,
            };
          }
          const bootstrap = await workspaceClientRuntime.kernelProjection.bootstrap({
            scopes: ["extensions", "capabilities"],
          });
          return {
            projectionBacked: true,
            extensionBundles: Array.isArray(bootstrap.slices.extensions)
              ? (bootstrap.slices.extensions as KernelExtensionBundle[])
              : null,
            capabilities: Array.isArray(bootstrap.slices.capabilities)
              ? (bootstrap.slices.capabilities as KernelCapabilityDescriptor[])
              : null,
          };
        },
        listRuntimeExtensionTools,
        listRuntimePrompts,
      });
      runtimeExecutableSkills = createRuntimeExecutableSkillFacade({
        listRuntimeInvocations: activationInvocationCatalog.listInvocations,
        listLiveSkills: listRuntimeLiveSkills,
        runLiveSkill: runRuntimeLiveSkill,
      });
      const invocationExecute = createRuntimeInvocationExecuteFacade({
        workspaceId,
        invocationCatalog,
        sessionCommands,
        startRuntimeRun: startRuntimeRunV2,
        runRuntimeLiveSkill,
        invokeRuntimeExtensionTool,
        listRuntimePrompts,
      });
      const capabilityProviders: WorkspaceRuntimeCapabilityProvider[] = [
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl,
          createCapability: () =>
            createRuntimeAgentControlFacade(
              workspaceId,
              createRuntimeAgentControlDependencies(workspaceId, {
                workspaceClientRuntime,
                invocationCatalog: activationInvocationCatalog,
                executableSkills: runtimeExecutableSkills,
              })
            ),
        },
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands,
          createCapability: () => sessionCommands,
        },
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.invocationCatalog,
          createCapability: () => invocationCatalog,
        },
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.invocationExecute,
          createCapability: () => invocationExecute,
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
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.extensionActivation,
          createCapability: () => extensionActivation,
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

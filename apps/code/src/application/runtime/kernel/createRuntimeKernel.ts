import { createDesktopHostAdapter } from "../adapters/DesktopHostAdapter";
import { createRuntimeGateway } from "../facades/RuntimeGateway";
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
    getWorkspaceScope: (workspaceId) =>
      createWorkspaceRuntimeScope({
        workspaceId,
        runtimeGateway,
        runtimeAgentControlDependencies: createRuntimeAgentControlDependencies(workspaceId, {
          workspaceClientRuntime,
        }),
      }),
  };
}

import type {
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimeCompositionResolveV2Response,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPlugins";
import type { RuntimeAgentTaskInterventionInput } from "../types/webMcpBridge";

export function buildMissionInterventionInfoMessage(
  action: RuntimeAgentTaskInterventionInput["action"],
  taskId: string
) {
  switch (action) {
    case "replan_scope":
      return `Mission replan requested for ${taskId}.`;
    case "drop_feature":
      return `Feature drop requested for ${taskId}.`;
    case "insert_feature":
      return `Feature insertion requested for ${taskId}.`;
    case "change_validation_lane":
      return `Validation lane change requested for ${taskId}.`;
    case "change_backend_preference":
      return `Backend preference change requested for ${taskId}.`;
    case "mark_blocked_with_reason":
      return `Blocked state recorded for ${taskId}.`;
    default:
      return `Mission intervention ${action} submitted for ${taskId}.`;
  }
}

type RuntimePluginControlPlaneSnapshot = {
  runtimePluginsError: string | null;
  runtimeCompositionProfiles: RuntimeCompositionProfile[];
  runtimeCompositionActiveProfileId: string | null;
  runtimeCompositionActiveProfile: RuntimeCompositionProfile | null;
  runtimeCompositionResolution: RuntimeCompositionResolution | null;
  runtimeCompositionSnapshot: RuntimeCompositionResolveV2Response | null;
  runtimeCompositionError: string | null;
  runtimePluginRegistryError: string | null;
};

export function buildRuntimePluginControlPlaneSurface(
  snapshot: RuntimePluginControlPlaneSnapshot,
  runtimePlugins: RuntimeKernelPluginDescriptor[]
) {
  return {
    plugins: runtimePlugins,
    pluginsError: snapshot.runtimePluginsError,
    profiles: snapshot.runtimeCompositionProfiles,
    activeProfileId: snapshot.runtimeCompositionActiveProfileId,
    activeProfile: snapshot.runtimeCompositionActiveProfile,
    resolution: snapshot.runtimeCompositionResolution,
    snapshot: snapshot.runtimeCompositionSnapshot,
    compositionError: snapshot.runtimeCompositionError,
    registryError: snapshot.runtimePluginRegistryError,
  };
}

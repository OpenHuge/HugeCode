import {
  syncWebMcpAgentControl as syncWebMcpAgentControlService,
  teardownWebMcpAgentControl as teardownWebMcpAgentControlService,
} from "../../../services/webMcpBridge";
import { invalidateCachedRuntimeLiveSkills as invalidateCachedRuntimeLiveSkillsService } from "../../../services/webMcpBridgeRuntimeWorkspaceTools";

export async function syncWebMcpAgentControl(
  ...args: Parameters<typeof syncWebMcpAgentControlService>
) {
  return syncWebMcpAgentControlService(...args);
}

export async function teardownWebMcpAgentControl(
  ...args: Parameters<typeof teardownWebMcpAgentControlService>
) {
  return teardownWebMcpAgentControlService(...args);
}

export function invalidateCachedRuntimeLiveSkills(
  ...args: Parameters<typeof invalidateCachedRuntimeLiveSkillsService>
) {
  return invalidateCachedRuntimeLiveSkillsService(...args);
}

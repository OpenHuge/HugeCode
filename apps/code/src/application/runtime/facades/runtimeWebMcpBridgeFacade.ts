import {
  AGENT_CONTROL_TOOL_NAMES,
  AGENT_RUNTIME_CONTROL_TOOL_NAMES,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeToolNames";
import { WebMcpInputSchemaValidationError } from "@ku0/code-runtime-client/webMcpInputSchemaValidationError";
import {
  callWebMcpTool as callWebMcpToolService,
  createWebMcpMessage as createWebMcpMessageService,
  elicitWebMcpInput as elicitWebMcpInputService,
  getWebMcpCapabilities as getWebMcpCapabilitiesService,
  listWebMcpCatalog as listWebMcpCatalogService,
  supportsWebMcp as supportsWebMcpService,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeModelContextApi";
import {
  invalidateCachedRuntimeLiveSkills as invalidateCachedRuntimeLiveSkillsService,
  syncWebMcpAgentControl as syncWebMcpAgentControlService,
  teardownWebMcpAgentControl as teardownWebMcpAgentControlService,
} from "../ports/webMcpBridgeCompat";

/**
 * App-facing WebMCP adapter. Keep product consumers on this boundary instead of
 * re-exporting the services layer directly.
 */
export async function callWebMcpTool(...args: Parameters<typeof callWebMcpToolService>) {
  return callWebMcpToolService(...args);
}

export async function createWebMcpMessage(...args: Parameters<typeof createWebMcpMessageService>) {
  return createWebMcpMessageService(...args);
}

export async function elicitWebMcpInput(...args: Parameters<typeof elicitWebMcpInputService>) {
  return elicitWebMcpInputService(...args);
}

export function getWebMcpCapabilities(...args: Parameters<typeof getWebMcpCapabilitiesService>) {
  return getWebMcpCapabilitiesService(...args);
}

export async function listWebMcpCatalog(...args: Parameters<typeof listWebMcpCatalogService>) {
  return listWebMcpCatalogService(...args);
}

export function supportsWebMcp(...args: Parameters<typeof supportsWebMcpService>) {
  return supportsWebMcpService(...args);
}

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

export const WEB_MCP_AGENT_CONTROL_TOOL_NAMES = [...AGENT_CONTROL_TOOL_NAMES];
export const WEB_MCP_RUNTIME_CONTROL_TOOL_NAMES = [...AGENT_RUNTIME_CONTROL_TOOL_NAMES];
export const WEB_MCP_ALL_TOOL_NAMES = [
  ...AGENT_CONTROL_TOOL_NAMES,
  ...AGENT_RUNTIME_CONTROL_TOOL_NAMES,
];

export { WebMcpInputSchemaValidationError };

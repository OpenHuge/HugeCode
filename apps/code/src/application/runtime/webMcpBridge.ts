/**
 * Behavior adapter for the legacy WebMCP bridge.
 *
 * Import types from `application/runtime/types/webMcpBridge` so type-only
 * consumers do not depend on this behavior surface.
 */
export type * from "./types/webMcpBridge";
export {
  callWebMcpTool,
  createWebMcpMessage,
  elicitWebMcpInput,
  getWebMcpCapabilities,
  invalidateCachedRuntimeLiveSkills,
  listWebMcpCatalog,
  supportsWebMcp,
  syncWebMcpAgentControl,
  teardownWebMcpAgentControl,
  WEB_MCP_AGENT_CONTROL_TOOL_NAMES,
  WEB_MCP_ALL_TOOL_NAMES,
  WEB_MCP_RUNTIME_CONTROL_TOOL_NAMES,
  WebMcpInputSchemaValidationError,
} from "./facades/runtimeWebMcpBridgeFacade";

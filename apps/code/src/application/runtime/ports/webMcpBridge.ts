/**
 * App-facing behavior port for WebMCP bridge calls.
 *
 * Type-only consumers should prefer `application/runtime/types/webMcpBridge`.
 */
export type * from "../types/webMcpBridge";
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
} from "../facades/runtimeWebMcpBridgeFacade";

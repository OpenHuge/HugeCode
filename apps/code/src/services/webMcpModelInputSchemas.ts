/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/webMcpModelInputSchemas`.
 */
export {
  WEB_MCP_CREATE_MESSAGE_INPUT_SCHEMA,
  WEB_MCP_ELICIT_INPUT_SCHEMA,
  validateWebMcpCreateMessageInput,
  validateWebMcpElicitInput,
} from "@ku0/code-runtime-client/webMcpModelInputSchemas";

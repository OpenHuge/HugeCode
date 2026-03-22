/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/webMcpInputSchemaValidationError`.
 */
export type { WebMcpInputSchemaValidationScope } from "@ku0/code-runtime-client/webMcpInputSchemaValidationError";
export {
  cloneSchemaValidationResult,
  normalizeSchemaValidationResult,
  extractSchemaValidationResult,
  extractSchemaValidationFromLegacyMessage,
  resolveWebMcpErrorMessage,
  WebMcpInputSchemaValidationError,
  isWebMcpInputSchemaValidationError,
} from "@ku0/code-runtime-client/webMcpInputSchemaValidationError";

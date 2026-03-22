/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeMessageEnvelope`.
 */
export type {
  AgentEnvelopeRoute,
  AgentEnvelopeQueueReference,
  AgentEnvelopeAck,
  AgentEnvelopeFailure,
  AgentEnvelopeEventType,
  AgentEnvelopeMetadata,
  RuntimeMessageEnvelope,
  RuntimeMessageError,
} from "@ku0/code-runtime-client/runtimeMessageEnvelope";
export {
  createRuntimeEnvelope,
  createAgentEnvelope,
  attachAgentEnvelopeMetadata,
  readAgentEnvelopeMetadata,
  createRuntimeError,
  readRuntimeCode,
} from "@ku0/code-runtime-client/runtimeMessageEnvelope";

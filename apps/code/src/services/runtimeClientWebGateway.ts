import { resolveWebRuntimeEndpoint as resolveWebRuntimeEndpointFromCore } from "./runtimeWebTransportCore";

export {
  appendRuntimeAuthTokenQuery,
  resolveRuntimeEnvString,
  resolveTransportEndpointFromPath,
  resolveWebRuntimeAuthToken,
  resolveWebRuntimeControlEndpoint,
  resolveWebRuntimeEndpoint,
  resolveWebRuntimeEventsEndpointFromEnv,
  resolveWebRuntimeWsEndpointFromEnv,
  stripEndpointQueryAndHash,
  toWebSocketEndpoint,
  WEB_RUNTIME_AUTH_TOKEN_HEADER,
  WEB_RUNTIME_GATEWAY_AUTH_TOKEN_ENV_KEY,
  WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY,
  WEB_RUNTIME_GATEWAY_EVENTS_ENDPOINT_ENV_KEY,
  WEB_RUNTIME_GATEWAY_WS_ENDPOINT_ENV_KEY,
} from "./runtimeWebTransportCore";

export function isWebRuntime(): boolean {
  return resolveWebRuntimeEndpointFromCore() !== null;
}

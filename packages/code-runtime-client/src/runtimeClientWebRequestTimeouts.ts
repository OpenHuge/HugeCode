import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import { type RuntimeRpcParams } from "./runtimeClientTransportShared";
import { type RuntimeRpcMethodInvocationPolicy } from "./runtimeClientCapabilitiesContract";

export const WEB_RUNTIME_DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
export const WEB_RUNTIME_LEGACY_TURN_SEND_REQUEST_TIMEOUT_MS = 60_000;

function resolveWebRuntimeDefaultRequestTimeoutMs(method: string): number {
  if (method === CODE_RUNTIME_RPC_METHODS.TURN_SEND) {
    return WEB_RUNTIME_LEGACY_TURN_SEND_REQUEST_TIMEOUT_MS;
  }

  return WEB_RUNTIME_DEFAULT_REQUEST_TIMEOUT_MS;
}

export function resolveWebRuntimeRequestTimeoutMs(
  method: string,
  _params: RuntimeRpcParams,
  invocationPolicy?: RuntimeRpcMethodInvocationPolicy | null
): number | null {
  if (invocationPolicy) {
    if (invocationPolicy.ackTimeoutMs !== undefined) {
      return invocationPolicy.ackTimeoutMs;
    }
  }

  return resolveWebRuntimeDefaultRequestTimeoutMs(method);
}

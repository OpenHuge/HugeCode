import { type RuntimeRpcParams } from "./runtimeClientTransportShared";
import { invokeWebRuntimeRaw } from "./runtimeClientWebTransport";

export async function invokeWebRuntimeDirectRpc(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  return invokeWebRuntimeRaw(method, params as RuntimeRpcParams);
}

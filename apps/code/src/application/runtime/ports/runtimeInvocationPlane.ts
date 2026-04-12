import { getRuntimeClient } from "./runtimeClient";
import type {
  RuntimeInvocationDispatchRequest,
  RuntimeInvocationDispatchResponse,
  RuntimeInvocationHostRegistry,
  RuntimeInvocationHostsListRequest,
} from "./runtimeClient";

export type {
  RuntimeInvocationDispatchRequest,
  RuntimeInvocationDispatchResponse,
  RuntimeInvocationHostRegistry,
  RuntimeInvocationHostsListRequest,
};

export async function listRuntimeInvocationHostsV1(
  request: RuntimeInvocationHostsListRequest = {}
): Promise<RuntimeInvocationHostRegistry> {
  return getRuntimeClient().runtimeInvocationHostsListV1(request);
}

export async function dispatchRuntimeInvocationV1(
  request: RuntimeInvocationDispatchRequest
): Promise<RuntimeInvocationDispatchResponse> {
  return getRuntimeClient().runtimeInvocationDispatchV1(request);
}

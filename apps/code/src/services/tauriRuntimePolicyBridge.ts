import {
  getRuntimeClient,
  type RuntimePolicySetRequest,
  type RuntimePolicySnapshot,
} from "./runtimeClient";

export async function getRuntimePolicy(): Promise<RuntimePolicySnapshot> {
  return getRuntimeClient().runtimePolicyGetV2();
}

export async function setRuntimePolicy(
  request: RuntimePolicySetRequest
): Promise<RuntimePolicySnapshot> {
  return getRuntimeClient().runtimePolicySetV2(request);
}

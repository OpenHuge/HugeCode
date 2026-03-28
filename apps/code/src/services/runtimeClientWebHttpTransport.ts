import { invokeWebRuntimeRawAttempt as invokeWebRuntimeRawAttemptShared } from "@ku0/code-runtime-client/runtimeClientWebHttpTransport";
import { type RuntimeRpcParams } from "@ku0/code-runtime-client/runtimeClientTransportShared";
import {
  resolveWebRuntimeAuthToken,
  WEB_RUNTIME_AUTH_TOKEN_HEADER,
} from "./runtimeClientWebGateway";

export async function invokeWebRuntimeRawAttempt<Result>(
  endpoint: string,
  method: string,
  params: RuntimeRpcParams,
  requestTimeoutMsOverride?: number | null
): Promise<Result> {
  return invokeWebRuntimeRawAttemptShared<Result>(
    endpoint,
    method,
    params,
    requestTimeoutMsOverride,
    {
      authToken: resolveWebRuntimeAuthToken(endpoint),
      authTokenHeader: WEB_RUNTIME_AUTH_TOKEN_HEADER,
    }
  );
}

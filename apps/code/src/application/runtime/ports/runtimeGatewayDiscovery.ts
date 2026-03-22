import { invokeWebRuntimeRawAttempt as invokeWebRuntimeRawAttemptShared } from "@ku0/code-runtime-client/runtimeClientWebHttpTransport";
import {
  resolveWebRuntimeAuthToken,
  WEB_RUNTIME_AUTH_TOKEN_HEADER,
} from "../../../services/runtimeWebTransportCore";

export async function invokeRuntimeGatewayDiscoveryProbe<Result>(
  endpoint: string,
  method: string,
  params: Record<string, unknown>,
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

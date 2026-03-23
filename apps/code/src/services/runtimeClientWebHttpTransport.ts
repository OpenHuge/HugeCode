import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  type CodeRuntimeRpcResponseEnvelope,
} from "@ku0/code-runtime-host-contract";
import {
  RuntimeRpcInvocationError,
  toRuntimeRpcInvocationError,
} from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import { type RuntimeRpcParams } from "@ku0/code-runtime-client/runtimeClientTransportShared";
import { resolveWebRuntimeRequestTimeoutMs } from "@ku0/code-runtime-client/runtimeClientWebRequestTimeouts";
import { parseWebRuntimeRetryAfterMs } from "@ku0/code-runtime-client/runtimeClientWebRetryUtils";
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
  const authToken = resolveWebRuntimeAuthToken(endpoint);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (authToken) {
    headers[WEB_RUNTIME_AUTH_TOKEN_HEADER] = authToken;
  }

  const requestTimeoutMs =
    requestTimeoutMsOverride ?? resolveWebRuntimeRequestTimeoutMs(method, params);
  const abortController = new AbortController();
  const timeout =
    requestTimeoutMs === null
      ? null
      : setTimeout(() => {
          abortController.abort();
        }, requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        method,
        params,
      }),
      signal: abortController.signal,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new RuntimeRpcInvocationError({
        code: CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR,
        message: `Web runtime gateway ${method} timed out after ${requestTimeoutMs}ms.`,
        details: { timeoutMs: requestTimeoutMs },
      });
    }
    throw error;
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }

  if (!response.ok) {
    const retryAfterMs = parseWebRuntimeRetryAfterMs(response.headers.get("retry-after"));
    throw new RuntimeRpcInvocationError({
      code: CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR,
      message: `Web runtime gateway ${method} failed with HTTP ${response.status}.`,
      details: {
        status: response.status,
        retryAfterMs,
      },
    });
  }

  const body = (await response.json()) as CodeRuntimeRpcResponseEnvelope<Result>;
  if (!body.ok) {
    throw (
      toRuntimeRpcInvocationError(body.error) ??
      new RuntimeRpcInvocationError({
        code: CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR,
        message: `Web runtime gateway ${method} rejected request.`,
      })
    );
  }
  return body.result as Result;
}

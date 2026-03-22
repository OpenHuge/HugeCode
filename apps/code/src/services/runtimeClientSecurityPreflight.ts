import type {
  RuntimeSecurityPreflightDecision,
  RuntimeSecurityPreflightRequest,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";

import { toRuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import type { RuntimeClient } from "./runtimeClientTypes";

function isMethodUnsupported(error: unknown): boolean {
  const normalized = toRuntimeRpcInvocationError(error);
  return Boolean(normalized && isCodeRuntimeRpcMethodNotFoundErrorCode(normalized.code));
}

export async function evaluateRuntimeSecurityPreflightWithFallback(
  client: RuntimeClient,
  request: RuntimeSecurityPreflightRequest,
  fallbackAction: "allow" | "review" = "review"
): Promise<RuntimeSecurityPreflightDecision> {
  try {
    return await client.securityPreflightV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return {
        action: fallbackAction,
        reason: "Runtime does not support security preflight v1; applied client fallback policy.",
        advisories: [],
      };
    }
    throw error;
  }
}

import {
  inferCodeRuntimeRpcMethodNotFoundCodeFromMessage,
  isCodeRuntimeRpcMethodNotFoundErrorCode,
} from "./codeRuntimeRpcCompat.js";
import type {
  RuntimeContextPlaneV2,
  RuntimeEvalPlaneV2,
  RuntimeRunPrepareV2Response,
  RuntimeToolingPlaneV2,
} from "./code-runtime-rpc/runtimeRunsAndSubAgents.js";

export type CanonicalRuntimeRunPrepareSurface = Omit<
  RuntimeRunPrepareV2Response,
  "contextPlane" | "toolingPlane" | "evalPlane"
> & {
  contextPlane: RuntimeContextPlaneV2;
  toolingPlane: RuntimeToolingPlaneV2;
  evalPlane: RuntimeEvalPlaneV2;
};

export type CanonicalRuntimeRunPrepareSurfaceResolution =
  | {
      ok: true;
      surface: CanonicalRuntimeRunPrepareSurface;
    }
  | {
      ok: false;
      reason:
        | "missing_context_plane"
        | "missing_tooling_plane"
        | "missing_eval_plane"
        | "missing_required_truth";
      message: string;
      missingFields: Array<"contextPlane" | "toolingPlane" | "evalPlane">;
    };

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const code = "code" in error ? error.code : null;
  return typeof code === "string" && code.trim().length > 0 ? code.trim() : null;
}

function readErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!error || typeof error !== "object") {
    return null;
  }
  const message = "message" in error ? error.message : null;
  return typeof message === "string" && message.trim().length > 0 ? message.trim() : null;
}

function isRuntimeUnavailableLikeError(error: unknown): boolean {
  const code = readErrorCode(error)?.toLowerCase() ?? "";
  if (code.includes("runtime_unavailable") || code.includes("invoke_unavailable")) {
    return true;
  }
  if (code.includes("method_unavailable") || code === "unavailable") {
    return true;
  }

  const message = readErrorMessage(error)?.toLowerCase() ?? "";
  if (message.length === 0) {
    return false;
  }
  return (
    message.includes("runtime is unavailable") ||
    message.includes("code runtime is unavailable") ||
    message.includes("unavailable for prepare runtime run v2") ||
    message.includes("web runtime gateway method code_runtime_run_prepare_v2")
  );
}

export function isRuntimeRunPrepareV2DegradedCompatibleError(error: unknown): boolean {
  const code = readErrorCode(error);
  if (code && isCodeRuntimeRpcMethodNotFoundErrorCode(code)) {
    return true;
  }
  const message = readErrorMessage(error);
  if (message && inferCodeRuntimeRpcMethodNotFoundCodeFromMessage(message)) {
    return true;
  }
  return isRuntimeUnavailableLikeError(error);
}

export function resolveCanonicalRuntimeRunPrepareSurface(
  response: RuntimeRunPrepareV2Response
): CanonicalRuntimeRunPrepareSurfaceResolution {
  const contextPlane = response.contextPlane ?? null;
  const toolingPlane = response.toolingPlane ?? null;
  const evalPlane = response.evalPlane ?? null;
  const missingFields: Array<"contextPlane" | "toolingPlane" | "evalPlane"> = [];
  if (!contextPlane) {
    missingFields.push("contextPlane");
  }
  if (!toolingPlane) {
    missingFields.push("toolingPlane");
  }
  if (!evalPlane) {
    missingFields.push("evalPlane");
  }

  if (missingFields.length > 0) {
    const [primaryMissingField] = missingFields;
    return {
      ok: false,
      reason:
        primaryMissingField === "contextPlane"
          ? "missing_context_plane"
          : primaryMissingField === "toolingPlane"
            ? "missing_tooling_plane"
            : "missing_eval_plane",
      message: `Runtime kernel v2 prepare returned incomplete launch truth: missing ${missingFields.join(
        ", "
      )}.`,
      missingFields,
    };
  }

  return {
    ok: true,
    surface: {
      ...response,
      contextPlane: contextPlane as RuntimeContextPlaneV2,
      toolingPlane: toolingPlane as RuntimeToolingPlaneV2,
      evalPlane: evalPlane as RuntimeEvalPlaneV2,
    },
  };
}

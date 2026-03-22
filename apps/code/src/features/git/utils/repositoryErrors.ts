import {
  getErrorMessage,
  isWebRuntimeConnectionError,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";

function normalizeErrorMessage(error: string | null | undefined) {
  return error?.trim().toLowerCase() ?? "";
}

export function isMissingGitRepositoryError(error: string | null | undefined) {
  const normalized = normalizeErrorMessage(error);
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes("could not find repository") ||
    normalized.includes("not a git repository") ||
    (normalized.includes("repository") && normalized.includes("notfound")) ||
    normalized.includes("repository not found") ||
    normalized.includes("git root not found")
  );
}

export function isGitRuntimeUnavailableError(error: unknown) {
  if (isWebRuntimeConnectionError(error)) {
    return true;
  }

  const message = normalizeErrorMessage(getErrorMessage(error));
  if (!message) {
    return false;
  }

  const name =
    error instanceof Error && typeof error.name === "string" ? error.name.trim().toLowerCase() : "";

  return (
    name.startsWith("runtimerpccontract") ||
    message.includes("runtime rpc compatfieldaliases mismatch") ||
    message.includes("runtime rpc errorcodes mismatch") ||
    message.includes("runtime rpc methodsethash mismatch") ||
    message.includes("runtime rpc freezeeffectiveat mismatch") ||
    message.includes("runtime rpc profile mismatch") ||
    message.includes("runtime rpc contract missing required features") ||
    message.includes("runtime capabilities unavailable") ||
    message.includes("runtime unavailable") ||
    message.includes("failed to fetch")
  );
}

export function shouldSuppressGitConsoleError(error: unknown) {
  const message = getErrorMessage(error);
  return isMissingGitRepositoryError(message) || isGitRuntimeUnavailableError(error);
}

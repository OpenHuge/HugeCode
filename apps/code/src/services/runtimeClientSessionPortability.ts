import type {
  RuntimeSessionDeleteRequest,
  RuntimeSessionExportRequest,
  RuntimeSessionExportResponse,
  RuntimeSessionImportRequest,
  RuntimeSessionImportResponse,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";

import { toRuntimeRpcInvocationError } from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import type { RuntimeClient } from "./runtimeClient";

function isMethodUnsupported(error: unknown): boolean {
  const normalized = toRuntimeRpcInvocationError(error);
  return Boolean(normalized && isCodeRuntimeRpcMethodNotFoundErrorCode(normalized.code));
}

export async function exportRuntimeSessionWithFallback(
  client: RuntimeClient,
  request: RuntimeSessionExportRequest
): Promise<RuntimeSessionExportResponse | null> {
  try {
    return await client.sessionExportV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return null;
    }
    throw error;
  }
}

export async function importRuntimeSessionWithFallback(
  client: RuntimeClient,
  request: RuntimeSessionImportRequest
): Promise<RuntimeSessionImportResponse | null> {
  try {
    return await client.sessionImportV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteRuntimeSessionWithFallback(
  client: RuntimeClient,
  request: RuntimeSessionDeleteRequest
): Promise<boolean> {
  try {
    return await client.sessionDeleteV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return false;
    }
    throw error;
  }
}

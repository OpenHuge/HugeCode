import type {
  RuntimeExtensionInstallRequest,
  RuntimeExtensionResourceReadRequest,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionSpec,
  RuntimeExtensionsConfigResponse,
  RuntimeExtensionToolSummary,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";

import { toRuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import type { RuntimeClient } from "./runtimeClientTypes";

function isMethodUnsupported(error: unknown): boolean {
  const normalized = toRuntimeRpcInvocationError(error);
  return Boolean(normalized && isCodeRuntimeRpcMethodNotFoundErrorCode(normalized.code));
}

export async function listRuntimeExtensionsWithFallback(
  client: RuntimeClient,
  workspaceId?: string | null
): Promise<RuntimeExtensionSpec[]> {
  try {
    return await client.extensionsListV1(workspaceId ?? null);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return [];
    }
    throw error;
  }
}

export async function installRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionInstallRequest
): Promise<RuntimeExtensionSpec | null> {
  try {
    return await client.extensionInstallV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return null;
    }
    throw error;
  }
}

export async function removeRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string }
): Promise<boolean> {
  try {
    return await client.extensionRemoveV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return false;
    }
    throw error;
  }
}

export async function listRuntimeExtensionToolsWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string }
): Promise<RuntimeExtensionToolSummary[]> {
  try {
    return await client.extensionToolsListV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return [];
    }
    throw error;
  }
}

export async function readRuntimeExtensionResourceWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionResourceReadRequest
): Promise<RuntimeExtensionResourceReadResponse | null> {
  try {
    return await client.extensionResourceReadV1(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return null;
    }
    throw error;
  }
}

export async function readRuntimeExtensionsConfigWithFallback(
  client: RuntimeClient,
  workspaceId?: string | null
): Promise<RuntimeExtensionsConfigResponse> {
  try {
    return await client.extensionsConfigV1(workspaceId ?? null);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return {
        extensions: [],
        warnings: ["Runtime does not support extension config RPC methods."],
      };
    }
    throw error;
  }
}

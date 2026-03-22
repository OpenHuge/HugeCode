import type {
  RuntimeExtensionInstallRequest,
  RuntimeExtensionResourceReadRequest,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionSpec,
  RuntimeExtensionsConfigResponse,
  RuntimeExtensionToolSummary,
} from "@ku0/code-runtime-host-contract";

import {
  installRuntimeExtensionWithFallback,
  listRuntimeExtensionToolsWithFallback,
  listRuntimeExtensionsWithFallback,
  removeRuntimeExtensionWithFallback,
  readRuntimeExtensionResourceWithFallback,
  readRuntimeExtensionsConfigWithFallback,
} from "./runtimeClientExtensions";
import { getRuntimeClient } from "./runtimeClient";

export async function listRuntimeExtensions(
  workspaceId?: string | null
): Promise<RuntimeExtensionSpec[]> {
  return listRuntimeExtensionsWithFallback(getRuntimeClient(), workspaceId ?? null);
}

export async function installRuntimeExtension(
  request: RuntimeExtensionInstallRequest
): Promise<RuntimeExtensionSpec | null> {
  return installRuntimeExtensionWithFallback(getRuntimeClient(), request);
}

export async function removeRuntimeExtension(request: {
  workspaceId?: string | null;
  extensionId: string;
}): Promise<boolean> {
  return removeRuntimeExtensionWithFallback(getRuntimeClient(), request);
}

export async function listRuntimeExtensionTools(request: {
  workspaceId?: string | null;
  extensionId: string;
}): Promise<RuntimeExtensionToolSummary[]> {
  return listRuntimeExtensionToolsWithFallback(getRuntimeClient(), request);
}

export async function readRuntimeExtensionResource(
  request: RuntimeExtensionResourceReadRequest
): Promise<RuntimeExtensionResourceReadResponse | null> {
  return readRuntimeExtensionResourceWithFallback(getRuntimeClient(), request);
}

export async function getRuntimeExtensionsConfig(
  workspaceId?: string | null
): Promise<RuntimeExtensionsConfigResponse> {
  return readRuntimeExtensionsConfigWithFallback(getRuntimeClient(), workspaceId ?? null);
}

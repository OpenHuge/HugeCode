import type {
  RuntimeExtensionGetRequest,
  RuntimeExtensionHealthReadRequest,
  RuntimeExtensionHealthReadResponse,
  RuntimeExtensionInstallRequest,
  RuntimeExtensionPermissionsEvaluateRequest,
  RuntimeExtensionPermissionsEvaluateResponse,
  RuntimeExtensionRegistrySearchRequest,
  RuntimeExtensionRegistrySearchResponse,
  RuntimeExtensionRegistrySource,
  RuntimeExtensionResourceReadRequest,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionSpec,
  RuntimeExtensionSetStateRequest,
  RuntimeExtensionsConfigResponse,
  RuntimeExtensionToolSummary,
  RuntimeExtensionUiAppsListRequest,
  RuntimeExtensionUiAppsListResponse,
  RuntimeExtensionUpdateRequest,
} from "@ku0/code-runtime-host-contract";

import {
  evaluateRuntimeExtensionPermissionsWithFallback,
  getRuntimeExtensionWithFallback,
  installRuntimeExtensionWithFallback,
  listRuntimeExtensionRegistrySourcesWithFallback,
  listRuntimeExtensionToolsWithFallback,
  listRuntimeExtensionUiAppsWithFallback,
  listRuntimeExtensionsWithFallback,
  removeRuntimeExtensionWithFallback,
  readRuntimeExtensionResourceWithFallback,
  readRuntimeExtensionHealthWithFallback,
  readRuntimeExtensionsConfigWithFallback,
  searchRuntimeExtensionRegistryWithFallback,
  setRuntimeExtensionStateWithFallback,
  updateRuntimeExtensionWithFallback,
} from "./runtimeClientExtensions";
import { getRuntimeClient } from "./runtimeClient";

export async function listRuntimeExtensions(
  workspaceId?: string | null
): Promise<RuntimeExtensionSpec[]> {
  return listRuntimeExtensionsWithFallback(getRuntimeClient(), workspaceId ?? null);
}

export async function getRuntimeExtension(
  request: RuntimeExtensionGetRequest
): Promise<RuntimeExtensionSpec | null> {
  return getRuntimeExtensionWithFallback(getRuntimeClient(), request);
}

export async function installRuntimeExtension(
  request: RuntimeExtensionInstallRequest
): Promise<RuntimeExtensionSpec | null> {
  return installRuntimeExtensionWithFallback(getRuntimeClient(), request);
}

export async function updateRuntimeExtension(
  request: RuntimeExtensionUpdateRequest
): Promise<RuntimeExtensionSpec | null> {
  return updateRuntimeExtensionWithFallback(getRuntimeClient(), request);
}

export async function setRuntimeExtensionState(
  request: RuntimeExtensionSetStateRequest
): Promise<RuntimeExtensionSpec | null> {
  return setRuntimeExtensionStateWithFallback(getRuntimeClient(), request);
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

export async function searchRuntimeExtensionRegistry(
  request: RuntimeExtensionRegistrySearchRequest = {}
): Promise<RuntimeExtensionRegistrySearchResponse> {
  return searchRuntimeExtensionRegistryWithFallback(getRuntimeClient(), request);
}

export async function listRuntimeExtensionRegistrySources(
  workspaceId?: string | null
): Promise<RuntimeExtensionRegistrySource[]> {
  return listRuntimeExtensionRegistrySourcesWithFallback(getRuntimeClient(), workspaceId ?? null);
}

export async function evaluateRuntimeExtensionPermissions(
  request: RuntimeExtensionPermissionsEvaluateRequest
): Promise<RuntimeExtensionPermissionsEvaluateResponse> {
  return evaluateRuntimeExtensionPermissionsWithFallback(getRuntimeClient(), request);
}

export async function readRuntimeExtensionHealth(
  request: RuntimeExtensionHealthReadRequest
): Promise<RuntimeExtensionHealthReadResponse> {
  return readRuntimeExtensionHealthWithFallback(getRuntimeClient(), request);
}

export async function listRuntimeExtensionUiApps(
  request: RuntimeExtensionUiAppsListRequest = {}
): Promise<RuntimeExtensionUiAppsListResponse> {
  return listRuntimeExtensionUiAppsWithFallback(getRuntimeClient(), request);
}

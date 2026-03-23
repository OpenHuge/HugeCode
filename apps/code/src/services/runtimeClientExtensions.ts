import type {
  RuntimeExtensionInstallRequest,
  RuntimeExtensionHealthReadRequest,
  RuntimeExtensionHealthReadResponse,
  RuntimeExtensionPermissionsEvaluateRequest,
  RuntimeExtensionPermissionsEvaluateResponse,
  RuntimeExtensionRecord,
  RuntimeExtensionRegistrySearchRequest,
  RuntimeExtensionRegistrySearchResponse,
  RuntimeExtensionRegistrySource,
  RuntimeExtensionResourceReadRequest,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionSpec,
  RuntimeExtensionUiAppsListRequest,
  RuntimeExtensionUiAppsListResponse,
  RuntimeExtensionsConfigResponse,
  RuntimeExtensionToolSummary,
  RuntimeExtensionUpdateRequest,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeClient } from "./runtimeClient";

export async function listRuntimeExtensionsWithFallback(
  client: RuntimeClient,
  workspaceId?: string | null
): Promise<RuntimeExtensionSpec[]> {
  return client.extensionCatalogListV2({ workspaceId: workspaceId ?? null });
}

export async function getRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string }
): Promise<RuntimeExtensionRecord | null> {
  return client.extensionGetV2(request);
}

export async function installRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionInstallRequest
): Promise<RuntimeExtensionSpec | null> {
  return client.extensionInstallV2(request);
}

export async function updateRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionUpdateRequest
): Promise<RuntimeExtensionSpec | null> {
  return client.extensionUpdateV2(request);
}

export async function setRuntimeExtensionStateWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string; enabled: boolean }
): Promise<RuntimeExtensionSpec | null> {
  return client.extensionSetStateV2(request);
}

export async function removeRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string }
): Promise<boolean> {
  return client.extensionRemoveV2(request);
}

export async function searchRuntimeExtensionRegistryWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionRegistrySearchRequest = {}
): Promise<RuntimeExtensionRegistrySearchResponse> {
  return client.extensionRegistrySearchV2(request);
}

export async function listRuntimeExtensionRegistrySourcesWithFallback(
  client: RuntimeClient,
  workspaceId?: string | null
): Promise<RuntimeExtensionRegistrySource[]> {
  void workspaceId;
  return client.extensionRegistrySourcesV2();
}

export async function evaluateRuntimeExtensionPermissionsWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionPermissionsEvaluateRequest
): Promise<RuntimeExtensionPermissionsEvaluateResponse> {
  return client.extensionPermissionsEvaluateV2(request);
}

export async function readRuntimeExtensionHealthWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionHealthReadRequest
): Promise<RuntimeExtensionHealthReadResponse> {
  return client.extensionHealthReadV2(request);
}

export async function listRuntimeExtensionUiAppsWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionUiAppsListRequest = {}
): Promise<RuntimeExtensionUiAppsListResponse> {
  return client.extensionUiAppsListV2(request);
}

export async function listRuntimeExtensionToolsWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string }
): Promise<RuntimeExtensionToolSummary[]> {
  return client.extensionToolsListV2(request);
}

export async function readRuntimeExtensionResourceWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionResourceReadRequest
): Promise<RuntimeExtensionResourceReadResponse | null> {
  return client.extensionResourceReadV2(request);
}

export async function readRuntimeExtensionsConfigWithFallback(
  client: RuntimeClient,
  workspaceId?: string | null
): Promise<RuntimeExtensionsConfigResponse> {
  const [extensions, registrySources] = await Promise.all([
    client.extensionCatalogListV2({ workspaceId: workspaceId ?? null }),
    client.extensionRegistrySourcesV2(),
  ]);
  return {
    extensions,
    warnings: extensions.length === 0 ? ["No runtime extensions are currently installed."] : [],
    registrySources,
  };
}

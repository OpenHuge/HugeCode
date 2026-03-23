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
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";

import { toRuntimeRpcInvocationError } from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import type { RuntimeClient } from "./runtimeClient";

function isMethodUnsupported(error: unknown): boolean {
  if (
    error instanceof TypeError &&
    (error.message.includes("is not a function") || error.message.includes("not a function"))
  ) {
    return true;
  }
  const normalized = toRuntimeRpcInvocationError(error);
  return Boolean(normalized && isCodeRuntimeRpcMethodNotFoundErrorCode(normalized.code));
}

function getFallbackRegistrySources(
  extensions: RuntimeExtensionRecord[]
): RuntimeExtensionRegistrySource[] {
  const sources = new Map<string, RuntimeExtensionRegistrySource>();
  sources.set("workspace", {
    sourceId: "workspace",
    displayName: "Workspace",
    kind: "workspace",
    public: false,
    installSupported: true,
    searchSupported: false,
  });
  if (extensions.some((extension) => extension.distribution === "private-registry")) {
    sources.set("private-registry", {
      sourceId: "private-registry",
      displayName: "Private Registry",
      kind: "private-registry",
      public: false,
      installSupported: false,
      searchSupported: false,
    });
  }
  if (extensions.some((extension) => extension.distribution === "public-registry")) {
    sources.set("public-registry", {
      sourceId: "public-registry",
      displayName: "Public Registry",
      kind: "public-registry",
      public: true,
      installSupported: false,
      searchSupported: false,
    });
  }
  return [...sources.values()];
}

function getExtensionSourceId(extension: RuntimeExtensionRecord): string | null {
  const provenance = extension.provenance;
  if (provenance && typeof provenance === "object" && !Array.isArray(provenance)) {
    const sourceId = provenance.sourceId;
    if (typeof sourceId === "string" && sourceId.trim().length > 0) {
      return sourceId.trim();
    }
    const registrySourceId = provenance.registrySourceId;
    if (typeof registrySourceId === "string" && registrySourceId.trim().length > 0) {
      return registrySourceId.trim();
    }
    const registryId = provenance.registryId;
    if (typeof registryId === "string" && registryId.trim().length > 0) {
      return registryId.trim();
    }
  }
  if (extension.distribution === "workspace") {
    return "workspace";
  }
  if (extension.distribution === "private-registry") {
    return "private-registry";
  }
  if (extension.distribution === "public-registry") {
    return "public-registry";
  }
  return null;
}

function matchesRegistryQuery(extension: RuntimeExtensionRecord, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  const normalizedQuery = query.toLowerCase();
  return [
    extension.extensionId,
    extension.displayName,
    extension.name,
    extension.publisher,
    extension.summary,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

export async function listRuntimeExtensionsWithFallback(
  client: RuntimeClient,
  workspaceId?: string | null
): Promise<RuntimeExtensionSpec[]> {
  try {
    return await client.extensionCatalogListV2({ workspaceId: workspaceId ?? null });
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return await client.extensionsListV1(workspaceId ?? null);
    }
    throw error;
  }
}

export async function getRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string }
): Promise<RuntimeExtensionRecord | null> {
  try {
    return await client.extensionGetV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      const extensions = await client.extensionsListV1(request.workspaceId ?? null);
      return extensions.find((entry) => entry.extensionId === request.extensionId) ?? null;
    }
    throw error;
  }
}

export async function installRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionInstallRequest
): Promise<RuntimeExtensionSpec | null> {
  try {
    return await client.extensionInstallV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      try {
        return await client.extensionInstallV1(request);
      } catch (fallbackError) {
        if (isMethodUnsupported(fallbackError)) {
          return null;
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

export async function updateRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionUpdateRequest
): Promise<RuntimeExtensionSpec | null> {
  try {
    return await client.extensionUpdateV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      try {
        return await client.extensionInstallV1({
          workspaceId: request.workspaceId ?? null,
          extensionId: request.extensionId,
          displayName: request.displayName ?? request.extensionId,
          name: request.displayName ?? request.extensionId,
          transport: request.transport ?? "frontend",
          enabled: request.enabled ?? true,
          config: request.config ?? {},
        });
      } catch (fallbackError) {
        if (isMethodUnsupported(fallbackError)) {
          return null;
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

export async function setRuntimeExtensionStateWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string; enabled: boolean }
): Promise<RuntimeExtensionSpec | null> {
  try {
    return await client.extensionSetStateV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      const current = await getRuntimeExtensionWithFallback(client, request);
      if (!current) {
        return null;
      }
      try {
        return await client.extensionInstallV1({
          workspaceId: request.workspaceId ?? null,
          extensionId: request.extensionId,
          displayName: current.displayName,
          name: current.name,
          transport: current.transport,
          enabled: request.enabled,
          config: current.config,
        });
      } catch (fallbackError) {
        if (isMethodUnsupported(fallbackError)) {
          return null;
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

export async function removeRuntimeExtensionWithFallback(
  client: RuntimeClient,
  request: { workspaceId?: string | null; extensionId: string }
): Promise<boolean> {
  try {
    return await client.extensionRemoveV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      try {
        return await client.extensionRemoveV1(request);
      } catch (fallbackError) {
        if (isMethodUnsupported(fallbackError)) {
          return false;
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

export async function searchRuntimeExtensionRegistryWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionRegistrySearchRequest = {}
): Promise<RuntimeExtensionRegistrySearchResponse> {
  try {
    return await client.extensionRegistrySearchV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      const extensions = await listRuntimeExtensionsWithFallback(
        client,
        request.workspaceId ?? null
      );
      const sources = await listRuntimeExtensionRegistrySourcesWithFallback(
        client,
        request.workspaceId ?? null
      );
      const requestedSourceIds =
        request.sourceIds && request.sourceIds.length > 0 ? new Set(request.sourceIds) : null;
      const requestedKinds =
        request.kinds && request.kinds.length > 0 ? new Set(request.kinds) : null;
      const query = request.query?.trim() ?? "";
      const results = extensions.filter((extension) => {
        if (!matchesRegistryQuery(extension, query)) {
          return false;
        }
        if (requestedKinds && !requestedKinds.has(extension.kind)) {
          return false;
        }
        if (requestedSourceIds) {
          const sourceId = getExtensionSourceId(extension);
          if (!sourceId || !requestedSourceIds.has(sourceId)) {
            return false;
          }
        }
        return true;
      });
      return {
        query,
        results,
        sources,
      };
    }
    throw error;
  }
}

export async function listRuntimeExtensionRegistrySourcesWithFallback(
  client: RuntimeClient,
  workspaceId?: string | null
): Promise<RuntimeExtensionRegistrySource[]> {
  try {
    return await client.extensionRegistrySourcesV2();
  } catch (error) {
    if (isMethodUnsupported(error)) {
      try {
        const config = await client.extensionsConfigV1(workspaceId ?? null);
        if (config.registrySources && config.registrySources.length > 0) {
          return config.registrySources;
        }
        return getFallbackRegistrySources(config.extensions);
      } catch (fallbackError) {
        if (isMethodUnsupported(fallbackError)) {
          return getFallbackRegistrySources([]);
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

export async function evaluateRuntimeExtensionPermissionsWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionPermissionsEvaluateRequest
): Promise<RuntimeExtensionPermissionsEvaluateResponse> {
  try {
    return await client.extensionPermissionsEvaluateV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      const extension = await getRuntimeExtensionWithFallback(client, request);
      if (!extension) {
        return {
          extensionId: request.extensionId,
          permissions: [],
          decision: "deny",
          warnings: [
            "Runtime does not support extension permissions evaluation RPC methods.",
            `Extension ${request.extensionId} was not found in the local extension catalog.`,
          ],
        };
      }
      return {
        extensionId: request.extensionId,
        permissions: extension.permissions,
        decision: extension.permissions.length === 0 ? "allow" : "ask",
        warnings: ["Permissions decision was derived from local extension metadata."],
      };
    }
    throw error;
  }
}

export async function readRuntimeExtensionHealthWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionHealthReadRequest
): Promise<RuntimeExtensionHealthReadResponse> {
  try {
    return await client.extensionHealthReadV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      const extension = await getRuntimeExtensionWithFallback(client, request);
      if (!extension) {
        return {
          extensionId: request.extensionId,
          lifecycleState: "blocked",
          healthy: false,
          warnings: [
            "Runtime does not support extension health RPC methods.",
            `Extension ${request.extensionId} was not found in the local extension catalog.`,
          ],
          checkedAt: Date.now(),
        };
      }
      const healthy =
        extension.enabled &&
        extension.lifecycleState !== "blocked" &&
        extension.lifecycleState !== "degraded" &&
        extension.lifecycleState !== "removed";
      const warnings = ["Health state was derived from local extension lifecycle metadata."];
      if (!extension.enabled) {
        warnings.push("Extension is currently disabled.");
      }
      if (extension.lifecycleState === "degraded") {
        warnings.push("Extension lifecycle is degraded.");
      }
      if (extension.lifecycleState === "blocked") {
        warnings.push("Extension lifecycle is blocked.");
      }
      return {
        extensionId: request.extensionId,
        lifecycleState: extension.lifecycleState,
        healthy,
        warnings,
        checkedAt: Date.now(),
      };
    }
    throw error;
  }
}

export async function listRuntimeExtensionUiAppsWithFallback(
  client: RuntimeClient,
  request: RuntimeExtensionUiAppsListRequest = {}
): Promise<RuntimeExtensionUiAppsListResponse> {
  try {
    return await client.extensionUiAppsListV2(request);
  } catch (error) {
    if (isMethodUnsupported(error)) {
      if (request.extensionId) {
        const extension = await getRuntimeExtensionWithFallback(client, {
          workspaceId: request.workspaceId ?? null,
          extensionId: request.extensionId,
        });
        return {
          workspaceId: request.workspaceId ?? null,
          extensionId: request.extensionId,
          apps: extension?.uiApps ?? [],
        };
      }
      const extensions = await listRuntimeExtensionsWithFallback(
        client,
        request.workspaceId ?? null
      );
      return {
        workspaceId: request.workspaceId ?? null,
        apps: extensions.flatMap((extension) => extension.uiApps),
      };
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
    const [extensions, registrySources] = await Promise.all([
      client.extensionCatalogListV2({ workspaceId: workspaceId ?? null }),
      listRuntimeExtensionRegistrySourcesWithFallback(client, workspaceId ?? null).catch(() => []),
    ]);
    return {
      extensions,
      warnings: extensions.length === 0 ? ["No runtime extensions are currently installed."] : [],
      registrySources,
    };
  } catch (error) {
    if (isMethodUnsupported(error)) {
      try {
        return await client.extensionsConfigV1(workspaceId ?? null);
      } catch (fallbackError) {
        if (isMethodUnsupported(fallbackError)) {
          return {
            extensions: [],
            warnings: ["Runtime does not support extension config RPC methods."],
          };
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

import type {
  RuntimeCodexDoctorRequest,
  RuntimeCodexDoctorResponse,
  RuntimeCodexUpdateRequest,
  RuntimeCodexUpdateResponse,
  RuntimeCollaborationModesListResponse,
  RuntimeMcpServerStatusListRequest,
  RuntimeMcpServerStatusListResponse,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";

import { logger } from "./logger";
import { toRuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import type { RuntimeClient } from "./runtimeClientTypes";

function isMethodUnsupported(error: unknown): boolean {
  const normalized = toRuntimeRpcInvocationError(error);
  return Boolean(normalized && isCodeRuntimeRpcMethodNotFoundErrorCode(normalized.code));
}

function logSchemaDiagnostics(operation: string, message: string, payload: unknown): void {
  logger.warn(`[runtimeClientCodex] ${operation}: ${message}`, payload);
}

function ensureObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function getCodexConfigPathWithFallback(client: RuntimeClient): Promise<string> {
  try {
    const response = await client.codexConfigPathGetV1();
    const path = typeof response.path === "string" ? response.path.trim() : "";
    if (!path) {
      throw new Error("Runtime returned an empty Codex config path.");
    }
    return path;
  } catch (error) {
    if (isMethodUnsupported(error)) {
      throw new Error("Runtime does not support Codex config path lookup.");
    }
    throw error;
  }
}

export async function listCollaborationModesWithFallback(
  client: RuntimeClient,
  workspaceId: string
): Promise<RuntimeCollaborationModesListResponse> {
  try {
    const response = await client.collaborationModesListV1(workspaceId);
    const data = Array.isArray(response.data)
      ? response.data.filter((item) => {
          const record = ensureObject(item);
          return typeof record.mode === "string" && record.mode.trim().length > 0;
        })
      : [];
    if (!Array.isArray(response.data)) {
      logSchemaDiagnostics(
        "collaborationModesListV1",
        "response.data is not an array; downgraded to empty list",
        response
      );
    }
    return {
      data,
      warnings: Array.isArray(response.warnings) ? response.warnings : [],
    };
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return {
        data: [],
        warnings: ["Runtime does not support collaboration mode list RPC."],
      };
    }
    throw error;
  }
}

export async function listMcpServerStatusWithFallback(
  client: RuntimeClient,
  request: RuntimeMcpServerStatusListRequest
): Promise<RuntimeMcpServerStatusListResponse> {
  try {
    const response = await client.mcpServerStatusListV1(request);
    if (!Array.isArray(response.data)) {
      logSchemaDiagnostics(
        "mcpServerStatusListV1",
        "response.data is not an array; downgraded to empty list",
        response
      );
      return {
        data: [],
        nextCursor: null,
        warnings: ["MCP status schema validation failed; fallback to empty list."],
      };
    }
    return {
      data: response.data,
      nextCursor: response.nextCursor ?? null,
      warnings: Array.isArray(response.warnings) ? response.warnings : [],
    };
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return {
        data: [],
        nextCursor: null,
        warnings: ["Runtime does not support MCP server status RPC."],
      };
    }
    throw error;
  }
}

export async function runCodexDoctorWithFallback(
  client: RuntimeClient,
  request: RuntimeCodexDoctorRequest
): Promise<RuntimeCodexDoctorResponse> {
  try {
    const response = await client.codexDoctorV1(request);
    return {
      ok: Boolean(response.ok),
      codexBin: response.codexBin ?? null,
      version: response.version ?? null,
      appServerOk: Boolean(response.appServerOk),
      details: response.details ?? null,
      path: response.path ?? null,
      nodeOk: Boolean(response.nodeOk),
      nodeVersion: response.nodeVersion ?? null,
      nodeDetails: response.nodeDetails ?? null,
      warnings: Array.isArray(response.warnings) ? response.warnings : [],
    };
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return {
        ok: false,
        codexBin: request.codexBin ?? null,
        version: null,
        appServerOk: false,
        details: "Runtime does not support codex doctor RPC.",
        path: null,
        nodeOk: false,
        nodeVersion: null,
        nodeDetails: null,
        warnings: ["Fell back because codex doctor RPC is unavailable."],
      };
    }
    throw error;
  }
}

export async function runCodexUpdateWithFallback(
  client: RuntimeClient,
  request: RuntimeCodexUpdateRequest
): Promise<RuntimeCodexUpdateResponse> {
  try {
    const response = await client.codexUpdateV1(request);
    return {
      ok: Boolean(response.ok),
      method: response.method,
      package: response.package ?? null,
      beforeVersion: response.beforeVersion ?? null,
      afterVersion: response.afterVersion ?? null,
      upgraded: Boolean(response.upgraded),
      output: response.output ?? null,
      details: response.details ?? null,
      warnings: Array.isArray(response.warnings) ? response.warnings : [],
    };
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return {
        ok: false,
        method: "unknown",
        package: "codex",
        beforeVersion: null,
        afterVersion: null,
        upgraded: false,
        output: null,
        details: "Runtime does not support codex update RPC.",
        warnings: ["Fell back because codex update RPC is unavailable."],
      };
    }
    throw error;
  }
}

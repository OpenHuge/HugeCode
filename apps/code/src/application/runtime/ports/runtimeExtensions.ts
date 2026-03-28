import type {
  RuntimeExtensionHealthReadResponse,
  RuntimeExtensionPermissionsEvaluateResponse,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionRecord,
} from "@ku0/code-runtime-host-contract";
import { getRuntimeClient } from "../runtimeClient";

export async function listRuntimeExtensions(
  workspaceId?: string | null
): Promise<RuntimeExtensionRecord[]> {
  return getRuntimeClient().extensionCatalogListV2({ workspaceId: workspaceId ?? null });
}

export async function evaluateRuntimeExtensionPermissions(input: {
  workspaceId?: string | null;
  extensionId: string;
}): Promise<RuntimeExtensionPermissionsEvaluateResponse> {
  return getRuntimeClient().extensionPermissionsEvaluateV2(input);
}

export async function readRuntimeExtensionHealth(input: {
  workspaceId?: string | null;
  extensionId: string;
}): Promise<RuntimeExtensionHealthReadResponse> {
  return getRuntimeClient().extensionHealthReadV2(input);
}

export async function readRuntimeExtensionResource(input: {
  workspaceId?: string | null;
  extensionId: string;
  resourceId: string;
}): Promise<RuntimeExtensionResourceReadResponse | null> {
  return getRuntimeClient().extensionResourceReadV2(input);
}

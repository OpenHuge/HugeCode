import { getRuntimeClient } from "./runtimeClient";
import type { ThreadCreateRequest, ThreadSummary } from "../../../contracts/runtime";

/**
 * Canonical thread-summary runtime port for kernel/workspace-client assembly.
 *
 * This keeps `RuntimeKernel` off direct RPC wiring while preserving the exact
 * runtime contract shapes expected by shared workspace bindings.
 */
export async function listRuntimeThreads(workspaceId: string): Promise<ThreadSummary[]> {
  return getRuntimeClient().threads(workspaceId);
}

export async function createRuntimeThread(request: ThreadCreateRequest): Promise<ThreadSummary> {
  return getRuntimeClient().createThread(request);
}

export async function resumeRuntimeThread(
  workspaceId: string,
  threadId: string
): Promise<ThreadSummary | null> {
  return getRuntimeClient().resumeThread(workspaceId, threadId);
}

export async function archiveRuntimeThread(
  workspaceId: string,
  threadId: string
): Promise<boolean> {
  return Boolean(await getRuntimeClient().archiveThread(workspaceId, threadId));
}

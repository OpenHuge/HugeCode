import { getRuntimeClient } from "./runtimeClient";
import type { ThreadCreateRequest, ThreadSummary } from "../../../contracts/runtime";

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

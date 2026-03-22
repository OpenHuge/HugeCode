import { getRuntimeClient } from "./runtimeClient";

export async function listRuntimePrompts(workspaceId?: string | null) {
  return getRuntimeClient().promptLibrary(workspaceId ?? null);
}

export async function createRuntimePrompt(input: {
  workspaceId?: string | null;
  scope: "workspace" | "global";
  title: string;
  description: string;
  content: string;
}) {
  return getRuntimeClient().promptLibraryCreate({
    workspaceId: input.workspaceId ?? null,
    scope: input.scope,
    title: input.title,
    description: input.description,
    content: input.content,
  });
}

export async function updateRuntimePrompt(input: {
  workspaceId?: string | null;
  promptId: string;
  title: string;
  description: string;
  content: string;
}) {
  return getRuntimeClient().promptLibraryUpdate({
    workspaceId: input.workspaceId ?? null,
    promptId: input.promptId,
    title: input.title,
    description: input.description,
    content: input.content,
  });
}

export async function deleteRuntimePrompt(input: {
  workspaceId?: string | null;
  promptId: string;
}) {
  return getRuntimeClient().promptLibraryDelete({
    workspaceId: input.workspaceId ?? null,
    promptId: input.promptId,
  });
}

export async function moveRuntimePrompt(input: {
  workspaceId?: string | null;
  promptId: string;
  targetScope: "workspace" | "global";
}) {
  return getRuntimeClient().promptLibraryMove({
    workspaceId: input.workspaceId ?? null,
    promptId: input.promptId,
    targetScope: input.targetScope,
  });
}

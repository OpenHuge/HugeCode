import type { RuntimeInvocationExecuteFacade } from "../../../application/runtime/kernel/runtimeInvocationExecute";
import type { RuntimeInvocationCatalogFacade } from "../../../application/runtime/kernel/runtimeInvocationCatalog";
import type { WorkspaceInfo } from "../../../types";
import { resolveInvocationSlashCommandText } from "../../../utils/slashCommands";
import type { SendMessageOptions } from "./useThreadMessagingHelpers";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readComposePatchText(payload: unknown): string | null {
  const record = asRecord(payload);
  const text = record?.text;
  return typeof text === "string" && text.trim().length > 0 ? text : null;
}

export async function dispatchThreadRuntimeInvocationSlashCommand(input: {
  workspace: WorkspaceInfo;
  threadId: string;
  messageText: string;
  images: string[];
  options?: SendMessageOptions;
  resolveInvocationCatalog: (
    workspaceId: string
  ) => Pick<RuntimeInvocationCatalogFacade, "publishActiveCatalog">;
  resolveInvocationExecute: (workspaceId: string) => Pick<RuntimeInvocationExecuteFacade, "invoke">;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  safeMessageActivity: () => void;
  sendMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images: string[],
    options?: SendMessageOptions
  ) => Promise<void>;
}): Promise<boolean> {
  const { messageText, options, workspace, threadId } = input;
  if (options?.skipPromptExpansion || !messageText.startsWith("/")) {
    return false;
  }

  const catalog = await input
    .resolveInvocationCatalog(workspace.id)
    .publishActiveCatalog({ audience: "operator" })
    .catch(() => null);
  const slashInvocations =
    catalog?.items.filter(
      (item) => item.kind === "session_command" && Boolean(item.metadata?.slashCommand)
    ) ?? [];
  const resolvedInvocation = resolveInvocationSlashCommandText(messageText, slashInvocations);
  if (!resolvedInvocation) {
    return false;
  }

  if ("error" in resolvedInvocation) {
    input.pushThreadErrorMessage(threadId, resolvedInvocation.error);
    input.safeMessageActivity();
    return true;
  }

  const execution = await input.resolveInvocationExecute(workspace.id).invoke({
    invocationId: resolvedInvocation.invocationId,
    arguments: resolvedInvocation.arguments,
    context: {
      threadId,
      telemetrySource: "thread_messaging",
    },
    caller: "operator",
  });
  if (!execution.ok) {
    input.pushThreadErrorMessage(threadId, execution.message);
    input.safeMessageActivity();
    return true;
  }
  if (execution.kind === "compose_patch_resolved") {
    const composePatchText = readComposePatchText(execution.payload);
    if (!composePatchText) {
      input.pushThreadErrorMessage(
        threadId,
        `Invocation \`${resolvedInvocation.invocationId}\` returned an invalid compose patch payload.`
      );
      input.safeMessageActivity();
      return true;
    }
    await input.sendMessageToThread(workspace, threadId, composePatchText, input.images, {
      ...options,
      skipPromptExpansion: true,
    });
  }

  return true;
}

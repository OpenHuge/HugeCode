import type {
  InvocationAudience,
  InvocationDescriptor,
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  PromptLibraryEntry,
  RuntimeExtensionToolInvokeRequest,
  RuntimeExtensionToolInvokeResponse,
  RuntimeRunStartRequest,
  RuntimeRunStartV2Response,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import type { RuntimeInvocationCatalogFacade } from "./runtimeInvocationCatalog";

export type RuntimeInvocationExecuteInput = {
  invocationId: string;
  arguments?: Record<string, unknown> | null;
  context?: {
    threadId?: string | null;
    turnId?: string | null;
    telemetrySource?: string | null;
  };
  caller?: InvocationAudience;
};

export type RuntimeInvocationExecuteSuccessKind =
  | "runtime_run_started"
  | "live_skill_executed"
  | "session_message_sent"
  | "approval_resolved"
  | "extension_tool_executed"
  | "compose_patch_resolved";

export type RuntimeInvocationExecuteFailureKind = "blocked" | "unsupported";

export type RuntimeInvocationExecuteResult =
  | {
      invocationId: string;
      kind: RuntimeInvocationExecuteSuccessKind;
      ok: true;
      payload: unknown;
      message: string | null;
    }
  | {
      invocationId: string;
      kind: RuntimeInvocationExecuteFailureKind;
      ok: false;
      payload: null;
      message: string;
    };

export type RuntimeInvocationExecuteFacade = {
  invoke: (input: RuntimeInvocationExecuteInput) => Promise<RuntimeInvocationExecuteResult>;
};

type RuntimeInvocationExecuteFacadeInput = {
  workspaceId: string;
  invocationCatalog: Pick<RuntimeInvocationCatalogFacade, "getInvocationDescriptor">;
  sessionCommands: Pick<RuntimeSessionCommandFacade, "sendMessage" | "respondToApproval">;
  startRuntimeRun: (request: RuntimeRunStartRequest) => Promise<RuntimeRunStartV2Response>;
  runRuntimeLiveSkill: (request: LiveSkillExecuteRequest) => Promise<LiveSkillExecutionResult>;
  invokeRuntimeExtensionTool: (
    request: RuntimeExtensionToolInvokeRequest
  ) => Promise<RuntimeExtensionToolInvokeResponse>;
  listRuntimePrompts: (workspaceId?: string | null) => Promise<PromptLibraryEntry[]>;
};

type PromptOverlayMetadata = {
  promptId: string;
  scope: "workspace" | "global" | null;
  cursorOffset: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArgumentsRecord(
  value: RuntimeInvocationExecuteInput["arguments"]
): Record<string, unknown> {
  return asRecord(value) ?? {};
}

function readPromptOverlayMetadata(descriptor: InvocationDescriptor): PromptOverlayMetadata | null {
  const metadata = asRecord(descriptor.metadata);
  const promptOverlay = asRecord(metadata?.promptOverlay);
  const slashCommand = asRecord(metadata?.slashCommand);
  if (!promptOverlay || typeof promptOverlay.promptId !== "string") {
    return null;
  }
  const scope =
    promptOverlay.scope === "workspace" || promptOverlay.scope === "global"
      ? promptOverlay.scope
      : null;
  return {
    promptId: promptOverlay.promptId,
    scope,
    cursorOffset: typeof slashCommand?.cursorOffset === "number" ? slashCommand.cursorOffset : null,
  };
}

function buildUnsupported(invocationId: string, message: string): RuntimeInvocationExecuteResult {
  return {
    invocationId,
    kind: "unsupported",
    ok: false,
    payload: null,
    message,
  };
}

function buildBlocked(invocationId: string, message: string): RuntimeInvocationExecuteResult {
  return {
    invocationId,
    kind: "blocked",
    ok: false,
    payload: null,
    message,
  };
}

function buildSuccess(
  invocationId: string,
  kind: RuntimeInvocationExecuteSuccessKind,
  payload: unknown
): RuntimeInvocationExecuteResult {
  return {
    invocationId,
    kind,
    ok: true,
    payload,
    message: null,
  };
}

function isVisibleToCaller(descriptor: InvocationDescriptor, caller: InvocationAudience): boolean {
  return caller === "model"
    ? descriptor.exposure.modelVisible
    : descriptor.exposure.operatorVisible;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function promptArgumentNames(content: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/\$[A-Z][A-Z0-9_]*/g)) {
    const name = match[0].slice(1);
    if (name === "ARGUMENTS" || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

function expandNamedPlaceholders(content: string, values: Record<string, string>): string {
  return content.replace(/\$[A-Z][A-Z0-9_]*/g, (match, offset) => {
    if (offset > 0 && content[offset - 1] === "$") {
      return match;
    }
    const key = match.slice(1);
    return values[key] ?? match;
  });
}

function expandNumericPlaceholders(content: string, args: string[]): string {
  let output = "";
  let index = 0;
  let cachedJoined: string | null = null;

  while (index < content.length) {
    const next = content.indexOf("$", index);
    if (next === -1) {
      output += content.slice(index);
      break;
    }
    output += content.slice(index, next);
    const rest = content.slice(next);
    const nextChar = rest[1];

    if (nextChar === "$" && rest.length >= 2) {
      output += "$$";
      index = next + 2;
      continue;
    }

    if (nextChar && /[1-9]/.test(nextChar)) {
      const argIndex = Number(nextChar) - 1;
      if (Number.isFinite(argIndex) && args[argIndex]) {
        output += args[argIndex];
      }
      index = next + 2;
      continue;
    }

    if (rest.length > 1 && rest.slice(1).startsWith("ARGUMENTS")) {
      if (args.length > 0) {
        cachedJoined ??= args.join(" ");
        output += cachedJoined;
      }
      index = next + 1 + "ARGUMENTS".length;
      continue;
    }

    output += "$";
    index = next + 1;
  }

  return output;
}

function normalizePromptNamedValues(args: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (key === "_positional" || value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values[key] = String(value);
    }
  }
  return values;
}

function resolvePromptOverlayText(input: {
  prompt: PromptLibraryEntry;
  args: Record<string, unknown>;
}): { text: string } | { error: string } {
  const required = promptArgumentNames(input.prompt.content);
  if (required.length > 0) {
    const values = normalizePromptNamedValues(input.args);
    const missing = required.filter((name) => !(name in values));
    if (missing.length > 0) {
      return {
        error: `Missing required args for prompt \`${input.prompt.title}\`: ${missing.join(", ")}.`,
      };
    }
    return {
      text: expandNamedPlaceholders(input.prompt.content, values),
    };
  }

  const positional = Array.isArray(input.args._positional)
    ? input.args._positional.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    text: expandNumericPlaceholders(input.prompt.content, positional),
  };
}

export function createRuntimeInvocationExecuteFacade(
  input: RuntimeInvocationExecuteFacadeInput
): RuntimeInvocationExecuteFacade {
  return {
    invoke: async ({
      invocationId,
      arguments: invocationArguments,
      context,
      caller = "operator",
    }) => {
      const descriptor = await input.invocationCatalog.getInvocationDescriptor(invocationId);
      if (!descriptor) {
        return buildUnsupported(invocationId, `Invocation \`${invocationId}\` is not registered.`);
      }
      if (!isVisibleToCaller(descriptor, caller)) {
        return buildBlocked(
          invocationId,
          `Invocation \`${invocationId}\` is not visible to ${caller} callers.`
        );
      }
      if (descriptor.exposure.requiresReadiness && !descriptor.readiness.available) {
        return buildBlocked(
          invocationId,
          descriptor.readiness.reason ?? `Invocation \`${invocationId}\` is not ready.`
        );
      }

      const args = asArgumentsRecord(invocationArguments);

      if (descriptor.kind === "plugin") {
        return buildUnsupported(
          invocationId,
          `Invocation \`${invocationId}\` does not expose a direct execute binding yet.`
        );
      }

      if (descriptor.kind === "runtime_tool" && descriptor.source.kind === "runtime_extension") {
        const toolName = descriptor.runtimeTool?.toolName ?? descriptor.title;
        const extensionId =
          readString(asRecord(descriptor.metadata) ?? {}, "extensionId") ??
          descriptor.source.sourceId;
        const payload = await input.invokeRuntimeExtensionTool({
          workspaceId: input.workspaceId,
          extensionId,
          toolName,
          input: args,
        });
        return buildSuccess(invocationId, "extension_tool_executed", payload);
      }

      if (
        descriptor.kind === "runtime_tool" &&
        descriptor.runtimeTool?.toolName === "start-runtime-run"
      ) {
        const payload = await input.startRuntimeRun({
          ...(args as RuntimeRunStartRequest),
          workspaceId: input.workspaceId,
          ...(context?.threadId && !("threadId" in args) ? { threadId: context.threadId } : {}),
        });
        return buildSuccess(invocationId, "runtime_run_started", payload);
      }

      if (
        descriptor.kind === "runtime_tool" &&
        descriptor.runtimeTool?.toolName === "run-runtime-live-skill"
      ) {
        const skillId = readString(args, "skillId");
        const liveSkillInput = readString(args, "input");
        if (!skillId || !liveSkillInput) {
          return buildBlocked(
            invocationId,
            "Runtime live skill execution requires `skillId` and `input`."
          );
        }
        const options = {
          ...(asRecord(args.options) ?? {}),
          workspaceId: input.workspaceId,
        };
        const payload = await input.runRuntimeLiveSkill({
          skillId,
          input: liveSkillInput,
          ...(Object.keys(options).length > 0 ? { options } : {}),
        });
        return buildSuccess(invocationId, "live_skill_executed", payload);
      }

      if (descriptor.kind === "session_command") {
        const promptOverlay = readPromptOverlayMetadata(descriptor);
        if (promptOverlay) {
          const prompts = await input.listRuntimePrompts(input.workspaceId);
          const prompt = prompts.find((entry) => entry.id === promptOverlay.promptId);
          if (!prompt) {
            return buildBlocked(
              invocationId,
              `Prompt overlay \`${promptOverlay.promptId}\` is no longer available.`
            );
          }
          const resolved = resolvePromptOverlayText({
            prompt,
            args,
          });
          if ("error" in resolved) {
            return buildBlocked(invocationId, resolved.error);
          }
          return buildSuccess(invocationId, "compose_patch_resolved", {
            text: resolved.text,
            cursorOffset: promptOverlay.cursorOffset,
            promptId: promptOverlay.promptId,
            scope: promptOverlay.scope,
          });
        }

        if (invocationId === "session:send-message") {
          const threadId = readString(args, "threadId") ?? context?.threadId ?? null;
          const text = readString(args, "text");
          if (!threadId || !text) {
            return buildBlocked(
              invocationId,
              "Session message execution requires `threadId` and `text`."
            );
          }
          const payload = await input.sessionCommands.sendMessage({
            threadId,
            text,
            options: {
              telemetrySource: context?.telemetrySource ?? "runtime_invocation_execute",
            },
          });
          return buildSuccess(invocationId, "session_message_sent", payload);
        }

        if (invocationId === "session:respond-to-approval") {
          const requestId = args.requestId;
          const decision = args.decision;
          if (
            (typeof requestId !== "string" && typeof requestId !== "number") ||
            (decision !== "accept" && decision !== "decline")
          ) {
            return buildBlocked(
              invocationId,
              "Approval resolution requires `requestId` and `decision`."
            );
          }
          const payload = await input.sessionCommands.respondToApproval({
            requestId,
            decision,
          });
          return buildSuccess(invocationId, "approval_resolved", payload);
        }
      }

      return buildUnsupported(
        invocationId,
        `Invocation \`${invocationId}\` does not have a supported execute binding.`
      );
    },
  };
}

import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
  resourceNotFoundError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type RuntimeTerminalControl = RuntimeAgentControl & {
  openRuntimeTerminalSession?: (input?: { workspaceId?: string | null }) => Promise<unknown>;
  readRuntimeTerminalSession?: (sessionId: string) => Promise<unknown>;
  writeRuntimeTerminalSession?: (input: { sessionId: string; input: string }) => Promise<unknown>;
  interruptRuntimeTerminalSession?: (sessionId: string) => Promise<unknown>;
  resizeRuntimeTerminalSession?: (input: {
    sessionId: string;
    rows: number;
    cols: number;
  }) => Promise<unknown>;
  closeRuntimeTerminalSession?: (sessionId: string) => Promise<unknown>;
};

type RuntimeTerminalControlMethodName =
  | "openRuntimeTerminalSession"
  | "readRuntimeTerminalSession"
  | "writeRuntimeTerminalSession"
  | "interruptRuntimeTerminalSession"
  | "resizeRuntimeTerminalSession"
  | "closeRuntimeTerminalSession";

type RuntimeTerminalHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  "buildResponse" | "confirmWriteAction" | "toNonEmptyString" | "toPositiveInteger"
>;

function requireRuntimeTerminalControlMethod<MethodName extends RuntimeTerminalControlMethodName>(
  control: RuntimeTerminalControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeTerminalControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeTerminalControl[MethodName]>;
}

function getRequiredSessionId(
  input: Record<string, unknown>,
  helpers: RuntimeTerminalHelpers
): string {
  const sessionId = helpers.toNonEmptyString(input.sessionId);
  if (!sessionId) {
    throw requiredInputError("sessionId is required.");
  }
  return sessionId;
}

function getRequiredTerminalInput(
  input: Record<string, unknown>,
  _helpers: RuntimeTerminalHelpers
): string {
  const terminalInput = input.input;
  if (typeof terminalInput !== "string" || terminalInput.length === 0) {
    throw requiredInputError("input is required.");
  }
  return terminalInput;
}

function getRequiredPositiveInteger(
  input: Record<string, unknown>,
  fieldName: "rows" | "cols",
  helpers: RuntimeTerminalHelpers
): number {
  const value = helpers.toPositiveInteger(input[fieldName]);
  if (!value) {
    throw invalidInputError(`${fieldName} must be a positive integer.`);
  }
  return value;
}

export function buildRuntimeTerminalTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest"
  > & {
    helpers: RuntimeTerminalHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimeTerminalControl;

  return [
    {
      name: "open-runtime-terminal-session",
      description: "Open a persistent runtime terminal session and return the runtime session id.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { openWorldHint: true },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Open a runtime terminal session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const openRuntimeTerminalSession = requireRuntimeTerminalControlMethod(
          control,
          "openRuntimeTerminalSession",
          "open-runtime-terminal-session"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const session = await openRuntimeTerminalSession({ workspaceId });
        return helpers.buildResponse("Runtime terminal session opened.", {
          workspaceId,
          session,
        });
      },
    },
    {
      name: "read-runtime-terminal-session",
      description: "Read the current state and output lines for a runtime terminal session.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const readRuntimeTerminalSession = requireRuntimeTerminalControlMethod(
          control,
          "readRuntimeTerminalSession",
          "read-runtime-terminal-session"
        );
        const sessionId = getRequiredSessionId(input, helpers);
        const session = await readRuntimeTerminalSession(sessionId);
        if (session === null) {
          throw resourceNotFoundError(`Runtime terminal session ${sessionId} was not found.`);
        }
        return helpers.buildResponse("Runtime terminal session read.", {
          workspaceId: snapshot.workspaceId,
          session,
        });
      },
    },
    {
      name: "write-runtime-terminal-session",
      description:
        "Write input into an existing runtime terminal session using the runtime session id.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          input: { type: "string" },
        },
        required: ["sessionId", "input"],
      },
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Write to a runtime terminal session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const writeRuntimeTerminalSession = requireRuntimeTerminalControlMethod(
          control,
          "writeRuntimeTerminalSession",
          "write-runtime-terminal-session"
        );
        const sessionId = getRequiredSessionId(input, helpers);
        const terminalInput = getRequiredTerminalInput(input, helpers);
        const session = await writeRuntimeTerminalSession({
          sessionId,
          input: terminalInput,
        });
        if (session === null) {
          throw resourceNotFoundError(`Runtime terminal session ${sessionId} was not found.`);
        }
        return helpers.buildResponse("Runtime terminal session written.", {
          workspaceId: snapshot.workspaceId,
          session,
        });
      },
    },
    {
      name: "interrupt-runtime-terminal-session",
      description: "Interrupt an active runtime terminal session.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Interrupt a runtime terminal session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const interruptRuntimeTerminalSession = requireRuntimeTerminalControlMethod(
          control,
          "interruptRuntimeTerminalSession",
          "interrupt-runtime-terminal-session"
        );
        const sessionId = getRequiredSessionId(input, helpers);
        const interrupted = await interruptRuntimeTerminalSession(sessionId);
        if (interrupted === false) {
          throw resourceNotFoundError(`Runtime terminal session ${sessionId} was not found.`);
        }
        return helpers.buildResponse("Runtime terminal session interrupted.", {
          workspaceId: snapshot.workspaceId,
          sessionId,
          interrupted,
        });
      },
    },
    {
      name: "resize-runtime-terminal-session",
      description: "Resize an existing runtime terminal session using positive rows and cols.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          rows: { type: "number" },
          cols: { type: "number" },
        },
        required: ["sessionId", "rows", "cols"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Resize a runtime terminal session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const resizeRuntimeTerminalSession = requireRuntimeTerminalControlMethod(
          control,
          "resizeRuntimeTerminalSession",
          "resize-runtime-terminal-session"
        );
        const sessionId = getRequiredSessionId(input, helpers);
        const rows = getRequiredPositiveInteger(input, "rows", helpers);
        const cols = getRequiredPositiveInteger(input, "cols", helpers);
        const resized = await resizeRuntimeTerminalSession({
          sessionId,
          rows,
          cols,
        });
        if (resized === false) {
          throw resourceNotFoundError(`Runtime terminal session ${sessionId} was not found.`);
        }
        return helpers.buildResponse("Runtime terminal session resized.", {
          workspaceId: snapshot.workspaceId,
          sessionId,
          rows,
          cols,
          resized,
        });
      },
    },
    {
      name: "close-runtime-terminal-session",
      description: "Close a runtime terminal session using the runtime session id.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Close a runtime terminal session in workspace ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const closeRuntimeTerminalSession = requireRuntimeTerminalControlMethod(
          control,
          "closeRuntimeTerminalSession",
          "close-runtime-terminal-session"
        );
        const sessionId = getRequiredSessionId(input, helpers);
        const closed = await closeRuntimeTerminalSession(sessionId);
        if (closed === false) {
          throw resourceNotFoundError(`Runtime terminal session ${sessionId} was not found.`);
        }
        return helpers.buildResponse("Runtime terminal session closed.", {
          workspaceId: snapshot.workspaceId,
          sessionId,
          closed,
        });
      },
    },
  ];
}

import { RUNTIME_MESSAGE_CODES } from "./runtimeMessageCodes";
import { createRuntimeError } from "./runtimeMessageEnvelope";
import type {
  AgentCommandCenterSnapshot,
  RuntimeAgentControl,
  WebMcpAgent,
} from "./webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
  taskSupport?: "none" | "partial" | "full";
};

type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: WebMcpToolAnnotations;
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

type RuntimeGitToolHelpers = {
  buildResponse: (message: string, data: JsonRecord) => JsonRecord;
  toNonEmptyString: (value: unknown) => string | null;
  confirmWriteAction: (
    agent: WebMcpAgent | null,
    requireUserApproval: boolean,
    message: string,
    onApprovalRequest?: (message: string) => Promise<boolean>
  ) => Promise<void>;
};

type BuildRuntimeGitToolsOptions = {
  snapshot: AgentCommandCenterSnapshot;
  runtimeControl: RuntimeAgentControl;
  requireUserApproval: boolean;
  onApprovalRequest?: (message: string) => Promise<boolean>;
  helpers: RuntimeGitToolHelpers;
};

type RuntimeGitControl = RuntimeAgentControl & {
  getGitStatus?: (workspaceId: string) => Promise<unknown>;
  getGitDiffs?: (workspaceId: string) => Promise<unknown>;
  listGitBranches?: (workspaceId: string) => Promise<unknown>;
  stageGitFile?: (workspaceId: string, path: string) => Promise<void>;
  stageGitAll?: (workspaceId: string) => Promise<void>;
  unstageGitFile?: (workspaceId: string, path: string) => Promise<void>;
  revertGitFile?: (workspaceId: string, path: string) => Promise<void>;
  commitGit?: (workspaceId: string, message: string) => Promise<void>;
  createGitBranch?: (workspaceId: string, name: string) => Promise<void>;
  checkoutGitBranch?: (workspaceId: string, name: string) => Promise<void>;
};

type RuntimeGitControlMethodName =
  | "getGitStatus"
  | "getGitDiffs"
  | "listGitBranches"
  | "stageGitFile"
  | "stageGitAll"
  | "unstageGitFile"
  | "revertGitFile"
  | "commitGit"
  | "createGitBranch"
  | "checkoutGitBranch";

function requireRuntimeGitControlMethod<MethodName extends RuntimeGitControlMethodName>(
  control: RuntimeGitControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeGitControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw createRuntimeError({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.methodUnavailable,
      message: `Tool ${toolName} is unavailable because runtime control method ${String(methodName)} is not implemented.`,
    });
  }
  return candidate as NonNullable<RuntimeGitControl[MethodName]>;
}

export function buildRuntimeGitTools(options: BuildRuntimeGitToolsOptions): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const runtimeGitControl = runtimeControl as RuntimeGitControl;

  return [
    {
      name: "get-runtime-git-status",
      description: "Read runtime git status summary for branch, staged/unstaged files, and totals.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      execute: async (input) => {
        const getGitStatus = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "getGitStatus",
          "get-runtime-git-status"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const status = await getGitStatus(workspaceId);
        return helpers.buildResponse("Runtime git status retrieved.", {
          workspaceId,
          status,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-git-diffs",
      description: "Read runtime git diffs and optionally filter by file path.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
        },
      },
      execute: async (input) => {
        const getGitDiffs = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "getGitDiffs",
          "get-runtime-git-diffs"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const targetPath = helpers.toNonEmptyString(input.path);
        const rawDiffs = (await getGitDiffs(workspaceId)) as unknown[];
        const diffs =
          targetPath === null
            ? rawDiffs
            : rawDiffs.filter((entry) => {
                if (!entry || typeof entry !== "object") {
                  return false;
                }
                return (entry as { path?: unknown }).path === targetPath;
              });
        return helpers.buildResponse("Runtime git diffs retrieved.", {
          workspaceId,
          total: diffs.length,
          diffs,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "list-runtime-git-branches",
      description: "List runtime git branches and current branch metadata.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      execute: async (input) => {
        const listGitBranches = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "listGitBranches",
          "list-runtime-git-branches"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const branches = await listGitBranches(workspaceId);
        return helpers.buildResponse("Runtime git branches retrieved.", {
          workspaceId,
          branches,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "stage-runtime-git-file",
      description: "Stage a runtime git file change by path.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
        },
        required: ["path"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Stage runtime git file in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const stageGitFile = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "stageGitFile",
          "stage-runtime-git-file"
        );
        const path = helpers.toNonEmptyString(input.path);
        if (!path) {
          throw createRuntimeError({
            code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
            message: "path is required.",
          });
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await stageGitFile(workspaceId, path);
        return helpers.buildResponse("Runtime git file staged.", {
          workspaceId,
          path,
        });
      },
    },
    {
      name: "stage-runtime-git-all",
      description: "Stage all runtime git changes for the workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Stage all runtime git changes in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const stageGitAll = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "stageGitAll",
          "stage-runtime-git-all"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await stageGitAll(workspaceId);
        return helpers.buildResponse("Runtime git changes staged.", {
          workspaceId,
        });
      },
    },
    {
      name: "unstage-runtime-git-file",
      description: "Unstage a runtime git file change by path.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
        },
        required: ["path"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Unstage runtime git file in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const unstageGitFile = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "unstageGitFile",
          "unstage-runtime-git-file"
        );
        const path = helpers.toNonEmptyString(input.path);
        if (!path) {
          throw createRuntimeError({
            code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
            message: "path is required.",
          });
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await unstageGitFile(workspaceId, path);
        return helpers.buildResponse("Runtime git file unstaged.", {
          workspaceId,
          path,
        });
      },
    },
    {
      name: "revert-runtime-git-file",
      description: "Revert an unstaged runtime git file change by path.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
        },
        required: ["path"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Revert runtime git file in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const revertGitFile = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "revertGitFile",
          "revert-runtime-git-file"
        );
        const path = helpers.toNonEmptyString(input.path);
        if (!path) {
          throw createRuntimeError({
            code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
            message: "path is required.",
          });
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await revertGitFile(workspaceId, path);
        return helpers.buildResponse("Runtime git file reverted.", {
          workspaceId,
          path,
        });
      },
      annotations: { destructiveHint: true },
    },
    {
      name: "commit-runtime-git",
      description: "Create a runtime git commit from staged changes.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          message: { type: "string" },
        },
        required: ["message"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Create runtime git commit in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const commitGit = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "commitGit",
          "commit-runtime-git"
        );
        const message = helpers.toNonEmptyString(input.message);
        if (!message) {
          throw createRuntimeError({
            code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
            message: "message is required.",
          });
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await commitGit(workspaceId, message);
        return helpers.buildResponse("Runtime git commit created.", {
          workspaceId,
          message,
        });
      },
    },
    {
      name: "create-runtime-git-branch",
      description: "Create a runtime git branch by name.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          name: { type: "string" },
        },
        required: ["name"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Create runtime git branch in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const createGitBranch = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "createGitBranch",
          "create-runtime-git-branch"
        );
        const name = helpers.toNonEmptyString(input.name);
        if (!name) {
          throw createRuntimeError({
            code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
            message: "name is required.",
          });
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await createGitBranch(workspaceId, name);
        return helpers.buildResponse("Runtime git branch created.", {
          workspaceId,
          name,
        });
      },
    },
    {
      name: "checkout-runtime-git-branch",
      description: "Checkout a runtime git branch by name.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          name: { type: "string" },
        },
        required: ["name"],
      },
      execute: async (input, agent) => {
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Checkout runtime git branch in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const checkoutGitBranch = requireRuntimeGitControlMethod(
          runtimeGitControl,
          "checkoutGitBranch",
          "checkout-runtime-git-branch"
        );
        const name = helpers.toNonEmptyString(input.name);
        if (!name) {
          throw createRuntimeError({
            code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
            message: "name is required.",
          });
        }
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        await checkoutGitBranch(workspaceId, name);
        return helpers.buildResponse("Runtime git branch checked out.", {
          workspaceId,
          name,
        });
      },
      annotations: { destructiveHint: true },
    },
  ];
}

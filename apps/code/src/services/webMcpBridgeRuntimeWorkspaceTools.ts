import {
  ensureCommandLengthWithinLimit,
  ensureNoDangerousShellCommand,
  ensureNoSubAgentOrchestrationShellCommand,
  ensurePayloadWithinLimit,
  normalizeWorkspaceRelativePath,
  toOptionalRecord,
} from "./webMcpBridgeRuntimeToolGuards";
import { canonicalizeLiveSkillId } from "./runtimeClientLiveSkills";
import {
  commandRestrictedError,
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
  resourceNotFoundError,
  toNonNegativeInteger,
  toOptionalBoolean,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  buildRuntimeLiveSkillResponse,
  buildRuntimeSkillIdResolution,
  getRuntimeLiveSkillCatalogIndex,
  resolveProviderModelFromInputAndAgentWithSource,
  requireRuntimeLiveSkillControlMethod,
  resolveWorkspaceId,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl, WebMcpAgent } from "./webMcpBridgeTypes";

type BuildRuntimeWorkspaceToolsOptions = BuildRuntimeToolsOptions & {
  maxRuntimeFilePayloadBytes: number;
  maxRuntimeCommandChars: number;
};

const LIVE_SKILL_LIST_CACHE_TTL_MS = 1_500;
type RuntimeLiveSkillSummary = {
  id: string;
  canonicalSkillId: string;
  enabled: boolean;
};
const emptyLiveSkillList: RuntimeLiveSkillSummary[] = [];
let cachedLiveSkills: {
  source: RuntimeAgentControl["listLiveSkills"] | null;
  expiresAtMs: number;
  value: RuntimeLiveSkillSummary[];
  inFlight: Promise<RuntimeLiveSkillSummary[]> | null;
} = {
  source: null,
  expiresAtMs: 0,
  value: emptyLiveSkillList,
  inFlight: null,
};

export function invalidateCachedRuntimeLiveSkills(
  listLiveSkills?: RuntimeAgentControl["listLiveSkills"] | null
): void {
  if (
    listLiveSkills &&
    cachedLiveSkills.source !== null &&
    cachedLiveSkills.source !== listLiveSkills
  ) {
    return;
  }
  cachedLiveSkills = {
    source: listLiveSkills ?? null,
    expiresAtMs: 0,
    value: emptyLiveSkillList,
    inFlight: null,
  };
}

async function getCachedLiveSkills(
  listLiveSkills: RuntimeAgentControl["listLiveSkills"] | undefined,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<RuntimeLiveSkillSummary[] | null> {
  if (typeof listLiveSkills !== "function") {
    return null;
  }

  const now = Date.now();
  const forceRefresh = options?.forceRefresh === true;
  if (
    !forceRefresh &&
    cachedLiveSkills.source === listLiveSkills &&
    cachedLiveSkills.inFlight === null &&
    now < cachedLiveSkills.expiresAtMs
  ) {
    return cachedLiveSkills.value;
  }
  if (!forceRefresh && cachedLiveSkills.source === listLiveSkills && cachedLiveSkills.inFlight) {
    return cachedLiveSkills.inFlight;
  }

  const inFlight = listLiveSkills()
    .then((skills) => {
      const normalizedSkills = skills.map((skill) => ({
        id: skill.id,
        canonicalSkillId: canonicalizeLiveSkillId(skill.id) ?? skill.id,
        enabled: skill.enabled,
      }));
      cachedLiveSkills = {
        source: listLiveSkills,
        expiresAtMs: Date.now() + LIVE_SKILL_LIST_CACHE_TTL_MS,
        value: normalizedSkills,
        inFlight: null,
      };
      return normalizedSkills;
    })
    .catch((error) => {
      cachedLiveSkills = {
        source: listLiveSkills,
        expiresAtMs: 0,
        value: emptyLiveSkillList,
        inFlight: null,
      };
      throw error;
    });

  cachedLiveSkills = {
    source: listLiveSkills,
    expiresAtMs: 0,
    value: emptyLiveSkillList,
    inFlight,
  };
  return inFlight;
}

function findRuntimeLiveSkillByCanonicalId(
  liveSkills: RuntimeLiveSkillSummary[],
  canonicalSkillId: string
): RuntimeLiveSkillSummary | null {
  return liveSkills.find((skill) => skill.canonicalSkillId === canonicalSkillId) ?? null;
}

async function assertRuntimeLiveSkillAvailable(input: {
  listLiveSkills: RuntimeAgentControl["listLiveSkills"] | undefined;
  canonicalSkillId: string;
  toolName: string;
  unavailableMessage?: string;
}): Promise<void> {
  if (typeof input.listLiveSkills !== "function") {
    return;
  }
  const findSkill = async (forceRefresh: boolean) => {
    const liveSkills =
      (await getCachedLiveSkills(input.listLiveSkills, { forceRefresh })) ?? emptyLiveSkillList;
    return findRuntimeLiveSkillByCanonicalId(liveSkills, input.canonicalSkillId);
  };
  let skill = await findSkill(false);
  if (!skill || !skill.enabled) {
    skill = await findSkill(true);
  }
  if (!skill) {
    throw resourceNotFoundError(
      input.unavailableMessage ??
        `live skill ${input.canonicalSkillId} is not available in this runtime.`
    );
  }
  if (!skill.enabled) {
    throw methodUnavailableError(
      input.toolName,
      `live skill ${input.canonicalSkillId}`,
      input.unavailableMessage
    );
  }
}

function buildLiveSkillCallerContext(
  input: Record<string, unknown>,
  agent: WebMcpAgent | null,
  toNonEmptyString: (value: unknown) => string | null
): { provider?: string; modelId?: string } | null {
  const callerModelContext = resolveProviderModelFromInputAndAgentWithSource(input, agent, {
    toNonEmptyString,
  });
  const provider = callerModelContext.provider;
  const modelId = callerModelContext.modelId;
  if (!provider && !modelId) {
    return null;
  }
  return {
    ...(provider ? { provider } : {}),
    ...(modelId ? { modelId } : {}),
  };
}

export function buildRuntimeWorkspaceTools(
  options: BuildRuntimeWorkspaceToolsOptions
): WebMcpToolDescriptor[] {
  const {
    snapshot,
    runtimeControl,
    requireUserApproval,
    onApprovalRequest,
    helpers,
    maxRuntimeFilePayloadBytes,
    maxRuntimeCommandChars,
  } = options;

  const buildLiveSkillResponse = (input: {
    toolName: string;
    message: string;
    result: {
      output: string;
      metadata: Record<string, unknown>;
    } & Record<string, unknown>;
    extraData?: Record<string, unknown>;
  }) => {
    return buildRuntimeLiveSkillResponse({
      toolName: input.toolName,
      message: input.message,
      result: input.result,
      workspaceId: snapshot.workspaceId,
      buildResponse: helpers.buildResponse,
      extraData: input.extraData,
    });
  };

  return [
    {
      name: "search-workspace-files",
      description:
        "Search workspace files using runtime core-grep with literal/regex mode, globs, and context lines.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
          pattern: { type: "string" },
          mode: { type: "string", enum: ["literal", "regex"] },
          caseSensitive: { type: "boolean" },
          wholeWord: { type: "boolean" },
          includeHidden: { type: "boolean" },
          maxResults: { type: "number" },
          includeGlobs: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          excludeGlobs: {
            oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          },
          contextBefore: { type: "number" },
          contextAfter: { type: "number" },
        },
        required: ["pattern"],
      },
      execute: async (input) => {
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "search-workspace-files"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "core-grep",
          toolName: "search-workspace-files",
          unavailableMessage: "core-grep live skill is unavailable in this runtime.",
        });

        const pattern =
          helpers.toNonEmptyString(input.pattern) ?? helpers.toNonEmptyString(input.query);
        if (!pattern) {
          throw requiredInputError("pattern is required.");
        }
        const mode = helpers.toNonEmptyString(input.mode);
        let matchMode: "literal" | "regex" | null = null;
        if (mode === "literal" || mode === "regex") {
          matchMode = mode;
        } else if (mode) {
          throw invalidInputError("mode must be literal or regex.");
        }

        const contextBefore = toNonNegativeInteger(input.contextBefore);
        const contextAfter = toNonNegativeInteger(input.contextAfter);
        const rawPath = helpers.toNonEmptyString(input.path);
        const normalizedPath = rawPath
          ? normalizeWorkspaceRelativePath(rawPath, {
              toolName: "search-workspace-files",
              fieldName: "path",
              allowDot: true,
            })
          : null;
        const result = await runLiveSkill({
          skillId: "core-grep",
          input: pattern,
          options: {
            workspaceId: resolveWorkspaceId(input, snapshot, helpers),
            path: normalizedPath,
            pattern,
            query: pattern,
            matchMode,
            caseSensitive: toOptionalBoolean(input.caseSensitive),
            wholeWord: toOptionalBoolean(input.wholeWord),
            includeHidden: toOptionalBoolean(input.includeHidden),
            maxResults: helpers.toPositiveInteger(input.maxResults),
            includeGlobs: helpers.toStringArray(input.includeGlobs),
            excludeGlobs: helpers.toStringArray(input.excludeGlobs),
            contextBefore,
            contextAfter,
          },
        });

        return buildLiveSkillResponse({
          toolName: "search-workspace-files",
          message: "Workspace file search completed.",
          result,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "list-workspace-tree",
      description:
        "List workspace files/directories using runtime core-tree without shell fallback.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
          query: { type: "string" },
          maxDepth: { type: "number" },
          maxResults: { type: "number" },
          includeHidden: { type: "boolean" },
        },
      },
      execute: async (input) => {
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "list-workspace-tree"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "core-tree",
          toolName: "list-workspace-tree",
        });
        const path = normalizeWorkspaceRelativePath(helpers.toNonEmptyString(input.path) ?? ".", {
          toolName: "list-workspace-tree",
          fieldName: "path",
          allowDot: true,
        });
        const query = helpers.toNonEmptyString(input.query);
        const maxDepth = toNonNegativeInteger(input.maxDepth);
        const result = await runLiveSkill({
          skillId: "core-tree",
          input: path,
          options: {
            workspaceId: resolveWorkspaceId(input, snapshot, helpers),
            path,
            query,
            maxDepth,
            maxResults: helpers.toPositiveInteger(input.maxResults),
            includeHidden: toOptionalBoolean(input.includeHidden),
          },
        });
        return buildLiveSkillResponse({
          toolName: "list-workspace-tree",
          message: "Workspace tree listed.",
          result,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "read-workspace-file",
      description: "Read a workspace file using runtime core-read without shell fallback.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
        },
        required: ["path"],
      },
      execute: async (input) => {
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "read-workspace-file"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "core-read",
          toolName: "read-workspace-file",
        });
        const path = helpers.toNonEmptyString(input.path);
        if (!path) {
          throw requiredInputError("path is required.");
        }
        const normalizedPath = normalizeWorkspaceRelativePath(path, {
          toolName: "read-workspace-file",
          fieldName: "path",
        });
        const result = await runLiveSkill({
          skillId: "core-read",
          input: normalizedPath,
          options: {
            workspaceId: resolveWorkspaceId(input, snapshot, helpers),
            path: normalizedPath,
          },
        });
        return buildLiveSkillResponse({
          toolName: "read-workspace-file",
          message: "Workspace file read completed.",
          result,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "write-workspace-file",
      description: "Write file content in workspace using runtime core-write skill.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
          content: { type: "string" },
          dryRun: { type: "boolean" },
        },
        required: ["path", "content"],
      },
      execute: async (input, agent) => {
        const path = helpers.toNonEmptyString(input.path);
        if (!path) {
          throw requiredInputError("path is required.");
        }
        const normalizedPath = normalizeWorkspaceRelativePath(path, {
          toolName: "write-workspace-file",
          fieldName: "path",
        });
        const content = typeof input.content === "string" ? input.content : null;
        if (content === null) {
          throw requiredInputError("content is required.");
        }
        ensurePayloadWithinLimit(content, {
          toolName: "write-workspace-file",
          fieldName: "content",
          maxBytes: maxRuntimeFilePayloadBytes,
        });
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        if (toOptionalBoolean(input.dryRun) === true) {
          return buildLiveSkillResponse({
            toolName: "write-workspace-file",
            message: "Workspace file write dry-run prepared.",
            result: {
              output: "",
              metadata: {
                workspaceId,
                path: normalizedPath,
                contentBytes: new TextEncoder().encode(content).length,
                dryRun: true,
              },
            },
          });
        }
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Write workspace file in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "write-workspace-file"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "core-write",
          toolName: "write-workspace-file",
        });
        const result = await runLiveSkill({
          skillId: "core-write",
          input: content,
          options: {
            workspaceId,
            path: normalizedPath,
            content,
          },
        });
        return buildLiveSkillResponse({
          toolName: "write-workspace-file",
          message: "Workspace file write completed.",
          result,
        });
      },
      annotations: {
        destructiveHint: true,
        title: "Write Workspace File",
        taskSupport: "full",
      },
    },
    {
      name: "edit-workspace-file",
      description: "Apply deterministic find/replace edit in workspace using runtime core-edit.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          path: { type: "string" },
          find: { type: "string" },
          replace: { type: "string" },
          dryRun: { type: "boolean" },
        },
        required: ["path", "find", "replace"],
      },
      execute: async (input, agent) => {
        const path = helpers.toNonEmptyString(input.path);
        if (!path) {
          throw requiredInputError("path is required.");
        }
        const normalizedPath = normalizeWorkspaceRelativePath(path, {
          toolName: "edit-workspace-file",
          fieldName: "path",
        });
        const find = typeof input.find === "string" ? input.find : null;
        const replace = typeof input.replace === "string" ? input.replace : null;
        if (find === null || replace === null) {
          throw requiredInputError("find and replace are required.");
        }
        ensurePayloadWithinLimit(find, {
          toolName: "edit-workspace-file",
          fieldName: "find",
          maxBytes: maxRuntimeFilePayloadBytes,
        });
        ensurePayloadWithinLimit(replace, {
          toolName: "edit-workspace-file",
          fieldName: "replace",
          maxBytes: maxRuntimeFilePayloadBytes,
        });
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        if (toOptionalBoolean(input.dryRun) === true) {
          return buildLiveSkillResponse({
            toolName: "edit-workspace-file",
            message: "Workspace file edit dry-run prepared.",
            result: {
              output: "",
              metadata: {
                workspaceId,
                path: normalizedPath,
                find,
                replacePreview: replace.length > 200 ? `${replace.slice(0, 200)}...` : replace,
                dryRun: true,
              },
            },
          });
        }
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Edit workspace file in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "edit-workspace-file"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "core-edit",
          toolName: "edit-workspace-file",
        });
        const result = await runLiveSkill({
          skillId: "core-edit",
          input: replace,
          options: {
            workspaceId,
            path: normalizedPath,
            find,
            replace,
          },
        });
        return buildLiveSkillResponse({
          toolName: "edit-workspace-file",
          message: "Workspace file edit completed.",
          result,
        });
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        title: "Edit Workspace File",
        taskSupport: "full",
      },
    },
    {
      name: "execute-workspace-command",
      description:
        "Execute workspace shell command via runtime core-bash. Not for sub-agent orchestration.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          command: { type: "string" },
          timeoutMs: { type: "number" },
          dryRun: { type: "boolean" },
        },
        required: ["command"],
      },
      execute: async (input, agent) => {
        const command = helpers.toNonEmptyString(input.command);
        if (!command) {
          throw requiredInputError("command is required.");
        }
        ensureNoDangerousShellCommand(command, "execute-workspace-command");
        ensureNoSubAgentOrchestrationShellCommand(command, "execute-workspace-command");
        ensureCommandLengthWithinLimit(command, {
          toolName: "execute-workspace-command",
          fieldName: "command",
          maxChars: maxRuntimeCommandChars,
        });
        const workspaceId = resolveWorkspaceId(input, snapshot, helpers);
        const timeoutMs = helpers.toPositiveInteger(input.timeoutMs);
        if (toOptionalBoolean(input.dryRun) === true) {
          return buildLiveSkillResponse({
            toolName: "execute-workspace-command",
            message: "Workspace command dry-run prepared.",
            result: {
              output: "",
              metadata: {
                workspaceId,
                command,
                timeoutMs,
                dryRun: true,
              },
            },
          });
        }
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Execute workspace command in ${snapshot.workspaceName}?`,
          onApprovalRequest
        );
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "execute-workspace-command"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "core-bash",
          toolName: "execute-workspace-command",
        });
        const result = await runLiveSkill({
          skillId: "core-bash",
          input: command,
          options: {
            workspaceId,
            command,
            timeoutMs,
          },
        });
        return buildLiveSkillResponse({
          toolName: "execute-workspace-command",
          message: "Workspace command executed.",
          result,
        });
      },
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        title: "Execute Workspace Command",
        taskSupport: "partial",
      },
    },
    {
      name: "query-network-analysis",
      description: "Run runtime network-analysis skill for live web research and synthesis.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          provider: { type: "string" },
          modelId: { type: "string" },
          maxResults: { type: "number" },
          maxCharsPerResult: { type: "number" },
          timeoutMs: { type: "number" },
        },
        required: ["query"],
      },
      execute: async (input, agent) => {
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "query-network-analysis"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "network-analysis",
          toolName: "query-network-analysis",
        });
        const query = helpers.toNonEmptyString(input.query);
        if (!query) {
          throw requiredInputError("query is required.");
        }
        const context = buildLiveSkillCallerContext(input, agent, helpers.toNonEmptyString);
        const result = await runLiveSkill({
          skillId: "network-analysis",
          input: query,
          options: {
            query,
            maxResults: helpers.toPositiveInteger(input.maxResults),
            maxCharsPerResult: helpers.toPositiveInteger(input.maxCharsPerResult),
            timeoutMs: helpers.toPositiveInteger(input.timeoutMs),
          },
          ...(context ? { context } : {}),
        });
        return buildLiveSkillResponse({
          toolName: "query-network-analysis",
          message: "Network analysis completed.",
          result,
        });
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        title: "Query Network Analysis",
        taskSupport: "full",
      },
    },
    {
      name: "run-runtime-live-skill",
      description:
        "Execute an enabled runtime live skill by id with optional input/options for advanced workflows. Skill aliases are canonicalized and reported back in skillResolution.",
      inputSchema: {
        type: "object",
        properties: {
          skillId: { type: "string" },
          input: { type: "string" },
          provider: { type: "string" },
          modelId: { type: "string" },
          workspaceId: { type: "string" },
          options: { type: "object", additionalProperties: true },
          requireApproval: { type: "boolean" },
        },
        required: ["skillId"],
      },
      execute: async (input, agent) => {
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "run-runtime-live-skill"
        );
        const skillId = helpers.toNonEmptyString(input.skillId);
        if (!skillId) {
          throw requiredInputError("skillId is required.");
        }
        const liveSkillCatalogIndex = await getRuntimeLiveSkillCatalogIndex(runtimeControl);
        const skillResolution = buildRuntimeSkillIdResolution(skillId, liveSkillCatalogIndex);
        const canonicalSkillId = skillResolution.resolvedSkillId;
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId,
          toolName: "run-runtime-live-skill",
        });
        const options = toOptionalRecord(input.options);
        const normalizedOptions: Record<string, unknown> = {
          ...(options ?? {}),
        };
        const liveSkillInput = helpers.toNonEmptyString(input.input) ?? "";
        const coreBashCommand =
          canonicalSkillId === "core-bash"
            ? (helpers.toNonEmptyString(normalizedOptions.command) ?? liveSkillInput)
            : null;
        if (coreBashCommand) {
          ensureNoDangerousShellCommand(coreBashCommand, "run-runtime-live-skill");
          ensureNoSubAgentOrchestrationShellCommand(coreBashCommand, "run-runtime-live-skill");
          ensureCommandLengthWithinLimit(coreBashCommand, {
            toolName: "run-runtime-live-skill",
            fieldName: "command",
            maxChars: maxRuntimeCommandChars,
          });
        }
        const pathAwareSkill = new Set([
          "core-tree",
          "core-grep",
          "core-read",
          "core-write",
          "core-edit",
        ]);
        if (pathAwareSkill.has(canonicalSkillId)) {
          const rawPath = helpers.toNonEmptyString(normalizedOptions.path);
          if (rawPath) {
            normalizedOptions.path = normalizeWorkspaceRelativePath(rawPath, {
              toolName: "run-runtime-live-skill",
              fieldName: "options.path",
              allowDot: canonicalSkillId === "core-tree" || canonicalSkillId === "core-grep",
            });
          }
        }
        if (canonicalSkillId === "core-write") {
          const content =
            typeof normalizedOptions.content === "string"
              ? normalizedOptions.content
              : liveSkillInput;
          ensurePayloadWithinLimit(content, {
            toolName: "run-runtime-live-skill",
            fieldName: "options.content",
            maxBytes: maxRuntimeFilePayloadBytes,
          });
          normalizedOptions.content = content;
        }
        if (canonicalSkillId === "core-edit") {
          const findValue =
            typeof normalizedOptions.find === "string" ? normalizedOptions.find : null;
          const replaceValue =
            typeof normalizedOptions.replace === "string"
              ? normalizedOptions.replace
              : liveSkillInput;
          if (findValue) {
            ensurePayloadWithinLimit(findValue, {
              toolName: "run-runtime-live-skill",
              fieldName: "options.find",
              maxBytes: maxRuntimeFilePayloadBytes,
            });
          }
          ensurePayloadWithinLimit(replaceValue, {
            toolName: "run-runtime-live-skill",
            fieldName: "options.replace",
            maxBytes: maxRuntimeFilePayloadBytes,
          });
          normalizedOptions.replace = replaceValue;
        }
        if (canonicalSkillId === "core-js-repl") {
          const source =
            typeof normalizedOptions.content === "string"
              ? normalizedOptions.content
              : liveSkillInput;
          ensurePayloadWithinLimit(source, {
            toolName: "run-runtime-live-skill",
            fieldName: "input",
            maxBytes: maxRuntimeFilePayloadBytes,
          });
          normalizedOptions.content = source;
        }

        const requiresApproval =
          toOptionalBoolean(input.requireApproval) === true ||
          canonicalSkillId === "core-write" ||
          canonicalSkillId === "core-edit" ||
          canonicalSkillId === "core-bash" ||
          canonicalSkillId === "core-js-repl";
        if (requiresApproval) {
          await helpers.confirmWriteAction(
            agent,
            requireUserApproval,
            canonicalSkillId === "core-js-repl"
              ? `Run runtime live skill ${canonicalSkillId} in ${snapshot.workspaceName}? This approval also covers nested codex.tool(...) calls in that REPL session.`
              : `Run runtime live skill ${canonicalSkillId} in ${snapshot.workspaceName}?`,
            onApprovalRequest
          );
        }

        const context = buildLiveSkillCallerContext(input, agent, helpers.toNonEmptyString);
        const result = await runLiveSkill({
          skillId: canonicalSkillId,
          input: liveSkillInput,
          options: {
            ...normalizedOptions,
            workspaceId:
              helpers.toNonEmptyString(input.workspaceId) ??
              helpers.toNonEmptyString(normalizedOptions.workspaceId) ??
              snapshot.workspaceId,
          },
          ...(context ? { context } : {}),
        });
        return buildLiveSkillResponse({
          toolName: "run-runtime-live-skill",
          message: "Runtime live skill executed.",
          result,
          extraData: {
            skillResolution,
          },
        });
      },
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        title: "Run Runtime Live Skill",
        taskSupport: "partial",
      },
    },
    {
      name: "run-runtime-computer-observe",
      description:
        "Execute the read-only core-computer-observe runtime skill. Command passthrough is blocked.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          input: { type: "string" },
          query: { type: "string" },
          provider: { type: "string" },
          modelId: { type: "string" },
          timeoutMs: { type: "number" },
          maxResults: { type: "number" },
          includeViewport: { type: "boolean" },
          options: {
            type: "object",
            properties: {
              workspaceId: { type: "string" },
              query: { type: "string" },
              timeoutMs: { type: "number" },
              maxResults: { type: "number" },
              includeViewport: { type: "boolean" },
            },
          },
        },
      },
      execute: async (input, agent) => {
        const runLiveSkill = requireRuntimeLiveSkillControlMethod(
          runtimeControl,
          "runLiveSkill",
          "run-runtime-computer-observe"
        );
        await assertRuntimeLiveSkillAvailable({
          listLiveSkills: runtimeControl.listLiveSkills,
          canonicalSkillId: "core-computer-observe",
          toolName: "run-runtime-computer-observe",
        });

        const options = toOptionalRecord(input.options);
        const directCommand = helpers.toNonEmptyString(input.command);
        const optionsCommand = helpers.toNonEmptyString(options?.command);
        if (directCommand || optionsCommand) {
          throw commandRestrictedError(
            "command passthrough is not supported for run-runtime-computer-observe."
          );
        }

        const query =
          helpers.toNonEmptyString(input.query) ??
          helpers.toNonEmptyString(options?.query) ??
          helpers.toNonEmptyString(input.input);
        if (query) {
          ensurePayloadWithinLimit(query, {
            toolName: "run-runtime-computer-observe",
            fieldName: "query",
            maxBytes: maxRuntimeCommandChars,
          });
        }
        const normalizedWorkspaceId =
          helpers.toNonEmptyString(input.workspaceId) ??
          helpers.toNonEmptyString(options?.workspaceId) ??
          snapshot.workspaceId;
        const context = buildLiveSkillCallerContext(input, agent, helpers.toNonEmptyString);
        const result = await runLiveSkill({
          skillId: "core-computer-observe",
          input: query ?? "",
          options: {
            workspaceId: normalizedWorkspaceId,
            query: query ?? null,
            maxResults:
              helpers.toPositiveInteger(input.maxResults) ??
              helpers.toPositiveInteger(options?.maxResults),
            timeoutMs:
              helpers.toPositiveInteger(input.timeoutMs) ??
              helpers.toPositiveInteger(options?.timeoutMs),
            includeViewport:
              toOptionalBoolean(input.includeViewport) ??
              toOptionalBoolean(options?.includeViewport),
          },
          ...(context ? { context } : {}),
        });
        return buildLiveSkillResponse({
          toolName: "run-runtime-computer-observe",
          message: "Runtime computer observe completed.",
          result,
        });
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        title: "Run Runtime Computer Observe",
        taskSupport: "partial",
      },
    },
  ];
}

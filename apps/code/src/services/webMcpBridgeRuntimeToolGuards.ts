import {
  commandRestrictedError,
  pathOutsideWorkspaceError,
  payloadTooLargeError,
} from "./webMcpBridgeRuntimeToolHelpers";

type JsonRecord = Record<string, unknown>;

export const RUNTIME_TOOL_DEFAULT_PAYLOAD_MAX_BYTES = 64 * 1024;

const SUB_AGENT_ORCHESTRATION_KEYWORDS = [
  "sub agent",
  "sub-agent",
  "sub_agent",
  "subagents",
  "subagent",
  "spawn agent",
  "spawn-agent",
  "spawn_agent",
  "multi agent",
  "multi-agent",
  "multi_agent",
  "parallel agent",
  "parallel-agent",
  "parallel_agent",
  "agent team",
  "agent-team",
  "agent_team",
] as const;

const SUB_AGENT_ORCHESTRATION_COMPACT_KEYWORDS = [
  "子代理",
  "多代理",
  "并行代理",
  "代理编排",
  "启用subagent",
  "启用subagents",
] as const;

const WINDOWS_ABSOLUTE_PATH_RE = /^[a-zA-Z]:[/\\]/;
const DANGEROUS_SHELL_PATTERNS = [
  /(^|[\s;&|])rm\s+-rf\s+\/($|[\s;&|])/,
  /(^|[\s;&|])sudo\s+rm\s+-rf\s+\/($|[\s;&|])/,
  /(^|[\s;&|])mkfs(\.[a-z0-9]+)?\s+/,
  /(^|[\s;&|])dd\s+if=\/dev\/zero\s+of=/,
  /(^|[\s;&|])(shutdown|reboot|halt|poweroff)\b/,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
] as const;

type NormalizeWorkspacePathOptions = {
  toolName: string;
  fieldName: string;
  allowDot?: boolean;
};

type PayloadLimitOptions = {
  toolName: string;
  fieldName: string;
  maxBytes: number;
};

type CommandLengthLimitOptions = {
  toolName: string;
  fieldName: string;
  maxChars: number;
};

export function requestRequiresSubAgentOrchestration(instruction: string): boolean {
  const lowered = instruction.toLowerCase();
  if (SUB_AGENT_ORCHESTRATION_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
    return true;
  }
  const compactLowered = instruction.replace(/\s+/g, "").toLowerCase();
  return SUB_AGENT_ORCHESTRATION_COMPACT_KEYWORDS.some((keyword) =>
    compactLowered.includes(keyword)
  );
}

export function ensureNoSubAgentOrchestrationShellCommand(command: string, toolName: string): void {
  if (!requestRequiresSubAgentOrchestration(command)) {
    return;
  }
  throw commandRestrictedError(
    `Tool ${toolName} blocked shell execution because the request asks for sub-agent orchestration. Use start-runtime-run or runtime sub-agent session tools instead.`
  );
}

export function ensureNoDangerousShellCommand(command: string, toolName: string): void {
  const normalized = command.trim().toLowerCase();
  if (normalized.length === 0) {
    return;
  }
  const matched = DANGEROUS_SHELL_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!matched) {
    return;
  }
  throw commandRestrictedError(
    `Tool ${toolName} blocked a dangerous command pattern. Use workspace-scoped non-destructive commands instead.`
  );
}

function isAbsolutePath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("\\") ||
    value.startsWith("~") ||
    WINDOWS_ABSOLUTE_PATH_RE.test(value)
  );
}

export function normalizeWorkspaceRelativePath(
  inputPath: string,
  options: NormalizeWorkspacePathOptions
): string {
  const trimmed = inputPath.trim();
  if (trimmed.length === 0) {
    if (options.allowDot) {
      return ".";
    }
    throw pathOutsideWorkspaceError(
      `Tool ${options.toolName} rejected ${options.fieldName}: path is required.`
    );
  }
  if (trimmed === ".") {
    if (options.allowDot) {
      return ".";
    }
    throw pathOutsideWorkspaceError(
      `Tool ${options.toolName} rejected ${options.fieldName}: path must target a workspace file or directory.`
    );
  }
  if (isAbsolutePath(trimmed)) {
    throw pathOutsideWorkspaceError(
      `Tool ${options.toolName} rejected ${options.fieldName}: absolute paths are not allowed. Use workspace-relative paths.`
    );
  }

  const segments = trimmed
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw pathOutsideWorkspaceError(
      `Tool ${options.toolName} rejected ${options.fieldName}: path traversal is not allowed.`
    );
  }
  if (segments.length === 0) {
    if (options.allowDot) {
      return ".";
    }
    throw pathOutsideWorkspaceError(
      `Tool ${options.toolName} rejected ${options.fieldName}: path must stay inside the workspace.`
    );
  }
  return segments.join("/");
}

export function ensurePayloadWithinLimit(value: string, options: PayloadLimitOptions): void {
  const byteLength = new TextEncoder().encode(value).length;
  if (byteLength <= options.maxBytes) {
    return;
  }
  throw payloadTooLargeError(
    `Tool ${options.toolName} rejected ${options.fieldName}: payload is ${byteLength} bytes, limit is ${options.maxBytes} bytes.`
  );
}

export function ensureCommandLengthWithinLimit(
  command: string,
  options: CommandLengthLimitOptions
): void {
  if (command.length <= options.maxChars) {
    return;
  }
  throw payloadTooLargeError(
    `Tool ${options.toolName} rejected ${options.fieldName}: command is ${command.length} chars, limit is ${options.maxChars} chars.`
  );
}

export function toOptionalRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

import {
  type Decision,
  type EnvVar,
  getNativeBinding,
  type NativeExecOptions,
  type NativeExecResult,
  type NativeSandbox,
  type NativeSandboxConfig,
  type NativeSandboxManager,
  type NativeSandboxPolicy,
  type ViolationResult,
} from "./native";

export type ActionIntent = "read" | "write" | "create" | "delete" | "rename" | "move";

export interface RuntimeSandboxConfig {
  networkAccess: string;
  allowedHosts?: string[];
  fsIsolation: string;
  fsAccess?: "read-only" | "read-write";
  workingDirectory?: string;
}

export type SandboxConfig = RuntimeSandboxConfig & { allowedRoots?: string[] };

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  stdin?: string;
  maxOutputBytes?: number;
  env?: EnvVar[] | Record<string, string>;
}

export interface ExecResult extends NativeExecResult {}

export interface SandboxPolicy {
  evaluateFileAction(path: string, intent: ActionIntent): Decision;
  execute(cmd: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
  read(path: string): Buffer;
  write(path: string, data: Buffer): void;
  list(path: string): string[];
}

export type SandboxPolicyConfig = NativeSandboxPolicy;

export interface SandboxViolation {
  type: "filesystem" | "network" | "command";
  action: string;
  reason: string;
  timestamp: number;
}

export class SandboxManager {
  private readonly native: NativeSandboxManager;
  private violations: SandboxViolation[] = [];

  constructor(policy: SandboxPolicyConfig, workspaceRoot: string) {
    const native = getNativeBinding();
    this.native = new native.SandboxManager(policy, workspaceRoot);
  }

  async checkFileAccess(path: string, operation: ActionIntent): Promise<boolean> {
    const result = this.native.checkFileAccess(path, operation);
    this.recordViolation("filesystem", `${operation} ${path}`, result);
    return result.allowed;
  }

  async checkNetworkRequest(url: string, method: string): Promise<boolean> {
    const result = this.native.checkNetworkRequest(url, method);
    this.recordViolation("network", `${method} ${url}`, result);
    return result.allowed;
  }

  async checkCommand(command: string): Promise<boolean> {
    const result = this.native.checkCommand(command);
    this.recordViolation("command", command, result);
    return result.allowed;
  }

  getViolations(): SandboxViolation[] {
    return [...this.violations];
  }

  clearViolations(): void {
    this.violations = [];
  }

  private recordViolation(
    type: SandboxViolation["type"],
    action: string,
    result: ViolationResult
  ): void {
    if (!result.allowed && result.reason) {
      this.violations.push({
        type,
        action,
        reason: result.reason,
        timestamp: Date.now(),
      });
    }
  }
}

export { STRICT_POLICY, WORKSPACE_POLICY } from "./policies";

export function createSandbox(config: SandboxConfig): SandboxPolicy {
  const native = getNativeBinding();
  const sandbox = native.createSandbox(normalizeConfig(config));
  return wrapSandbox(sandbox);
}

function normalizeConfig(config: SandboxConfig): NativeSandboxConfig {
  return {
    networkAccess: config.networkAccess,
    allowedHosts: config.allowedHosts,
    allowedRoots: config.allowedRoots,
    fsIsolation: config.fsIsolation,
    fsAccess: config.fsAccess,
    workingDirectory: config.workingDirectory,
  };
}

function wrapSandbox(sandbox: NativeSandbox): SandboxPolicy {
  return {
    evaluateFileAction: (path, intent) => sandbox.evaluateFileAction(path, intent),
    execute: (cmd, args, options) => sandbox.execute(cmd, args, normalizeExecOptions(options)),
    read: (path) => sandbox.read(path),
    write: (path, data) => sandbox.write(path, data),
    list: (path) => sandbox.list(path),
  };
}

function normalizeExecOptions(options?: ExecOptions): NativeExecOptions | undefined {
  if (!options) {
    return undefined;
  }
  const { env, ...rest } = options;
  if (!env) {
    return rest;
  }
  if (Array.isArray(env)) {
    return { ...rest, env };
  }

  const envArray: EnvVar[] = [];
  for (const [key, value] of Object.entries(env)) {
    envArray.push({ key, value });
  }
  return { ...rest, env: envArray };
}

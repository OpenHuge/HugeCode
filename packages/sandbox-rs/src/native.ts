import path from "node:path";
import { fileURLToPath } from "node:url";
import { nativeFlagStore } from "@ku0/native-bindings/flags";
import { loadNativeBinding } from "@ku0/native-bindings/node";

function isNativeDisabled(): boolean {
  const raw = process.env.SANDBOX_RS_DISABLE_NATIVE;
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isNativeEnabled(): boolean {
  if (isNativeDisabled()) {
    return false;
  }
  return nativeFlagStore.getFlag("native_accelerators_enabled");
}

function resolvePackageRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..");
}

export interface NativeSandboxBinding {
  [key: string]: unknown;
  createSandbox(config: NativeSandboxConfig): NativeSandbox;
  SandboxManager: NativeSandboxManagerConstructor;
}

export interface NativeSandboxConfig {
  networkAccess: string;
  allowedHosts?: string[];
  allowedRoots?: string[];
  fsIsolation: string;
  fsAccess?: string;
  workingDirectory?: string;
}

export interface NativeSandboxPolicy {
  version: string;
  name: string;
  filesystem: NativeFilesystemPolicy;
  network: NativeNetworkPolicy;
  commands: NativeCommandPolicy;
  limits: NativeResourceLimits;
}

export interface NativeFilesystemPolicy {
  mode: string;
  allowedPaths: string[];
  blockedPaths: string[];
  allowSymlinks: boolean;
  allowHiddenFiles: boolean;
}

export interface NativeNetworkPolicy {
  enabled: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowLocalhost: boolean;
  allowHttps: boolean;
  allowHttp: boolean;
}

export interface NativeCommandPolicy {
  mode: string;
  allowedCommands?: string[];
  blockedCommands?: string[];
  allowSudo: boolean;
}

export interface NativeResourceLimits {
  maxFileSize?: number;
  maxExecutionTime?: number;
  maxMemory?: number;
}

export interface NativeExecOptions {
  cwd?: string;
  timeoutMs?: number;
  stdin?: string;
  maxOutputBytes?: number;
  env?: EnvVar[];
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface NativeExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
}

export interface Decision {
  decision: string;
  reason?: string;
}

export interface ViolationResult {
  allowed: boolean;
  reason?: string;
}

export interface NativeSandbox {
  evaluateFileAction(path: string, intent: string): Decision;
  execute(cmd: string, args: string[], options?: NativeExecOptions): Promise<NativeExecResult>;
  read(path: string): Buffer;
  write(path: string, data: Buffer): void;
  list(path: string): string[];
}

export interface NativeSandboxManager {
  checkFileAccess(path: string, operation: string): ViolationResult;
  checkNetworkRequest(url: string, method: string): ViolationResult;
  checkCommand(command: string): ViolationResult;
}

export interface NativeSandboxManagerConstructor {
  new (policy: NativeSandboxPolicy, workspaceRoot: string): NativeSandboxManager;
}

let cachedBinding: NativeSandboxBinding | null | undefined;
let cachedError: Error | null = null;

export function getNativeBinding(): NativeSandboxBinding {
  if (!isNativeEnabled()) {
    throw new Error("Sandbox native binding disabled by policy.");
  }

  if (cachedBinding !== undefined) {
    if (!cachedBinding) {
      throw cachedError ?? new Error("Sandbox native binding is unavailable.");
    }
    return cachedBinding;
  }

  const packageRoot = resolvePackageRoot();
  const result = loadNativeBinding<NativeSandboxBinding>({
    packageRoot,
    bindingNames: ["sandbox_rs", "sandbox-rs", "index"],
    envVar: "SANDBOX_RS_BINDING_PATH",
    requiredExports: ["createSandbox", "SandboxManager"],
    logTag: "Sandbox native binding",
  });

  cachedError = result.error;
  cachedBinding = result.binding;
  if (!cachedBinding) {
    throw cachedError ?? new Error("Sandbox native binding is unavailable.");
  }

  return cachedBinding;
}

export function getNativeBindingError(): Error | null {
  return cachedError;
}

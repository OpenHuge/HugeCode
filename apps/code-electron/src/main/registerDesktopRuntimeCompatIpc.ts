import { spawn, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { IpcMainInvokeEvent } from "electron";

type IpcInvokeEventLike = IpcMainInvokeEvent;

export const DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS = {
  ACTION_REQUIRED_SUBMIT_V2: "code_action_required_submit_v2",
  MODELS_POOL: "code_models_pool",
  RUNTIME_BACKENDS_LIST: "code_runtime_backends_list",
  TURN_INTERRUPT: "code_turn_interrupt",
  TURN_SEND: "code_turn_send",
} as const;

type ReasonEffort = "low" | "medium" | "high" | "xhigh";

type ModelPoolEntry = {
  available: boolean;
  capabilities: Array<"chat" | "coding" | "reasoning" | "vision">;
  displayName: string;
  id: string;
  pool: "codex" | "claude";
  provider: "anthropic" | "openai";
  reasoningEfforts: ReasonEffort[];
  source: "fallback" | "local-codex";
  supportsReasoning: boolean;
  supportsVision: boolean;
};

type RuntimeBackendSummary = {
  backendId: string;
  displayName: string;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  rolloutState: "current";
  status: "active";
  healthy: boolean;
  healthScore: number;
  failures: number;
  queueDepth: number;
  runningTasks: number;
  createdAt: number;
  updatedAt: number;
  lastHeartbeatAt: number;
  backendKind: "native";
  origin: "runtime-native";
  readiness: {
    authState: "unknown" | "verified";
    reasons: string[];
    state: "attention" | "ready";
    summary: string;
  };
  operability: {
    placementEligible: boolean;
    reasons: string[];
    state: "attention" | "ready";
    summary: string;
  };
};

type TurnAck = {
  accepted: boolean;
  backendId?: string | null;
  message: string;
  routedModelId: string | null;
  routedPool: null;
  routedProvider: string | null;
  routedSource: "fallback";
  threadId: string | null;
  turnId: string | null;
};

type IpcMainLike = {
  handle(
    channel: string,
    listener: (event: IpcInvokeEventLike, ...args: unknown[]) => unknown
  ): void;
};

type RegisterDesktopRuntimeCompatIpcInput = {
  codexCommand?: DesktopCodexCommandRunner;
  ipcMain: IpcMainLike;
  isTrustedSender(event: IpcInvokeEventLike): boolean;
  nowMs?(): number;
  workspaceRoot?: string;
};

type CodexCliProbe = {
  available: boolean;
  version: string | null;
};

type CodexExecInput = {
  accessMode: string | null;
  modelId: string | null;
  prompt: string;
  workspaceRoot: string;
};

type CodexExecResult = {
  finalMessage: string | null;
};

type DesktopCodexCommandRunner = {
  exec(input: CodexExecInput): Promise<CodexExecResult>;
  probe(): CodexCliProbe;
};

function createCompatibilityBackend(input: {
  authState?: "unknown" | "verified";
  backendId: string;
  capability: string;
  displayName: string;
  healthy?: boolean;
  now: number;
  reason?: string;
  state?: "attention" | "ready";
  summary?: string;
}): RuntimeBackendSummary {
  const healthy = input.healthy ?? true;
  const state = input.state ?? "attention";
  const summary =
    input.summary ??
    "Electron t3 compatibility route is available. Real execution should be provided by the HugeCode runtime gateway when it is attached.";
  const reason = input.reason ?? "electron_t3_runtime_compatibility_bridge";
  return {
    backendId: input.backendId,
    displayName: input.displayName,
    capabilities: [input.capability, "code"],
    maxConcurrency: 1,
    costTier: "local",
    latencyClass: "local",
    rolloutState: "current",
    status: "active",
    healthy,
    healthScore: healthy ? 0.8 : 0,
    failures: 0,
    queueDepth: 0,
    runningTasks: 0,
    createdAt: input.now,
    updatedAt: input.now,
    lastHeartbeatAt: input.now,
    backendKind: "native",
    origin: "runtime-native",
    readiness: {
      state,
      summary,
      reasons: [reason],
      authState: input.authState ?? "unknown",
    },
    operability: {
      state,
      placementEligible: healthy,
      summary,
      reasons: [reason],
    },
  };
}

function createCompatibilityBackends(
  now: number,
  codexProbe: CodexCliProbe
): RuntimeBackendSummary[] {
  const codexSummary = codexProbe.available
    ? `Local Codex CLI ${codexProbe.version ?? ""} is available. Provider configuration is managed by the local Codex CLI.`
    : "Local Codex CLI is not available on PATH.";
  return [
    createCompatibilityBackend({
      authState: codexProbe.available ? "verified" : "unknown",
      backendId: "local-codex-cli",
      capability: "codex",
      displayName: "Local Codex CLI",
      healthy: codexProbe.available,
      now,
      reason: codexProbe.available ? "local_codex_cli_detected" : "local_codex_cli_unavailable",
      state: codexProbe.available ? "ready" : "attention",
      summary: codexSummary.trim(),
    }),
    createCompatibilityBackend({
      backendId: "local-claude-code-cli",
      capability: "claude",
      displayName: "Local Claude Code CLI",
      now,
    }),
  ];
}

function createCompatibilityModels(): ModelPoolEntry[] {
  return [
    {
      id: "gpt-5.4",
      displayName: "GPT-5.4",
      provider: "openai",
      pool: "codex",
      source: "local-codex",
      available: true,
      supportsReasoning: true,
      supportsVision: true,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning", "vision"],
    },
    {
      id: "gpt-5.3-codex",
      displayName: "GPT-5.3 Codex",
      provider: "openai",
      pool: "codex",
      source: "local-codex",
      available: true,
      supportsReasoning: true,
      supportsVision: true,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning", "vision"],
    },
    {
      id: "claude-sonnet-4.5",
      displayName: "Claude Sonnet 4.5",
      provider: "anthropic",
      pool: "claude",
      source: "fallback",
      available: true,
      supportsReasoning: true,
      supportsVision: false,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning"],
    },
    {
      id: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
      provider: "anthropic",
      pool: "claude",
      source: "fallback",
      available: true,
      supportsReasoning: true,
      supportsVision: false,
      reasoningEfforts: ["medium", "high", "xhigh"],
      capabilities: ["chat", "coding", "reasoning"],
    },
  ];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function probeLocalCodexCli(): CodexCliProbe {
  const output = spawnSync("codex", ["--version"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (output.status !== 0) {
    return { available: false, version: null };
  }
  return {
    available: true,
    version: asString(output.stdout?.trim()) ?? null,
  };
}

function resolveCodexAccessArgs(accessMode: string | null): string[] {
  if (accessMode === "read-only" || accessMode === "read_only") {
    return ["--sandbox", "read-only"];
  }
  if (accessMode === "full-access" || accessMode === "danger-full-access") {
    return ["--dangerously-bypass-approvals-and-sandbox"];
  }
  return ["--full-auto"];
}

function summarizeProcessOutput(value: string, maxLength = 1200): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "<empty>";
  }
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function createDefaultCodexCommandRunner(): DesktopCodexCommandRunner {
  return {
    probe: probeLocalCodexCli,
    async exec(input) {
      const outputPath = join(tmpdir(), `hugecode-t3-codex-${randomUUID()}.txt`);
      const args = [
        "exec",
        ...(input.modelId ? ["--model", input.modelId] : []),
        "--ephemeral",
        "--skip-git-repo-check",
        "--output-last-message",
        outputPath,
        "-C",
        input.workspaceRoot,
        ...resolveCodexAccessArgs(input.accessMode),
        input.prompt,
      ];
      const result = await new Promise<{ code: number | null; stderr: string; stdout: string }>(
        (resolve, reject) => {
          const child = spawn("codex", args, {
            cwd: input.workspaceRoot,
            env: process.env,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let stdout = "";
          let stderr = "";
          const timeout = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error("codex exec timed out after 10 minutes."));
          }, 600_000);
          child.stdout?.on("data", (chunk) => {
            stdout += String(chunk);
          });
          child.stderr?.on("data", (chunk) => {
            stderr += String(chunk);
          });
          child.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.once("close", (code) => {
            clearTimeout(timeout);
            resolve({ code, stderr, stdout });
          });
        }
      );
      const finalMessage = await fs
        .readFile(outputPath, "utf8")
        .then((value) => asString(value))
        .catch(() => null);
      await fs.rm(outputPath, { force: true }).catch(() => undefined);
      if (result.code !== 0) {
        throw new Error(
          `codex exec failed with status ${result.code}: stderr=${summarizeProcessOutput(result.stderr)}, stdout=${summarizeProcessOutput(result.stdout)}`
        );
      }
      return {
        finalMessage:
          finalMessage ??
          asString(
            result.stdout
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .at(-1)
          ),
      };
    },
  };
}

function readTurnPayload(input: unknown) {
  const envelope = asRecord(input);
  return asRecord(envelope?.payload);
}

function getPreferredBackendIds(payload: Record<string, unknown> | null): string[] {
  return Array.isArray(payload?.preferredBackendIds)
    ? payload.preferredBackendIds.filter((value): value is string => typeof value === "string")
    : [];
}

function createCompatibilityTurnAck(
  input: unknown,
  now: number,
  message = "Accepted by the Electron t3 compatibility bridge. Attach the HugeCode runtime gateway for real task execution."
): TurnAck {
  const payload = readTurnPayload(input);
  const preferredBackendIds = getPreferredBackendIds(payload);
  return {
    accepted: true,
    turnId: `electron-t3-compat-turn-${now}`,
    threadId: asString(payload?.threadId),
    routedProvider: asString(payload?.provider),
    routedModelId: asString(payload?.modelId),
    routedPool: null,
    routedSource: "fallback",
    backendId: preferredBackendIds[0] ?? null,
    message,
  };
}

export function registerDesktopRuntimeCompatIpc(input: RegisterDesktopRuntimeCompatIpcInput) {
  const nowMs = input.nowMs ?? Date.now;
  const codexCommand = input.codexCommand ?? createDefaultCodexCommandRunner();
  const workspaceRoot = input.workspaceRoot ?? process.cwd();

  function handleTrusted(channel: string, listener: (payload: unknown) => unknown) {
    input.ipcMain.handle(channel, async (event, payload) => {
      if (!input.isTrustedSender(event)) {
        throw new Error("Blocked untrusted desktop runtime IPC sender.");
      }
      return listener(payload);
    });
  }

  handleTrusted(DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.RUNTIME_BACKENDS_LIST, () =>
    createCompatibilityBackends(nowMs(), codexCommand.probe())
  );
  handleTrusted(DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.MODELS_POOL, () => createCompatibilityModels());
  handleTrusted(DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.TURN_SEND, async (payload) => {
    const turnPayload = readTurnPayload(payload);
    const preferredBackendIds = getPreferredBackendIds(turnPayload);
    if (!preferredBackendIds.includes("local-codex-cli")) {
      return createCompatibilityTurnAck(payload, nowMs());
    }
    const prompt = asString(turnPayload?.content);
    if (!prompt) {
      throw new Error("Cannot start local Codex CLI task without prompt content.");
    }
    const result = await codexCommand.exec({
      accessMode: asString(turnPayload?.accessMode),
      modelId: asString(turnPayload?.modelId),
      prompt,
      workspaceRoot,
    });
    return createCompatibilityTurnAck(
      payload,
      nowMs(),
      result.finalMessage
        ? `Local Codex CLI completed: ${result.finalMessage}`
        : "Local Codex CLI completed without a final message."
    );
  });
  handleTrusted(DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.TURN_INTERRUPT, () => true);
  handleTrusted(DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.ACTION_REQUIRED_SUBMIT_V2, () => ({
    requestId: null,
    status: "resolved",
    updatedAt: nowMs(),
  }));
}

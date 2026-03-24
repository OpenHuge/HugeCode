import type {
  CodeRuntimeRpcMethod,
  CodeRuntimeRpcRequestPayloadByMethod,
  CodeRuntimeRpcResponsePayloadByMethod,
  TerminalSessionSummary,
  TerminalStatus,
} from "@ku0/code-runtime-host-contract";

export type RuntimeRpcInvoker = <Method extends CodeRuntimeRpcMethod>(
  method: Method,
  params: CodeRuntimeRpcRequestPayloadByMethod[Method]
) => Promise<CodeRuntimeRpcResponsePayloadByMethod[Method]>;

export function invokeRuntimeExtensionRpc<Result>(
  invokeRpc: RuntimeRpcInvoker,
  method: string,
  params: Record<string, unknown>
): Promise<Result> {
  const invokeLoose = invokeRpc as unknown as (
    runtimeMethod: string,
    runtimeParams: Record<string, unknown>
  ) => Promise<Result>;
  return invokeLoose(method, params);
}

const TERMINAL_SESSION_STATES = new Set(["created", "exited", "ioFailed", "unsupported"]);
const TERMINAL_STATUS_STATES = new Set(["ready", "uninitialized", "unsupported"]);

export class RuntimeTerminalStatePayloadError extends Error {
  readonly method: string;
  readonly receivedState: unknown;
  readonly expectedStates: readonly string[];

  constructor(method: string, receivedState: unknown, expectedStates: readonly string[]) {
    super(
      `${method} returned invalid terminal state: expected one of [${expectedStates.join(", ")}], received ${String(
        receivedState
      )}.`
    );
    this.name = "RuntimeTerminalStatePayloadError";
    this.method = method;
    this.receivedState = receivedState;
    this.expectedStates = expectedStates;
  }
}

export function normalizeTerminalSessionSummary(
  method: string,
  summary: TerminalSessionSummary
): TerminalSessionSummary {
  const rawState = (summary as { state?: unknown }).state;
  if (typeof rawState !== "string" || !TERMINAL_SESSION_STATES.has(rawState)) {
    throw new RuntimeTerminalStatePayloadError(method, rawState, [...TERMINAL_SESSION_STATES]);
  }
  return {
    ...summary,
    state: rawState as TerminalSessionSummary["state"],
  };
}

export function normalizeNullableTerminalSessionSummary(
  method: string,
  summary: TerminalSessionSummary | null
): TerminalSessionSummary | null {
  if (!summary) {
    return null;
  }
  return normalizeTerminalSessionSummary(method, summary);
}

export function normalizeTerminalStatus(method: string, status: TerminalStatus): TerminalStatus {
  const rawState = (status as { state?: unknown }).state;
  if (typeof rawState !== "string" || !TERMINAL_STATUS_STATES.has(rawState)) {
    throw new RuntimeTerminalStatePayloadError(method, rawState, [...TERMINAL_STATUS_STATES]);
  }
  return {
    ...status,
    state: rawState as TerminalStatus["state"],
  };
}

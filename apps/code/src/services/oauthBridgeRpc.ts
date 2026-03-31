type JsonRecord = Record<string, unknown>;

type RuntimeErrorLike = {
  code?: string | null;
  message: string;
};

export type InvokeWebRuntimeRpcDeps = {
  webRuntimeRpcEndpointEnvKey: string;
  resolveWebRuntimeRpcEndpoint(): string | null;
  isRecord(value: unknown): value is JsonRecord;
  normalizeNullableText(value: unknown): string | null;
  readResponseErrorCode(payload: unknown): string | null;
  normalizeOauthErrorCode(code: string | null): string | null;
  createRuntimeError(input: RuntimeErrorLike): Error;
};

function readResponseErrorMessage(
  deps: Pick<InvokeWebRuntimeRpcDeps, "isRecord" | "normalizeNullableText">,
  payload: unknown
): string | null {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!deps.isRecord(payload)) {
    return null;
  }
  const directMessage = deps.normalizeNullableText(payload.message);
  if (directMessage) {
    return directMessage;
  }
  const errorRecord = deps.isRecord(payload.error) ? payload.error : null;
  return deps.normalizeNullableText(errorRecord?.message);
}

async function readResponsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      const trimmed = text.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }
}

export async function invokeWebRuntimeRpcWithDeps<Result>(
  deps: InvokeWebRuntimeRpcDeps,
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Result> {
  const endpoint = deps.resolveWebRuntimeRpcEndpoint();
  if (!endpoint) {
    throw new Error(
      `Missing runtime endpoint configuration for web OAuth. Set ${deps.webRuntimeRpcEndpointEnvKey}.`
    );
  }
  if (typeof fetch !== "function") {
    throw new Error(`Fetch API is unavailable in this runtime; cannot invoke ${method}.`);
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      method,
      params,
    }),
    signal,
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    const message =
      readResponseErrorMessage(deps, payload) ??
      `Runtime RPC ${method} failed with status ${response.status}.`;
    throw deps.createRuntimeError({
      code: deps.normalizeOauthErrorCode(deps.readResponseErrorCode(payload)),
      message,
    });
  }
  if (!deps.isRecord(payload) || payload.ok !== true) {
    const message = readResponseErrorMessage(deps, payload) ?? `Runtime RPC ${method} failed.`;
    throw deps.createRuntimeError({
      code: deps.normalizeOauthErrorCode(deps.readResponseErrorCode(payload)),
      message,
    });
  }
  return payload.result as Result;
}

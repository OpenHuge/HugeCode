import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import {
  createRuntimeRpcInvokerWithCandidates,
  invokeTauriRaw as invokeTauriRawShared,
} from "@ku0/code-runtime-client/runtimeClientTransportCore";
import { detectRuntimeMode } from "./runtimeClientMode";
import { createRpcRuntimeClient } from "./runtimeClientRpcClient";
import {
  resolveCapabilitiesSnapshotByMode,
  resolveTauriRuntimeRpcMethodCandidates,
  resolveWebRuntimeRpcMethodCandidates,
} from "./runtimeClientCapabilitiesProbe";
import {
  RuntimeUnavailableError,
  rejectUnavailable,
  type RuntimeRpcParams,
} from "@ku0/code-runtime-client/runtimeClientTransportShared";
export {
  RuntimeRpcMethodUnsupportedError,
  RuntimeUnavailableError,
} from "@ku0/code-runtime-client/runtimeClientTransportShared";
import type {
  RuntimeCapabilitiesSummary,
  RuntimeClient as SharedRuntimeClient,
} from "@ku0/code-runtime-client/runtimeClientTypes";
import type { AppSettings } from "../types";
import { createUnavailableRuntimeClient } from "./runtimeClientUnavailable";
import { invokeWebRuntimeRaw } from "./runtimeClientWebTransport";

type RuntimeClient = SharedRuntimeClient<AppSettings>;

async function invokeTauriRaw<Result>(method: string, params: RuntimeRpcParams): Promise<Result> {
  return invokeTauriRawShared(
    <Value>(candidate: string, candidateParams: RuntimeRpcParams) =>
      invoke<Value>(candidate, candidateParams),
    method,
    params
  );
}

export async function readRuntimeCapabilitiesSummary(): Promise<RuntimeCapabilitiesSummary> {
  const mode = detectRuntimeMode();
  if (mode === "unavailable") {
    return {
      mode,
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    };
  }

  try {
    const snapshot = await resolveCapabilitiesSnapshotByMode(mode);
    return {
      mode,
      methods: snapshot ? [...snapshot.methods] : [],
      features: snapshot ? [...snapshot.features] : [],
      wsEndpointPath: snapshot?.wsEndpointPath ?? null,
      error: null,
    };
  } catch (error) {
    return {
      mode,
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: getErrorMessage(error) || "Runtime capabilities unavailable.",
    };
  }
}

const unavailableClient = createUnavailableRuntimeClient(rejectUnavailable);

const webRuntimeClient = createRpcRuntimeClient(
  createRuntimeRpcInvokerWithCandidates(invokeWebRuntimeRaw, resolveWebRuntimeRpcMethodCandidates)
);

const tauriClient = createRpcRuntimeClient(
  createRuntimeRpcInvokerWithCandidates(invokeTauriRaw, resolveTauriRuntimeRpcMethodCandidates)
);

export function getRuntimeClient(): RuntimeClient {
  const mode = detectRuntimeMode();

  if (mode === "tauri") {
    return tauriClient;
  }
  if (mode === "runtime-gateway-web") {
    return webRuntimeClient;
  }
  return unavailableClient;
}

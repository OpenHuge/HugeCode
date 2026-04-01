// Canonical shell only: keep domain payload ownership in split `code-runtime-rpc/*` modules.
export type * from "./code-runtime-rpc/foundation.js";
export {
  CODE_RUNTIME_CANONICAL_MISSION_LAUNCH_METHODS,
  CODE_RUNTIME_CANONICAL_RUN_LIFECYCLE_METHODS,
  CODE_RUNTIME_COMPAT_THREAD_TURN_METHODS,
  CODE_RUNTIME_RPC_CAPABILITY_PROFILES,
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES,
  CODE_RUNTIME_RPC_METHOD_LIST,
  CODE_RUNTIME_RPC_METHODS,
  CODE_RUNTIME_RPC_TRANSPORTS,
} from "./code-runtime-rpc/rpcCore.js";
export type {
  CodeRuntimeRpcCapabilities,
  CodeRuntimeRpcCapabilitiesMetadata,
  CodeRuntimeRpcCapabilityProfile,
  CodeRuntimeRpcEmptyParams,
  CodeRuntimeRpcError,
  CodeRuntimeRpcErrorCode,
  CodeRuntimeRpcInvocationCompletionMode,
  CodeRuntimeRpcInvocationPolicy,
  CodeRuntimeRpcMethod,
  CodeRuntimeRpcResponseEnvelope,
  CodeRuntimeRpcTransports,
} from "./code-runtime-rpc/rpcCore.js";

export type * from "./code-runtime-rpc/agentExecution.js";

export type * from "./code-runtime-rpc/backendsAndRuns.js";

export type * from "./code-runtime-rpc/workspaceAndGit.js";

export type * from "./code-runtime-rpc/providersAndAuth.js";

export type * from "./code-runtime-rpc/runtimeFeatures.js";
export type * from "./runtimeCompositionPlane.js";
export type * from "./runtimeCompositionProfiles.js";
export {
  RUNTIME_COMPOSITION_APPLIED_LAYER_ORDER,
  RUNTIME_COMPOSITION_CONFIG_LAYER_SOURCES,
  RUNTIME_COMPOSITION_PROFILE_SCOPES,
} from "./runtimeCompositionProfiles.js";

export type * from "./code-runtime-rpc/payloadMaps.js";

import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_METHOD_LIST,
  CODE_RUNTIME_RPC_TRANSPORTS,
} from "./code-runtime-rpc/rpcCore.js";
import type { CodeRuntimeRpcMethod, CodeRuntimeRpcTransports } from "./code-runtime-rpc/rpcCore.js";

export const CODE_RUNTIME_RPC_CONTRACT_VERSION = "2026-03-25" as const;
export const CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT = "2026-03-25" as const;

const CODE_RUNTIME_RPC_METHOD_SET: ReadonlySet<string> = new Set(CODE_RUNTIME_RPC_METHOD_LIST);

export function isCodeRuntimeRpcMethod(value: unknown): value is CodeRuntimeRpcMethod {
  return typeof value === "string" && CODE_RUNTIME_RPC_METHOD_SET.has(value);
}

export function computeCodeRuntimeRpcMethodSetHash(methods: Iterable<string>): string {
  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = 0xffffffffffffffffn;
  const normalized = [...new Set([...methods].map((entry) => entry.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
  let hash = FNV_OFFSET_BASIS;
  for (const method of normalized) {
    for (let index = 0; index < method.length; index += 1) {
      hash ^= BigInt(method.charCodeAt(index) & 0xff);
      hash = (hash * FNV_PRIME) & MASK_64;
    }
    hash ^= 0xffn;
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}
export type CodeRuntimeRpcSpec = {
  contractVersion: string;
  freezeEffectiveAt: string;
  methodSetHash: string;
  methods: readonly string[];
  canonicalMethods: readonly CodeRuntimeRpcMethod[];
  features: readonly string[];
  errorCodes: typeof CODE_RUNTIME_RPC_ERROR_CODES;
  transports: CodeRuntimeRpcTransports;
  executionGraphFields: readonly string[];
};

export const CODE_RUNTIME_RPC_EXECUTION_GRAPH_FIELDS = Object.freeze([
  "executionGraph",
  "graphId",
  "nodes",
  "edges",
  "status",
  "executorKind",
  "executorSessionId",
  "preferredBackendIds",
  "resolvedBackendId",
  "placementLifecycleState",
  "placementResolutionSource",
  "checkpoint",
  "reviewActionability",
] as const);

export function buildCodeRuntimeRpcSpec(): CodeRuntimeRpcSpec {
  const methods = [...CODE_RUNTIME_RPC_METHOD_LIST].sort((left, right) =>
    left.localeCompare(right)
  );
  return {
    contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    methodSetHash: computeCodeRuntimeRpcMethodSetHash(methods),
    methods,
    canonicalMethods: CODE_RUNTIME_RPC_METHOD_LIST,
    features: CODE_RUNTIME_RPC_FEATURES,
    errorCodes: CODE_RUNTIME_RPC_ERROR_CODES,
    transports: CODE_RUNTIME_RPC_TRANSPORTS,
    executionGraphFields: CODE_RUNTIME_RPC_EXECUTION_GRAPH_FIELDS,
  };
}

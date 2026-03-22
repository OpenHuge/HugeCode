/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeClientCapabilitiesContract`.
 */
export type {
  RuntimeRpcCapabilitiesSnapshot,
  RuntimeRpcMethodInvocationPolicy,
  RuntimeRpcContractGuardError,
} from "@ku0/code-runtime-client/runtimeClientCapabilitiesContract";
export {
  RuntimeRpcContractVersionMismatchError,
  RuntimeRpcCapabilitiesMethodSetHashMismatchError,
  RuntimeRpcCapabilitiesMethodSetHashMissingError,
  RuntimeRpcContractProfileMismatchError,
  RuntimeRpcContractCanonicalMethodsOnlyError,
  RuntimeRpcContractFeatureMissingError,
  RuntimeRpcContractFreezeEffectiveAtMismatchError,
  RuntimeRpcContractErrorCodesMismatchError,
  assertRuntimeRpcContractVersionSupported,
  assertRuntimeRpcMethodSetHashSupported,
  assertRuntimeRpcProfileSupported,
  assertRuntimeRpcCanonicalMethodsSupported,
  assertRuntimeRpcContractFeaturesSupported,
  assertRuntimeRpcFreezeEffectiveAtSupported,
  assertRuntimeRpcContractMetadataSupported,
  normalizeRpcCapabilitiesPayload,
  isRuntimeRpcContractGuardError,
} from "@ku0/code-runtime-client/runtimeClientCapabilitiesContract";
